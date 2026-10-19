export type TimedTask = {
  id: string;
  title: string;
  description: string | null;
  workDate: string;
  elapsedMs: number;
  startedAt: number | null;
  attachmentPath: string | null;
  attachmentName: string | null;
};

export function elapsedMs(task: TimedTask, now: number): number {
  return task.elapsedMs + (task.startedAt === null ? 0 : Math.max(0, now - task.startedAt));
}

export function pauseTask(task: TimedTask, now: number): TimedTask {
  return { ...task, elapsedMs: elapsedMs(task, now), startedAt: null };
}

export function startTask(tasks: TimedTask[], task: TimedTask, now: number): TimedTask[] {
  const existing = tasks.some((item) => item.id === task.id);
  const paused = tasks.map((item) => item.id === task.id
    ? { ...item, startedAt: item.startedAt ?? now }
    : pauseTask(item, now));
  return existing ? paused : [...paused, { ...task, startedAt: now }];
}

export function taskHours(task: TimedTask, now: number): number {
  return Math.min(24, Math.max(0.01, Math.round(elapsedMs(task, now) / 36000) / 100));
}

export function fmtClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
}

// Synchronous lock: React's next render is too late to guard rapid repeated clicks.
export function createSubmissionGuard() {
  let locked = false;
  return {
    acquire() { if (locked) return false; locked = true; return true; },
    release() { locked = false; },
  };
}