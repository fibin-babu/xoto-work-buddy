import { useEffect, useState } from "react";

/**
 * Turns coordinates into a short English place name using OpenStreetMap's free
 * Nominatim service. Results are cached per rounded coordinate and requests are
 * run one at a time, ~1.1s apart, to stay within Nominatim's usage policy.
 */

const cache = new Map<string, string | null>();
const waiters = new Map<string, Array<(name: string | null) => void>>();
const queue: string[] = [];
let running = false;

function keyOf(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Keep the two or three most specific parts, e.g. "Damac Maison Prive, Business Bay, Dubai". */
function shorten(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(", ");
  return [parts[0], parts[1], parts[parts.length - 3]].filter(Boolean).join(", ");
}

async function runQueue() {
  if (running) return;
  running = true;
  while (queue.length) {
    const key = queue.shift()!;
    const [lat, lng] = key.split(",");
    let name: string | null = null;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en&zoom=18`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        name = data.display_name ? shorten(data.display_name) : null;
      }
    } catch {
      name = null;
    }
    cache.set(key, name);
    (waiters.get(key) ?? []).forEach((fn) => fn(name));
    waiters.delete(key);
    if (queue.length) await new Promise((r) => setTimeout(r, 1100));
  }
  running = false;
}

function resolvePlaceName(lat: number, lng: number): Promise<string | null> {
  const key = keyOf(lat, lng);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  return new Promise((resolve) => {
    const list = waiters.get(key);
    if (list) {
      list.push(resolve);
      return;
    }
    waiters.set(key, [resolve]);
    queue.push(key);
    void runQueue();
  });
}

export type PlaceNameState = { status: "loading" | "done"; name: string | null };

export function usePlaceName(lat: number | null, lng: number | null): PlaceNameState {
  const key = lat !== null && lng !== null ? keyOf(lat, lng) : null;
  const [state, setState] = useState<PlaceNameState>(() =>
    key && cache.has(key) ? { status: "done", name: cache.get(key) ?? null } : { status: "loading", name: null },
  );
  useEffect(() => {
    if (lat === null || lng === null) {
      setState({ status: "done", name: null });
      return;
    }
    let active = true;
    if (cache.has(keyOf(lat, lng))) {
      setState({ status: "done", name: cache.get(keyOf(lat, lng)) ?? null });
      return;
    }
    setState({ status: "loading", name: null });
    resolvePlaceName(lat, lng).then((name) => { if (active) setState({ status: "done", name }); });
    return () => { active = false; };
  }, [lat, lng]);
  return state;
}
