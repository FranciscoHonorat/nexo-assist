import { and, asc, eq } from "drizzle-orm";
import { novaConversa, type Conversa, type Controle } from "../../domain/conversa.js";
import { falha, sucesso } from "../../domain/resultado.js";
import { protegerDaQuedaDoBanco } from "../../infraestrutura/falhas-do-postgres.js";
import type { UserId } from "../../domain/user-id.js";
import type { Banco } from "../../infraestrutura/banco.js";
import type { Conversas, ErroDeControle, Mensagem } from "../conversas.js";
import { conversas, mensagens } from "./esquema.js";

type LinhaDaConversa = typeof conversas.$inferSelect;
type LinhaDaMensagem = typeof mensagens.$inferSelect;
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
  };
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
