import { createClient } from "@libsql/client";
import pg from "pg";

const { Pool } = pg;
const { SUPABASE_DATABASE_URL, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, PURGE_TURSO_USER_DATA } = process.env;

if (!SUPABASE_DATABASE_URL || !TURSO_DATABASE_URL) {
  throw new Error("SUPABASE_DATABASE_URL and TURSO_DATABASE_URL are both required.");
}

const supabase = new Pool({ connectionString: SUPABASE_DATABASE_URL });
const turso = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

async function tursoTableExists(name) {
  const result = await turso.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return result.rows.length > 0;
}

async function ensureSupabaseUserTables() {
  await supabase.query(`
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
  await supabase.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await supabase.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
}

async function readTursoUsers() {
  if (!(await tursoTableExists("users"))) return [];

  const columns = await turso.execute("PRAGMA table_info(users)");
  const hasAvatarUrl = columns.rows.some((column) => column.name === "avatar_url");
  const avatarColumn = hasAvatarUrl ? "avatar_url" : "NULL AS avatar_url";
  const result = await turso.execute(
    `SELECT id, name, email, password, role, phone, ${avatarColumn}, created_at FROM users ORDER BY id`,
  );
  return result.rows;
}

async function readTursoMessages() {
  if (!(await tursoTableExists("messages"))) return [];
  const result = await turso.execute(
    "SELECT id, sender_id, receiver_id, content, is_read, created_at FROM messages ORDER BY id",
  );
  return result.rows;
}

async function rebuildProjectMembersWithoutUserForeignKey() {
  if (!(await tursoTableExists("project_members"))) return;

  const foreignKeys = await turso.execute("PRAGMA foreign_key_list(project_members)");
  const referencesUsers = foreignKeys.rows.some((foreignKey) => foreignKey.table === "users");
  if (!referencesUsers) return;

  await turso.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE project_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      assigned_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
    );
    INSERT INTO project_members_new (id, project_id, user_id, role, assigned_at)
      SELECT id, project_id, user_id, role, assigned_at FROM project_members;
    DROP TABLE project_members;
    ALTER TABLE project_members_new RENAME TO project_members;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

async function copyUserData() {
  const [users, messages] = await Promise.all([readTursoUsers(), readTursoMessages()]);
  await ensureSupabaseUserTables();

  await supabase.query("BEGIN");
  try {
    for (const user of users) {
      await supabase.query(
        `INSERT INTO users (id, name, email, password, role, phone, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password,
           role = EXCLUDED.role, phone = EXCLUDED.phone, avatar_url = EXCLUDED.avatar_url,
           created_at = EXCLUDED.created_at`,
        [
          user.id,
          user.name,
          user.email,
          user.password,
          user.role,
          user.phone,
          user.avatar_url,
          user.created_at,
        ],
      );
    }

    for (const message of messages) {
      await supabase.query(
        `INSERT INTO messages (id, sender_id, receiver_id, content, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           sender_id = EXCLUDED.sender_id, receiver_id = EXCLUDED.receiver_id,
           content = EXCLUDED.content, is_read = EXCLUDED.is_read, created_at = EXCLUDED.created_at`,
        [
          message.id,
          message.sender_id,
          message.receiver_id,
          message.content,
          message.is_read,
          message.created_at,
        ],
      );
    }

    await supabase.query(
      "SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM users), 1), 1), true)",
    );
    await supabase.query(
      "SELECT setval(pg_get_serial_sequence('messages', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM messages), 1), 1), true)",
    );
    await supabase.query("COMMIT");
  } catch (error) {
    await supabase.query("ROLLBACK");
    throw error;
  }

  console.log(`Copied ${users.length} users and ${messages.length} messages to Supabase.`);
  return { users, messages };
}

try {
  const { users, messages } = await copyUserData();

  if (PURGE_TURSO_USER_DATA === "true") {
    await rebuildProjectMembersWithoutUserForeignKey();
    if (await tursoTableExists("messages")) await turso.execute("DROP TABLE messages");
    if (await tursoTableExists("users")) await turso.execute("DROP TABLE users");
    console.log("Removed user and message tables from Turso after a successful copy.");
  } else if (users.length || messages.length) {
    console.log("Copy completed. Re-run with PURGE_TURSO_USER_DATA=true after verifying Supabase.");
  }
} finally {
  await supabase.end();
  turso.close();
}
