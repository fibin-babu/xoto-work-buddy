export type Fix = { lat: number; lng: number; accuracy: number } | null;

export type GetFixOptions = {
  /** Give up after this long and return the best reading so far (ms). */
  timeoutMs?: number;
  /** Stop early once a reading is at least this accurate, in metres. */
  desiredAccuracyM?: number;
};

/**
 * Best-effort device location. The first reading a device returns is usually a
 * coarse Wi-Fi/cell estimate; GPS sharpens over the next few seconds. So we watch
 * for a short while and keep the most accurate reading, finishing early once it's
 * good enough. Resolves null if denied, unsupported, or no reading arrives in time —
 * clocking never blocks.
 */
export function getFix(options: GetFixOptions = {}): Promise<Fix> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const desiredAccuracyM = options.desiredAccuracyM ?? 30;
  return new Promise((resolve) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) return resolve(null);

    let best: Fix = null;
    let settled = false;
    let watchId: number | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watchId !== undefined) {
        try { geo.clearWatch(watchId); } catch { /* ignore */ }
      }
      resolve(best);
    };

    const timer = setTimeout(finish, timeoutMs);

    watchId = geo.watchPosition(
      (p) => {
        const c = p.coords;
        if (typeof c.latitude !== "number" || typeof c.longitude !== "number") return;
        const accuracy = typeof c.accuracy === "number" ? c.accuracy : Number.POSITIVE_INFINITY;
        if (!best || accuracy < best.accuracy) best = { lat: c.latitude, lng: c.longitude, accuracy };
        if (best.accuracy <= desiredAccuracyM) finish(); // accurate enough — stop early
      },
      () => {
        // Permission denied or position unavailable. Keep any reading we already have;
        // otherwise give up so the action isn't blocked.
        if (!best) finish();
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
