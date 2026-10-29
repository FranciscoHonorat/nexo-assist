import { lerTicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { ChamadaDeTool, RespostaDa, ResultadoDeTool } from "./agent-step.js";

export type PassoDaTool = {
  readonly etapa: "tool";
  readonly nome: ChamadaDeTool["tool"];
  readonly resultado: "executou" | "argumentos_invalidos" | "indisponivel";
  readonly detalhe: string;
};

const SERVICO_INDISPONIVEL = {
  resultado: "indisponivel",
  detalhe: "serviço de chamados indisponível",
} as const;

export type ToolExecutada = {
  readonly resultado: ResultadoDeTool;
  readonly trace: Pick<PassoDaTool, "resultado" | "detalhe">;
};

export async function executarTool(
  chamada: ChamadaDeTool,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  switch (chamada.tool) {
    case "consultar_chamados":
      return consultarChamados(chamada.id, usuario, chamados);
    case "obter_chamado":
      return obterChamado(chamada.id, chamada.argumentos.id, usuario, chamados);
  }
}

async function consultarChamados(
  chamada: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  const resposta = await chamados.listar(usuario);
  return {
    resultado: { chamada, tool: "consultar_chamados", resposta },
    trace: descreverLista(resposta),
  };
}

function descreverLista(resposta: RespostaDa<"consultar_chamados">): ToolExecutada["trace"] {
  if (!resposta.ok) return SERVICO_INDISPONIVEL;
  const ids = resposta.valor.map((chamado) => chamado.id).join(", ");
  return { resultado: "executou", detalhe: `${String(resposta.valor.length)} chamados: ${ids}` };
}

async function obterChamado(
  chamada: string,
  id: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  const resposta = await buscarPorId(id, usuario, chamados);
  return {
    resultado: { chamada, tool: "obter_chamado", resposta },
    trace: descreverBusca(resposta),
  };
}

async function buscarPorId(
  id: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<RespostaDa<"obter_chamado">> {
  const lido = lerTicketId(id);
  if (!lido.ok) return lido;
  return chamados.obter(lido.valor, usuario);
}

function descreverBusca(resposta: RespostaDa<"obter_chamado">): ToolExecutada["trace"] {
  if (resposta.ok) return { resultado: "executou", detalhe: `${resposta.valor.id} encontrado` };
  switch (resposta.erro.motivo) {
    case "formato_invalido":
      return {
        resultado: "argumentos_invalidos",
        detalhe: `id "${resposta.erro.recebido}" fora do formato`,
      };
    case "nao_encontrado":
      return { resultado: "executou", detalhe: `${resposta.erro.id} não encontrado` };
    case "indisponivel":
      return SERVICO_INDISPONIVEL;
  }
}

export function passoDaTool({ resultado, trace }: ToolExecutada): PassoDaTool {
  return { etapa: "tool", nome: resultado.tool, ...trace };
}
