import { describe, expect, it } from "vitest";
import { reviewFlags, usualIp } from "./location-review";

describe("usualIp", () => {
  it("picks the most frequent network and ignores blanks", () => {
    const events = [{ ip: "1.1.1.1" }, { ip: "1.1.1.1" }, { ip: "2.2.2.2" }, { ip: null }];
    expect(usualIp(events)).toBe("1.1.1.1");
  });
  it("returns null when no network is recorded", () => {
    expect(usualIp([{ ip: null }, {}])).toBeNull();
  });
});

describe("reviewFlags", () => {
  it("flags an off-site mismatch", () => {
    expect(reviewFlags({ review_status: "mismatch", accuracy: 20, ip: "1.1.1.1" }, "1.1.1.1")).toEqual(["off_site"]);
  });
  it("flags a weak GPS fix", () => {
    expect(reviewFlags({ review_status: "match", accuracy: 400, ip: "1.1.1.1" }, "1.1.1.1")).toEqual(["weak_gps"]);
  });
  it("flags a different network", () => {
    expect(reviewFlags({ review_status: "match", accuracy: 15, ip: "9.9.9.9" }, "1.1.1.1")).toEqual(["different_network"]);
  });
  it("can raise several reasons at once", () => {
    expect(reviewFlags({ review_status: "mismatch", accuracy: 500, ip: "9.9.9.9" }, "1.1.1.1")).toEqual(["off_site", "weak_gps", "different_network"]);
  });
  it("stays quiet when everything agrees", () => {
    expect(reviewFlags({ review_status: "match", accuracy: 12, ip: "1.1.1.1" }, "1.1.1.1")).toEqual([]);
    // No baseline network yet → don't flag the first reading as unusual.
    expect(reviewFlags({ review_status: "match", accuracy: 12, ip: "1.1.1.1" }, null)).toEqual([]);
  });
});
