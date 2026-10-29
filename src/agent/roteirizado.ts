import type { AgentStep, ContextoDoPasso, Decisao } from "./agent-step.js";

export type AgentStepRoteirizado = AgentStep & {
  readonly contextosRecebidos: readonly ContextoDoPasso[];
};

export function agentStepRoteirizado(roteiro: readonly Decisao[]): AgentStepRoteirizado {
  const pendentes = [...roteiro];
  const contextosRecebidos: ContextoDoPasso[] = [];
  return {
    contextosRecebidos,
    decidir: (contexto) => {
      contextosRecebidos.push(contexto);
      const proxima = pendentes.shift();
      if (proxima === undefined) {
        return Promise.reject(
          new Error(
            `o roteiro do modelo acabou: a chamada ${String(contextosRecebidos.length)} não tem decisão, o roteiro tinha ${String(roteiro.length)}`,
          ),
        );
      }
      return Promise.resolve(proxima);
    },
  };
}
