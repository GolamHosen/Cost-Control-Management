import type { Column, Project, Sheet } from "./types";

export function parseNumber(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const audFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return audFormatter.format(0);
  return audFormatter.format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-AU").format(n);
}

export function sumColumn(rows: { cells: Record<number, string> }[], columnId: number | undefined): number {
  if (columnId === undefined) return 0;
  return rows.reduce((acc, r) => acc + parseNumber(r.cells[columnId]), 0);
}

function firstColumnType(sheet: Sheet | undefined, type: Column["type"]): Column | undefined {
  return sheet?.columns.find((c) => c.type === type);
}

function findByRole(sheet: Sheet | undefined, role: string): Column | undefined {
  return sheet?.columns.find((c) => c.reconcileRole === role);
}

function findKeyColumn(sheet: Sheet | undefined): Column | undefined {
  const keyed = findByRole(sheet, "reconcile_key");
  if (keyed) return keyed;
  return sheet?.columns.find(
    (c) => /code|key|trade/i.test(c.label) && (c.type === "text" || c.type === "select"),
  );
}

export interface KeyBreakdown {
  key: string;
  expense: number;
  actual: number;
  variance: number;
  status: "ok" | "variance" | "partial";
}

export interface Reconciliation {
  ready: boolean;
  expenseSheet?: Sheet;
  costSheet?: Sheet;
  expenseAmountColumn?: Column;
  actualColumn?: Column;
  budgetColumn?: Column;
  paidColumn?: Column;
  expenseKeyColumn?: Column;
  costKeyColumn?: Column;

  expenseTotal: number;
  actualTotal: number;
  budgetTotal: number;
  paidTotal: number;

  variance: number;
  balanced: boolean;
  outstanding: number;
  budgetVariance: number;
  paidPercent: number;

  byKey: KeyBreakdown[];
  hasKeyCrossCheck: boolean;
}

export function computeReconciliation(project: Project): Reconciliation {
  const expenseSheet = project.sheets.find((s) => s.type === "expense");
  const costSheet = project.sheets.find((s) => s.type === "cost_control");

  const expenseAmountColumn =
    findByRole(expenseSheet, "expense_amount") ?? firstColumnType(expenseSheet, "currency");
  const actualColumn =
    findByRole(costSheet, "cost_actual") ?? firstColumnType(costSheet, "currency");
  const budgetColumn = findByRole(costSheet, "cost_budget");
  const paidColumn = findByRole(costSheet, "cost_paid");
  const expenseKeyColumn = findKeyColumn(expenseSheet);
  const costKeyColumn = findKeyColumn(costSheet);

  const expenseTotal = sumColumn(expenseSheet?.rows ?? [], expenseAmountColumn?.id);
  const actualTotal = sumColumn(costSheet?.rows ?? [], actualColumn?.id);
  const budgetTotal = sumColumn(costSheet?.rows ?? [], budgetColumn?.id);
  const paidTotal = sumColumn(costSheet?.rows ?? [], paidColumn?.id);

  const variance = expenseTotal - actualTotal;
  const balanced = Math.abs(variance) < 0.009;
  const outstanding = actualTotal - paidTotal;
  const budgetVariance = budgetTotal - actualTotal;
  const paidPercent = actualTotal > 0 ? (paidTotal / actualTotal) * 100 : 0;

  const hasKeyCrossCheck = Boolean(expenseKeyColumn && costKeyColumn);
  const byKey: KeyBreakdown[] = [];

  if (hasKeyCrossCheck && expenseAmountColumn && actualColumn) {
    const expKey = expenseKeyColumn!.id;
    const costKey = costKeyColumn!.id;
    const map = new Map<string, { expense: number; actual: number }>();

    for (const r of expenseSheet!.rows) {
      const k = (r.cells[expKey] ?? "").trim();
      if (!k) continue;
      const cur = map.get(k) ?? { expense: 0, actual: 0 };
      cur.expense += parseNumber(r.cells[expenseAmountColumn.id]);
      map.set(k, cur);
    }
    for (const r of costSheet!.rows) {
      const k = (r.cells[costKey] ?? "").trim();
      if (!k) continue;
      const cur = map.get(k) ?? { expense: 0, actual: 0 };
      cur.actual += parseNumber(r.cells[actualColumn.id]);
      map.set(k, cur);
    }

    for (const [key, v] of map) {
      const v2 = v.expense - v.actual;
      const status: KeyBreakdown["status"] =
        Math.abs(v2) < 0.009 ? "ok" : v.expense === 0 || v.actual === 0 ? "partial" : "variance";
      byKey.push({ key, expense: v.expense, actual: v.actual, variance: v2, status });
    }
    byKey.sort((a, b) => a.key.localeCompare(b.key));
  }

  return {
    ready: Boolean(expenseSheet && costSheet && expenseAmountColumn && actualColumn),
    expenseSheet,
    costSheet,
    expenseAmountColumn,
    actualColumn,
    budgetColumn,
    paidColumn,
    expenseKeyColumn,
    costKeyColumn,
    expenseTotal,
    actualTotal,
    budgetTotal,
    paidTotal,
    variance,
    balanced,
    outstanding,
    budgetVariance,
    paidPercent,
    byKey,
    hasKeyCrossCheck,
  };
}
