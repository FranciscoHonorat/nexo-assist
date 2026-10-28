import { describe, expect, it } from "vitest";
import { lerRascunhoId, novoRascunhoId } from "./rascunho-id.js";

const VALIDO = "rsc_0f8fad5b-d9cb-469f-a165-70867728950e";

describe("novoRascunhoId", () => {
  it("gera um id que a própria leitura aceita sem alterar", () => {
    const id = novoRascunhoId();

    expect(lerRascunhoId(id)).toEqual({ ok: true, valor: id });
  });

  it("gera ids diferentes a cada chamada", () => {
    expect(novoRascunhoId()).not.toBe(novoRascunhoId());
  });
});

describe("lerRascunhoId", () => {
  it("aceita um id no formato gerado", () => {
    expect(lerRascunhoId(VALIDO)).toEqual({ ok: true, valor: VALIDO });
  });

  it("normaliza caixa e espaços vindos da URL", () => {
    expect(lerRascunhoId(` ${VALIDO.toUpperCase()} `)).toEqual({ ok: true, valor: VALIDO });
  });

  it.each([
    "",
    "rsc_",
    "rsc_123",
    "0f8fad5b-d9cb-469f-a165-70867728950e",
    "INC-20311",
    "rsc_0f8fad5b-d9cb-169f-a165-70867728950e",
    "rsc_0f8fad5b-d9cb-469f-a165-70867728950e/../outro",
  ])("rejeita %j", (texto) => {
    expect(lerRascunhoId(texto)).toEqual({
      ok: false,
      erro: { motivo: "formato_invalido", recebido: texto },
    });
  });
});
