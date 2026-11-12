import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coffee, LogIn, LogOut, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { breakMinutes, fmtDuration, fmtTime, todayStr, workedMinutes } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { AttachmentLink } from "@/components/AttachmentLink";
import { TaskTimer } from "@/components/TaskTimer";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { getFix } from "@/lib/geo";
import { attendanceColumns, type LocationAction } from "@/lib/location-review";
import { clockIn, clockOut, startBreak, endBreak } from "@/lib/attendance.functions";
import { useIdleGuard } from "@/lib/use-idle-guard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Day — Xoto Workday" }, { name: "description", content: "Track your workday, switch task timers, and review completed tasks at Xoto." }, { property: "og:title", content: "My Day — Xoto Workday" }, { property: "og:description", content: "Track your workday, switch task timers, and review completed tasks at Xoto." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MyDay,
});

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function MyDay() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const now = useNow();
  const date = todayStr();
  const uid = me?.id;
  const [locating, setLocating] = useState(false);
  const actionLock = useRef(false);
  const doClockIn = useServerFn(clockIn);
  const doClockOut = useServerFn(clockOut);
  const doStartBreak = useServerFn(startBreak);
  const doEndBreak = useServerFn(endBreak);

  const day = useQuery({
    queryKey: ["myday", uid, date],
    enabled: !!uid,
    refetchInterval: 60_000, // pick up an automatic clock-out even while this tab sits idle
    queryFn: async () => {
      if (!uid) return { att: [], breaks: [], tasks: [] };
      const [att, brk, tasks] = await Promise.all([
        supabase.from("attendance").select(attendanceColumns).eq("user_id", uid).eq("work_date", date).order("clock_in"),
        supabase.from("breaks").select("*, attendance!inner(work_date)").eq("user_id", uid).eq("attendance.work_date", date).order("start_at"),
        supabase.from("tasks").select("*").eq("user_id", uid).eq("work_date", date).order("created_at", { ascending: false }),
      ]);
      return { att: att.data ?? [], breaks: brk.data ?? [], tasks: tasks.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["myday"] });

  const att = day.data?.att ?? [];
  const breaks = day.data?.breaks ?? [];
  const tasks = day.data?.tasks ?? [];
  const open = att.find((a) => !a.clock_out);
  const openBreak = breaks.find((b) => !b.end_at);
  const lastClockOut = att.filter((a) => a.clock_out).map((a) => a.clock_out).sort().at(-1) ?? null;
  const idleGuard = useIdleGuard({ uid, openId: open?.id, shiftEnd: me?.profile?.shift_end, clockOutAt: lastClockOut });
  const worked = workedMinutes(att, now);
  const brkMins = breakMinutes(breaks, now);
  const loggedHours = tasks.reduce((s, t) => s + Number(t.hours), 0);

  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) {
    const { error } = await fn();
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    refresh();
  }

  const state = !open ? "out" : openBreak ? "break" : "in";

  async function captureAction(action: LocationAction) {
    if (!uid || actionLock.current) return;
    actionLock.current = true;
    setLocating(true);
    try {
      // Capture location quietly in the background; if it's denied or unavailable we save without it.
      const fix = await getFix();
      const lat = fix?.lat ?? null, lng = fix?.lng ?? null, accuracy = fix?.accuracy ?? null;
      // Writes go through server functions so the IP is captured server-side.
      if (action === "clock_in" && !open) await doClockIn({ data: { work_date: date, lat, lng, accuracy } });
      else if (action === "break_start" && open && !openBreak) await doStartBreak({ data: { attendance_id: open.id, lat, lng, accuracy } });
      else if (action === "break_end" && openBreak) await doEndBreak({ data: { break_id: openBreak.id, lat, lng, accuracy } });
      else if (action === "clock_out" && open && !openBreak) await doClockOut({ data: { attendance_id: open.id, lat, lng, accuracy } });
      else throw new Error("Your attendance changed. Please refresh and try again.");
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["myday-open"] }), qc.invalidateQueries({ queryKey: ["report"] })]);
      toast.success(action === "clock_in" ? "Clocked in" : action === "clock_out" ? "Clocked out — see you tomorrow!" : action === "break_start" ? "Break started" : "Welcome back");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't save attendance"); }
    finally { setLocating(false); actionLock.current = false; }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-3xl font-bold">Hi {me?.profile?.full_name?.split(" ")[0] || "there"} 👋</h1>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Clock card */}
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-ink-foreground shadow-card">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-gradient opacity-25 blur-3xl" />
          <div className="relative flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                state === "in" && "animate-pulse bg-brand-green",
                state === "break" && "bg-warning",
                state === "out" && "bg-muted-foreground",
              )}
            />
            {state === "in" ? "Clocked in" : state === "break" ? "On break" : att.length ? "Clocked out" : "Not clocked in yet"}
          </div>
          <p className="relative mt-4 font-display text-6xl font-bold tabular-nums">{fmtDuration(worked)}</p>
          <p className="relative mt-1 text-sm opacity-70">Total time today · breaks logged separately</p>

          <div className="relative mt-6 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Time in" value={fmtTime(att[0]?.clock_in)} />
            <Stat label="Time out" value={open ? "—" : fmtTime(att[att.length - 1]?.clock_out)} />
            <Stat label="Breaks" value={fmtDuration(brkMins)} />
          </div>

          <div className="relative mt-8 flex flex-wrap gap-3">
            {state === "out" && (
              <Button
                variant="brand"
                size="xl"
                disabled={day.isLoading || locating}
                onClick={() => captureAction("clock_in")}
              >
                <LogIn /> Clock in
              </Button>
            )}
            {state === "in" && (
              <>
                <Button
                  variant="secondary"
                  size="xl"
                  disabled={locating}
                  onClick={() => captureAction("break_start")}
                >
                  <Coffee /> Start break
                </Button>
                <Button
                  variant="brand"
                  size="xl"
                  disabled={locating}
                  onClick={() => captureAction("clock_out")}
                >
                  <LogOut /> Clock out
                </Button>
              </>
            )}
            {state === "break" && (
              <Button
                variant="brand"
                size="xl"
                disabled={locating}
                onClick={() => captureAction("break_end")}
              >
                <Play /> End break
              </Button>
            )}
          </div>
          {breaks.length > 0 && (
            <div className="relative mt-6 flex flex-wrap gap-2 text-xs opacity-80">
              {breaks.map((b) => (
                <span key={b.id} className="rounded-full border border-sidebar-border px-3 py-1">
                  ☕ {fmtTime(b.start_at)} – {b.end_at ? fmtTime(b.end_at) : "now"}
                </span>
              ))}
            </div>
          )}
        </div>

        {state === "out" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-card p-8 text-center shadow-card">
            <LogIn className="h-8 w-8 text-primary" />
            <h2 className="text-xl font-semibold">Clock in to add tasks</h2>
            <p className="max-w-xs text-sm text-muted-foreground">Start your day with the Clock in button, then time or log your tasks here.</p>
          </div>
        ) : (
          <TaskTimer uid={uid} date={date} onSaved={refresh} stopSignal={idleGuard.stopSignal} capAtMs={idleGuard.capAtMs} />
        )}
      </section>


      <section className="rounded-3xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Completed tasks</h2>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tasks · {loggedHours.toFixed(1)}h logged
          </p>
        </div>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No completed tasks yet.</p>
        ) : (
          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-4 py-3">
                <div className="flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                </div>
                <AttachmentLink path={t.attachment_path} name={t.attachment_name} />
                <span className="w-14 text-right font-semibold tabular-nums">{Number(t.hours)}h</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete task"
                  onClick={() => act(() => supabase.from("tasks").delete().eq("id", t.id), "Task removed")}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider opacity-60">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

