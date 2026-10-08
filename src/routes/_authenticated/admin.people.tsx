import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createEmployee, updateAccess } from "@/lib/admin.functions";
import { useMe, type Role } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/people")({
  head: () => ({ meta: [{ title: "People & Teams — Xoto Workday" }] }),
  component: PeoplePage,
});

const sel = "h-10 rounded-md border bg-card px-3 text-sm";

function PeoplePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateAccess);
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "employee" as Role, team_id: "" });
  const [teamName, setTeamName] = useState("");

  const q = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [p, t, r] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("user_roles").select("*"),
      ]);
      return { people: p.data ?? [], teams: t.data ?? [], roles: r.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries();

  if (me && me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...f, team_id: f.team_id || null } });
      toast.success("Account created");
      setF({ full_name: "", email: "", password: "", role: "employee", team_id: "" });
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("teams").insert({ name: teamName.trim() });
    if (error) { toast.error(error.message); return; }
    setTeamName("");
    refresh();
  }

  const teams = q.data?.teams ?? [];
  const roleOf = (id: string) => (q.data?.roles.find((r) => r.user_id === id)?.role ?? "employee") as Role;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">People & Teams</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={addUser} className="space-y-3 rounded-3xl border bg-card p-6 shadow-card">
          <h2 className="text-xl font-semibold">Create account</h2>
          <Input placeholder="Full name" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input placeholder="name@xoto.ae" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input placeholder="Temporary password (min 8)" type="text" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <div className="flex gap-2">
            <select className={sel} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
            </select>
            <select className={sel + " flex-1"} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Button type="submit" variant="brand" className="w-full">Create account</Button>
        </form>

        <div className="space-y-3 rounded-3xl border bg-card p-6 shadow-card">
          <h2 className="text-xl font-semibold">Teams</h2>
          <form onSubmit={addTeam} className="flex gap-2">
            <Input placeholder="New team name" required value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
          <ul className="divide-y">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-medium">{t.name}</span>
                <select
                  className={sel}
                  value={t.manager_id ?? ""}
                  onChange={async (e) => {
                    const { error } = await supabase.from("teams").update({ manager_id: e.target.value || null }).eq("id", t.id);
                    if (error) toast.error(error.message); else refresh();
                  }}
                >
                  <option value="">No manager</option>
                  {q.data?.people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Team</th></tr>
          </thead>
          <tbody>
            {q.data?.people.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3"><p className="font-semibold">{p.full_name}</p><p className="text-xs text-muted-foreground">{p.email}</p></td>
                <td className="px-4 py-3">
                  <select className={sel} value={roleOf(p.id)} onChange={async (e) => {
                    try { await update({ data: { user_id: p.id, role: e.target.value as Role, team_id: p.team_id } }); refresh(); } catch (err: any) { toast.error(err.message); }
                  }}>
                    <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select className={sel} value={p.team_id ?? ""} onChange={async (e) => {
                    try { await update({ data: { user_id: p.id, role: roleOf(p.id), team_id: e.target.value || null } }); refresh(); } catch (err: any) { toast.error(err.message); }
                  }}>
                    <option value="">No team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
