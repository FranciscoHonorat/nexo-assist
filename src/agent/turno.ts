import type { AgentStep, Confianca, Decisao, Declaracao } from "./agent-step.js";
import type { PassoDaGuarda, TurnoPronto } from "./guardas.js";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou";
  readonly detalhe: string;
};

export type PassoDoTurno = PassoDaGuarda | PassoDaResposta;

export type RespostaDoTurno = {
  readonly mensagem: string;
  readonly declaracao: Declaracao | null;
  readonly confianca: Confianca;
  readonly trace: readonly PassoDoTurno[];
};

type SaidaDoModelo = Omit<RespostaDoTurno, "trace"> & {
  readonly passos: readonly PassoDaResposta[];
};

const MODELO_NAO_DECLAROU: PassoDaResposta = {
  etapa: "resposta",
  resultado: "nao_declarou",
  detalhe: "o modelo respondeu com texto solto, fora da tool responder",
};

export async function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
): Promise<RespostaDoTurno> {
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    chamadosVencidos: turno.chamadosVencidos,
  });
  const { passos, ...resposta } = traduzirDecisao(decisao);
  return { ...resposta, trace: [...turno.trace, ...passos] };
}

function traduzirDecisao(decisao: Decisao): SaidaDoModelo {
  switch (decisao.tipo) {
    case "responder":
      return {
        mensagem: decisao.mensagem,
        declaracao: decisao.declaracao,
        confianca: decisao.declaracao.confianca,
        passos: [],
      };
    case "texto_solto":
      return {
        mensagem: decisao.texto,
        declaracao: null,
        confianca: "baixa",
        passos: [MODELO_NAO_DECLAROU],
      };
  }
}
