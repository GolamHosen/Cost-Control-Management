import { getSession } from "@/lib/auth";
import { supabaseDb as db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/messages/unread — Get total unread messages for current user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ unreadCount: 0 });
  }

  const unread = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.receiverId, session.userId),
        eq(messages.isRead, 0)
      )
    );

  return Response.json({ unreadCount: unread.length });
}
