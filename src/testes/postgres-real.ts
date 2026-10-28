import { getTableName } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { chamados, complementos, SEQUENCIA_POR_TIPO } from "../tickets/postgres/esquema.js";
import { ticketClientPostgres } from "../tickets/postgres/cliente.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";

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

const LIMPEZA = [
  `TRUNCATE ${[complementos, chamados].map(getTableName).join(", ")} RESTART IDENTITY CASCADE;`,
  ...Object.values(SEQUENCIA_POR_TIPO).map((sequencia) => `ALTER SEQUENCE ${sequencia} RESTART;`),
].join("\n");

export function bancoReal(url: string) {
  return async ({ chamados: iniciais }: EstadoInicial): Promise<TicketClient> => {
    const { pool, db } = await (conectado ??= conectarEMigrar(url));
    await pool.query(LIMPEZA);

    for (const chamado of iniciais) {
      await db.insert(chamados).values({
        id: chamado.id,
        dono: chamado.dono,
        ...chamado.dados,
        status: chamado.status,
        criadoEm: chamado.criadoEm,
        atualizadoEm: chamado.atualizadoEm,
      });
      for (const complemento of chamado.complementos) {
        await db.insert(complementos).values({ chamadoId: chamado.id, ...complemento });
      }
    }

    return ticketClientPostgres(db);
  };
}

export async function desconectarBancoReal(): Promise<void> {
  if (!conectado) return;
  const { pool } = await conectado;
  conectado = undefined;
  await pool.end();
}
