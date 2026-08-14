import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { rows } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Append a new empty row.
export async function POST(req: NextRequest, _ctx: Ctx) {
  const body = await req.json().catch(() => ({}));
  const sheetId = Number(body.sheetId);

  const existing = await db.select().from(rows).where(eq(rows.sheetId, sheetId));
  const maxPos = existing.reduce((m: number, r: { position: number }) => Math.max(m, r.position), -1);

  const [row] = await db
    .insert(rows)
    .values({ sheetId, position: maxPos + 1 })
    .returning();

  return Response.json({ id: row.id, position: row.position }, { status: 201 });
}
