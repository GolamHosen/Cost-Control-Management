import { ensureAuthTables } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return verifyAuthSystem();
}

export async function POST() {
  return verifyAuthSystem();
}

async function verifyAuthSystem() {
  try {
    await ensureAuthTables();
    return Response.json({
      ok: true,
      message: "Database tables verified",
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to verify database tables" },
      { status: 500 }
    );
  }
}
