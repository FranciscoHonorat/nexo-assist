import type { Diretorio } from "../acesso/diretorio.js";
import type { Mensagem } from "../conversas/conversas.js";
import type { UserId } from "../domain/user-id.js";
import type { NomesDosAnalistas } from "./contrato.js";

export function nomesDosAnalistas(
  mensagens: readonly Mensagem[],
  diretorio: Diretorio,
): NomesDosAnalistas {
  const analistas = mensagens.flatMap((mensagem): UserId[] => {
    if (mensagem.autor === "analista") return [mensagem.analista];
    if (mensagem.autor === "sistema" && mensagem.evento.tipo === "assumida") {
      return [mensagem.evento.analista];
    }
    return [];
  });
  return Object.fromEntries(analistas.map((id) => [id, diretorio.pessoa(id)?.nome ?? id] as const));
}
