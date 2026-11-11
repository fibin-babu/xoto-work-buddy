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
    if (!key || !auth) throw new Error("Google Maps is not connected");
    const response = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key, "Content-Type": "application/json", "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" },
      body: JSON.stringify({ textQuery: data.query, pageSize: 5 }),
    });
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