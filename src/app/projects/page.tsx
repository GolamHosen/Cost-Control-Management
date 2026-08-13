import { listProjects } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getSession();
  const projects = await listProjects(session?.userId, session?.role);
  return <HomeClient projects={projects} />;
}
