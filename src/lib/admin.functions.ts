import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { personLocationIds } from "@/lib/work-location";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(255)
  .refine((e) => e.endsWith("@xoto.ae"), "Must be an @xoto.ae email");
const role = z.enum(["admin", "manager", "employee"]);

// True when an error means the suspend/delete migration (0005) hasn't been applied to this database yet.
function needsMigration(error: any): boolean {
  const m = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.details ?? ""}`;
  return /suspended_at|deleted_at|is_active_user|my_account_status|does not exist|schema cache|42703|42883|PGRST202|PGRST204/i.test(m);
}
const MIGRATION_MSG = "Suspend and delete need the latest database update. Push your changes so Lovable can apply it, then try again.";

async function assertAdmin(supabase: any, userId: string) {
  const [{ data: admin }, active] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_active_user", { _user_id: userId }),
  ]);
  if (!admin) throw new Error("Only admins can do this");
  // Block a suspended admin's still-valid session — but only once the migration that adds this check is live.
  if (!active.error && active.data === false) throw new Error("Your access has been suspended.");
}

/** Public: tells the login page whether first-time setup is needed. Returns only a boolean. */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/** Public, but only works while no admin exists yet. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email, password: z.string().min(8).max(72), full_name: z.string().trim().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup already completed");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !u.user) throw new Error(error?.message ?? "Could not create user");
    await supabaseAdmin.from("profiles").insert({ id: u.user.id, email: data.email, full_name: data.full_name });
    await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "admin" });
    return { ok: true };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email,
        full_name: z.string().trim().min(1).max(100),
        role,
        team_id: z.string().uuid().nullable(),
        redirect_to: z.string().url().max(500),
        shift_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        shift_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        location_ids: personLocationIds.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Invite by email: the person gets a link to set their own password
    // before first sign-in — no temporary passwords.
    const { data: u, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirect_to,
    });
    if (error || !u.user) throw new Error(error?.message ?? "Could not invite user");
    const { error: pe } = await supabaseAdmin
      .from("profiles")
      .insert({ id: u.user.id, email: data.email, full_name: data.full_name, team_id: data.team_id, shift_start: data.shift_start ?? null, shift_end: data.shift_end ?? null });
    if (pe) throw new Error(pe.message);
    if (data.location_ids?.length) {
      const { error: le } = await supabaseAdmin.from("user_locations").insert(data.location_ids.map((location_id) => ({ user_id: u.user.id, location_id })));
      if (le) throw new Error(le.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: data.role });
    if (data.role === "manager" && data.team_id) {
      await supabaseAdmin.from("teams").update({ manager_id: u.user.id }).eq("id", data.team_id);
    }
    return { ok: true };
  });

export const updateAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), role, team_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role !== "admin")
      throw new Error("You can't remove your own admin access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await loadTarget(supabaseAdmin, data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    await supabaseAdmin.from("profiles").update({ team_id: data.team_id }).eq("id", data.user_id);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await loadTarget(supabaseAdmin, data.user_id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Effectively permanent: Supabase bans are durations, so ~100 years until an admin restores access.
const SUSPEND_BAN = "876000h";

async function loadTarget(supabaseAdmin: any, userId: string) {
  let { data, error } = await supabaseAdmin.from("profiles").select("id, email, suspended_at, deleted_at").eq("id", userId).maybeSingle();
  if (error && needsMigration(error)) {
    // Migration 0005 not applied yet: fall back so role/team edits and password resets still work.
    ({ data, error } = await supabaseAdmin.from("profiles").select("id, email").eq("id", userId).maybeSingle());
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Person not found");
    return { id: data.id, email: data.email, suspended_at: null, deleted_at: null };
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Person not found");
  if (data.deleted_at) throw new Error("This person has been deleted");
  return data as { id: string; email: string; suspended_at: string | null; deleted_at: string | null };
}

/** Suspend blocks sign-in and all data access; restore gives it back. History stays visible to admins and managers. */
export const setSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You can't suspend your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await loadTarget(supabaseAdmin, data.user_id);
    // Block sign-in and token refresh first, then flip the flag that the database's access rules check.
    const { error: be } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: data.suspended ? SUSPEND_BAN : "none" });
    if (be) throw new Error(be.message);
    const { error } = await supabaseAdmin.from("profiles").update({ suspended_at: data.suspended ? new Date().toISOString() : null }).eq("id", data.user_id);
    if (error) throw new Error(needsMigration(error) ? MIGRATION_MSG : error.message);
    return { ok: true };
  });

/** Permanently removes the login account. The profile stays, marked deleted, so attendance, breaks, tasks and location history keep their owner. */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), confirm_email: z.string().trim().toLowerCase() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You can't delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await loadTarget(supabaseAdmin, data.user_id);
    if (target.email.toLowerCase() !== data.confirm_email) throw new Error("The email you typed doesn't match this person");

    const deletedAt = new Date().toISOString();
    const { error: pe } = await supabaseAdmin.from("profiles").update({ deleted_at: deletedAt, suspended_at: target.suspended_at ?? deletedAt }).eq("id", data.user_id);
    if (pe) throw new Error(needsMigration(pe) ? MIGRATION_MSG : pe.message);
    const { error: ae } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (ae && !/not.found/i.test(ae.message)) {
      // Put things back so the admin can retry; nothing was removed yet.
      await supabaseAdmin.from("profiles").update({ deleted_at: null, suspended_at: target.suspended_at }).eq("id", data.user_id);
      throw new Error(ae.message);
    }
    // Remove what gave them access or responsibilities; keep team_id so their history stays with their team.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_locations").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("teams").update({ manager_id: null }).eq("manager_id", data.user_id);
    return { ok: true };
  });
