/** Reads coordinates out of Google Maps links (no API key needed). */

export type LinkedPlace = { lat: number; lng: number; name: string | null };

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";
const PAIR = new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`);

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function pair(text: string | null | undefined) {
  const m = text ? PAIR.exec(text) : null;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return valid(lat, lng) ? { lat, lng } : null;
}

/** Hosts we accept links from and will follow redirects to. */
export function isGoogleMapsHost(hostname: string) {
  const h = hostname.toLowerCase();
  return h === "maps.app.goo.gl" || h === "goo.gl" || /^(www\.|maps\.)?google\.[a-z.]{2,6}$/.test(h);
}

/** True for short share links that must be expanded before they can be read. */
export function isShortMapsLink(url: URL) {
  const h = url.hostname.toLowerCase();
  return h === "maps.app.goo.gl" || (h === "goo.gl" && url.pathname.startsWith("/maps"));
}

/**
 * Accepts a full Google Maps URL or a plain "lat, lng" pair.
 * Prefers the exact pin (!3d…!4d…) over query params, and those over the camera position (@lat,lng).
 */
export function parseMapsLink(input: string): LinkedPlace | null {
  const direct = pair(input);
  if (direct) return { ...direct, name: null };

  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (!isGoogleMapsHost(url.hostname)) return null;

  const path = decodeURIComponent(url.pathname);
  // Google wraps some names (e.g. Arabic) in invisible direction marks; strip them.
  const placeName = /\/place\/([^/]+)/.exec(path)?.[1]?.replace(/\+/g, " ").replace(/[‎‏‪-‮⁦-⁩]/g, "").trim() || null;
  const name = placeName && !pair(placeName) ? placeName : null;
  const full = decodeURIComponent(url.href);

  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(full);
  if (pin && valid(Number(pin[1]), Number(pin[2]))) return { lat: Number(pin[1]), lng: Number(pin[2]), name };

  for (const key of ["q", "query", "ll", "destination", "center"]) {
    const hit = pair(url.searchParams.get(key));
    if (hit) return { ...hit, name };
  }
  if (placeName) {
    const hit = pair(placeName);
    if (hit) return { ...hit, name: null };
  }

  const camera = new RegExp(`@${NUM},${NUM}`).exec(path);
  if (camera && valid(Number(camera[1]), Number(camera[2]))) return { lat: Number(camera[1]), lng: Number(camera[2]), name };

  return null;
}
