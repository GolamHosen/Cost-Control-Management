import { db, ensureAuthTables } from "@/db";
import { users, projectMembers } from "@/db/schema";
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
    await ensureAuthTables();

    // Delete all project memberships and users permanently
    await db.delete(projectMembers).catch(() => {});
    await db.delete(users);

    // Destroy active session cookie
    await destroySession().catch(() => {});

    return Response.json({
      ok: true,
      message: "Database registration data cleared completely. You can now register fresh accounts.",
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to clear registration data" },
      { status: 500 }
    );
  }
}
