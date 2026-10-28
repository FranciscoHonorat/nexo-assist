import { getTableName } from "drizzle-orm";
import { chamados, complementos, SEQUENCIA_POR_TIPO } from "../tickets/postgres/esquema.js";
import { ticketClientPostgres, type Banco } from "../tickets/postgres/cliente.js";
import type { EstadoInicial, TicketClient } from "../tickets/ticket-client.js";

const LIMPEZA = [
  `TRUNCATE ${[complementos, chamados].map(getTableName).join(", ")} RESTART IDENTITY CASCADE;`,
  ...Object.values(SEQUENCIA_POR_TIPO).map((sequencia) => `ALTER SEQUENCE ${sequencia} RESTART;`),
].join("\n");

export async function prepararBanco(
  db: Banco,
  executarSql: (comandos: string) => Promise<unknown>,
  { chamados: iniciais }: EstadoInicial,
): Promise<TicketClient> {
  await executarSql(LIMPEZA);
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
