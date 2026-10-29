import { getTableName } from "drizzle-orm";
import { chamados, complementos, SEQUENCIA_POR_TIPO } from "../tickets/postgres/esquema.js";
import type { Banco } from "../infraestrutura/banco.js";
import { ticketClientPostgres } from "../tickets/postgres/cliente.js";
import { semearChamados } from "../tickets/postgres/semente.js";
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
  await semearChamados(db, iniciais);
  return ticketClientPostgres(db);
}
