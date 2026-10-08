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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
    checkAdmin().then((r) => setNeedsSetup(!r.exists)).catch(() => {});
  }, []);

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-ink-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gradient opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
        <p className="relative font-display text-sm uppercase tracking-[0.3em] opacity-70">Xoto Proptech</p>
        <div className="relative space-y-8">
          <h1 className="text-5xl font-bold leading-tight">
            Your workday,
            <br />
            <span className="text-brand-gradient">clocked & clear.</span>
          </h1>
          <ul className="space-y-4 text-lg opacity-90">
            <li className="flex items-center gap-3"><Clock className="h-5 w-5 text-brand-green" /> One-tap clock in, breaks & clock out</li>
            <li className="flex items-center gap-3"><ListChecks className="h-5 w-5 text-brand-green" /> Log today's tasks in seconds</li>
            <li className="flex items-center gap-3"><Users className="h-5 w-5 text-brand-green" /> Managers & admins see the full picture</li>
          </ul>
        </div>
        <p className="relative text-sm opacity-50">© {new Date().getFullYear()} Xoto Proptech</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <img src={logo.url} alt="Xoto" className="-ml-4 h-24 w-auto" />
          <div>
            <h2 className="text-2xl font-bold">{needsSetup ? "Set up the first admin" : "Sign in"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup
                ? "No admin exists yet. Create the first admin account to get started."
                : "Use your Xoto company email and password."}
            </p>
          </div>
          {needsSetup && (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Company email</Label>
            <Input id="email" type="email" placeholder="you@xoto.ae" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" minLength={needsSetup ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
          </div>
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : needsSetup ? "Create admin & sign in" : "Sign in"}
          </Button>
          {!needsSetup && (
            <p className="text-center text-xs text-muted-foreground">Accounts are created by your admin.</p>
          )}
        </form>
      </main>
    </div>
  );
}
