// The company runs on one timezone: Gulf Standard Time (Asia/Dubai, UTC+4, no daylight saving).
// Shift times like "09:00"–"18:00" are always GST for every employee, including remote staff,
// so all shift comparisons use GST rather than the viewer's device clock.
export const ORG_TZ = "Asia/Dubai";
export const ORG_TZ_OFFSET_MIN = 240; // UTC+4, fixed (no DST)

/** A Date whose UTC fields read as the GST wall-clock time of `instant`. */
function orgWall(instant: Date): Date {
  return new Date(instant.getTime() + ORG_TZ_OFFSET_MIN * 60_000);
}

/** Minutes past midnight, in GST, for the given instant (0–1439). */
export function orgMinutesOfDay(instant: Date): number {
  const w = orgWall(instant);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

/** The instant of a given "HH:MM" GST time on the same GST calendar day as `instant`. */
export function orgTimeMoment(hhmm: string, instant: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const w = orgWall(instant);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), h || 0, m || 0) - ORG_TZ_OFFSET_MIN * 60_000);
}
