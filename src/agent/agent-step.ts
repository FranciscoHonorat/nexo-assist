import type { Artigo } from "../ajuda/central-de-ajuda.js";
import type {
  Chamado,
  DadosDoChamado,
  ErroDePrioridade,
  ErroDeReabertura,
} from "../domain/chamado.js";
import type { MotivoDeTransferencia } from "../domain/conversa.js";
import type { Complemento, ErroDeConteudo, NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { ErroTicketId } from "../domain/ticket-id.js";
import type { ErroDeConsulta } from "../tickets/ticket-client.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";

export const CONFIANCAS = ["alta", "media", "baixa"] as const;

export type Confianca = (typeof CONFIANCAS)[number];

export type Declaracao = {
  readonly entendeu: string;
  readonly confianca: Confianca;
  readonly porque: string;
};

export type PedidoDeTransferencia = {
  readonly motivo: MotivoDeTransferencia;
  readonly resumo: string;
};

export type ArgumentosInvalidos = { readonly invalidos: readonly string[] };

type OuInvalidos<Argumentos> = Argumentos | ArgumentosInvalidos;

export type PropostaDeChamado = {
  readonly dados: DadosDoChamado;
  readonly chamadosConferidos: readonly string[];
};

export type PropostaDeComplemento = {
  readonly chamado: string;
  readonly texto: string;
};

export type ChamadaDeTool = { readonly id: string } & (
  | { readonly tool: "consultar_chamados" }
  | { readonly tool: "obter_chamado"; readonly argumentos: { readonly id: string } }
  | { readonly tool: "buscar_artigos"; readonly argumentos: { readonly consulta: string } }
  | { readonly tool: "propor_chamado"; readonly argumentos: OuInvalidos<PropostaDeChamado> }
  | {
      readonly tool: "propor_complemento";
      readonly argumentos: OuInvalidos<PropostaDeComplemento>;
    }
);

export type ErroDosArgumentos = {
  readonly motivo: "argumentos_invalidos";
  readonly campos: readonly string[];
};

export type ErroDeDuplicidade = {
  readonly motivo: "possivel_duplicidade";
  readonly candidatos: readonly Chamado[];
};

export type ComplementoProposto = {
  readonly rascunho: Rascunho<"pendente", Complemento>;
  readonly chamado: Chamado;
};

export type ChamadoProposto = {
  readonly rascunho: Rascunho<"pendente", NovoChamado>;
  readonly prazo: Date;
};

type RespostaDoServico<T, E = never> = Resultado<T, E | ErroDeInfraestrutura>;

type RespostasPorTool = {
  consultar_chamados: RespostaDoServico<readonly Chamado[]>;
  obter_chamado: RespostaDoServico<Chamado, ErroTicketId | ErroDeConsulta>;
  buscar_artigos: Resultado<readonly Artigo[], never>;
  propor_chamado: RespostaDoServico<
    ChamadoProposto,
    ErroDosArgumentos | ErroDeConteudo | ErroDePrioridade | ErroDeDuplicidade
  >;
  propor_complemento: RespostaDoServico<
    ComplementoProposto,
    ErroDosArgumentos | ErroTicketId | ErroDeConsulta | ErroDeReabertura | ErroDeConteudo
  >;
};

export type RespostaDa<Tool extends keyof RespostasPorTool> = RespostasPorTool[Tool];

export type ResultadoDeTool = {
  [Tool in keyof RespostasPorTool]: {
    readonly chamada: string;
    readonly tool: Tool;
    readonly resposta: RespostaDa<Tool>;
  };
}[keyof RespostasPorTool];

export type DecisaoFinal =
  | {
      readonly tipo: "responder";
      readonly declaracao: Declaracao;
      readonly mensagem: string;
      readonly opcoes?: readonly string[];
      readonly chamados?: readonly string[];
    }
  | {
      readonly tipo: "texto_solto";
      readonly texto: string;
    }
  | {
      readonly tipo: "declaracao_invalida";
      readonly mensagem: string;
      readonly campos: readonly string[];
    }
  | { readonly tipo: "recusa" }
  | ({ readonly tipo: "transferir" } & PedidoDeTransferencia);

export type Decisao =
  | DecisaoFinal
  | {
      readonly tipo: "tools";
      readonly chamadas: readonly ChamadaDeTool[];
    };

export type MensagemAnterior = {
  readonly autor: "funcionario" | "agent";
  readonly texto: string;
};

export type ContextoDoPasso = {
  readonly mensagem: string;
  readonly anteriores: readonly MensagemAnterior[];
  readonly chamadosVencidos: readonly Chamado[];
  readonly resultadosDeTools: readonly ResultadoDeTool[];
};

export type SessaoDoModelo = {
  readonly decidir: (contexto: ContextoDoPasso) => Promise<Decisao>;
};

export type AgentStep = {
  readonly iniciarTurno: () => SessaoDoModelo;
};
