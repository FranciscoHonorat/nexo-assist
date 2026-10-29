import { describe, expect, it } from "vitest";
import { novaConversa } from "../domain/conversa.js";
import { MINUTO } from "../domain/tempo.js";
import { valorDe } from "../testes/valor-de.js";
import type { Chamado } from "../domain/chamado.js";
import {
  ana,
  incidenteDaAna,
  incidenteDoJoao,
  requisicaoDaAna,
  t1,
} from "../tickets/contrato/fixtures.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";
import { prepararTurno } from "./guardas.js";
import type { ChamadaDeTool, Decisao, Declaracao } from "./agent-step.js";
import { agentStepRoteirizado } from "./roteirizado.js";
import { executarTurno } from "./turno.js";

async function cenarioDaAna(mensagem: string, chamados: readonly Chamado[] = []) {
  const cliente = ticketClientEmMemoria({ chamados });
  const turno = valorDe(
    await prepararTurno(
      {
        usuario: ana,
        conversa: novaConversa({ dono: ana }),
        mensagem,
        mensagensNaSessao: 0,
        agora: new Date(t1.getTime() + MINUTO),
      },
      cliente,
    ),
  );
  return { turno, chamados: cliente };
}

const declaracaoDaSaudacao = {
  entendeu: "o funcionário só cumprimentou",
  confianca: "alta",
  porque: "a mensagem não descreve nenhum problema",
} as const;

function responde(mensagem: string, declaracao: Declaracao = declaracaoDaSaudacao): Decisao {
  return { tipo: "responder", declaracao, mensagem };
}

function textoSolto(texto: string): Decisao {
  return { tipo: "texto_solto", texto };
}

function chamaTools(...chamadas: ChamadaDeTool[]): Decisao {
  return { tipo: "tools", chamadas };
}

describe("Turno do agent: toda saída passa pela tool responder", () => {
  it("Dado que o modelo responde direto, Quando o turno roda, Então a mensagem e a declaração saem do responder", async () => {
    const { turno, chamados } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([responde("Bom dia, Ana! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia, Ana! Em que posso ajudar?",
      declaracao: declaracaoDaSaudacao,
    });
    expect(modelo.contextosRecebidos).toMatchObject([{ mensagem: "bom dia" }]);
  });

  it("Dado que o modelo responde com texto solto, Quando o turno roda, Então o texto vira a mensagem, sem declaração e com confiança baixa", async () => {
    const { turno, chamados } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([textoSolto("Bom dia! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia! Em que posso ajudar?",
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace).toContainEqual({
      etapa: "resposta",
      resultado: "nao_declarou",
      detalhe: "o modelo respondeu com texto solto, fora da tool responder",
    });
  });
});

describe("Tool consultar_chamados: o agent vê só os chamados de quem está falando", () => {
  it("Dado chamados da Ana e do João, Quando o modelo consulta os chamados, Então recebe só os da Ana antes de responder", async () => {
    const { turno, chamados } = await cenarioDaAna("como está meu chamado do notebook?", [
      incidenteDaAna,
      requisicaoDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      responde("O INC-20311 está aberto e atrasado."),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta.mensagem).toBe("O INC-20311 está aberto e atrasado.");
    expect(modelo.contextosRecebidos[1]?.resultadosDeTools).toEqual([
      { tool: "consultar_chamados", chamados: [incidenteDaAna, requisicaoDaAna] },
    ]);
    expect(resposta.trace).toContainEqual({
      etapa: "tool",
      nome: "consultar_chamados",
      resultado: "executou",
      detalhe: "2 chamados: INC-20311, REQ-10442",
    });
  });
});
