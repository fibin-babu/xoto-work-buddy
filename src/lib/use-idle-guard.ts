import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { idleState } from "@/lib/idle";
import { todayStr } from "@/lib/time";

type Params = {
  uid: string | undefined;
  /** Open attendance id, or undefined when clocked out. */
  openId: string | undefined;
  shiftEnd: string | null | undefined;
  /** Clock-out time of the day's attendance, used to cap task timers when a clock-out happens. */
  clockOutAt: string | null | undefined;
};

const HEARTBEAT_MS = 3 * 60_000;
const ACTIVE_WINDOW_MS = 5 * 60_000;

/**
 * Keeps the master and task timers honest around shift end:
 *  - sends a heartbeat while the person is actively using the app, so the database's
 *    auto clock-out job never closes someone who is genuinely still working;
 *  - once they've been idle past their shift, shows a clock-out reminder and pauses task timers;
 *  - when a clock-out happens (manual or the automatic one), stops the task timers, capping
 *    their time at the clock-out moment.
 * Returns a signal for the task timer: bump `stopSignal` means "pause running timers (at `capAtMs`)".
 */
export function useIdleGuard({ uid, openId, shiftEnd, clockOutAt }: Params): { stopSignal: number; capAtMs: number | null } {
  const [stop, setStop] = useState<{ n: number; capAtMs: number | null }>({ n: 0, capAtMs: null });
  const lastActivity = useRef(Date.now());
  const remindedRef = useRef<string | null>(null);
  const reminderToast = useRef<string | number | null>(null);
  const prevOpen = useRef<string | undefined>(openId);

  // Track genuine interaction.
  useEffect(() => {
    const mark = () => { lastActivity.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "visibilitychange"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // Heartbeat while clocked in and recently active.
  useEffect(() => {
    if (!uid || !openId) return;
    const ping = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (Date.now() - lastActivity.current > ACTIVE_WINDOW_MS) return;
      void supabase.from("attendance").update({ last_seen_at: new Date().toISOString() }).eq("id", openId).then(
        () => {},
        () => {}, // column may not exist until migration 0007 is applied — ignore
      );
    };
    ping();
    const t = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [uid, openId]);

  // Idle-past-shift reminder + pause task timers (once per day).
  useEffect(() => {
    if (!uid || !openId || !shiftEnd) return;
    const dayKey = `xoto-idle-reminded:${uid}:${todayStr()}`;
    const check = () => {
      const s = idleState(shiftEnd, new Date(lastActivity.current), new Date());
      if (!s.dueReminder) return;
      if (remindedRef.current === dayKey || localStorage.getItem(dayKey)) { remindedRef.current = dayKey; return; }
      remindedRef.current = dayKey;
      try { localStorage.setItem(dayKey, "1"); } catch { /* ignore */ }
      reminderToast.current = toast.warning("No activity since your shift ended — your timers are paused. Clock out?", { duration: 30_000 });
      setStop((prev) => ({ n: prev.n + 1, capAtMs: null })); // pause running timers now
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [uid, openId, shiftEnd]);

  // Clock-out (manual or automatic): stop task timers, capping at the clock-out moment.
  useEffect(() => {
    if (prevOpen.current && !openId) {
      setStop((prev) => ({ n: prev.n + 1, capAtMs: clockOutAt ? new Date(clockOutAt).getTime() : Date.now() }));
      // Clear any lingering clock-out reminder — they've clocked out, so stop nagging.
      if (reminderToast.current !== null) { toast.dismiss(reminderToast.current); reminderToast.current = null; }
    }
    prevOpen.current = openId;
  }, [openId, clockOutAt]);

  return { stopSignal: stop.n, capAtMs: stop.capAtMs };
}
