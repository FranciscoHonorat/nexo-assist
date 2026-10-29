import type { Conversas, Mensagem } from "../conversas/conversas.js";
import { assumir, transferir, type Conversa } from "../domain/conversa.js";
import type { UserId } from "../domain/user-id.js";
import { valorDe } from "./valor-de.js";

export async function colocarNaFila(
  conversas: Conversas,
  dono: UserId,
  agora: Date,
): Promise<Conversa<"aguardando">> {
  const { conversa } = valorDe(await conversas.atual(dono));
  if (conversa.controle !== "agent") throw new Error("fixture inválida: a conversa não é do agent");
  const fila = valorDe(
    transferir(conversa, { motivo: "pedido_do_funcionario", resumo: "quer um humano", agora }),
  );
  valorDe(
    await conversas.transicionar({ evento: "transferida", antes: conversa, depois: fila }, agora),
  );
  return fila;
}

export async function assumidaPor(
  conversas: Conversas,
  dono: UserId,
  analista: UserId,
  agora: Date,
): Promise<Conversa<"analista">> {
  const fila = await colocarNaFila(conversas, dono, agora);
  const assumida = assumir(fila, { analista, agora });
  valorDe(
    await conversas.transicionar({ evento: "assumida", antes: fila, depois: assumida }, agora),
  );
  return assumida;
}

export function semIds(mensagens: readonly Mensagem[]) {
  return mensagens.map(({ id, ...conteudo }) => conteudo);
}
