/**
 * Excel Import Utility — powered by SheetJS (xlsx)
 *
 * Parses uploaded .xlsx / .xls / .csv files and returns row data
 * that can be bulk-inserted into existing project sheets.
 */
import * as XLSX from "xlsx";
import type { Column } from "./types";

export interface ParsedRow {
  [columnLabel: string]: string;
}

export interface ImportResult {
  headers: string[];
  rows: ParsedRow[];
  sheetName: string;
}

/**
 * Parse an Excel or CSV file (as ArrayBuffer) into structured row data.
 * Returns all sheets found in the workbook.
 */
export function parseExcelFile(buffer: ArrayBuffer): ImportResult[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];

    // Convert to array-of-arrays to get headers + rows
    const aoa: string[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    if (aoa.length === 0) {
      return { headers: [], rows: [], sheetName };
    }

    const headers = aoa[0].map((h) => String(h).trim());
    const rows: ParsedRow[] = aoa.slice(1).map((row) => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] != null ? String(row[i]).trim() : "";
      });
      return obj;
    });

    // Filter out completely empty rows
    const nonEmpty = rows.filter((r) =>
      Object.values(r).some((v) => v !== "")
    );

    return { headers, rows: nonEmpty, sheetName };
  });
}

/**
 * Map parsed Excel headers to existing sheet columns using fuzzy label matching.
 * Returns a mapping: excelHeader -> column.id
 */
export function mapHeadersToColumns(
  excelHeaders: string[],
  columns: Column[]
): Map<string, number> {
  const mapping = new Map<string, number>();

  for (const header of excelHeaders) {
    const normalized = header.toLowerCase().trim();

    // Exact match first
    const exact = columns.find(
      (c) => c.label.toLowerCase().trim() === normalized
    );
    if (exact) {
      mapping.set(header, exact.id);
      continue;
    }

    // Partial / contains match
    const partial = columns.find(
      (c) =>
        c.label.toLowerCase().includes(normalized) ||
        normalized.includes(c.label.toLowerCase())
    );
    if (partial) {
      mapping.set(header, partial.id);
    }
  }

  return mapping;
}

/**
 * Convert parsed rows into cell values using the header-to-column mapping.
 * Returns arrays of { columnId, value } for each row.
 */
export function convertRowsToCells(
  rows: ParsedRow[],
  headerMapping: Map<string, number>
): { columnId: number; value: string }[][] {
  return rows.map((row) => {
    const cells: { columnId: number; value: string }[] = [];
    for (const [header, columnId] of headerMapping.entries()) {
      const value = row[header] ?? "";
      if (value !== "") {
        cells.push({ columnId, value });
      }
    }
    return cells;
  });
}

/**
 * Read a File object and parse it as Excel.
 */
export async function readExcelFile(file: File): Promise<ImportResult[]> {
  const buffer = await file.arrayBuffer();
  return parseExcelFile(buffer);
}
