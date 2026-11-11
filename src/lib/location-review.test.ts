import { describe, it, expect } from "vitest";
import { canReviewLocation } from "./location-review";

describe("private location review", () => {
  it("does not disclose flags to an employee", () => expect(canReviewLocation(false, false, true)).toBe(false));
  it("allows a person's team lead", () => expect(canReviewLocation(false, true, false)).toBe(true));
  it("allows organization admins", () => expect(canReviewLocation(true, false, false)).toBe(true));
  it("does not reveal a lead's own flags without admin access", () => expect(canReviewLocation(false, true, true)).toBe(false));
});