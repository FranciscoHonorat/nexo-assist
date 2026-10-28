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

export type ErroDeInfraestrutura = {
  readonly motivo: "indisponivel";
};

export const INDISPONIVEL: ErroDeInfraestrutura = Object.freeze({ motivo: "indisponivel" });

export function ehIndisponivel(erro: { readonly motivo: string }): erro is ErroDeInfraestrutura {
  return erro.motivo === INDISPONIVEL.motivo;
}

type Resposta<T, E = never> = Promise<Resultado<T, E | ErroDeInfraestrutura>>;

export type TicketClient = {
  readonly listar: (dono: UserId) => Resposta<readonly Chamado[]>;
  readonly obter: (id: TicketId, por: UserId) => Resposta<Chamado, ErroDeConsulta>;
  readonly criar: (rascunho: Rascunho<"confirmado", NovoChamado>, agora: Date) => Resposta<Chamado>;
  readonly complementar: (
    rascunho: Rascunho<"confirmado", Complemento>,
    agora: Date,
  ) => Resposta<Chamado, ErroDeComplementacao>;
  readonly alterarStatus: (
    id: TicketId,
    alteracao: TransicaoDeStatus & { readonly por: UserId },
    agora: Date,
  ) => Resposta<Chamado, ErroDeAlteracaoDeStatus>;
};

export type Envoltorio = <T, E extends { readonly motivo: string }>(
  executar: () => Promise<Resultado<T, E>>,
) => Promise<Resultado<T, E | ErroDeInfraestrutura>>;

export function envolverOperacoes(cliente: TicketClient, envolver: Envoltorio): TicketClient {
  return {
    listar: (dono) => envolver(() => cliente.listar(dono)),
    obter: (id, por) => envolver(() => cliente.obter(id, por)),
    criar: (rascunho, agora) => envolver(() => cliente.criar(rascunho, agora)),
    complementar: (rascunho, agora) => envolver(() => cliente.complementar(rascunho, agora)),
    alterarStatus: (id, alteracao, agora) =>
      envolver(() => cliente.alterarStatus(id, alteracao, agora)),
  };
}
