import { describe, expect, it } from "vitest";
import { lerTicketId, tipoDoChamado } from "./ticket-id.js";

describe("lerTicketId", () => {
  it.each(["INC-20311", "REQ-10442"])("aceita %s", (texto) => {
    expect(lerTicketId(texto)).toEqual({ ok: true, valor: texto });
  });

  it("normaliza caixa e espaços, como o funcionário costuma digitar", () => {
    expect(lerTicketId("  inc-20311 ")).toEqual({ ok: true, valor: "INC-20311" });
  });

  it.each([
    "",
    "INC",
    "INC-",
    "INC-abc",
    "INC-1.5",
    "INC--3",
    "CHG-123",
    "INC-20311x",
    "xINC-20311",
  ])("rejeita %j", (texto) => {
    expect(lerTicketId(texto)).toEqual({
      ok: false,
      erro: { motivo: "formato_invalido", recebido: texto },
    });
  });
});

describe("tipoDoChamado", () => {
  it("INC é incidente e REQ é requisição", () => {
    const incidente = lerTicketId("INC-1");
    const requisicao = lerTicketId("REQ-1");
    if (!incidente.ok || !requisicao.ok) throw new Error("ids de teste inválidos");

    expect(tipoDoChamado(incidente.valor)).toBe("incidente");
    expect(tipoDoChamado(requisicao.valor)).toBe("requisicao");
  });
});
