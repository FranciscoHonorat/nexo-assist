import type { Conversas, ErroDeRascunho } from "../conversas/conversas.js";
import type { Chamado } from "../domain/chamado.js";
import { lerRascunhoId, type ErroRascunhoId } from "../domain/rascunho-id.js";
import {
  conformeOConteudo,
  confirmar,
  descartar,
  type ErroDeTransicao,
  type Rascunho,
} from "../domain/rascunho.js";
import { sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { ErroDeComplementacao, TicketClient } from "../tickets/ticket-client.js";

export type CliqueNoRascunho = {
  readonly id: string;
  readonly por: UserId;
  readonly agora: Date;
};

export type ServicosDosRascunhos = {
  readonly conversas: Pick<Conversas, "rascunhoPendente" | "resolverRascunho">;
  readonly chamados: TicketClient;
};

type ErroDoClique = ErroRascunhoId | ErroDeRascunho | ErroDeTransicao | ErroDeInfraestrutura;

export type ErroDeConfirmacao = ErroDoClique | ErroDeComplementacao;

export async function confirmarRascunho(
  clique: CliqueNoRascunho,
  { conversas, chamados }: ServicosDosRascunhos,
): Promise<Resultado<Chamado, ErroDeConfirmacao>> {
  const pendente = await rascunhoDoClique(clique, conversas);
  if (!pendente.ok) return pendente;
  const confirmado = confirmar(pendente.valor, clique);
  if (!confirmado.ok) return confirmado;

  const aplicado = await aplicar(confirmado.valor, chamados, clique.agora);
  if (!aplicado.ok) return aplicado;
  await conversas.resolverRascunho({ rascunho: confirmado.valor, chamado: aplicado.valor.id });
  return aplicado;
}

export async function descartarRascunho(
  clique: CliqueNoRascunho,
  { conversas }: Pick<ServicosDosRascunhos, "conversas">,
): Promise<Resultado<undefined, ErroDoClique>> {
  const pendente = await rascunhoDoClique(clique, conversas);
  if (!pendente.ok) return pendente;
  const descartado = descartar(pendente.valor, clique);
  if (!descartado.ok) return descartado;
  const resolvido = await conversas.resolverRascunho({ rascunho: descartado.valor });
  return resolvido.ok ? sucesso(undefined) : resolvido;
}

async function rascunhoDoClique(
  { id, por }: CliqueNoRascunho,
  conversas: ServicosDosRascunhos["conversas"],
): Promise<
  Resultado<Rascunho<"pendente">, ErroRascunhoId | ErroDeRascunho | ErroDeInfraestrutura>
> {
  const lido = lerRascunhoId(id);
  if (!lido.ok) return lido;
  return conversas.rascunhoPendente(lido.valor, por);
}

function aplicar(
  confirmado: Rascunho<"confirmado">,
  chamados: TicketClient,
  agora: Date,
): Promise<Resultado<Chamado, ErroDeComplementacao | ErroDeInfraestrutura>> {
  return conformeOConteudo(confirmado, {
    novo_chamado: (novo) => chamados.criar(novo, agora),
    complemento: (complemento) => chamados.complementar(complemento, agora),
  });
}
