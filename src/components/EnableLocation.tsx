import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geoPermission, requestGeoPermission, type GeoPermission } from "@/lib/geo";

/**
 * Asks for location permission once, deliberately — instead of the app popping up a request
 * during every clock-in/break (which re-prompts each time and clashes with screen overlays).
 * Shows only until permission is decided; nothing once granted.
 */
export function EnableLocation() {
  const [state, setState] = useState<GeoPermission | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => geoPermission().then(setState).catch(() => setState("unknown"));

  useEffect(() => {
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function enable() {
    if (busy) return;
    setBusy(true);
    const result = await requestGeoPermission();
    setBusy(false);
    setState(result);
    void refresh();
  }

  if (state === null || state === "granted" || state === "unknown") return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><MapPin className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Turn on location</p>
          {state === "denied" ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Location is blocked for this app. To record your attendance location, allow it in your browser's
              site settings (tap the lock icon in the address bar → Permissions → Location → Allow), then reopen.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Allow location so your clock-ins and breaks are recorded for attendance. You'll only be asked once.
              </p>
              <Button variant="brand" size="sm" className="mt-3" disabled={busy} onClick={enable}>
                <MapPin /> {busy ? "Waiting…" : "Enable location"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
