import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { supabaseDb, tursoDb } from "@/db";
import { projectMembers, projects, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const targetId = Number(id);

  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Only admins can delete users" }, { status: 403 });
  }

  const [targetUser] = await supabaseDb.select().from(users).where(eq(users.id, targetId));
  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.role === "admin") {
    return Response.json({ error: "Admin accounts are protected from deletion" }, { status: 400 });
  }

  // Project memberships are stored in Turso and must be cleaned up before
  // removing the Supabase user. This cannot be a cross-database transaction.
  const memberships = await tursoDb
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, targetId));
  const soleProjectIds: number[] = [];

  for (const { projectId } of memberships) {
    const allMembers = await tursoDb
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    if (allMembers.length === 1 && allMembers[0].userId === targetId) {
      soleProjectIds.push(projectId);
    }
  }

  if (soleProjectIds.length) {
    await tursoDb.delete(projects).where(inArray(projects.id, soleProjectIds));
  }
  await tursoDb.delete(projectMembers).where(eq(projectMembers.userId, targetId));
  await supabaseDb.delete(users).where(eq(users.id, targetId));

  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
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

  await supabaseDb.update(users).set(patch).where(eq(users.id, Number(id)));
  return Response.json({ ok: true });
}
