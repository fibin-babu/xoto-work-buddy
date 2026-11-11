import { useEffect, useState } from "react";

export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setAuthorized((host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) && !host.includes("-devserver-"));
  }, []);
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  if (!authorized || !key) return <div className="flex h-56 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">Map available on the published site</div>;
  return <iframe title={title} className="h-56 w-full rounded-lg border" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={`https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=16&language=en&region=AE&solution_id=gmp_lovable_agentskills_v1`} />;
}