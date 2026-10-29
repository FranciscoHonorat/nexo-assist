import { conversasEmMemoria } from "../conversas/em-memoria.js";
import type { ChamadaDeTool, Decisao, Declaracao } from "../agent/agent-step.js";
import { prepararTurno } from "../agent/guardas.js";
import type { AgentStepRoteirizado } from "../agent/roteirizado.js";
import type { PassoDaTool } from "../agent/tools.js";
import type { PassoDaResposta, ServicosDoTurno } from "../agent/turno.js";
import type { Chamado } from "../domain/chamado.js";
import { novaConversa } from "../domain/conversa.js";
import { MINUTO } from "../domain/tempo.js";
import { t1 } from "../tickets/contrato/fixtures.js";
import { ticketClientEmMemoria, type Operacao } from "../tickets/em-memoria.js";
import { ana } from "./usuarios.js";
import { valorDe } from "./valor-de.js";

export async function cenarioDaAna(
  mensagem: string,
  chamados: readonly Chamado[] = [],
  { foraDoAr = false } = {},
) {
  const consultas: Operacao[] = [];
  const cliente = ticketClientEmMemoria(
    { chamados },
    {
      falhar: (operacao) => {
        consultas.push(operacao);
        return foraDoAr ? "antes" : undefined;
      },
    },
  );
  const turno = valorDe(
    await prepararTurno(
      {
        usuario: ana,
        conversa: novaConversa({ dono: ana }),
        mensagem,
        anteriores: [],
        mensagensNaSessao: 0,
        agora: new Date(t1.getTime() + MINUTO),
      },
      cliente,
    ),
  );
  const conversas = conversasEmMemoria();
  const servicos: ServicosDoTurno = { chamados: cliente, rascunhos: conversas };
  return { turno, servicos, conversas, consultas };
}

export const declaracaoDaSaudacao = {
  entendeu: "o funcionário só cumprimentou",
  confianca: "alta",
  porque: "a mensagem não descreve nenhum problema",
} as const;

export function responde(
  mensagem: string,
  declaracao: Declaracao = declaracaoDaSaudacao,
): Extract<Decisao, { tipo: "responder" }> {
  return { tipo: "responder", declaracao, mensagem };
}

export function textoSolto(texto: string): Decisao {
  return { tipo: "texto_solto", texto };
}

export type SemId<Chamada> = Chamada extends unknown ? Omit<Chamada, "id"> : never;

export function chamaTools(...pedidos: SemId<ChamadaDeTool>[]): Decisao {
  return {
    tipo: "tools",
    chamadas: pedidos.map((pedido, indice) => ({ ...pedido, id: `chamada_${String(indice + 1)}` })),
  };
}

export function vistoDepoisDasTools(modelo: AgentStepRoteirizado) {
  return modelo.contextosRecebidos[1]?.resultadosDeTools;
}

export function passoDaResposta(
  resultado: PassoDaResposta["resultado"],
  detalhe: string,
): PassoDaResposta {
  return { etapa: "resposta", resultado, detalhe };
}

export function passoDeTool(
  nome: PassoDaTool["nome"],
  resultado: PassoDaTool["resultado"],
  detalhe: string,
): PassoDaTool {
  return { etapa: "tool", nome, resultado, detalhe };
}
