import { redirect } from "next/navigation";
import { listProjects } from "@/lib/queries";
import { asc } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb as db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Only admin and manager can access the dashboard
  const session = await getSession();
  if (!session || session.role === "member") {
    redirect("/projects");
  }

  await ensureSupabaseUserTables();

  const projects = await listProjects();

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

  return (
    <DashboardClient
      projects={projects}
      teamMembers={teamMembers.map((u: any) => ({
        ...u,
        avatarUrl: u.avatarUrl ?? null,
        createdAt: u.createdAt ? String(u.createdAt) : "",
      }))}
    />
  );
}
