import { Agent, type AgentConfig } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import type { ModelMessage, TextPart, ToolResultPart } from "ai";
import { comoJson } from "../../infraestrutura/json.js";
import { z } from "zod";
import { CONFIANCAS } from "../agent-step.js";
import { MOTIVOS_DE_TRANSFERENCIA } from "../../domain/conversa.js";
import type {
  AgentStep,
  ArgumentosInvalidos,
  PropostaDeChamado,
  PedidoDeTransferencia,
  PropostaDeComplemento,
  ChamadaDeTool,
  ContextoDoPasso,
  Decisao,
  Declaracao,
  MensagemAnterior,
  ResultadoDeTool,
} from "../agent-step.js";
import { AFETADOS, CATEGORIAS, type Chamado } from "../../domain/chamado.js";
import { PRIORIDADES } from "../../domain/prazo.js";
import { TIPOS_DE_CHAMADO } from "../../domain/ticket-id.js";

export const ESFORCOS = ["low", "medium", "high"] as const;

export type Esforco = (typeof ESFORCOS)[number];

export type ConfiguracaoDoMastra = {
  readonly modelo: AgentConfig["model"];
  readonly instrucoes: string;
  readonly esforco: Esforco;
};

const declaracao = z.object({
  entendeu: z.string(),
  confianca: z.enum(CONFIANCAS),
  porque: z.string(),
}) satisfies z.ZodType<Declaracao>;

const argumentosDoResponder = z.object({
  declaracao,
  mensagem: z.string(),
  opcoes: z.array(z.string()).default([]),
  chamados: z.array(z.string()).default([]),
}) satisfies z.ZodType<Omit<Extract<Decisao, { tipo: "responder" }>, "tipo">>;
const argumentosDaTransferencia = z.object({
  motivo: z.enum(MOTIVOS_DE_TRANSFERENCIA),
  resumo: z.string(),
}) satisfies z.ZodType<PedidoDeTransferencia>;
const mensagemSemDeclaracao = z.object({ mensagem: z.string() });
const argumentosDoObter = z.object({ id: z.string() }) satisfies z.ZodType<
  Extract<ChamadaDeTool, { tool: "obter_chamado" }>["argumentos"]
>;
const argumentosDaBusca = z.object({ consulta: z.string() }) satisfies z.ZodType<
  Extract<ChamadaDeTool, { tool: "buscar_artigos" }>["argumentos"]
>;
const argumentosDaProposta = z.object({
  dados: z.object({
    titulo: z.string(),
    descricao: z.string(),
    tipo: z.enum(TIPOS_DE_CHAMADO),
    categoria: z.enum(CATEGORIAS),
    prioridade: z.enum(PRIORIDADES),
    afetados: z.enum(AFETADOS),
  }),
  chamadosConferidos: z.array(z.string()).default([]),
}) satisfies z.ZodType<PropostaDeChamado>;
const argumentosDoComplemento = z.object({
  chamado: z.string(),
  texto: z.string(),
}) satisfies z.ZodType<PropostaDeComplemento>;

type ChamadaDoModelo = {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args?: unknown;
};

const LEITURA_DAS_CHAMADAS: Record<
  ChamadaDeTool["tool"],
  (chamada: ChamadaDoModelo) => ChamadaDeTool
> = {
  consultar_chamados: ({ toolCallId }) => ({ id: toolCallId, tool: "consultar_chamados" }),
  obter_chamado: ({ toolCallId, args }) => ({
    id: toolCallId,
    tool: "obter_chamado",
    argumentos: { id: argumentosDoObter.safeParse(args).data?.id ?? "" },
  }),
  buscar_artigos: ({ toolCallId, args }) => ({
    id: toolCallId,
    tool: "buscar_artigos",
    argumentos: { consulta: argumentosDaBusca.safeParse(args).data?.consulta ?? "" },
  }),
  propor_chamado: ({ toolCallId, args }) => ({
    id: toolCallId,
    tool: "propor_chamado",
    argumentos: lerOuApontar(argumentosDaProposta, args),
  }),
  propor_complemento: ({ toolCallId, args }) => ({
    id: toolCallId,
    tool: "propor_complemento",
    argumentos: lerOuApontar(argumentosDoComplemento, args),
  }),
};

function lerOuApontar<T>(esquema: z.ZodType<T>, args: unknown): T | ArgumentosInvalidos {
  const lidos = esquema.safeParse(args);
  if (lidos.success) return lidos.data;
  return { invalidos: lidos.error.issues.map(({ path }) => path.join(".")) };
}

const TOOLS = {
  responder: createTool({
    id: "responder",
    description:
      "Envia a resposta ao funcionário. Toda resposta passa por aqui, com o que você entendeu, sua confiança e o porquê.",
    inputSchema: argumentosDoResponder,
  }),
  transferir_para_analista: createTool({
    id: "transferir_para_analista",
    description:
      "Passa a conversa para um analista humano. Use quando o funcionário pedir, num caso crítico, num chamado vencido ou quando você não tiver segurança sobre o que fazer. O resumo deve dar ao analista o contexto, sem ele precisar perguntar de novo.",
    inputSchema: argumentosDaTransferencia,
  }),
  consultar_chamados: createTool({
    id: "consultar_chamados",
    description: "Lista os chamados do funcionário que está conversando.",
    inputSchema: z.object({}),
  }),
  obter_chamado: createTool({
    id: "obter_chamado",
    description: "Obtém um chamado do funcionário pelo número, como INC-20311 ou REQ-10442.",
    inputSchema: argumentosDoObter,
  }),
  propor_chamado: createTool({
    id: "propor_chamado",
    description:
      "Propõe um rascunho de chamado novo, que o funcionário confere e confirma num card. Se o código apontar candidatos a duplicidade, prefira propor_complemento ou repita a proposta listando em chamadosConferidos os que você conferiu.",
    inputSchema: argumentosDaProposta,
  }),
  propor_complemento: createTool({
    id: "propor_complemento",
    description:
      "Propõe acrescentar informações a um chamado existente do funcionário (aberto, ou resolvido há até 7 dias, que reabre). O funcionário confirma num card.",
    inputSchema: argumentosDoComplemento,
  }),
  buscar_artigos: createTool({
    id: "buscar_artigos",
    description:
      "Busca artigos da central de ajuda. Use antes de responder uma dúvida ou de propor um chamado.",
    inputSchema: argumentosDaBusca,
  }),
};

export const NOMES_DAS_TOOLS = Object.keys(TOOLS);

type Resposta = Awaited<ReturnType<Agent["generate"]>>;

export const LIMITE_DE_TOKENS_DE_SAIDA = 4096;

export function mastraAgentStep({ modelo, instrucoes, esforco }: ConfiguracaoDoMastra): AgentStep {
  const agent = new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: instrucoes,
    model: modelo,
  });

  return {
    iniciarTurno: () => {
      let historico: ModelMessage[] = [];
      let resultadosEnviados = 0;

      return {
        decidir: async (contexto: ContextoDoPasso) => {
          if (historico.length === 0) historico = mensagensIniciais(contexto);
          const novos = contexto.resultadosDeTools.slice(resultadosEnviados);
          if (novos.length > 0) {
            historico = [...historico, { role: "tool", content: novos.map(paraResultadoDaTool) }];
            resultadosEnviados = contexto.resultadosDeTools.length;
          }
          const resposta = await agent.generate(historico, {
            maxSteps: 1,
            clientTools: TOOLS,
            toolChoice: "auto",
            providerOptions: { anthropic: { effort: esforco } },
            modelSettings: { maxOutputTokens: LIMITE_DE_TOKENS_DE_SAIDA },
          });
          historico = [...historico, ...mensagensDoModelo(resposta)];
          return paraDecisao(resposta);
        },
      };
    },
  };
}

const AVISO_DO_SISTEMA = "[Aviso do sistema, não do funcionário]";
const DO_ANALISTA = "[Analista do service desk]";

function mensagensIniciais({
  anteriores,
  mensagem,
  chamadosVencidos,
}: ContextoDoPasso): ModelMessage[] {
  const atual: ModelMessage = {
    role: "user",
    content: [
      { type: "text", text: mensagem },
      ...(chamadosVencidos.length === 0 ? [] : [avisoDosVencidos(chamadosVencidos)]),
    ],
  };
  return [...anteriores.map(paraMensagemDoModelo), atual];
}

function paraMensagemDoModelo({ autor, texto }: MensagemAnterior): ModelMessage {
  switch (autor) {
    case "funcionario":
      return { role: "user", content: texto };
    case "agent":
      return { role: "assistant", content: texto };
    case "analista":
      return { role: "assistant", content: `${DO_ANALISTA} ${texto}` };
    case "sistema":
      return { role: "user", content: `${AVISO_DO_SISTEMA} ${texto}` };
  }
}

function avisoDosVencidos(vencidos: readonly Chamado[]): TextPart {
  const lista = vencidos
    .map(
      ({ id, dados, status }) =>
        `${id} (${dados.titulo}, prioridade ${dados.prioridade}, ${status})`,
    )
    .join("; ");
  return {
    type: "text",
    text: `${AVISO_DO_SISTEMA} Chamados do funcionário com prazo vencido: ${lista}.`,
  };
}

function paraResultadoDaTool({ chamada, tool, resposta }: ResultadoDeTool): ToolResultPart {
  return {
    type: "tool-result",
    toolCallId: chamada,
    toolName: tool,
    output: { type: "json", value: comoJson(resposta) },
  };
}

function mensagensDoModelo(resposta: Resposta): ModelMessage[] {
  return (resposta.response.messages ?? []).filter(
    (mensagem) => !(mensagem.role === "tool" && mensagem.content.length === 0),
  );
}

function paraDecisao(resposta: Resposta): Decisao {
  if (resposta.finishReason === "content-filter") return { tipo: "recusa" };
  const chamadas = resposta.toolCalls.map(({ payload }) => payload);
  const transferencia = chamadas.find(({ toolName }) => toolName === "transferir_para_analista");
  if (transferencia !== undefined) return paraTransferencia(transferencia.args);
  const responder = chamadas.find(({ toolName }) => toolName === "responder");
  if (responder !== undefined) return paraResposta(responder.args, resposta.text);
  if (chamadas.length > 0) return { tipo: "tools", chamadas: chamadas.map(paraChamada) };
  return { tipo: "texto_solto", texto: resposta.text };
}

function paraTransferencia(argumentos: unknown): Decisao {
  const lidos = argumentosDaTransferencia.safeParse(argumentos);
  return lidos.success
    ? { tipo: "transferir", ...lidos.data }
    : { tipo: "transferir", motivo: "baixa_confianca", resumo: "" };
}

function paraResposta(argumentos: unknown, texto: string): Decisao {
  const lidos = argumentosDoResponder.safeParse(argumentos);
  if (lidos.success) return { tipo: "responder", ...lidos.data };
  const mensagem = mensagemSemDeclaracao.safeParse(argumentos).data?.mensagem ?? texto;
  const campos = lidos.error.issues.map(({ path }) => path.join("."));
  return { tipo: "declaracao_invalida", mensagem, campos };
}

function paraChamada(chamada: ChamadaDoModelo): ChamadaDeTool {
  if (!ehToolDeChamados(chamada.toolName)) {
    throw new Error(`o modelo chamou uma tool que não foi oferecida: ${chamada.toolName}`);
  }
  return LEITURA_DAS_CHAMADAS[chamada.toolName](chamada);
}

function ehToolDeChamados(nome: string): nome is ChamadaDeTool["tool"] {
  return Object.hasOwn(LEITURA_DAS_CHAMADAS, nome);
}
