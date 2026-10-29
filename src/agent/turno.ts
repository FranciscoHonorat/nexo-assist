import type { UserId } from "../domain/user-id.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type {
  AgentStep,
  ChamadaDeTool,
  Confianca,
  DecisaoFinal,
  Declaracao,
  ResultadoDeTool,
} from "./agent-step.js";
import type { PassoDaGuarda, TurnoPronto } from "./guardas.js";

export const LIMITE_DE_ITERACOES = 5;

export const RESPOSTA_DO_LIMITE_DE_ITERACOES =
  "Não consegui concluir seu pedido agora. Se quiser, posso chamar um analista para te ajudar.";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou" | "limite_de_iteracoes";
  readonly detalhe: string;
};

export type PassoDaTool = {
  readonly etapa: "tool";
  readonly nome: ChamadaDeTool["tool"];
  readonly resultado: "executou";
  readonly detalhe: string;
};

export type PassoDoTurno = PassoDaGuarda | PassoDaResposta | PassoDaTool;

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

type Execucao = {
  readonly turno: TurnoPronto;
  readonly modelo: AgentStep;
  readonly chamados: TicketClient;
};

type Andamento = {
  readonly iteracoes: number;
  readonly resultadosDeTools: readonly ResultadoDeTool[];
  readonly trace: readonly PassoDoTurno[];
};

type ToolExecutada = {
  readonly resultado: ResultadoDeTool;
  readonly passo: PassoDaTool;
};

export function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
  chamados: TicketClient,
): Promise<RespostaDoTurno> {
  return decidirAteResponder(
    { turno, modelo, chamados },
    { iteracoes: 0, resultadosDeTools: [], trace: turno.trace },
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
  if (decisao.tipo !== "tools") {
    const { passos, ...resposta } = traduzirDecisao(decisao);
    return { ...resposta, trace: [...andamento.trace, ...passos] };
  }
  if (andamento.iteracoes + 1 === LIMITE_DE_ITERACOES) {
    return {
      mensagem: RESPOSTA_DO_LIMITE_DE_ITERACOES,
      declaracao: null,
      confianca: "baixa",
      trace: [
        ...andamento.trace,
        {
          etapa: "resposta",
          resultado: "limite_de_iteracoes",
          detalhe: `o modelo pediu tools ${String(LIMITE_DE_ITERACOES)} vezes sem responder`,
        },
      ],
    };
  }
  const executadas = await Promise.all(
    decisao.chamadas.map((chamada) => executarTool(chamada, turno.usuario, chamados)),
  );
  return decidirAteResponder(execucao, registrar(andamento, executadas));
}

function registrar(andamento: Andamento, executadas: readonly ToolExecutada[]): Andamento {
  return {
    iteracoes: andamento.iteracoes + 1,
    resultadosDeTools: [
      ...andamento.resultadosDeTools,
      ...executadas.map((executada) => executada.resultado),
    ],
    trace: [...andamento.trace, ...executadas.map((executada) => executada.passo)],
  };
}

async function executarTool(
  chamada: ChamadaDeTool,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  const doUsuario = await chamados.listar(usuario);
  if (!doUsuario.ok) throw new Error("legado fora do ar durante uma tool: ainda sem tratamento");
  const ids = doUsuario.valor.map((chamado) => chamado.id).join(", ");
  return {
    resultado: { tool: chamada.tool, chamados: doUsuario.valor },
    passo: {
      etapa: "tool",
      nome: chamada.tool,
      resultado: "executou",
      detalhe: `${String(doUsuario.valor.length)} chamados: ${ids}`,
    },
  };
}

function traduzirDecisao(decisao: DecisaoFinal): SaidaDoModelo {
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
