import { Agent, type AgentConfig } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import type { JSONValue, ModelMessage, ToolResultPart } from "ai";
import { z } from "zod";
import type {
  AgentStep,
  ChamadaDeTool,
  ContextoDoPasso,
  Decisao,
  Declaracao,
  ResultadoDeTool,
} from "../agent-step.js";

export type Esforco = "low" | "medium" | "high";

export type ConfiguracaoDoMastra = {
  readonly modelo: AgentConfig["model"];
  readonly instrucoes: string;
  readonly esforco: Esforco;
};

const declaracao = z.object({
  entendeu: z.string(),
  confianca: z.enum(["alta", "media", "baixa"]),
  porque: z.string(),
}) satisfies z.ZodType<Declaracao>;

const argumentosDoResponder = z.object({ declaracao, mensagem: z.string() }) satisfies z.ZodType<
  Omit<Extract<Decisao, { tipo: "responder" }>, "tipo">
>;
const argumentosDoObter = z.object({ id: z.string() }) satisfies z.ZodType<
  Extract<ChamadaDeTool, { tool: "obter_chamado" }>["argumentos"]
>;

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
    argumentos: argumentosDoObter.parse(args),
  }),
};

const TOOLS = {
  responder: createTool({
    id: "responder",
    description:
      "Envia a resposta ao funcionário. Toda resposta passa por aqui, com o que você entendeu, sua confiança e o porquê.",
    inputSchema: argumentosDoResponder,
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
};

type Resposta = Awaited<ReturnType<Agent["generate"]>>;

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
          if (historico.length === 0) historico = [{ role: "user", content: contexto.mensagem }];
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
          });
          historico = [...historico, ...mensagensDoModelo(resposta)];
          return paraDecisao(resposta);
        },
      };
    },
  };
}

function paraResultadoDaTool({ chamada, tool, resposta }: ResultadoDeTool): ToolResultPart {
  return {
    type: "tool-result",
    toolCallId: chamada,
    toolName: tool,
    output: { type: "json", value: JSON.parse(JSON.stringify(resposta)) as JSONValue },
  };
}

function mensagensDoModelo(resposta: Resposta): ModelMessage[] {
  return (resposta.response.messages ?? []).filter(
    (mensagem) => !(mensagem.role === "tool" && mensagem.content.length === 0),
  );
}

function paraDecisao(resposta: Resposta): Decisao {
  const chamadas = resposta.toolCalls.map(({ payload }) => payload);
  const responder = chamadas.find(({ toolName }) => toolName === "responder");
  if (responder !== undefined) {
    return { tipo: "responder", ...argumentosDoResponder.parse(responder.args) };
  }
  if (chamadas.length > 0) return { tipo: "tools", chamadas: chamadas.map(paraChamada) };
  return { tipo: "texto_solto", texto: resposta.text };
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
