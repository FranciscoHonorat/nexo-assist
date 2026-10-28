import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { fronteiras } from "./fronteiras.js";

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
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
