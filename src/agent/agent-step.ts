import type { Chamado } from "../domain/chamado.js";

export type Confianca = "alta" | "media" | "baixa";

export type Declaracao = {
  readonly entendeu: string;
  readonly confianca: Confianca;
  readonly porque: string;
};

export type Decisao =
  | {
      readonly tipo: "responder";
      readonly declaracao: Declaracao;
      readonly mensagem: string;
    }
  | {
      readonly tipo: "texto_solto";
      readonly texto: string;
    };

export type ContextoDoPasso = {
  readonly mensagem: string;
  readonly chamadosVencidos: readonly Chamado[];
};

export type AgentStep = {
  readonly decidir: (contexto: ContextoDoPasso) => Promise<Decisao>;
};
