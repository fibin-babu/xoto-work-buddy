import { orgMinutesOfDay } from "@/lib/org-time";

/** Minutes after shift end when the second ("still clocked in") reminder fires. */
export const LATE_REMINDER_MIN = 30;

export type ReminderKind = "end" | "late";

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Which clock-out reminder is due right now (local time), or null. */
export function dueReminder(shiftEnd: string | null | undefined, now: Date, clockedIn: boolean): ReminderKind | null {
  if (!shiftEnd || !clockedIn) return null;
  const cur = orgMinutesOfDay(now);
  const end = parseTime(shiftEnd);
  if (cur >= end + LATE_REMINDER_MIN) return "late";
  if (cur >= end) return "end";
  return null;
}

export function fmtShift(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "No shift";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/** Minutes after shift start before a clock-in counts as late. */
export const LATE_GRACE_MIN = 15;

/** True when a clock-in (local time) is more than the grace period after shift start. */
export function isLateClockIn(shiftStart: string | null | undefined, clockIn: Date | string | null | undefined): boolean {
  if (!shiftStart || !clockIn) return false;
  const d = typeof clockIn === "string" ? new Date(clockIn) : clockIn;
  return orgMinutesOfDay(d) > parseTime(shiftStart) + LATE_GRACE_MIN;
}

/** Clock-in reminder is due once shift start has passed and the person hasn't clocked in today. */
export function dueClockInReminder(shiftStart: string | null | undefined, now: Date, clockedInToday: boolean): boolean {
  if (!shiftStart || clockedInToday) return false;
  return orgMinutesOfDay(now) >= parseTime(shiftStart);
}
