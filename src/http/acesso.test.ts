import { describe, expect, it } from "vitest";
import { DURACAO_DA_SESSAO, emitirSessao } from "../acesso/sessao.js";
import { lerUserId } from "../domain/user-id.js";
import { valorDe } from "../testes/valor-de.js";
import { appDeTeste, SEGREDO, SENHA } from "../testes/http.js";

describe("HTTP: entrar, sair e quem pode o quê", () => {
  it("Dado o e-mail e a senha certos, Então a sessão vem num cookie que o JavaScript da página não lê", async () => {
    const { pedir } = await appDeTeste();

    const resposta = await pedir("POST", "/api/entrar", {
      corpo: { email: "ana@nexo.com", senha: SENHA },
    });

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({
      pessoa: { id: "ana@nexo.com", nome: "Ana Souza", area: "Financeiro", papel: "funcionario" },
    });
    const cookie = resposta.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^sessao=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${String(DURACAO_DA_SESSAO / 1000)}`);
  });

  it("Dado a senha errada, Então a resposta é 401 sem cookie e sem dizer se o e-mail existe", async () => {
    const { pedir } = await appDeTeste();

    const resposta = await pedir("POST", "/api/entrar", {
      corpo: { email: "ana@nexo.com", senha: "chute" },
    });

    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual({ erro: "credenciais_invalidas" });
    expect(resposta.headers.get("set-cookie")).toBeNull();
  });

  it("Dado um corpo que não é o esperado, Então a resposta é 400", async () => {
    const { pedir } = await appDeTeste();

    expect((await pedir("POST", "/api/entrar", { corpo: { email: 1 } })).status).toBe(400);
    expect(
      (
        await pedir("POST", "/api/entrar", {
          cabecalhos: { "content-type": "application/json" },
          corpo: undefined,
        })
      ).status,
    ).toBe(400);
  });

  it("Dado uma sessão, Então /api/eu devolve a pessoa; depois de sair, o cookie é apagado", async () => {
    const { pedir, entrar } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");

    expect(await (await pedir("GET", "/api/eu", { cookie })).json()).toMatchObject({
      pessoa: { nome: "Ana Souza" },
    });
    const saida = await pedir("POST", "/api/sair", { cookie });
    expect(saida.status).toBe(204);
    expect(saida.headers.get("set-cookie")).toMatch(/^sessao=;.*Max-Age=0/);
  });

  it.each([
    ["sem cookie", undefined],
    ["com cookie forjado", "sessao=abc.def"],
  ])("Dado um pedido %s, Então as rotas protegidas respondem 401", async (_, cookie) => {
    const { pedir } = await appDeTeste();
    const comCookie = cookie === undefined ? {} : { cookie };

    for (const [metodo, caminho] of [
      ["GET", "/api/eu"],
      ["POST", "/api/mensagens"],
      ["GET", "/api/conversa/eventos"],
      ["GET", "/api/console/conversas"],
    ] as const) {
      expect((await pedir(metodo, caminho, comCookie)).status).toBe(401);
    }
  });

  it("Dado uma sessão bem assinada de alguém que saiu do diretório, Então ela não vale mais", async () => {
    const { pedir } = await appDeTeste();
    const token = emitirSessao(
      { id: valorDe(lerUserId("ex.funcionario@nexo.com")), papel: "analista" },
      { agora: new Date("2026-10-29T13:00:00Z"), segredo: SEGREDO },
    );

    expect((await pedir("GET", "/api/eu", { cookie: `sessao=${token}` })).status).toBe(401);
  });

  it("Dado um funcionário, Quando ele chama o console do analista, Então a resposta é 403", async () => {
    const { pedir, entrar } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");

    expect((await pedir("GET", "/api/console/conversas", { cookie })).status).toBe(403);
    expect(
      (await pedir("POST", "/api/console/conversas/joao@nexo.com/assumir", { cookie })).status,
    ).toBe(403);
  });

  it("Dado um analista, Quando ele tenta usar o chat como funcionário, Então a resposta é 403", async () => {
    const { pedir, entrar } = await appDeTeste();
    const cookie = await entrar("bruno.n1@nexo.com");

    expect((await pedir("POST", "/api/mensagens", { cookie, corpo: { texto: "oi" } })).status).toBe(
      403,
    );
  });

  it("Dado um pedido vindo de outro site com o cookie da Ana, Então ele é recusado antes de chegar à rota", async () => {
    const { pedir, entrar } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");

    const resposta = await pedir("POST", "/api/sessao", {
      cookie,
      cabecalhos: { origin: "https://site-malicioso.example" },
    });

    expect(resposta.status).toBe(403);
  });

  it("Dado uma rota da API que não existe, Então a resposta é 404 em JSON, e não a página da interface", async () => {
    const { pedir, entrar } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");

    const resposta = await pedir("GET", "/api/nao-existe", { cookie });

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ erro: "nao_encontrado" });
  });

  it("Dado a plataforma de deploy conferindo a saúde, Então /api/saude responde sem sessão", async () => {
    const { pedir } = await appDeTeste();

    const resposta = await pedir("GET", "/api/saude");

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });
});
