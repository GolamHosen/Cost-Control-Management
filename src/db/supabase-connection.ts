const DIRECT_SUPABASE_HOST_PATTERN = /^db\.([a-z0-9-]+)\.supabase\.co$/i;
const SUPABASE_POOLER_HOST_PATTERN = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/i;

export type SupabaseConnection = {
  connectionString: string;
  hostname: string;
  usesDirectConnection: boolean;
};

function readOptionalEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function validatePostgresUrl(connectionString: string) {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "SUPABASE_DATABASE_URL must be a valid PostgreSQL connection string."
    );
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error(
      "SUPABASE_DATABASE_URL must be a PostgreSQL connection string with a hostname."
    );
  }

  return url;
}

function configureTls(url: URL) {
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslMode === "disable") {
    throw new Error(
      "SUPABASE_DATABASE_URL must use TLS. Remove sslmode=disable and copy the connection string from Supabase Dashboard > Connect."
    );
  }

  // Supabase poolers require TLS. pg v8 currently interprets sslmode=require
  // more strictly than libpq, which can reject Supabase's pooler certificate
  // chain. This flag retains standard libpq `require` behavior without a
  // deprecation warning and is forward-compatible with pg v9.
  if (!sslMode) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
  } else if (sslMode === "require") {
    url.searchParams.set("uselibpqcompat", "true");
  }
}

function switchDirectUrlToPooler(url: URL, projectRef: string) {
  const poolerHost = readOptionalEnvironmentVariable("SUPABASE_POOLER_HOST");

  if (!poolerHost) return false;

  if (!SUPABASE_POOLER_HOST_PATTERN.test(poolerHost)) {
    throw new Error(
      "SUPABASE_POOLER_HOST must be the pooler hostname from Supabase Dashboard > Connect, for example aws-0-<region>.pooler.supabase.com."
    );
  }

  const databaseUser = decodeURIComponent(url.username);
  if (!databaseUser) {
    throw new Error(
      "SUPABASE_DATABASE_URL must include a database user when SUPABASE_POOLER_HOST is set."
    );
  }

  url.hostname = poolerHost;
  url.port = "5432";
  url.username = databaseUser.endsWith(`.${projectRef}`)
    ? databaseUser
    : `${databaseUser}.${projectRef}`;

  return true;
}

export function readSupabaseConnectionString(): SupabaseConnection {
  const connectionString =
    readOptionalEnvironmentVariable("SUPABASE_DATABASE_URL") ||
    readOptionalEnvironmentVariable("DATABASE_URL");

  if (!connectionString) {
    throw new Error(
      "SUPABASE_DATABASE_URL is required for Supabase user and profile storage."
    );
  }

  const url = validatePostgresUrl(connectionString);
  const directMatch = url.hostname.match(DIRECT_SUPABASE_HOST_PATTERN);
  const switchedToPooler = directMatch
    ? switchDirectUrlToPooler(url, directMatch[1])
    : false;

  configureTls(url);

  return {
    connectionString: url.toString(),
    hostname: url.hostname,
    usesDirectConnection: Boolean(directMatch) && !switchedToPooler,
  };
}
