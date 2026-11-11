import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { suspendedMessage } from "@/lib/account-status";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    // Suspended or deleted people may still hold a valid session for a while; sign them out now.
    // (If the status check itself fails we let them through: the database still refuses their data.)
    const { data: status } = await supabase.rpc("my_account_status");
    if (status === "suspended" || status === "deleted") {
      await supabase.auth.signOut();
      toast.error(status === "suspended" ? suspendedMessage : "This account no longer exists. Contact your admin.");
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: AppShell,
});
