import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { chamados, complementos } from "../tickets/postgres/esquema.js";
import { ticketClientPostgres } from "../tickets/postgres/cliente.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";

export async function bancoDeTeste({ chamados: iniciais }: EstadoInicial): Promise<TicketClient> {
  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: "drizzle" });

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
