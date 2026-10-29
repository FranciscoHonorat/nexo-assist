import type { Chamado } from "../domain/chamado.js";
import type { Resultado } from "../domain/resultado.js";
import type { ErroTicketId } from "../domain/ticket-id.js";
import type { ErroDeConsulta, ErroDeInfraestrutura } from "../tickets/ticket-client.js";

export type Confianca = "alta" | "media" | "baixa";

export type Declaracao = {
  readonly entendeu: string;
  readonly confianca: Confianca;
  readonly porque: string;
};

export type ChamadaDeTool =
  | { readonly tool: "consultar_chamados" }
  | { readonly tool: "obter_chamado"; readonly argumentos: { readonly id: string } };

export type ResultadoDeTool =
  | {
      readonly tool: "consultar_chamados";
      readonly resposta: Resultado<readonly Chamado[], ErroDeInfraestrutura>;
    }
  | {
      readonly tool: "obter_chamado";
      readonly resposta: Resultado<Chamado, ErroTicketId | ErroDeConsulta | ErroDeInfraestrutura>;
    };

export type DecisaoFinal =
  | {
      readonly tipo: "responder";
      readonly declaracao: Declaracao;
      readonly mensagem: string;
    }
  | {
      readonly tipo: "texto_solto";
      readonly texto: string;
    };

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

export type AgentStep = {
  readonly decidir: (contexto: ContextoDoPasso) => Promise<Decisao>;
};
