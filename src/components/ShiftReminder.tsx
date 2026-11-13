import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { dueClockInReminder, dueReminder } from "@/lib/shift";
import { todayStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Kind = "in" | "end" | "late";
const SLIDE_MS = 450;

function messageFor(kind: Kind, shiftStart: string | null, shiftEnd: string | null): string {
  if (kind === "in") return `Your shift started at ${shiftStart?.slice(0, 5)} — remember to clock in.`;
  if (kind === "end") return `Your shift ended at ${shiftEnd?.slice(0, 5)} — remember to clock out.`;
  return "You're still clocked in, 30 minutes past your shift. Clock out?";
}

/**
 * Clock-in / clock-out reminder that slides in from the side and stays until it's dismissed
 * (or until the reason goes away, e.g. the person clocks in). Dismissing hides it for the rest
 * of the day for that specific reminder; a different reminder later the same day can still appear.
 * Also raises a native notification once per reminder when permission is granted.
 */
export function ShiftReminder() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const uid = me?.id;
  const shiftEnd = me?.profile?.shift_end ?? null;
  const shiftStart = me?.profile?.shift_start ?? null;
  const date = todayStr();

  const [kind, setKind] = useState<Kind | null>(null);
  const [entered, setEntered] = useState(false); // drives the slide-in / slide-out from the side
  const notified = useRef<string | null>(null);

  const open = useQuery({
    queryKey: ["myday-open", uid, date],
    enabled: !!uid && (!!shiftEnd || !!shiftStart),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("id, clock_out").eq("user_id", uid!).eq("work_date", date);
      return { open: (data ?? []).some((a) => !a.clock_out), any: (data?.length ?? 0) > 0 };
    },
  });

  useEffect(() => {
    if (!uid || !open.data) return;
    const dayKey = (k: Kind) => `xoto-shift-reminder:${uid}:${todayStr()}:${k}`;
    const check = () => {
      const now = new Date();
      const k: Kind | null = dueReminder(shiftEnd, now, open.data!.open) ?? (dueClockInReminder(shiftStart, now, open.data!.any) ? "in" : null);
      if (!k) { setKind(null); return; } // nothing due (or they clocked in) → hide
      if (localStorage.getItem(dayKey(k))) { setKind((cur) => (cur === k ? null : cur)); return; } // dismissed today
      if (notified.current !== dayKey(k)) {
        notified.current = dayKey(k);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Xoto Workday", { body: messageFor(k, shiftStart, shiftEnd), icon: "/icon-192.png" });
        }
      }
      setKind(k);
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [uid, shiftEnd, shiftStart, open.data]);

  // Slide in once a reminder is showing.
  useEffect(() => {
    if (!kind) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [kind]);

  if (!kind) return null;

  const dismiss = () => {
    try { localStorage.setItem(`xoto-shift-reminder:${uid}:${todayStr()}:${kind}`, "1"); } catch { /* ignore */ }
    setEntered(false);
    setTimeout(() => setKind(null), SLIDE_MS); // let it slide out before unmounting
  };

  const isIn = kind === "in";
  const msg = messageFor(kind, shiftStart, shiftEnd);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        role="alert"
        className={cn(
          "pointer-events-auto w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl border border-border/60 bg-card p-4 shadow-2xl transition-all ease-out",
          entered ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0",
        )}
        style={{ transitionDuration: `${SLIDE_MS}ms` }}
      >
        <div className="flex items-start gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", isIn ? "bg-brand-green/15 text-brand-green" : "bg-warning/15 text-warning")}>
            {isIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{isIn ? "Time to clock in" : "Clock-out reminder"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{msg}</p>
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant="brand"
          className="mt-3 w-full"
          onClick={() => { dismiss(); navigate({ to: "/dashboard" }); }}
        >
          {isIn ? "Go clock in" : "Go clock out"}
        </Button>
      </div>
    </div>
  );
}
