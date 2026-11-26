import { describe, expect, it } from "vitest";
import { fmtReportDate, groupByDay, presetRange } from "./my-report";

describe("presetRange", () => {
  const now = new Date(2026, 10, 26, 15, 0); // 26 Nov 2026, local time

  it("covers yesterday only", () => {
    expect(presetRange("yesterday", now)).toEqual({ from: "2026-11-25", to: "2026-11-25" });
  });

  it("covers the last 7 and 30 days including today", () => {
    expect(presetRange("last7", now)).toEqual({ from: "2026-11-20", to: "2026-11-26" });
    expect(presetRange("last30", now)).toEqual({ from: "2026-10-28", to: "2026-11-26" });
  });

  it("starts this month on the 1st", () => {
    expect(presetRange("thisMonth", now)).toEqual({ from: "2026-11-01", to: "2026-11-26" });
  });

  it("crosses month and year boundaries", () => {
    expect(presetRange("yesterday", new Date(2027, 0, 1, 9))).toEqual({
      from: "2026-12-31",
      to: "2026-12-31",
    });
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const tasks = [
    { id: "b", work_date: "2026-11-24", created_at: "2026-11-24T10:00:00Z", hours: "1.5" },
    { id: "a", work_date: "2026-11-24", created_at: "2026-11-24T08:00:00Z", hours: 2 },
    { id: "c", work_date: "2026-11-25", created_at: "2026-11-25T09:00:00Z", hours: "0.25" },
  ];
  const sessions = [
    {
      work_date: "2026-11-24",
      clock_in: "2026-11-24T05:00:00Z",
      clock_out: "2026-11-24T09:00:00Z",
    },
    {
      work_date: "2026-11-24",
      clock_in: "2026-11-24T10:00:00Z",
      clock_out: "2026-11-24T13:00:00Z",
    },
    {
      work_date: "2026-11-23",
      clock_in: "2026-11-23T05:00:00Z",
      clock_out: "2026-11-23T06:00:00Z",
    },
    { work_date: "2026-11-26", clock_in: "2026-11-26T05:00:00Z", clock_out: null },
  ];

  it("lists newest day first, including days with attendance but no tasks", () => {
    expect(groupByDay(tasks, sessions, now).map((d) => d.date)).toEqual([
      "2026-11-26",
      "2026-11-25",
      "2026-11-24",
      "2026-11-23",
    ]);
  });

  it("orders tasks as logged and totals their hours", () => {
    const day = groupByDay(tasks, sessions, now).find((d) => d.date === "2026-11-24")!;
    expect(day.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(day.hours).toBe(3.5);
  });

  it("reports first in, last out and worked time across sessions", () => {
    const day = groupByDay(tasks, sessions, now).find((d) => d.date === "2026-11-24")!;
    expect(day.firstIn).toBe("2026-11-24T05:00:00Z");
    expect(day.lastOut).toBe("2026-11-24T13:00:00Z");
    expect(day.worked).toBe(7 * 60);
  });

  it("shows no clock-out while still clocked in", () => {
    const day = groupByDay(tasks, sessions, now).find((d) => d.date === "2026-11-26")!;
    expect(day.stillClockedIn).toBe(true);
    expect(day.lastOut).toBeNull();
  });

  it("handles a day with tasks but no attendance", () => {
    const day = groupByDay(tasks, sessions, now).find((d) => d.date === "2026-11-25")!;
    expect(day.firstIn).toBeNull();
    expect(day.worked).toBe(0);
  });
});

describe("fmtReportDate", () => {
  it("formats without shifting the day", () => {
    expect(fmtReportDate("2026-11-25")).toBe("Wed, 25 Nov 2026");
  });
});
