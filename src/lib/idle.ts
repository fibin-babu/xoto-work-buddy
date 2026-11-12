// Shared timing for the "idle after shift" flow. The master timer (attendance) and the
// task timers both stop when someone goes idle past their shift; a reminder comes first,
// then an automatic clock-out. The database runs the reliable auto clock-out (see the
// auto_clock_out_idle job); these helpers drive the in-app reminder and timer pausing.

import { orgTimeMoment } from "@/lib/org-time";

/** Minutes of inactivity past shift end before the clock-out reminder shows and task timers pause. */
export const IDLE_REMINDER_MIN = 60;
/** Minutes of inactivity past shift end before the automatic clock-out (reminder + 30 min grace). */
export const IDLE_AUTO_OUT_MIN = IDLE_REMINDER_MIN + 30;

/** Today's shift-end moment, in company time (GST) — not the viewer's device timezone. */
export function shiftEndToday(shiftEnd: string, now: Date): Date {
  return orgTimeMoment(shiftEnd, now);
}

export type IdleState = { idleMin: number; dueReminder: boolean; dueAutoOut: boolean };

/**
 * Idle time is measured from the later of shift-end and the last activity, so the clock
 * only starts once work hours are over. Returns how idle they are and which stage is due.
 */
export function idleState(shiftEnd: string | null | undefined, lastActivity: Date, now: Date): IdleState {
  if (!shiftEnd) return { idleMin: 0, dueReminder: false, dueAutoOut: false };
  const base = Math.max(shiftEndToday(shiftEnd, now).getTime(), lastActivity.getTime());
  const idleMin = Math.max(0, (now.getTime() - base) / 60000);
  return {
    idleMin,
    dueReminder: idleMin >= IDLE_REMINDER_MIN,
    dueAutoOut: idleMin >= IDLE_AUTO_OUT_MIN,
  };
}
