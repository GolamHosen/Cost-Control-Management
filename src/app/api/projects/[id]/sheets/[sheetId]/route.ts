import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { cells, columns, rows, sheets } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; sheetId: string }> };

// PATCH /api/projects/[id]/sheets/[sheetId] — Rename or update sheet
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { sheetId } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof sheets.$inferInsert> = {};

  if ("name" in body) patch.name = String(body.name).trim();
  if ("type" in body) patch.type = String(body.type);
  if ("position" in body) patch.position = Number(body.position);

  await db.update(sheets).set(patch).where(eq(sheets.id, Number(sheetId)));

  return Response.json({ ok: true });
}

// DELETE /api/projects/[id]/sheets/[sheetId] — Delete a sheet and its data
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { sheetId } = await params;
  const sId = Number(sheetId);

  const sheetRows = await db
    .select({ id: rows.id })
    .from(rows)
    .where(eq(rows.sheetId, sId));
  const rowIds = sheetRows.map((r) => r.id);
  if (rowIds.length) {
    await db.delete(cells).where(inArray(cells.rowId, rowIds));
  }

  await db.delete(rows).where(eq(rows.sheetId, sId));
  await db.delete(columns).where(eq(columns.sheetId, sId));
  await db.delete(sheets).where(eq(sheets.id, sId));

  return Response.json({ ok: true });
}
