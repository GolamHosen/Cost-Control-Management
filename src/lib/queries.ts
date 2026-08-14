import { asc, desc, eq, inArray } from "drizzle-orm";
import { supabaseDb, tursoDb } from "@/db";
import { columns, projectMembers, projects, rows, sheets, users } from "@/db/schema";
import type { Column, Project, ProjectMember, Sheet, SheetRow, User, UserRole } from "./types";

async function rawList() {
  return tursoDb.query.projects.findMany({
    with: {
      members: true,
      sheets: {
        orderBy: [asc(sheets.position)],
        with: {
          columns: { orderBy: [asc(columns.position)] },
          rows: {
            orderBy: [asc(rows.position)],
            with: { cells: true },
          },
        },
      },
    },
    orderBy: [desc(projects.createdAt)],
  });
}

type RawProject = Awaited<ReturnType<typeof rawList>>[number];

function mapColumn(c: RawProject["sheets"][number]["columns"][number]): Column {
  return {
    id: c.id,
    sheetId: c.sheetId,
    label: c.label,
    type: c.type as Column["type"],
    options: c.options ?? null,
    reconcileRole: (c.reconcileRole ?? null) as Column["reconcileRole"],
    width: c.width,
    position: c.position,
  };
}

function mapSheet(s: RawProject["sheets"][number]): Sheet {
  return {
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    type: s.type as Sheet["type"],
    position: s.position,
    columns: s.columns.map(mapColumn),
    rows: s.rows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((r): SheetRow => {
        const cellMap: Record<number, string> = {};
        for (const cell of r.cells) cellMap[cell.columnId] = cell.value ?? "";
        return { id: r.id, position: r.position, cells: cellMap };
      }),
  };
}

function mapMember(m: RawProject["members"][number]): ProjectMember {
  return {
    id: m.id,
    projectId: m.projectId,
    userId: m.userId,
    role: m.role as ProjectMember["role"],
    assignedAt: m.assignedAt ? String(m.assignedAt) : "",
  };
}

function mapProject(p: RawProject): Project {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    location: p.location,
    budget: p.budget,
    startDate: p.startDate,
    status: p.status,
    progress: p.progress ?? 0,
    createdAt: p.createdAt ? String(p.createdAt) : "",
    sheets: p.sheets.slice().sort((a, b) => a.position - b.position).map(mapSheet),
    members: p.members.map(mapMember),
  };
}

/** Adds Supabase user details to Turso project memberships without a cross-DB join. */
async function hydrateMembers(projectList: Project[]): Promise<Project[]> {
  const userIds = [...new Set(projectList.flatMap((project) => project.members?.map((m) => m.userId) ?? []))];
  if (!userIds.length) return projectList;

  const dbUsers = await supabaseDb
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
    .where(inArray(users.id, userIds));

  const usersById = new Map<number, User>(
    dbUsers.map((user) => [
      user.id,
      {
        ...user,
        role: user.role as UserRole,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: String(user.createdAt),
      },
    ]),
  );

  return projectList.map((project) => ({
    ...project,
    members: project.members?.map((member) => ({
      ...member,
      user: usersById.get(member.userId),
    })),
  }));
}

export async function listProjects(userId?: number, userRole?: string): Promise<Project[]> {
  const rawProjects = await rawList();
  const visibleProjects =
    userRole === "member" && userId
      ? rawProjects.filter((project) => project.members.some((member) => member.userId === userId))
      : rawProjects;

  return hydrateMembers(visibleProjects.map(mapProject));
}

export async function getProject(
  id: number,
  userId?: number,
  userRole?: string,
): Promise<Project | null> {
  const project = await tursoDb.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      members: true,
      sheets: {
        orderBy: [asc(sheets.position)],
        with: {
          columns: { orderBy: [asc(columns.position)] },
          rows: {
            orderBy: [asc(rows.position)],
            with: { cells: true },
          },
        },
      },
    },
  });

  if (!project) return null;

  if (userRole === "member" && userId && !project.members.some((member) => member.userId === userId)) {
    return null;
  }

  const [hydrated] = await hydrateMembers([mapProject(project)]);
  return hydrated;
}
