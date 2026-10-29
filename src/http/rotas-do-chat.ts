import { Hono } from "hono";
import { z } from "zod";
import { atenderMensagem } from "../agent/atender.js";
import { confirmarRascunho, descartarRascunho } from "../agent/confirmar.js";
import { LIMITE_DE_MENSAGENS_POR_SESSAO } from "../agent/guardas.js";
import { DESDE_O_COMECO, type Conversas } from "../conversas/conversas.js";
import type { UserId } from "../domain/user-id.js";
import { acompanharConversa } from "../tempo-real/acompanhar.js";
import type { AmbienteDaRota, ServicosDaApp } from "./app.js";
import type { EstadoDaConversa, LoteDeMensagens } from "./contrato.js";
import type { LimiteDeTurnos } from "./limite.js";
import { nomesDosAnalistas } from "./nomes.js";
import { lerCorpo, recusar, responderErro } from "./respostas.js";
import { evento, transmitir } from "./sse.js";

export const TAMANHO_MAXIMO_DA_MENSAGEM = 2000;

const mensagem = z.object({
  texto: z.string().trim().min(1).max(TAMANHO_MAXIMO_DA_MENSAGEM),
});

export function rotasDoChat(servicos: ServicosDaApp, limite: LimiteDeTurnos) {
  const { conversas, chamados, modelo, avisos, diretorio, agora } = servicos;
  const rotas = new Hono<AmbienteDaRota>();

  rotas.post("/mensagens", async (c) => {
    const corpo = await lerCorpo(c, mensagem);
    if (corpo === undefined) return recusar(c, 400, "corpo_invalido");
    const usuario = c.var.pessoa.id;
    const liberacao = limite.comecar(usuario, agora());
    if (liberacao !== "liberado") return recusar(c, 429, liberacao);
    try {
      const atendido = await atenderMensagem(
        { usuario, mensagem: corpo.texto, agora: agora() },
        { conversas, chamados, modelo },
      );
      if (!atendido.ok) return responderErro(c, atendido.erro);
      return c.json(atendido.valor);
    } finally {
      limite.terminar(usuario);
    }
  });

  rotas.post("/rascunhos/:id/confirmar", async (c) => {
    const confirmado = await confirmarRascunho(
      { id: c.req.param("id"), por: c.var.pessoa.id, agora: agora() },
      { conversas, chamados },
    );
    return confirmado.ok
      ? c.json({ chamado: confirmado.valor })
      : responderErro(c, confirmado.erro);
  });

  rotas.post("/rascunhos/:id/descartar", async (c) => {
    const descartado = await descartarRascunho(
      { id: c.req.param("id"), por: c.var.pessoa.id, agora: agora() },
      { conversas },
    );
    return descartado.ok ? c.body(null, 204) : responderErro(c, descartado.erro);
  });

  rotas.post("/sessao", async (c) => {
    const iniciada = await conversas.iniciarSessao(c.var.pessoa.id, agora());
    return iniciada.ok ? c.body(null, 204) : responderErro(c, iniciada.erro);
  });

  rotas.get("/conversa/eventos", (c) => {
    const dono = c.var.pessoa.id;
    const ultimaVista = lerCursor(c.req.header("last-event-id") ?? c.req.query("desde"));
    return transmitir(c, async (stream, sinal) => {
      const enviarEstado = async () => {
        const estado = await estadoDa(dono, conversas);
        if (estado !== undefined) await stream.writeSSE(evento("estado", estado));
      };
      await enviarEstado();
      for await (const lote of acompanharConversa(
        dono,
        ultimaVista,
        { conversas, avisos },
        sinal,
      )) {
        if (!lote.ok) {
          await stream.writeSSE(evento("erro", { erro: lote.erro.motivo }));
          return;
        }
        const enviado: LoteDeMensagens = {
          mensagens: lote.valor,
          nomes: nomesDosAnalistas(lote.valor, diretorio),
        };
        await stream.writeSSE(evento("mensagens", enviado, lote.valor.at(-1)?.id));
        await enviarEstado();
      }
    });
  });

  return rotas;
}

async function estadoDa(dono: UserId, conversas: Conversas): Promise<EstadoDaConversa | undefined> {
  const atual = await conversas.atual(dono);
  if (!atual.ok) return undefined;
  return {
    controle: atual.valor.conversa.controle,
    mensagensNaSessao: atual.valor.mensagensNaSessao,
    limite: LIMITE_DE_MENSAGENS_POR_SESSAO,
  };
}

function lerCursor(valor: string | undefined): number {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : DESDE_O_COMECO;
}
