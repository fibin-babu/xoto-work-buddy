import { cn } from "@/lib/utils";

export const STATUSES = [
  { value: "done", label: "Done" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
] as const;

export function StatusBadge({ status }: { status: string }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "done" && "bg-accent text-accent-foreground",
        status === "in_progress" && "bg-secondary text-primary",
        status === "blocked" && "bg-destructive/10 text-destructive",
      )}
    >
      {label}
    </span>
  );
}
