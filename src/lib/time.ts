export type Session = { clock_in: string; clock_out: string | null };
export type Brk = { start_at: string; end_at: string | null };

const mins = (a: string, b: string | null, now: Date) =>
  Math.max(0, ((b ? new Date(b) : now).getTime() - new Date(a).getTime()) / 60000);

/** Total worked minutes = clock-in to clock-out. Breaks are NOT deducted (audit only). */
export function workedMinutes(sessions: Session[], now = new Date()) {
  return sessions.reduce((s, x) => s + mins(x.clock_in, x.clock_out, now), 0);
}

export function breakMinutes(breaks: Brk[], now = new Date()) {
  return breaks.reduce((s, b) => s + mins(b.start_at, b.end_at, now), 0);
}

export function fmtDuration(m: number) {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return `${h}h ${String(r).padStart(2, "0")}m`;
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const COMPANY_DOMAIN = "xoto.ae";
export const isCompanyEmail = (e: string) => e.trim().toLowerCase().endsWith("@" + COMPANY_DOMAIN);
