import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseDb as db } from "@/db";
import { messages, users } from "@/db/schema";
import { and, eq, or, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/messages — List all contacts with last message & unread counts
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.userId;

  // Get all users except current user
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(sql`${users.id} != ${currentUserId}`);

  // Fetch all messages involving the current user
  const userMessages = await db
    .select()
    .from(messages)
    .where(
      or(
        eq(messages.senderId, currentUserId),
        eq(messages.receiverId, currentUserId)
      )
    )
    .orderBy(desc(messages.createdAt));

  // Build contact previews with last message and unread count
  const contacts = allUsers.map((u: { id: number; name: string; email: string; role: string; avatarUrl: string | null }) => {
    const chat = userMessages.filter(
      (m: { senderId: number; receiverId: number }) => m.senderId === u.id || m.receiverId === u.id
    );
    const lastMsg = chat[0] ?? null;
    const unreadCount = chat.filter(
      (m: { senderId: number; receiverId: number; isRead: number }) =>
        m.senderId === u.id && m.receiverId === currentUserId && m.isRead === 0
    ).length;

    return {
      user: u,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt,
            senderId: lastMsg.senderId,
          }
        : null,
      unreadCount,
    };
  });

  // Sort contacts by latest message timestamp, then by name
  contacts.sort((a: any, b: any) => {
    if (a.lastMessage && b.lastMessage) {
      return (
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
      );
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  return Response.json({ contacts, currentUserId });
}

// POST /api/messages — Send a new message
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const receiverId = Number(body.receiverId);
  const content = String(body.content ?? "").trim();

  if (!receiverId || !content) {
    return Response.json(
      { error: "Receiver ID and message content are required" },
      { status: 400 }
    );
  }

  // Ensure receiver exists
  const receiver = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, receiverId));

  if (!receiver[0]) {
    return Response.json({ error: "Recipient not found" }, { status: 404 });
  }

  const [msg] = await db
    .insert(messages)
    .values({
      senderId: session.userId,
      receiverId,
      content,
      isRead: 0,
    })
    .returning();

  return Response.json(msg, { status: 201 });
}
