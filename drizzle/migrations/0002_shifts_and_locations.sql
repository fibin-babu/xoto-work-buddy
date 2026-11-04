ALTER TABLE public.profiles ADD COLUMN shift_start time, ADD COLUMN shift_end time;

CREATE TABLE public.work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 200 CHECK (radius_m BETWEEN 20 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_locations TO authenticated;
GRANT ALL ON public.work_locations TO service_role;
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin locations" ON public.work_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read locations" ON public.work_locations FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_locations (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_locations TO authenticated;
GRANT ALL ON public.user_locations TO service_role;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin user locations" ON public.user_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read user locations" ON public.user_locations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.manages_user(auth.uid(), user_id));

ALTER TABLE public.attendance
  ADD COLUMN in_lat double precision, ADD COLUMN in_lng double precision, ADD COLUMN in_accuracy double precision,
  ADD COLUMN in_onsite boolean, ADD COLUMN in_location_name text,
  ADD COLUMN out_lat double precision, ADD COLUMN out_lng double precision, ADD COLUMN out_accuracy double precision,
  ADD COLUMN out_onsite boolean, ADD COLUMN out_location_name text;

CREATE OR REPLACE FUNCTION public.nearest_work_location(_user uuid, _lat double precision, _lng double precision, OUT onsite boolean, OUT loc_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; d double precision; best double precision := null;
BEGIN
  onsite := null; loc_name := null;
  IF _lat IS NULL OR _lng IS NULL THEN RETURN; END IF;
  FOR r IN SELECT w.* FROM public.work_locations w JOIN public.user_locations ul ON ul.location_id = w.id WHERE ul.user_id = _user LOOP
    d := 2 * 6371000 * asin(sqrt(power(sin(radians(r.lat - _lat) / 2), 2)
         + cos(radians(_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - _lng) / 2), 2)));
    IF best IS NULL OR d - r.radius_m < best THEN
      best := d - r.radius_m; loc_name := r.name; onsite := d <= r.radius_m;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.attendance_geo_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO g FROM public.nearest_work_location(NEW.user_id, NEW.in_lat, NEW.in_lng);
    NEW.in_onsite := g.onsite; NEW.in_location_name := g.loc_name;
  ELSE
    NEW.in_lat := OLD.in_lat; NEW.in_lng := OLD.in_lng; NEW.in_onsite := OLD.in_onsite; NEW.in_location_name := OLD.in_location_name;
    IF NEW.out_lat IS DISTINCT FROM OLD.out_lat OR NEW.out_lng IS DISTINCT FROM OLD.out_lng THEN
      SELECT * INTO g FROM public.nearest_work_location(NEW.user_id, NEW.out_lat, NEW.out_lng);
      NEW.out_onsite := g.onsite; NEW.out_location_name := g.loc_name;
    ELSE
      NEW.out_onsite := OLD.out_onsite; NEW.out_location_name := OLD.out_location_name;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER attendance_geo BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_geo_check();