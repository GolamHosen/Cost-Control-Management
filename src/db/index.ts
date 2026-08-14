import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "./pg-schema";
import { readSupabaseConnectionString } from "./supabase-connection";
import * as tursoSchema from "./turso-schema";

const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

function readPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

const {
  connectionString: supabaseUrl,
  usesDirectConnection: usesSupabaseDirectConnection,
} = readSupabaseConnectionString();
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

if (!tursoUrl) {
  throw new Error("TURSO_DATABASE_URL is required for Turso project storage.");
}

const globalForDb = globalThis as typeof globalThis & {
  __buildLedgerSupabasePool?: Pool;
  __buildLedgerTursoClient?: ReturnType<typeof createClient>;
  __buildLedgerSupabaseTablesInitialization?: Promise<void>;
};

function createSupabasePool() {
  const pool = new Pool({
    connectionString: supabaseUrl,
    max: readPositiveInteger("SUPABASE_POOL_MAX", 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "buildledger",
  });

  // node-postgres emits pool errors for idle clients. Handling them prevents an
  // unhandled event from terminating the server and avoids logging credentials.
  pool.on("error", (error) => {
    console.error("Unexpected Supabase PostgreSQL pool error.", {
      code: getErrorCode(error) ?? "unknown",
    });
  });

  return pool;
}

const supabasePool =
  globalForDb.__buildLedgerSupabasePool ?? createSupabasePool();
const tursoClient =
  globalForDb.__buildLedgerTursoClient ??
  createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });

if (IS_DEVELOPMENT) {
  globalForDb.__buildLedgerSupabasePool = supabasePool;
  globalForDb.__buildLedgerTursoClient = tursoClient;
}

export const supabaseDb = drizzlePg(supabasePool, { schema: pgSchema });
export const tursoDb = drizzleLibsql(tursoClient, { schema: tursoSchema });

function withSupabaseConnectionGuidance(error: unknown): Error {
  const code = getErrorCode(error);

  if (code === "ENOTFOUND" && usesSupabaseDirectConnection) {
    return new Error(
      "The configured Supabase direct database endpoint could not be resolved by this runtime. " +
        "Direct Supabase endpoints are IPv6-only by default. Copy the exact Session pooler " +
        "connection string from Supabase Dashboard > Connect into SUPABASE_DATABASE_URL, then restart the app."
    );
  }

  if (code === "ENOTFOUND") {
    return new Error(
      "The configured Supabase database hostname could not be resolved. " +
        "Copy the exact connection string from Supabase Dashboard > Connect and verify the project is active."
    );
  }

  if (code === "28P01") {
    return new Error(
      "Supabase rejected the database credentials. Copy a fresh connection string from Supabase Dashboard > Connect."
    );
  }

  if (code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    return new Error(
      "The Supabase database could not be reached. Verify the project is active and that network restrictions allow this runtime."
    );
  }

  return error instanceof Error
    ? error
    : new Error("Supabase database initialization failed.");
}

async function initializeSupabaseUserTables() {
  const client = await supabasePool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      [
        "CREATE TABLE IF NOT EXISTS users (",
        "  id SERIAL PRIMARY KEY,",
        "  name TEXT NOT NULL,",
        "  email TEXT NOT NULL,",
        "  password TEXT NOT NULL,",
        "  role TEXT NOT NULL DEFAULT 'member',",
        "  phone TEXT,",
        "  avatar_url TEXT,",
        "  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL",
        ")",
      ].join("\n")
    );
    await client.query(
      [
        "CREATE TABLE IF NOT EXISTS messages (",
        "  id SERIAL PRIMARY KEY,",
        "  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
        "  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,",
        "  content TEXT NOT NULL,",
        "  is_read INTEGER NOT NULL DEFAULT 0,",
        "  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL",
        ")",
      ].join("\n")
    );
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

let localSupabaseTablesInitialization: Promise<void> | undefined;

// This transitional bootstrap keeps fresh installations working while ensuring
// concurrent requests share a single initialization transaction.
export function ensureSupabaseUserTables() {
  const existingInitialization = IS_DEVELOPMENT
    ? globalForDb.__buildLedgerSupabaseTablesInitialization
    : localSupabaseTablesInitialization;

  if (existingInitialization) return existingInitialization;

  const initialization = initializeSupabaseUserTables().catch((error) => {
    if (
      IS_DEVELOPMENT &&
      globalForDb.__buildLedgerSupabaseTablesInitialization === initialization
    ) {
      globalForDb.__buildLedgerSupabaseTablesInitialization = undefined;
    }

    if (!IS_DEVELOPMENT && localSupabaseTablesInitialization === initialization) {
      localSupabaseTablesInitialization = undefined;
    }

    throw withSupabaseConnectionGuidance(error);
  });

  if (IS_DEVELOPMENT) {
    globalForDb.__buildLedgerSupabaseTablesInitialization = initialization;
  } else {
    localSupabaseTablesInitialization = initialization;
  }

  return initialization;
}

// Temporary compatibility exports for existing callers while they are migrated.
export const ensureUserTables = ensureSupabaseUserTables;
export const ensureAuthTables = ensureSupabaseUserTables;
