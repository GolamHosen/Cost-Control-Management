import { supabaseDb, tursoDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [supabase, turso] = await Promise.allSettled([
    supabaseDb.execute(sql.raw("select 1")),
    tursoDb.run(sql.raw("select 1")),
  ]);
  const supabaseOk = supabase.status === "fulfilled";
  const tursoOk = turso.status === "fulfilled";
  const ok = supabaseOk && tursoOk;

  if (!ok) {
    console.error("Database health check failed.", {
      supabase: supabaseOk ? "ok" : getErrorCode(supabase.reason),
      turso: tursoOk ? "ok" : getErrorCode(turso.reason),
    });
  }

  return Response.json(
    {
      ok,
      services: {
        supabase: supabaseOk,
        turso: tursoOk,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "unknown";
}
