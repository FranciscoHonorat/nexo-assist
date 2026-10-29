import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type pg from "pg";

const TRAVA_DAS_MIGRACOES = 2026_10_29;

export async function migrarComTrava(pool: pg.Pool, pasta: string): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("SELECT pg_advisory_lock($1)", [TRAVA_DAS_MIGRACOES]);
    await migrate(drizzle(pool), { migrationsFolder: pasta });
  } finally {
    await cliente.query("SELECT pg_advisory_unlock($1)", [TRAVA_DAS_MIGRACOES]);
    cliente.release();
  }
}
