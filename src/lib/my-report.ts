import { todayStr, workedMinutes, type Session } from "@/lib/time";

export type ReportPreset = "yesterday" | "last7" | "last30" | "thisMonth";

export const reportPresets: { id: ReportPreset; label: string }[] = [
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
];

/** Inclusive YYYY-MM-DD range for a quick-filter button, counted in the viewer's local calendar. */
export function presetRange(preset: ReportPreset, now = new Date()): { from: string; to: string } {
  const day = (offset: number) =>
    todayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  switch (preset) {
    case "yesterday":
      return { from: day(-1), to: day(-1) };
    case "last7":
      return { from: day(-6), to: day(0) };
    case "last30":
      return { from: day(-29), to: day(0) };
    case "thisMonth":
      return { from: todayStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(0) };
  }
}

export type ReportTask = {
  id: string;
  work_date: string;
  created_at: string;
  hours: number | string;
};
export type ReportSession = Session & { work_date: string };

export type ReportDay<T extends ReportTask> = {
  date: string;
  tasks: T[];
  hours: number;
  firstIn: string | null;
  lastOut: string | null;
  stillClockedIn: boolean;
  worked: number;
};

/**
 * One entry per date that has tasks or attendance, newest date first.
 * Tasks keep the order they were logged in that day.
 */
export function groupByDay<T extends ReportTask>(
  tasks: T[],
  sessions: ReportSession[],
  now = new Date(),
): ReportDay<T>[] {
  const dates = new Set([...tasks.map((t) => t.work_date), ...sessions.map((s) => s.work_date)]);
  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const dayTasks = tasks
        .filter((t) => t.work_date === date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const daySessions = sessions
        .filter((s) => s.work_date === date)
        .sort((a, b) => a.clock_in.localeCompare(b.clock_in));
      const stillClockedIn = daySessions.some((s) => !s.clock_out);
      const outs = daySessions
        .map((s) => s.clock_out)
        .filter((x): x is string => !!x)
        .sort();
      return {
        date,
        tasks: dayTasks,
        hours: dayTasks.reduce((sum, t) => sum + Number(t.hours), 0),
        firstIn: daySessions[0]?.clock_in ?? null,
        lastOut: stillClockedIn ? null : (outs.at(-1) ?? null),
        stillClockedIn,
        worked: workedMinutes(daySessions, now),
      };
    });
}

/** "Wed, 25 Nov 2026" for a YYYY-MM-DD date, without timezone drift. */
export function fmtReportDate(date: string): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
