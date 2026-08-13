import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, projectMembers, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const targetId = Number(id);

  // Only admins can delete users
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Only admins can delete users" }, { status: 403 });
  }

  // Find target user
  const targetUsers = await db.select().from(users).where(eq(users.id, targetId));
  const targetUser = targetUsers[0];

  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Protect Admin accounts from deletion
  if (targetUser.role === "admin") {
    return Response.json(
      { error: "Admin accounts are protected from deletion" },
      { status: 400 }
    );
  }

  // Find all projects this user is a member of
  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, targetId));

  // For each project, check if this user is the ONLY member — if so, delete the project entirely
  for (const { projectId } of memberships) {
    const allMembers = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));

    if (allMembers.length === 1 && allMembers[0].userId === targetId) {
      await db.delete(projects).where(eq(projects.id, projectId));
    }
  }

  // Permanently delete user from database
  await db.delete(users).where(eq(users.id, targetId));

  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  // Only admins can edit users
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Only admins can edit users" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if ("name" in body) patch.name = String(body.name).trim();
  if ("email" in body) patch.email = String(body.email).trim().toLowerCase();
  if ("role" in body) patch.role = String(body.role);
  if ("phone" in body) patch.phone = body.phone ? String(body.phone).trim() : null;

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: true });
  }

  await db.update(users).set(patch).where(eq(users.id, Number(id)));
  return Response.json({ ok: true });
}
