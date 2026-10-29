import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import type { Diretorio, Papel, Pessoa } from "../acesso/diretorio.js";
import { DURACAO_DA_SESSAO, emitirSessao, lerSessao } from "../acesso/sessao.js";
import type { AgentStep } from "../agent/agent-step.js";
import type { Conversas } from "../conversas/conversas.js";
import type { Avisos } from "../tempo-real/avisos.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { PessoaDaApi } from "./contrato.js";
import { criarLimiteDeTurnos, type PoliticaDeTurnos } from "./limite.js";
import { lerCorpo, recusar } from "./respostas.js";
import { rotasDoChat } from "./rotas-do-chat.js";
import { rotasDoConsole } from "./rotas-do-console.js";

export type ServicosDaApp = {
  readonly diretorio: Diretorio;
  readonly segredo: string;
  readonly conversas: Conversas;
  readonly avisos: Avisos;
  readonly chamados: TicketClient;
  readonly modelo: AgentStep;
  readonly agora: () => Date;
  readonly cookieSeguro: boolean;
  readonly limiteDeTurnos: PoliticaDeTurnos;
};

export type AmbienteDaRota = { readonly Variables: { readonly pessoa: Pessoa } };

const COOKIE_DA_SESSAO = "sessao";

const credenciais = z.object({ email: z.string().max(200), senha: z.string().max(200) });

export function criarApp(servicos: ServicosDaApp): Hono {
  const { diretorio, segredo, agora, cookieSeguro } = servicos;
  const app = new Hono();
  app.use(secureHeaders(), csrf());

  app.get("/api/saude", (c) => c.json({ ok: true }));

  app.post("/api/entrar", async (c) => {
    const corpo = await lerCorpo(c, credenciais);
    if (corpo === undefined) return recusar(c, 400, "corpo_invalido");
    const entrou = await diretorio.autenticar(corpo);
    if (!entrou.ok) return recusar(c, 401, "credenciais_invalidas");
    setCookie(c, COOKIE_DA_SESSAO, emitirSessao(entrou.valor, { agora: agora(), segredo }), {
      httpOnly: true,
      sameSite: "Lax",
      secure: cookieSeguro,
      path: "/",
      maxAge: DURACAO_DA_SESSAO / 1000,
    });
    return c.json({ pessoa: entrou.valor } satisfies PessoaDaApi);
  });

  app.post("/api/sair", (c) => {
    deleteCookie(c, COOKIE_DA_SESSAO, { path: "/", secure: cookieSeguro });
    return c.body(null, 204);
  });

  const autenticado = createMiddleware<AmbienteDaRota>(async (c, seguir) => {
    const sessao = lerSessao(getCookie(c, COOKIE_DA_SESSAO) ?? "", { agora: agora(), segredo });
    const pessoa = sessao === undefined ? undefined : diretorio.pessoa(sessao.id);
    if (pessoa === undefined) return recusar(c, 401, "sem_sessao");
    c.set("pessoa", pessoa);
    await seguir();
    return undefined;
  });

  const so = (papel: Papel) =>
    createMiddleware<AmbienteDaRota>(async (c, seguir) => {
      if (c.var.pessoa.papel !== papel) return recusar(c, 403, "sem_permissao");
      await seguir();
      return undefined;
    });

  app.get("/api/eu", autenticado, (c) => c.json({ pessoa: c.var.pessoa } satisfies PessoaDaApi));

  const limite = criarLimiteDeTurnos(servicos.limiteDeTurnos);
  app.use("/api/mensagens", autenticado, so("funcionario"));
  app.use("/api/conversa/*", autenticado, so("funcionario"));
  app.use("/api/rascunhos/*", autenticado, so("funcionario"));
  app.use("/api/sessao", autenticado, so("funcionario"));
  app.route("/api", rotasDoChat(servicos, limite));

  app.use("/api/console/*", autenticado, so("analista"));
  app.route("/api/console", rotasDoConsole(servicos));

  app.all("/api/*", (c) => recusar(c, 404, "nao_encontrado"));

  return app;
}
