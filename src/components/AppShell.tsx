import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Sun, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import logo from "@/assets/xoto-logo.png.asset.json";

export function AppShell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/dashboard", label: "My Day", icon: Sun, show: true },
    { to: "/team", label: "My Team", icon: Users, show: me?.role === "manager" || !!me?.leadsTeam },
    { to: "/admin", label: "Admin", icon: LayoutDashboard, show: me?.role === "admin" },
    { to: "/admin/people", label: "People & Teams", icon: UserCog, show: me?.role === "admin" },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link to="/dashboard" className="flex items-center">
            <img src={logo.url} alt="Xoto" className="h-14 w-auto" />
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  activeOptions={{ exact: true }}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
                >
                  <l.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{l.label}</span>
                </Link>
              ))}
          </nav>
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold leading-tight">{me?.profile?.full_name || me?.email}</p>
            <p className="text-xs capitalize text-muted-foreground">{me?.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
