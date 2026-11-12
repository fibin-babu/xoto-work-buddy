-- Run this ONCE in the Supabase SQL Editor to apply the suspend/delete and IP-capture
-- database changes (migrations 0005 and 0006). It is safe to run more than once.

-- ========== 0005: suspend and delete users ==========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Drop the profiles -> auth.users cascade so deleting a login account keeps the person's history.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND suspended_at IS NULL AND deleted_at IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;

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

DROP POLICY IF EXISTS "active users only" ON public.teams;
CREATE POLICY "active users only" ON public.teams AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.profiles;
CREATE POLICY "active users only" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.user_roles;
CREATE POLICY "active users only" ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.attendance;
CREATE POLICY "active users only" ON public.attendance AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.breaks;
CREATE POLICY "active users only" ON public.breaks AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.tasks;
CREATE POLICY "active users only" ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.work_locations;
CREATE POLICY "active users only" ON public.work_locations AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.user_locations;
CREATE POLICY "active users only" ON public.user_locations AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "active users only" ON public.location_events;
CREATE POLICY "active users only" ON public.location_events AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_active_user(auth.uid()))) WITH CHECK ((SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS "task files active users only" ON storage.objects;
CREATE POLICY "task files active users only" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'task-files' OR (SELECT public.is_active_user(auth.uid())))
  WITH CHECK (bucket_id <> 'task-files' OR (SELECT public.is_active_user(auth.uid())));

-- ========== 0006: attendance IP capture ==========
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS in_ip text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS out_ip text;
ALTER TABLE public.breaks ADD COLUMN IF NOT EXISTS start_ip text;
ALTER TABLE public.breaks ADD COLUMN IF NOT EXISTS end_ip text;
ALTER TABLE public.location_events ADD COLUMN IF NOT EXISTS ip text;

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
