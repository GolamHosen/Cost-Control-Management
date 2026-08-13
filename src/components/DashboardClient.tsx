"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, User } from "@/lib/types";
import { computeReconciliation, formatCurrency } from "@/lib/finance";
import { getAvatarColor, getInitials } from "@/components/Sidebar";

interface Props {
  projects: Project[];
  teamMembers: User[];
}

export default function DashboardClient({ projects, teamMembers }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("All");

  const totalBudget = projects.reduce((a, p) => a + parseFloat(p.budget ?? "0"), 0);
  const totalSpend = projects.reduce((a, p) => a + computeReconciliation(p).actualTotal, 0);
  const balancedCount = projects.filter((p) => computeReconciliation(p).balanced).length;
  const activeCount = projects.filter((p) => p.status === "Active").length;

  const statuses = ["All", ...new Set(projects.map((p) => p.status))];
  const filtered =
    statusFilter === "All" ? projects : projects.filter((p) => p.status === statusFilter);

  // Workload per team member
  const workloadMap = new Map<number, { count: number; budget: number; projectNames: string[] }>();
  for (const p of projects) {
    for (const m of p.members ?? []) {
      const cur = workloadMap.get(m.userId) ?? { count: 0, budget: 0, projectNames: [] };
      cur.count++;
      cur.budget += parseFloat(p.budget ?? "0");
      cur.projectNames.push(p.name);
      workloadMap.set(m.userId, cur);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="px-6 py-6 lg:px-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of all construction projects, team workload, and financial health.
          </p>
        </div>
      </header>

      <div className="px-6 py-6 lg:px-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Total Projects"
            value={String(projects.length)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            }
            color="bg-slate-100 text-slate-600"
          />
          <KpiCard
            label="Active"
            value={String(activeCount)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            color="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            label="Contract Value"
            value={formatCurrency(totalBudget)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="bg-amber-50 text-amber-600"
          />
          <KpiCard
            label="Actual Spend"
            value={formatCurrency(totalSpend)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
            color="bg-sky-50 text-sky-600"
          />
          <KpiCard
            label="Team Size"
            value={String(teamMembers.length)}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            color="bg-violet-50 text-violet-600"
          />
          <KpiCard
            label="In Balance"
            value={`${balancedCount}/${projects.length}`}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color={
              balancedCount === projects.length
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }
          />
        </div>

        {/* Status Filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s}
              {s !== "All" && (
                <span className="ml-1 opacity-60">
                  ({projects.filter((p) => p.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Projects Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Project</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Progress</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Budget</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actual</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Team</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const r = computeReconciliation(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-amber-50/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.location && (
                          <div className="text-[11px] text-slate-400">{p.location}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.client || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                p.progress >= 100
                                  ? "bg-emerald-500"
                                  : p.progress >= 50
                                  ? "bg-amber-500"
                                  : "bg-sky-500"
                              }`}
                              style={{ width: `${Math.min(100, p.progress)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-500">
                            {p.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {formatCurrency(parseFloat(p.budget ?? "0"))}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {formatCurrency(r.actualTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-2">
                          {(p.members ?? []).slice(0, 4).map((m) => (
                            <div
                              key={m.id}
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${getAvatarColor(
                                m.user?.name ?? "?"
                              )}`}
                              title={m.user?.name}
                            >
                              {getInitials(m.user?.name ?? "?")}
                            </div>
                          ))}
                          {(p.members ?? []).length > 4 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-600">
                              +{(p.members ?? []).length - 4}
                            </div>
                          )}
                          {(p.members ?? []).length === 0 && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            r.balanced
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {r.balanced ? "✓ Balanced" : `Δ ${formatCurrency(Math.abs(r.variance))}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No projects found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Workload */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Team Workload</h2>
          {teamMembers.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
              No team members yet. Seed users at{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">/api/auth/seed</code>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teamMembers.map((u) => {
                const wl = workloadMap.get(u.id) ?? {
                  count: 0,
                  budget: 0,
                  projectNames: [],
                };
                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(
                          u.name
                        )}`}
                      >
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900">
                          {u.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              u.role === "admin"
                                ? "bg-amber-100 text-amber-700"
                                : u.role === "manager"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Projects
                        </div>
                        <div className="text-lg font-bold text-slate-800">{wl.count}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Budget Managed
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          {formatCurrency(wl.budget)}
                        </div>
                      </div>
                    </div>

                    {wl.projectNames.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1">
                          {wl.projectNames.slice(0, 3).map((name, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {name.length > 20 ? name.substring(0, 20) + "…" : name}
                            </span>
                          ))}
                          {wl.projectNames.length > 3 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              +{wl.projectNames.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`rounded-xl p-2 ${color}`}>{icon}</div>
      </div>
      <div className="mt-3 text-xl font-extrabold text-slate-900">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-700",
    "On Hold": "bg-amber-100 text-amber-700",
    Completed: "bg-sky-100 text-sky-700",
    Tendering: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        colors[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
