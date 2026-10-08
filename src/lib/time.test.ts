import { describe, it, expect } from "vitest";
import { workedMinutes, breakMinutes, isCompanyEmail } from "./time";

describe("time rules", () => {
  it("breaks are not deducted from total worked time", () => {
    const sessions = [{ clock_in: "2026-10-08T05:00:00Z", clock_out: "2026-10-08T13:00:00Z" }];
    const breaks = [{ start_at: "2026-10-08T08:00:00Z", end_at: "2026-10-08T09:00:00Z" }];
    expect(workedMinutes(sessions)).toBe(480);
    expect(breakMinutes(breaks)).toBe(60);
  });
  it("only @xoto.ae emails are company emails", () => {
    expect(isCompanyEmail("a@xoto.ae")).toBe(true);
    expect(isCompanyEmail("a@gmail.com")).toBe(false);
  });
});
