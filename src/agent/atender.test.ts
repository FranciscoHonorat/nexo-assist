import { describe, expect, it } from "vitest";
import type { Conversas } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { ana } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";
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
});
