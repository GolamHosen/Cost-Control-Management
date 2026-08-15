"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Column, Sheet, SheetRow, SheetType } from "@/lib/types";
import { COLUMN_TYPES, RECONCILE_ROLES } from "@/lib/types";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/finance";
import { evaluateFormula } from "@/lib/formula-engine";
import { ChevronLeft, ChevronRight, Menu, PaintBucket, Plus, Trash, X } from "./Icons";

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

export interface SelectionRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface CellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
}

export const TEXT_COLORS = [
  { name: "Default Black", value: "#0f172a", bg: "#0f172a" },
  { name: "Dark Slate", value: "#475569", bg: "#475569" },
  { name: "Ruby Red", value: "#dc2626", bg: "#dc2626" },
  { name: "Emerald Green", value: "#16a34a", bg: "#16a34a" },
  { name: "Royal Blue", value: "#2563eb", bg: "#2563eb" },
  { name: "Purple", value: "#9333ea", bg: "#9333ea" },
  { name: "Amber / Gold", value: "#d97706", bg: "#d97706" },
  { name: "Orange", value: "#ea580c", bg: "#ea580c" },
  { name: "Rose", value: "#e11d48", bg: "#e11d48" },
  { name: "White", value: "#ffffff", bg: "#ffffff" },
];

export const FILL_COLORS = [
  { name: "Light Yellow", value: "#fef9c3" },
  { name: "Light Green", value: "#dcfce7" },
  { name: "Light Blue", value: "#e0f2fe" },
  { name: "Light Rose", value: "#ffe4e6" },
  { name: "Light Orange", value: "#ffedd5" },
  { name: "Light Purple", value: "#f3e8ff" },
  { name: "Light Gray", value: "#f1f5f9" },
  { name: "Vivid Yellow", value: "#fef08a" },
  { name: "Vivid Green", value: "#bbf7d0" },
  { name: "Vivid Blue", value: "#bae6fd" },
  { name: "Vivid Rose", value: "#fecdd3" },
  { name: "Vivid Purple", value: "#e9d5ff" },
];

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

const FONT_FAMILIES = [
  { name: "Calibri (Excel Default)", value: "Calibri, Carlito, 'Segoe UI', sans-serif" },
  { name: "Aptos (Microsoft 365)", value: "Aptos, 'Segoe UI', sans-serif" },
  { name: "Segoe UI", value: "'Segoe UI', -apple-system, sans-serif" },
  { name: "Arial", value: "Arial, Helvetica, sans-serif" },
  { name: "Inter", value: "Inter, -apple-system, sans-serif" },
  { name: "Roboto", value: "Roboto, sans-serif" },
  { name: "Consolas (Finance Monospace)", value: "Consolas, 'Courier New', monospace" },
  { name: "Courier New", value: "'Courier New', Courier, monospace" },
  { name: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { name: "Georgia", value: "Georgia, serif" },
  { name: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { name: "Verdana", value: "Verdana, sans-serif" },
];

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

  // --- Selection & Drag Selection State ---
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dragMode, setDragMode] = useState<"cells" | "rows" | "cols" | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState("");
  const activeInputId = useId();
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // --- Per-Cell & Range Formatting Styles State ---
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`buildledger_cell_styles_${sheet.id}`);
        if (saved) return JSON.parse(saved);
      } catch (err) {}
    }
    return {};
  });

  // Save cell styles to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`buildledger_cell_styles_${sheet.id}`, JSON.stringify(cellStyles));
      } catch (err) {}
    }
  }, [cellStyles, sheet.id]);

  // Color Dropdown Popups State
  const [openTextColor, setOpenTextColor] = useState(false);
  const [openFillColor, setOpenFillColor] = useState(false);

  // --- Default Font Family, Font Size & Typography State ---
  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("buildledger_font_family") || "Calibri, Carlito, 'Segoe UI', sans-serif";
    }
    return "Calibri, Carlito, 'Segoe UI', sans-serif";
  });

  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = Number(localStorage.getItem("buildledger_font_size"));
      return saved >= 8 && saved <= 48 ? saved : 13;
    }
    return 13;
  });

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | null>(null);

  // Save font preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("buildledger_font_family", fontFamily);
      localStorage.setItem("buildledger_font_size", String(fontSize));
    }
  }, [fontFamily, fontSize]);

  // --- Flexible Column Width Resizing State & Cache ---
  const [localColWidths, setLocalColWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<{
    id: number;
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);

  // --- Row Index (#) Column Width State ---
  const [indexColWidth, setIndexColWidth] = useState(54);
  const [resizingIndexCol, setResizingIndexCol] = useState<{
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);

  // --- Flexible Row Height Resizing State ---
  const [baseRowHeight, setBaseRowHeight] = useState(36);
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [resizingRow, setResizingRow] = useState<{
    id: number;
    startY: number;
    startHeight: number;
    currentHeight: number;
  } | null>(null);

  // Sync columns with local width cache
  useEffect(() => {
    const map: Record<number, number> = {};
    for (const c of cols) {
      map[c.id] = c.width || 180;
    }
    setLocalColWidths(map);
  }, [cols]);

  // If a sheet has no rows, automatically add initial rows so the canvas is full
  useEffect(() => {
    if (rows.length === 0) {
      onAddRow();
    }
  }, [rows.length, onAddRow]);

  const cellValue = (r: number, c: number) => rows[r]?.cells[cols[c]?.id] ?? "";

  // Active Range Normalizer
  const activeRange: SelectionRange | null = useMemo(() => {
    if (selectionRange) {
      return {
        r1: Math.min(selectionRange.r1, selectionRange.r2),
        c1: Math.min(selectionRange.c1, selectionRange.c2),
        r2: Math.max(selectionRange.r1, selectionRange.r2),
        c2: Math.max(selectionRange.c1, selectionRange.c2),
      };
    }
    if (selected) {
      return { r1: selected.r, c1: selected.c, r2: selected.r, c2: selected.c };
    }
    return null;
  }, [selectionRange, selected]);

  function isInRange(r: number, c: number) {
    if (!activeRange) return false;
    return (
      r >= activeRange.r1 &&
      r <= activeRange.r2 &&
      c >= activeRange.c1 &&
      c <= activeRange.c2
    );
  }

  function isRowInRange(r: number) {
    if (!activeRange) return false;
    return r >= activeRange.r1 && r <= activeRange.r2;
  }

  function isColInRange(c: number) {
    if (!activeRange) return false;
    return c >= activeRange.c1 && c <= activeRange.c2;
  }

  // End dragging globally on window mouseup
  useEffect(() => {
    function handleGlobalMouseUp() {
      if (dragMode) {
        setDragMode(null);
      }
    }
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [dragMode]);

  // Clear all cells in the selected range
  const clearSelectedRange = useCallback(() => {
    if (!activeRange) return;
    for (let rIdx = activeRange.r1; rIdx <= activeRange.r2; rIdx++) {
      const row = rows[rIdx];
      if (!row) continue;
      for (let cIdx = activeRange.c1; cIdx <= activeRange.c2; cIdx++) {
        const col = cols[cIdx];
        if (!col) continue;
        if (cellValue(rIdx, cIdx) !== "") {
          onChangeCell(row.id, col.id, "");
        }
      }
    }
    setDraft("");
  }, [activeRange, rows, cols, onChangeCell]);

  // Select all cells in spreadsheet
  const handleSelectAll = useCallback(() => {
    if (rows.length === 0 || cols.length === 0) return;
    commit();
    setIsEditing(false);
    setSelected({ r: 0, c: 0 });
    setDraft(cellValue(0, 0));
    setSelectionRange({
      r1: 0,
      c1: 0,
      r2: rows.length - 1,
      c2: cols.length - 1,
    });
  }, [rows, cols]);

  // Global keydown handler for Delete / Backspace / Ctrl+A
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && activeRange) {
        e.preventDefault();
        clearSelectedRange();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRange, handleSelectAll, clearSelectedRange]);

  // Row header mouse click & drag
  function handleRowHeaderMouseDown(e: React.MouseEvent, rowIdx: number) {
    if (resizingRow) return;
    e.preventDefault();
    commit();
    setIsEditing(false);

    if (e.shiftKey && selected) {
      setSelectionRange({
        r1: selected.r,
        c1: 0,
        r2: rowIdx,
        c2: Math.max(0, cols.length - 1),
      });
    } else {
      setSelected({ r: rowIdx, c: 0 });
      setDraft(cellValue(rowIdx, 0));
      setSelectionRange({
        r1: rowIdx,
        c1: 0,
        r2: rowIdx,
        c2: Math.max(0, cols.length - 1),
      });
      setDragAnchor({ r: rowIdx, c: 0 });
      setDragMode("rows");
    }
  }

  function handleRowHeaderMouseEnter(rowIdx: number) {
    if (dragMode === "rows" && dragAnchor) {
      setSelectionRange({
        r1: dragAnchor.r,
        c1: 0,
        r2: rowIdx,
        c2: Math.max(0, cols.length - 1),
      });
    }
  }

  // Column header mouse click & drag
  function handleColumnHeaderMouseDown(e: React.MouseEvent, colIdx: number) {
    if (resizingCol) return;
    e.preventDefault();
    commit();
    setIsEditing(false);

    if (e.shiftKey && selected) {
      setSelectionRange({
        r1: 0,
        c1: selected.c,
        r2: Math.max(0, rows.length - 1),
        c2: colIdx,
      });
    } else {
      setSelected({ r: 0, c: colIdx });
      setDraft(cellValue(0, colIdx));
      setSelectionRange({
        r1: 0,
        c1: colIdx,
        r2: Math.max(0, rows.length - 1),
        c2: colIdx,
      });
      setDragAnchor({ r: 0, c: colIdx });
      setDragMode("cols");
    }
  }

  function handleColumnHeaderMouseEnter(colIdx: number) {
    if (dragMode === "cols" && dragAnchor) {
      setSelectionRange({
        r1: 0,
        c1: dragAnchor.c,
        r2: Math.max(0, rows.length - 1),
        c2: colIdx,
      });
    }
  }

  // Cell mouse click & drag
  function handleCellMouseDown(e: React.MouseEvent, r: number, c: number) {
    if (isEditing && selected?.r === r && selected?.c === c) {
      return;
    }

    commit();

    if (e.shiftKey && selected) {
      e.preventDefault();
      setIsEditing(false);
      setSelectionRange({
        r1: selected.r,
        c1: selected.c,
        r2: r,
        c2: c,
      });
    } else {
      e.preventDefault();
      setIsEditing(false);
      setSelected({ r, c });
      setDraft(cellValue(r, c));
      setSelectionRange({ r1: r, c1: c, r2: r, c2: c });
      setDragAnchor({ r, c });
      setDragMode("cells");
    }
  }

  function handleCellMouseEnter(r: number, c: number) {
    if (dragMode === "cells" && dragAnchor) {
      setSelectionRange({
        r1: dragAnchor.r,
        c1: dragAnchor.c,
        r2: r,
        c2: c,
      });
    }
  }

  function handleCellDoubleClick(r: number, c: number) {
    commit();
    setSelected({ r, c });
    setDraft(cellValue(r, c));
    setSelectionRange({ r1: r, c1: c, r2: r, c2: c });
    setIsEditing(true);
  }

  // Column Width Mouse Drag Handler
  function startColumnResize(e: React.MouseEvent, colId: number, currentWidth: number) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = localColWidths[colId] ?? currentWidth ?? 180;
    setResizingCol({ id: colId, startX, startWidth, currentWidth: startWidth });

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, Math.min(800, Math.round(startWidth + delta)));
      setLocalColWidths((prev) => ({ ...prev, [colId]: newWidth }));
      setResizingCol((prev) => (prev ? { ...prev, currentWidth: newWidth } : null));
    };

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const delta = ev.clientX - startX;
      const finalWidth = Math.max(60, Math.min(800, Math.round(startWidth + delta)));
      setResizingCol(null);
      onUpdateColumn(colId, { width: finalWidth });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  // Row Index Column (#) Width Mouse Drag Handler
  function startIndexColResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = indexColWidth;
    setResizingIndexCol({ startX, startWidth, currentWidth: startWidth });

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(40, Math.min(160, Math.round(startWidth + delta)));
      setIndexColWidth(newWidth);
      setResizingIndexCol((prev) => (prev ? { ...prev, currentWidth: newWidth } : null));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingIndexCol(null);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  // Row Height Mouse Drag Handler
  function startRowResize(e: React.MouseEvent, rowId: number, currentHeight: number) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = rowHeights[rowId] ?? baseRowHeight;
    setResizingRow({ id: rowId, startY, startHeight, currentHeight: startHeight });

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newHeight = Math.max(26, Math.min(300, Math.round(startHeight + delta)));
      setRowHeights((prev) => ({ ...prev, [rowId]: newHeight }));
      setResizingRow((prev) => (prev ? { ...prev, currentHeight: newHeight } : null));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingRow(null);
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  useEffect(() => {
    if (!selected || !isEditing) return;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(activeInputId);
      if (!el) return;

      el.focus();
      if (el instanceof HTMLInputElement && el.type === "text") el.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [activeInputId, selected, isEditing]);

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
    setSelectionRange({ r1: r, c1: c, r2: r, c2: c });
    setIsEditing(true);
  }

  function move(dr: number, dc: number, isShift = false) {
    if (!selected) return;
    const targetR = Math.min(Math.max(selected.r + dr, 0), rows.length - 1);
    const targetC = Math.min(Math.max(selected.c + dc, 0), cols.length - 1);

    if (isShift) {
      const anchor = dragAnchor || selected;
      setSelectionRange({
        r1: anchor.r,
        c1: anchor.c,
        r2: targetR,
        c2: targetC,
      });
      setSelected({ r: targetR, c: targetC });
    } else {
      setSelected({ r: targetR, c: targetC });
      setDraft(cellValue(targetR, targetC));
      setSelectionRange({
        r1: targetR,
        c1: targetC,
        r2: targetR,
        c2: targetC,
      });
      setDragAnchor({ r: targetR, c: targetC });
    }
  }

  // Active cell style resolution for ribbon
  const activeCellKey =
    selected && rows[selected.r] && cols[selected.c]
      ? `${rows[selected.r].id}_${cols[selected.c].id}`
      : null;

  const currentCellStyle = activeCellKey ? cellStyles[activeCellKey] || {} : {};
  const currentFontFamily = currentCellStyle.fontFamily || fontFamily;
  const currentFontSize = currentCellStyle.fontSize || fontSize;
  const currentBold = currentCellStyle.bold !== undefined ? currentCellStyle.bold : isBold;
  const currentItalic = currentCellStyle.italic !== undefined ? currentCellStyle.italic : isItalic;
  const currentUnderline = currentCellStyle.underline !== undefined ? currentCellStyle.underline : isUnderline;
  const currentColor = currentCellStyle.color || "#0f172a";
  const currentBgColor = currentCellStyle.bgColor || "";
  const currentAlign = currentCellStyle.align || textAlign;

  // Apply formatting specifically to selected range / row / col / sheet
  function applyFormatToSelection(patch: Partial<CellStyle>) {
    if (!activeRange) return;

    setCellStyles((prev) => {
      const next = { ...prev };
      for (let r = activeRange.r1; r <= activeRange.r2; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = activeRange.c1; c <= activeRange.c2; c++) {
          const col = cols[c];
          if (!col) continue;
          const key = `${row.id}_${col.id}`;
          const current = next[key] || {};
          const updated = { ...current, ...patch };
          Object.keys(patch).forEach((k) => {
            if ((patch as Record<string, unknown>)[k] === undefined) {
              delete (updated as Record<string, unknown>)[k];
            }
          });
          if (Object.keys(updated).length === 0) {
            delete next[key];
          } else {
            next[key] = updated;
          }
        }
      }
      return next;
    });

    if (patch.fontFamily) setFontFamily(patch.fontFamily);
    if (patch.fontSize) setFontSize(patch.fontSize);
  }

  // Clear all custom formatting on active selection
  function clearFormatsOnSelection() {
    if (!activeRange) return;
    setCellStyles((prev) => {
      const next = { ...prev };
      for (let r = activeRange.r1; r <= activeRange.r2; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = activeRange.c1; c <= activeRange.c2; c++) {
          const col = cols[c];
          if (!col) continue;
          delete next[`${row.id}_${col.id}`];
        }
      }
      return next;
    });
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        applyFormatToSelection({ bold: !currentBold });
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        applyFormatToSelection({ italic: !currentItalic });
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        applyFormatToSelection({ underline: !currentUnderline });
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      setIsEditing(false);
      move(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit();
      setIsEditing(false);
      move(0, e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(cellValue(selected!.r, selected!.c));
      setIsEditing(false);
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

  // Calculate cell reference / range e.g. A1, B3, A1:C5, B:B, 3:5
  const cellRef = useMemo(() => {
    if (!activeRange) return "A1";
    const isSingleCell =
      activeRange.r1 === activeRange.r2 && activeRange.c1 === activeRange.c2;
    if (isSingleCell) {
      const colLetter = String.fromCharCode(65 + Math.min(activeRange.c1, 25));
      return `${colLetter}${activeRange.r1 + 1}`;
    }

    const isFullCols =
      activeRange.r1 === 0 && activeRange.r2 === Math.max(0, rows.length - 1);
    const isFullRows =
      activeRange.c1 === 0 && activeRange.c2 === Math.max(0, cols.length - 1);

    const c1Letter = String.fromCharCode(65 + Math.min(activeRange.c1, 25));
    const c2Letter = String.fromCharCode(65 + Math.min(activeRange.c2, 25));

    if (isFullCols && !isFullRows) {
      return `${c1Letter}:${c2Letter}`;
    }
    if (isFullRows && !isFullCols) {
      return `${activeRange.r1 + 1}:${activeRange.r2 + 1}`;
    }

    return `${c1Letter}${activeRange.r1 + 1}:${c2Letter}${activeRange.r2 + 1}`;
  }, [activeRange, rows.length, cols.length]);

  function renderCell(col: Column, r: number, c: number) {
    const isAnchor = selected?.r === r && selected?.c === c;
    const inRange = isInRange(r, c);
    const value = cellValue(r, c);
    const numeric = col.type === "currency" || col.type === "number";

    const row = rows[r];
    const cellKey = row ? `${row.id}_${col.id}` : "";
    const style = cellStyles[cellKey] || {};

    const cellFontFamily = style.fontFamily || fontFamily;
    const cellFontSize = style.fontSize || fontSize;
    const cellBold = style.bold !== undefined ? style.bold : false;
    const cellItalic = style.italic !== undefined ? style.italic : false;
    const cellUnderline = style.underline !== undefined ? style.underline : false;
    const cellColor = style.color || (col.type === "currency" ? "#0f172a" : "#334155");
    const cellBgColor = style.bgColor;
    const cellAlign = style.align || (col.type === "currency" || col.type === "number" ? "right" : "left");

    if (isAnchor && isEditing) {
      const common = {
        id: activeInputId,
        value: draft,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
          setDraft(e.target.value),
        onBlur: () => {
          commit();
          setIsEditing(false);
        },
        onKeyDown: onInputKeyDown,
        style: {
          fontFamily: cellFontFamily,
          fontSize: `${cellFontSize}px`,
          fontWeight: cellBold ? 700 : 500,
          fontStyle: cellItalic ? "italic" : "normal",
          textDecoration: cellUnderline ? "underline" : "none",
          color: cellColor,
          backgroundColor: cellBgColor || "#ffffff",
          textAlign: cellAlign as "left" | "center" | "right",
        },
        className:
          "w-full h-full px-2 py-1 outline-none ring-2 ring-emerald-600 font-medium",
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
          className={
            common.className +
            (cellAlign === "left"
              ? " text-left"
              : cellAlign === "center"
              ? " text-center"
              : " text-right")
          }
        />
      );
    }

    const alignmentClass =
      cellAlign === "left"
        ? "justify-start text-left"
        : cellAlign === "center"
        ? "justify-center text-center"
        : cellAlign === "right"
        ? "justify-end text-right"
        : numeric
        ? "justify-end text-right tabular-nums"
        : "justify-start text-left";

    // Excel Selection Bounding Borders
    const borderClasses = inRange && activeRange
      ? [
          activeRange.r1 === r ? "border-t-2 border-t-emerald-600" : "",
          activeRange.r2 === r ? "border-b-2 border-b-emerald-600" : "",
          activeRange.c1 === c ? "border-l-2 border-l-emerald-600" : "",
          activeRange.c2 === c ? "border-r-2 border-r-emerald-600" : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

    const bgClass = isAnchor
      ? "ring-2 ring-emerald-600 ring-inset z-10"
      : inRange
      ? "bg-emerald-100/40"
      : "";

    return (
      <div
        onMouseDown={(e) => handleCellMouseDown(e, r, c)}
        onMouseEnter={() => handleCellMouseEnter(r, c)}
        onDoubleClick={() => handleCellDoubleClick(r, c)}
        tabIndex={isAnchor ? 0 : -1}
        onKeyDown={(e) => {
          if (!isEditing && isAnchor) {
            if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault();
              clearSelectedRange();
            } else if (e.key === "Enter" || e.key === "F2") {
              e.preventDefault();
              setIsEditing(true);
            } else if (e.key === "Tab") {
              e.preventDefault();
              move(0, e.shiftKey ? -1 : 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1, 0, e.shiftKey);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1, 0, e.shiftKey);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(0, -1, e.shiftKey);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              move(0, 1, e.shiftKey);
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              setIsEditing(true);
              setDraft(e.key);
            }
          }
        }}
        style={{
          fontFamily: cellFontFamily,
          fontSize: `${cellFontSize}px`,
          fontWeight: cellBold ? 700 : col.type === "currency" ? 600 : 400,
          fontStyle: cellItalic ? "italic" : "normal",
          textDecoration: cellUnderline ? "underline" : "none",
          color: cellColor,
          backgroundColor: inRange && !isAnchor ? undefined : (cellBgColor || (isAnchor ? "#ffffff" : undefined)),
        }}
        className={`flex h-full w-full items-center px-2 py-1 select-none cursor-cell outline-none ${alignmentClass} ${borderClasses} ${bgClass}`}
      >
        <span className="truncate pointer-events-none">
          {displayValue(col, value, rows, cols) || <span className="text-slate-300">·</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Excel Ribbon & Action Bar */}
      <div className="border-b border-slate-200 bg-slate-100">
        {/* Ribbon Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <span>📊 EXCEL</span>
            </span>
            <span className="text-xs font-bold text-slate-800">{sheet.name}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200">
              {sheet.type === "expense" ? "Expenses Ledger" : "Cost & Payments"}
            </span>

            {/* Hint Badge */}
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              💡 Click & drag cells or row/col headers to select and format
            </span>
          </div>

          {/* Row Height Density Controls & Side/Bottom Scroll Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Row Height Density Preset */}
            <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500">Row:</span>
              <button
                type="button"
                onClick={() => setBaseRowHeight(28)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                  baseRowHeight === 28
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Compact row height (28px)"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setBaseRowHeight(36)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                  baseRowHeight === 36
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Default row height (36px)"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setBaseRowHeight(48)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                  baseRowHeight === 48
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Tall row height (48px)"
              >
                Tall
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onAddRow}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800"
                title="Add a new row to grid"
              >
                <Plus width={13} /> Add Row
              </button>

              <button
                onClick={onAddColumn}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
                title="Add a new column to grid"
              >
                <Plus width={13} /> Add Column
              </button>
            </div>
          </div>
        </div>

        {/* Excel Font Family, Size, Colors & Formatting Ribbon Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-1.5 text-xs text-slate-700 select-none">
          {/* Font Family Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Font:</span>
            <select
              value={currentFontFamily}
              onChange={(e) => applyFormatToSelection({ fontFamily: e.target.value })}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 shadow-2xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 min-w-[135px]"
              title="Change Font Family for selected cells"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Font Size Number Input & Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Size:</span>
            <div className="flex items-center">
              <input
                type="number"
                min="8"
                max="48"
                value={currentFontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 6 && val <= 72) {
                    applyFormatToSelection({ fontSize: val });
                  }
                }}
                className="h-7 w-12 rounded-l border border-slate-300 bg-white px-1 text-center text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                title="Type font size (8 - 48)"
              />
              <select
                value={currentFontSize}
                onChange={(e) => applyFormatToSelection({ fontSize: Number(e.target.value) })}
                className="h-7 rounded-r border-y border-r border-slate-300 bg-slate-100 px-1 text-xs font-bold text-slate-700 shadow-2xs outline-none hover:bg-slate-200 cursor-pointer"
                title="Font size presets"
              >
                {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Increase & Decrease Font Buttons (A▲ / A▼) */}
            <div className="flex items-center gap-0.5 ml-0.5">
              <button
                type="button"
                onClick={() => applyFormatToSelection({ fontSize: Math.min(48, currentFontSize + 1) })}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:bg-slate-200"
                title="Increase Font Size (A+)"
              >
                A<span className="text-[9px] -mt-1 font-extrabold text-emerald-700">▲</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormatToSelection({ fontSize: Math.max(8, currentFontSize - 1) })}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:bg-slate-200"
                title="Decrease Font Size (A-)"
              >
                A<span className="text-[9px] mt-1 font-extrabold text-slate-500">▼</span>
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Bold, Italic, Underline (B / I / U) */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => applyFormatToSelection({ bold: !currentBold })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-extrabold transition shadow-2xs ${
                currentBold
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => applyFormatToSelection({ italic: !currentItalic })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-serif italic font-bold transition shadow-2xs ${
                currentItalic
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => applyFormatToSelection({ underline: !currentUnderline })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-bold underline transition shadow-2xs ${
                currentUnderline
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Underline (Ctrl+U)"
            >
              U
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Excel Text Color Picker (A with color bar) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenTextColor(!openTextColor);
                setOpenFillColor(false);
              }}
              className="flex h-7 w-8 flex-col items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 shadow-2xs transition px-1"
              title="Text Color"
            >
              <span className="text-xs font-black leading-none text-slate-800">A</span>
              <span
                className="mt-0.5 h-[3.5px] w-full rounded-xs shadow-xs"
                style={{ backgroundColor: currentColor }}
              />
            </button>

            {openTextColor && (
              <div
                className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between border-b pb-1">
                  <span className="text-[11px] font-bold text-slate-700">Text Color</span>
                  <button
                    type="button"
                    onClick={() => setOpenTextColor(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X width={12} />
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        applyFormatToSelection({ color: c.value });
                        setOpenTextColor(false);
                      }}
                      className="group relative flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 shadow-2xs hover:scale-110 transition"
                      style={{ backgroundColor: c.bg }}
                      title={c.name}
                    >
                      {currentColor === c.value && (
                        <span className={`text-[10px] font-bold ${c.value === "#ffffff" ? "text-slate-900" : "text-white"}`}>
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                  <span className="font-semibold text-slate-600">Custom Color:</span>
                  <input
                    type="color"
                    value={currentColor.startsWith("#") ? currentColor : "#0f172a"}
                    onChange={(e) => applyFormatToSelection({ color: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Excel Highlight / Fill Color Picker (Paint Bucket with color bar) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenFillColor(!openFillColor);
                setOpenTextColor(false);
              }}
              className="flex h-7 w-8 flex-col items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 shadow-2xs transition px-1"
              title="Highlight / Fill Color"
            >
              <PaintBucket width={13} className="text-slate-700" />
              <span
                className="mt-0.5 h-[3.5px] w-full rounded-xs shadow-xs border border-slate-200"
                style={{ backgroundColor: currentBgColor || "#ffffff" }}
              />
            </button>

            {openFillColor && (
              <div
                className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between border-b pb-1">
                  <span className="text-[11px] font-bold text-slate-700">Highlight / Fill Color</span>
                  <button
                    type="button"
                    onClick={() => setOpenFillColor(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X width={12} />
                  </button>
                </div>

                {/* No Fill Option */}
                <button
                  type="button"
                  onClick={() => {
                    applyFormatToSelection({ bgColor: undefined });
                    setOpenFillColor(false);
                  }}
                  className="mb-2 w-full flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                >
                  <span>🚫 No Fill (Default)</span>
                </button>

                <div className="grid grid-cols-6 gap-1.5 mb-2.5">
                  {FILL_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        applyFormatToSelection({ bgColor: c.value });
                        setOpenFillColor(false);
                      }}
                      className="group relative flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 shadow-2xs hover:scale-110 transition"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {currentBgColor === c.value && (
                        <span className="text-[10px] font-bold text-slate-800">✓</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                  <span className="font-semibold text-slate-600">Custom Color:</span>
                  <input
                    type="color"
                    value={currentBgColor && currentBgColor.startsWith("#") ? currentBgColor : "#fef08a"}
                    onChange={(e) => applyFormatToSelection({ bgColor: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Alignment Controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => applyFormatToSelection({ align: currentAlign === "left" ? undefined : "left" })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs transition shadow-2xs ${
                currentAlign === "left"
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-bold ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Align Left"
            >
              ⇤
            </button>
            <button
              type="button"
              onClick={() => applyFormatToSelection({ align: currentAlign === "center" ? undefined : "center" })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs transition shadow-2xs ${
                currentAlign === "center"
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-bold ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Align Center"
            >
              ↔
            </button>
            <button
              type="button"
              onClick={() => applyFormatToSelection({ align: currentAlign === "right" ? undefined : "right" })}
              className={`flex h-7 w-7 items-center justify-center rounded border text-xs transition shadow-2xs ${
                currentAlign === "right"
                  ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-bold ring-1 ring-emerald-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Align Right"
            >
              ⇥
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Clear Formats Button */}
          <button
            type="button"
            onClick={clearFormatsOnSelection}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 shadow-2xs ml-auto"
            title="Clear formatting on selected cells"
          >
            ↺ Clear Format
          </button>
        </div>

        {/* Excel Formula Bar (fx) */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-xs">
          {/* Name Box (e.g. A1, B3, A1:C5) */}
          <div className="flex h-7 min-w-[50px] px-1.5 items-center justify-center rounded border border-slate-300 bg-white font-mono text-xs font-bold text-slate-700 shadow-inner select-none">
            {cellRef}
          </div>
          <div className="h-4 w-px bg-slate-300" />
          {/* fx Icon */}
          <div className="font-serif font-bold italic text-slate-500 select-none">fx</div>
          {/* Formula / Cell Content Input */}
          <input
            type="text"
            style={{ fontFamily: currentFontFamily }}
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

      {/* Excel Spreadsheet Grid with Sticky Headers & Drag Resizing */}
      <div
        ref={gridContainerRef}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-100"
      >
        <table className="border-collapse table-fixed" style={{ minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: indexColWidth }} />
            {cols.map((c) => (
              <col key={c.id} style={{ width: localColWidths[c.id] ?? c.width ?? 180 }} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>

          {/* Sticky Header Row */}
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
            <tr className="border-b border-slate-300 text-left text-xs font-semibold text-slate-600">
              {/* Sticky Top-Left Corner Cell (Excel Corner / # - Select All) */}
              <th
                onClick={handleSelectAll}
                className={`sticky left-0 top-0 z-30 border-r border-b border-slate-300 p-0 text-center select-none shadow-xs group/indexth cursor-pointer transition-colors ${
                  activeRange &&
                  activeRange.r1 === 0 &&
                  activeRange.c1 === 0 &&
                  activeRange.r2 === Math.max(0, rows.length - 1) &&
                  activeRange.c2 === Math.max(0, cols.length - 1)
                    ? "bg-emerald-200 text-emerald-950"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                }`}
                title="Select all cells (Ctrl+A)"
              >
                <div className="flex h-8 items-center justify-center font-sans text-xs font-extrabold text-slate-700">
                  #
                </div>
                {/* Column width resizer handle for index column */}
                <div
                  onMouseDown={startIndexColResize}
                  onDoubleClick={() => setIndexColWidth(54)}
                  className="absolute right-0 top-0 bottom-0 w-2.5 -mr-1 cursor-col-resize select-none z-20 flex justify-center items-center group/indexresizer"
                  title="Drag to resize serial column width (Double-click to reset)"
                >
                  <div
                    className={`w-[2px] h-full transition-colors ${
                      resizingIndexCol
                        ? "bg-emerald-600 w-[3px]"
                        : "bg-transparent group-hover/indexresizer:bg-emerald-500 group-hover:bg-slate-300"
                    }`}
                  />
                </div>
              </th>

              {cols.map((c, idx) => {
                const currentW = localColWidths[c.id] ?? c.width ?? 180;
                const isThisColResizing = resizingCol?.id === c.id;
                const colSelected = isColInRange(idx);

                return (
                  <th
                    key={c.id}
                    onMouseDown={(e) => handleColumnHeaderMouseDown(e, idx)}
                    onMouseEnter={() => handleColumnHeaderMouseEnter(idx)}
                    className={`group relative border-r border-b border-slate-300 p-0 transition-colors select-none cursor-pointer ${
                      colSelected
                        ? "bg-emerald-100 text-emerald-950 font-bold"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    } ${isThisColResizing ? "ring-2 ring-emerald-600 z-30" : ""}`}
                  >
                    <ColumnHeader
                      col={c}
                      colIndex={idx}
                      sheetType={sheet.type}
                      isSelected={colSelected}
                      onUpdate={(patch) => onUpdateColumn(c.id, patch)}
                      onDelete={() => onDeleteColumn(c.id)}
                      onMove={(dir) => onMoveColumn(c.id, dir)}
                    />

                    {/* Excel Column Width Resizer Divider Handle */}
                    <div
                      onMouseDown={(e) => startColumnResize(e, c.id, currentW)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setLocalColWidths((prev) => ({ ...prev, [c.id]: 180 }));
                        onUpdateColumn(c.id, { width: 180 });
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2.5 -mr-1.5 cursor-col-resize select-none z-20 flex justify-center items-center group/colresizer"
                      title="Drag to resize column width (Double-click for default 180px)"
                    >
                      <div
                        className={`w-[2px] h-full transition-colors ${
                          isThisColResizing
                            ? "bg-emerald-600 w-[3px]"
                            : "bg-transparent group-hover/colresizer:bg-emerald-500 group-hover:bg-slate-300"
                        }`}
                      />
                    </div>

                    {/* Tooltip during drag */}
                    {isThisColResizing && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap z-50 pointer-events-none">
                        Width: {resizingCol.currentWidth}px
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="bg-slate-100 p-0" />
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={cols.length + 2}
                  className="py-16 text-center text-slate-400 bg-slate-50/50"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">This sheet has no rows yet</span>
                    <button
                      type="button"
                      onClick={onAddRow}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs"
                    >
                      <Plus width={13} /> Add First Row
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              const curRowHeight = Math.max(rowHeights[r.id] ?? baseRowHeight, fontSize + 16);
              const isThisRowResizing = resizingRow?.id === r.id;
              const rowSelected = isRowInRange(rowIdx);

              return (
                <tr
                  key={r.id}
                  style={{ height: `${curRowHeight}px` }}
                  className={`group border-b border-slate-200 transition-colors ${
                    isEven ? "bg-white" : "bg-slate-50/50"
                  } hover:bg-emerald-50/40`}
                >
                  {/* Sticky Row Index Column (Excel Row Header Serial Number - Select Row) */}
                  <td
                    onMouseDown={(e) => handleRowHeaderMouseDown(e, rowIdx)}
                    onMouseEnter={() => handleRowHeaderMouseEnter(rowIdx)}
                    className={`sticky left-0 z-10 border-r border-b border-slate-300 text-center font-sans tabular-nums text-xs md:text-[13px] select-none transition-colors shadow-xs group/rowcell cursor-pointer ${
                      rowSelected
                        ? "bg-emerald-100 font-bold text-emerald-950 ring-1 ring-inset ring-emerald-600/40"
                        : "bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200"
                    } ${isThisRowResizing ? "ring-2 ring-emerald-600 z-30" : ""}`}
                  >
                    <div
                      className="flex items-center justify-center px-1"
                      style={{ height: `${curRowHeight}px` }}
                    >
                      {rowIdx + 1}
                    </div>

                    {/* Excel Row Height Resizer Handle on bottom edge */}
                    <div
                      onMouseDown={(e) => startRowResize(e, r.id, curRowHeight)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRowHeights((prev) => ({ ...prev, [r.id]: baseRowHeight }));
                      }}
                      className="absolute left-0 right-0 bottom-0 h-2 -mb-1 cursor-row-resize select-none z-20 flex flex-col justify-center items-center group/rowresizer"
                      title="Drag to resize row height (Double-click to reset)"
                    >
                      <div
                        className={`h-[2px] w-full transition-colors ${
                          isThisRowResizing
                            ? "bg-emerald-600 h-[2px]"
                            : "bg-transparent group-hover/rowresizer:bg-emerald-500 group-hover/rowcell:bg-slate-300"
                        }`}
                      />
                    </div>

                    {/* Height Tooltip during drag */}
                    {isThisRowResizing && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap z-50 pointer-events-none">
                        Height: {resizingRow.currentHeight}px
                      </div>
                    )}
                  </td>
                  {cols.map((c, colIdx) => (
                    <td
                      key={c.id}
                      style={{ height: `${curRowHeight}px` }}
                      className="border-r border-slate-200 p-0"
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
              <td className="sticky left-0 z-20 border-r border-slate-300 bg-slate-200 text-center font-sans text-xs font-bold text-slate-700">
                <div className="flex h-8 items-center justify-center">
                  ∑
                </div>
              </td>
              {cols.map((col, idx) => {
                const total = totals[idx];
                return (
                  <td
                    key={col.id}
                    style={{
                      fontFamily,
                      fontSize: `${fontSize}px`,
                    }}
                    className="border-r border-slate-300 px-2 py-2 text-right tabular-nums font-bold text-slate-900 bg-slate-100"
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
  isSelected,
  onUpdate,
  onDelete,
  onMove,
}: {
  col: Column;
  colIndex: number;
  sheetType: SheetType;
  isSelected?: boolean;
  onUpdate: (patch: Partial<Column>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const colLetter = String.fromCharCode(65 + Math.min(colIndex, 25));

  return (
    <div className="flex h-8 w-full items-center justify-between px-2 text-xs font-semibold">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pointer-events-none">
        <span
          className={`font-mono text-xs font-extrabold px-1.5 py-0.5 rounded shadow-2xs ${
            isSelected
              ? "bg-emerald-700 text-white"
              : "bg-white text-slate-700 border border-slate-300"
          }`}
        >
          {colLetter}
        </span>
        <span className={`truncate text-xs ${isSelected ? "text-emerald-950 font-bold" : "text-slate-800"}`}>
          {col.label}
        </span>
        {col.reconcileRole && (
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${ROLE_COLOR[col.reconcileRole] ?? "bg-amber-500"}`}
            title={`Role: ${col.reconcileRole}`}
          />
        )}
      </div>

      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="rounded p-1 text-slate-400 hover:bg-slate-300/80 hover:text-slate-800 transition"
        title="Column settings"
      >
        <Menu width={12} />
      </button>

      {open && (
        <>
          {/* Backdrop overlay to close menu on click outside */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onMouseDown={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <ColumnMenu
            col={col}
            colIndex={colIndex}
            sheetType={sheetType}
            onClose={() => setOpen(false)}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMove={onMove}
          />
        </>
      )}
    </div>
  );
}

function ColumnMenu({
  col,
  colIndex,
  sheetType,
  onClose,
  onUpdate,
  onDelete,
  onMove,
}: {
  col: Column;
  colIndex?: number;
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

  const isLeftAligned = (colIndex ?? 0) < 3;

  useEffect(() => {
    setLabel(col.label);
    setType(col.type);
    setOptionsStr((col.options ?? []).join(", "));
    setRole(col.reconcileRole ?? "");
  }, [col]);

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
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`absolute ${
        isLeftAligned ? "left-0" : "right-0"
      } top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl text-slate-800 font-normal cursor-default select-text`}
    >
      <div className="mb-2 flex items-center justify-between border-b pb-1">
        <span className="text-xs font-bold text-slate-800">Edit Column Settings</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X width={12} />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">Column Label</label>
          <input
            type="text"
            autoFocus
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white text-slate-800 text-xs font-medium"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">Data Type</label>
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white text-slate-800 text-xs"
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
              type="text"
              className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white text-slate-800 text-xs"
              value={optionsStr}
              placeholder="e.g. Pending, Paid, Overdue"
              onChange={(e) => setOptionsStr(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500">
            Reconciliation Matching Role
          </label>
          <select
            className="w-full rounded border border-slate-300 px-2 py-1 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white text-slate-800 text-xs"
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
                onClose();
              }}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
              title="Move Left"
            >
              <ChevronLeft width={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Are you sure you want to delete this column and its data?")) {
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
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            save();
          }}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
