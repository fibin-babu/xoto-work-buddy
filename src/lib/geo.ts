export type Fix = { lat: number; lng: number; accuracy: number } | null;

export type GetFixOptions = {
  /** Hard cap: give up after this long and return the best reading so far (ms). */
  timeoutMs?: number;
  /** Stop immediately once a reading is at least this accurate, in metres. */
  desiredAccuracyM?: number;
  /** After the first reading, wait at most this long for a better one before settling (ms). */
  settleMs?: number;
};

export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

/** Current geolocation permission, via the Permissions API. "unknown" when it isn't supported (e.g. older Safari). */
export async function geoPermission(): Promise<GeoPermission> {
  try {
    const perms = (navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<{ state: GeoPermission }> } }).permissions;
    if (perms?.query) {
      const res = await perms.query({ name: "geolocation" as PermissionName });
      return res.state;
    }
  } catch {
    /* fall through */
  }
  return "unknown";
}

/** Ask for location permission once, deliberately (from a user tap). Resolves to the resulting permission. */
export function requestGeoPermission(): Promise<GeoPermission> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) return resolve("unknown");
    geo.getCurrentPosition(
      () => resolve("granted"),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "prompt"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/**
 * Best-effort device location. Crucially, this NEVER triggers a permission popup on its own:
 * it reads a position only when permission is already granted (so clocking in/out never
 * interrupts the user with a prompt, and never collides with a screen overlay). Permission is
 * asked for once, deliberately, via requestGeoPermission(). Resolves null if not granted,
 * unsupported, or no reading arrives in time — clocking never blocks.
 *
 * It watches briefly and keeps the most accurate reading: stops at once on a good GPS fix,
 * a short moment after the first coarse reading otherwise, or at the hard cap.
 */
export async function getFix(options: GetFixOptions = {}): Promise<Fix> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const desiredAccuracyM = options.desiredAccuracyM ?? 30;
  const settleMs = options.settleMs ?? 2500;

  const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
  if (!geo) return null;

  // Only read a position when permission is already granted. "unknown" (no Permissions API,
  // e.g. iOS Safari) falls back to attempting a read, which the OS handles cleanly there.
  const permission = await geoPermission();
  if (permission === "denied" || permission === "prompt") return null;

  return new Promise((resolve) => {
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
        if (best.accuracy <= desiredAccuracyM) { finish(); return; }
        if (settleTimer === undefined) settleTimer = setTimeout(finish, settleMs);
      },
      () => { if (!best) finish(); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
