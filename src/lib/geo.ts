export type Fix = { lat: number; lng: number; accuracy: number } | null;

/** Best-effort device location. Resolves null if denied, unsupported or slow — clocking never blocks. */
export function getFix(timeoutMs = 8000): Promise<Fix> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
