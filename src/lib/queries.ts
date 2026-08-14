import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { columns, projects, rows, sheets, projectMembers, users } from "@/db/schema";
import type { Column, Project, ProjectMember, Sheet, SheetRow, UserRole } from "./types";

async function rawList() {
  return db.query.projects.findMany({
    with: {
      members: {
        with: {
          user: true,
        },
      },
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
      .sort((a: any, b: any) => a.position - b.position)
      .map((r: any): SheetRow => {
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
    role: m.role as any,
    assignedAt: m.assignedAt ? String(m.assignedAt) : "",
    user: m.user
      ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.user.role as UserRole,
          phone: m.user.phone ?? null,
          avatarUrl: m.user.avatarUrl ?? null,
          createdAt: m.user.createdAt ? String(m.user.createdAt) : "",
        }
      : undefined,
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
    sheets: p.sheets.slice().sort((a: any, b: any) => a.position - b.position).map(mapSheet),
    members: p.members ? p.members.map(mapMember) : [],
  };
}

export async function listProjects(userId?: number, userRole?: string): Promise<Project[]> {
  const all = await rawList();
  if (userRole === "member" && userId) {
    return all
      .filter((p: any) => p.members.some((m: any) => m.userId === userId))
      .map(mapProject);
  }
  return all.map(mapProject);
}

export async function getProject(
  id: number,
  userId?: number,
  userRole?: string
): Promise<Project | null> {
  const p = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      members: {
        with: {
          user: true,
        },
      },
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

  if (!p) return null;

  if (userRole === "member" && userId) {
    const isMember = p.members.some((m: any) => m.userId === userId);
    if (!isMember) return null;
  }

  return mapProject(p as any);
}
