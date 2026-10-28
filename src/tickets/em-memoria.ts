import { alterarStatusDoChamado, complementarChamado, type Chamado } from "../domain/chamado.js";
import type { RascunhoId } from "../domain/rascunho-id.js";
import { encadear, falha, sucesso, type Resultado } from "../domain/resultado.js";
import { lerTicketId, type TicketId, type TipoChamado } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type {
  ErroDeComplementacao,
  ErroDeConsulta,
  ErroDeInfraestrutura,
  EstadoInicial,
  TicketClient,
} from "./ticket-client.js";

const PREFIXO_POR_TIPO = {
  incidente: "INC",
  requisicao: "REQ",
} as const satisfies Record<TipoChamado, string>;

const PRIMEIRO_NUMERO = 30000;

export type Operacao = keyof TicketClient;

export type FalhaSimulada = "antes" | "depois";

type Simulacao = {
  readonly falhar?: (operacao: Operacao) => FalhaSimulada | undefined;
};

const INDISPONIVEL = falha({ motivo: "indisponivel" } as const);

export function ticketClientEmMemoria(
  { chamados }: EstadoInicial,
  { falhar = () => undefined }: Simulacao = {},
): TicketClient {
  const porId = new Map(chamados.map((chamado) => [chamado.id, chamado]));
  const criadosPorRascunho = new Map<RascunhoId, Chamado>();
  const complementadosPorRascunho = new Map<RascunhoId, Resultado<Chamado, ErroDeComplementacao>>();
  let proximoNumero = PRIMEIRO_NUMERO;

  const proximoId = (tipo: TipoChamado): TicketId => {
    const id = montarId(tipo, proximoNumero);
    proximoNumero += 1;
    return id;
  };

  const doDono = (id: TicketId, por: UserId): Resultado<Chamado, ErroDeConsulta> => {
    const chamado = porId.get(id);
    return chamado?.dono === por ? sucesso(chamado) : falha({ motivo: "nao_encontrado", id });
  };

  const responder = <T, E>(
    operacao: Operacao,
    executar: () => Resultado<T, E>,
  ): Promise<Resultado<T, E | ErroDeInfraestrutura>> => {
    const falhaSimulada = falhar(operacao);
    if (falhaSimulada === "antes") return Promise.resolve(INDISPONIVEL);
    const resultado = executar();
    return Promise.resolve(falhaSimulada === "depois" ? INDISPONIVEL : resultado);
  };

  const gravar = <E>(resultado: Resultado<Chamado, E>): Resultado<Chamado, E> => {
    if (resultado.ok) porId.set(resultado.valor.id, resultado.valor);
    return resultado;
  };

  return {
    listar: (dono) =>
      responder("listar", () =>
        sucesso([...porId.values()].filter((chamado) => chamado.dono === dono)),
      ),

    obter: (id, por) => responder("obter", () => doDono(id, por)),

    criar: (rascunho, agora) =>
      responder("criar", () => {
        const jaCriado = criadosPorRascunho.get(rascunho.id);
        if (jaCriado) return sucesso(jaCriado);
        const chamado: Chamado = Object.freeze({
          id: proximoId(rascunho.conteudo.dados.tipo),
          dono: rascunho.dono,
          dados: rascunho.conteudo.dados,
          status: "aberto",
          criadoEm: agora,
          atualizadoEm: agora,
          complementos: [],
        });
        porId.set(chamado.id, chamado);
        criadosPorRascunho.set(rascunho.id, chamado);
        return sucesso(chamado);
      }),

    complementar: (rascunho, agora) =>
      responder("complementar", () => {
        const jaAplicado = complementadosPorRascunho.get(rascunho.id);
        if (jaAplicado) return jaAplicado;
        const { chamado, texto } = rascunho.conteudo;
        const resultado = gravar(
          encadear(doDono(chamado, rascunho.dono), (atual) =>
            complementarChamado(atual, { texto, agora }),
          ),
        );
        complementadosPorRascunho.set(rascunho.id, resultado);
        return resultado;
      }),

    alterarStatus: (id, alteracao, agora) =>
      responder("alterarStatus", () =>
        gravar(
          encadear(doDono(id, alteracao.por), (atual) =>
            alterarStatusDoChamado(atual, alteracao, agora),
          ),
        ),
      ),
  };
}

function montarId(tipo: TipoChamado, numero: number): TicketId {
  const lido = lerTicketId(`${PREFIXO_POR_TIPO[tipo]}-${String(numero)}`);
  if (!lido.ok) throw new Error(`numeração de chamados esgotada: ${String(numero)}`);
  return lido.valor;
}
