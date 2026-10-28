import type { Chamado } from "../domain/chamado.js";
import type { NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";

export type ErroDeConsulta = {
  readonly motivo: "nao_encontrado";
  readonly id: TicketId;
};

export type EstadoInicial = {
  readonly chamados: readonly Chamado[];
};

export type TicketClient = {
  readonly listar: (dono: UserId) => Promise<readonly Chamado[]>;
  readonly obter: (id: TicketId, por: UserId) => Promise<Resultado<Chamado, ErroDeConsulta>>;
  readonly criar: (rascunho: Rascunho<"confirmado", NovoChamado>, agora: Date) => Promise<Chamado>;
};
