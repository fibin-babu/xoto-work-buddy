import { afterEach, describe, expect, it, vi } from "vitest";
import { getFix } from "./geo";

type Success = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Failure = (e: { code: number; message: string }) => void;

function mockGeolocation(script: (success: Success, failure: Failure) => void) {
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: Success, failure: Failure) => {
    script(success, failure);
    return 1;
  });
  // @ts-expect-error minimal geolocation stub for tests
  globalThis.navigator = { geolocation: { watchPosition, clearWatch, getCurrentPosition: vi.fn() } };
  return { clearWatch, watchPosition };
}

afterEach(() => {
  // @ts-expect-error reset stub
  delete globalThis.navigator;
  vi.useRealTimers();
});

const coord = (latitude: number, longitude: number, accuracy: number) => ({ coords: { latitude, longitude, accuracy } });

describe("getFix", () => {
  it("keeps the most accurate of several readings", async () => {
    mockGeolocation((success) => {
      success(coord(25.1, 55.2, 120)); // coarse first
      success(coord(25.2, 55.3, 15)); // sharper second → good enough, stops early
    });
    expect(await getFix()).toEqual({ lat: 25.2, lng: 55.3, accuracy: 15 });
  });

  it("does not replace a good reading with a worse one", async () => {
    mockGeolocation((success) => {
      success(coord(25.2, 55.3, 18));
      success(coord(25.9, 55.9, 90));
    });
    expect(await getFix()).toEqual({ lat: 25.2, lng: 55.3, accuracy: 18 });
  });

  it("returns the best coarse reading when nothing meets the target before timeout", async () => {
    vi.useFakeTimers();
    mockGeolocation((success) => {
      success(coord(25.1, 55.2, 200));
      success(coord(25.15, 55.25, 80));
    });
    const p = getFix({ timeoutMs: 5000, desiredAccuracyM: 30 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toEqual({ lat: 25.15, lng: 55.25, accuracy: 80 });
  });

  it("resolves null when permission is denied before any reading", async () => {
    mockGeolocation((_success, failure) => failure({ code: 1, message: "denied" }));
    expect(await getFix()).toBeNull();
  });

  it("resolves null when geolocation is unavailable", async () => {
    // @ts-expect-error no navigator
    delete globalThis.navigator;
    expect(await getFix()).toBeNull();
  });
});
