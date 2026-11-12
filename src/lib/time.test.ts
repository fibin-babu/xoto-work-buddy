import { describe, it, expect } from "vitest";
import { workedMinutes, breakMinutes, isCompanyEmail } from "./time";

describe("time rules", () => {
  it("breaks are not deducted from total worked time", () => {
    const sessions = [{ clock_in: "2026-10-08T05:00:00Z", clock_out: "2026-10-08T13:00:00Z" }];
    const breaks = [{ start_at: "2026-10-08T08:00:00Z", end_at: "2026-10-08T09:00:00Z" }];
    expect(workedMinutes(sessions)).toBe(480);
    expect(breakMinutes(breaks)).toBe(60);
  });
  it("merges overlapping sessions so a double clock-in isn't double-counted", () => {
    // Two sessions starting seconds apart over the same ~1h42m span → counted once, not summed.
    const now = new Date("2026-11-12T09:36:30Z");
    const sessions = [
      { clock_in: "2026-11-12T07:54:21Z", clock_out: "2026-11-12T09:36:23Z" },
      { clock_in: "2026-11-12T07:54:32Z", clock_out: null },
    ];
    expect(Math.round(workedMinutes(sessions, now))).toBe(102); // ~1h42m, not ~3h24m
  });
  it("sums separate non-overlapping sessions", () => {
    const sessions = [
      { clock_in: "2026-11-12T05:00:00Z", clock_out: "2026-11-12T07:00:00Z" },
      { clock_in: "2026-11-12T08:00:00Z", clock_out: "2026-11-12T09:00:00Z" },
    ];
    expect(workedMinutes(sessions)).toBe(180);
  });
  it("only @xoto.ae emails are company emails", () => {
    expect(isCompanyEmail("a@xoto.ae")).toBe(true);
    expect(isCompanyEmail("a@gmail.com")).toBe(false);
  });
});
