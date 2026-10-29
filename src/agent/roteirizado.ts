import type { AgentStep, ContextoDoPasso, Decisao } from "./agent-step.js";

export type AgentStepRoteirizado = AgentStep & {
  readonly contextosRecebidos: readonly ContextoDoPasso[];
};

export function agentStepRoteirizado(roteiro: readonly Decisao[]): AgentStepRoteirizado {
  const contextosRecebidos: ContextoDoPasso[] = [];
  return {
    contextosRecebidos,
    decidir: (contexto) => {
      contextosRecebidos.push(contexto);
      const chamada = contextosRecebidos.length;
      const decisao = roteiro[chamada - 1];
      if (decisao === undefined) return Promise.reject(roteiroAcabou(chamada, roteiro.length));
      return Promise.resolve(decisao);
    },
  };
}

function roteiroAcabou(chamada: number, decisoesNoRoteiro: number): Error {
  return new Error(
    `o roteiro do modelo acabou: a chamada ${String(chamada)} não tem decisão, o roteiro tinha ${String(decisoesNoRoteiro)}`,
  );
}
