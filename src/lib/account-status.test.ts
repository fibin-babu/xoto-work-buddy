import { describe, expect, it } from "vitest";
import { friendlySignInError, suspendedMessage } from "./account-status";

describe("sign-in errors", () => {
  it("explains suspended accounts", () => {
    expect(friendlySignInError("User is banned")).toBe(suspendedMessage);
  });
  it("passes other errors through", () => {
    expect(friendlySignInError("Invalid login credentials")).toBe("Invalid login credentials");
    expect(friendlySignInError(undefined)).toBe("Sign in failed");
  });
});
