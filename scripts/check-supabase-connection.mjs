import dotenv from "dotenv";
import pg from "pg";
import { readSupabaseConnectionString } from "./supabase-connection.mjs";

dotenv.config({ quiet: true });

const { Pool } = pg;
let config;
try {
  config = readSupabaseConnectionString();
} catch (error) {
  console.error(
    "Supabase connection failed: " +
      (error instanceof Error ? error.message : "invalid configuration")
  );
  process.exitCode = 1;
}

if (!config) {
  process.exit();
}

const pool = new Pool({
  connectionString: config.connectionString,
  max: 1,
  idleTimeoutMillis: 1_000,
  connectionTimeoutMillis: 10_000,
  application_name: "buildledger-connection-check",
});

try {
  await pool.query("SELECT 1 AS connected");
  console.log("Supabase connection: OK");
} catch (error) {
  const code = getErrorCode(error);
  console.error(
    "Supabase connection failed" + (code ? " (" + code + ")" : "") + "."
  );

  if (code === "ENOTFOUND" && config.usesDirectConnection) {
    console.error(
      "This runtime cannot resolve the configured direct Supabase endpoint. " +
        "Use the exact Session pooler connection string from Supabase Dashboard > Connect."
    );
  } else if (code === "28P01") {
    console.error(
      "Supabase rejected the credentials. Copy a fresh connection string from Supabase Dashboard > Connect."
    );
  } else if (code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    console.error(
      "The database is unreachable. Verify the Supabase project is active and network restrictions allow this runtime."
    );
  }

  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}

function getErrorCode(error) {
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
