"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Column, Sheet, SheetRow, SheetType } from "@/lib/types";
import { COLUMN_TYPES, RECONCILE_ROLES } from "@/lib/types";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/finance";
import { evaluateFormula } from "@/lib/formula-engine";
import { ChevronLeft, ChevronRight, Menu, Plus, Trash, X } from "./Icons";

interface Props {
  sheet: Sheet;
  onChangeCell: (rowId: number, columnId: number, value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: number) => void;
  onAddColumn: () => void;
  onUpdateColumn: (colId: number, patch: Partial<Column>) => void;
  onDeleteColumn: (colId: number) => void;
  onMoveColumn: (colId: number, direction: -1 | 1) => void;
}

function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function displayValue(col: Column, rawVal: string, rows: SheetRow[], cols: Column[]): string {
  if (rawVal === undefined || rawVal === null || rawVal === "") return "";
  const evaluated = evaluateFormula(rawVal, rows, cols);
  if (col.type === "currency") return formatCurrency(parseNumber(evaluated));
  if (col.type === "number") return formatNumber(parseNumber(evaluated));
  if (col.type === "date") return formatDate(evaluated);
  return evaluated;
}

const ROLE_COLOR: Record<string, string> = {
  expense_amount: "bg-sky-500",
  cost_actual: "bg-violet-500",
  cost_budget: "bg-amber-500",
  cost_paid: "bg-emerald-500",
  reconcile_key: "bg-slate-700",
};

export default function Spreadsheet({
  sheet,
  onChangeCell,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onMoveColumn,
}: Props) {
  const cols = sheet.columns;
  const rows = sheet.rows;
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState("");
  const activeInputId = useId();
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const cellValue = (r: number, c: number) => rows[r]?.cells[cols[c]?.id] ?? "";

  useEffect(() => {
    if (!selected) return;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(activeInputId);
      if (!el) return;

      el.focus();
      if (el instanceof HTMLInputElement && el.type === "text") el.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [activeInputId, selected]);

  function commit() {
    if (!selected) return;
    const row = rows[selected.r];
    const col = cols[selected.c];
    if (!row || !col) return;
    if (cellValue(selected.r, selected.c) !== draft) {
      onChangeCell(row.id, col.id, draft);
    }
  }

  function beginEdit(r: number, c: number) {
    setSelected({ r, c });
    setDraft(cellValue(r, c));
  }

  function move(dr: number, dc: number) {
    if (!selected) return;
    const r = Math.min(Math.max(selected.r + dr, 0), rows.length - 1);
    const c = Math.min(Math.max(selected.c + dc, 0), cols.length - 1);
    setSelected({ r, c });
    setDraft(cellValue(r, c));
  }

  function handleSelect(r: number, c: number) {
    commit();
    beginEdit(r, c);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      move(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit();
      move(0, e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(cellValue(selected!.r, selected!.c));
      setSelected(null);
    }
  }

  function onCommitImmediate(value: string) {
    if (!selected) return;
    setDraft(value);
    const row = rows[selected.r];
    const col = cols[selected.c];
    if (row && col && cellValue(selected.r, selected.c) !== value) {
      onChangeCell(row.id, col.id, value);
    }
  }

  const totals: (number | null)[] = cols.map((col) => {
    if (col.type !== "currency" && col.type !== "number") return null;
    return rows.reduce((acc, r) => {
      const rawVal = r.cells[col.id];
      const evaluated = evaluateFormula(rawVal, rows, cols);
      return acc + parseNumber(evaluated);
    }, 0);
  });

  // Calculate cell reference e.g. A1, B3
  const cellRef = selected
    ? `${String.fromCharCode(65 + Math.min(selected.c, 25))}${selected.r + 1}`
    : "A1";

  // Scroll Helpers
  function scrollGrid(leftDelta: number, topDelta: number) {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollBy({
        left: leftDelta,
        top: topDelta,
        behavior: "smooth",
      });
    }
  }

  function renderCell(col: Column, r: number, c: number) {
    const isSel = selected && selected.r === r && selected.c === c;
    const value = cellValue(r, c);
    const numeric = col.type === "currency" || col.type === "number";

    if (isSel) {
      const common = {
        id: activeInputId,
        value: draft,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
          setDraft(e.target.value),
        onBlur: commit,
        onKeyDown: onInputKeyDown,
        className:
          "w-full h-full bg-white px-2 py-1.5 outline-none ring-2 ring-emerald-600 text-sm font-medium",
      };

      if (col.type === "select") {
        return (
          <select {...common} className={common.className + " rounded-none"}>
            <option value="">—</option>
            {(col.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      }
      if (col.type === "date") {
        return <input {...common} type="date" />;
      }
      return (
        <input
          {...common}
          type="text"
          inputMode={numeric ? "decimal" : "text"}
          className={common.className + (numeric ? " text-right" : "")}
        />
      );
    }

    return (
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelect(r, c);
        }}
        className={`block h-full w-full px-2 py-1.5 text-left text-sm ${
          numeric ? "text-right tabular-nums" : ""
        } ${col.type === "currency" ? "text-slate-900 font-semibold" : "text-slate-700"}`}
      >
        {displayValue(col, value, rows, cols) || <span className="text-slate-300">·</span>}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Excel Ribbon & Action Bar */}
      <div className="border-b border-slate-200 bg-slate-100">
        {/* Ribbon Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <span>📊 EXCEL</span>
            </span>
            <span className="text-xs font-bold text-slate-800">{sheet.name}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200">
              {sheet.type === "expense" ? "Expenses Ledger" : "Cost & Payments"}
            </span>
          </div>

          {/* Side & Bottom Scroll Navigation Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 px-1">Scroll:</span>
            <button
              type="button"
              onClick={() => scrollGrid(-250, 0)}
              className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50"
              title="Scroll Left"
            >
              ◀ Left
            </button>
            <button
              type="button"
              onClick={() => scrollGrid(250, 0)}
              className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50"
              title="Scroll Right"
            >
              Right ▶
            </button>
            <button
              type="button"
              onClick={() => scrollGrid(0, -250)}
              className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50"
              title="Scroll Up"
            >
              ▲ Up
            </button>
            <button
              type="button"
              onClick={() => scrollGrid(0, 250)}
              className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50"
              title="Scroll Down"
            >
              Down ▼
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onAddRow}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800"
              title="Add a new row to grid"
            >
              <Plus width={13} /> Add Row
            </button>

            <button
              onClick={onAddColumn}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Add a new column to grid"
            >
              <Plus width={13} /> Add Column
            </button>
          </div>
        </div>

        {/* Excel Formula Bar (fx) */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-xs">
          {/* Name Box (e.g. A1, B3) */}
          <div className="flex h-7 w-12 items-center justify-center rounded border border-slate-300 bg-white font-mono text-xs font-bold text-slate-700 shadow-inner select-none">
            {cellRef}
          </div>
          <div className="h-4 w-px bg-slate-300" />
          {/* fx Icon */}
          <div className="font-serif font-bold italic text-slate-500 select-none">fx</div>
          {/* Formula / Cell Content Input */}
          <input
            type="text"
            className="flex-1 h-7 rounded border border-slate-300 bg-white px-2 text-xs font-mono text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            placeholder={selected ? "e.g. =B1+B2 or =SUM(A1:A5)" : "Select a cell to edit formula"}
            value={selected ? draft : ""}
            onChange={(e) => {
              if (selected) {
                setDraft(e.target.value);
                onCommitImmediate(e.target.value);
              }
            }}
            disabled={!selected}
          />
        </div>
      </div>

      {/* Excel Spreadsheet Grid with Sticky Headers & Both Side/Bottom Scrollbars */}
      <div
        ref={gridContainerRef}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-100"
      >
        <table className="border-collapse table-fixed" style={{ minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: 46 }} />
            {cols.map((c) => (
              <col key={c.id} style={{ width: c.width }} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>

          {/* Sticky Header Row */}
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
            <tr className="border-b border-slate-300 text-left text-xs font-semibold text-slate-600">
              {/* Sticky Top-Left Corner Cell (#) */}
              <th className="sticky left-0 top-0 z-30 border-r border-slate-300 bg-slate-200 p-0 text-center font-mono text-[11px] text-slate-500 shadow-sm select-none">
                #
              </th>
              {cols.map((c, idx) => (
                <th
                  key={c.id}
                  className="group relative border-r border-slate-300 bg-slate-100 p-0 hover:bg-slate-200"
                >
                  <ColumnHeader
                    col={c}
                    colIndex={idx}
                    sheetType={sheet.type}
                    onUpdate={(patch) => onUpdateColumn(c.id, patch)}
                    onDelete={() => onDeleteColumn(c.id)}
                    onMove={(dir) => onMoveColumn(c.id, dir)}
                  />
                </th>
              ))}
              <th className="bg-slate-100 p-0" />
            </tr>
          </thead>

          <tbody>
            {rows.map((r, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              return (
                <tr
                  key={r.id}
                  className={`group border-b border-slate-200 transition-colors ${
                    isEven ? "bg-white" : "bg-slate-50/50"
                  } hover:bg-emerald-50/40`}
                >
                  {/* Sticky Row Index Column (Leftmost Column) */}
                  <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-100 text-center font-mono text-[11px] font-medium text-slate-400 select-none shadow-sm">
                    {rowIdx + 1}
                  </td>
                  {cols.map((c, colIdx) => (
                    <td
                      key={c.id}
                      className={`border-r border-slate-200 p-0 ${
                        selected?.r === rowIdx && selected?.c === colIdx
                          ? "ring-2 ring-emerald-600 z-10"
                          : ""
                      }`}
                    >
                      {renderCell(c, rowIdx, colIdx)}
                    </td>
                  ))}
                  <td className="p-0 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteRow(r.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Delete row"
                    >
                      <Trash width={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="sticky bottom-0 z-10 border-t-2 border-slate-800 bg-slate-100 font-semibold text-slate-900 shadow-inner">
              <td className="sticky left-0 z-20 border-r border-slate-300 bg-slate-200 text-center font-mono text-[10px] uppercase text-slate-500">
                ∑
              </td>
              {cols.map((col, idx) => {
                const total = totals[idx];
                return (
                  <td
                    key={col.id}
                    className="border-r border-slate-300 px-2 py-2 text-right text-xs tabular-nums font-bold text-slate-900 bg-slate-100"
                  >
                    {total !== null ? (
                      col.type === "currency" ? (
                        formatCurrency(total)
                      ) : (
                        formatNumber(total)
                      )
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="bg-slate-100" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ColumnHeader({
  col,
  colIndex,
  sheetType,
  onUpdate,
  onDelete,
  onMove,
}: {
  col: Column;
  colIndex: number;
  sheetType: SheetType;
  onUpdate: (patch: Partial<Column>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const colLetter = String.fromCharCode(65 + Math.min(colIndex, 25));

  return (
    <div className="flex h-full w-full items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-700">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
          {colLetter}
        </span>
        <span className="truncate">{col.label}</span>
        {col.reconcileRole && (
          <span
            className={`h-2 w-2 rounded-full ${ROLE_COLOR[col.reconcileRole] ?? "bg-amber-500"}`}
            title={`Role: ${col.reconcileRole}`}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
      >
        <Menu width={12} />
      </button>

      {open && (
        <ColumnMenu
          col={col}
          sheetType={sheetType}
          onClose={() => setOpen(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onMove={onMove}
        />
      )}
    </div>
  );
}

function ColumnMenu({
  col,
  sheetType,
  onClose,
  onUpdate,
  onDelete,
  onMove,
}: {
  col: Column;
  sheetType: SheetType;
  onClose: () => void;
  onUpdate: (patch: Partial<Column>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [label, setLabel] = useState(col.label);
  const [type, setType] = useState(col.type);
  const [optionsStr, setOptionsStr] = useState((col.options ?? []).join(", "));
  const [role, setRole] = useState(col.reconcileRole ?? "");

  const roles = RECONCILE_ROLES[sheetType] ?? [];

  function save() {
    const patchData: Partial<Column> = {
      label: label.trim() || col.label,
      type,
      options:
        type === "select"
          ? optionsStr
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
      reconcileRole: (role || null) as Column["reconcileRole"],
    };
    onUpdate(patchData);
    onClose();
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-slate-800 font-normal">
      <div className="mb-2 flex items-center justify-between border-b pb-1">
        <span className="text-xs font-bold text-slate-800">Edit Column Settings</span>
        <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
          <X width={12} />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">Column Label</label>
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">Data Type</label>
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            {COLUMN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>

        {type === "select" && (
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-500">
              Dropdown Options (comma-separated)
            </label>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600"
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">
            Reconciliation Matching Role
          </label>
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex gap-1">
            <button
              onClick={() => {
                onMove(-1);
                onClose();
              }}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
              title="Move Left"
            >
              <ChevronLeft width={12} />
            </button>
            <button
              onClick={() => {
                onMove(1);
                onClose();
              }}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
              title="Move Right"
            >
              <ChevronRight width={12} />
            </button>
          </div>

          <button
            onClick={() => {
              if (confirm("Delete this column?")) {
                onDelete();
                onClose();
              }
            }}
            className="rounded px-2 py-0.5 text-rose-600 hover:bg-rose-50 font-semibold"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
