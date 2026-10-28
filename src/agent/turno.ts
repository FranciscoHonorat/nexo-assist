import type { AgentStep, Declaracao } from "./agent-step.js";
import type { TurnoPronto } from "./guardas.js";

export type RespostaDoTurno = {
  readonly mensagem: string;
  readonly declaracao: Declaracao;
};

export async function executarTurno(
  turno: TurnoPronto,
  modelo: AgentStep,
): Promise<RespostaDoTurno> {
  const decisao = await modelo.decidir({
    mensagem: turno.mensagem,
    chamadosVencidos: turno.chamadosVencidos,
  });
  return { mensagem: decisao.mensagem, declaracao: decisao.declaracao };
}
