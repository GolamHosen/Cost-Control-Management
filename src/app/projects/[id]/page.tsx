import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import Workspace from "@/components/Workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const project = await getProject(Number(id), session?.userId, session?.role);
  if (!project) notFound();

  return <Workspace initial={project} />;
}
