import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getDailyReportSettings, updateDailyReportSettings } from "@/lib/daily-report.functions";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Admin control for the daily task-report email: on/off, recipient(s), and the send time.
 * The report goes out Monday–Saturday (Sunday is a holiday). Times are company time (GST).
 */
export function DailyReportSettings() {
  const load = useServerFn(getDailyReportSettings);
  const save = useServerFn(updateDailyReportSettings);

  const q = useQuery({ queryKey: ["daily-report-settings"], queryFn: () => load() });

  const [enabled, setEnabled] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [time, setTime] = useState("21:00");
  const [saving, setSaving] = useState(false);

  // Seed the form once the saved settings load.
  useEffect(() => {
    if (!q.data) return;
    setEnabled(q.data.enabled);
    setRecipient(q.data.recipient_email);
    setTime(`${pad(q.data.send_hour)}:${pad(q.data.send_minute)}`);
  }, [q.data]);

  async function onSave() {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) { toast.error("Enter a valid time."); return; }
    setSaving(true);
    try {
      await save({ data: { enabled, recipient_email: recipient.trim(), send_hour: h, send_minute: m } });
      toast.success("Daily report settings saved");
      void q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Mail className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Daily task report</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Emails the day's completed tasks, grouped by team, to the recipient below. Sent Monday–Saturday (Sunday off), in company time (GST).
          </p>

          {q.data && !q.data.ready && (
            <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              Apply the latest database update (migration 0008) to enable this.
            </p>
          )}

          <div className="mt-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="report-enabled" className="text-base">Send the daily report</Label>
                <p className="text-sm text-muted-foreground">Turn the automatic email on or off.</p>
              </div>
              <Switch id="report-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={q.isLoading} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-recipient">Recipient email</Label>
                <Input
                  id="report-recipient"
                  type="email"
                  inputMode="email"
                  placeholder="ceo@xoto.ae"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={q.isLoading}
                />
                <p className="text-xs text-muted-foreground">Separate several addresses with commas.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-time">Send time (GST)</Label>
                <Input
                  id="report-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={q.isLoading}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">Default 9:00 PM.</p>
              </div>
            </div>

            {q.data?.last_sent_on && (
              <p className="text-xs text-muted-foreground">Last sent: {q.data.last_sent_on}</p>
            )}

            <Button variant="brand" onClick={onSave} disabled={saving || q.isLoading}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
