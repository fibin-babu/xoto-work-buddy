import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createEmployee, resetPassword, updateAccess } from "@/lib/admin.functions";
import { useMe, type Role } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFix } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/admin/people")({
  head: () => ({ meta: [{ title: "People & Teams — Xoto Workday" }, { name: "description", content: "Manage employee accounts, roles, and team assignments." }, { property: "og:title", content: "People & Teams — Xoto Workday" }, { property: "og:description", content: "Manage employee accounts, roles, and team assignments." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PeoplePage,
});

const sel = "h-9 min-w-0 rounded-lg border border-input bg-background pl-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 field-select";
const timeSel = "h-9 w-[8.5rem] rounded-lg border border-input bg-background px-3 text-sm font-medium tabular-nums text-foreground shadow-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

function PeoplePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateAccess);
  const reset = useServerFn(resetPassword);
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ full_name: "", email: "", role: "employee" as Role, team_id: "", shift_start: "09:00", shift_end: "18:00", location_ids: [] as string[] });
  const [teamName, setTeamName] = useState("");
  const [loc, setLoc] = useState({ name: "", lat: "", lng: "", radius_m: "200" });

  const q = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [p, t, r, l, ul] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("user_roles").select("*"),
        supabase.from("work_locations").select("*").order("name"),
        supabase.from("user_locations").select("*"),
      ]);
      return { people: p.data ?? [], teams: t.data ?? [], roles: r.data ?? [], locs: l.data ?? [], userLocs: ul.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries();

  if (me && me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: { ...f, team_id: f.team_id || null, shift_start: f.shift_start || null, shift_end: f.shift_end || null, redirect_to: `${window.location.origin}/reset-password` } });
      toast.success("Invite sent — they'll set their own password");
      setF({ full_name: "", email: "", role: "employee", team_id: "", shift_start: "09:00", shift_end: "18:00", location_ids: [] });
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

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("work_locations").insert({ name: loc.name.trim(), lat: Number(loc.lat), lng: Number(loc.lng), radius_m: Number(loc.radius_m) });
    if (error) { toast.error(error.message); return; }
    setLoc({ name: "", lat: "", lng: "", radius_m: "200" });
    refresh();
  }

  async function useMyLocation() {
    const f = await getFix();
    if (!f) { toast.error("Couldn't get your location"); return; }
    setLoc((l) => ({ ...l, lat: f.lat.toFixed(6), lng: f.lng.toFixed(6) }));
  }

  async function saveShift(id: string, field: "shift_start" | "shift_end", value: string) {
    const { error } = await supabase.from("profiles").update(field === "shift_start" ? { shift_start: value || null } : { shift_end: value || null }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }

  async function toggleLoc(user_id: string, location_id: string, on: boolean) {
    const { error } = on
      ? await supabase.from("user_locations").insert({ user_id, location_id })
      : await supabase.from("user_locations").delete().eq("user_id", user_id).eq("location_id", location_id);
    if (error) toast.error(error.message); else refresh();
  }

  const locs = q.data?.locs ?? [];
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
          <p className="text-xs text-muted-foreground">They'll get an email invite to set their own password.</p>
          <div className="flex gap-2">
            <select className={sel} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
            </select>
            <select className={sel + " flex-1"} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 text-muted-foreground">Shift</span>
            <input type="time" aria-label="New shift start" className={timeSel} value={f.shift_start} onChange={(e) => setF({ ...f, shift_start: e.target.value })} />
            <span className="text-muted-foreground">–</span>
            <input type="time" aria-label="New shift end" className={timeSel} value={f.shift_end} onChange={(e) => setF({ ...f, shift_end: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-muted-foreground">Location</span>
            {locs.length === 0 ? <span className="text-xs text-muted-foreground">Add a work location below first</span> : locs.map((l) => (
              <label key={l.id} className="flex items-center gap-1">
                <input type="checkbox" checked={f.location_ids.includes(l.id)} onChange={(e) => setF({ ...f, location_ids: e.target.checked ? [...f.location_ids, l.id] : f.location_ids.filter((x) => x !== l.id) })} />{l.name}
              </label>
            ))}
          </div>
          <Button type="submit" variant="brand" className="w-full">Send invite</Button>
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
                <span className="flex-1 font-medium">{t.name} <span className="text-xs text-muted-foreground">· {q.data?.people.filter((p) => p.team_id === t.id).length ?? 0} people</span></span>
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
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!confirm(`Delete team "${t.name}"? Members will become unassigned.`)) return;
                  await supabase.from("profiles").update({ team_id: null }).eq("team_id", t.id);
                  const { error } = await supabase.from("teams").delete().eq("id", t.id);
                  if (error) toast.error(error.message); else refresh();
                }}>Delete</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border bg-card p-6 shadow-card">
        <h2 className="text-xl font-semibold">Work locations</h2>
        <p className="text-sm text-muted-foreground">People assigned to a location are checked against it when they clock in and out.</p>
        <form onSubmit={addLocation} className="flex flex-wrap gap-2">
          <Input placeholder="Name (e.g. Dubai office)" required value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} className="min-w-48 flex-1" />
          <Input placeholder="Latitude" required type="number" step="any" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: e.target.value })} className="w-32" />
          <Input placeholder="Longitude" required type="number" step="any" value={loc.lng} onChange={(e) => setLoc({ ...loc, lng: e.target.value })} className="w-32" />
          <Input placeholder="Range (m)" required type="number" min={20} max={5000} value={loc.radius_m} onChange={(e) => setLoc({ ...loc, radius_m: e.target.value })} className="w-28" />
          <Button type="button" variant="outline" onClick={useMyLocation}>Use my location</Button>
          <Button type="submit">Add</Button>
        </form>
        <ul className="divide-y">
          {locs.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span><span className="font-medium">{l.name}</span> <span className="text-muted-foreground">· {l.lat.toFixed(4)}, {l.lng.toFixed(4)} · {l.radius_m} m</span></span>
              <Button variant="ghost" size="sm" onClick={async () => {
                if (!confirm(`Delete location "${l.name}"?`)) return;
                const { error } = await supabase.from("work_locations").delete().eq("id", l.id);
                if (error) toast.error(error.message); else refresh();
              }}>Delete</Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Everyone ({q.data?.people.length ?? 0})</h2>
        <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <div className="overflow-x-auto rounded-3xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Shift</th><th className="px-4 py-3">Locations</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {q.data?.people.filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())).map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3"><p className="font-semibold">{p.full_name}</p><p className="text-xs text-muted-foreground">{p.email}</p></td>
                <td className="px-4 py-3">
                  <select className={sel + " w-32"} value={roleOf(p.id)} onChange={async (e) => {
                    try { await update({ data: { user_id: p.id, role: e.target.value as Role, team_id: p.team_id } }); refresh(); } catch (err: any) { toast.error(err.message); }
                  }}>
                    <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select className={sel + " w-48"} value={p.team_id ?? ""} onChange={async (e) => {
                    try { await update({ data: { user_id: p.id, role: roleOf(p.id), team_id: e.target.value || null } }); refresh(); } catch (err: any) { toast.error(err.message); }
                  }}>
                    <option value="">No team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input type="time" aria-label="Shift start" className={timeSel} defaultValue={p.shift_start?.slice(0, 5) ?? ""} onBlur={(e) => e.target.value !== (p.shift_start?.slice(0, 5) ?? "") && saveShift(p.id, "shift_start", e.target.value)} />
                    <span className="text-muted-foreground">–</span>
                    <input type="time" aria-label="Shift end" className={timeSel} defaultValue={p.shift_end?.slice(0, 5) ?? ""} onBlur={(e) => e.target.value !== (p.shift_end?.slice(0, 5) ?? "") && saveShift(p.id, "shift_end", e.target.value)} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {locs.length === 0 ? <span className="text-xs text-muted-foreground">Add a location first</span> : (
                    <div className="flex flex-wrap gap-2">
                      {locs.map((l) => {
                        const on = !!q.data?.userLocs.some((u) => u.user_id === p.id && u.location_id === l.id);
                        return (
                          <label key={l.id} className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={on} onChange={(e) => toggleLoc(p.id, l.id, e.target.checked)} />{l.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={async () => {
                    const pw = prompt(`New password for ${p.email} (min 8 characters)`);
                    if (!pw) return;
                    if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
                    try { await reset({ data: { user_id: p.id, password: pw } }); toast.success("Password updated"); } catch (err: any) { toast.error(err.message); }
                  }}>Reset password</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
