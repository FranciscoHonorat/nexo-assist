import { describe, expect, it } from "vitest";
import { novaConversa } from "../domain/conversa.js";
import { MINUTO } from "../domain/tempo.js";
import { valorDe } from "../testes/valor-de.js";
import { ana, t1 } from "../tickets/contrato/fixtures.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";
import { prepararTurno } from "./guardas.js";
import { agentStepRoteirizado } from "./roteirizado.js";
import { executarTurno } from "./turno.js";

async function turnoDaAna(mensagem: string) {
  return valorDe(
    await prepararTurno(
      {
        usuario: ana,
        conversa: novaConversa({ dono: ana }),
        mensagem,
        mensagensNaSessao: 0,
        agora: new Date(t1.getTime() + MINUTO),
      },
      ticketClientEmMemoria({ chamados: [] }),
    ),
  );
}

const declaracaoDaSaudacao = {
  entendeu: "o funcionário só cumprimentou",
  confianca: "alta",
  porque: "a mensagem não descreve nenhum problema",
} as const;

describe("Turno do agent: toda saída passa pela tool responder", () => {
  it("Dado que o modelo responde direto, Quando o turno roda, Então a mensagem e a declaração saem do responder", async () => {
    const turno = await turnoDaAna("bom dia");
    const modelo = agentStepRoteirizado([
      {
        tipo: "responder",
        declaracao: declaracaoDaSaudacao,
        mensagem: "Bom dia, Ana! Em que posso ajudar?",
      },
    ]);

    const resposta = await executarTurno(turno, modelo);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia, Ana! Em que posso ajudar?",
      declaracao: declaracaoDaSaudacao,
    });
    expect(modelo.contextosRecebidos).toMatchObject([{ mensagem: "bom dia" }]);
  });

  it("Dado que o modelo responde com texto solto, Quando o turno roda, Então o texto vira a mensagem, sem declaração e com confiança baixa", async () => {
    const turno = await turnoDaAna("bom dia");
    const modelo = agentStepRoteirizado([
      { tipo: "texto_solto", texto: "Bom dia! Em que posso ajudar?" },
    ]);

    const resposta = await executarTurno(turno, modelo);

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
