import { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb as db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSupabaseUserTables();

  const list = await db
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

  return Response.json(list);
}

export async function POST(req: NextRequest) {
  await ensureSupabaseUserTables();

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const rawPassword = (body.password ?? "team123").toString();
  const role = body.role ? String(body.role) : "member";
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!name || !email) {
    return Response.json(
      { error: "Name and email are required" },
      { status: 400 }
    );
  }

  const password = await hashPassword(rawPassword);

  const [newUser] = await db
    .insert(users)
    .values({ name, email, password, role, phone })
    .returning();

  return Response.json(
    {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      avatarUrl: newUser.avatarUrl ?? null,
      createdAt: newUser.createdAt,
    },
    { status: 201 }
  );
}
