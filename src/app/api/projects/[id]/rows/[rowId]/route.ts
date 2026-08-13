import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rows } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; rowId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { rowId } = await params;
  await db.delete(rows).where(eq(rows.id, Number(rowId)));
  return Response.json({ ok: true });
}
