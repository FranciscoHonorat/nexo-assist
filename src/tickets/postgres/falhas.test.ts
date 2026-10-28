import { describe, expect, it } from "vitest";
import { ehFalhaDeInfraestrutura } from "./falhas.js";

function comCodigo(code: string, message = "falha"): Error {
  return Object.assign(new Error(message), { code });
}

function embrulhado(causa: unknown): Error {
  return new Error("Failed query: select 1", { cause: causa });
}

describe("ehFalhaDeInfraestrutura", () => {
  it.each([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EHOSTUNREACH",
  ])("erro de rede do Node (%s) é infraestrutura", (code) => {
    expect(ehFalhaDeInfraestrutura(comCodigo(code))).toBe(true);
  });

  it.each(["08000", "08003", "08006", "57P01", "57P02", "57P03", "53300"])(
    "SQLSTATE de conexão do PostgreSQL (%s) é infraestrutura",
    (code) => {
      expect(ehFalhaDeInfraestrutura(comCodigo(code))).toBe(true);
    },
  );

  it.each([
    "Connection terminated unexpectedly",
    "Connection terminated due to connection timeout",
    "Client has encountered a connection error and is not queryable",
    "timeout exceeded when trying to connect",
  ])("mensagem de conexão encerrada do driver pg (%j) é infraestrutura", (mensagem) => {
    expect(ehFalhaDeInfraestrutura(new Error(mensagem))).toBe(true);
  });

  it("procura a causa dentro de erros embrulhados, como os do Drizzle", () => {
    expect(ehFalhaDeInfraestrutura(embrulhado(embrulhado(comCodigo("ECONNREFUSED"))))).toBe(true);
  });

  it.each([
    ["violação de UNIQUE", comCodigo("23505")],
    ["violação de CHECK", comCodigo("23514")],
    ["erro de sintaxe SQL", comCodigo("42601")],
    [
      "pool usado depois de encerrado",
      new Error("Cannot use a pool after calling end on the pool"),
    ],
    ["erro qualquer", new Error("deu ruim")],
    ["valor que não é Error", "texto solto"],
    ["undefined", undefined],
  ])("%s não é infraestrutura: é bug e precisa aparecer", (_, erro) => {
    expect(ehFalhaDeInfraestrutura(erro)).toBe(false);
    expect(ehFalhaDeInfraestrutura(embrulhado(erro))).toBe(false);
  });

  it("uma cadeia de causas circular não trava a classificação", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    Object.assign(a, { cause: b });

    expect(ehFalhaDeInfraestrutura(a)).toBe(false);
  });
});
