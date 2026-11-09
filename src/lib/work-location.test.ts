import { describe, expect, it } from "vitest";
import { personLocationIds } from "./work-location";

describe("one work location per person", () => {
  it("accepts one location and rejects two", () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    expect(personLocationIds.parse([first])).toEqual([first]);
    expect(personLocationIds.safeParse([first, second]).success).toBe(false);
  });
});