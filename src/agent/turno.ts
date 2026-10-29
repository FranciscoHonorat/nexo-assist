import type {
  AgentStep,
  SessaoDoModelo,
  Confianca,
  DecisaoFinal,
  Declaracao,
  PedidoDeTransferencia,
  ResultadoDeTool,
} from "./agent-step.js";
import { anexosDo, type Anexos } from "./anexos.js";
import type { PassoDaGuarda, TurnoPronto } from "./guardas.js";
import {
  executarTool,
  passoDaTool,
  type PassoDaTool,
  type ServicosDoTurno,
  type ToolExecutada,
} from "./tools.js";

export type { ServicosDoTurno } from "./tools.js";

export const LIMITE_DE_ITERACOES = 5;

export const RESPOSTA_DO_LIMITE_DE_ITERACOES =
  "Não consegui concluir seu pedido agora. Se quiser, posso chamar um analista para te ajudar.";

export const RESPOSTA_DA_RECUSA =
  "Não consigo ajudar com esse pedido por aqui. Se for um assunto de TI, posso chamar um analista para você.";

export const RESPOSTA_DA_TRANSFERENCIA =
  "Chamei um analista do service desk. Ele continua a conversa por aqui assim que estiver disponível.";

export const RESUMO_SEM_DETALHES = "O funcionário pediu um analista; veja a conversa.";

export type PassoDaResposta = {
  readonly etapa: "resposta";
  readonly resultado:
    "nao_declarou" | "declaracao_invalida" | "limite_de_iteracoes" | "recusada" | "transferiu";
  readonly detalhe: string;
};

export type PassoDoTurno = PassoDaGuarda | PassoDaResposta | PassoDaTool;

export { LIMITE_DE_OPCOES, SEM_ANEXOS, type Anexos } from "./anexos.js";

export type RespostaDoTurno = {
  readonly mensagem: string;
  readonly declaracao: Declaracao | null;
  readonly confianca: Confianca;
  readonly transferencia: PedidoDeTransferencia | null;
  readonly anexos: Anexos;
  readonly trace: readonly PassoDoTurno[];
};

type Conclusao = Omit<RespostaDoTurno, "trace" | "anexos"> & {
  readonly passos: readonly PassoDaResposta[];
};

type Execucao = {
  readonly turno: TurnoPronto;
  readonly modelo: SessaoDoModelo;
  readonly servicos: ServicosDoTurno;
};

type Andamento = {
  readonly chamadasAoModelo: number;
  readonly resultadosDeTools: readonly ResultadoDeTool[];
  readonly trace: readonly PassoDoTurno[];
};

const CONCLUSAO_DA_RECUSA = semDeclaracao(
  RESPOSTA_DA_RECUSA,
  "recusada",
  "o modelo recusou responder",
);

const CONCLUSAO_DO_LIMITE = semDeclaracao(
  RESPOSTA_DO_LIMITE_DE_ITERACOES,
  "limite_de_iteracoes",
  `o modelo pediu tools ${String(LIMITE_DE_ITERACOES)} vezes sem responder`,
);

export function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
  servicos: ServicosDoTurno,
): Promise<RespostaDoTurno> {
  return decidirAteResponder(
    { turno, modelo: modelo.iniciarTurno(), servicos },
    { chamadasAoModelo: 0, resultadosDeTools: [], trace: turno.trace },
  );
}

async function decidirAteResponder(
  execucao: Execucao,
  andamento: Andamento,
): Promise<RespostaDoTurno> {
  const { turno, modelo, servicos } = execucao;
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    anteriores: turno.anteriores,
    chamadosVencidos: turno.chamadosVencidos,
    resultadosDeTools: andamento.resultadosDeTools,
  });
  const chamadasAoModelo = andamento.chamadasAoModelo + 1;

  if (decisao.tipo !== "tools") {
    return concluir(andamento, traduzirDecisao(decisao, turno), decisao);
  }
  if (chamadasAoModelo === LIMITE_DE_ITERACOES) {
    return concluir(andamento, CONCLUSAO_DO_LIMITE, null);
  }

  const executadas = await Promise.all(
    decisao.chamadas.map((chamada) =>
      executarTool(chamada, { usuario: turno.usuario, agora: turno.agora, servicos }),
    ),
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

function concluir(
  andamento: Andamento,
  { passos, ...resposta }: Conclusao,
  decisao: DecisaoFinal | null,
): RespostaDoTurno {
  return {
    ...resposta,
    anexos: anexosDo(decisao, andamento.resultadosDeTools),
    trace: [...andamento.trace, ...passos],
  };
}

function traduzirDecisao(decisao: DecisaoFinal, turno: TurnoPronto): Conclusao {
  switch (decisao.tipo) {
    case "responder":
      return {
        mensagem: decisao.mensagem,
        declaracao: decisao.declaracao,
        confianca: decisao.declaracao.confianca,
        transferencia: null,
        passos: [],
      };
    case "transferir": {
      const resumo = resumoParaOAnalista(decisao.resumo, turno.mensagem);
      return {
        mensagem: RESPOSTA_DA_TRANSFERENCIA,
        declaracao: null,
        confianca: decisao.motivo === "baixa_confianca" ? "baixa" : "alta",
        transferencia: { motivo: decisao.motivo, resumo },
        passos: [
          { etapa: "resposta", resultado: "transferiu", detalhe: `${decisao.motivo}: ${resumo}` },
        ],
      };
    }
    case "texto_solto":
      return semDeclaracao(
        decisao.texto,
        "nao_declarou",
        "o modelo respondeu com texto solto, fora da tool responder",
      );
    case "declaracao_invalida":
      return semDeclaracao(
        decisao.mensagem,
        "declaracao_invalida",
        `o modelo chamou responder com campos inválidos: ${decisao.campos.join(", ")}`,
      );
    case "recusa":
      return CONCLUSAO_DA_RECUSA;
  }
}

function resumoParaOAnalista(doModelo: string, doFuncionario: string): string {
  return [doModelo, doFuncionario].find((texto) => texto.trim() !== "") ?? RESUMO_SEM_DETALHES;
}

function semDeclaracao(
  mensagem: string,
  resultado: PassoDaResposta["resultado"],
  detalhe: string,
): Conclusao {
  return {
    mensagem,
    declaracao: null,
    confianca: "baixa",
    transferencia: null,
    passos: [{ etapa: "resposta", resultado, detalhe }],
  };
}
