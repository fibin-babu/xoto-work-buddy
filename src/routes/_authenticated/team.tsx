import { createFileRoute } from "@tanstack/react-router";
import { WorkReport } from "@/components/WorkReport";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "My Team — Xoto Workday" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useMe();
  if (!me) return null;
  return <WorkReport title="My team" subtitle="Attendance and tasks for people on the teams you lead." excludeUserId={me.id} managerId={me.id} />;
}
