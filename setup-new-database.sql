-- Full database setup for a BRAND-NEW Supabase project.
-- Run this once in the Supabase SQL Editor of your own project.
-- It creates every table, security rule and function the app needs.

-- Storage bucket for task file attachments (private).
insert into storage.buckets (id, name, public) values ('task-files','task-files', false) on conflict (id) do nothing;

-- ===== 0000_xoto_tracker.sql =====
CREATE TYPE public.app_role AS ENUM ('admin','manager','employee');
CREATE TYPE public.task_status AS ENUM ('done','in_progress','blocked');

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  manager_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ADD CONSTRAINT teams_manager_fk FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT current_date,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.attendance(user_id, work_date);
CREATE TABLE public.breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT current_date,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (char_length(description) <= 2000),
  hours numeric(4,2) NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  status public.task_status NOT NULL DEFAULT 'done',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tasks(user_id, work_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams, public.profiles, public.attendance, public.breaks, public.tasks TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.teams, public.profiles, public.user_roles, public.attendance, public.breaks, public.tasks TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.manages_user(_manager uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.teams t ON t.id = p.team_id
    WHERE p.id = _user AND t.manager_id = _manager
  )
$$;

-- user_roles
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
-- teams
CREATE POLICY "read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin teams" ON public.teams FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
-- profiles
CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.manages_user(auth.uid(), id));
CREATE POLICY "admin profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
-- attendance / breaks / tasks: owner writes, admin & manager read
CREATE POLICY "read attendance" ON public.attendance FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.manages_user(auth.uid(), user_id));
CREATE POLICY "own attendance ins" ON public.attendance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own attendance upd" ON public.attendance FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "read breaks" ON public.breaks FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.manages_user(auth.uid(), user_id));
CREATE POLICY "own breaks ins" ON public.breaks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own breaks upd" ON public.breaks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "read tasks" ON public.tasks FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.manages_user(auth.uid(), user_id));
CREATE POLICY "own tasks ins" ON public.tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own tasks upd" ON public.tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own tasks del" ON public.tasks FOR DELETE TO authenticated USING (user_id = auth.uid());
-- ===== 0001_task_attachments.sql =====
ALTER TABLE public.tasks ADD COLUMN attachment_path text, ADD COLUMN attachment_name text;
COMMENT ON COLUMN public.tasks.status IS 'DEPRECATED: status no longer collected in the UI';
CREATE POLICY "task files upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task files delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.manages_user(auth.uid(), ((storage.foldername(name))[1])::uuid)));
-- ===== 0002_shifts_and_locations.sql =====
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
-- ===== 0003_one_location_per_person.sql =====
CREATE UNIQUE INDEX user_locations_one_per_user ON public.user_locations (user_id);
-- ===== 0004_private_person_location_events.sql =====
ALTER TABLE public.breaks ADD COLUMN start_lat double precision, ADD COLUMN start_lng double precision, ADD COLUMN start_accuracy double precision, ADD COLUMN end_lat double precision, ADD COLUMN end_lng double precision, ADD COLUMN end_accuracy double precision;
CREATE TABLE public.location_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), attendance_id uuid NOT NULL REFERENCES public.attendance(id), break_id uuid REFERENCES public.breaks(id), work_date date NOT NULL, action text NOT NULL CHECK (action IN ('clock_in','break_start','break_end','clock_out')), captured_at timestamptz NOT NULL DEFAULT now(), lat double precision, lng double precision, accuracy double precision, expected_name text, expected_lat double precision, expected_lng double precision, radius_m integer, distance_m double precision, review_status text NOT NULL CHECK (review_status IN ('match','mismatch','unavailable','unassigned'))
);
GRANT SELECT ON public.location_events TO authenticated;
GRANT ALL ON public.location_events TO service_role;
ALTER TABLE public.location_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviewers read location events" ON public.location_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (user_id <> auth.uid() AND public.manages_user(auth.uid(), user_id)));
CREATE UNIQUE INDEX location_events_action_unique ON public.location_events(attendance_id, action) WHERE break_id IS NULL;
CREATE UNIQUE INDEX location_events_break_unique ON public.location_events(break_id, action) WHERE break_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.capture_location_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_action text; v_lat double precision; v_lng double precision; v_accuracy double precision; v_att uuid; v_break uuid; v_date date; v_time timestamptz; w record; d double precision; s text;
BEGIN
 IF TG_TABLE_NAME='attendance' THEN
  v_att:=NEW.id; v_date:=NEW.work_date;
  IF TG_OP='INSERT' THEN v_action:='clock_in'; v_lat:=NEW.in_lat; v_lng:=NEW.in_lng; v_accuracy:=NEW.in_accuracy; v_time:=NEW.clock_in;
  ELSIF OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN v_action:='clock_out'; v_lat:=NEW.out_lat; v_lng:=NEW.out_lng; v_accuracy:=NEW.out_accuracy; v_time:=NEW.clock_out;
  ELSE RETURN NEW; END IF;
 ELSE
  v_att:=NEW.attendance_id; v_break:=NEW.id;
  SELECT work_date INTO v_date FROM public.attendance WHERE id=v_att AND user_id=NEW.user_id;
  IF v_date IS NULL THEN RAISE EXCEPTION 'Invalid attendance for break'; END IF;
  IF TG_OP='INSERT' THEN v_action:='break_start'; v_lat:=NEW.start_lat; v_lng:=NEW.start_lng; v_accuracy:=NEW.start_accuracy; v_time:=NEW.start_at;
  ELSIF OLD.end_at IS NULL AND NEW.end_at IS NOT NULL THEN v_action:='break_end'; v_lat:=NEW.end_lat; v_lng:=NEW.end_lng; v_accuracy:=NEW.end_accuracy; v_time:=NEW.end_at;
  ELSE RETURN NEW; END IF;
 END IF;
 IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90 OR v_lng IS NULL OR v_lng < -180 OR v_lng > 180 OR v_accuracy IS NULL OR v_accuracy < 0) THEN RAISE EXCEPTION 'Invalid location'; END IF;
 SELECT l.name,l.lat,l.lng,l.radius_m INTO w FROM public.work_locations l JOIN public.user_locations u ON u.location_id=l.id WHERE u.user_id=NEW.user_id;
 IF w.name IS NULL THEN s:='unassigned';
 ELSIF v_lat IS NULL OR v_lng IS NULL THEN s:='unavailable';
 ELSE d:=2*6371000*asin(sqrt(least(1.0,power(sin(radians(w.lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(w.lat))*power(sin(radians(w.lng-v_lng)/2),2)))); s:=CASE WHEN d<=w.radius_m THEN 'match' ELSE 'mismatch' END; END IF;
 INSERT INTO public.location_events(user_id,attendance_id,break_id,work_date,action,captured_at,lat,lng,accuracy,expected_name,expected_lat,expected_lng,radius_m,distance_m,review_status) VALUES(NEW.user_id,v_att,v_break,v_date,v_action,v_time,v_lat,v_lng,v_accuracy,w.name,w.lat,w.lng,w.radius_m,d,s) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_attendance_location AFTER INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.capture_location_event();
CREATE TRIGGER capture_break_location AFTER INSERT OR UPDATE ON public.breaks FOR EACH ROW EXECUTE FUNCTION public.capture_location_event();
REVOKE SELECT ON public.attendance FROM authenticated;
GRANT SELECT(id,user_id,work_date,clock_in,clock_out,created_at,in_lat,in_lng,in_accuracy,out_lat,out_lng,out_accuracy) ON public.attendance TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nearest_work_location(uuid,double precision,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nearest_work_location(uuid,double precision,double precision) TO service_role;
COMMENT ON COLUMN public.attendance.in_onsite IS 'DEPRECATED: reviewer UI uses private location_events';
COMMENT ON COLUMN public.attendance.out_onsite IS 'DEPRECATED: reviewer UI uses private location_events';
COMMENT ON COLUMN public.attendance.in_location_name IS 'DEPRECATED: reviewer UI uses private location_events';
COMMENT ON COLUMN public.attendance.out_location_name IS 'DEPRECATED: reviewer UI uses private location_events';
-- ===== 0005_suspend_and_delete_users.sql =====
-- Suspend: person can no longer use the platform; reversible.
-- Delete: login account is removed for good; the profile row stays (marked deleted) so history keeps its owner.
ALTER TABLE public.profiles ADD COLUMN suspended_at timestamptz, ADD COLUMN deleted_at timestamptz;

-- Previously deleting the auth user cascaded to the profile and from there to all attendance, breaks and tasks.
-- Drop that link so deleting a login account keeps the person's history.
-- Found by what it references rather than by name, so a differently named constraint can't silently survive.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass) THEN
    RAISE EXCEPTION 'profiles still references auth.users; deleting a user would erase their history';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND suspended_at IS NULL AND deleted_at IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;

-- Lets a signed-in person learn only their own status, so the app can sign them out with a clear message.
CREATE OR REPLACE FUNCTION public.my_account_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p.id IS NULL OR p.deleted_at IS NOT NULL THEN 'deleted'
    WHEN p.suspended_at IS NOT NULL THEN 'suspended'
    ELSE 'active'
  END
  FROM (SELECT auth.uid() AS uid) me LEFT JOIN public.profiles p ON p.id = me.uid
$$;
REVOKE EXECUTE ON FUNCTION public.my_account_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_status() TO authenticated, service_role;

-- Restrictive policies are ANDed with every existing policy: an inactive person's still-valid session
-- can no longer read or write anything, while admins and managers keep seeing that person's history.
CREATE POLICY "active users only" ON public.teams AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.attendance AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.breaks AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.work_locations AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.user_locations AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "active users only" ON public.location_events AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
CREATE POLICY "task files active users only" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'task-files' OR (SELECT public.is_active_user(auth.uid())))
  WITH CHECK (bucket_id <> 'task-files' OR (SELECT public.is_active_user(auth.uid())));

-- ===== 0006_attendance_ip_capture.sql =====
-- Combination capture: alongside the GPS point, record the network (IP) each clock-in/break/clock-out
-- came from, so reviewers can flag entries whose signals don't agree (off-site, different network, weak GPS).
-- The IP is written by trusted server functions; it is never exposed to employees.
ALTER TABLE public.attendance ADD COLUMN in_ip text, ADD COLUMN out_ip text;
ALTER TABLE public.breaks ADD COLUMN start_ip text, ADD COLUMN end_ip text;
ALTER TABLE public.location_events ADD COLUMN ip text;

-- in_ip/out_ip/start_ip/end_ip are not in the authenticated SELECT grants, so employees can't read them.
-- The trigger (SECURITY DEFINER) copies the right one into location_events.ip, which only reviewers can read.
CREATE OR REPLACE FUNCTION public.capture_location_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_action text; v_lat double precision; v_lng double precision; v_accuracy double precision; v_ip text; v_att uuid; v_break uuid; v_date date; v_time timestamptz; w record; d double precision; s text;
BEGIN
 IF TG_TABLE_NAME='attendance' THEN
  v_att:=NEW.id; v_date:=NEW.work_date;
  IF TG_OP='INSERT' THEN v_action:='clock_in'; v_lat:=NEW.in_lat; v_lng:=NEW.in_lng; v_accuracy:=NEW.in_accuracy; v_ip:=NEW.in_ip; v_time:=NEW.clock_in;
  ELSIF OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN v_action:='clock_out'; v_lat:=NEW.out_lat; v_lng:=NEW.out_lng; v_accuracy:=NEW.out_accuracy; v_ip:=NEW.out_ip; v_time:=NEW.clock_out;
  ELSE RETURN NEW; END IF;
 ELSE
  v_att:=NEW.attendance_id; v_break:=NEW.id;
  SELECT work_date INTO v_date FROM public.attendance WHERE id=v_att AND user_id=NEW.user_id;
  IF v_date IS NULL THEN RAISE EXCEPTION 'Invalid attendance for break'; END IF;
  IF TG_OP='INSERT' THEN v_action:='break_start'; v_lat:=NEW.start_lat; v_lng:=NEW.start_lng; v_accuracy:=NEW.start_accuracy; v_ip:=NEW.start_ip; v_time:=NEW.start_at;
  ELSIF OLD.end_at IS NULL AND NEW.end_at IS NOT NULL THEN v_action:='break_end'; v_lat:=NEW.end_lat; v_lng:=NEW.end_lng; v_accuracy:=NEW.end_accuracy; v_ip:=NEW.end_ip; v_time:=NEW.end_at;
  ELSE RETURN NEW; END IF;
 END IF;
 IF v_lat IS NOT NULL AND (v_lat < -90 OR v_lat > 90 OR v_lng IS NULL OR v_lng < -180 OR v_lng > 180 OR v_accuracy IS NULL OR v_accuracy < 0) THEN RAISE EXCEPTION 'Invalid location'; END IF;
 SELECT l.name,l.lat,l.lng,l.radius_m INTO w FROM public.work_locations l JOIN public.user_locations u ON u.location_id=l.id WHERE u.user_id=NEW.user_id;
 IF w.name IS NULL THEN s:='unassigned';
 ELSIF v_lat IS NULL OR v_lng IS NULL THEN s:='unavailable';
 ELSE d:=2*6371000*asin(sqrt(least(1.0,power(sin(radians(w.lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(w.lat))*power(sin(radians(w.lng-v_lng)/2),2)))); s:=CASE WHEN d<=w.radius_m THEN 'match' ELSE 'mismatch' END; END IF;
 INSERT INTO public.location_events(user_id,attendance_id,break_id,work_date,action,captured_at,lat,lng,accuracy,ip,expected_name,expected_lat,expected_lng,radius_m,distance_m,review_status) VALUES(NEW.user_id,v_att,v_break,v_date,v_action,v_time,v_lat,v_lng,v_accuracy,v_ip,w.name,w.lat,w.lng,w.radius_m,d,s) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;

