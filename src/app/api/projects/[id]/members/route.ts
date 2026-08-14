import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb, tursoDb } from "@/db";
import { projectMembers, users } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await ensureSupabaseUserTables();
  const { id } = await params;
  const projectId = Number(id);

  const members = await tursoDb
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      assignedAt: projectMembers.assignedAt,
    })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  if (!members.length) return Response.json([]);

  const userIds = [...new Set(members.map((member) => member.userId))];
  const memberUsers = await supabaseDb
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const usersById = new Map(memberUsers.map((user) => [user.id, user]));

  // A deleted Supabase user is not returned as a ghost project member.
  return Response.json(
    members.flatMap((member) => {
      const user = usersById.get(member.userId);
      return user ? [{ ...member, user }] : [];
    }),
  );
}

export async function POST(req: NextRequest, { params }: Ctx) {
  await ensureSupabaseUserTables();
  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  const role = body.role ? String(body.role) : "member";

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  const [user] = await supabaseDb.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await tursoDb
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  if (existing.length > 0) {
    await tursoDb
      .update(projectMembers)
      .set({ role })
      .where(eq(projectMembers.id, existing[0].id));

    return Response.json({ id: existing[0].id, role });
  }

  const [assigned] = await tursoDb
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .returning();

  return Response.json(assigned, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const projectId = Number(id);
  const { searchParams } = new URL(req.url);
  const userId = Number(searchParams.get("userId"));

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  await tursoDb
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  return Response.json({ ok: true });
}
