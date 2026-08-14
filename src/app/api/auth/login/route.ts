import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb as db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();

  if (!email || !password) {
    return Response.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Ensure auth tables exist
  await ensureSupabaseUserTables();

  const userList = await db.select().from(users).where(eq(users.email, email));
  const user = userList[0];

  if (!user) {
    return Response.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return Response.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "admin" | "manager" | "member",
  };

  await createSession(payload);

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  });
}
