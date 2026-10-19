import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Loader2, Paperclip, Pause, PictureInPicture2, Play, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSubmissionGuard, elapsedMs, fmtClock, pauseTask, startTask, taskHours, type TimedTask } from "@/lib/task-timing";

type PipWindow = Window & { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } };

export function TaskTimer({ uid, date, onSaved }: { uid: string | undefined; date: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tasks, setTasks] = useState<TimedTask[]>([]);
  const tasksRef = useRef<TimedTask[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const guard = useRef(createSubmissionGuard());
  const [now, setNow] = useState(Date.now());
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => () => { pipRef.current?.close(); }, []);

  function commit(next: TimedTask[]) {
    if (!key) throw new Error("Please sign in first");
    localStorage.setItem(key, JSON.stringify(next));
    tasksRef.current = next;
    setTasks(next);
    setNow(Date.now());
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!uid || !ready || !title.trim() || !guard.current.acquire()) return;
    setBusy(true);
    let attachmentPath: string | null = null;
    try {
      const id = crypto.randomUUID();
      if (file) {
        attachmentPath = `${uid}/${id}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("task-files").upload(attachmentPath, file);
        if (error) throw error;
      }
      const task: TimedTask = { id, title: title.trim().slice(0, 200), description: description.trim().slice(0, 2000) || null, workDate: date, elapsedMs: 0, startedAt: null, attachmentPath, attachmentName: file?.name.slice(0, 200) ?? null };
      commit(startTask(tasksRef.current, task, Date.now()));
      setTitle("");
      setDescription("");
      setFile(null);
      toast.success("Task started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start task");
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
      const popup = await api.requestWindow({ width: 380, height: 420 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => popup.document.head.appendChild(node.cloneNode(true)));
      popup.document.title = "Xoto — Tasks";
      popup.document.body.className = "m-0 bg-card text-card-foreground";
      popup.addEventListener("pagehide", () => { pipRef.current = null; setPip(null); });
      pipRef.current = popup;
      setPip(popup);
    } catch { toast.error("Could not open the floating widget"); }
  }

  function taskList(compact = false) {
    return (
      <div className={compact ? "p-4" : "border-t pt-4"}>
        <h3 className="mb-3 font-semibold">Ongoing tasks <span className="text-muted-foreground">· {tasks.length}</span></h3>
        <ul className="divide-y">
          {tasks.map((task) => (
            <li key={task.id} className="space-y-2 py-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1"><p className="break-words font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.startedAt === null ? "Paused" : "Running"}</p></div>
                <span className="shrink-0 font-display text-lg font-semibold tabular-nums">{fmtClock(elapsedMs(task, now))}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={`${task.startedAt === null ? "Resume" : "Pause"} ${task.title}`} onClick={() => toggle(task)}>{task.startedAt === null ? <Play /> : <Pause />}{task.startedAt === null ? "Resume" : "Pause"}</Button>
                <Button type="button" variant="soft" size="sm" disabled={busy} aria-label={`Stop and complete ${task.title}`} onClick={() => complete(task.id)}><Square /> Stop & complete</Button>
              </div>
            </li>
          ))}
        </ul>
        {tasks.length === 0 && compact && <p className="text-sm text-muted-foreground">No ongoing tasks</p>}
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-4 rounded-3xl border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Add a task</h2>
        {supportsPip && <Button type="button" variant="outline" size="sm" onClick={openPip}><PictureInPicture2 />{pip ? "Show widget" : "Pop out"}</Button>}
      </div>
      <form onSubmit={add} className="space-y-4">
        <Input aria-label="Task title" placeholder="What are you working on?" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={busy || !ready} className="h-12 text-base" />
        <Textarea aria-label="Task details" placeholder="Details (optional)" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={2} disabled={busy || !ready} />
        {file ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Paperclip className="h-4 w-4 shrink-0" /><span className="flex-1 truncate">{file.name}</span><Button type="button" variant="ghost" size="icon" aria-label="Remove file" disabled={busy} onClick={() => setFile(null)}><X /></Button></div>
        ) : (
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-2 text-sm text-muted-foreground hover:bg-muted"><Paperclip className="h-4 w-4 shrink-0" />Attach a file (max 20 MB)<input type="file" className="hidden" disabled={busy || !ready} onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 20 * 1024 * 1024) { toast.error("File is larger than 20 MB"); event.target.value = ""; return; } setFile(selected); }} /></label>
        )}
        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !ready || !uid || !title.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}Start task</Button>
      </form>
      {tasks.length > 0 && taskList()}
      {pip && createPortal(taskList(true), pip.document.body)}
    </section>
  );
}
