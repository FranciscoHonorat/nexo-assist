import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import type { Controle } from "../../domain/conversa.js";
import type { UserId } from "../../domain/user-id.js";

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
