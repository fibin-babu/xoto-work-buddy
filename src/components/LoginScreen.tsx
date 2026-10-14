import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, ListChecks, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminExists, bootstrapAdmin } from "@/lib/admin.functions";
import { isCompanyEmail } from "@/lib/time";
import logo from "@/assets/xoto-logo.png.asset.json";

export function LoginScreen() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(adminExists);
  const setup = useServerFn(bootstrapAdmin);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    // Local session read — no network round-trip, so the page feels instant.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/dashboard", replace: true });
    });
    checkAdmin().then((r) => setNeedsSetup(!r.exists)).catch(() => {});
  }, []);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isCompanyEmail(email)) { toast.error("Use your @xoto.ae company email"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your email");
      setForgot(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCompanyEmail(email)) { toast.error("Use your @xoto.ae company email"); return; }
    setBusy(true);
    try {
      if (needsSetup) await setup({ data: { email, password, full_name: name } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-ink text-ink-foreground lg:grid-cols-[1.1fr_1fr]">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-gradient opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-brand-gradient opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />

      <aside className="relative hidden flex-col justify-between p-14 lg:flex">
        <p className="font-display text-xs uppercase tracking-[0.35em] opacity-60">Xoto Proptech · Workday</p>
        <div className="space-y-10">
          <h1 className="font-display text-6xl font-bold leading-[1.05]">
            Your workday,
            <br />
            <span className="text-brand-gradient">clocked & clear.</span>
          </h1>
          <div className="grid max-w-lg grid-cols-3 gap-3">
            {[
              { icon: Clock, t: "Clock in", d: "One tap" },
              { icon: ListChecks, t: "Log tasks", d: "In seconds" },
              { icon: Users, t: "Team view", d: "Live picture" },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-ink-foreground/10 bg-ink-foreground/5 p-4 backdrop-blur">
                <f.icon className="mb-3 h-5 w-5 text-brand-green" />
                <p className="font-semibold">{f.t}</p>
                <p className="text-sm opacity-60">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm opacity-40">© {new Date().getFullYear()} Xoto Proptech</p>
      </aside>

      <main className="relative flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl bg-card p-8 text-card-foreground shadow-brand sm:p-10">
          <img src={logo.url} alt="Xoto" className="-ml-3 h-20 w-auto" />
          <div>
            <h2 className="font-display text-3xl font-bold">{needsSetup ? "Set up the first admin" : "Welcome back"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {needsSetup
                ? "No admin exists yet. Create the first admin account to get started."
                : "Sign in with your @xoto.ae email to start your day."}
            </p>
          </div>
          {needsSetup && (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-12" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Company email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@xoto.ae" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoComplete="current-password" minLength={needsSetup ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
          </div>
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : needsSetup ? "Create admin & sign in" : "Sign in"}
          </Button>
          {!needsSetup && (
            <p className="text-center text-xs text-muted-foreground">No account? Ask your admin to create one.</p>
          )}
        </form>
      </main>
    </div>
  );
}
