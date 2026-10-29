import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getTableName } from "drizzle-orm";
import pg from "pg";
import type { Conversas } from "../conversas/conversas.js";
import { conversasPostgres } from "../conversas/postgres/cliente.js";
import { conversas, mensagens, rascunhos } from "../conversas/postgres/esquema.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";
import { prepararBanco } from "./preparar-banco.js";

type BancoReal = {
  readonly pool: pg.Pool;
  readonly db: NodePgDatabase;
};

let conectado: Promise<BancoReal> | undefined;

const TRAVA_DAS_MIGRACOES = 2026_10_29;

async function conectarEMigrar(url: string): Promise<BancoReal> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool);
  const cliente = await pool.connect();
  try {
    await cliente.query("SELECT pg_advisory_lock($1)", [TRAVA_DAS_MIGRACOES]);
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await cliente.query("SELECT pg_advisory_unlock($1)", [TRAVA_DAS_MIGRACOES]);
    cliente.release();
  }
  return { pool, db };
}

export function bancoReal(url: string) {
  return async (inicial: EstadoInicial): Promise<TicketClient> => {
    const { pool, db } = await (conectado ??= conectarEMigrar(url));
    return prepararBanco(db, (comandos) => pool.query(comandos), inicial);
  };
}

export function conversasReais(url: string) {
  return async (): Promise<Conversas> => {
    const { pool, db } = await (conectado ??= conectarEMigrar(url));
    await pool.query(
      `TRUNCATE ${[rascunhos, mensagens, conversas].map(getTableName).join(", ")} RESTART IDENTITY;`,
    );
    return conversasPostgres(db);
  };
}

export async function desconectarBancoReal(): Promise<void> {
  if (!conectado) return;
  const { pool } = await conectado;
  conectado = undefined;
  await pool.end();
}
