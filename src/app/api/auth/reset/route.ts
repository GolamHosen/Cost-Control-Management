import { ensureSupabaseUserTables, supabaseDb, tursoDb } from "@/db";
import { projectMembers, users } from "@/db/schema";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return clearAllUsers();
}

export async function POST() {
  return clearAllUsers();
}

async function clearAllUsers() {
  try {
    await ensureSupabaseUserTables();

    // Memberships carry Supabase user IDs but remain project data in Turso.
    await tursoDb.delete(projectMembers);
    await supabaseDb.delete(users);
    await destroySession().catch(() => {});

    return Response.json({
      ok: true,
      message: "Supabase registration data and Turso project memberships were cleared.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to clear registration data";
    return Response.json({ error: message }, { status: 500 });
  }
}
