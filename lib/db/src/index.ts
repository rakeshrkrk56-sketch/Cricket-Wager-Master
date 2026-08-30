import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
export type { PoolClient } from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (error) => {
  // pg removes a failed idle client from the pool. Handling the event keeps
  // transient database restarts from terminating every API/WebSocket session.
  console.error("Unexpected idle PostgreSQL client error", error);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
