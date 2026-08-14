import { tursoDb as db } from "@/db";
import { cells, columns, rows, sheets } from "@/db/schema";
import type { ReconcileRole } from "./types";

interface ColDef {
  label: string;
  type: "text" | "number" | "currency" | "date" | "select";
  role?: ReconcileRole;
  options?: string[];
  width?: number;
}

export const CATEGORIES = [
  "Materials",
  "Labour",
  "Subcontractor",
  "Plant & Equipment",
  "Preliminaries",
  "Provisional Sum",
  "Other",
];

const EXPENSE_COLUMNS: ColDef[] = [
  { label: "Date", type: "date", width: 140 },
  { label: "Cost Code", type: "text", role: "reconcile_key", width: 130 },
  { label: "Category", type: "select", options: CATEGORIES, width: 170 },
  { label: "Description", type: "text", width: 240 },
  { label: "Supplier", type: "text", width: 180 },
  { label: "Amount ex GST", type: "currency", role: "expense_amount", width: 150 },
  { label: "GST", type: "currency", width: 120 },
  { label: "Status", type: "select", options: ["Paid", "Unpaid", "Pending"], width: 120 },
  { label: "Notes", type: "text", width: 200 },
];

const COST_COLUMNS: ColDef[] = [
  { label: "Cost Code", type: "text", role: "reconcile_key", width: 130 },
  { label: "Trade / Category", type: "select", options: CATEGORIES, width: 170 },
  { label: "Description", type: "text", width: 240 },
  { label: "Supplier", type: "text", width: 180 },
  { label: "Budget", type: "currency", role: "cost_budget", width: 140 },
  { label: "Actual Cost", type: "currency", role: "cost_actual", width: 150 },
  { label: "Amount Paid", type: "currency", role: "cost_paid", width: 150 },
  {
    label: "Status",
    type: "select",
    options: ["Not Started", "Ordered", "Invoiced", "Paid", "On Hold"],
    width: 140,
  },
  { label: "Notes", type: "text", width: 200 },
];

const EXPENSE_SAMPLE: Record<string, string>[] = [
  {
    Date: "2026-01-15",
    "Cost Code": "FOUND-01",
    Category: "Subcontractor",
    Description: "Concrete slab & footings",
    Supplier: "ABC Concreting",
    "Amount ex GST": "12500",
    GST: "1250",
    Status: "Paid",
  },
  {
    Date: "2026-02-03",
    "Cost Code": "STRUCT-02",
    Category: "Subcontractor",
    Description: "Steel frame erection",
    Supplier: "Metro Steel",
    "Amount ex GST": "28000",
    GST: "2800",
    Status: "Paid",
  },
  {
    Date: "2026-02-20",
    "Cost Code": "ROOF-03",
    Category: "Subcontractor",
    Description: "Roof framing & cladding",
    Supplier: "TopCover Roofing",
    "Amount ex GST": "9800",
    GST: "980",
    Status: "Unpaid",
  },
  {
    Date: "2026-03-05",
    "Cost Code": "FITOUT-04",
    Category: "Materials",
    Description: "Plasterboard & fitout materials",
    Supplier: "PlasterCo",
    "Amount ex GST": "15200",
    GST: "1520",
    Status: "Pending",
  },
];

const COST_SAMPLE: Record<string, string>[] = [
  {
    "Cost Code": "FOUND-01",
    "Trade / Category": "Subcontractor",
    Description: "Concrete slab & footings",
    Supplier: "ABC Concreting",
    Budget: "13000",
    "Actual Cost": "12500",
    "Amount Paid": "12500",
    Status: "Paid",
  },
  {
    "Cost Code": "STRUCT-02",
    "Trade / Category": "Subcontractor",
    Description: "Steel frame erection",
    Supplier: "Metro Steel",
    Budget: "26000",
    "Actual Cost": "28000",
    "Amount Paid": "28000",
    Status: "Paid",
  },
  {
    "Cost Code": "ROOF-03",
    "Trade / Category": "Subcontractor",
    Description: "Roof framing & cladding",
    Supplier: "TopCover Roofing",
    Budget: "9500",
    "Actual Cost": "9800",
    "Amount Paid": "0",
    Status: "Invoiced",
  },
  {
    "Cost Code": "FITOUT-04",
    "Trade / Category": "Materials",
    Description: "Plasterboard & fitout materials",
    Supplier: "PlasterCo",
    Budget: "16000",
    "Actual Cost": "15200",
    "Amount Paid": "0",
    Status: "Ordered",
  },
];

async function buildSheet(
  database: typeof db,
  projectId: number,
  name: string,
  type: "expense" | "cost_control",
  position: number,
  colDefs: ColDef[],
  sample: Record<string, string>[],
) {
  const [sheet] = await database
    .insert(sheets)
    .values({ projectId, name, type, position })
    .returning();

  const labelToId = new Map<string, number>();
  await Promise.all(
    colDefs.map(async (c, i) => {
      const [col] = await database
        .insert(columns)
        .values({
          sheetId: sheet.id,
          label: c.label,
          type: c.type,
          options: c.options ?? null,
          reconcileRole: c.role ?? null,
          width: c.width ?? 180,
          position: i,
        })
        .returning();
      labelToId.set(c.label, col.id);
    }),
  );

  await Promise.all(
    sample.map(async (rowData, idx) => {
      const [row] = await database
        .insert(rows)
        .values({ sheetId: sheet.id, position: idx })
        .returning();
      const cellValues = Object.entries(rowData).map(([label, value]) => ({
        rowId: row.id,
        columnId: labelToId.get(label)!,
        value,
      }));
      if (cellValues.length) await database.insert(cells).values(cellValues);
    }),
  );
}

/** Seeds a brand new project with the two default cross-checkable sheets + sample rows. */
export async function seedDefaultSheets(
  database: typeof db,
  projectId: number,
  withSample = true,
): Promise<void> {
  await buildSheet(
    database,
    projectId,
    "Balance Sheet & Expenses",
    "expense",
    0,
    EXPENSE_COLUMNS,
    withSample ? EXPENSE_SAMPLE : [],
  );
  await buildSheet(
    database,
    projectId,
    "Cost Control & Payment Tracker",
    "cost_control",
    1,
    COST_COLUMNS,
    withSample ? COST_SAMPLE : [],
  );
}
