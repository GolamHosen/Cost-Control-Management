import { supabaseDb, tursoDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.all([supabaseDb.execute(sql`select 1`), tursoDb.run(sql`select 1`)]);
    return Response.json({ ok: true, supabase: true, turso: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
