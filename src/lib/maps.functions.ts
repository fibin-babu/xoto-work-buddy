import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchWorkPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(3).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Only organization admins can configure locations");
    const key = process.env["GOOGLE_MAPS_API_KEY"];
    const auth = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Google Maps is not connected: set GOOGLE_MAPS_API_KEY");
    const fieldMask = "places.id,places.displayName,places.formattedAddress,places.location";
    // On Lovable, go through its connector gateway; elsewhere call Google directly with our own key.
    const response = await fetch(
      auth ? "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText" : "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: auth
          ? { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key, "Content-Type": "application/json", "X-Goog-FieldMask": fieldMask }
          : { "X-Goog-Api-Key": key, "Content-Type": "application/json", "X-Goog-FieldMask": fieldMask },
        body: JSON.stringify({ textQuery: data.query, pageSize: 5 }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Maps [${response.status}]: ${body}`);
      if (response.status === 403) {
        if (body.includes("API_KEY_HTTP_REFERRER_BLOCKED")) throw new Error('Google Maps server key is referrer-restricted. Set its application restrictions to "None" or "IP addresses" in Google Cloud Console.');
        if (body.includes("API_KEY_SERVICE_BLOCKED")) throw new Error("Enable Places API (New) in the server key's allowed APIs in Google Cloud Console.");
      }
      throw new Error(`Google Maps request failed [${response.status}]: ${body}`);
    }
    const result = await response.json() as { places?: Array<{ id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }> };
    return (result.places ?? []).flatMap((p) => p.location ? [{ id: p.id, name: p.displayName?.text ?? p.formattedAddress ?? "Location", address: p.formattedAddress ?? "", lat: p.location.latitude, lng: p.location.longitude }] : []);
  });

/** Whether place search can run (it needs our own or Lovable's Google key). Exposes only a boolean. */
export const mapsSearchAvailable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ available: Boolean(process.env["GOOGLE_MAPS_API_KEY"]) }));

/** Reads coordinates from a pasted Google Maps link. Free: no API key, short links are expanded by following redirects. */
export const resolveMapsLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link: z.string().trim().min(3).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Only organization admins can configure locations");
    const { parseMapsLink, isGoogleMapsHost, isShortMapsLink } = await import("@/lib/maps-link");

    const direct = parseMapsLink(data.link);
    if (direct) return direct;

    let url: URL;
    try { url = new URL(data.link); } catch { throw new Error("Paste a Google Maps link or coordinates like 25.2048, 55.2708"); }
    if (!isGoogleMapsHost(url.hostname)) throw new Error("That isn't a Google Maps link");
    if (!isShortMapsLink(url)) throw new Error("Couldn't find coordinates in that link. In Google Maps, drop a pin on the spot and copy the link again.");

    // Follow redirects ourselves so we never leave Google's hosts.
    let body = "";
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" } });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = new URL(next, url);
        if (!isGoogleMapsHost(url.hostname)) throw new Error("That link doesn't lead to Google Maps");
        const parsed = parseMapsLink(url.href);
        if (parsed) return parsed;
        continue;
      }
      if (res.ok) body = (await res.text()).slice(0, 2_000_000);
      break;
    }
    // Some links land on a page whose URL has no coordinates; the page itself usually embeds them.
    const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(body) ?? /center=(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/.exec(body);
    if (pin) {
      const hit = parseMapsLink(`${pin[1]},${pin[2]}`);
      if (hit) return hit;
    }
    throw new Error("Couldn't find coordinates in that link. In Google Maps, drop a pin on the spot and copy the link again.");
  });
