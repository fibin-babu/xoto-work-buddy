import { supabase } from "@/integrations/supabase/client";
import { getFix, geoPermission, requestGeoPermission } from "@/lib/geo";
import type { LocationAction } from "@/lib/location-review";

/**
 * Captures the device location AFTER an attendance action has already been recorded, and attaches
 * it to the row — quietly, in the background. Clock-in/out and breaks never wait on GPS this way,
 * so the buttons stay instant; the IP is already recorded server-side, and the coordinates are a
 * best-effort enrichment. Does nothing if location permission isn't granted or no reading arrives.
 * Returns true when a location was attached (so the caller can refresh the view).
 *
 * When `requestPermission` is set (we do this on clock-in), the native location prompt is shown
 * once if permission hasn't been decided yet — so the ask happens naturally the first time someone
 * clocks in, rather than as a standing banner. If they've already allowed or blocked it, nothing
 * pops up. A block just means no coordinates are saved; attendance still records fine.
 */
export async function captureLocation(action: LocationAction, uid: string, date: string, opts: { requestPermission?: boolean } = {}): Promise<boolean> {
  if (opts.requestPermission) {
    try { if ((await geoPermission()) === "prompt") await requestGeoPermission(); } catch { /* ignore */ }
  }
  let fix: Awaited<ReturnType<typeof getFix>> = null;
  try { fix = await getFix(); } catch { return false; }
  if (!fix) return false;
  const { lat, lng, accuracy } = fix;
  try {
    if (action === "clock_in") {
      const { data } = await supabase.from("attendance").select("id").eq("user_id", uid).eq("work_date", date).is("clock_out", null).order("clock_in", { ascending: false }).limit(1);
      const id = data?.[0]?.id; if (!id) return false;
      await supabase.from("attendance").update({ in_lat: lat, in_lng: lng, in_accuracy: accuracy }).eq("id", id);
    } else if (action === "clock_out") {
      const { data } = await supabase.from("attendance").select("id").eq("user_id", uid).eq("work_date", date).not("clock_out", "is", null).order("clock_out", { ascending: false }).limit(1);
      const id = data?.[0]?.id; if (!id) return false;
      await supabase.from("attendance").update({ out_lat: lat, out_lng: lng, out_accuracy: accuracy }).eq("id", id);
    } else if (action === "break_start") {
      const { data } = await supabase.from("breaks").select("id, attendance!inner(work_date)").eq("user_id", uid).eq("attendance.work_date", date).is("end_at", null).order("start_at", { ascending: false }).limit(1);
      const id = data?.[0]?.id; if (!id) return false;
      await supabase.from("breaks").update({ start_lat: lat, start_lng: lng, start_accuracy: accuracy }).eq("id", id);
    } else if (action === "break_end") {
      const { data } = await supabase.from("breaks").select("id, attendance!inner(work_date)").eq("user_id", uid).eq("attendance.work_date", date).not("end_at", "is", null).order("start_at", { ascending: false }).limit(1);
      const id = data?.[0]?.id; if (!id) return false;
      await supabase.from("breaks").update({ end_lat: lat, end_lng: lng, end_accuracy: accuracy }).eq("id", id);
    }
    return true;
  } catch {
    return false; // best effort — never let location capture break attendance
  }
}
