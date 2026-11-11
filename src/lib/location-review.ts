export const attendanceColumns = "id,user_id,work_date,clock_in,clock_out,created_at,in_lat,in_lng,in_accuracy,out_lat,out_lng,out_accuracy" as const;
export type LocationAction = "clock_in" | "break_start" | "break_end" | "clock_out";
export const locationActionLabel: Record<LocationAction, string> = {
  clock_in: "Clock in", break_start: "Start break", break_end: "End break", clock_out: "Clock out",
};
export function canReviewLocation(admin: boolean, leadsPerson: boolean, isSelf: boolean) {
  return admin || (leadsPerson && !isSelf);
}

// Combination check: flag an entry for review when its signals don't agree.
/** A fix this coarse almost certainly isn't real GPS (e.g. a laptop locating by Wi-Fi/IP). */
export const WEAK_ACCURACY_M = 120;

export type ReviewFlag = "off_site" | "weak_gps" | "different_network";
export const reviewFlagLabel: Record<ReviewFlag, string> = {
  off_site: "Off-site",
  weak_gps: "Weak GPS",
  different_network: "Different network",
};

type FlaggableEvent = { ip?: string | null; accuracy?: number | null; review_status?: string | null };

/** The network a person clocks in from most often, used as the baseline to spot unusual ones. */
export function usualIp(events: FlaggableEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const e of events) if (e.ip) counts.set(e.ip, (counts.get(e.ip) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [ip, n] of counts) if (n > bestN) { best = ip; bestN = n; }
  return best;
}

/** Reasons this single check looks off, given the person's usual network. Empty means nothing to review. */
export function reviewFlags(event: FlaggableEvent, personUsualIp: string | null): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  if (event.review_status === "mismatch") flags.push("off_site");
  if (event.accuracy != null && event.accuracy > WEAK_ACCURACY_M) flags.push("weak_gps");
  if (event.ip && personUsualIp && event.ip !== personUsualIp) flags.push("different_network");
  return flags;
}