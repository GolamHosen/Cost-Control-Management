import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, ensureAuthTables } from "@/db";
import { projectMembers, users } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await ensureAuthTables();
  const { id } = await params;
  const projectId = Number(id);

  const members = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      assignedAt: projectMembers.assignedAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
      },
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));

  return Response.json(members);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  await ensureAuthTables();
  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  const role = body.role ? String(body.role) : "member";

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  // Check if already assigned
  const existing = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  if (existing.length > 0) {
    // Update role if already assigned
    await db
      .update(projectMembers)
      .set({ role })
      .where(eq(projectMembers.id, existing[0].id));

    return Response.json({ id: existing[0].id, role });
  }

  const [assigned] = await db
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .returning();

  return Response.json(assigned, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  await ensureAuthTables();
  const { id } = await params;
  const projectId = Number(id);
  const { searchParams } = new URL(req.url);
  const userId = Number(searchParams.get("userId"));

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  return Response.json({ ok: true });
}
