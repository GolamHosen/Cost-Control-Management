import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, ensureAuthTables } from "@/db";
import { users, projectMembers, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import TeamClient from "@/components/TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await ensureAuthTables();

  // Only admin and manager can access team management
  const session = await getSession();
  if (!session || session.role === "member") {
    redirect("/projects");
  }

  const teamMembers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));

  // Get all project assignments with project info
  const assignments = await db
    .select({
      userId: projectMembers.userId,
      memberRole: projectMembers.role,
      projectId: projects.id,
      projectName: projects.name,
      projectStatus: projects.status,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id));

  // Build a map: userId -> assigned projects
  const assignmentMap: Record<
    number,
    { projectId: number; projectName: string; projectStatus: string; memberRole: string }[]
  > = {};
  for (const a of assignments) {
    if (!assignmentMap[a.userId]) assignmentMap[a.userId] = [];
    assignmentMap[a.userId].push({
      projectId: a.projectId,
      projectName: a.projectName,
      projectStatus: a.projectStatus,
      memberRole: a.memberRole,
    });
  }

  // Get all projects for the assignment modal
  const allProjects = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .orderBy(asc(projects.name));

  return (
    <TeamClient
      teamMembers={teamMembers.map((u: any) => ({
        ...u,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: u.createdAt ? String(u.createdAt) : "",
      }))}
      assignmentMap={assignmentMap}
      allProjects={allProjects}
    />
  );
}
