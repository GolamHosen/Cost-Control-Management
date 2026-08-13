import { NextRequest } from "next/server";
import { db } from "@/db";
import { projects, projectMembers } from "@/db/schema";
import { seedDefaultSheets } from "@/lib/defaults";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Create a project and seed it with the two default cross-checkable sheets.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim() || "Untitled Project";
  const client = body.client ? String(body.client).trim() : null;
  const location = body.location ? String(body.location).trim() : null;
  const budget = body.budget ? String(body.budget) : null;
  const startDate = body.startDate ? String(body.startDate) : null;
  const status = body.status ? String(body.status) : "Active";
  const withSample = body.withSample !== false;

  const session = await getSession();

  const [project] = await db
    .insert(projects)
    .values({ name, client, location, budget, startDate, status })
    .returning();

  await seedDefaultSheets(db, project.id, withSample);

  // Automatically assign creator as a project member
  if (session?.userId) {
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId: session.userId,
      role: "lead",
    });
  }

  return Response.json({ id: project.id }, { status: 201 });
}
