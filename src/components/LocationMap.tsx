import { useEffect, useState } from "react";

// Our own browser key (e.g. for local dev or self-hosting) works on any host it is restricted to.
const ownKey = import.meta.env["VITE_GOOGLE_MAPS_BROWSER_KEY"];
// Lovable's connector key only works on Lovable-hosted domains.
const lovableKey = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];

export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const [onLovable, setOnLovable] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setOnLovable((host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) && !host.includes("-devserver-"));
  }, []);
  const key = ownKey || (onLovable ? lovableKey : undefined);
  if (!key) {
    // Free fallback with no API key: OpenStreetMap's embeddable map with a marker on the spot.
    const bbox = [lng - 0.006, lat - 0.004, lng + 0.006, lat + 0.004].map((n) => n.toFixed(6)).join(",");
    return <iframe title={title} className="h-56 w-full rounded-lg border" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`} />;
  }
  const solution = ownKey ? "" : "&solution_id=gmp_lovable_agentskills_v1";
  return <iframe title={title} className="h-56 w-full rounded-lg border" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={`https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=16&language=en&region=AE${solution}`} />;
}
