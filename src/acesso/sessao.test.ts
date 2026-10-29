import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HORA } from "../domain/tempo.js";
import { ana } from "../testes/usuarios.js";
import { DURACAO_DA_SESSAO, emitirSessao, lerSessao } from "./sessao.js";

const segredo = "um-segredo-com-pelo-menos-32-caracteres!";
const agora = new Date("2026-10-29T13:00:00Z");
const pessoa = { id: ana, papel: "funcionario" } as const;

describe("Sessão assinada: o servidor não guarda nada, e ninguém forja um papel", () => {
  it("Dado uma sessão emitida, Quando ela é lida antes de expirar, Então devolve quem é e o papel", () => {
    const token = emitirSessao(pessoa, { agora, segredo });

    expect(lerSessao(token, { agora: new Date(agora.getTime() + HORA), segredo })).toEqual({
      id: ana,
      papel: "funcionario",
      expiraEm: new Date(agora.getTime() + DURACAO_DA_SESSAO),
    });
  });

  it("Dado uma sessão expirada, Então ela não vale", () => {
    const token = emitirSessao(pessoa, { agora, segredo });

    expect(
      lerSessao(token, { agora: new Date(agora.getTime() + DURACAO_DA_SESSAO), segredo }),
    ).toBeUndefined();
  });

  it("Dado um funcionário que troca o papel para analista no token, Então a assinatura não confere", () => {
    const [, assinatura] = emitirSessao(pessoa, { agora, segredo }).split(".");
    const forjado = Buffer.from(
      JSON.stringify({ id: ana, papel: "analista", expiraEm: agora.getTime() + HORA }),
    ).toString("base64url");

    expect(lerSessao(`${forjado}.${assinatura ?? ""}`, { agora, segredo })).toBeUndefined();
  });

  it("Dado uma sessão assinada com outro segredo, Então ela não vale", () => {
    const token = emitirSessao(pessoa, {
      agora,
      segredo: "outro-segredo-com-32-caracteres-ou-mais",
    });

    expect(lerSessao(token, { agora, segredo })).toBeUndefined();
  });

  it.each(["", "abc", "abc.def", "a.b.c", `${Buffer.from("[]").toString("base64url")}.x`])(
    "Dado um token qualquer (%j), Então ele não vale",
    (token) => {
      expect(lerSessao(token, { agora, segredo })).toBeUndefined();
    },
  );

  it.each([
    ["e-mail de fora da Nexo", { id: "ana@gmail.com", papel: "funcionario", expiraEm: 9e15 }],
    ["papel inexistente", { id: ana, papel: "dono", expiraEm: 9e15 }],
    ["sem validade", { id: ana, papel: "analista" }],
  ])("Dado um token bem assinado com %s, Então ele não vale", (_, conteudo) => {
    const carga = Buffer.from(JSON.stringify(conteudo)).toString("base64url");
    const assinatura = createHmac("sha256", segredo).update(carga).digest("base64url");

    expect(lerSessao(`${carga}.${assinatura}`, { agora, segredo })).toBeUndefined();
  });
});
