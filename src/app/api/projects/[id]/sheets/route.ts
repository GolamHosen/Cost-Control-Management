import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { columns, rows, sheets } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_NEW_SHEET_COLUMNS = [
  { label: "Date", type: "date", width: 140 },
  { label: "Cost Code", type: "text", role: "reconcile_key", width: 130 },
  {
    label: "Category",
    type: "select",
    options: [
      "Materials",
      "Labour",
      "Subcontractor",
      "Plant & Equipment",
      "Preliminaries",
      "Provisional Sum",
      "Other",
    ],
    width: 170,
  },
  { label: "Description", type: "text", width: 240 },
  { label: "Supplier", type: "text", width: 180 },
  { label: "Amount", type: "currency", role: "expense_amount", width: 150 },
  {
    label: "Status",
    type: "select",
    options: ["Paid", "Unpaid", "Pending"],
    width: 120,
  },
  { label: "Notes", type: "text", width: 200 },
];

// POST /api/projects/[id]/sheets — Create a new sheet
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json().catch(() => ({}));

  const existing = await db
    .select()
    .from(sheets)
    .where(eq(sheets.projectId, projectId));

  const maxPos = existing.reduce(
    (m: number, s: { position: number }) => Math.max(m, s.position),
    -1,
  );

  const sheetName = body.name
    ? String(body.name).trim()
    : `Sheet ${existing.length + 1}`;
  const sheetType = body.type ? String(body.type) : "expense";

  const [newSheet] = await db
    .insert(sheets)
    .values({
      projectId,
      name: sheetName,
      type: sheetType,
      position: maxPos + 1,
    })
    .returning();

  // Create default starter columns for the sheet
  const createdColumns = [];
  for (let i = 0; i < DEFAULT_NEW_SHEET_COLUMNS.length; i++) {
    const colDef = DEFAULT_NEW_SHEET_COLUMNS[i];
    const [col] = await db
      .insert(columns)
      .values({
        sheetId: newSheet.id,
        label: colDef.label,
        type: colDef.type,
        options: (colDef.options as string[]) ?? null,
        reconcileRole: (colDef.role as any) ?? null,
        width: colDef.width ?? 180,
        position: i,
      })
      .returning();

    createdColumns.push({
      id: col.id,
      sheetId: col.sheetId,
      label: col.label,
      type: col.type,
      options: col.options,
      reconcileRole: col.reconcileRole,
      width: col.width,
      position: col.position,
    });
  }

  // Create 25 starter rows so the sheet occupies the full grid immediately
  const createdRows = [];
  for (let i = 0; i < 25; i++) {
    const [row] = await db
      .insert(rows)
      .values({
        sheetId: newSheet.id,
        position: i,
      })
      .returning();

    createdRows.push({
      id: row.id,
      position: row.position,
      cells: {},
    });
  }

  return Response.json(
    {
      id: newSheet.id,
      projectId: newSheet.projectId,
      name: newSheet.name,
      type: newSheet.type,
      position: newSheet.position,
      columns: createdColumns,
      rows: createdRows,
    },
    { status: 201 },
  );
}
