import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
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

export async function bancoDeTeste(inicial: EstadoInicial): Promise<TicketClient> {
  const { pglite, db } = await (migrado ??= criarEMigrar());
  return prepararBanco(db, (comandos) => pglite.exec(comandos), inicial);
}
