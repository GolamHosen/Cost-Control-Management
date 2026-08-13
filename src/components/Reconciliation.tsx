"use client";

import type { Project } from "@/lib/types";
import { computeReconciliation, formatCurrency } from "@/lib/finance";
import { Alert, Check } from "./Icons";

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-900"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function Reconciliation({ project }: { project: Project }) {
  const r = computeReconciliation(project);

  if (!r.ready) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        Assign a <strong>currency</strong> column to each sheet (via the column
        ⋮ menu → Cross-check role) to enable the cross-check.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className={`flex flex-wrap items-center gap-4 rounded-2xl border p-5 ${
          r.balanced
            ? "border-emerald-200 bg-emerald-50"
            : "border-rose-200 bg-rose-50"
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            r.balanced ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {r.balanced ? <Check width={24} /> : <Alert width={24} />}
        </div>
        <div className="flex-1">
          <h2
            className={`text-lg font-bold ${
              r.balanced ? "text-emerald-800" : "text-rose-800"
            }`}
          >
            {r.balanced
              ? "Sheets are in balance"
              : "Discrepancy detected — sheets do not match"}
          </h2>
          <p
            className={`text-sm ${
              r.balanced ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {r.balanced
              ? "Total expenses equal total actual costs recorded in cost control."
              : `Expenses and actual costs differ by ${formatCurrency(Math.abs(r.variance))}. Review the highlighted cost codes below.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Variance
          </div>
          <div
            className={`text-2xl font-extrabold ${
              r.balanced ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(r.variance)}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Total Expenses"
          value={formatCurrency(r.expenseTotal)}
          sub={`From: ${r.expenseAmountColumn?.label ?? "—"}`}
          accent="text-sky-700"
        />
        <Stat
          label="Actual Cost (Cost Control)"
          value={formatCurrency(r.actualTotal)}
          sub={`From: ${r.actualColumn?.label ?? "—"}`}
          accent="text-violet-700"
        />
        <Stat
          label="Budget"
          value={formatCurrency(r.budgetTotal)}
          sub={
            r.budgetTotal > 0
              ? `${r.budgetVariance >= 0 ? "Under" : "Over"} by ${formatCurrency(Math.abs(r.budgetVariance))}`
              : "Not set"
          }
          accent="text-amber-700"
        />
        <Stat
          label="Outstanding Payments"
          value={formatCurrency(r.outstanding)}
          sub={`${r.paidPercent.toFixed(0)}% paid (${formatCurrency(r.paidTotal)})`}
          accent={r.outstanding > 0 ? "text-rose-700" : "text-emerald-700"}
        />
      </div>

      {/* Payment progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Payment progress</span>
          <span className="text-slate-500">
            {formatCurrency(r.paidTotal)} of {formatCurrency(r.actualTotal)} paid
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, r.paidPercent))}%` }}
          />
        </div>
      </div>

      {/* By cost-code cross check */}
      {r.hasKeyCrossCheck ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-800">Cross-check by cost code</h3>
            <p className="text-xs text-slate-500">
              Each code is summed across both sheets. Green = matched, red = out of balance.
              Keys: {r.expenseKeyColumn?.label ?? "—"} ↔ {r.costKeyColumn?.label ?? "—"}
            </p>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Cost code</th>
                <th className="px-5 py-3 text-right font-semibold">Expenses</th>
                <th className="px-5 py-3 text-right font-semibold">Actual cost</th>
                <th className="px-5 py-3 text-right font-semibold">Variance</th>
                <th className="px-5 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {r.byKey.map((k) => (
                <tr key={k.key} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium text-slate-800">{k.key}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-sky-700">
                    {formatCurrency(k.expense)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-violet-700">
                    {formatCurrency(k.actual)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-semibold tabular-nums ${
                      Math.abs(k.variance) < 0.009
                        ? "text-slate-400"
                        : "text-rose-600"
                    }`}
                  >
                    {formatCurrency(k.variance)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {k.status === "ok" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Check width={12} /> Matched
                      </span>
                    ) : k.status === "partial" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        One-sided
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        <Alert width={12} /> Out of balance
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {r.byKey.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Enter matching cost codes in both sheets to see the per-code cross-check.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-5 py-3 text-slate-800">TOTAL</td>
                <td className="px-5 py-3 text-right tabular-nums text-sky-700">
                  {formatCurrency(r.expenseTotal)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-violet-700">
                  {formatCurrency(r.actualTotal)}
                </td>
                <td
                  className={`px-5 py-3 text-right tabular-nums ${
                    r.balanced ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(r.variance)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          💡 Tip: set a <strong>Match key</strong> (e.g. Cost Code) on both sheets
          via the column ⋮ menu to enable per-code line-by-line cross-checking.
        </div>
      )}
    </div>
  );
}
