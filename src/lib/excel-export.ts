/**
 * Excel Export Utility — powered by ExcelJS
 *
 * Generates professionally formatted .xlsx files from project sheet data
 * with styled headers, currency formatting, auto-width columns, and totals.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Column, Project, Sheet } from "./types";

/** Amber-branded header style matching BuildLedger theme */
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E293B" }, // slate-800
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFF59E0B" }, // amber-500
  size: 11,
  name: "Calibri",
};

const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" }, // slate-100
};

const TOTAL_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
  name: "Calibri",
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

function getColumnWidth(col: Column): number {
  if (col.type === "currency") return 18;
  if (col.type === "number") return 14;
  if (col.type === "date") return 14;
  return Math.max(col.label.length + 4, 16);
}

function buildWorksheet(
  workbook: ExcelJS.Workbook,
  sheet: Sheet,
  projectName: string
): void {
  const ws = workbook.addWorksheet(sheet.name, {
    properties: { defaultRowHeight: 22 },
  });

  const cols = sheet.columns;

  // --- Column definitions ---
  ws.columns = cols.map((c) => ({
    header: c.label,
    key: String(c.id),
    width: getColumnWidth(c),
  }));

  // --- Style header row ---
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = BORDER_THIN;
  });

  // --- Data rows ---
  for (const row of sheet.rows) {
    const values: Record<string, string | number> = {};
    for (const col of cols) {
      const raw = row.cells[col.id] ?? "";
      if (col.type === "currency" || col.type === "number") {
        const num = parseFloat(raw);
        values[String(col.id)] = isNaN(num) ? 0 : num;
      } else {
        values[String(col.id)] = raw;
      }
    }

    const excelRow = ws.addRow(values);

    // Apply cell-level formatting
    cols.forEach((col, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: "middle" };

      if (col.type === "currency") {
        cell.numFmt = '"$"#,##0.00';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (col.type === "number") {
        cell.numFmt = "#,##0.##";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (col.type === "date") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    // Alternate row shading
    if (excelRow.number % 2 === 0) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" }, // slate-50
        };
      });
    }
  }

  // --- Totals row ---
  const totalValues: Record<string, string | number> = {};
  let hasNumeric = false;

  cols.forEach((col, idx) => {
    if (col.type === "currency" || col.type === "number") {
      hasNumeric = true;
      const sum = sheet.rows.reduce((acc, r) => {
        const v = parseFloat(r.cells[col.id] ?? "0");
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
      totalValues[String(col.id)] = sum;
    } else if (idx === 0) {
      totalValues[String(col.id)] = "TOTAL";
    } else {
      totalValues[String(col.id)] = "";
    }
  });

  if (hasNumeric) {
    const totalRow = ws.addRow(totalValues);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      cell.fill = TOTAL_FILL;
      cell.font = TOTAL_FONT;
      cell.border = {
        top: { style: "medium", color: { argb: "FF1E293B" } },
        bottom: { style: "medium", color: { argb: "FF1E293B" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };

      const col = cols[colNumber - 1];
      if (col?.type === "currency") {
        cell.numFmt = '"$"#,##0.00';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (col?.type === "number") {
        cell.numFmt = "#,##0.##";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    });
  }

  // Auto-filter on header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols.length },
  };

  // Freeze the header row
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * Export a single sheet as a styled .xlsx file.
 */
export async function exportSheetToExcel(
  sheet: Sheet,
  projectName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildLedger";
  workbook.created = new Date();

  buildWorksheet(workbook, sheet, projectName);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `${projectName.replace(/\s+/g, "_")}_${sheet.type}.xlsx`
  );
}

/**
 * Export the full project workbook (all sheets) as a single .xlsx file.
 */
export async function exportProjectToExcel(project: Project): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BuildLedger";
  workbook.created = new Date();

  for (const sheet of project.sheets) {
    buildWorksheet(workbook, sheet, project.name);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${project.name.replace(/\s+/g, "_")}_Full_Report.xlsx`);
}
