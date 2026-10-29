import { and, asc, eq } from "drizzle-orm";
import { novaConversa } from "../../domain/conversa.js";
import { sucesso } from "../../domain/resultado.js";
import type { Banco } from "../../infraestrutura/banco.js";
import type { Conversas, Mensagem } from "../conversas.js";
import { conversas, mensagens } from "./esquema.js";

type LinhaDaMensagem = typeof mensagens.$inferSelect;

export function conversasPostgres(db: Banco): Conversas {
  return {
    atual: async (dono) => {
      await db.insert(conversas).values({ dono, controle: "agent" }).onConflictDoNothing();
      const mensagensNaSessao = await db.$count(
        mensagens,
        and(eq(mensagens.dono, dono), eq(mensagens.autor, "funcionario")),
      );
      return sucesso({ conversa: novaConversa({ dono }), mensagensNaSessao });
    },
    registrarTurno: async (dono, { pergunta, resposta, agora }) => {
      await db.insert(mensagens).values([
        { dono, autor: "funcionario", texto: pergunta, enviadaEm: agora },
        {
          dono,
          autor: "agent",
          texto: resposta.texto,
          enviadaEm: agora,
          registro: resposta.registro,
        },
      ]);
      return sucesso(undefined);
    },
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

function paraMensagem({ autor, texto, enviadaEm, registro }: LinhaDaMensagem): Mensagem {
  switch (autor) {
    case "funcionario":
      return { autor, texto, enviadaEm };
    case "agent":
      return { autor, texto, enviadaEm, registro };
  }
}
