import { describe, expect, it } from "vitest";
import { lerRascunhoId } from "./rascunho-id.js";
import { confirmar, criarRascunho, descartar } from "./rascunho.js";
import type { Resultado } from "./resultado.js";
import { lerUserId } from "./user-id.js";

function valorDe<T>(resultado: Resultado<T, unknown>): T {
  if (!resultado.ok) throw new Error("fixture inválida");
  return resultado.valor;
}

const id = valorDe(lerRascunhoId("rsc_0f8fad5b-d9cb-469f-a165-70867728950e"));
const ana = valorDe(lerUserId("ana@nexo.com"));
const joao = valorDe(lerUserId("joao@nexo.com"));
const t0 = new Date("2026-10-28T10:00:00Z");
const t1 = new Date("2026-10-28T10:05:00Z");

const pendenteDaAna = () => criarRascunho({ id, dono: ana, agora: t0 });

describe("Rascunho: comportamento em runtime", () => {
  it("nasce pendente, com dono e horário de criação", () => {
    expect(pendenteDaAna()).toEqual({ id, dono: ana, status: "pendente", criadoEm: t0 });
  });

  it("o dono confirma, e o horário da confirmação fica registrado", () => {
    expect(confirmar(pendenteDaAna(), { por: ana, agora: t1 })).toEqual({
      ok: true,
      valor: { id, dono: ana, status: "confirmado", criadoEm: t0, confirmadoEm: t1 },
    });
  });

  it("o dono descarta, e o horário do descarte fica registrado", () => {
    expect(descartar(pendenteDaAna(), { por: ana, agora: t1 })).toEqual({
      ok: true,
      valor: { id, dono: ana, status: "descartado", criadoEm: t0, descartadoEm: t1 },
    });
  });

  it.each([
    ["confirmar", confirmar],
    ["descartar", descartar],
  ] as const)("outra pessoa não pode %s o rascunho", (_, transicao) => {
    expect(transicao(pendenteDaAna(), { por: joao, agora: t1 })).toEqual({
      ok: false,
      erro: { motivo: "nao_e_o_dono", rascunhoId: id, tentouPor: joao },
    });
  });

  it("transições devolvem um novo objeto e não alteram o original", () => {
    const pendente = pendenteDaAna();
    const confirmado = confirmar(pendente, { por: ana, agora: t1 });

    expect(valorDe(confirmado)).not.toBe(pendente);
    expect(pendente.status).toBe("pendente");
  });

  it("os objetos são imutáveis em runtime", () => {
    const pendente = pendenteDaAna();

    expect(Object.isFrozen(pendente)).toBe(true);
    expect(Object.isFrozen(valorDe(confirmar(pendente, { por: ana, agora: t1 })))).toBe(true);
    expect(Object.isFrozen(valorDe(descartar(pendente, { por: ana, agora: t1 })))).toBe(true);
  });
});
