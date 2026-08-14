"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Column, Project, Sheet } from "@/lib/types";
import { computeReconciliation, formatCurrency } from "@/lib/finance";
import Spreadsheet from "./Spreadsheet";
import Reconciliation from "./Reconciliation";
import {
  readExcelFile,
  mapHeadersToColumns,
  convertRowsToCells,
} from "@/lib/excel-import";
import {
  exportSheetToExcel,
  exportProjectToExcel,
} from "@/lib/excel-export";
import {
  ArrowLeft,
  Building,
  Calendar,
  Check,
  Download,
  Pencil,
  Plus,
  Scale,
  Wallet,
  X,
} from "./Icons";

type Tab = "expense" | "cost" | "reconcile";

export default function Workspace({ initial }: { initial: Project }) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initial);
  const [tab, setTab] = useState<Tab>("expense");
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const base = `/api/projects/${project.id}`;
  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const put = useCallback(
    (path: string, body: unknown) =>
      fetch(base + path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    [base],
  );
  const patch = (path: string, body: unknown) =>
    fetch(base + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const del = (path: string) => fetch(base + path, { method: "DELETE" });

  const changeCell = useCallback(
    (sheetId: number, rowId: number, columnId: number, value: string) => {
      setProject((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) =>
          s.id !== sheetId
            ? s
            : {
                ...s,
                rows: s.rows.map((r) =>
                  r.id === rowId
                    ? { ...r, cells: { ...r.cells, [columnId]: value } }
                    : r,
                ),
              },
        ),
      }));
      put("/cells", { rowId, columnId, value }).catch(() => {});
    },
    [put],
  );

  const addRow = (sheetId: number) => {
    const tempId = -Math.floor(Math.random() * 1e9);
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id !== sheetId
          ? s
          : { ...s, rows: [...s.rows, { id: tempId, position: s.rows.length, cells: {} }] },
      ),
    }));
    post("/rows", { sheetId })
      .then((res) => res.json())
      .then((data: { id: number }) =>
        setProject((prev) => ({
          ...prev,
          sheets: prev.sheets.map((s) =>
            s.id !== sheetId
              ? s
              : {
                  ...s,
                  rows: s.rows.map((r) => (r.id === tempId ? { ...r, id: data.id } : r)),
                },
          ),
        })),
      );
  };

  const deleteRow = (sheetId: number, rowId: number) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id !== sheetId ? s : { ...s, rows: s.rows.filter((r) => r.id !== rowId) },
      ),
    }));
    del(`/rows/${rowId}`).catch(() => {});
  };

  const addColumn = (sheetId: number) => {
    const tempId = -Math.floor(Math.random() * 1e9);
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id !== sheetId
          ? s
          : {
              ...s,
              columns: [
                ...s.columns,
                {
                  id: tempId,
                  sheetId,
                  label: "New Column",
                  type: "text",
                  options: null,
                  reconcileRole: null,
                  width: 180,
                  position: s.columns.length,
                },
              ],
            },
      ),
    }));
    post("/columns", { sheetId, label: "New Column", type: "text" })
      .then((res) => res.json())
      .then((data: Column) =>
        setProject((prev) => ({
          ...prev,
          sheets: prev.sheets.map((s) =>
            s.id !== sheetId
              ? s
              : {
                  ...s,
                  columns: s.columns.map((c) => (c.id === tempId ? data : c)),
                },
          ),
        })),
      );
  };

  const updateColumn = (sheetId: number, colId: number, patchData: Partial<Column>) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id !== sheetId
          ? s
          : {
              ...s,
              columns: s.columns.map((c) => (c.id === colId ? { ...c, ...patchData } : c)),
            },
      ),
    }));
    patch(`/columns/${colId}`, patchData).catch(() => {});
  };

  const deleteColumn = (sheetId: number, colId: number) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id !== sheetId
          ? s
          : { ...s, columns: s.columns.filter((c) => c.id !== colId) },
      ),
    }));
    del(`/columns/${colId}`).catch(() => {});
  };

  const moveColumn = (sheetId: number, colId: number, direction: -1 | 1) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        const idx = s.columns.findIndex((c) => c.id === colId);
        if (idx < 0) return s;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= s.columns.length) return s;

        const nextCols = [...s.columns];
        const [moved] = nextCols.splice(idx, 1);
        nextCols.splice(targetIdx, 0, moved);
        const reindexed = nextCols.map((c, i) => ({ ...c, position: i }));

        patch(`/columns/${colId}`, { position: targetIdx }).catch(() => {});
        const other = s.columns[targetIdx];
        if (other) patch(`/columns/${other.id}`, { position: idx }).catch(() => {});

        return { ...s, columns: reindexed };
      }),
    }));
  };

  const saveProject = (p: Partial<Project>) => {
    setProject((prev) => ({ ...prev, ...p }));
    patch("", p).catch(() => {});
  };

  // --- Excel Import Handler ---
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSheet) return;

    setImporting(true);
    try {
      const parsedResults = await readExcelFile(file);
      if (parsedResults.length === 0 || parsedResults[0].rows.length === 0) {
        alert("No valid data rows found in the selected Excel file.");
        return;
      }

      const firstSheetResult = parsedResults[0];
      const headerMap = mapHeadersToColumns(
        firstSheetResult.headers,
        activeSheet.columns
      );

      if (headerMap.size === 0) {
        alert(
          `Could not match any headers from "${file.name}" to current columns (${activeSheet.columns
            .map((c) => c.label)
            .join(", ")}).`
        );
        return;
      }

      const rowCellsList = convertRowsToCells(
        firstSheetResult.rows,
        headerMap
      );

      // Create new rows in database and update state
      for (const cells of rowCellsList) {
        const res = await post("/rows", { sheetId: activeSheet.id });
        if (res.ok) {
          const rowData: { id: number } = await res.json();

          // Save cell values
          const cellObj: Record<number, string> = {};
          for (const c of cells) {
            cellObj[c.columnId] = c.value;
            await put("/cells", {
              rowId: rowData.id,
              columnId: c.columnId,
              value: c.value,
            });
          }

          // Append to local state
          setProject((prev) => ({
            ...prev,
            sheets: prev.sheets.map((s) =>
              s.id !== activeSheet.id
                ? s
                : {
                    ...s,
                    rows: [
                      ...s.rows,
                      { id: rowData.id, position: s.rows.length, cells: cellObj },
                    ],
                  }
            ),
          }));
        }
      }

      alert(
        `Successfully imported ${rowCellsList.length} rows from "${file.name}" into "${activeSheet.name}".`
      );
    } catch (err: any) {
      alert(`Error importing Excel file: ${err.message || err}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportCsv = (sheet: Sheet) => {
    const header = sheet.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const lines = sheet.rows.map((r) =>
      sheet.columns
        .map((c) => `"${(r.cells[c.id] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const totals = sheet.columns
      .map((c) =>
        c.type === "currency" || c.type === "number"
          ? String(
              sheet.rows.reduce((a, r) => a + (parseFloat(r.cells[c.id] ?? "0") || 0), 0),
            )
          : "",
      )
      .join(",");
    const csv = [header, ...lines, `"TOTAL",${totals}`].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_${sheet.type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const expenseSheet = project.sheets.find((s) => s.type === "expense");
  const costSheet = project.sheets.find((s) => s.type === "cost_control");
  const activeSheet =
    tab === "expense" ? expenseSheet : tab === "cost" ? costSheet : undefined;
  const rec = computeReconciliation(project);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 py-3">
          <button
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft width={16} /> Projects
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <Building width={18} className="text-amber-600" />
          <span className="font-bold text-slate-900">BuildLedger</span>

          {/* Excel File Menu Actions */}
          <div className="ml-4 flex items-center gap-1.5 border-l border-slate-200 pl-4">
            <button
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              title="Import Excel file (.xlsx, .xls, .csv)"
            >
              📥 {importing ? "Importing…" : "Import Excel"}
            </button>

            {activeSheet && (
              <button
                onClick={() => exportSheetToExcel(activeSheet, project.name)}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                title="Export active sheet to Excel (.xlsx)"
              >
                <Download width={12} /> Export Sheet (.xlsx)
              </button>
            )}

            <button
              onClick={() => exportProjectToExcel(project)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900"
              title="Export full project workbook (all sheets) to Excel (.xlsx)"
            >
              📑 Full Workbook (.xlsx)
            </button>
          </div>

          <span className="ml-auto hidden items-center gap-2 text-xs text-slate-500 md:flex">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                rec.balanced
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {rec.balanced ? <Check width={12} /> : <X width={12} />}
              {rec.balanced ? "Balanced" : "Out of balance"}
            </span>
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-5 flex flex-col">
        {/* Project Header */}
        {editing ? (
          <ProjectEditor
            project={project}
            onSave={(p) => {
              saveProject(p);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{project.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {project.client && <span>👤 {project.client}</span>}
                {project.location && <span>📍 {project.location}</span>}
                {project.startDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar width={12} /> {project.startDate}
                  </span>
                )}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {project.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Contract Budget
                </div>
                <div className="text-base font-bold text-slate-900">
                  {formatCurrency(parseFloat(project.budget ?? "0"))}
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil width={13} /> Edit
              </button>
            </div>
          </div>
        )}

        {/* Content & Main Excel Sheet Workspace Container */}
        <div className="flex-1 flex flex-col min-h-[500px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md">
          {tab === "reconcile" ? (
            <div className="p-4 flex-1 overflow-auto">
              <Reconciliation project={project} />
            </div>
          ) : activeSheet ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <Spreadsheet
                key={activeSheet.id}
                sheet={activeSheet}
                onChangeCell={(rowId, columnId, value) =>
                  changeCell(activeSheet.id, rowId, columnId, value)
                }
                onAddRow={() => addRow(activeSheet.id)}
                onDeleteRow={(rowId) => deleteRow(activeSheet.id, rowId)}
                onAddColumn={() => addColumn(activeSheet.id)}
                onUpdateColumn={(colId, p) => updateColumn(activeSheet.id, colId, p)}
                onDeleteColumn={(colId) => deleteColumn(activeSheet.id, colId)}
                onMoveColumn={(colId, dir) => moveColumn(activeSheet.id, colId, dir)}
              />
            </div>
          ) : null}

          {/* Authentic Excel Bottom Sheet Tab Bar */}
          <div className="border-t-2 border-slate-300 bg-slate-200 flex flex-wrap items-center justify-between px-2 pt-1 select-none">
            {/* Sheet Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {/* Tab 1: Expense Sheet */}
              <button
                type="button"
                onClick={() => setTab("expense")}
                className={`group flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                  tab === "expense"
                    ? "bg-white text-emerald-800 shadow border-t-2 border-emerald-600"
                    : "bg-slate-300/70 text-slate-600 hover:bg-slate-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Balance Sheet &amp; Expenses</span>
                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {expenseSheet?.rows.length ?? 0} rows
                </span>
              </button>

              {/* Tab 2: Cost Control Sheet */}
              <button
                type="button"
                onClick={() => setTab("cost")}
                className={`group flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                  tab === "cost"
                    ? "bg-white text-emerald-800 shadow border-t-2 border-emerald-600"
                    : "bg-slate-300/70 text-slate-600 hover:bg-slate-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span>Cost Control &amp; Payments</span>
                <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {costSheet?.rows.length ?? 0} rows
                </span>
              </button>

              {/* Tab 3: Cross Check Summary */}
              <button
                type="button"
                onClick={() => setTab("reconcile")}
                className={`group flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                  tab === "reconcile"
                    ? "bg-white text-emerald-800 shadow border-t-2 border-emerald-600"
                    : "bg-slate-300/70 text-slate-600 hover:bg-slate-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    rec.balanced ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <span>⚖️ Cross-Check Summary</span>
                {!rec.balanced && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                    Unbalanced
                  </span>
                )}
              </button>

              {/* Excel Add Sheet Icon Button */}
              <button
                type="button"
                onClick={() => addColumn(activeSheet?.id ?? 0)}
                className="flex items-center justify-center h-7 w-7 rounded-t-lg bg-slate-300/50 text-slate-600 hover:bg-slate-300 hover:text-slate-900 transition"
                title="Add Column to active sheet"
              >
                <Plus width={14} />
              </button>
            </div>

            {/* Excel Status Bar (Ready | Row Count | Status) */}
            <div className="hidden sm:flex items-center gap-3 py-1.5 px-3 text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> READY
              </span>
              <span>|</span>
              <span>
                {tab === "reconcile"
                  ? "Cross-Check Report"
                  : `${activeSheet?.rows.length ?? 0} Data Rows`}
              </span>
              <span>|</span>
              <button
                type="button"
                onClick={() => activeSheet && exportCsv(activeSheet)}
                className="hover:underline text-slate-500"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProjectEditor({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (p: Partial<Project>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    client: project.client ?? "",
    location: project.location ?? "",
    budget: project.budget ?? "",
    startDate: project.startDate ?? "",
    status: project.status,
  });
  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600";

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500">Project name</label>
          <input
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Client</label>
          <input
            className={field}
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Location</label>
          <input
            className={field}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Contract budget</label>
          <input
            className={field}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Start date</label>
          <input
            type="date"
            className={field}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Status</label>
          <select
            className={field}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Tendering">Tendering</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
