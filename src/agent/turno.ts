import { lerTicketId } from "../domain/ticket-id.js";
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
  readonly resultado: "executou" | "argumentos_invalidos";
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

type ToolExecutada = {
  readonly resultado: ResultadoDeTool;
  readonly trace: Pick<PassoDaTool, "resultado" | "detalhe">;
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

async function executarTool(
  chamada: ChamadaDeTool,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  switch (chamada.tool) {
    case "consultar_chamados":
      return consultarChamados(usuario, chamados);
    case "obter_chamado":
      return obterChamado(chamada.argumentos.id, usuario, chamados);
  }
}

async function consultarChamados(usuario: UserId, chamados: TicketClient): Promise<ToolExecutada> {
  const doUsuario = await chamados.listar(usuario);
  if (!doUsuario.ok) throw new Error("legado fora do ar durante uma tool: ainda sem tratamento");
  const ids = doUsuario.valor.map((chamado) => chamado.id).join(", ");
  return {
    resultado: { tool: "consultar_chamados", chamados: doUsuario.valor },
    trace: {
      resultado: "executou",
      detalhe: `${String(doUsuario.valor.length)} chamados: ${ids}`,
    },
  };
}

async function obterChamado(
  id: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  const lido = lerTicketId(id);
  if (!lido.ok) {
    return {
      resultado: { tool: "obter_chamado", erro: lido.erro },
      trace: { resultado: "argumentos_invalidos", detalhe: `id "${id}" fora do formato` },
    };
  }
  const consulta = await chamados.obter(lido.valor, usuario);
  if (!consulta.ok) throw new Error("obter_chamado sem sucesso: ainda sem tratamento");
  return {
    resultado: { tool: "obter_chamado", chamado: consulta.valor },
    trace: { resultado: "executou", detalhe: `${consulta.valor.id} encontrado` },
  };
}

function passoDaTool({ resultado, trace }: ToolExecutada): PassoDaTool {
  return { etapa: "tool", nome: resultado.tool, ...trace };
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
