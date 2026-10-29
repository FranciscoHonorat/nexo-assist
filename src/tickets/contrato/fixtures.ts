import type { Chamado, DadosDoChamado } from "../../domain/chamado.js";
import { lerRascunhoId } from "../../domain/rascunho-id.js";
import { confirmar, criarRascunho } from "../../domain/rascunho.js";
import { valorDe } from "../../testes/valor-de.js";
import { lerTicketId, type TicketId } from "../../domain/ticket-id.js";
import type { UserId } from "../../domain/user-id.js";
import type { EstadoInicial, TicketClient } from "../ticket-client.js";
import { ana, joao } from "../../testes/usuarios.js";

export const t0 = new Date("2026-10-22T10:00:00Z");
export const t1 = new Date("2026-10-28T10:00:00Z");
export const antesDeT1 = (milissegundos: number) => new Date(t1.getTime() - milissegundos);

export const notebookLento = {
  titulo: "Notebook lento após atualização do Windows",
  descricao: "Demora 10 minutos para ligar desde a última atualização.",
  tipo: "incidente",
  categoria: "hardware",
  prioridade: "media",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

export const segundoMonitor = {
  titulo: "Segundo monitor para home office",
  descricao: "Preciso de um segundo monitor para trabalhar de casa.",
  tipo: "requisicao",
  categoria: "hardware",
  prioridade: "baixa",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

export const senhaDoSap = {
  titulo: "Senha do SAP bloqueada",
  descricao: "A senha do SAP bloqueou depois de três tentativas.",
  tipo: "incidente",
  categoria: "acesso",
  prioridade: "media",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

export function existente(
  id: string,
  dono: UserId,
  dados: DadosDoChamado,
  situacao: Pick<Chamado, "status" | "atualizadoEm"> = { status: "aberto", atualizadoEm: t0 },
): Chamado {
  return { id: valorDe(lerTicketId(id)), dono, dados, criadoEm: t0, complementos: [], ...situacao };
}

export const incidenteDaAna = existente("INC-20311", ana, notebookLento);
export const requisicaoDaAna = existente("REQ-10442", ana, segundoMonitor);
export const incidenteDoJoao = existente("INC-20150", joao, notebookLento);

export function rascunhoConfirmadoDaAna(rascunhoId: string, dados: DadosDoChamado) {
  const pendente = valorDe(
    criarRascunho({
      id: valorDe(lerRascunhoId(rascunhoId)),
      dono: ana,
      conteudo: { tipo: "novo_chamado", dados },
      agora: t1,
    }),
  );
  return valorDe(confirmar(pendente, { por: ana, agora: t1 }));
}

export function complementoConfirmadoDaAna(rascunhoId: string, chamado: TicketId, texto: string) {
  const pendente = valorDe(
    criarRascunho({
      id: valorDe(lerRascunhoId(rascunhoId)),
      dono: ana,
      conteudo: { tipo: "complemento", chamado, texto },
      agora: t1,
    }),
  );
  return valorDe(confirmar(pendente, { por: ana, agora: t1 }));
}

export const RASCUNHO_1 = "rsc_0f8fad5b-d9cb-469f-a165-70867728950e";
export const RASCUNHO_2 = "rsc_7c9e6679-7425-40de-944b-e07fc1f90ae7";

export const chamadosIniciais = [incidenteDaAna, requisicaoDaAna, incidenteDoJoao];

export type Fabrica = (inicial: EstadoInicial) => TicketClient | Promise<TicketClient>;
