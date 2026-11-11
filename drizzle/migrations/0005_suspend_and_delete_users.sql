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
