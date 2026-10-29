import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Controle } from "../../domain/conversa.js";
import type { UserId } from "../../domain/user-id.js";
import type { Json } from "../../infraestrutura/json.js";
import type { Mensagem } from "../conversas.js";

export const controleDaConversa = pgEnum("controle_da_conversa", [
  "agent",
  "aguardando",
  "analista",
] as const satisfies readonly Controle[]);

export const conversas = pgTable(
  "conversas",
  {
    dono: text("dono").$type<UserId>().primaryKey(),
    controle: controleDaConversa("controle").notNull(),
  },
  (tabela) => [
    check("dono_da_conversa_corporativo", sql`${tabela.dono} ~ '^[a-z0-9._%+-]+@nexo\\.com$'`),
  ],
);

export const autorDaMensagem = pgEnum("autor_da_mensagem", [
  "funcionario",
  "agent",
] as const satisfies readonly Mensagem["autor"][]);

export const mensagens = pgTable(
  "mensagens",
  {
    id: serial("id").primaryKey(),
    dono: text("dono")
      .$type<UserId>()
      .notNull()
      .references(() => conversas.dono),
    autor: autorDaMensagem("autor").notNull(),
    texto: text("texto").notNull(),
    enviadaEm: timestamp("enviada_em", { withTimezone: true, mode: "date" }).notNull(),
    registro: jsonb("registro").$type<Json>(),
  },
  (tabela) => [
    index("mensagens_por_dono").on(tabela.dono, tabela.id),
    check(
      "so_o_agent_tem_registro",
      sql`(${tabela.autor} = 'agent') = (${tabela.registro} IS NOT NULL)`,
    ),
  ],
);
