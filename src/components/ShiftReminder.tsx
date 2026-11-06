import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { dueClockInReminder, dueReminder } from "@/lib/shift";
import { todayStr } from "@/lib/time";

/** In-app clock-in reminder after shift start, and clock-out reminder at shift end and 30 minutes after, while still clocked in. */
export function ShiftReminder() {
  const { data: me } = useMe();
  const uid = me?.id;
  const shiftEnd = me?.profile?.shift_end ?? null;
  const shiftStart = me?.profile?.shift_start ?? null;
  const date = todayStr();

  const open = useQuery({
    queryKey: ["myday-open", uid, date],
    enabled: !!uid && (!!shiftEnd || !!shiftStart),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("id, clock_out").eq("user_id", uid!).eq("work_date", date);
      return { open: (data ?? []).some((a) => !a.clock_out), any: (data?.length ?? 0) > 0 };
    },
  });

  useEffect(() => {
    if (!uid || !open.data) return;
    const check = () => {
      const now = new Date();
      const kind = dueReminder(shiftEnd, now, open.data.open) ?? (dueClockInReminder(shiftStart, now, open.data.any) ? "in" : null);
      if (!kind) return;
      const key = `xoto-shift-reminder:${uid}:${todayStr()}:${kind}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      const msg = kind === "in" ? `Your shift started at ${shiftStart!.slice(0, 5)} — remember to clock in.` : kind === "end" ? `Your shift ended at ${shiftEnd!.slice(0, 5)} — remember to clock out.` : "You're still clocked in, 30 minutes past your shift. Clock out?";
      toast.warning(msg, { duration: 30000 });
      if ("Notification" in window && Notification.permission === "granted") new Notification("Xoto Workday", { body: msg, icon: "/icon-192.png" });
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [uid, shiftEnd, shiftStart, open.data]);

  return null;
}
