-- Idle auto clock-out. A scheduled database job clocks out people who are still clocked in
-- but have been inactive for 90 minutes past their shift end (60-min reminder + 30-min grace),
-- recording their shift-end time as the clock-out. Works even if their app is closed.
ALTER TABLE public.attendance ADD COLUMN last_seen_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN auto_closed boolean NOT NULL DEFAULT false;

-- Let admins/managers see which clock-outs were automatic (last_seen_at stays private).
GRANT SELECT(auto_closed) ON public.attendance TO authenticated;

-- Org timezone for interpreting shift times. Change if your workforce is elsewhere.
CREATE OR REPLACE FUNCTION public.auto_clock_out_idle() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tz text := 'Asia/Dubai';
BEGIN
  UPDATE public.attendance a
  SET clock_out = s.shift_end_ts, auto_closed = true
  FROM (
    SELECT a2.id,
           ((a2.work_date::timestamp + p.shift_end) AT TIME ZONE tz) AS shift_end_ts,
           greatest(
             ((a2.work_date::timestamp + p.shift_end) AT TIME ZONE tz),
             greatest(a2.clock_in, coalesce(a2.last_seen_at, a2.clock_in))
           ) AS idle_base
    FROM public.attendance a2
    JOIN public.profiles p ON p.id = a2.user_id
    WHERE a2.clock_out IS NULL AND p.shift_end IS NOT NULL AND p.deleted_at IS NULL
  ) s
  WHERE a.id = s.id
    AND now() >= s.shift_end_ts
    AND s.shift_end_ts > a.clock_in
    AND now() - s.idle_base >= interval '90 minutes';
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_clock_out_idle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_clock_out_idle() TO service_role;

-- Run it every 10 minutes via pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('auto-clock-out-idle', '*/10 * * * *', $$ SELECT public.auto_clock_out_idle(); $$);
