export type Fix = { lat: number; lng: number; accuracy: number } | null;

export type GetFixOptions = {
  /** Hard cap: give up after this long and return the best reading so far (ms). */
  timeoutMs?: number;
  /** Stop immediately once a reading is at least this accurate, in metres. */
  desiredAccuracyM?: number;
  /** After the first reading, wait at most this long for a better one before settling (ms). */
  settleMs?: number;
};

/**
 * Best-effort device location. The first reading a device returns is usually a
 * coarse Wi-Fi/cell estimate; GPS sharpens over the next few seconds. So we watch
 * briefly and keep the most accurate reading:
 *   - stop at once if a reading is accurate enough (good GPS), else
 *   - stop a short moment after the first reading (so a laptop with no GPS, which
 *     only ever gives one coarse reading, doesn't keep the UI waiting), and
 *   - give up at the hard cap if nothing arrives.
 * Resolves null if denied, unsupported, or no reading arrives — clocking never blocks.
 */
export function getFix(options: GetFixOptions = {}): Promise<Fix> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const desiredAccuracyM = options.desiredAccuracyM ?? 30;
  const settleMs = options.settleMs ?? 2500;
  return new Promise((resolve) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) return resolve(null);

    let best: Fix = null;
    let settled = false;
    let watchId: number | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (watchId !== undefined) {
        try { geo.clearWatch(watchId); } catch { /* ignore */ }
      }
      resolve(best);
    };

    const hardTimer = setTimeout(finish, timeoutMs);

    watchId = geo.watchPosition(
      (p) => {
        const c = p.coords;
        if (typeof c.latitude !== "number" || typeof c.longitude !== "number") return;
        const accuracy = typeof c.accuracy === "number" ? c.accuracy : Number.POSITIVE_INFINITY;
        if (!best || accuracy < best.accuracy) best = { lat: c.latitude, lng: c.longitude, accuracy };
        if (best.accuracy <= desiredAccuracyM) { finish(); return; } // accurate enough — stop now
        // Got a coarse reading: wait only a short moment for it to sharpen, then settle.
        if (settleTimer === undefined) settleTimer = setTimeout(finish, settleMs);
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
