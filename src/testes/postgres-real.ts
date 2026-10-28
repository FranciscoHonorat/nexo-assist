import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";
import { prepararBanco } from "./preparar-banco.js";

type BancoReal = {
  readonly pool: pg.Pool;
  readonly db: NodePgDatabase;
};

let conectado: Promise<BancoReal> | undefined;

async function conectarEMigrar(url: string): Promise<BancoReal> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "drizzle" });
  return { pool, db };
}

export function bancoReal(url: string) {
  return async (inicial: EstadoInicial): Promise<TicketClient> => {
    const { pool, db } = await (conectado ??= conectarEMigrar(url));
    return prepararBanco(db, (comandos) => pool.query(comandos), inicial);
  };
}

export async function desconectarBancoReal(): Promise<void> {
  if (!conectado) return;
  const { pool } = await conectado;
  conectado = undefined;
  await pool.end();
}
