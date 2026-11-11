import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { deleteUser, setSuspended } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Person = { id: string; email: string; full_name: string; suspended_at: string | null };

export function PersonAccessActions({ person, isSelf, onChanged }: { person: Person; isSelf: boolean; onChanged: () => void | Promise<unknown> }) {
  const suspend = useServerFn(setSuspended);
  const remove = useServerFn(deleteUser);
  const [dialog, setDialog] = useState<"suspend" | "restore" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const name = person.full_name || person.email;
  const suspended = !!person.suspended_at;

  if (isSelf) return null;

  async function run() {
    if (busy || !dialog) return;
    setBusy(true);
    try {
      if (dialog === "delete") {
        await remove({ data: { user_id: person.id, confirm_email: typed } });
        toast.success(`${name} was deleted. Their history is kept.`);
      } else {
        await suspend({ data: { user_id: person.id, suspended: dialog === "suspend" } });
        toast.success(dialog === "suspend" ? `${name} is suspended` : `${name}'s access is restored`);
      }
      setDialog(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const open = (d: typeof dialog) => { setTyped(""); setDialog(d); };
  const emailMatches = typed.trim().toLowerCase() === person.email.toLowerCase();

  return (
    <>
      {suspended
        ? <Button variant="outline" size="sm" onClick={() => open("restore")}><RotateCcw /> Restore</Button>
        : <Button variant="outline" size="sm" onClick={() => open("suspend")}><Ban /> Suspend</Button>}
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => open("delete")}><Trash2 /> Delete</Button>

      <AlertDialog open={dialog !== null} onOpenChange={(v) => { if (!v && !busy) setDialog(null); }}>
        <AlertDialogContent>
          {dialog === "suspend" && <AlertDialogHeader>
            <AlertDialogTitle>Suspend {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll be signed out and can't use Xoto Workday until you restore their access. Their attendance, tasks and reports stay visible to admins and managers.
            </AlertDialogDescription>
          </AlertDialogHeader>}
          {dialog === "restore" && <AlertDialogHeader>
            <AlertDialogTitle>Restore {name}'s access?</AlertDialogTitle>
            <AlertDialogDescription>They'll be able to sign in again with their existing password, role, team and work location.</AlertDialogDescription>
          </AlertDialogHeader>}
          {dialog === "delete" && <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {name} permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                Their login account is removed and <strong>this can't be undone</strong>. Their past attendance, tasks and location history are kept in reports. To use this email again you'd create a new account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="space-y-1 text-sm">
              Type <span className="font-semibold">{person.email}</span> to confirm
              <Input autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={person.email} />
            </label>
          </>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant={dialog === "restore" ? "default" : "destructive"}
              disabled={busy || (dialog === "delete" && !emailMatches)}
              onClick={run}
            >
              {busy ? "Working…" : dialog === "delete" ? "Delete permanently" : dialog === "restore" ? "Restore access" : "Suspend"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
