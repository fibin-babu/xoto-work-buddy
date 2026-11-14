import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only settings for the scheduled daily task-report email. The settings table is locked to the
// service role, so reads/writes go through these server functions after an admin check.

const oneEmail = z.string().trim().toLowerCase().email().max(255);
// One address, or several comma-separated.
const recipients = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.split(",").every((e) => oneEmail.safeParse(e.trim()).success), "Enter valid email address(es), comma-separated");

async function assertAdmin(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!admin) throw new Error("Only admins can do this");
}

// True when the daily-report migration (0008) hasn't been applied yet.
function notSetUp(error: { message?: string; code?: string; details?: string } | null): boolean {
  const m = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.details ?? ""}`;
  return /daily_report_settings|does not exist|schema cache|42P01|PGRST205|PGRST204/i.test(m);
}
const SETUP_MSG = "The daily report needs the latest database update applied first.";

export const getDailyReportSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("daily_report_settings")
      .select("enabled, recipient_email, send_hour, send_minute, last_sent_on")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      if (notSetUp(error)) return { enabled: false, recipient_email: "", send_hour: 21, send_minute: 0, last_sent_on: null, ready: false };
      throw new Error(error.message);
    }
    return {
      enabled: data?.enabled ?? false,
      recipient_email: data?.recipient_email ?? "",
      send_hour: data?.send_hour ?? 21,
      send_minute: data?.send_minute ?? 0,
      last_sent_on: data?.last_sent_on ?? null,
      ready: true,
    };
  });

export const updateDailyReportSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        recipient_email: recipients,
        send_hour: z.number().int().min(0).max(23),
        send_minute: z.number().int().min(0).max(59),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.enabled && data.recipient_email.trim() === "") throw new Error("Add a recipient email before turning the report on.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("daily_report_settings")
      .upsert(
        { id: true, enabled: data.enabled, recipient_email: data.recipient_email.trim(), send_hour: data.send_hour, send_minute: data.send_minute, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) {
      if (notSetUp(error)) throw new Error(SETUP_MSG);
      throw new Error(error.message);
    }
    return { ok: true };
  });
