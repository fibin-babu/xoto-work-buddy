/** Minutes after shift end when the second ("still clocked in") reminder fires. */
export const LATE_REMINDER_MIN = 30;

export type ReminderKind = "end" | "late";

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Which clock-out reminder is due right now (local time), or null. */
export function dueReminder(shiftEnd: string | null | undefined, now: Date, clockedIn: boolean): ReminderKind | null {
  if (!shiftEnd || !clockedIn) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  const end = parseTime(shiftEnd);
  if (cur >= end + LATE_REMINDER_MIN) return "late";
  if (cur >= end) return "end";
  return null;
}

export function fmtShift(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "No shift";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}
