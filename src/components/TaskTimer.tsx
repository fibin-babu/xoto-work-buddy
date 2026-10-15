import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PictureInPicture2, Play, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Running = { title: string; start: string };
const KEY = "xoto-task-timer";

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TaskTimer({ uid, date, onSaved }: { uid: string | undefined; date: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pip, setPip] = useState<Window | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) try { setRunning(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  function start() {
    if (!title.trim()) return;
    const r = { title: title.trim().slice(0, 200), start: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(r));
    setRunning(r);
    setNow(Date.now());
    setTitle("");
  }

  function cancel() {
    localStorage.removeItem(KEY);
    setRunning(null);
  }

  async function stop() {
    if (!running || !uid) return;
    const ms = Date.now() - new Date(running.start).getTime();
    const hours = Math.min(24, Math.max(0.01, Math.round((ms / 3600000) * 100) / 100));
    const { error } = await supabase.from("tasks").insert({ user_id: uid, work_date: date, title: running.title, hours });
    if (error) { toast.error(error.message); return; }
    toast.success(`Task saved · ${fmtClock(ms)}`);
    cancel();
    onSaved();
  }

  const supportsPip = typeof window !== "undefined" && "documentPictureInPicture" in window;

  async function openPip() {
    try {
      const w: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 320, height: 200 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => w.document.head.appendChild(n.cloneNode(true)));
      w.document.body.style.margin = "0";
      w.addEventListener("pagehide", () => setPip(null));
      setPip(w);
    } catch {
      toast.error("Could not open the floating widget");
    }
  }

  const elapsed = running ? now - new Date(running.start).getTime() : 0;

  const widget = (compact: boolean) => (
    <div className={compact ? "flex min-h-screen flex-col justify-center gap-3 bg-ink p-4 text-ink-foreground" : "space-y-3"}>
      {running ? (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-green" />
            <span className="truncate font-medium">{running.title}</span>
          </div>
          <p className="font-display text-4xl font-bold tabular-nums">{fmtClock(elapsed)}</p>
          <div className="flex gap-2">
            <Button variant="brand" onClick={stop} className="flex-1"><Square /> Stop & save</Button>
            <Button variant="secondary" size="icon" onClick={cancel} aria-label="Discard timer"><X /></Button>
          </div>
        </>
      ) : compact ? (
        <p className="text-sm opacity-80">No task running. Start one from My Day.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); start(); }} className="flex gap-2">
          <Input placeholder="What are you starting?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-11" />
          <Button type="submit" variant="brand" className="h-11" disabled={!title.trim()}><Play /> Start task</Button>
        </form>
      )}
    </div>
  );

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Task timer</h2>
          <p className="text-sm text-muted-foreground">Start before you begin — time is added to your tasks when you stop.</p>
        </div>
        {supportsPip && !pip && (
          <Button variant="outline" size="sm" onClick={openPip}><PictureInPicture2 /> Pop out</Button>
        )}
      </div>
      {pip ? <p className="text-sm text-muted-foreground">Timer is open in a floating window.</p> : widget(false)}
      {pip && createPortal(widget(true), pip.document.body)}
    </section>
  );
}
