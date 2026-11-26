import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { fmtDuration, fmtTime } from "@/lib/time";
import {
  fmtReportDate,
  groupByDay,
  presetRange,
  reportPresets,
  type ReportPreset,
} from "@/lib/my-report";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttachmentLink } from "@/components/AttachmentLink";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Xoto Workday" },
      {
        name: "description",
        content: "Look back at the tasks you logged and your hours on previous days.",
      },
      { property: "og:title", content: "Reports — Xoto Workday" },
      {
        property: "og:description",
        content: "Look back at the tasks you logged and your hours on previous days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: me } = useMe();
  const initial = presetRange("last7");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<ReportPreset | null>("last7");
  const uid = me?.id;

  const q = useQuery({
    queryKey: ["my-report", uid, from, to],
    enabled: !!uid && !!from && !!to && from <= to,
    queryFn: async () => {
      // Always scoped to the signed-in person: managers and admins can read others' rows, but this page is "my" history.
      const [t, a] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", uid!)
          .gte("work_date", from)
          .lte("work_date", to)
          .order("created_at"),
        supabase
          .from("attendance")
          .select("work_date, clock_in, clock_out")
          .eq("user_id", uid!)
          .gte("work_date", from)
          .lte("work_date", to),
      ]);
      if (t.error) throw t.error;
      if (a.error) throw a.error;
      return { tasks: t.data ?? [], sessions: a.data ?? [] };
    },
  });

  const days = useMemo(() => (q.data ? groupByDay(q.data.tasks, q.data.sessions) : []), [q.data]);
  const totals = {
    days: days.filter((d) => d.firstIn).length,
    tasks: days.reduce((s, d) => s + d.tasks.length, 0),
    hours: days.reduce((s, d) => s + d.hours, 0),
    worked: days.reduce((s, d) => s + d.worked, 0),
  };

  function choose(p: ReportPreset) {
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
    setPreset(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">The tasks you logged on previous days.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset(null);
              }}
              className="mt-1 w-40"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset(null);
              }}
              className="mt-1 w-40"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date ranges">
        {reportPresets.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            aria-pressed={preset === p.id}
            onClick={() => choose(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Days worked" value={String(totals.days)} />
        <Metric label="Tasks logged" value={String(totals.tasks)} />
        <Metric label="Task hours" value={`${+totals.hours.toFixed(2)}h`} />
        <Metric label="Time clocked" value={fmtDuration(totals.worked)} />
      </div>

      {from > to && (
        <p role="alert" className="text-sm text-destructive">
          The "From" date must be on or before the "To" date.
        </p>
      )}
      {q.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't load your report. Please try again.
        </p>
      )}
      {q.isLoading && <p className="py-8 text-center text-muted-foreground">Loading…</p>}

      {q.data && days.length === 0 && (
        <div className="rounded-3xl border bg-card p-10 text-center shadow-card">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing logged in these dates</p>
          <p className="text-sm text-muted-foreground">Try a wider date range.</p>
        </div>
      )}

      <div className="space-y-4">
        {days.map((d) => (
          <section
            key={d.date}
            className="rounded-3xl border bg-card shadow-card"
            aria-label={fmtReportDate(d.date)}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
              <h2 className="font-semibold">{fmtReportDate(d.date)}</h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {d.firstIn ? (
                  <>
                    In {fmtTime(d.firstIn)} · Out{" "}
                    {d.stillClockedIn ? (
                      <span className="font-medium text-foreground">still working</span>
                    ) : (
                      fmtTime(d.lastOut)
                    )}{" "}
                    · <span className="font-semibold text-foreground">{fmtDuration(d.worked)}</span>
                  </>
                ) : (
                  "No clock-in"
                )}
              </p>
            </header>
            {d.tasks.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No tasks logged this day.</p>
            ) : (
              <ul className="divide-y">
                {d.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{t.title}</p>
                      {t.description && (
                        <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <AttachmentLink path={t.attachment_path} name={t.attachment_name} />
                    <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                      {Number(t.hours)}h
                    </span>
                  </li>
                ))}
                <li className="flex justify-end gap-3 bg-muted/40 px-5 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {d.tasks.length} {d.tasks.length === 1 ? "task" : "tasks"}
                  </span>
                  <span className="w-14 text-right font-semibold tabular-nums">
                    {+d.hours.toFixed(2)}h
                  </span>
                </li>
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
