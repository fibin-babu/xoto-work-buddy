import { createFileRoute } from "@tanstack/react-router";
import { WorkReport } from "@/components/WorkReport";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "My Team — Xoto Workday" }, { name: "description", content: "Review attendance and task activity for the teams you manage." }, { property: "og:title", content: "My Team — Xoto Workday" }, { property: "og:description", content: "Review attendance and task activity for the teams you manage." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useMe();
  if (!me) return null;
  return <WorkReport title="My team" subtitle="Attendance and tasks for people on the teams you lead." excludeUserId={me.id} managerId={me.id} />;
}
