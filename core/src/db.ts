// Postgres connection. Only active when DATABASE_URL is set (Render sets it from the
// managed database); locally the app still runs without a database.
import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

/** "ok" if the database answers, "not_configured" without DATABASE_URL, "down" otherwise. */
export async function databaseStatus(): Promise<"ok" | "not_configured" | "down"> {
  const p = getPool();
  if (!p) return "not_configured";
  try {
    await p.query("select 1");
    return "ok";
  } catch (err) {
    console.error("[db] health check failed:", err instanceof Error ? err.message : err);
    return "down";
  }
}
