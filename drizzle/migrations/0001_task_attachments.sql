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