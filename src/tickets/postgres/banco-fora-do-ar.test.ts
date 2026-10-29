import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  complementoConfirmadoDaAna,
  incidenteDaAna,
  notebookLento,
  RASCUNHO_1,
  rascunhoConfirmadoDaAna,
  t1,
} from "../contrato/fixtures.js";
import { ana } from "../../testes/usuarios.js";
import { ticketClientResiliente } from "../resiliente.js";
import type { TicketClient } from "../ticket-client.js";
import { ticketClientPostgres } from "./cliente.js";

const inalcancavel = new pg.Pool({
  connectionString: "postgres://ninguem:nada@127.0.0.1:1/inexistente",
  connectionTimeoutMillis: 500,
});

afterAll(() => inalcancavel.end());

const INDISPONIVEL = { ok: false, erro: { motivo: "indisponivel" } };

function chamadas(servico: TicketClient) {
  return {
    listar: () => servico.listar(ana),
    obter: () => servico.obter(incidenteDaAna.id, ana),
    criar: () => servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1),
    complementar: () =>
      servico.complementar(complementoConfirmadoDaAna(RASCUNHO_1, incidenteDaAna.id, "x"), t1),
    alterarStatus: () =>
      servico.alterarStatus(incidenteDaAna.id, { de: "aberto", para: "resolvido", por: ana }, t1),
  } satisfies Record<keyof TicketClient, () => Promise<unknown>>;
}

describe("PostgreSQL fora do ar", () => {
  const servico = ticketClientPostgres(drizzle(inalcancavel));

  it.each(Object.entries(chamadas(servico)))(
    "%s devolve indisponível em vez de lançar exceção",
    async (_, chamar) => {
      expect(await chamar()).toEqual(INDISPONIVEL);
    },
  );

  it("um bug de programação continua sendo exceção, e não vira indisponível", async () => {
    const encerrado = new pg.Pool({ connectionString: "postgres://ninguem:nada@127.0.0.1:1/x" });
    await encerrado.end();

    await expect(ticketClientPostgres(drizzle(encerrado)).listar(ana)).rejects.toHaveProperty(
      "cause.message",
      "Cannot use a pool after calling end on the pool",
    );
  });

  it("o cliente resiliente tenta de novo e, sem o banco voltar, devolve indisponível", async () => {
    let tentativas = 0;
    const resiliente = ticketClientResiliente(servico, undefined, {
      esperar: () => {
        tentativas += 1;
        return Promise.resolve();
      },
      aleatorio: () => 1,
    });

    expect(await resiliente.listar(ana)).toEqual(INDISPONIVEL);
    expect(tentativas).toBe(3);
  });
});
