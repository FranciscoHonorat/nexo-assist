import type { AgentStep, Confianca, Declaracao } from "./agent-step.js";
import type { PassoDoTrace, TurnoPronto } from "./guardas.js";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou";
  readonly detalhe: string;
};

export type RespostaDoTurno = {
  readonly mensagem: string;
  readonly declaracao: Declaracao | null;
  readonly confianca: Confianca;
  readonly trace: readonly (PassoDoTrace | PassoDaResposta)[];
};

export async function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
): Promise<RespostaDoTurno> {
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    chamadosVencidos: turno.chamadosVencidos,
  });
  switch (decisao.tipo) {
    case "responder":
      return {
        mensagem: decisao.mensagem,
        declaracao: decisao.declaracao,
        confianca: decisao.declaracao.confianca,
        trace: turno.trace,
      };
    case "texto_solto":
      return {
        mensagem: decisao.texto,
        declaracao: null,
        confianca: "baixa",
        trace: [
          ...turno.trace,
          {
            etapa: "resposta",
            resultado: "nao_declarou",
            detalhe: "o modelo respondeu com texto solto, fora da tool responder",
          },
        ],
      };
  }
}
