import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { ContextoDoPasso } from "../agent-step.js";
import { mastraAgentStep } from "./mastra-agent-step.js";

type Conteudo = Record<string, unknown>;

const uso = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

function modeloQueResponde(...respostas: { conteudo: Conteudo[]; fim?: string }[]) {
  const pendentes = [...respostas];
  return new MockLanguageModelV4({
    doGenerate: () => {
      const resposta = pendentes.shift();
      if (resposta === undefined) throw new Error("o modelo falso não tem mais respostas");
      const fim =
        resposta.fim ??
        (resposta.conteudo.some((parte) => parte["type"] === "tool-call") ? "tool-calls" : "stop");
      return Promise.resolve({
        content: resposta.conteudo as never,
        finishReason: { unified: fim as never, raw: undefined },
        usage: uso,
        warnings: [],
      });
    },
  });
}

function chamada(id: string, ferramenta: string, argumentos: object): Conteudo {
  return {
    type: "tool-call",
    toolCallId: id,
    toolName: ferramenta,
    input: JSON.stringify(argumentos),
  };
}

const raciocinio: Conteudo = {
  type: "reasoning",
  text: "",
  providerMetadata: { anthropic: { signature: "assinatura-do-raciocinio" } },
};

const declaracao = {
  entendeu: "o funcionário quer saber do chamado do notebook",
  confianca: "alta",
  porque: "ele citou o número do chamado",
} as const;

const contexto: ContextoDoPasso = {
  mensagem: "e o INC-20311?",
  chamadosVencidos: [],
  resultadosDeTools: [],
};

function passo(modelo: MockLanguageModelV4) {
  return mastraAgentStep({
    modelo,
    instrucoes: "Você é o Nexo Assist.",
    esforco: "low",
  }).iniciarTurno();
}

describe("MastraAgentStep: a resposta do modelo vira uma Decisao", () => {
  it("Dado que o modelo chama responder, Então a decisão é a resposta com a declaração", async () => {
    const modelo = modeloQueResponde({
      conteudo: [chamada("toolu_1", "responder", { declaracao, mensagem: "Ele está aberto." })],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "responder",
      declaracao,
      mensagem: "Ele está aberto.",
    });
  });

  it("Dado que o modelo pede tools de chamados, Então a decisão leva cada chamada com o id do modelo", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        raciocinio,
        chamada("toolu_1", "consultar_chamados", {}),
        chamada("toolu_2", "obter_chamado", { id: "INC-20311" }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "tools",
      chamadas: [
        { id: "toolu_1", tool: "consultar_chamados" },
        { id: "toolu_2", tool: "obter_chamado", argumentos: { id: "INC-20311" } },
      ],
    });
  });

  it("Dado que o modelo responde só com texto, Então a decisão é texto solto", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    expect(await passo(modelo).decidir(contexto)).toEqual({ tipo: "texto_solto", texto: "Olá!" });
  });
});

describe("MastraAgentStep: o histórico do turno volta exato para o modelo", () => {
  it("Dado uma rodada de tools, Quando o modelo decide de novo, Então recebe o próprio raciocínio, a chamada e o resultado ligado ao mesmo id", async () => {
    const modelo = modeloQueResponde(
      { conteudo: [raciocinio, chamada("toolu_1", "obter_chamado", { id: "INC-20311" })] },
      { conteudo: [chamada("toolu_2", "responder", { declaracao, mensagem: "Está aberto." })] },
    );
    const sessao = passo(modelo);
    await sessao.decidir(contexto);

    await sessao.decidir({
      ...contexto,
      resultadosDeTools: [
        {
          chamada: "toolu_1",
          tool: "obter_chamado",
          resposta: { ok: false, erro: { motivo: "nao_encontrado", id: "INC-20311" as never } },
        },
      ],
    });

    const prompt = modelo.doGenerateCalls[1]?.prompt ?? [];
    expect(prompt.map((mensagem) => mensagem.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
    ]);
    expect(prompt[2]).toMatchObject({
      content: [
        {
          type: "reasoning",
          providerOptions: { anthropic: { signature: "assinatura-do-raciocinio" } },
        },
        { type: "tool-call", toolCallId: "toolu_1", toolName: "obter_chamado" },
      ],
    });
    expect(prompt[3]).toMatchObject({
      content: [
        {
          type: "tool-result",
          toolCallId: "toolu_1",
          output: { type: "json", value: { ok: false, erro: { motivo: "nao_encontrado" } } },
        },
      ],
    });
  });

  it("envia o esforço configurado e deixa o modelo escolher a tool", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir(contexto);

    expect(modelo.doGenerateCalls[0]).toMatchObject({
      toolChoice: { type: "auto" },
      providerOptions: { anthropic: { effort: "low" } },
    });
    expect(modelo.doGenerateCalls[0]?.tools?.map((tool) => tool.name).sort()).toEqual([
      "consultar_chamados",
      "obter_chamado",
      "responder",
    ]);
  });
});
