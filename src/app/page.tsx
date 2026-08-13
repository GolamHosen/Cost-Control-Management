import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  // Admins and managers go to dashboard; members go to projects
  if (session?.role === "admin" || session?.role === "manager") {
    redirect("/dashboard");
  } else {
    redirect("/projects");
  }
}
