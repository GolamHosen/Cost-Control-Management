import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { columns } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Add a new (dynamic) column header to a sheet.
export async function POST(req: NextRequest, _ctx: Ctx) {
  const body = await req.json().catch(() => ({}));
  const sheetId = Number(body.sheetId);
  const label = body.label ? String(body.label).trim() : "New Column";
  const type = body.type ? String(body.type) : "text";

  const existing = await db.select().from(columns).where(eq(columns.sheetId, sheetId));
  const maxPos = existing.reduce((m: number, c: { position: number }) => Math.max(m, c.position), -1);

  const [col] = await db
    .insert(columns)
    .values({ sheetId, label, type, position: maxPos + 1, width: 180 })
    .returning();

  return Response.json(col, { status: 201 });
}
