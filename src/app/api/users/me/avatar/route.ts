import { eq } from "drizzle-orm";
import { ensureSupabaseUserTables, supabaseDb as db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  deleteAvatarFile,
  saveAvatarFile,
  toPublicUser,
  validateAvatarFile,
} from "@/lib/avatar-storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSupabaseUserTables();

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Avatar file is required" }, { status: 400 });
  }

  const validationError = validateAvatarFile(file);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const [currentUser] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId));

  const avatarUrl = await saveAvatarFile(session.userId, file);

  await db.update(users).set({ avatarUrl }).where(eq(users.id, session.userId));
  await deleteAvatarFile(currentUser?.avatarUrl);

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

  return Response.json({
    avatarUrl,
    user: updated ? toPublicUser(updated) : null,
  });
}

export async function DELETE() {
  await ensureSupabaseUserTables();

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [currentUser] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId));

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, session.userId));
  await deleteAvatarFile(currentUser?.avatarUrl);

  return Response.json({ ok: true });
}
