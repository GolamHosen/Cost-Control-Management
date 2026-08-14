import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { tursoDb as db } from "@/db";
import { projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getSession();

  const project = await getProject(Number(id), session?.userId, session?.role);
  if (!project) {
    return Response.json({ error: "Project not found or unauthorized" }, { status: 403 });
  }

  await db.delete(projects).where(eq(projects.id, Number(id)));
  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getSession();

  const project = await getProject(Number(id), session?.userId, session?.role);
  if (!project) {
    return Response.json({ error: "Project not found or unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  for (const key of ["name", "client", "location", "startDate", "status"]) {
    if (key in body) patch[key] = body[key] === undefined ? null : body[key];
  }
  if ("budget" in body) patch.budget = body.budget ? String(body.budget) : null;
  if ("progress" in body) patch.progress = Math.min(100, Math.max(0, Number(body.progress) || 0));

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: true });
  }

  await db.update(projects).set(patch).where(eq(projects.id, Number(id)));
  return Response.json({ ok: true });
}
