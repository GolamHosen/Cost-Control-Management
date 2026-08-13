import { Parser } from "hot-formula-parser";
import type { Column, SheetRow } from "./types";

/**
 * Excel Formula Engine
 *
 * Evaluates Excel expressions & formulas like:
 *  - `=B1+B2` or `B1+B2`
 *  - `=SUM(A1:A10)`
 *  - `=AVERAGE(B1:B5)`
 *  - `=MIN(A1:A5)`, `=MAX(A1:A5)`, `=COUNT(A1:A10)`
 *  - `=A1*1.1` or `=(B1-B2)/C1`
 */

function parseCellRef(ref: string): { r: number; c: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;

  const colLetters = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);

  // Convert column letters (A=0, B=1, Z=25, AA=26...) to index
  let c = 0;
  for (let i = 0; i < colLetters.length; i++) {
    c = c * 26 + (colLetters.charCodeAt(i) - 64);
  }
  c -= 1; // 0-based column index

  const r = rowNum - 1; // 0-based row index
  return { r, c };
}

export function evaluateFormula(
  rawValue: string,
  rows: SheetRow[],
  cols: Column[],
  visited = new Set<string>()
): string {
  if (rawValue === undefined || rawValue === null || rawValue === "") return "";

  const trimmed = rawValue.trim();

  // If not starting with '=' or containing cell reference patterns, return string directly
  const isFormula =
    trimmed.startsWith("=") ||
    /^[A-Za-z]+\d+\s*[\+\-\*\/\^]/.test(trimmed) ||
    /^(SUM|AVERAGE|MIN|MAX|COUNT|PRODUCT|ROUND|IF)\s*\(/i.test(trimmed);

  if (!isFormula) {
    return rawValue;
  }

  // Strip leading '=' if present
  const expr = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed;

  // Circular reference guard
  if (visited.has(expr)) {
    return "#CIRCULAR!";
  }
  visited.add(expr);

  const parser = new Parser();

  // Handle cell coordinate lookup (e.g. A1, B2)
  parser.on("callCellValue", (cellCoord: any, done: (val: any) => void) => {
    const r = cellCoord.row.index;
    const c = cellCoord.column.index;

    const col = cols[c];
    const row = rows[r];

    if (!col || !row) {
      done(0);
      return;
    }

    const cellVal = row.cells[col.id] ?? "0";

    // Recursively evaluate if cell contains formula
    if (cellVal.trim().startsWith("=") || /^[A-Za-z]+\d+/.test(cellVal.trim())) {
      const evaled = evaluateFormula(cellVal, rows, cols, new Set(visited));
      const num = parseFloat(evaled);
      done(isNaN(num) ? evaled : num);
    } else {
      const num = parseFloat(cellVal);
      done(isNaN(num) ? cellVal : num);
    }
  });

  // Handle range lookup (e.g. A1:A10)
  parser.on(
    "callRangeValue",
    (startCell: any, endCell: any, done: (val: any[][]) => void) => {
      const startR = Math.min(startCell.row.index, endCell.row.index);
      const endR = Math.max(startCell.row.index, endCell.row.index);
      const startC = Math.min(startCell.column.index, endCell.column.index);
      const endC = Math.max(startCell.column.index, endCell.column.index);

      const matrix: any[][] = [];

      for (let r = startR; r <= endR; r++) {
        const rowVector: any[] = [];
        for (let c = startC; c <= endC; c++) {
          const col = cols[c];
          const row = rows[r];
          if (!col || !row) {
            rowVector.push(0);
          } else {
            const cellVal = row.cells[col.id] ?? "0";
            const num = parseFloat(cellVal);
            rowVector.push(isNaN(num) ? cellVal : num);
          }
        }
        matrix.push(rowVector);
      }
      done(matrix);
    }
  );

  const result = parser.parse(expr);

  if (result.error) {
    // If simple expression without '=' e.g. B1+B2, try evaluating with '='
    if (!trimmed.startsWith("=")) {
      return evaluateFormula("=" + trimmed, rows, cols, visited);
    }
    return `#ERROR!`;
  }

  if (result.result === null || result.result === undefined) {
    return "";
  }

  if (typeof result.result === "number") {
    // Format to 2 decimals if floating point, else string representation
    return Number.isInteger(result.result)
      ? String(result.result)
      : String(Math.round(result.result * 100) / 100);
  }

  return String(result.result);
}
