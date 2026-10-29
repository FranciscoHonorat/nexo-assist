import { and, asc, eq, getTableColumns, gt, max } from "drizzle-orm";
import { novaConversa, type Conversa, type Controle } from "../../domain/conversa.js";
import type { RascunhoId } from "../../domain/rascunho-id.js";
import type { Rascunho } from "../../domain/rascunho.js";
import { falha, sucesso } from "../../domain/resultado.js";
import { protegerDaQuedaDoBanco } from "../../infraestrutura/falhas-do-postgres.js";
import type { UserId } from "../../domain/user-id.js";
import type { Banco } from "../../infraestrutura/banco.js";
import {
  DESDE_O_COMECO,
  eventoDa,
  eventoDaResolucao,
  mesmoControle,
  resolvidoEm,
  type ConteudoDaMensagem,
  type Conversas,
  type ErroDeControle,
  type Mensagem,
} from "../conversas.js";
import { conversas, mensagens, rascunhos } from "./esquema.js";

type LinhaDaConversa = typeof conversas.$inferSelect;
type LinhaDaMensagem = typeof mensagens.$inferSelect;
type LinhaDoRascunho = typeof rascunhos.$inferSelect;
type ColunasDoControle = Omit<LinhaDaConversa, "dono" | "sessaoDesde">;

const CONTROLE_MUDOU: ErroDeControle = { motivo: "controle_mudou" };

export function conversasPostgres(db: Banco): Conversas {
  const operacoes = conversasSemProtecao(db);
  return {
    atual: (dono) => protegerDaQuedaDoBanco(() => operacoes.atual(dono)),
    transicionar: (transicao, agora) =>
      protegerDaQuedaDoBanco(() => operacoes.transicionar(transicao, agora)),
    registrarMensagem: (dono, mensagem) =>
      protegerDaQuedaDoBanco(() => operacoes.registrarMensagem(dono, mensagem)),
    registrarMensagemDoAnalista: (conversa, mensagem) =>
      protegerDaQuedaDoBanco(() => operacoes.registrarMensagemDoAnalista(conversa, mensagem)),
    registrarTurno: (dono, turno) =>
      protegerDaQuedaDoBanco(() => operacoes.registrarTurno(dono, turno)),
    iniciarSessao: (dono, agora) =>
      protegerDaQuedaDoBanco(() => operacoes.iniciarSessao(dono, agora)),
    historico: (dono, depois) => protegerDaQuedaDoBanco(() => operacoes.historico(dono, depois)),
    guardarRascunho: (rascunho) =>
      protegerDaQuedaDoBanco(() => operacoes.guardarRascunho(rascunho)),
    rascunhoPendente: (id, dono) =>
      protegerDaQuedaDoBanco(() => operacoes.rascunhoPendente(id, dono)),
    resolverRascunho: (resolucao) =>
      protegerDaQuedaDoBanco(() => operacoes.resolverRascunho(resolucao)),
  };
}

function conversasSemProtecao(db: Banco): Conversas {
  return {
    atual: async (dono) => {
      await db
        .insert(conversas)
        .values({ dono, ...colunasDoControle(novaConversa({ dono })) })
        .onConflictDoNothing();
      const [linha] = await db.select().from(conversas).where(eq(conversas.dono, dono));
      const { sessaoDesde } = exigir(linha);
      const mensagensNaSessao = await db.$count(
        mensagens,
        and(
          eq(mensagens.dono, dono),
          eq(mensagens.autor, "funcionario"),
          gt(mensagens.id, sessaoDesde),
        ),
      );
      return sucesso({ conversa: paraConversa(exigir(linha)), mensagensNaSessao });
    },
    transicionar: (transicao, agora) =>
      db.transaction(async (tx) => {
        const { antes, depois } = transicao;
        const atual = await travarConversa(tx, depois.dono);
        if (!mesmoControle(atual, antes)) return falha(CONTROLE_MUDOU);
        await tx
          .update(conversas)
          .set(colunasDoControle(depois))
          .where(eq(conversas.dono, depois.dono));
        await tx
          .insert(mensagens)
          .values(
            linhaDaMensagem(depois.dono, agora, { autor: "sistema", evento: eventoDa(transicao) }),
          );
        return sucesso(undefined);
      }),
    registrarMensagem: (dono, { texto, agora }) =>
      db.transaction(async (tx) => {
        await travarConversa(tx, dono);
        await tx
          .insert(mensagens)
          .values(linhaDaMensagem(dono, agora, { autor: "funcionario", texto }));
        return sucesso(undefined);
      }),
    registrarMensagemDoAnalista: (conversa, { texto, agora }) =>
      db.transaction(async (tx) => {
        const { dono, analista } = conversa;
        const atual = await travarConversa(tx, dono);
        if (!mesmoControle(atual, conversa)) return falha(CONTROLE_MUDOU);
        await tx
          .insert(mensagens)
          .values(linhaDaMensagem(dono, agora, { autor: "analista", analista, texto }));
        return sucesso(undefined);
      }),
    registrarTurno: (dono, { pergunta, resposta, agora }) =>
      db.transaction(async (tx) => {
        const { controle } = await travarConversa(tx, dono);
        await tx
          .insert(mensagens)
          .values(linhaDaMensagem(dono, agora, { autor: "funcionario", texto: pergunta }));
        if (controle !== "agent") return falha(CONTROLE_MUDOU);
        await tx
          .insert(mensagens)
          .values(linhaDaMensagem(dono, agora, { autor: "agent", ...resposta }));
        return sucesso(undefined);
      }),
    iniciarSessao: (dono, agora) =>
      db.transaction(async (tx) => {
        const { controle } = await travarConversa(tx, dono);
        if (controle !== "agent") return falha(CONTROLE_MUDOU);
        const [ultima] = await tx
          .select({ id: max(mensagens.id) })
          .from(mensagens)
          .where(eq(mensagens.dono, dono));
        await tx
          .update(conversas)
          .set({ sessaoDesde: ultima?.id ?? DESDE_O_COMECO })
          .where(eq(conversas.dono, dono));
        await tx
          .insert(mensagens)
          .values(
            linhaDaMensagem(dono, agora, { autor: "sistema", evento: { tipo: "sessao_iniciada" } }),
          );
        return sucesso(undefined);
      }),
    historico: async (dono, depois) => {
      const linhas = await db
        .select(getTableColumns(mensagens))
        .from(mensagens)
        .innerJoin(conversas, eq(conversas.dono, mensagens.dono))
        .where(
          and(
            eq(mensagens.dono, dono),
            gt(mensagens.id, depois),
            gt(mensagens.id, conversas.sessaoDesde),
          ),
        )
        .orderBy(asc(mensagens.id));
      return sucesso(linhas.map(paraMensagem));
    },
    guardarRascunho: async ({ id, dono, conteudo, criadoEm }) => {
      await db.insert(rascunhos).values({ id, dono, conteudo, status: "pendente", criadoEm });
      return sucesso(undefined);
    },
    rascunhoPendente: async (id, dono) => {
      const [linha] = await db
        .select()
        .from(rascunhos)
        .where(and(eq(rascunhos.id, id), eq(rascunhos.dono, dono)));
      if (linha === undefined) return falha({ motivo: "rascunho_nao_encontrado" });
      if (linha.status !== "pendente") {
        return falha({ motivo: "rascunho_ja_resolvido", status: linha.status });
      }
      return sucesso(paraRascunhoPendente(linha));
    },
    resolverRascunho: (resolucao) =>
      db.transaction(async (tx) => {
        const { id, dono, status } = resolucao.rascunho;
        await travarConversa(tx, dono);
        const alterados = await tx
          .update(rascunhos)
          .set({ status, resolvidoEm: resolvidoEm(resolucao) })
          .where(and(eq(rascunhos.id, id), eq(rascunhos.status, "pendente")))
          .returning({ id: rascunhos.id });
        if (alterados.length === 0) return falha(await jaResolvido(tx, id));
        await tx.insert(mensagens).values(
          linhaDaMensagem(dono, resolvidoEm(resolucao), {
            autor: "sistema",
            evento: eventoDaResolucao(resolucao),
          }),
        );
        return sucesso(undefined);
      }),
  };
}

async function travarConversa(tx: Banco, dono: UserId): Promise<Conversa<Controle>> {
  const [linha] = await tx.select().from(conversas).where(eq(conversas.dono, dono)).for("update");
  return paraConversa(exigir(linha));
}

function paraRascunhoPendente({
  id,
  dono,
  conteudo,
  criadoEm,
}: LinhaDoRascunho): Rascunho<"pendente"> {
  return Object.freeze({ id, dono, conteudo, status: "pendente", criadoEm });
}

async function jaResolvido(tx: Banco, id: RascunhoId) {
  const [atual] = await tx
    .select({ status: rascunhos.status })
    .from(rascunhos)
    .where(eq(rascunhos.id, id));
  const { status } = exigir(atual);
  if (status === "pendente") throw new Error("rascunho pendente que não pôde ser resolvido");
  return { motivo: "rascunho_ja_resolvido", status } as const;
}

function linhaDaMensagem(
  dono: UserId,
  enviadaEm: Date,
  conteudo: ConteudoDaMensagem,
): typeof mensagens.$inferInsert {
  return { dono, enviadaEm, ...conteudo };
}

function colunasDoControle(conversa: Conversa<Controle>): ColunasDoControle {
  const vazias = {
    motivoDaTransferencia: null,
    resumoDaTransferencia: null,
    transferenciaPedidaEm: null,
    analista: null,
    assumidaEm: null,
  };
  switch (conversa.controle) {
    case "agent":
      return { ...vazias, controle: "agent" };
    case "aguardando":
      return { ...vazias, controle: "aguardando", ...colunasDaTransferencia(conversa) };
    case "analista":
      return {
        ...vazias,
        controle: "analista",
        ...colunasDaTransferencia(conversa),
        analista: conversa.analista,
        assumidaEm: conversa.assumidaEm,
      };
  }
}

function colunasDaTransferencia({ transferencia }: Conversa<"aguardando" | "analista">) {
  return {
    motivoDaTransferencia: transferencia.motivo,
    resumoDaTransferencia: transferencia.resumo,
    transferenciaPedidaEm: transferencia.pedidaEm,
  };
}

function paraConversa(linha: LinhaDaConversa): Conversa<Controle> {
  const { dono } = linha;
  switch (linha.controle) {
    case "agent":
      return novaConversa({ dono });
    case "aguardando":
      return Object.freeze({ dono, controle: "aguardando", transferencia: transferenciaDa(linha) });
    case "analista":
      return Object.freeze({
        dono,
        controle: "analista",
        transferencia: transferenciaDa(linha),
        analista: exigir(linha.analista),
        assumidaEm: exigir(linha.assumidaEm),
      });
  }
}

function transferenciaDa(linha: LinhaDaConversa) {
  return {
    motivo: exigir(linha.motivoDaTransferencia),
    resumo: exigir(linha.resumoDaTransferencia),
    pedidaEm: exigir(linha.transferenciaPedidaEm),
  };
}

function exigir<T>(valor: T | null | undefined): T {
  if (valor === null || valor === undefined) {
    throw new Error("linha de conversa inconsistente com as restrições do banco");
  }
  return valor;
}

function paraMensagem(linha: LinhaDaMensagem): Mensagem {
  const { id, autor, enviadaEm } = linha;
  switch (autor) {
    case "funcionario":
      return { id, autor, texto: exigir(linha.texto), enviadaEm };
    case "agent":
      return { id, autor, texto: exigir(linha.texto), enviadaEm, registro: linha.registro };
    case "analista":
      return { id, autor, texto: exigir(linha.texto), enviadaEm, analista: exigir(linha.analista) };
    case "sistema":
      return { id, autor, evento: exigir(linha.evento), enviadaEm };
  }
}
