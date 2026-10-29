import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableName } from "drizzle-orm";
import { conversasPostgres } from "../conversas/postgres/cliente.js";
import { conversas, mensagens, rascunhos } from "../conversas/postgres/esquema.js";
import type { Conversas } from "../conversas/conversas.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";
import { prepararBanco } from "./preparar-banco.js";

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

export const TEMPO_PARA_MIGRAR = 60_000;

export async function migrarBancoDeTeste(): Promise<void> {
  await (migrado ??= criarEMigrar());
}

export async function bancoDeTeste(inicial: EstadoInicial): Promise<TicketClient> {
  const { pglite, db } = await (migrado ??= criarEMigrar());
  return prepararBanco(db, (comandos) => pglite.exec(comandos), inicial);
}

export async function conversasDeTeste(): Promise<Conversas> {
  const { pglite, db } = await (migrado ??= criarEMigrar());
  await pglite.exec(
    `TRUNCATE ${[rascunhos, mensagens, conversas].map(getTableName).join(", ")} RESTART IDENTITY;`,
  );
  return conversasPostgres(db);
}
