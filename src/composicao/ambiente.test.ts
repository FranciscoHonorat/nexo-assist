import { describe, expect, it } from "vitest";
import { enderecoDoBanco, lerAmbiente } from "./ambiente.js";

const VALIDO = {
  DATABASE_URL: "postgres://nexo:nexo@localhost:5433/nexo",
  ANTHROPIC_API_KEY: "sk-ant-segredo",
  LLM_MODEL: "claude-haiku-5-5",
  LLM_EFFORT: "medium",
  SESSION_SECRET: "um-segredo-de-sessao-com-32-caracteres!",
};

describe("Ambiente lido no boot", () => {
  it("com as variáveis certas, a configuração sai tipada e a porta tem padrão", () => {
    expect(lerAmbiente(VALIDO)).toEqual({
      ok: true,
      valor: {
        banco: VALIDO.DATABASE_URL,
        porta: 3000,
        modelo: { chave: "sk-ant-segredo", nome: "claude-haiku-5-5", esforco: "medium" },
        sessao: { segredo: VALIDO.SESSION_SECRET, cookieSeguro: false },
      },
    });
  });

  it("a porta vem de PORT quando existe", () => {
    expect(lerAmbiente({ ...VALIDO, PORT: "8080" })).toMatchObject({
      ok: true,
      valor: { porta: 8080 },
    });
  });

  it("todas as variáveis com problema aparecem juntas, pelo nome", () => {
    expect(
      lerAmbiente({
        DATABASE_URL: VALIDO.DATABASE_URL,
        LLM_MODEL: "gpt-5",
        LLM_EFFORT: "maximo",
        PORT: "porta",
      }),
    ).toEqual({
      ok: false,
      erro: {
        motivo: "variaveis_invalidas",
        variaveis: ["ANTHROPIC_API_KEY", "LLM_MODEL", "LLM_EFFORT", "PORT", "SESSION_SECRET"],
      },
    });
  });

  it("em produção, o cookie da sessão só viaja por HTTPS", () => {
    expect(lerAmbiente({ ...VALIDO, NODE_ENV: "production" })).toMatchObject({
      valor: { sessao: { cookieSeguro: true } },
    });
  });

  it("um segredo de sessão curto é recusado, porque assinaria sessões fáceis de forjar", () => {
    expect(lerAmbiente({ ...VALIDO, SESSION_SECRET: "curto" })).toEqual({
      ok: false,
      erro: { motivo: "variaveis_invalidas", variaveis: ["SESSION_SECRET"] },
    });
  });

  it("uma variável vazia conta como ausente", () => {
    expect(lerAmbiente({ ...VALIDO, ANTHROPIC_API_KEY: "  " })).toMatchObject({
      ok: false,
      erro: { variaveis: ["ANTHROPIC_API_KEY"] },
    });
  });

  it("o erro nunca carrega o valor de uma variável", () => {
    const lido = lerAmbiente({ ...VALIDO, LLM_EFFORT: "sk-ant-vazou" });

    expect(JSON.stringify(lido)).not.toContain("sk-ant");
  });
});

describe("Endereço do banco nas mensagens de erro", () => {
  it("mostra o host, a porta e o banco, nunca o usuário nem a senha", () => {
    expect(enderecoDoBanco("postgres://nexo:senha-secreta@localhost:5433/nexo")).toBe(
      "localhost:5433/nexo",
    );
  });

  it("uma URL que não se lê não aparece no log", () => {
    expect(enderecoDoBanco("isso não é uma url senha-secreta")).toBe("(URL inválida)");
  });
});
