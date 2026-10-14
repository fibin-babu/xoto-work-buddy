import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "manager" | "employee";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }, { count: led }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("teams").select("id", { count: "exact", head: true }).eq("manager_id", u.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role as Role);
      const role: Role = r.includes("admin") ? "admin" : r.includes("manager") ? "manager" : "employee";
      return { id: u.user.id, email: u.user.email ?? "", profile, role, leadsTeam: (led ?? 0) > 0 };
    },
  });
}
