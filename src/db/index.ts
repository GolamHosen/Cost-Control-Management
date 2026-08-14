import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "./pg-schema";
import * as tursoSchema from "./turso-schema";

// Supabase is PostgreSQL-compatible; DATABASE_URL is accepted only as a
// temporary migration fallback for existing deployments.
const supabaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
const tursoUrl = process.env.TURSO_DATABASE_URL;

if (!supabaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL is required for Supabase user and profile storage.");
}

if (!tursoUrl) {
  throw new Error("TURSO_DATABASE_URL is required for Turso project storage.");
}

const globalForDb = globalThis as typeof globalThis & {
  __buildLedgerSupabasePool?: Pool;
  __buildLedgerTursoClient?: ReturnType<typeof createClient>;
};

const supabasePool =
  globalForDb.__buildLedgerSupabasePool ?? new Pool({ connectionString: supabaseUrl });
const tursoClient =
  globalForDb.__buildLedgerTursoClient ??
  createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__buildLedgerSupabasePool = supabasePool;
  globalForDb.__buildLedgerTursoClient = tursoClient;
}

export const supabaseDb = drizzlePg(supabasePool, { schema: pgSchema });
export const tursoDb = drizzleLibsql(tursoClient, { schema: tursoSchema });

// Supabase user/profile tables are created lazily so authentication routes work
// on a fresh deployment. Project tables are managed with db:push:turso.
let userTablesInitialized = false;

export async function ensureSupabaseUserTables() {
  if (userTablesInitialized) return;

  await supabasePool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      phone TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await supabasePool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  await supabasePool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);

  userTablesInitialized = true;
}

// Temporary compatibility export for existing callers while they are migrated.
export const ensureUserTables = ensureSupabaseUserTables;
export const ensureAuthTables = ensureSupabaseUserTables;
