import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { readSupabaseConnectionString } from "./src/db/supabase-connection";

const { connectionString } = readSupabaseConnectionString();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/pg-schema.ts",
  dbCredentials: {
    url: connectionString,
  },
});
