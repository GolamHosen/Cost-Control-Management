import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as pgSchema from "./pg-schema";
import * as tursoSchema from "./turso-schema";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const postgresUrl = process.env.DATABASE_URL;

// Store raw client reference for DDL operations
let rawClient: any = null;

function createDbInstance() {
  if (tursoUrl) {
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    rawClient = client;
    return drizzleLibsql(client, { schema: tursoSchema });
  }

  if (postgresUrl) {
    const globalForDb = globalThis as typeof globalThis & {
      __arenaNextJsPostgresqlPool?: Pool;
    };

    const pool =
      globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: postgresUrl,
      });

    if (process.env.NODE_ENV !== "production") {
      globalForDb.__arenaNextJsPostgresqlPool = pool;
    }

    rawClient = pool;
    return drizzlePg(pool, { schema: pgSchema });
  }

  // Local fallback (development / test)
  const fallbackUrl = process.env.NODE_ENV === "production" ? "file:/tmp/local.db" : "file:local.db";
  const client = createClient({
    url: fallbackUrl,
  });
  rawClient = client;
  return drizzleLibsql(client, { schema: tursoSchema });
}

export const db = createDbInstance() as any;

// ----------------------------------------------------------------------------
// Auto-create auth tables via raw client (bypasses drizzle query builder)
// ----------------------------------------------------------------------------
let tablesInitialized = false;

async function execRaw(statement: string) {
  if (tursoUrl || (!tursoUrl && !postgresUrl)) {
    // libsql client — use .execute(string)
    await rawClient.execute(statement);
  } else if (postgresUrl) {
    // pg Pool — use .query(string)
    await rawClient.query(statement);
  }
}

export async function ensureAuthTables() {
  if (tablesInitialized) return;
  if (!rawClient) return;

  try {
    if (tursoUrl || (!tursoUrl && !postgresUrl)) {
      // SQLite / Turso
      await execRaw(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          phone TEXT,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        )
      `);
      await execRaw(`
        CREATE TABLE IF NOT EXISTS project_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'member',
          assigned_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        )
      `);
      await execRaw(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
        )
      `);
      // Add progress column if missing
      try {
        await execRaw(`ALTER TABLE projects ADD COLUMN progress INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // Column already exists — safe to ignore
      }
    } else if (postgresUrl) {
      // PostgreSQL
      await execRaw(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          phone TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      await execRaw(`
        CREATE TABLE IF NOT EXISTS project_members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'member',
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      await execRaw(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
      try {
        await execRaw(`ALTER TABLE projects ADD COLUMN progress INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // Column already exists
      }
    }
    tablesInitialized = true;
    console.log("✅ Auth tables verified/created successfully");
  } catch (err) {
    console.error("Failed auto-creating auth tables:", err);
  }
}
