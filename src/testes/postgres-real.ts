import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrarComTrava } from "../infraestrutura/migracao.js";
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

async function conectarEMigrar(url: string): Promise<BancoReal> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  await migrarComTrava(pool, "drizzle");
  const db = drizzle(pool);
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
