import { NextRequest } from "next/server";
import { tursoDb as db } from "@/db";
import { cells } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Upsert a single cell value (Excel-like inline edit).
export async function PUT(req: NextRequest, _ctx: Ctx) {
  const body = await req.json().catch(() => ({}));
  const rowId = Number(body.rowId);
  const columnId = Number(body.columnId);
  const value =
    body.value === null || body.value === undefined ? null : String(body.value);

  await db
    .insert(cells)
    .values({ rowId, columnId, value })
    .onConflictDoUpdate({
      target: [cells.rowId, cells.columnId],
      set: { value },
    });

  return Response.json({ ok: true });
}
