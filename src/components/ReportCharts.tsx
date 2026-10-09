import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { workedMinutes } from "@/lib/time";

type Row = { id: string; full_name: string; email: string; team: string; worked: number; hours: number; tasks: unknown[] };
type Att = { user_id: string; work_date: string; clock_in: string; clock_out: string | null };
type Task = { work_date: string; hours: number };

const COLORS = [
  "oklch(0.62 0.19 250)", // blue
  "oklch(0.7 0.17 175)", // teal
  "oklch(0.72 0.19 145)", // green
  "oklch(0.75 0.16 85)", // amber
  "oklch(0.65 0.22 330)", // pink
  "oklch(0.62 0.2 290)", // violet
];

const tip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    fontSize: 12,
    boxShadow: "0 8px 24px -12px oklch(0.2 0.03 252 / 0.25)",
  },
  cursor: { fill: "oklch(0.6 0.15 205 / 0.08)" },
};

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
    .slice(0, 8)
    .map((r, i) => ({ name: (r.full_name || r.email).split(" ")[0], worked: +(r.worked / 60).toFixed(1), logged: +r.hours.toFixed(1), fill: COLORS[i % COLORS.length] }));
  const teams = Object.entries(
    rows.reduce<Record<string, number>>((m, r) => ((m[r.team] = (m[r.team] ?? 0) + r.hours), m), {}),
  )
    .map(([name, value], i) => ({ name, value: +value.toFixed(1), fill: COLORS[i % COLORS.length] }))
    .filter((t) => t.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hours worked per day">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={daily}>
            <defs>
              <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.45} />
                <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
            <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" width={36} />
            <Tooltip {...tip} />
            <Area type="monotone" dataKey="hours" name="Hours" stroke={COLORS[0]} strokeWidth={2.5} fill="url(#hoursGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Attendance & tasks per day">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={daily}>
            <defs>
              <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[2]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS[2]} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[4]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS[4]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" width={28} />
            <Tooltip {...tip} />
            <Area type="monotone" dataKey="present" name="People present" stroke={COLORS[2]} strokeWidth={2.5} fill="url(#presentGrad)" />
            <Area type="monotone" dataKey="tasks" name="Tasks logged" stroke={COLORS[4]} strokeWidth={2.5} fill="url(#tasksGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Top people — clocked vs. logged hours">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={people} layout="vertical" margin={{ left: 10, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} fontSize={12} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
            <Tooltip {...tip} />
            <Bar dataKey="worked" name="Clocked h" radius={[0, 8, 8, 0]} barSize={10}>
              {people.map((p, i) => (
                <Cell key={i} fill={p.fill} />
              ))}
            </Bar>
            <Bar dataKey="logged" name="Task h" radius={[0, 8, 8, 0]} barSize={10} fill="var(--muted)" opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Task hours by team">
        {teams.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">No task hours in this period.</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={260}>
              <RadialBarChart innerRadius="30%" outerRadius="100%" data={teams} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, Math.max(...teams.map((t) => t.value))]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "var(--muted)" }} angleAxisId={0} />
                <Tooltip {...tip} />
              </RadialBarChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-2 text-sm">
              {teams.map((t) => (
                <li key={t.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.fill }} />
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="font-semibold tabular-nums">{t.value}h</span>
                </li>
              ))}
            </ul>
          </div>
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
