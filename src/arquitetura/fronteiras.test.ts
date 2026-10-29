import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { fronteiras } from "./fronteiras.js";

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser: tseslint.parser } },
    ...fronteiras,
  ],
});

async function violacoes(arquivo: string, importacao: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(`import { x } from "${importacao}";\nexport { x };\n`, {
    filePath: arquivo,
  });
  return (resultado?.messages ?? []).map((mensagem) => mensagem.message);
}

describe("Fronteira do serviço de chamados", () => {
  it.each([
    "../tickets/em-memoria.js",
    "../tickets/resiliente.js",
    "../tickets/contrato/index.js",
    "../tickets/contrato/fixtures.js",
  ])("fora de src/tickets, importar a implementação %s viola a fronteira", async (importacao) => {
    expect(await violacoes("src/agent/turno.ts", importacao)).toEqual([
      expect.stringContaining("só pela interface TicketClient"),
    ]);
  });

  it("fora de src/tickets, importar a interface é permitido", async () => {
    expect(await violacoes("src/agent/turno.ts", "../tickets/ticket-client.js")).toEqual([]);
  });

  it("um teste pode usar a versão em memória como dublê", async () => {
    expect(await violacoes("src/agent/turno.test.ts", "../tickets/em-memoria.js")).toEqual([]);
  });

  it("a composição monta as implementações reais", async () => {
    expect(await violacoes("src/composicao/servicos.ts", "../tickets/resiliente.js")).toEqual([]);
  });

  it("dentro de src/tickets, as implementações se conhecem", async () => {
    expect(await violacoes("src/tickets/resiliente.ts", "./em-memoria.js")).toEqual([]);
  });
});

describe("Fronteira do domínio", () => {
  it.each(["../tickets/ticket-client.js", "../agent/turno.js", "../testes/valor-de.js"])(
    "o domínio não importa de fora dele: %s",
    async (importacao) => {
      expect(await violacoes("src/domain/chamado.ts", importacao)).toEqual([
        expect.stringContaining("O domínio é a camada mais interna"),
      ]);
    },
  );

  it("dentro do domínio, os módulos se importam", async () => {
    expect(await violacoes("src/domain/chamado.ts", "./resultado.js")).toEqual([]);
  });

  it("um teste do domínio pode usar o apoio comum de testes", async () => {
    expect(await violacoes("src/domain/chamado.test.ts", "../testes/valor-de.js")).toEqual([]);
  });
});

describe("Fronteira de conversas", () => {
  it.each([
    "../conversas/em-memoria.js",
    "../conversas/postgres/cliente.js",
    "../conversas/contrato/index.js",
  ])("fora de src/conversas, importar a implementação %s viola a fronteira", async (importacao) => {
    expect(await violacoes("src/agent/turno.ts", importacao)).toEqual([
      expect.stringContaining("só pela interface Conversas"),
    ]);
  });

  it("fora de src/conversas, importar a interface é permitido", async () => {
    expect(await violacoes("src/agent/turno.ts", "../conversas/conversas.js")).toEqual([]);
  });

  it("a composição monta as implementações reais", async () => {
    expect(
      await violacoes("src/composicao/servicos.ts", "../conversas/postgres/cliente.js"),
    ).toEqual([]);
  });
});

describe("Fronteira da infraestrutura compartilhada", () => {
  it.each(["../tickets/ticket-client.js", "../conversas/conversas.js", "../agent/turno.js"])(
    "a infraestrutura não depende dos módulos de negócio: %s",
    async (importacao) => {
      expect(await violacoes("src/infraestrutura/banco.ts", importacao)).toEqual(
        expect.arrayContaining([expect.stringContaining("A infraestrutura compartilhada")]),
      );
    },
  );

  it("a infraestrutura pode usar o domínio", async () => {
    expect(await violacoes("src/infraestrutura/banco.ts", "../domain/resultado.js")).toEqual([]);
  });
});

describe("Fronteira do framework de agent", () => {
  it.each(["@mastra/core/agent", "@mastra/core/tools", "ai", "ai/test", "@ai-sdk/anthropic"])(
    "fora de src/agent/mastra, importar %s viola a fronteira",
    async (importacao) => {
      expect(await violacoes("src/agent/turno.ts", importacao)).toEqual([
        expect.stringContaining("só dentro de src/agent/mastra"),
      ]);
    },
  );

  it("dentro de src/agent/mastra, o adaptador usa o framework", async () => {
    expect(await violacoes("src/agent/mastra/mastra-agent-step.ts", "@mastra/core/agent")).toEqual(
      [],
    );
  });

  it.each(["aiko", "./ai.js"])(
    "um módulo que só começa com ai não é o AI SDK: %s",
    async (importacao) => {
      expect(await violacoes("src/agent/turno.ts", importacao)).toEqual([]);
    },
  );
});

describe("Fronteira da interface", () => {
  it.each([
    "../../src/agent/atender.js",
    "../../src/conversas/em-memoria.js",
    "../src/domain/conversa.js",
  ])("na interface, importar código do servidor (%s) viola a fronteira", async (importacao) => {
    expect(await violacoes("web/src/chat/Chat.tsx", importacao)).toEqual([
      expect.stringContaining("só pelo contrato da API"),
    ]);
  });

  it("na interface, importar o contrato da API é permitido", async () => {
    expect(await violacoes("web/src/api.ts", "../../src/http/contrato.js")).toEqual([]);
  });
});

describe("Reexportações", () => {
  it.each([
    'export { ticketClientEmMemoria } from "../tickets/em-memoria.js";',
    'export * from "../tickets/em-memoria.js";',
  ])("reexportar uma implementação também viola a fronteira: %s", async (codigo) => {
    const [resultado] = await eslint.lintText(`${codigo}\n`, { filePath: "src/agent/turno.ts" });

    expect(resultado?.messages.map((mensagem) => mensagem.message)).toEqual([
      expect.stringContaining("só pela interface TicketClient"),
    ]);
  });
});
