import type { AgentStep, ContextoDoPasso, Decisao } from "./agent-step.js";

export type AgentStepRoteirizado = AgentStep & {
  readonly contextosRecebidos: readonly ContextoDoPasso[];
};

export function agentStepRoteirizado(roteiro: readonly Decisao[]): AgentStepRoteirizado {
  const contextosRecebidos: ContextoDoPasso[] = [];
  const decidir = (contexto: ContextoDoPasso): Promise<Decisao> => {
    contextosRecebidos.push(contexto);
    const chamada = contextosRecebidos.length;
    const decisao = roteiro[chamada - 1];
    if (decisao === undefined) return Promise.reject(roteiroAcabou(chamada, roteiro.length));
    return Promise.resolve(decisao);
  };
  return { contextosRecebidos, iniciarTurno: () => ({ decidir }) };
}

function roteiroAcabou(chamada: number, decisoesNoRoteiro: number): Error {
  return new Error(
    `o roteiro do modelo acabou: a chamada ${String(chamada)} não tem decisão, o roteiro tinha ${String(decisoesNoRoteiro)}`,
  );
}
