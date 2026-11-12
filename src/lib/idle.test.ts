import { describe, expect, it } from "vitest";
import { idleState, shiftEndToday, IDLE_REMINDER_MIN, IDLE_AUTO_OUT_MIN } from "./idle";

// h:m in GST (UTC+4), built from UTC so the tests don't depend on the machine's timezone.
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 12, h - 4, m));

describe("idleState", () => {
  it("is quiet before shift end", () => {
    const s = idleState("18:00", at(17, 0), at(17, 30));
    expect(s.dueReminder).toBe(false);
    expect(s.dueAutoOut).toBe(false);
  });

  it("measures idle from shift end when activity stopped earlier", () => {
    // Last active at 16:00, shift ends 18:00, now 19:05 → idle counts from 18:00 = 65 min.
    const s = idleState("18:00", at(16, 0), at(19, 5));
    expect(Math.round(s.idleMin)).toBe(65);
    expect(s.dueReminder).toBe(true);
    expect(s.dueAutoOut).toBe(false);
  });

  it("measures idle from last activity when it is after shift end", () => {
    // Worked late to 18:40, now 19:45 → idle 65 min from 18:40.
    const s = idleState("18:00", at(18, 40), at(19, 45));
    expect(Math.round(s.idleMin)).toBe(65);
    expect(s.dueReminder).toBe(true);
  });

  it("flags auto clock-out once reminder + grace has passed", () => {
    const s = idleState("18:00", at(17, 0), at(19, 31)); // 91 min past shift end
    expect(s.dueReminder).toBe(true);
    expect(s.dueAutoOut).toBe(true);
  });

  it("does nothing without a shift end", () => {
    expect(idleState(null, at(10), at(23)).dueAutoOut).toBe(false);
  });

  it("uses the reminder and grace thresholds", () => {
    expect(IDLE_AUTO_OUT_MIN).toBe(IDLE_REMINDER_MIN + 30);
  });
});

describe("shiftEndToday", () => {
  it("builds today's shift-end moment in GST (18:00 GST = 14:00 UTC)", () => {
    const end = shiftEndToday("18:00", at(14, 30));
    expect(end.getTime()).toBe(Date.UTC(2026, 10, 12, 14, 0));
  });
});
