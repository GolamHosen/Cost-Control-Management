const DIRECT_SUPABASE_HOST_PATTERN = /^db\.([a-z0-9-]+)\.supabase\.co$/i;
const SUPABASE_POOLER_HOST_PATTERN = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/i;

function readOptionalEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function configureTls(url) {
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslMode === "disable") {
    throw new Error(
      "SUPABASE_DATABASE_URL must use TLS. Remove sslmode=disable and copy the connection string from Supabase Dashboard > Connect."
    );
  }

  if (!sslMode) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
  } else if (sslMode === "require") {
    url.searchParams.set("uselibpqcompat", "true");
  }
}

export function readSupabaseConnectionString() {
  const connectionString =
    readOptionalEnvironmentVariable("SUPABASE_DATABASE_URL") ||
    readOptionalEnvironmentVariable("DATABASE_URL");

  if (!connectionString) {
    throw new Error("SUPABASE_DATABASE_URL is required.");
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_DATABASE_URL must be a valid PostgreSQL connection string.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error(
      "SUPABASE_DATABASE_URL must be a PostgreSQL connection string with a hostname."
    );
  }

  const directMatch = url.hostname.match(DIRECT_SUPABASE_HOST_PATTERN);
  let usesDirectConnection = Boolean(directMatch);

  if (directMatch) {
    const poolerHost = readOptionalEnvironmentVariable("SUPABASE_POOLER_HOST");

    if (poolerHost) {
      if (!SUPABASE_POOLER_HOST_PATTERN.test(poolerHost)) {
        throw new Error(
          "SUPABASE_POOLER_HOST must be the pooler hostname from Supabase Dashboard > Connect."
        );
      }

      const databaseUser = decodeURIComponent(url.username);
      if (!databaseUser) {
        throw new Error(
          "SUPABASE_DATABASE_URL must include a database user when SUPABASE_POOLER_HOST is set."
        );
      }

      const projectRef = directMatch[1];
      url.hostname = poolerHost;
      url.port = "5432";
      url.username = databaseUser.endsWith(`.${projectRef}`)
        ? databaseUser
        : `${databaseUser}.${projectRef}`;
      usesDirectConnection = false;
    }
  }

  configureTls(url);

  return {
    connectionString: url.toString(),
    hostname: url.hostname,
    usesDirectConnection,
  };
}
