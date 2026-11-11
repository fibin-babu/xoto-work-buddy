import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { breakMinutes, fmtDuration, fmtTime, todayStr, workedMinutes } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttachmentLink } from "@/components/AttachmentLink";
import { isLateClockIn } from "@/lib/shift";
import { cn } from "@/lib/utils";
import { ReportCharts } from "@/components/ReportCharts";
import { attendanceColumns, locationActionLabel } from "@/lib/location-review";
import { LocationMap } from "@/components/LocationMap";

type Props = { title: string; subtitle?: string; teamFilter?: boolean; excludeUserId?: string; managerId?: string; charts?: boolean };

export function WorkReport({ title, subtitle, teamFilter, excludeUserId, managerId, charts }: Props) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [team, setTeam] = useState("all");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const [p, t, a, b, k, locations] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, team_id, shift_start").order("full_name"),
        supabase.from("teams").select("id, name, manager_id"),
        supabase.from("attendance").select(attendanceColumns).gte("work_date", from).lte("work_date", to),
        supabase.from("breaks").select("*, attendance!inner(work_date)").gte("attendance.work_date", from).lte("attendance.work_date", to),
        supabase.from("tasks").select("*").gte("work_date", from).lte("work_date", to).order("created_at"),
        supabase.from("location_events").select("*").gte("work_date", from).lte("work_date", to).order("captured_at"),
      ]);
      const failed = [p, t, a, b, k, locations].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return { profiles: p.data ?? [], teams: t.data ?? [], att: a.data ?? [], breaks: b.data ?? [], tasks: k.data ?? [], locations: locations.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const teamName = new Map(q.data.teams.map((t) => [t.id, t.name]));
    const mine = managerId ? new Set(q.data.teams.filter((t) => t.manager_id === managerId).map((t) => t.id)) : null;
    return q.data.profiles
      .filter((p) => !mine || (p.team_id != null && mine.has(p.team_id)))
      .filter((p) => p.id !== excludeUserId)
      .filter((p) => team === "all" || p.team_id === team)
      .map((p) => {
        const att = q.data.att.filter((x) => x.user_id === p.id).sort((x, y) => x.clock_in.localeCompare(y.clock_in));
        const brk = q.data.breaks.filter((x) => x.user_id === p.id);
        const tasks = q.data.tasks.filter((x) => x.user_id === p.id);
        const open = att.some((x) => !x.clock_out);
        const firstByDay = new Map<string, string>();
        att.forEach((x) => { if (!firstByDay.has(x.work_date)) firstByDay.set(x.work_date, x.clock_in); });
        const lateDays = [...firstByDay.values()].filter((ci) => isLateClockIn(p.shift_start, ci)).length;
        return {
          ...p,
          team: p.team_id ? teamName.get(p.team_id) ?? "—" : "—",
          firstIn: att[0]?.clock_in ?? null,
          locations: q.data.locations.filter((event) => event.user_id === p.id),
          lastOut: open ? null : att[att.length - 1]?.clock_out ?? null,
          status: !att.length ? "absent" : open ? "working" : "done",
          worked: workedMinutes(att),
          breaks: breakMinutes(brk),
          breakCount: brk.length,
          tasks,
          hours: tasks.reduce((s, x) => s + Number(x.hours), 0),
          days: new Set(att.map((x) => x.work_date)).size,
          lateDays,
        };
      });
  }, [q.data, team, excludeUserId, managerId]);

  const totals = {
    present: rows.filter((r) => r.status !== "absent").length,
    working: rows.filter((r) => r.status === "working").length,
    worked: rows.reduce((s, r) => s + r.worked, 0),
    tasks: rows.reduce((s, r) => s + r.tasks.length, 0),
    hours: rows.reduce((s, r) => s + r.hours, 0),
    late: rows.filter((r) => r.lateDays > 0).length,
  };

  function exportCsv() {
    const lines = [["Name", "Email", "Team", "Days", "First in", "Last out", "Worked (min)", "Break (min)", "Breaks", "Tasks", "Task hours", "Late days"]];
    rows.forEach((r) =>
      lines.push([r.full_name, r.email, r.team, String(r.days), r.firstIn ?? "", r.lastOut ?? "", String(Math.round(r.worked)), String(Math.round(r.breaks)), String(r.breakCount), String(r.tasks.length), r.hours.toFixed(2), String(r.lateDays)]),
    );
    lines.push([]);
    lines.push(["Task date", "Name", "Title", "Description", "Hours", "Attachment"]);
    rows.forEach((r) => r.tasks.forEach((t) => lines.push([t.work_date, r.full_name, t.title, t.description ?? "", String(t.hours), t.attachment_name ?? ""])));
    lines.push([], ["Location date", "Name", "Action", "Time", "Latitude", "Longitude", "Accuracy (m)", "Assigned location", "Distance (m)", "Review"]);
    rows.forEach((r) => r.locations.forEach((event) => lines.push([event.work_date, r.full_name, event.action, event.captured_at, String(event.lat ?? ""), String(event.lng ?? ""), String(event.accuracy ?? ""), event.expected_name ?? "", String(event.distance_m ?? ""), event.review_status])));
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `xoto-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            From
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
          </label>
          {teamFilter && (
            <label className="text-xs text-muted-foreground">
              Team
              <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 block h-9 rounded-md border bg-card px-3 text-sm text-foreground">
                <option value="all">All teams</option>
                {q.data?.teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Metric label="People" value={String(rows.length)} />
        <Metric label="Present" value={`${totals.present}`} hint={`${totals.working} working now`} />
        <Metric label="Total time" value={fmtDuration(totals.worked)} />
        <Metric label="Tasks logged" value={String(totals.tasks)} />
        <Metric label="Late clock-ins" value={String(totals.late)} hint="15+ min after shift start" />
        <Metric label="Task hours" value={`${totals.hours.toFixed(1)}h`} />
      </div>

      {charts && q.data && <ReportCharts rows={rows} att={q.data.att} tasks={q.data.tasks} from={from} to={to} />}
      {q.isError && <p role="alert" className="text-sm text-destructive">Couldn't load reports. Please try again.</p>}
      {q.data && <p className="text-sm text-muted-foreground"><span className="font-semibold text-destructive">{rows.reduce((sum, r) => sum + r.locations.filter((event) => event.review_status === "mismatch").length, 0)} location mismatches</span> · {rows.reduce((sum, r) => sum + r.locations.filter((event) => event.review_status === "unavailable").length, 0)} location unavailable</p>}

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time in</th>
              <th className="px-4 py-3">Time out</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Breaks</th>
              <th className="px-4 py-3">Tasks</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No people to show yet.</td></tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => setOpenRow(openRow === r.id ? null : r.id)}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.full_name || r.email}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">{r.team}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      r.status === "working" && "bg-accent text-accent-foreground",
                      r.status === "done" && "bg-secondary text-primary",
                      r.status === "absent" && "bg-muted text-muted-foreground")}>
                      {r.status === "working" ? "Working" : r.status === "done" ? "Clocked out" : "No record"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmtTime(r.firstIn)}<SiteMark v={r.locations.find((event) => event.action === "clock_in")?.review_status} />{r.lateDays > 0 && <span className="ml-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Late{r.days > 1 ? ` ×${r.lateDays}` : ""}</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtTime(r.lastOut)}<SiteMark v={r.locations.filter((event) => event.action === "clock_out").at(-1)?.review_status} /></td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{fmtDuration(r.worked)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtDuration(r.breaks)} <span className="text-muted-foreground">({r.breakCount})</span>{r.locations.some((event) => event.action.startsWith("break_") && event.review_status === "mismatch") && <SiteMark v="mismatch" />}</td>
                  <td className="px-4 py-3 tabular-nums">{r.tasks.length} · {r.hours.toFixed(1)}h</td>
                  <td className="px-4 py-3"><ChevronDown className={cn("h-4 w-4 transition-transform", openRow === r.id && "rotate-180")} /></td>
                </tr>
                {openRow === r.id && (
                  <tr className="border-b bg-muted/30">
                    <td colSpan={9} className="px-6 py-4">
                      <h3 className="mb-2 font-semibold">Location activity</h3>
                      {!r.locations.length && <p className="mb-4 text-sm text-muted-foreground">No location checks recorded in this period.</p>}
                      <ul className="mb-5 divide-y">{r.locations.map((event) => <li key={event.id} className="py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{locationActionLabel[event.action as keyof typeof locationActionLabel] ?? event.action}</span><span className="text-muted-foreground">{event.work_date} · {fmtTime(event.captured_at)}</span><SiteMark v={event.review_status} /></div>
                        <p className="mt-1 text-xs text-muted-foreground">Assigned: {event.expected_name ?? "No location"}{event.distance_m !== null ? ` · ${Math.round(event.distance_m)} m away · allowed ${event.radius_m} m` : ""}{event.accuracy !== null ? ` · GPS accuracy ±${Math.round(event.accuracy)} m` : ""}</p>
                        {event.lat !== null && event.lng !== null && <details className="mt-2"><summary className="cursor-pointer text-primary">{event.lat.toFixed(5)}, {event.lng.toFixed(5)} · View map</summary><div className="mt-2 max-w-lg"><LocationMap lat={event.lat} lng={event.lng} title={`${r.full_name} ${event.action}`} /></div></details>}
                      </li>)}</ul>
                      {r.tasks.length === 0 ? (
                        <p className="text-muted-foreground">No tasks logged in this period.</p>
                      ) : (
                        <ul className="space-y-2">
                          {r.tasks.map((t) => (
                            <li key={t.id} className="flex items-start gap-3">
                              <span className="w-24 text-xs text-muted-foreground">{t.work_date}</span>
                              <div className="flex-1">
                                <p className="font-medium">{t.title}</p>
                                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                              </div>
                              <AttachmentLink path={t.attachment_path} name={t.attachment_name} />
                              <span className="w-12 text-right font-semibold">{Number(t.hours)}h</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-bold tabular-nums", accent && "text-destructive")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SiteMark({ v }: { v?: string }) {
  if (!v) return null;
  return <span className={cn("ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", v === "mismatch" ? "bg-destructive/15 text-destructive" : v === "match" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{v === "match" ? "Match" : v === "mismatch" ? "Mismatch" : v === "unavailable" ? "Unavailable" : "Unassigned"}</span>;
}
