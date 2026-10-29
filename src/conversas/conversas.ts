import type { Conversa, Controle, MotivoDeTransferencia } from "../domain/conversa.js";
import type { RascunhoId } from "../domain/rascunho-id.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { Rascunho, StatusRascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { Json } from "../infraestrutura/json.js";

export type ConversaAtual = {
  readonly conversa: Conversa<Controle>;
  readonly mensagensNaSessao: number;
};

type Entre<A extends Controle, D extends Controle> = {
  readonly antes: Conversa<A>;
  readonly depois: Conversa<D>;
};

export type Transicao =
  | ({ readonly evento: "transferida" } & Entre<"agent", "aguardando">)
  | ({ readonly evento: "assumida" } & Entre<"aguardando", "analista">)
  | ({ readonly evento: "devolvida" } & Entre<"aguardando" | "analista", "agent">)
  | ({ readonly evento: "encerrada" } & Entre<"analista", "agent">);

export type EventoDaConversa =
  | { readonly tipo: "transferida"; readonly motivo: MotivoDeTransferencia }
  | { readonly tipo: "assumida"; readonly analista: UserId }
  | { readonly tipo: "devolvida" }
  | { readonly tipo: "encerrada" }
  | { readonly tipo: "chamado_criado" | "chamado_complementado"; readonly chamado: TicketId }
  | { readonly tipo: "rascunho_descartado" }
  | { readonly tipo: "sessao_iniciada" };

export type ConteudoDaMensagem =
  | { readonly autor: "funcionario"; readonly texto: string }
  | { readonly autor: "agent"; readonly texto: string; readonly registro: Json }
  | { readonly autor: "analista"; readonly texto: string; readonly analista: UserId }
  | { readonly autor: "sistema"; readonly evento: EventoDaConversa };

export type Mensagem = ConteudoDaMensagem & { readonly id: number; readonly enviadaEm: Date };

export const DESDE_O_COMECO = 0;

export type Turno = {
  readonly pergunta: string;
  readonly resposta: { readonly texto: string; readonly registro: Json };
  readonly agora: Date;
};

export type ErroDeControle = { readonly motivo: "controle_mudou" };

export type ErroDeRascunho =
  | { readonly motivo: "rascunho_nao_encontrado" }
  | {
      readonly motivo: "rascunho_ja_resolvido";
      readonly status: Exclude<StatusRascunho, "pendente">;
    };

export type Resolucao =
  | { readonly rascunho: Rascunho<"confirmado">; readonly chamado: TicketId }
  | { readonly rascunho: Rascunho<"descartado"> };

type Resposta<T, E = never> = Promise<Resultado<T, E | ErroDeInfraestrutura>>;

export type Conversas = {
  readonly atual: (dono: UserId) => Resposta<ConversaAtual>;
  readonly transicionar: (transicao: Transicao, agora: Date) => Resposta<undefined, ErroDeControle>;
  readonly registrarMensagem: (
    dono: UserId,
    mensagem: { readonly texto: string; readonly agora: Date },
  ) => Resposta<undefined>;
  readonly registrarMensagemDoAnalista: (
    conversa: Conversa<"analista">,
    mensagem: { readonly texto: string; readonly agora: Date },
  ) => Resposta<undefined, ErroDeControle>;
  readonly registrarTurno: (dono: UserId, turno: Turno) => Resposta<undefined, ErroDeControle>;
  readonly iniciarSessao: (dono: UserId, agora: Date) => Resposta<undefined, ErroDeControle>;
  readonly historico: (dono: UserId, depois: number) => Resposta<readonly Mensagem[]>;
  readonly guardarRascunho: (rascunho: Rascunho<"pendente">) => Resposta<undefined>;
  readonly rascunhoPendente: (
    id: RascunhoId,
    dono: UserId,
  ) => Resposta<Rascunho<"pendente">, ErroDeRascunho>;
  readonly resolverRascunho: (
    resolucao: Resolucao,
  ) => Resposta<undefined, Extract<ErroDeRascunho, { motivo: "rascunho_ja_resolvido" }>>;
};

export function eventoDa(transicao: Transicao): EventoDaConversa {
  switch (transicao.evento) {
    case "transferida":
      return { tipo: "transferida", motivo: transicao.depois.transferencia.motivo };
    case "assumida":
      return { tipo: "assumida", analista: transicao.depois.analista };
    case "devolvida":
    case "encerrada":
      return { tipo: transicao.evento };
  }
}

export function eventoDaResolucao(resolucao: Resolucao): EventoDaConversa {
  if (!("chamado" in resolucao)) return { tipo: "rascunho_descartado" };
  const tipo =
    resolucao.rascunho.conteudo.tipo === "novo_chamado"
      ? "chamado_criado"
      : "chamado_complementado";
  return { tipo, chamado: resolucao.chamado };
}

export function resolvidoEm({ rascunho }: Resolucao): Date {
  return rascunho.status === "confirmado" ? rascunho.confirmadoEm : rascunho.descartadoEm;
}

export function mesmoControle(atual: Conversa<Controle>, esperado: Conversa<Controle>): boolean {
  return atual.controle === esperado.controle && analistaDa(atual) === analistaDa(esperado);
}

function analistaDa(conversa: Conversa<Controle>): UserId | null {
  return conversa.controle === "analista" ? conversa.analista : null;
}
