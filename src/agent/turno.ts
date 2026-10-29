import type { TicketClient } from "../tickets/ticket-client.js";
import type {
  AgentStep,
  Confianca,
  DecisaoFinal,
  Declaracao,
  ResultadoDeTool,
} from "./agent-step.js";
import type { PassoDaGuarda, TurnoPronto } from "./guardas.js";
import { executarTool, passoDaTool, type PassoDaTool, type ToolExecutada } from "./tools.js";

export const LIMITE_DE_ITERACOES = 5;

export const RESPOSTA_DO_LIMITE_DE_ITERACOES =
  "Não consegui concluir seu pedido agora. Se quiser, posso chamar um analista para te ajudar.";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou" | "limite_de_iteracoes";
  readonly detalhe: string;
};

export type PassoDoTurno = PassoDaGuarda | PassoDaResposta | PassoDaTool;

export type RespostaDoTurno = {
  readonly mensagem: string;
  readonly declaracao: Declaracao | null;
  readonly confianca: Confianca;
  readonly trace: readonly PassoDoTurno[];
};

type Conclusao = Omit<RespostaDoTurno, "trace"> & {
  readonly passos: readonly PassoDaResposta[];
};

type Execucao = {
  readonly turno: TurnoPronto;
  readonly modelo: AgentStep;
  readonly chamados: TicketClient;
};

type Andamento = {
  readonly chamadasAoModelo: number;
  readonly resultadosDeTools: readonly ResultadoDeTool[];
  readonly trace: readonly PassoDoTurno[];
};

const MODELO_NAO_DECLAROU: PassoDaResposta = {
  etapa: "resposta",
  resultado: "nao_declarou",
  detalhe: "o modelo respondeu com texto solto, fora da tool responder",
};

const LIMITE_ATINGIDO = semDeclaracao(RESPOSTA_DO_LIMITE_DE_ITERACOES, {
  etapa: "resposta",
  resultado: "limite_de_iteracoes",
  detalhe: `o modelo pediu tools ${String(LIMITE_DE_ITERACOES)} vezes sem responder`,
});

export function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
  chamados: TicketClient,
): Promise<RespostaDoTurno> {
  return decidirAteResponder(
    { turno, modelo, chamados },
    { chamadasAoModelo: 0, resultadosDeTools: [], trace: turno.trace },
  );
}

async function decidirAteResponder(
  execucao: Execucao,
  andamento: Andamento,
): Promise<RespostaDoTurno> {
  const { turno, modelo, chamados } = execucao;
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    chamadosVencidos: turno.chamadosVencidos,
    resultadosDeTools: andamento.resultadosDeTools,
  });
  const chamadasAoModelo = andamento.chamadasAoModelo + 1;

  if (decisao.tipo !== "tools") return concluir(andamento, traduzirDecisao(decisao));
  if (chamadasAoModelo === LIMITE_DE_ITERACOES) return concluir(andamento, LIMITE_ATINGIDO);

  const executadas = await Promise.all(
    decisao.chamadas.map((chamada) => executarTool(chamada, turno.usuario, chamados)),
  );
  return decidirAteResponder(execucao, registrar({ ...andamento, chamadasAoModelo }, executadas));
}

function registrar(andamento: Andamento, executadas: readonly ToolExecutada[]): Andamento {
  return {
    ...andamento,
    resultadosDeTools: [
      ...andamento.resultadosDeTools,
      ...executadas.map((executada) => executada.resultado),
    ],
    trace: [...andamento.trace, ...executadas.map(passoDaTool)],
  };
}

function concluir(andamento: Andamento, { passos, ...resposta }: Conclusao): RespostaDoTurno {
  return { ...resposta, trace: [...andamento.trace, ...passos] };
}

function traduzirDecisao(decisao: DecisaoFinal): Conclusao {
  switch (decisao.tipo) {
    case "responder":
      return {
        mensagem: decisao.mensagem,
        declaracao: decisao.declaracao,
        confianca: decisao.declaracao.confianca,
        passos: [],
      };
    case "texto_solto":
      return semDeclaracao(decisao.texto, MODELO_NAO_DECLAROU);
  }
}

function semDeclaracao(mensagem: string, motivo: PassoDaResposta): Conclusao {
  return { mensagem, declaracao: null, confianca: "baixa", passos: [motivo] };
}
