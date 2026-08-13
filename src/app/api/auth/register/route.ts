import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureAuthTables } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAuthTables();
  const existingAdmins = await db.select().from(users).where(eq(users.role, "admin"));
  return Response.json({ hasAdmin: existingAdmins.length > 0 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();
  const roleInput = (body.role ?? "member").toString().trim().toLowerCase();

  const role = roleInput === "admin" ? "admin" : "member";

  if (!name || !email || !password) {
    return Response.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { error: "Password must be at least 6 characters long" },
      { status: 400 }
    );
  }

  // Ensure auth tables exist
  await ensureAuthTables();

  // Check one-time Admin constraint
  if (role === "admin") {
    const existingAdmins = await db.select().from(users).where(eq(users.role, "admin"));
    if (existingAdmins.length > 0) {
      return Response.json(
        {
          error:
            "An Admin account already exists in the system. Admin registration is a one-time setup.",
        },
        { status: 400 }
      );
    }
  }

  // Check if user email already exists
  const existingUsers = await db.select().from(users).where(eq(users.email, email));
  if (existingUsers.length > 0) {
    return Response.json(
      { error: "An account with this email already exists" },
      { status: 400 }
    );
  }

  const hashedPassword = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      password: hashedPassword,
      role,
    })
    .returning();

  const payload = {
    userId: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role as "admin" | "manager" | "member",
  };

  await createSession(payload);

  return Response.json({
    ok: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
}
