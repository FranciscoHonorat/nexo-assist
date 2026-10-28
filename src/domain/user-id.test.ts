import { describe, expect, it } from "vitest";
import { lerUserId } from "./user-id.js";

describe("lerUserId", () => {
  it.each(["ana@nexo.com", "joao.silva@nexo.com", "ti+suporte@nexo.com"])("aceita %s", (email) => {
    expect(lerUserId(email)).toEqual({ ok: true, valor: email });
  });

  it("normaliza caixa e espaços, porque o mesmo funcionário não pode virar dois", () => {
    expect(lerUserId("  Ana@Nexo.COM ")).toEqual({ ok: true, valor: "ana@nexo.com" });
  });

  it.each(["ana@gmail.com", "ana@nexo.com.br", "ana@sub.nexo.com", "ana@nexo.co"])(
    "rejeita e-mail de fora da empresa: %s",
    (email) => {
      expect(lerUserId(email)).toEqual({
        ok: false,
        erro: { motivo: "dominio_externo", recebido: email },
      });
    },
  );

  it.each(["", "ana", "@nexo.com", "ana@@nexo.com", "a na@nexo.com", "ana@"])(
    "rejeita texto que não é e-mail: %j",
    (email) => {
      expect(lerUserId(email)).toEqual({
        ok: false,
        erro: { motivo: "email_invalido", recebido: email },
      });
    },
  );
});
