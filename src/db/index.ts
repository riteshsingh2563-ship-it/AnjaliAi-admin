import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: NodePgDatabase;
};

function getPool(): Pool {
  const databaseUrl =
    env.DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL in your environment variables.",
    );
  }

  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // Prevent Neon PostgreSQL auto-suspend / idle connection termination from
    // emitting an unhandled error event on the Node.js process.
    pool.on("error", (err) => {
      console.warn("[db] PostgreSQL idle client warning:", err.message);
    });
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  return globalForDb.__arenaNextJsPostgresqlPool;
}

function getDb(): NodePgDatabase {
  if (!globalForDb.__arenaNextJsPostgresqlDb) {
    globalForDb.__arenaNextJsPostgresqlDb = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsPostgresqlDb;
}

// Lazy proxy so importing `@/db` during `next build` (page data collection)
// does not throw at module load time before any query is actually executed.
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
