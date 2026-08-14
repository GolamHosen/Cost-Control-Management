import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb as db } from "@/db";
import { users } from "@/db/schema";
import { createSession, getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { toPublicUser } from "@/lib/avatar-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSupabaseUserTables();

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
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
    .where(eq(users.id, session.userId));

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(toPublicUser(user));
}

export async function PATCH(req: NextRequest) {
  await ensureSupabaseUserTables();

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    patch.name = name;
  }

  if ("phone" in body) {
    patch.phone = body.phone ? String(body.phone).trim() : null;
  }

  if ("email" in body) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (existing && existing.id !== session.userId) {
      return Response.json({ error: "Email is already in use" }, { status: 409 });
    }

    patch.email = email;
  }

  const newPassword = body.newPassword ? String(body.newPassword) : "";
  if (newPassword) {
    const currentPassword = String(body.currentPassword ?? "");
    if (!currentPassword) {
      return Response.json({ error: "Current password is required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const [currentUser] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, currentUser.password);
    if (!valid) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    patch.password = await hashPassword(newPassword);
  }

  if (Object.keys(patch).length === 0) {
    const [user] = await db
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
      .where(eq(users.id, session.userId));

    return Response.json(user ? toPublicUser(user) : { ok: true });
  }

  await db.update(users).set(patch).where(eq(users.id, session.userId));

  const [updated] = await db
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
    .where(eq(users.id, session.userId));

  if (!updated) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if ("name" in patch || "email" in patch) {
    await createSession({
      userId: session.userId,
      name: updated.name,
      email: updated.email,
      role: updated.role as "admin" | "manager" | "member",
    });
  }

  return Response.json(toPublicUser(updated));
}
