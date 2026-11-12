import { describe, expect, it } from "vitest";
import { orgMinutesOfDay, orgTimeMoment } from "./org-time";

describe("org time (GST, UTC+4)", () => {
  it("reads minutes-of-day in GST regardless of the Date's source", () => {
    // 14:00 UTC is 18:00 GST.
    expect(orgMinutesOfDay(new Date(Date.UTC(2026, 10, 12, 14, 0)))).toBe(18 * 60);
    // 04:30 UTC is 08:30 GST.
    expect(orgMinutesOfDay(new Date(Date.UTC(2026, 10, 12, 4, 30)))).toBe(8 * 60 + 30);
  });

  it("builds the GST moment for a shift time on the right GST day", () => {
    // Around 15:00 UTC (19:00 GST) on Nov 12 → 18:00 GST that day = 14:00 UTC.
    const m = orgTimeMoment("18:00", new Date(Date.UTC(2026, 10, 12, 15, 0)));
    expect(m.getTime()).toBe(Date.UTC(2026, 10, 12, 14, 0));
  });

  it("keeps the GST calendar day when UTC has already rolled over", () => {
    // 22:00 UTC Nov 12 is 02:00 GST Nov 13 → 09:00 GST that day = 05:00 UTC Nov 13.
    const m = orgTimeMoment("09:00", new Date(Date.UTC(2026, 10, 12, 22, 0)));
    expect(m.getTime()).toBe(Date.UTC(2026, 10, 13, 5, 0));
  });
});
