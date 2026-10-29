import { novoRascunhoId } from "../domain/rascunho-id.js";
import { criarRascunho, type ConteudoDoRascunho } from "../domain/rascunho.js";
import { lerTicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import { notebookLento } from "../tickets/contrato/fixtures.js";
import { ana } from "./usuarios.js";
import { valorDe } from "./valor-de.js";

export const NOVO_NOTEBOOK_LENTO = {
  tipo: "novo_chamado",
  dados: notebookLento,
} as const satisfies ConteudoDoRascunho;

export const COMPLEMENTO_DO_NOTEBOOK = {
  tipo: "complemento",
  chamado: valorDe(lerTicketId("INC-20311")),
  texto: "agora não liga mais",
} as const satisfies ConteudoDoRascunho;

export function rascunhoPendente<C extends ConteudoDoRascunho>(
  conteudo: C,
  agora: Date,
  dono: UserId = ana,
) {
  return valorDe(criarRascunho({ id: novoRascunhoId(), dono, conteudo, agora }));
}
