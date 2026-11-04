import { describe, expect, it } from "vitest";
import { dueReminder } from "./shift";

const at = (h: number, m: number) => new Date(2026, 10, 4, h, m);

describe("clock-out reminders for a 9–6 shift", () => {
  it("nothing before 6:00", () => expect(dueReminder("18:00:00", at(17, 59), true)).toBeNull());
  it("first reminder at 6:00", () => expect(dueReminder("18:00:00", at(18, 0), true)).toBe("end"));
  it("second reminder at 6:30", () => expect(dueReminder("18:00:00", at(18, 30), true)).toBe("late"));
  it("no reminder once clocked out", () => expect(dueReminder("18:00:00", at(18, 30), false)).toBeNull());
});
