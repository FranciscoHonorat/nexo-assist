import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { ContextoDoPasso } from "../agent-step.js";
import { requisicaoDaAna } from "../../tickets/contrato/fixtures.js";
import { LIMITE_DE_TOKENS_DE_SAIDA, mastraAgentStep } from "./mastra-agent-step.js";

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
  anteriores: [],
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
      opcoes: [],
      chamados: [],
    });
  });

  it("Dado um responder com opções e chamados, Então a decisão leva os dois", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        chamada("toolu_1", "responder", {
          declaracao,
          mensagem: "Qual deles?",
          opcoes: ["O do notebook", "O do monitor"],
          chamados: ["INC-20311", "REQ-10442"],
        }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "responder",
      declaracao,
      mensagem: "Qual deles?",
      opcoes: ["O do notebook", "O do monitor"],
      chamados: ["INC-20311", "REQ-10442"],
    });
  });

  it("Dado que o modelo pede tools de chamados, Então a decisão leva cada chamada com o id do modelo", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        raciocinio,
        chamada("toolu_1", "consultar_chamados", {}),
        chamada("toolu_2", "obter_chamado", { id: "INC-20311" }),
        chamada("toolu_3", "buscar_artigos", { consulta: "vpn" }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "tools",
      chamadas: [
        { id: "toolu_1", tool: "consultar_chamados" },
        { id: "toolu_2", tool: "obter_chamado", argumentos: { id: "INC-20311" } },
        { id: "toolu_3", tool: "buscar_artigos", argumentos: { consulta: "vpn" } },
      ],
    });
  });

  it("Dado que o modelo chama transferir_para_analista, Então a decisão é transferir com o motivo e o resumo", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        chamada("toolu_1", "transferir_para_analista", {
          motivo: "caso_critico",
          resumo: "A equipe inteira está sem ERP.",
        }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "transferir",
      motivo: "caso_critico",
      resumo: "A equipe inteira está sem ERP.",
    });
  });

  it("Dado um transferir_para_analista com motivo inválido, Então a transferência acontece mesmo assim, por baixa confiança", async () => {
    const modelo = modeloQueResponde({
      conteudo: [chamada("toolu_1", "transferir_para_analista", { motivo: "sei_la" })],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "transferir",
      motivo: "baixa_confianca",
      resumo: "",
    });
  });

  it("Dado que o modelo responde só com texto, Então a decisão é texto solto", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    expect(await passo(modelo).decidir(contexto)).toEqual({ tipo: "texto_solto", texto: "Olá!" });
  });
});

describe("MastraAgentStep: o que vem malformado do modelo não derruba o turno", () => {
  it("Dado que o modelo recusa (content-filter), Então a decisão é recusa", async () => {
    const modelo = modeloQueResponde({ conteudo: [], fim: "content-filter" });

    expect(await passo(modelo).decidir(contexto)).toEqual({ tipo: "recusa" });
  });

  it("Dado um responder com a declaração inválida, Então a decisão leva a mensagem e os campos inválidos", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        chamada("toolu_1", "responder", {
          declaracao: { entendeu: "algo", confianca: "talvez" },
          mensagem: "Está aberto.",
        }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "declaracao_invalida",
      mensagem: "Está aberto.",
      campos: ["declaracao.confianca", "declaracao.porque"],
    });
  });

  it("Dado um propor_chamado com categoria fora da lista, Então a chamada segue com os campos inválidos para o código responder ao modelo", async () => {
    const modelo = modeloQueResponde({
      conteudo: [
        chamada("toolu_1", "propor_chamado", {
          dados: {
            titulo: "VPN caiu",
            descricao: "A VPN cai toda hora.",
            tipo: "incidente",
            categoria: "vpn",
            prioridade: "alta",
            afetados: "so_eu",
          },
        }),
      ],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "tools",
      chamadas: [
        { id: "toolu_1", tool: "propor_chamado", argumentos: { invalidos: ["dados.categoria"] } },
      ],
    });
  });

  it("Dado um propor_chamado sem chamadosConferidos, Então a lista vem vazia", async () => {
    const dados = {
      titulo: "VPN caiu",
      descricao: "A VPN cai toda hora.",
      tipo: "incidente",
      categoria: "rede_e_vpn",
      prioridade: "alta",
      afetados: "so_eu",
    } as const;
    const modelo = modeloQueResponde({
      conteudo: [chamada("toolu_1", "propor_chamado", { dados })],
    });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "tools",
      chamadas: [
        {
          id: "toolu_1",
          tool: "propor_chamado",
          argumentos: { dados, chamadosConferidos: [] },
        },
      ],
    });
  });

  it("Dado um obter_chamado sem id, Então a chamada segue com id vazio para o domínio recusar", async () => {
    const modelo = modeloQueResponde({ conteudo: [chamada("toolu_1", "obter_chamado", {})] });

    expect(await passo(modelo).decidir(contexto)).toEqual({
      tipo: "tools",
      chamadas: [{ id: "toolu_1", tool: "obter_chamado", argumentos: { id: "" } }],
    });
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

  it("Dado mensagens anteriores na sessão, Então o modelo as recebe antes da mensagem atual, cada uma com o seu papel", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir({
      ...contexto,
      anteriores: [
        { autor: "funcionario", texto: "meu notebook está lento" },
        { autor: "agent", texto: "Desde quando?" },
      ],
    });

    const prompt = modelo.doGenerateCalls[0]?.prompt ?? [];
    expect(prompt.map((mensagem) => mensagem.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(JSON.stringify(prompt[1])).toContain("meu notebook está lento");
    expect(JSON.stringify(prompt[2])).toContain("Desde quando?");
    expect(JSON.stringify(prompt[3])).toContain("e o INC-20311?");
  });

  it("Dado qualquer pedido, Então o modelo recebe um teto de tokens de saída, para o custo por turno ter limite", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir(contexto);

    expect(modelo.doGenerateCalls[0]?.maxOutputTokens).toBe(LIMITE_DE_TOKENS_DE_SAIDA);
  });

  it("Dado mensagens do analista e eventos do sistema, Então o analista fala como o service desk e o evento chega marcado como aviso do sistema", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir({
      ...contexto,
      anteriores: [
        { autor: "analista", texto: "Reinstalei o driver." },
        { autor: "sistema", texto: "O analista devolveu a conversa ao agent." },
      ],
    });

    const [, doAnalista, doSistema] = modelo.doGenerateCalls[0]?.prompt ?? [];
    expect(doAnalista?.role).toBe("assistant");
    expect(JSON.stringify(doAnalista)).toContain("[Analista do service desk] Reinstalei o driver.");
    expect(doSistema?.role).toBe("user");
    expect(JSON.stringify(doSistema)).toContain(
      "[Aviso do sistema, não do funcionário] O analista devolveu a conversa ao agent.",
    );
  });

  it("Dado chamados vencidos do funcionário, Então o modelo os vê junto da mensagem atual", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir({ ...contexto, chamadosVencidos: [requisicaoDaAna] });

    const atual = JSON.stringify(modelo.doGenerateCalls[0]?.prompt.at(-1));
    expect(atual).toContain("e o INC-20311?");
    expect(atual).toContain("REQ-10442");
    expect(atual).toContain("vencido");
  });

  it("Dado nenhum chamado vencido, Então a mensagem atual vai sozinha, sem contexto extra", async () => {
    const modelo = modeloQueResponde({ conteudo: [{ type: "text", text: "Olá!" }] });

    await passo(modelo).decidir(contexto);

    expect(modelo.doGenerateCalls[0]?.prompt.at(-1)).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "e o INC-20311?" }],
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
      "buscar_artigos",
      "consultar_chamados",
      "obter_chamado",
      "propor_chamado",
      "propor_complemento",
      "responder",
      "transferir_para_analista",
    ]);
  });
});
