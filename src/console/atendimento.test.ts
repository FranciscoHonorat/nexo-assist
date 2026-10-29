import { describe, expect, it } from "vitest";
import { DESDE_O_COMECO, type Conversas } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { novaConversa } from "../domain/conversa.js";
import { lerUserId } from "../domain/user-id.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { assumidaPor, colocarNaFila } from "../testes/conversas.js";
import { ana, bruno } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import {
  assumirConversa,
  devolverAoAgent,
  encerrarAtendimento,
  responderComoAnalista,
} from "./atendimento.js";

const agora = new Date("2026-10-28T13:10:00Z");
const carla = valorDe(lerUserId("carla.n1@nexo.com"));

async function ultimaMensagem(conversas: Conversas) {
  return valorDe(await conversas.historico(ana, DESDE_O_COMECO)).at(-1);
}

describe("Assumir uma conversa da fila", () => {
  it("Dado a conversa da Ana na fila, Quando o Bruno assume, Então ela fica com ele e o agent pausa", async () => {
    const conversas = conversasEmMemoria();
    await colocarNaFila(conversas, ana, agora);

    expect(await assumirConversa({ dono: ana, analista: bruno, agora }, conversas)).toEqual({
      ok: true,
      valor: undefined,
    });
    expect(valorDe(await conversas.atual(ana)).conversa).toMatchObject({
      controle: "analista",
      analista: bruno,
    });
  });

  it("Dado a conversa já assumida pelo Bruno, Quando a Carla tenta assumir, Então ela recebe que a conversa não está na fila", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    expect(await assumirConversa({ dono: ana, analista: carla, agora }, conversas)).toEqual({
      ok: false,
      erro: { motivo: "conversa_em_outro_estado", controle: "analista" },
    });
  });
});

describe("Responder como analista", () => {
  it("Dado a conversa com o Bruno, Quando ele escreve, Então a mensagem entra no histórico da Ana com o nome dele", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    valorDe(
      await responderComoAnalista(
        { dono: ana, analista: bruno, texto: "  Pode deixar ligado?  ", agora },
        conversas,
      ),
    );

    expect(await ultimaMensagem(conversas)).toMatchObject({
      autor: "analista",
      analista: bruno,
      texto: "Pode deixar ligado?",
    });
  });

  it("Dado a conversa com o Bruno, Quando a Carla tenta escrever, Então é recusado e nada entra no histórico", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);
    const antes = await ultimaMensagem(conversas);

    expect(
      await responderComoAnalista({ dono: ana, analista: carla, texto: "oi", agora }, conversas),
    ).toEqual({ ok: false, erro: { motivo: "nao_e_o_analista", tentouPor: carla } });
    expect(await ultimaMensagem(conversas)).toEqual(antes);
  });

  it("Dado a conversa ainda na fila, Quando o Bruno tenta escrever sem assumir, Então é recusado", async () => {
    const conversas = conversasEmMemoria();
    await colocarNaFila(conversas, ana, agora);

    expect(
      await responderComoAnalista({ dono: ana, analista: bruno, texto: "oi", agora }, conversas),
    ).toEqual({ ok: false, erro: { motivo: "conversa_em_outro_estado", controle: "aguardando" } });
  });

  it("Dado uma mensagem só com espaços, Então é recusada como vazia", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    expect(
      await responderComoAnalista({ dono: ana, analista: bruno, texto: "   ", agora }, conversas),
    ).toEqual({ ok: false, erro: { motivo: "campo_vazio", campo: "texto" } });
  });
});

describe("Devolver ao agent", () => {
  it("Dado a conversa com o Bruno, Quando ele devolve, Então o agent volta a atender e o histórico registra a devolução", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    valorDe(await devolverAoAgent({ dono: ana, analista: bruno, agora }, conversas));

    expect(valorDe(await conversas.atual(ana)).conversa).toEqual(novaConversa({ dono: ana }));
    expect(await ultimaMensagem(conversas)).toMatchObject({ evento: { tipo: "devolvida" } });
  });

  it("Dado a conversa ainda na fila, Quando um analista a devolve sem assumir, Então o agent volta a atender", async () => {
    const conversas = conversasEmMemoria();
    await colocarNaFila(conversas, ana, agora);

    valorDe(await devolverAoAgent({ dono: ana, analista: carla, agora }, conversas));

    expect(valorDe(await conversas.atual(ana)).conversa.controle).toBe("agent");
  });

  it("Dado a conversa com o Bruno, Quando a Carla tenta devolvê-la, Então é recusado", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    expect(await devolverAoAgent({ dono: ana, analista: carla, agora }, conversas)).toEqual({
      ok: false,
      erro: { motivo: "nao_e_o_analista", tentouPor: carla },
    });
  });

  it("Dado a conversa já com o agent, Quando alguém tenta devolvê-la, Então recebe que ela está em outro estado", async () => {
    const conversas = conversasEmMemoria();

    expect(await devolverAoAgent({ dono: ana, analista: bruno, agora }, conversas)).toEqual({
      ok: false,
      erro: { motivo: "conversa_em_outro_estado", controle: "agent" },
    });
  });
});

describe("Encerrar o atendimento", () => {
  it("Dado a conversa com o Bruno, Quando ele encerra, Então o agent volta e o histórico registra o encerramento", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    valorDe(await encerrarAtendimento({ dono: ana, analista: bruno, agora }, conversas));

    expect(valorDe(await conversas.atual(ana)).conversa.controle).toBe("agent");
    expect(await ultimaMensagem(conversas)).toMatchObject({ evento: { tipo: "encerrada" } });
  });

  it("Dado a conversa ainda na fila, Quando alguém tenta encerrar sem assumir, Então recebe que ela está em outro estado", async () => {
    const conversas = conversasEmMemoria();
    await colocarNaFila(conversas, ana, agora);

    expect(await encerrarAtendimento({ dono: ana, analista: bruno, agora }, conversas)).toEqual({
      ok: false,
      erro: { motivo: "conversa_em_outro_estado", controle: "aguardando" },
    });
  });

  it("Dado a conversa com o Bruno, Quando a Carla tenta encerrar, Então é recusado e a conversa continua com ele", async () => {
    const conversas = conversasEmMemoria();
    await assumidaPor(conversas, ana, bruno, agora);

    expect(await encerrarAtendimento({ dono: ana, analista: carla, agora }, conversas)).toEqual({
      ok: false,
      erro: { motivo: "nao_e_o_analista", tentouPor: carla },
    });
    expect(valorDe(await conversas.atual(ana)).conversa).toMatchObject({ analista: bruno });
  });
});

describe("Console com o banco de conversas fora do ar", () => {
  it.each([
    ["assumir", assumirConversa],
    ["devolver", devolverAoAgent],
    ["encerrar", encerrarAtendimento],
    [
      "responder",
      (acao: Parameters<typeof assumirConversa>[0], conversas: Conversas) =>
        responderComoAnalista({ ...acao, texto: "oi" }, conversas),
    ],
  ] as const)("%s devolve indisponível, sem lançar exceção", async (_, agir) => {
    const conversas = {
      ...conversasEmMemoria(),
      atual: () => Promise.resolve(falha(INDISPONIVEL)),
    };

    expect(await agir({ dono: ana, analista: bruno, agora }, conversas)).toEqual(
      falha(INDISPONIVEL),
    );
  });
});
