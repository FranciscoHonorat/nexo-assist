import { describe, expect, it } from "vitest";
import { confirmar, criarRascunho, descartar } from "./rascunho.js";

const t0 = new Date("2026-10-28T10:00:00Z");
const t1 = new Date("2026-10-28T10:05:00Z");

describe("Rascunho: comportamento em runtime", () => {
  it("nasce pendente com o horário de criação", () => {
    expect(criarRascunho("d-1", t0)).toEqual({ id: "d-1", status: "pendente", criadoEm: t0 });
  });

  it("confirmar registra o horário e mantém id e criação", () => {
    const pendente = criarRascunho("d-1", t0);

    expect(confirmar(pendente, t1)).toEqual({
      id: "d-1",
      status: "confirmado",
      criadoEm: t0,
      confirmadoEm: t1,
    });
  });

  it("descartar registra o horário do descarte", () => {
    const pendente = criarRascunho("d-1", t0);

    expect(descartar(pendente, t1)).toEqual({
      id: "d-1",
      status: "descartado",
      criadoEm: t0,
      descartadoEm: t1,
    });
  });

  it("transições devolvem um novo objeto e não alteram o original", () => {
    const pendente = criarRascunho("d-1", t0);
    const confirmado = confirmar(pendente, t1);

    expect(confirmado).not.toBe(pendente);
    expect(pendente.status).toBe("pendente");
  });

  it("os objetos são imutáveis em runtime", () => {
    const pendente = criarRascunho("d-1", t0);

    expect(Object.isFrozen(pendente)).toBe(true);
    expect(Object.isFrozen(confirmar(pendente, t1))).toBe(true);
    expect(Object.isFrozen(descartar(pendente, t1))).toBe(true);
  });
});
