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
  Menu,
  Pencil,
  Plus,
  Scale,
  Trash,
  Wallet,
  X,
} from "./Icons";

type Tab = number | "reconcile";

export default function Workspace({ initial }: { initial: Project }) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initial);
  const [tab, setTab] = useState<Tab>(initial.sheets[0]?.id ?? "reconcile");
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renamingSheetId, setRenamingSheetId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [openSheetMenuId, setOpenSheetMenuId] = useState<number | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<{ id: number; name: string } | null>(null);
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
      sheets: prev.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        return {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id === colId) {
              return { ...c, ...patchData };
            }
            if (patchData.reconcileRole && c.reconcileRole === patchData.reconcileRole) {
              return { ...c, reconcileRole: null };
            }
            return c;
          }),
        };
      }),
    }));
    patch(`/columns/${colId}`, patchData).catch(() => {});
  };

  const deleteColumn = (sheetId: number, colId: number) => {
    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => {
        if (s.id !== sheetId) return s;
        return {
          ...s,
          columns: s.columns.filter((c) => c.id !== colId),
          rows: s.rows.map((r) => {
            const nextCells = { ...r.cells };
            delete nextCells[colId];
            return { ...r, cells: nextCells };
          }),
        };
      }),
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

  const addSheet = () => {
    const sheetNumber = project.sheets.length + 1;
    const finalName = `Sheet ${sheetNumber}`;

    const tempId = -Math.floor(Math.random() * 1e9);

    const optimisticRows = Array.from({ length: 25 }, (_, i) => ({
      id: tempId - 100 - i,
      position: i,
      cells: {},
    }));

    const optimisticSheet: Sheet = {
      id: tempId,
      projectId: project.id,
      name: finalName,
      type: "expense",
      position: project.sheets.length,
      columns: [
        { id: tempId - 1, sheetId: tempId, label: "Date", type: "date", width: 140, position: 0 },
        { id: tempId - 2, sheetId: tempId, label: "Cost Code", type: "text", reconcileRole: "reconcile_key", width: 130, position: 1 },
        { id: tempId - 3, sheetId: tempId, label: "Category", type: "select", options: ["Materials", "Labour", "Subcontractor", "Plant & Equipment", "Preliminaries", "Provisional Sum", "Other"], width: 170, position: 2 },
        { id: tempId - 4, sheetId: tempId, label: "Description", type: "text", width: 240, position: 3 },
        { id: tempId - 5, sheetId: tempId, label: "Supplier", type: "text", width: 180, position: 4 },
        { id: tempId - 6, sheetId: tempId, label: "Amount", type: "currency", reconcileRole: "expense_amount", width: 150, position: 5 },
        { id: tempId - 7, sheetId: tempId, label: "Status", type: "select", options: ["Paid", "Unpaid", "Pending"], width: 120, position: 6 },
        { id: tempId - 8, sheetId: tempId, label: "Notes", type: "text", width: 200, position: 7 },
      ],
      rows: optimisticRows,
    };

    setProject((prev) => ({
      ...prev,
      sheets: [...prev.sheets, optimisticSheet],
    }));
    setTab(tempId);

    post("/sheets", { name: finalName, type: "expense" })
      .then((res) => res.json())
      .then((data: Sheet) => {
        setProject((prev) => ({
          ...prev,
          sheets: prev.sheets.map((s) => (s.id === tempId ? data : s)),
        }));
        setTab(data.id);
      })
      .catch((err) => {
        console.error("Failed to create sheet:", err);
      });
  };

  const startRenameSheet = (sheetId: number, currentName: string) => {
    setRenamingSheetId(sheetId);
    setRenameDraft(currentName);
    setOpenSheetMenuId(null);
  };

  const commitRenameSheet = (sheetId: number) => {
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      setRenamingSheetId(null);
      return;
    }

    setProject((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => (s.id === sheetId ? { ...s, name: trimmed } : s)),
    }));
    setRenamingSheetId(null);
    patch(`/sheets/${sheetId}`, { name: trimmed }).catch(() => {});
  };

  const cancelRenameSheet = () => {
    setRenamingSheetId(null);
  };

  const requestDeleteSheet = (sheetId: number, sheetName: string) => {
    setOpenSheetMenuId(null);
    if (project.sheets.length <= 1) {
      alert("A project must have at least one sheet.");
      return;
    }
    setSheetToDelete({ id: sheetId, name: sheetName });
  };

  const executeDeleteSheet = () => {
    if (!sheetToDelete) return;
    const { id: sheetId } = sheetToDelete;

    const nextSheets = project.sheets.filter((s) => s.id !== sheetId);
    setProject((prev) => ({
      ...prev,
      sheets: nextSheets,
    }));
    if (tab === sheetId) {
      setTab(nextSheets[0]?.id ?? "reconcile");
    }
    setSheetToDelete(null);
    del(`/sheets/${sheetId}`).catch(() => {});
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

  const activeSheet =
    typeof tab === "number"
      ? project.sheets.find((s) => s.id === tab) ?? project.sheets[0]
      : undefined;
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
            {/* Dynamic Sheet Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {project.sheets.map((sheet, index) => {
                const isActive = tab === sheet.id;
                const isRenaming = renamingSheetId === sheet.id;
                const isMenuOpen = openSheetMenuId === sheet.id;
                const dotColors = [
                  "bg-emerald-500",
                  "bg-sky-500",
                  "bg-amber-500",
                  "bg-violet-500",
                  "bg-rose-500",
                  "bg-indigo-500",
                  "bg-teal-500",
                ];
                const dotColor = dotColors[index % dotColors.length];

                return (
                  <div
                    key={sheet.id}
                    className="relative flex items-center"
                  >
                    <div
                      onClick={() => setTab(sheet.id)}
                      onDoubleClick={() => startRenameSheet(sheet.id, sheet.name)}
                      className={`group flex items-center gap-1.5 rounded-t-lg pl-3 pr-2 py-1.5 text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? "bg-white text-emerald-800 shadow border-t-2 border-emerald-600"
                          : "bg-slate-300/70 text-slate-600 hover:bg-slate-300 hover:text-slate-800"
                      }`}
                      title={`${sheet.name} (Double-click to rename)`}
                    >
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />

                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRenameSheet(sheet.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRenameSheet(sheet.id);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRenameSheet();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 w-32 rounded border border-emerald-600 bg-white px-1.5 text-xs font-bold text-slate-800 outline-none shadow-inner"
                        />
                      ) : (
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">
                          {sheet.name}
                        </span>
                      )}

                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {sheet.rows.length}
                      </span>

                      {/* Tab Options Menu Button (⋯) */}
                      {!isRenaming && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSheetMenuId(isMenuOpen ? null : sheet.id);
                          }}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition"
                          title="Sheet options"
                        >
                          <Menu width={12} />
                        </button>
                      )}
                    </div>

                    {/* Sheet Context Menu Popup */}
                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={() => setOpenSheetMenuId(null)}
                        />
                        <div
                          className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl text-xs text-slate-700 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => startRenameSheet(sheet.id, sheet.name)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Pencil width={13} className="text-slate-500" />
                            <span>Rename Sheet</span>
                          </button>

                          {project.sheets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => requestDeleteSheet(sheet.id, sheet.name)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash width={13} className="text-rose-500" />
                              <span>Delete Sheet</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Tab: Cross Check Summary */}
              <button
                type="button"
                onClick={() => setTab("reconcile")}
                className={`group flex items-center gap-2 rounded-t-lg px-3.5 py-2 text-xs font-bold transition ${
                  tab === "reconcile"
                    ? "bg-white text-emerald-800 shadow border-t-2 border-emerald-600"
                    : "bg-slate-300/70 text-slate-600 hover:bg-slate-300 hover:text-slate-800"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    rec.balanced ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <span>⚖️ Cross-Check</span>
                {!rec.balanced && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                    Unbalanced
                  </span>
                )}
              </button>

              {/* Excel Add Sheet Button (+) */}
              <button
                type="button"
                onClick={addSheet}
                className="flex items-center justify-center h-7 w-7 rounded-t-lg bg-slate-300/60 text-slate-700 hover:bg-emerald-700 hover:text-white transition shadow-2xs ml-1"
                title="Add New Sheet (+)"
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

      {/* Delete Sheet Confirmation Modal */}
      {sheetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash width={18} />
                <h3 className="font-bold text-slate-900 text-sm">Delete Sheet</h3>
              </div>
              <button
                type="button"
                onClick={() => setSheetToDelete(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X width={14} />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">&ldquo;{sheetToDelete.name}&rdquo;</strong> and all of its columns, rows, and data? This action cannot be undone.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSheetToDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteSheet}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs"
              >
                Delete Sheet
              </button>
            </div>
          </div>
        </div>
      )}
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
