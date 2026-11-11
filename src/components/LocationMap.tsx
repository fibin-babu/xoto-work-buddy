import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePlaceName } from "@/lib/place-name";

// Esri World Street Map: free, no API key, and labelled in English worldwide.
const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "Tiles &copy; Esri";

export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const place = usePlaceName(lat, lng);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { center: [lat, lng], zoom: 16, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 20 }).addTo(map);
    L.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
      .addTo(map)
      .bindPopup(title);
    // The container starts at zero size inside a just-opened dialog; recalc once laid out.
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => { clearTimeout(t); map.remove(); };
  }, [lat, lng, title]);

  return (
    <div className="space-y-1">
      <div ref={ref} className="h-56 w-full overflow-hidden rounded-lg border" role="img" aria-label={`Map of ${place.name ?? title}`} />
      <p className="text-xs text-muted-foreground">
        {place.status === "loading" ? "Finding place name…" : place.name ?? "Unknown place"}
      </p>
    </div>
  );
}
