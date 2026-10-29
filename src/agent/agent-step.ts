import type { Chamado } from "../domain/chamado.js";
import type { Resultado } from "../domain/resultado.js";
import type { ErroTicketId } from "../domain/ticket-id.js";
import type { ErroDeConsulta } from "../tickets/ticket-client.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";

export type Confianca = "alta" | "media" | "baixa";

export type Declaracao = {
  readonly entendeu: string;
  readonly confianca: Confianca;
  readonly porque: string;
};

export type ChamadaDeTool = { readonly id: string } & (
  | { readonly tool: "consultar_chamados" }
  | { readonly tool: "obter_chamado"; readonly argumentos: { readonly id: string } }
);

type RespostaDoServico<T, E = never> = Resultado<T, E | ErroDeInfraestrutura>;

type RespostasPorTool = {
  consultar_chamados: RespostaDoServico<readonly Chamado[]>;
  obter_chamado: RespostaDoServico<Chamado, ErroTicketId | ErroDeConsulta>;
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
    }
  | {
      readonly tipo: "texto_solto";
      readonly texto: string;
    }
  | { readonly tipo: "recusa" };

export type Decisao =
  | DecisaoFinal
  | {
      readonly tipo: "tools";
      readonly chamadas: readonly ChamadaDeTool[];
    };

export type ContextoDoPasso = {
  readonly mensagem: string;
  readonly chamadosVencidos: readonly Chamado[];
  readonly resultadosDeTools: readonly ResultadoDeTool[];
};

export type SessaoDoModelo = {
  readonly decidir: (contexto: ContextoDoPasso) => Promise<Decisao>;
};

export type AgentStep = {
  readonly iniciarTurno: () => SessaoDoModelo;
};
