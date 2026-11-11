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
