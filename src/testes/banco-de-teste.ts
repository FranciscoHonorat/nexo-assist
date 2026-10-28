import { PGlite } from "@electric-sql/pglite";
import { getTableName } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { chamados, complementos, SEQUENCIA_POR_TIPO } from "../tickets/postgres/esquema.js";
import { ticketClientPostgres } from "../tickets/postgres/cliente.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";

type BancoMigrado = {
  readonly pglite: PGlite;
  readonly db: PgliteDatabase;
};

let migrado: Promise<BancoMigrado> | undefined;

async function criarEMigrar(): Promise<BancoMigrado> {
  const pglite = new PGlite();
  const db = drizzle(pglite);
  await migrate(db, { migrationsFolder: "drizzle" });
  return { pglite, db };
}

const LIMPEZA = [
  `TRUNCATE ${[complementos, chamados].map(getTableName).join(", ")} RESTART IDENTITY CASCADE;`,
  ...Object.values(SEQUENCIA_POR_TIPO).map((sequencia) => `ALTER SEQUENCE ${sequencia} RESTART;`),
].join("\n");

export async function bancoDeTeste({ chamados: iniciais }: EstadoInicial): Promise<TicketClient> {
  const { pglite, db } = await (migrado ??= criarEMigrar());
  await pglite.exec(LIMPEZA);

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
}
