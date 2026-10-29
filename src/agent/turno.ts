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

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado: "nao_declarou";
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

export function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
  chamados: TicketClient,
): Promise<RespostaDoTurno> {
  return decidirAteResponder(turno, modelo, chamados, [], turno.trace);
}

async function decidirAteResponder(
  turno: TurnoPronto,
  modelo: AgentStep,
  chamados: TicketClient,
  resultadosDeTools: readonly ResultadoDeTool[],
  trace: readonly PassoDoTurno[],
): Promise<RespostaDoTurno> {
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    chamadosVencidos: turno.chamadosVencidos,
    resultadosDeTools,
  });
  if (decisao.tipo !== "tools") {
    const { passos, ...resposta } = traduzirDecisao(decisao);
    return { ...resposta, trace: [...trace, ...passos] };
  }
  const executadas = await Promise.all(
    decisao.chamadas.map((chamada) => executarTool(chamada, turno.usuario, chamados)),
  );
  return decidirAteResponder(
    turno,
    modelo,
    chamados,
    [...resultadosDeTools, ...executadas.map((executada) => executada.resultado)],
    [...trace, ...executadas.map((executada) => executada.passo)],
  );
}

async function executarTool(
  chamada: ChamadaDeTool,
  usuario: UserId,
  chamados: TicketClient,
): Promise<{ readonly resultado: ResultadoDeTool; readonly passo: PassoDaTool }> {
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
