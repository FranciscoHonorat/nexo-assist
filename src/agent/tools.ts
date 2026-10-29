import type { Chamado } from "../domain/chamado.js";
import type { Resultado } from "../domain/resultado.js";
import { lerTicketId, type ErroTicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { ChamadaDeTool, ResultadoDeTool } from "./agent-step.js";

export type PassoDaTool = {
  readonly etapa: "tool";
  readonly nome: ChamadaDeTool["tool"];
  readonly resultado: "executou" | "argumentos_invalidos";
  readonly detalhe: string;
};

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
      return consultarChamados(usuario, chamados);
    case "obter_chamado":
      return obterChamado(chamada.argumentos.id, usuario, chamados);
  }
}

async function consultarChamados(usuario: UserId, chamados: TicketClient): Promise<ToolExecutada> {
  const doUsuario = await chamados.listar(usuario);
  if (!doUsuario.ok) throw new Error("legado fora do ar durante uma tool: ainda sem tratamento");
  const ids = doUsuario.valor.map((chamado) => chamado.id).join(", ");
  return {
    resultado: { tool: "consultar_chamados", chamados: doUsuario.valor },
    trace: {
      resultado: "executou",
      detalhe: `${String(doUsuario.valor.length)} chamados: ${ids}`,
    },
  };
}

type RespostaDaBusca = Resultado<Chamado, ErroTicketId>;

async function obterChamado(
  id: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<ToolExecutada> {
  const resposta = await buscarPorId(id, usuario, chamados);
  return { resultado: { tool: "obter_chamado", resposta }, trace: descreverBusca(resposta) };
}

async function buscarPorId(
  id: string,
  usuario: UserId,
  chamados: TicketClient,
): Promise<RespostaDaBusca> {
  const lido = lerTicketId(id);
  if (!lido.ok) return lido;
  const consulta = await chamados.obter(lido.valor, usuario);
  if (!consulta.ok) throw new Error("obter_chamado sem sucesso: ainda sem tratamento");
  return consulta;
}

function descreverBusca(resposta: RespostaDaBusca): ToolExecutada["trace"] {
  if (resposta.ok) return { resultado: "executou", detalhe: `${resposta.valor.id} encontrado` };
  return {
    resultado: "argumentos_invalidos",
    detalhe: `id "${resposta.erro.recebido}" fora do formato`,
  };
}

export function passoDaTool({ resultado, trace }: ToolExecutada): PassoDaTool {
  return { etapa: "tool", nome: resultado.tool, ...trace };
}
