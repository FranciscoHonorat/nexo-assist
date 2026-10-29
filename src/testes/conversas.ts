import type { Conversas } from "../conversas/conversas.js";
import { transferir, type Conversa } from "../domain/conversa.js";
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
  valorDe(await conversas.transicionar(fila, "agent"));
  return fila;
}
