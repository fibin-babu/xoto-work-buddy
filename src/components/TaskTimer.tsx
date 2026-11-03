import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Clock, Loader2, Paperclip, Pause, PictureInPicture2, Play, Plus, Square, Timer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createSubmissionGuard, elapsedMs, fmtClock, pauseTask, startTask, taskHours, type TimedTask } from "@/lib/task-timing";

type PipWindow = Window & { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } };
const HOUR_CHIPS = [0.25, 0.5, 1, 2, 4];

// Ticks on its own so only the digits re-render each second, not the whole card.
const LiveClock = memo(function LiveClock({ task, className }: { task: TimedTask; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (task.startedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [task.startedAt]);
  return <span className={cn("tabular-nums", className)}>{fmtClock(elapsedMs(task, task.startedAt === null ? 0 : now))}</span>;
});

export function TaskTimer({ uid, date, onSaved }: { uid: string | undefined; date: string; onSaved: () => void }) {
  const [mode, setMode] = useState<"timer" | "log">("timer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tasks, setTasks] = useState<TimedTask[]>([]);
  const tasksRef = useRef<TimedTask[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const guard = useRef(createSubmissionGuard());
  const [pip, setPip] = useState<Window | null>(null);
  const pipRef = useRef<Window | null>(null);
  const [supportsPip, setSupportsPip] = useState(false);
  const key = uid ? `xoto-task-timers:${uid}` : null;

  useEffect(() => {
    setReady(false);
    tasksRef.current = [];
    setTasks([]);
    if (!key) return;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (!Array.isArray(parsed) || !parsed.every((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.elapsedMs === "number" && Number.isFinite(item.elapsedMs) && (item.startedAt === null || Number.isFinite(item.startedAt)) && typeof item.workDate === "string")) {
        throw new Error("Invalid saved timers");
      }
      tasksRef.current = parsed;
      setTasks(parsed);
      setReady(true);
    } catch { toast.error("Could not restore your timers. Please check browser storage before starting a task."); }
    setSupportsPip("documentPictureInPicture" in window);
  }, [key]);

  useEffect(() => () => { pipRef.current?.close(); }, []);

  function commit(next: TimedTask[]) {
    if (!key) throw new Error("Please sign in first");
    localStorage.setItem(key, JSON.stringify(next));
    tasksRef.current = next;
    setTasks(next);
  }

  const hoursNum = Number(hours);
  const hoursValid = Number.isFinite(hoursNum) && hoursNum > 0 && hoursNum <= 24;

  async function uploadFile(id: string) {
    if (!file || !uid) return null;
    const path = `${uid}/${id}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("task-files").upload(path, file);
    if (error) throw error;
    return path;
  }

  function resetForm() { setTitle(""); setDescription(""); setFile(null); setHours(""); }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!uid || !ready || !title.trim() || (mode === "log" && !hoursValid) || !guard.current.acquire()) return;
    setBusy(true);
    let attachmentPath: string | null = null;
    try {
      const id = crypto.randomUUID();
      attachmentPath = await uploadFile(id);
      const base = { title: title.trim().slice(0, 200), description: description.trim().slice(0, 2000) || null, attachmentPath, attachmentName: file?.name.slice(0, 200) ?? null };
      if (mode === "log") {
        const { error } = await supabase.from("tasks").upsert({ id, user_id: uid, work_date: date, title: base.title, description: base.description, hours: Math.round(hoursNum * 100) / 100, attachment_path: base.attachmentPath, attachment_name: base.attachmentName }, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
        resetForm();
        onSaved();
        toast.success("Task logged");
      } else {
        commit(startTask(tasksRef.current, { id, workDate: date, elapsedMs: 0, startedAt: null, ...base }, Date.now()));
        resetForm();
        toast.success("Task started");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save task");
      if (attachmentPath) await supabase.storage.from("task-files").remove([attachmentPath]);
    } finally { guard.current.release(); setBusy(false); }
  }

  function toggle(task: TimedTask) {
    if (busy || !ready) return;
    try {
      const timestamp = Date.now();
      commit(task.startedAt === null ? startTask(tasksRef.current, task, timestamp) : tasksRef.current.map((item) => item.id === task.id ? pauseTask(item, timestamp) : item));
    } catch { toast.error("Could not save timer changes"); }
  }

  async function complete(id: string) {
    if (!uid || !ready || !guard.current.acquire()) return;
    const task = tasksRef.current.find((item) => item.id === id);
    if (!task) { guard.current.release(); return; }
    setBusy(true);
    try {
      const timestamp = Date.now();
      const stopped = pauseTask(task, timestamp);
      commit(tasksRef.current.map((item) => item.id === id ? stopped : item));
      // A stable ID makes retries idempotent, even if the previous response was lost.
      const { error } = await supabase.from("tasks").upsert({ id: stopped.id, user_id: uid, work_date: stopped.workDate, title: stopped.title, description: stopped.description, hours: taskHours(stopped, timestamp), attachment_path: stopped.attachmentPath, attachment_name: stopped.attachmentName }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      commit(tasksRef.current.filter((item) => item.id !== id));
      onSaved();
      toast.success("Task completed");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not complete task. Your timer is paused; please try again."); }
    finally { guard.current.release(); setBusy(false); }
  }

  async function openPip() {
    if (pipRef.current) { pipRef.current.focus(); return; }
    try {
      const api = (window as PipWindow).documentPictureInPicture;
      if (!api) return;
      const popup = await api.requestWindow({ width: 400, height: 460 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => popup.document.head.appendChild(node.cloneNode(true)));
      popup.document.title = "Xoto — Tasks";
      popup.document.documentElement.className = document.documentElement.className;
      popup.document.body.className = "m-0 min-h-screen bg-ink text-ink-foreground font-sans";
      popup.addEventListener("pagehide", () => { pipRef.current = null; setPip(null); });
      pipRef.current = popup;
      setPip(popup);
    } catch { toast.error("Could not open the floating widget"); }
  }

  const active = tasks.find((t) => t.startedAt !== null) ?? tasks[tasks.length - 1];

  function pipView() {
    return (
      <div className="flex min-h-screen flex-col p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
          <span className={cn("h-2 w-2 rounded-full", active?.startedAt != null ? "animate-pulse bg-brand-green" : "bg-warning")} />
          {active ? (active.startedAt != null ? "Running" : "Paused") : "No task running"}
        </div>
        {active ? (
          <div className="mt-3 flex-1">
            <p className="line-clamp-2 text-lg font-semibold">{active.title}</p>
            <LiveClock task={active} className="mt-2 block font-display text-6xl font-bold leading-none text-brand-gradient" />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => toggle(active)}>{active.startedAt === null ? <><Play /> Resume</> : <><Pause /> Pause</>}</Button>
              <Button type="button" variant="brand" size="lg" disabled={busy} onClick={() => complete(active.id)}><Square /> Complete</Button>
            </div>
          </div>
        ) : <p className="mt-6 flex-1 text-sm opacity-70">Start a task from My Day to see it here.</p>}
        {tasks.length > 1 && (
          <ul className="mt-4 space-y-1 border-t border-sidebar-border pt-3">
            {tasks.filter((t) => t.id !== active?.id).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate opacity-80">{t.title}</span>
                <LiveClock task={t} className="text-xs opacity-70" />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Switch to ${t.title}`} disabled={busy} onClick={() => toggle(t)}><Play /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-4 rounded-3xl border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Add a task</h2>
        {supportsPip && <Button type="button" variant="outline" size="sm" onClick={openPip}><PictureInPicture2 />{pip ? "Show widget" : "Pop out"}</Button>}
      </div>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([["timer", "Start timer", Timer], ["log", "Log hours", Clock]] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors", mode === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <form onSubmit={add} className="space-y-4">
        <Input aria-label="Task title" placeholder={mode === "timer" ? "What are you working on?" : "What did you work on?"} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={busy || !ready} className="h-12 text-base" />
        <Textarea aria-label="Task details" placeholder="Details (optional)" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={2} disabled={busy || !ready} />
        {mode === "log" && (
          <div className="flex flex-wrap items-center gap-2">
            {HOUR_CHIPS.map((h) => (
              <Button key={h} type="button" size="sm" variant={hoursNum === h ? "brand" : "outline"} onClick={() => setHours(String(h))}>{h}h</Button>
            ))}
            <Input aria-label="Hours spent" type="number" inputMode="decimal" min={0.01} max={24} step={0.25} placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} className="h-9 w-24" />
          </div>
        )}
        {file ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Paperclip className="h-4 w-4 shrink-0" /><span className="flex-1 truncate">{file.name}</span><Button type="button" variant="ghost" size="icon" aria-label="Remove file" disabled={busy} onClick={() => setFile(null)}><X /></Button></div>
        ) : (
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-2 text-sm text-muted-foreground hover:bg-muted"><Paperclip className="h-4 w-4 shrink-0" />Attach a file (max 20 MB)<input type="file" className="hidden" disabled={busy || !ready} onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 20 * 1024 * 1024) { toast.error("File is larger than 20 MB"); event.target.value = ""; return; } setFile(selected); }} /></label>
        )}
        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !ready || !uid || !title.trim() || (mode === "log" && !hoursValid)}>
          {busy ? <Loader2 className="animate-spin" /> : mode === "timer" ? <Play /> : <Plus />}{mode === "timer" ? "Start task" : "Add task"}
        </Button>
      </form>
      {tasks.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="mb-3 font-semibold">Ongoing tasks <span className="text-muted-foreground">· {tasks.length}</span></h3>
          <ul className="divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="space-y-2 py-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><p className="break-words font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.startedAt === null ? "Paused" : "Running"}</p></div>
                  <LiveClock task={task} className="shrink-0 font-display text-lg font-semibold" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={`${task.startedAt === null ? "Resume" : "Pause"} ${task.title}`} onClick={() => toggle(task)}>{task.startedAt === null ? <Play /> : <Pause />}{task.startedAt === null ? "Resume" : "Pause"}</Button>
                  <Button type="button" variant="soft" size="sm" disabled={busy} aria-label={`Stop and complete ${task.title}`} onClick={() => complete(task.id)}><Square /> Stop & complete</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pip && createPortal(pipView(), pip.document.body)}
    </section>
  );
}
