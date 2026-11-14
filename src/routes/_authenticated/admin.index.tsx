import { createFileRoute } from "@tanstack/react-router";
import { WorkReport } from "@/components/WorkReport";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Organization — Xoto Workday" }, { name: "description", content: "View organization attendance, location reviews, work hours, breaks, and task reports." }, { property: "og:title", content: "Organization — Xoto Workday" }, { property: "og:description", content: "View organization attendance, location reviews, work hours, breaks, and task reports." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me } = useMe();
  if (!me) return null;
  if (me.role !== "admin") return <p className="text-muted-foreground">Admins only.</p>;
  return <WorkReport title="Organization" subtitle="Time in, time out, breaks and tasks for everyone." teamFilter charts />;
}
