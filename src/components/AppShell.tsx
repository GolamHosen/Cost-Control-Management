"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string; avatarUrl?: string | null } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
