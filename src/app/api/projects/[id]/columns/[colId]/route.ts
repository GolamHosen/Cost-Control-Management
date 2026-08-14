import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { columns } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; colId: string }> };

// Update a column (rename / retype / options / width / role / reorder).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { colId } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof columns.$inferInsert> = {};

  if ("label" in body) patch.label = String(body.label);
  if ("type" in body) patch.type = String(body.type);
  if ("options" in body) patch.options = Array.isArray(body.options) ? body.options : null;
  if ("width" in body) patch.width = Number(body.width) || 180;
  if ("position" in body) patch.position = Number(body.position);
  if ("reconcileRole" in body) {
    patch.reconcileRole = body.reconcileRole ? String(body.reconcileRole) : null;
  }

  await db.transaction(async (tx: any) => {
    if (patch.reconcileRole) {
      // Enforce one column per reconcile role within a sheet.
      const cur = await tx
        .select({ sheetId: columns.sheetId })
        .from(columns)
        .where(eq(columns.id, Number(colId)));
      if (cur[0]) {
        await tx
          .update(columns)
          .set({ reconcileRole: null })
          .where(
            and(
              eq(columns.sheetId, cur[0].sheetId),
              eq(columns.reconcileRole, patch.reconcileRole),
              ne(columns.id, Number(colId)),
            ),
          );
      }
    }
    await tx.update(columns).set(patch).where(eq(columns.id, Number(colId)));
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { colId } = await params;
  await db.delete(columns).where(eq(columns.id, Number(colId)));
  return Response.json({ ok: true });
}
