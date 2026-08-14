import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, ensureAuthTables } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { toPublicUser } from "@/lib/avatar-storage";
import ProfileClient from "@/components/ProfileClient";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await ensureAuthTables();

  const [row] = await db
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

  if (!row) {
    redirect("/login");
  }

  const user = {
    ...toPublicUser(row),
    role: row.role as UserRole,
  };

  return (
    <div className="p-6">
      <ProfileClient initialUser={user} />
    </div>
  );
}
