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