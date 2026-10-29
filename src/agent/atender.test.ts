import { describe, expect, it } from "vitest";
import type { Conversas } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { assumir } from "../domain/conversa.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { colocarNaFila } from "../testes/conversas.js";
import { ana, bruno } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";
import type { AgentStep } from "./agent-step.js";
import { atenderMensagem } from "./atender.js";
import { RESPOSTA_DO_LIMITE } from "./guardas.js";
import { agentStepRoteirizado } from "./roteirizado.js";

const agora = new Date("2026-10-28T13:00:00Z");

const declaracao = {
  entendeu: "o funcionário só cumprimentou",
  confianca: "alta",
  porque: "a mensagem não descreve nenhum problema",
} as const;

async function comMensagensNaSessao(conversas: Conversas, quantidade: number) {
  valorDe(await conversas.atual(ana));
  for (let numero = 1; numero <= quantidade; numero += 1) {
    valorDe(
      await conversas.registrarTurno(ana, {
        pergunta: `mensagem ${String(numero)}`,
        resposta: { texto: "ok", registro: {} },
        agora,
      }),
    );
  }
}

function dependencias(modelo = agentStepRoteirizado([])) {
  return {
    conversas: conversasEmMemoria(),
    chamados: ticketClientEmMemoria({ chamados: [] }),
    modelo,
  };
}

describe("Atender uma mensagem: conversa, guardas, agent e histórico juntos", () => {
  it("Dado uma conversa com o agent, Quando a Ana manda uma mensagem, Então a resposta volta e o turno fica no histórico com o registro do agent", async () => {
    const servicos = dependencias(
      agentStepRoteirizado([{ tipo: "responder", declaracao, mensagem: "Bom dia, Ana!" }]),
    );

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "bom dia", agora },
      servicos,
    );

    expect(valorDe(atendimento)).toMatchObject({
      tipo: "resposta",
      resposta: { mensagem: "Bom dia, Ana!", declaracao, confianca: "alta" },
    });
    expect(valorDe(await servicos.conversas.historico(ana))).toMatchObject([
      { autor: "funcionario", texto: "bom dia" },
      { autor: "agent", texto: "Bom dia, Ana!", registro: { declaracao, confianca: "alta" } },
    ]);
  });

  it("Dado 30 mensagens já gravadas na sessão, Quando chega a 31ª, Então a resposta é fixa e o modelo não é chamado", async () => {
    const servicos = dependencias();
    await comMensagensNaSessao(servicos.conversas, 30);

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "mais uma", agora },
      servicos,
    );

    expect(valorDe(atendimento)).toMatchObject({
      tipo: "resposta",
      resposta: { mensagem: RESPOSTA_DO_LIMITE, declaracao: null, confianca: "baixa" },
    });
    expect(servicos.modelo.contextosRecebidos).toEqual([]);
    expect(valorDe(await servicos.conversas.historico(ana)).at(-1)).toMatchObject({
      autor: "agent",
      texto: RESPOSTA_DO_LIMITE,
    });
  });

  it("Dado uma conversa na fila, Quando a Ana manda uma mensagem, Então ela fica no histórico para o analista e o agent fica em silêncio", async () => {
    const servicos = dependencias();
    await colocarNaFila(servicos.conversas, ana, agora);

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "alguém aí?", agora },
      servicos,
    );

    expect(valorDe(atendimento)).toEqual({ tipo: "silencio", motivo: "conversa_na_fila" });
    expect(servicos.modelo.contextosRecebidos).toEqual([]);
    expect(valorDe(await servicos.conversas.historico(ana))).toEqual([
      { autor: "funcionario", texto: "alguém aí?", enviadaEm: agora },
    ]);
  });

  it("Dado que um analista assume enquanto o modelo decide, Quando o agent termina, Então a resposta não é gravada e o atendimento é silêncio", async () => {
    const conversas = conversasEmMemoria();
    const roteiro = agentStepRoteirizado([
      { tipo: "responder", declaracao, mensagem: "Já resolvo isso!" },
    ]);
    const modeloLento: AgentStep = {
      decidir: async (contexto) => {
        const fila = await colocarNaFila(conversas, ana, agora);
        valorDe(
          await conversas.transicionar(assumir(fila, { analista: bruno, agora }), "aguardando"),
        );
        return roteiro.decidir(contexto);
      },
    };

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "meu acesso caiu", agora },
      { conversas, chamados: ticketClientEmMemoria({ chamados: [] }), modelo: modeloLento },
    );

    expect(valorDe(atendimento)).toEqual({ tipo: "silencio", motivo: "analista_assumiu" });
    expect(valorDe(await conversas.historico(ana))).toEqual([
      { autor: "funcionario", texto: "meu acesso caiu", enviadaEm: agora },
    ]);
  });
});

describe("Atender com o banco de conversas fora do ar", () => {
  const foraDoAr = () => Promise.resolve(falha(INDISPONIVEL));

  it("Dado que não dá para ler a conversa, Então o atendimento é indisponível e o modelo não é chamado", async () => {
    const servicos = dependencias();
    const conversas: Conversas = { ...servicos.conversas, atual: foraDoAr };

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "bom dia", agora },
      { ...servicos, conversas },
    );

    expect(atendimento).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
    expect(servicos.modelo.contextosRecebidos).toEqual([]);
  });

  it("Dado que não dá para gravar o turno, Então o atendimento é indisponível", async () => {
    const servicos = dependencias(
      agentStepRoteirizado([{ tipo: "responder", declaracao, mensagem: "Bom dia, Ana!" }]),
    );
    const conversas: Conversas = { ...servicos.conversas, registrarTurno: foraDoAr };

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "bom dia", agora },
      { ...servicos, conversas },
    );

    expect(atendimento).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
  });

  it("Dado uma conversa na fila e que não dá para gravar a mensagem, Então o atendimento é indisponível", async () => {
    const servicos = dependencias();
    await colocarNaFila(servicos.conversas, ana, agora);
    const conversas: Conversas = { ...servicos.conversas, registrarMensagem: foraDoAr };

    const atendimento = await atenderMensagem(
      { usuario: ana, mensagem: "alguém aí?", agora },
      { ...servicos, conversas },
    );

    expect(atendimento).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
  });
});
