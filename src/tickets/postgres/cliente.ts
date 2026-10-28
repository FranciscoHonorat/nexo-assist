import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { alterarStatusDoChamado, complementarChamado, type Chamado } from "../../domain/chamado.js";
import { falha, sucesso, type Resultado } from "../../domain/resultado.js";
import type { TicketId, TipoChamado } from "../../domain/ticket-id.js";
import type { UserId } from "../../domain/user-id.js";
import {
  INDISPONIVEL,
  type ErroDeConsulta,
  type ErroDeInfraestrutura,
  type TicketClient,
} from "../ticket-client.js";
import { chamados, complementos, SEQUENCIA_POR_TIPO } from "./esquema.js";
import { ehFalhaDeInfraestrutura } from "./falhas.js";

export type Banco = PgDatabase<PgQueryResultHKT>;

type LinhaDoChamado = typeof chamados.$inferSelect;
type LinhaDoComplemento = typeof complementos.$inferSelect;

const PREFIXO_POR_TIPO = {
  incidente: "INC",
  requisicao: "REQ",
} as const satisfies Record<TipoChamado, string>;

export function ticketClientPostgres(db: Banco): TicketClient {
  const comComplementos = async (linhas: readonly LinhaDoChamado[]): Promise<Chamado[]> => {
    if (linhas.length === 0) return [];
    const extras = await db
      .select()
      .from(complementos)
      .where(
        inArray(
          complementos.chamadoId,
          linhas.map((linha) => linha.id),
        ),
      )
      .orderBy(asc(complementos.id));
    return linhas.map((linha) =>
      paraChamado(
        linha,
        extras.filter((extra) => extra.chamadoId === linha.id),
      ),
    );
  };

  const doDono = async (id: TicketId, por: UserId): Promise<Resultado<Chamado, ErroDeConsulta>> => {
    const linhas = await db
      .select()
      .from(chamados)
      .where(and(eq(chamados.id, id), eq(chamados.dono, por)));
    const [chamado] = await comComplementos(linhas);
    return chamado ? sucesso(chamado) : falha({ motivo: "nao_encontrado", id });
  };

  const tentarAlterarStatus: TicketClient["alterarStatus"] = async (id, alteracao, agora) => {
    const atual = await doDono(id, alteracao.por);
    if (!atual.ok) return atual;
    const decisao = alterarStatusDoChamado(atual.valor, alteracao, agora);
    if (!decisao.ok || decisao.valor === atual.valor) return decisao;
    const alteradas = await db
      .update(chamados)
      .set({ status: decisao.valor.status, atualizadoEm: agora })
      .where(and(eq(chamados.id, id), eq(chamados.status, alteracao.de)))
      .returning({ id: chamados.id });
    if (alteradas.length === 0) return tentarAlterarStatus(id, alteracao, agora);
    return decisao;
  };

  const operacoes: TicketClient = {
    listar: async (dono) =>
      sucesso(
        await comComplementos(await db.select().from(chamados).where(eq(chamados.dono, dono))),
      ),

    obter: (id, por) => doDono(id, por),

    criar: async (rascunho, agora) => {
      const { dados } = rascunho.conteudo;

      await db
        .insert(chamados)
        .values({
          id: sql<TicketId>`${PREFIXO_POR_TIPO[dados.tipo]} || '-' || nextval(${SEQUENCIA_POR_TIPO[dados.tipo]})`,
          dono: rascunho.dono,
          ...dados,
          status: "aberto",
          criadoEm: agora,
          atualizadoEm: agora,
          rascunhoId: rascunho.id,
        })
        .onConflictDoNothing({ target: chamados.rascunhoId });
      const linhas = await db.select().from(chamados).where(eq(chamados.rascunhoId, rascunho.id));
      const [chamado] = await comComplementos(linhas);
      if (!chamado) throw new Error(`chamado do rascunho ${rascunho.id} não foi gravado`);
      return sucesso(chamado);
    },

    complementar: async (rascunho, agora) => {
      const { chamado: id, texto } = rascunho.conteudo;
      const atual = await doDono(id, rascunho.dono);
      if (!atual.ok) return atual;
      const jaAplicado = await db
        .select({ id: complementos.id })
        .from(complementos)
        .where(eq(complementos.rascunhoId, rascunho.id));
      if (jaAplicado.length > 0) return atual;
      const decisao = complementarChamado(atual.valor, { texto, agora });
      if (!decisao.ok) return decisao;
      const aplicadoAgora = await db.transaction(async (tx) => {
        const inseridos = await tx
          .insert(complementos)
          .values({ chamadoId: id, texto, em: agora, rascunhoId: rascunho.id })
          .onConflictDoNothing({ target: complementos.rascunhoId })
          .returning({ id: complementos.id });
        if (inseridos.length === 0) return false;
        await tx
          .update(chamados)
          .set({ status: decisao.valor.status, atualizadoEm: agora })
          .where(eq(chamados.id, id));
        return true;
      });
      return aplicadoAgora ? decisao : doDono(id, rascunho.dono);
    },

    alterarStatus: tentarAlterarStatus,
  };

  return protegerContraQuedas(operacoes);
}

function paraChamado(linha: LinhaDoChamado, extras: readonly LinhaDoComplemento[]): Chamado {
  const { id, dono, status, criadoEm, atualizadoEm } = linha;
  const { titulo, descricao, tipo, categoria, prioridade, afetados } = linha;
  return Object.freeze({
    id,
    dono,
    dados: Object.freeze({ titulo, descricao, tipo, categoria, prioridade, afetados }),
    status,
    criadoEm,
    atualizadoEm,
    complementos: Object.freeze(extras.map(({ texto, em }) => Object.freeze({ texto, em }))),
  });
}

function protegerContraQuedas(cliente: TicketClient): TicketClient {
  return {
    listar: (dono) => protegido(() => cliente.listar(dono)),
    obter: (id, por) => protegido(() => cliente.obter(id, por)),
    criar: (rascunho, agora) => protegido(() => cliente.criar(rascunho, agora)),
    complementar: (rascunho, agora) => protegido(() => cliente.complementar(rascunho, agora)),
    alterarStatus: (id, alteracao, agora) =>
      protegido(() => cliente.alterarStatus(id, alteracao, agora)),
  };
}

async function protegido<T, E>(
  executar: () => Promise<Resultado<T, E>>,
): Promise<Resultado<T, E | ErroDeInfraestrutura>> {
  try {
    return await executar();
  } catch (erro) {
    if (ehFalhaDeInfraestrutura(erro)) return falha(INDISPONIVEL);
    throw erro;
  }
}
