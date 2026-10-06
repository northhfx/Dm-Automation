import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// เก็บ connection ไว้ที่ globalThis เพื่อไม่ให้สร้างใหม่ทุกครั้งที่ hot-reload ตอน dev
const globalForDb = globalThis as unknown as { __dmPool?: Pool; __dmDb?: Db };

export function getPool(): Pool {
  if (!globalForDb.__dmPool) {
    globalForDb.__dmPool = new Pool({ connectionString: env.databaseUrl, max: 10 });
  }
  return globalForDb.__dmPool;
}

export function getDb(): Db {
  if (!globalForDb.__dmDb) {
    globalForDb.__dmDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__dmDb;
}
