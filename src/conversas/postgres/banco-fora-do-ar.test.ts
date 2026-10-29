import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { assumir, novaConversa, transferir } from "../../domain/conversa.js";
import { descartar } from "../../domain/rascunho.js";
import { NOVO_NOTEBOOK_LENTO, rascunhoPendente } from "../../testes/rascunhos.js";
import { valorDe } from "../../testes/valor-de.js";
import { ana, bruno } from "../../testes/usuarios.js";
import { DESDE_O_COMECO, type Conversas } from "../conversas.js";
import { conversasPostgres } from "./cliente.js";

const inalcancavel = new pg.Pool({
  connectionString: "postgres://ninguem:nada@127.0.0.1:1/inexistente",
  connectionTimeoutMillis: 500,
});

afterAll(() => inalcancavel.end());

const agora = new Date("2026-10-28T13:00:00Z");

const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, agora);

const naFila = valorDe(
  transferir(novaConversa({ dono: ana }), { motivo: "caso_critico", resumo: "rede caiu", agora }),
);

function chamadas(conversas: Conversas) {
  return {
    atual: () => conversas.atual(ana),
    listar: () => conversas.listar(),
    transicionar: () =>
      conversas.transicionar(
        { evento: "devolvida", antes: naFila, depois: novaConversa({ dono: ana }) },
        agora,
      ),
    registrarMensagem: () => conversas.registrarMensagem(ana, { texto: "oi", agora }),
    registrarMensagemDoAnalista: () =>
      conversas.registrarMensagemDoAnalista(assumir(naFila, { analista: bruno, agora }), {
        texto: "oi",
        agora,
      }),
    registrarTurno: () =>
      conversas.registrarTurno(ana, {
        pergunta: "oi",
        resposta: { texto: "olá", registro: {} },
        agora,
      }),
    iniciarSessao: () => conversas.iniciarSessao(ana, agora),
    historico: () => conversas.historico(ana, DESDE_O_COMECO),
    guardarRascunho: () => conversas.guardarRascunho(rascunho),
    rascunhoPendente: () => conversas.rascunhoPendente(rascunho.id, ana),
    resolverRascunho: () =>
      conversas.resolverRascunho({ rascunho: valorDe(descartar(rascunho, { por: ana, agora })) }),
  } satisfies Record<keyof Conversas, () => Promise<unknown>>;
}

describe("Banco de conversas fora do ar", () => {
  it.each(Object.entries(chamadas(conversasPostgres(drizzle(inalcancavel)))))(
    "%s devolve indisponível em vez de lançar exceção",
    async (_, chamar) => {
      expect(await chamar()).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
    },
  );
});
