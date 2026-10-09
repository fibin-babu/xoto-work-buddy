import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { workedMinutes } from "@/lib/time";

type Row = { id: string; full_name: string; email: string; team: string; worked: number; hours: number; tasks: unknown[] };
type Att = { user_id: string; work_date: string; clock_in: string; clock_out: string | null };
type Task = { work_date: string; hours: number };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };

function days(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end && out.length < 92) {
    out.push(d.toLocaleDateString("en-CA"));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function ReportCharts({ rows, att, tasks, from, to }: { rows: Row[]; att: Att[]; tasks: Task[]; from: string; to: string }) {
  const ids = new Set(rows.map((r) => r.id));
  const daily = useMemo(
    () =>
      days(from, to).map((d) => {
        const a = att.filter((x) => x.work_date === d && ids.has((x as Att).user_id));
        return {
          day: d.slice(5),
          hours: +(workedMinutes(a) / 60).toFixed(1),
          present: new Set(a.map((x) => x.user_id)).size,
          tasks: tasks.filter((t) => t.work_date === d).length,
        };
      }),
    [att, tasks, from, to, rows],
  );
  const people = [...rows]
    .sort((a, b) => b.worked - a.worked)
    .slice(0, 10)
    .map((r) => ({ name: (r.full_name || r.email).split(" ")[0], worked: +(r.worked / 60).toFixed(1), logged: +r.hours.toFixed(1) }));
  const teams = Object.entries(
    rows.reduce<Record<string, number>>((m, r) => ((m[r.team] = (m[r.team] ?? 0) + r.hours), m), {}),
  )
    .map(([name, value]) => ({ name, value: +value.toFixed(1) }))
    .filter((t) => t.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hours worked per day">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" />
            <YAxis fontSize={12} stroke="var(--muted-foreground)" />
            <Tooltip {...tip} />
            <Bar dataKey="hours" name="Hours" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Attendance & tasks per day">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" />
            <Tooltip {...tip} />
            <Line type="monotone" dataKey="present" name="People present" stroke="var(--chart-2)" strokeWidth={2} />
            <Line type="monotone" dataKey="tasks" name="Tasks logged" stroke="var(--chart-3)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Top 10 — clocked vs. logged hours">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={people} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" fontSize={12} stroke="var(--muted-foreground)" />
            <YAxis type="category" dataKey="name" width={80} fontSize={12} stroke="var(--muted-foreground)" />
            <Tooltip {...tip} />
            <Bar dataKey="worked" name="Clocked h" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
            <Bar dataKey="logged" name="Task h" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Task hours by team">
        {teams.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">No task hours in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={teams} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} label={(e) => e.name}>
                {teams.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
