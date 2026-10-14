import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/xoto-logo.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Xoto Workday" },
      { name: "description", content: "Set a new password for your Xoto Workday account." },
      { property: "og:title", content: "Reset password — Xoto Workday" },
      { property: "og:description", content: "Set a new password for your Xoto Workday account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link arrives with type=recovery in the URL hash; the
    // client picks it up and fires PASSWORD_RECOVERY with a live session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else
        setTimeout(() => {
          setReady((r) => {
            if (!r) setInvalid(true);
            return r;
          });
        }, 3000);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink p-6 text-ink-foreground">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-gradient opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-brand-gradient opacity-20 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-6 rounded-3xl bg-card p-8 text-card-foreground shadow-brand sm:p-10">
        <img src={logo.url} alt="Xoto" className="-ml-3 h-20 w-auto" />
        <div>
          <h2 className="font-display text-3xl font-bold">Choose a new password</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {invalid
              ? "This reset link is invalid or has expired. Request a new one from the sign-in page."
              : "Enter your new password below."}
          </p>
        </div>
        {!invalid && (
          <>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm password</Label>
              <Input id="confirm-pw" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-12" />
            </div>
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy || !ready}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </>
        )}
        <button type="button" onClick={() => navigate({ to: "/auth" })} className="w-full text-center text-xs font-medium text-primary hover:underline">
          Back to sign in
        </button>
      </form>
    </div>
  );
}
