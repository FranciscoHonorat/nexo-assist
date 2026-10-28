import type { Chamado } from "../domain/chamado.js";
import type { RascunhoId } from "../domain/rascunho-id.js";
import { falha, sucesso } from "../domain/resultado.js";
import { lerTicketId, type TicketId, type TipoChamado } from "../domain/ticket-id.js";
import type { EstadoInicial, TicketClient } from "./ticket-client.js";

const PREFIXO_POR_TIPO = {
  incidente: "INC",
  requisicao: "REQ",
} as const satisfies Record<TipoChamado, string>;

const PRIMEIRO_NUMERO = 30000;

export function ticketClientEmMemoria({ chamados }: EstadoInicial): TicketClient {
  const porId = new Map(chamados.map((chamado) => [chamado.id, chamado]));
  const criadosPorRascunho = new Map<RascunhoId, Chamado>();
  let proximoNumero = PRIMEIRO_NUMERO;

  const proximoId = (tipo: TipoChamado): TicketId => {
    const id = montarId(tipo, proximoNumero);
    proximoNumero += 1;
    return id;
  };

  return {
    listar: (dono) =>
      Promise.resolve([...porId.values()].filter((chamado) => chamado.dono === dono)),

    obter: (id, por) => {
      const chamado = porId.get(id);
      if (chamado?.dono !== por) return Promise.resolve(falha({ motivo: "nao_encontrado", id }));
      return Promise.resolve(sucesso(chamado));
    },

    criar: (rascunho, agora) => {
      const jaCriado = criadosPorRascunho.get(rascunho.id);
      if (jaCriado) return Promise.resolve(jaCriado);
      const chamado: Chamado = Object.freeze({
        id: proximoId(rascunho.conteudo.dados.tipo),
        dono: rascunho.dono,
        dados: rascunho.conteudo.dados,
        status: "aberto",
        criadoEm: agora,
        atualizadoEm: agora,
      });
      porId.set(chamado.id, chamado);
      criadosPorRascunho.set(rascunho.id, chamado);
      return Promise.resolve(chamado);
    },
  };
}

function montarId(tipo: TipoChamado, numero: number): TicketId {
  const lido = lerTicketId(`${PREFIXO_POR_TIPO[tipo]}-${String(numero)}`);
  if (!lido.ok) throw new Error(`numeração de chamados esgotada: ${String(numero)}`);
  return lido.valor;
}
