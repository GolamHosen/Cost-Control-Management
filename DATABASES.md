# Database setup

BuildLedger separates its data between two databases:

- Supabase PostgreSQL stores users, profiles, and direct messages.
- Turso stores projects, project memberships, sheets, rows, columns, and cells.

## Supabase connection

Set SUPABASE_DATABASE_URL in .env to the complete **Session pooler**
connection string shown in Supabase Dashboard > Connect. This is the supported
choice for this Node.js application on IPv4-only networks.

The direct endpoint (db.<project-ref>.supabase.co:5432) is IPv6-only by
default. It should only be used when the runtime has working IPv6 or the
Supabase IPv4 add-on is enabled.

For a short-lived migration from an existing direct URL, set
SUPABASE_POOLER_HOST to the pooler hostname shown in Connect. The application
will retain the URL password, adjust the hostname and database user, and use
the Session pooler. Replace this fallback with the complete Session pooler URI
when you next rotate the database password.

After saving .env, restart the development server and run:

~~~powershell
npm run db:check:supabase
~~~

That command performs only SELECT 1; it does not create, alter, or delete
database data. A successful result is:

~~~
Supabase connection: OK
~~~

## Schema initialization

The application safely coordinates initial creation of its Supabase user and
message tables for a fresh database. The supplied db:push:supabase command
can also update the PostgreSQL schema, but review its output before running it
against an existing database because it can make schema changes.

Project tables remain managed separately:

~~~powershell
npm run db:push:turso
~~~

## Diagnostics

GET /api/health reports independent Supabase and Turso readiness. It returns
HTTP 200 only when both databases are reachable, otherwise HTTP 503 with
boolean service status and no credentials or database error details.
