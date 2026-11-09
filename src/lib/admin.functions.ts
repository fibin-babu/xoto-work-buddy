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

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only admins can do this");
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
