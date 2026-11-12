import { describe, expect, it } from "vitest";
import { dueReminder } from "./shift";

// h:m in GST (UTC+4), built from UTC so the tests don't depend on the machine's timezone.
const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 4, h - 4, m));

describe("clock-out reminders for a 9–6 shift", () => {
  it("nothing before 6:00", () => expect(dueReminder("18:00:00", at(17, 59), true)).toBeNull());
  it("first reminder at 6:00", () => expect(dueReminder("18:00:00", at(18, 0), true)).toBe("end"));
  it("second reminder at 6:30", () => expect(dueReminder("18:00:00", at(18, 30), true)).toBe("late"));
  it("no reminder once clocked out", () => expect(dueReminder("18:00:00", at(18, 30), false)).toBeNull());
});

import { dueClockInReminder, isLateClockIn } from "./shift";
describe("clock-in for a 9:00 shift", () => {
  it("9:15 is not late", () => expect(isLateClockIn("09:00:00", at(9, 15))).toBe(false));
  it("9:16 is late", () => expect(isLateClockIn("09:00:00", at(9, 16))).toBe(true));
  it("no reminder before 9:00", () => expect(dueClockInReminder("09:00:00", at(8, 59), false)).toBe(false));
  it("reminder at 9:00 if not clocked in", () => expect(dueClockInReminder("09:00:00", at(9, 0), false)).toBe(true));
  it("no reminder once clocked in", () => expect(dueClockInReminder("09:00:00", at(9, 30), true)).toBe(false));
});
