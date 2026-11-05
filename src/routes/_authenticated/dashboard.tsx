import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { getFix } from "@/lib/geo";

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

  const day = useQuery({
    queryKey: ["myday", uid, date],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return { att: [], breaks: [], tasks: [] };
      const [att, brk, tasks] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", uid).eq("work_date", date).order("clock_in"),
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
                onClick={async () => { if (!uid) return; const f = await getFix(); act(() => supabase.from("attendance").insert({ user_id: uid, work_date: date, in_lat: f?.lat ?? null, in_lng: f?.lng ?? null, in_accuracy: f?.accuracy ?? null }), f ? "Clocked in" : "Clocked in (location unavailable)"); }}
              >
                <LogIn /> Clock in
              </Button>
            )}
            {state === "in" && (
              <>
                <Button
                  variant="secondary"
                  size="xl"
                  onClick={() => { if (uid && open) act(() => supabase.from("breaks").insert({ user_id: uid, attendance_id: open.id }), "Break started"); }}
                >
                  <Coffee /> Start break
                </Button>
                <Button
                  variant="brand"
                  size="xl"
                  onClick={async () => {
                    if (!open) return;
                    const f = await getFix();
                    act(() => supabase.from("attendance").update({ clock_out: new Date().toISOString(), out_lat: f?.lat ?? null, out_lng: f?.lng ?? null, out_accuracy: f?.accuracy ?? null }).eq("id", open.id), "Clocked out — see you tomorrow!");
                  }}
                >
                  <LogOut /> Clock out
                </Button>
              </>
            )}
            {state === "break" && (
              <Button
                variant="brand"
                size="xl"
                onClick={() => { if (openBreak) act(() => supabase.from("breaks").update({ end_at: new Date().toISOString() }).eq("id", openBreak.id), "Welcome back"); }}
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

        <TaskTimer uid={uid} date={date} onSaved={refresh} />
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

