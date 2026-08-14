import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/pg-schema.ts",
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
});
