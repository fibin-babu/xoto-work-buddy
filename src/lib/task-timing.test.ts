import { describe, expect, it } from "vitest";
import { createSubmissionGuard, elapsedMs, pauseTask, startTask, type TimedTask } from "./task-timing";

const task = (id: string): TimedTask => ({ id, title: id, description: null, workDate: "2026-10-19", elapsedMs: 0, startedAt: null, attachmentPath: null, attachmentName: null });
function at(tasks: TimedTask[], index: number): TimedTask {
  const item = tasks[index];
  if (!item) throw new Error(`Missing task at ${index}`);
  return item;
}

describe("task timer workflow", () => {
  it("adding a task starts its timer", () => {
    const added = at(startTask([], task("first"), 1000), 0);
    expect(added.startedAt).toBe(1000);
    expect(elapsedMs(added, 6000)).toBe(5000);
  });
  it("starting a second task pauses the first", () => {
    const tasks = startTask(startTask([], task("first"), 1000), task("second"), 6000);
    expect(at(tasks, 0).startedAt).toBeNull();
    expect(elapsedMs(at(tasks, 0), 9000)).toBe(5000);
    expect(elapsedMs(at(tasks, 1), 9000)).toBe(3000);
    expect(tasks.filter((item) => item.startedAt !== null)).toHaveLength(1);
  });
  it("resuming accumulates only running time", () => {
    const tasks = startTask(startTask(startTask([], task("first"), 1000), task("second"), 6000), task("first"), 9000);
    expect(elapsedMs(at(tasks, 0), 11000)).toBe(7000);
    expect(elapsedMs(at(tasks, 1), 11000)).toBe(3000);
    expect(tasks).toHaveLength(2);
  });
  it("stopping a paused task preserves its accumulated duration", () => {
    const tasks = startTask(startTask([], task("first"), 1000), task("second"), 6000);
    expect(pauseTask(at(tasks, 0), 20000).elapsedMs).toBe(5000);
    expect(pauseTask(at(tasks, 1), 20000).elapsedMs).toBe(14000);
  });
  it("duplicate starts with the same ID do not add another task", () => {
    expect(startTask(startTask([], task("first"), 1000), task("first"), 2000)).toHaveLength(1);
  });
  it("repeated submits cannot enter while the first submission is pending", () => {
    const guard = createSubmissionGuard();
    expect(guard.acquire()).toBe(true);
    expect(guard.acquire()).toBe(false);
    guard.release();
    expect(guard.acquire()).toBe(true);
  });
});