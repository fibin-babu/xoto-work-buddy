-- Daily task report email to the CEO.
-- A scheduled database job emails the day's completed tasks (grouped by team, then member) to a
-- configurable recipient at a configurable time, Monday–Saturday only (Sunday is a holiday). Email
-- is sent through the Resend HTTP API (pg_net); the API key and sender address live in Supabase Vault
-- so they are never stored in the app or in git.
--
-- After applying this, add two Vault secrets (Dashboard → Project Settings → Vault):
--   resend_api_key     = your Resend API key  (re_...)
--   daily_report_from  = "Xoto Workday <reports@xoto.ae>"  (a verified Resend sender)
-- Until resend_api_key exists the job does nothing. The recipient, time and on/off are set in-app.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Escapes text so task titles / names can't break the email HTML.
create or replace function public.html_escape(_t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(_t,''), '&','&amp;'), '<','&lt;'), '>','&gt;'), '"','&quot;')
$$;

-- Singleton settings row (id is always true, so there is only ever one row).
create table if not exists public.daily_report_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  recipient_email text not null default '',       -- one address, or several comma-separated
  send_hour smallint not null default 21 check (send_hour between 0 and 23),   -- GST
  send_minute smallint not null default 0 check (send_minute between 0 and 59),
  last_sent_on date,                               -- GST date of the last send (prevents duplicates)
  updated_at timestamptz not null default now()
);
insert into public.daily_report_settings (id) values (true) on conflict (id) do nothing;

-- Only the service role touches this table; the app reads/writes it through admin-only server functions.
alter table public.daily_report_settings enable row level security;
revoke all on public.daily_report_settings from anon, authenticated;
grant all on public.daily_report_settings to service_role;

-- Builds the report HTML for a given GST date: teams → members → their completed tasks.
create or replace function public.daily_report_html(_report_date date)
returns text language plpgsql security definer set search_path = public as $$
declare _body text;
begin
  with task_rows as (
    select p.team_id, p.id as user_id, p.full_name, tk.title, tk.hours
    from public.tasks tk
    join public.profiles p on p.id = tk.user_id
    where tk.work_date = _report_date and tk.status = 'done'
  ),
  member_blocks as (
    select team_id, full_name,
      '<p style="margin:12px 0 2px;font-weight:600;color:#111;">' || public.html_escape(full_name) || '</p>'
      || '<ul style="margin:0 0 10px;padding-left:20px;color:#333;line-height:1.5;">'
      || string_agg(
           '<li>' || public.html_escape(title)
           || case when hours > 0 then ' <span style="color:#999;">(' || trim(to_char(hours, 'FM990.##')) || 'h)</span>' else '' end
           || '</li>', '' order by title)
      || '</ul>' as block
    from task_rows
    group by team_id, full_name
  ),
  team_blocks as (
    select coalesce(t.name, 'No team') as team_name,
      string_agg(mb.block, '' order by mb.full_name) as blocks
    from member_blocks mb
    left join public.teams t on t.id = mb.team_id
    group by coalesce(t.name, 'No team')
  )
  select string_agg(
    '<h2 style="font-size:15px;margin:22px 0 4px;color:#0a8f5b;border-bottom:1px solid #eee;padding-bottom:4px;">'
    || public.html_escape(team_name) || '</h2>' || blocks,
    '' order by team_name)
  into _body
  from team_blocks;

  if _body is null then
    _body := '<p style="padding:14px 0;color:#888;">No tasks were logged on this day.</p>';
  end if;

  return
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111;">'
    || '<p style="font-size:20px;font-weight:700;margin:0 0 2px;"><span style="color:#0a8f5b;">Xoto</span> Workday</p>'
    || '<p style="margin:0 0 8px;color:#666;font-size:13px;">Completed tasks — ' || to_char(_report_date, 'FMDay, DD FMMonth YYYY') || '</p>'
    || _body
    || '<p style="margin:24px 0 0;color:#aaa;font-size:11px;">Sent automatically by Xoto Workday.</p>'
    || '</div>';
end;
$$;

-- The scheduled sender. Self-gates on the on/off switch, the configured GST time, the weekday
-- (skips Sunday), and whether it already sent today — so it is safe to run frequently.
create or replace function public.send_daily_task_report()
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.daily_report_settings%rowtype;
  _now_gst timestamp;
  _gst_date date;
  _api_key text;
  _from text;
  _to jsonb;
begin
  select * into s from public.daily_report_settings where id;
  if not found or not s.enabled or coalesce(s.recipient_email, '') = '' then return; end if;

  _now_gst := (now() at time zone 'Asia/Dubai');
  _gst_date := _now_gst::date;

  if extract(dow from _now_gst) = 0 then return; end if;                       -- Sunday holiday
  if s.last_sent_on is not null and s.last_sent_on >= _gst_date then return; end if;  -- already sent today
  if (extract(hour from _now_gst) * 60 + extract(minute from _now_gst))
       < (s.send_hour * 60 + s.send_minute) then return; end if;               -- not time yet

  select decrypted_secret into _api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if _api_key is null then return; end if;                                     -- not configured yet
  select decrypted_secret into _from from vault.decrypted_secrets where name = 'daily_report_from';
  _from := coalesce(_from, 'Xoto Workday <onboarding@resend.dev>');

  -- Support one address or several, comma-separated.
  select jsonb_agg(trim(x)) into _to
  from unnest(string_to_array(s.recipient_email, ',')) x
  where trim(x) <> '';
  if _to is null then return; end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || _api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', _from,
      'to', _to,
      'subject', 'Xoto — Completed tasks ' || to_char(_gst_date, 'Dy, DD Mon YYYY'),
      'html', public.daily_report_html(_gst_date)
    )
  );

  update public.daily_report_settings set last_sent_on = _gst_date where id;
end;
$$;

-- Run every 10 minutes; the function itself decides when to actually send.
do $$ begin
  perform cron.unschedule('daily-task-report');
exception when others then null; end $$;
select cron.schedule('daily-task-report', '*/10 * * * *', $$ select public.send_daily_task_report(); $$);
