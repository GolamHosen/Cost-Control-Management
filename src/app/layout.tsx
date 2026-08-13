import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "BuildLedger — Construction Cost Control & Payment Tracker",
  description:
    "Admin dashboard for construction project cost control, team management, and budget reconciliation.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let user: { name: string; email: string; role: string } | null = null;
  try {
    const session = await getSession();
    if (session) {
      user = { name: session.name, email: session.email, role: session.role };
    }
  } catch {
    // no session
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-slate-100 font-[Inter,sans-serif] text-slate-900 antialiased"
        suppressHydrationWarning
      >
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
