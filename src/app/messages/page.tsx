import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MessagesClient from "@/components/MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-6">
      <MessagesClient currentUserId={session.userId} />
    </div>
  );
}
