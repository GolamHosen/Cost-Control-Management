import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseDb as db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq, or, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

// GET /api/messages/[userId] — Fetch full chat history between current user and specified user
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const partnerId = Number(userId);
  const currentUserId = session.userId;

  if (!partnerId) {
    return Response.json({ error: "Invalid partner user ID" }, { status: 400 });
  }

  // Fetch messages between current user & partner
  const thread = await db
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.senderId, currentUserId), eq(messages.receiverId, partnerId)),
        and(eq(messages.senderId, partnerId), eq(messages.receiverId, currentUserId))
      )
    )
    .orderBy(asc(messages.createdAt));

  return Response.json(thread);
}

// PATCH /api/messages/[userId] — Mark all messages from partner to current user as read
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const partnerId = Number(userId);
  const currentUserId = session.userId;

  await db
    .update(messages)
    .set({ isRead: 1 })
    .where(
      and(
        eq(messages.senderId, partnerId),
        eq(messages.receiverId, currentUserId),
        eq(messages.isRead, 0)
      )
    );

  return Response.json({ ok: true });
}
