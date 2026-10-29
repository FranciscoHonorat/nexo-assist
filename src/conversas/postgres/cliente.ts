import { and, asc, eq } from "drizzle-orm";
import { novaConversa, type Conversa, type Controle } from "../../domain/conversa.js";
import type { Rascunho } from "../../domain/rascunho.js";
import { falha, sucesso } from "../../domain/resultado.js";
import { protegerDaQuedaDoBanco } from "../../infraestrutura/falhas-do-postgres.js";
import type { UserId } from "../../domain/user-id.js";
import type { Banco } from "../../infraestrutura/banco.js";
import type { Conversas, ErroDeControle, Mensagem, RascunhoResolvido } from "../conversas.js";
import { conversas, mensagens, rascunhos } from "./esquema.js";

type LinhaDaConversa = typeof conversas.$inferSelect;
type LinhaDaMensagem = typeof mensagens.$inferSelect;
type LinhaDoRascunho = typeof rascunhos.$inferSelect;
type ColunasDoControle = Omit<LinhaDaConversa, "dono">;

const CONTROLE_MUDOU: ErroDeControle = { motivo: "controle_mudou" };

export function conversasPostgres(db: Banco): Conversas {
  const operacoes = conversasSemProtecao(db);
  return {
    atual: (dono) => protegerDaQuedaDoBanco(() => operacoes.atual(dono)),
    transicionar: (depois, esperado) =>
      protegerDaQuedaDoBanco(() => operacoes.transicionar(depois, esperado)),
    registrarMensagem: (dono, mensagem) =>
      protegerDaQuedaDoBanco(() => operacoes.registrarMensagem(dono, mensagem)),
    registrarTurno: (dono, turno) =>
      protegerDaQuedaDoBanco(() => operacoes.registrarTurno(dono, turno)),
    historico: (dono) => protegerDaQuedaDoBanco(() => operacoes.historico(dono)),
    guardarRascunho: (rascunho) =>
      protegerDaQuedaDoBanco(() => operacoes.guardarRascunho(rascunho)),
    rascunhoPendente: (id, dono) =>
      protegerDaQuedaDoBanco(() => operacoes.rascunhoPendente(id, dono)),
    resolverRascunho: (resolvido) =>
      protegerDaQuedaDoBanco(() => operacoes.resolverRascunho(resolvido)),
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
      const mensagensNaSessao = await db.$count(
        mensagens,
        and(eq(mensagens.dono, dono), eq(mensagens.autor, "funcionario")),
      );
      return sucesso({ conversa: paraConversa(exigir(linha)), mensagensNaSessao });
    },
    transicionar: async (depois, esperado) => {
      const alteradas = await db
        .update(conversas)
        .set(colunasDoControle(depois))
        .where(and(eq(conversas.dono, depois.dono), eq(conversas.controle, esperado)))
        .returning({ dono: conversas.dono });
      return alteradas.length === 0 ? falha(CONTROLE_MUDOU) : sucesso(undefined);
    },
    registrarMensagem: async (dono, { texto, agora }) => {
      await db.insert(mensagens).values(linhaDaPergunta(dono, texto, agora));
      return sucesso(undefined);
    },
    registrarTurno: (dono, { pergunta, resposta, agora }) =>
      db.transaction(async (tx) => {
        const [linha] = await tx
          .select({ controle: conversas.controle })
          .from(conversas)
          .where(eq(conversas.dono, dono))
          .for("update");
        await tx.insert(mensagens).values(linhaDaPergunta(dono, pergunta, agora));
        if (linha?.controle !== "agent") return falha(CONTROLE_MUDOU);
        await tx.insert(mensagens).values({
          dono,
          autor: "agent",
          texto: resposta.texto,
          enviadaEm: agora,
          registro: resposta.registro,
        });
        return sucesso(undefined);
      }),
    historico: async (dono) => {
      const linhas = await db
        .select()
        .from(mensagens)
        .where(eq(mensagens.dono, dono))
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
    resolverRascunho: async (resolvido) => {
      const alterados = await db
        .update(rascunhos)
        .set({ status: resolvido.status, resolvidoEm: resolvidoEm(resolvido) })
        .where(and(eq(rascunhos.id, resolvido.id), eq(rascunhos.status, "pendente")))
        .returning({ id: rascunhos.id });
      if (alterados.length > 0) return sucesso(undefined);
      const [atual] = await db
        .select({ status: rascunhos.status })
        .from(rascunhos)
        .where(eq(rascunhos.id, resolvido.id));
      const { status } = exigir(atual);
      if (status === "pendente") throw new Error("rascunho pendente que não pôde ser resolvido");
      return falha({ motivo: "rascunho_ja_resolvido", status });
    },
  };
}

function paraRascunhoPendente({
  id,
  dono,
  conteudo,
  criadoEm,
}: LinhaDoRascunho): Rascunho<"pendente"> {
  return Object.freeze({ id, dono, conteudo, status: "pendente", criadoEm });
}

function resolvidoEm(resolvido: RascunhoResolvido): Date {
  return resolvido.status === "confirmado" ? resolvido.confirmadoEm : resolvido.descartadoEm;
}

function linhaDaPergunta(dono: UserId, texto: string, enviadaEm: Date) {
  return { dono, autor: "funcionario", texto, enviadaEm } as const;
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

function paraMensagem({ autor, texto, enviadaEm, registro }: LinhaDaMensagem): Mensagem {
  switch (autor) {
    case "funcionario":
      return { autor, texto, enviadaEm };
    case "agent":
      return { autor, texto, enviadaEm, registro };
  }
}
