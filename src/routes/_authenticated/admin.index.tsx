import { createFileRoute } from "@tanstack/react-router";
import { WorkReport } from "@/components/WorkReport";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview — Xoto Workday" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me } = useMe();
  if (!me) return null;
  if (me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;
  return <WorkReport title="Company overview" subtitle="Time in, time out, breaks and tasks for everyone." teamFilter charts />;
}
