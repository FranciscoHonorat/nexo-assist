import type {
  Chamado,
  ErroDeConflitoDeStatus,
  ErroDeReabertura,
  TransicaoDeStatus,
} from "../domain/chamado.js";
import type { Complemento, NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";

export type ErroDeConsulta = {
  readonly motivo: "nao_encontrado";
  readonly id: TicketId;
};

export type ErroDeComplementacao = ErroDeConsulta | ErroDeReabertura;

export type ErroDeAlteracaoDeStatus = ErroDeConsulta | ErroDeConflitoDeStatus;

export type EstadoInicial = {
  readonly chamados: readonly Chamado[];
};

export type TicketClient = {
  readonly listar: (dono: UserId) => Promise<readonly Chamado[]>;
  readonly obter: (id: TicketId, por: UserId) => Promise<Resultado<Chamado, ErroDeConsulta>>;
  readonly criar: (rascunho: Rascunho<"confirmado", NovoChamado>, agora: Date) => Promise<Chamado>;
  readonly complementar: (
    rascunho: Rascunho<"confirmado", Complemento>,
    agora: Date,
  ) => Promise<Resultado<Chamado, ErroDeComplementacao>>;
  readonly alterarStatus: (
    id: TicketId,
    alteracao: TransicaoDeStatus & { readonly por: UserId },
    agora: Date,
  ) => Promise<Resultado<Chamado, ErroDeAlteracaoDeStatus>>;
};
