import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { MOTIVOS_DE_TRANSFERENCIA, type Controle } from "../../domain/conversa.js";
import type { RascunhoId } from "../../domain/rascunho-id.js";
import type { ConteudoDoRascunho, StatusRascunho } from "../../domain/rascunho.js";
import type { UserId } from "../../domain/user-id.js";
import type { Json } from "../../infraestrutura/json.js";
import type { Mensagem } from "../conversas.js";

export const controleDaConversa = pgEnum("controle_da_conversa", [
  "agent",
  "aguardando",
  "analista",
] as const satisfies readonly Controle[]);

export const motivoDeTransferencia = pgEnum("motivo_de_transferencia", MOTIVOS_DE_TRANSFERENCIA);

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });

export const conversas = pgTable(
  "conversas",
  {
    dono: text("dono").$type<UserId>().primaryKey(),
    controle: controleDaConversa("controle").notNull(),
    motivoDaTransferencia: motivoDeTransferencia("motivo_da_transferencia"),
    resumoDaTransferencia: text("resumo_da_transferencia"),
    transferenciaPedidaEm: instante("transferencia_pedida_em"),
    analista: text("analista").$type<UserId>(),
    assumidaEm: instante("assumida_em"),
  },
  (tabela) => [
    check("dono_da_conversa_corporativo", sql`${tabela.dono} ~ '^[a-z0-9._%+-]+@nexo\\.com$'`),
    check(
      "transferencia_completa_fora_do_agent",
      sql`num_nonnulls(${tabela.motivoDaTransferencia}, ${tabela.resumoDaTransferencia}, ${tabela.transferenciaPedidaEm})
        = CASE WHEN ${tabela.controle} = 'agent' THEN 0 ELSE 3 END`,
    ),
    check(
      "analista_so_quando_assumida",
      sql`num_nonnulls(${tabela.analista}, ${tabela.assumidaEm})
        = CASE WHEN ${tabela.controle} = 'analista' THEN 2 ELSE 0 END`,
    ),
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
    enviadaEm: instante("enviada_em").notNull(),
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

export const statusDoRascunho = pgEnum("status_do_rascunho", [
  "pendente",
  "confirmado",
  "descartado",
] as const satisfies readonly StatusRascunho[]);

export const rascunhos = pgTable(
  "rascunhos",
  {
    id: text("id").$type<RascunhoId>().primaryKey(),
    dono: text("dono")
      .$type<UserId>()
      .notNull()
      .references(() => conversas.dono),
    conteudo: jsonb("conteudo").$type<ConteudoDoRascunho>().notNull(),
    status: statusDoRascunho("status").notNull(),
    criadoEm: instante("criado_em").notNull(),
    resolvidoEm: instante("resolvido_em"),
  },
  (tabela) => [
    check(
      "resolvido_so_fora_do_pendente",
      sql`(${tabela.status} = 'pendente') = (${tabela.resolvidoEm} IS NULL)`,
    ),
  ],
);
