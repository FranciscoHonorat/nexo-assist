import type { TicketClient } from "../tickets/ticket-client.js";
import type {
  AgentStep,
  SessaoDoModelo,
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

export const RESPOSTA_DA_RECUSA =
  "Não consigo ajudar com esse pedido por aqui. Se for um assunto de TI, posso chamar um analista para você.";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou" | "limite_de_iteracoes" | "recusada";
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
  readonly modelo: SessaoDoModelo;
  readonly chamados: TicketClient;
};

type Andamento = {
  readonly chamadasAoModelo: number;
  readonly resultadosDeTools: readonly ResultadoDeTool[];
  readonly trace: readonly PassoDoTurno[];
};

const PASSO_SEM_DECLARACAO: PassoDaResposta = {
  etapa: "resposta",
  resultado: "nao_declarou",
  detalhe: "o modelo respondeu com texto solto, fora da tool responder",
};

const CONCLUSAO_DA_RECUSA = semDeclaracao(RESPOSTA_DA_RECUSA, {
  etapa: "resposta",
  resultado: "recusada",
  detalhe: "o modelo recusou responder",
});

const CONCLUSAO_DO_LIMITE = semDeclaracao(RESPOSTA_DO_LIMITE_DE_ITERACOES, {
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
    { turno, modelo: modelo.iniciarTurno(), chamados },
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
  if (chamadasAoModelo === LIMITE_DE_ITERACOES) return concluir(andamento, CONCLUSAO_DO_LIMITE);

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
      return semDeclaracao(decisao.texto, PASSO_SEM_DECLARACAO);
    case "recusa":
      return CONCLUSAO_DA_RECUSA;
  }
}

function semDeclaracao(mensagem: string, motivo: PassoDaResposta): Conclusao {
  return { mensagem, declaracao: null, confianca: "baixa", passos: [motivo] };
}
