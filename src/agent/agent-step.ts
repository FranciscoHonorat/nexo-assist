import type { Chamado } from "../domain/chamado.js";

export type Confianca = "alta" | "media" | "baixa";

export type Declaracao = {
  readonly entendeu: string;
  readonly confianca: Confianca;
  readonly porque: string;
};

export type ChamadaDeTool = {
  readonly tool: "consultar_chamados";
};

export type ResultadoDeTool = {
  readonly tool: "consultar_chamados";
  readonly chamados: readonly Chamado[];
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
