import { sql } from "drizzle-orm";
import { check, pgEnum, pgSequence, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { AFETADOS, CATEGORIAS, type StatusDoChamado } from "../../domain/chamado.js";
import { PRIORIDADES } from "../../domain/prazo.js";
import type { RascunhoId } from "../../domain/rascunho-id.js";
import { TIPOS_DE_CHAMADO, type TicketId, type TipoChamado } from "../../domain/ticket-id.js";
import type { UserId } from "../../domain/user-id.js";

export const statusDoChamado = pgEnum("status_do_chamado", [
  "aberto",
  "aguardando_analista",
  "aprovado",
  "resolvido",
] as const satisfies readonly StatusDoChamado[]);

export const tipoDoChamado = pgEnum("tipo_do_chamado", TIPOS_DE_CHAMADO);

export const categoria = pgEnum("categoria", CATEGORIAS);

export const prioridade = pgEnum("prioridade", PRIORIDADES);

export const afetados = pgEnum("afetados", AFETADOS);

const NUMERACAO = { startWith: 30000, maxValue: 999_999_999 };

export const SEQUENCIA_POR_TIPO = {
  incidente: "numero_de_incidente",
  requisicao: "numero_de_requisicao",
} as const satisfies Record<TipoChamado, string>;

export const numeroDeIncidente = pgSequence(SEQUENCIA_POR_TIPO.incidente, NUMERACAO);
export const numeroDeRequisicao = pgSequence(SEQUENCIA_POR_TIPO.requisicao, NUMERACAO);

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" }).notNull();

export const chamados = pgTable(
  "chamados",
  {
    id: text("id").$type<TicketId>().primaryKey(),
    dono: text("dono").$type<UserId>().notNull(),
    titulo: text("titulo").notNull(),
    descricao: text("descricao").notNull(),
    tipo: tipoDoChamado("tipo").notNull(),
    categoria: categoria("categoria").notNull(),
    prioridade: prioridade("prioridade").notNull(),
    afetados: afetados("afetados").notNull(),
    status: statusDoChamado("status").notNull(),
    criadoEm: instante("criado_em"),
    atualizadoEm: instante("atualizado_em"),
    rascunhoId: text("rascunho_id").$type<RascunhoId>().unique(),
  },
  (tabela) => [
    check("id_no_formato", sql`${tabela.id} ~ '^(INC|REQ)-[0-9]{1,9}$'`),
    check("dono_corporativo", sql`${tabela.dono} ~ '^[a-z0-9._%+-]+@nexo\\.com$'`),
  ],
);

export const complementos = pgTable("complementos", {
  id: serial("id").primaryKey(),
  chamadoId: text("chamado_id")
    .$type<TicketId>()
    .notNull()
    .references(() => chamados.id),
  texto: text("texto").notNull(),
  em: instante("em"),
  rascunhoId: text("rascunho_id").$type<RascunhoId>().unique(),
});
