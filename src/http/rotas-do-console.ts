import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  assumirConversa,
  devolverAoAgent,
  encerrarAtendimento,
  responderComoAnalista,
  type AcaoDoAnalista,
  type ErroDoConsole,
} from "../console/atendimento.js";
import { DESDE_O_COMECO } from "../conversas/conversas.js";
import type { Resultado } from "../domain/resultado.js";
import { lerUserId, type UserId } from "../domain/user-id.js";
import type { Pessoa } from "../acesso/diretorio.js";
import type { AmbienteDaRota, ServicosDaApp } from "./app.js";
import type { DetalheNoConsole, ResumoNoConsole } from "./contrato.js";
import { nomesDosAnalistas } from "./nomes.js";
import { lerCorpo, recusar, responderErro } from "./respostas.js";
import { acompanharAvisos } from "../tempo-real/acompanhar.js";
import { evento, transmitir } from "./sse.js";
import { TAMANHO_MAXIMO_DA_MENSAGEM } from "./rotas-do-chat.js";

const resposta = z.object({ texto: z.string().max(TAMANHO_MAXIMO_DA_MENSAGEM) });

type Acao = (
  acao: AcaoDoAnalista,
  conversas: ServicosDaApp["conversas"],
) => Promise<Resultado<undefined, ErroDoConsole>>;

export function rotasDoConsole(servicos: ServicosDaApp) {
  const { conversas, chamados, avisos, diretorio, agora } = servicos;
  const rotas = new Hono<AmbienteDaRota>();
  const pessoaDe = (id: UserId): Pessoa =>
    diretorio.pessoa(id) ?? { id, nome: id, area: "", papel: "funcionario" };
  const comDono = (c: Context<AmbienteDaRota>) => {
    const dono = lerUserId(c.req.param("dono") ?? "");
    return dono.ok ? dono.valor : undefined;
  };
  const agir = (executar: Acao) => async (c: Context<AmbienteDaRota>) => {
    const dono = comDono(c);
    if (dono === undefined) return recusar(c, 400, "corpo_invalido");
    const feito = await executar({ dono, analista: c.var.pessoa.id, agora: agora() }, conversas);
    return feito.ok ? c.body(null, 204) : responderErro(c, feito.erro);
  };

  rotas.get("/conversas", async (c) => {
    const lista = await conversas.listar();
    if (!lista.ok) return responderErro(c, lista.erro);
    const resumos: readonly ResumoNoConsole[] = lista.valor.map((resumo) => ({
      ...resumo,
      pessoa: pessoaDe(resumo.conversa.dono),
    }));
    return c.json({ conversas: resumos });
  });

  rotas.get("/conversas/:dono", async (c) => {
    const dono = comDono(c);
    if (dono === undefined) return recusar(c, 400, "corpo_invalido");
    const [atual, historico, doFuncionario] = await Promise.all([
      conversas.atual(dono),
      conversas.historico(dono, DESDE_O_COMECO),
      chamados.listar(dono),
    ]);
    if (!atual.ok) return responderErro(c, atual.erro);
    if (!historico.ok) return responderErro(c, historico.erro);
    if (!doFuncionario.ok) return responderErro(c, doFuncionario.erro);
    const detalhe: DetalheNoConsole = {
      pessoa: pessoaDe(dono),
      conversa: atual.valor.conversa,
      mensagens: historico.valor,
      nomes: nomesDosAnalistas(historico.valor, diretorio),
      chamados: doFuncionario.valor,
    };
    return c.json(detalhe);
  });

  rotas.post("/conversas/:dono/assumir", agir(assumirConversa));
  rotas.post("/conversas/:dono/devolver", agir(devolverAoAgent));
  rotas.post("/conversas/:dono/encerrar", agir(encerrarAtendimento));
  rotas.post("/conversas/:dono/mensagens", async (c) => {
    const corpo = await lerCorpo(c, resposta);
    if (corpo === undefined) return recusar(c, 400, "corpo_invalido");
    return agir((acao, alvo) => responderComoAnalista({ ...acao, texto: corpo.texto }, alvo))(c);
  });

  rotas.get("/eventos", (c) =>
    transmitir(c, async (stream, sinal) => {
      for await (const { dono } of acompanharAvisos(avisos, sinal)) {
        await stream.writeSSE(evento("conversa", { dono }));
      }
    }),
  );

  return rotas;
}
