import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Attendance writes go through the server so the client's network address (IP) is recorded
// from the request itself — the browser can't be trusted to report its own IP.

/** Client's public IP, read from the proxy headers set by Cloudflare / the edge. Null when unknown (e.g. local dev). */
function clientIp(): string | null {
  const headers = getRequest()?.headers;
  if (!headers) return null;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    (forwarded ? forwarded.split(",")[0]?.trim() : null);
  return ip && ip.length <= 100 ? ip : null;
}

// The IP columns arrive with migration 0006; until it's applied, writing them fails.
function missingIpColumn(error: { message?: string; code?: string } | null): boolean {
  const m = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /_ip\b|does not exist|schema cache|42703|PGRST204/i.test(m);
}

const coord = z.object({
  lat: z.number().finite().nullable(),
  lng: z.number().finite().nullable(),
  accuracy: z.number().finite().min(0).nullable(),
});

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => coord.extend({ work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    // Idempotent: if already clocked in today, do nothing (prevents duplicate overlapping sessions).
    const { data: openRows } = await context.supabase.from("attendance").select("id").eq("user_id", context.userId).eq("work_date", data.work_date).is("clock_out", null).limit(1);
    if (openRows && openRows.length > 0) return { ok: true };
    const base = { user_id: context.userId, work_date: data.work_date, in_lat: data.lat, in_lng: data.lng, in_accuracy: data.accuracy };
    let { error } = await context.supabase.from("attendance").insert({ ...base, in_ip: clientIp() });
    if (error && missingIpColumn(error)) ({ error } = await context.supabase.from("attendance").insert(base));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clockOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => coord.extend({ attendance_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const base = { clock_out: new Date().toISOString(), out_lat: data.lat, out_lng: data.lng, out_accuracy: data.accuracy };
    const where = (q: ReturnType<typeof context.supabase.from>) => q.eq("id", data.attendance_id).eq("user_id", context.userId).is("clock_out", null);
    let { error } = await where(context.supabase.from("attendance").update({ ...base, out_ip: clientIp() }));
    if (error && missingIpColumn(error)) ({ error } = await where(context.supabase.from("attendance").update(base)));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => coord.extend({ attendance_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Idempotent: if a break is already open for this attendance, do nothing.
    const { data: openBreaks } = await context.supabase.from("breaks").select("id").eq("attendance_id", data.attendance_id).eq("user_id", context.userId).is("end_at", null).limit(1);
    if (openBreaks && openBreaks.length > 0) return { ok: true };
    const base = { user_id: context.userId, attendance_id: data.attendance_id, start_lat: data.lat, start_lng: data.lng, start_accuracy: data.accuracy };
    let { error } = await context.supabase.from("breaks").insert({ ...base, start_ip: clientIp() });
    if (error && missingIpColumn(error)) ({ error } = await context.supabase.from("breaks").insert(base));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const endBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => coord.extend({ break_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const base = { end_at: new Date().toISOString(), end_lat: data.lat, end_lng: data.lng, end_accuracy: data.accuracy };
    const where = (q: ReturnType<typeof context.supabase.from>) => q.eq("id", data.break_id).eq("user_id", context.userId).is("end_at", null);
    let { error } = await where(context.supabase.from("breaks").update({ ...base, end_ip: clientIp() }));
    if (error && missingIpColumn(error)) ({ error } = await where(context.supabase.from("breaks").update(base)));
    if (error) throw new Error(error.message);
    return { ok: true };
  });
