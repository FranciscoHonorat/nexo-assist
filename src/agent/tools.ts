import type { Chamado } from "../domain/chamado.js";
import { falha, type Resultado } from "../domain/resultado.js";
import { lerTicketId, type ErroTicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import {
  ehIndisponivel,
  type ErroDeConsulta,
  type TicketClient,
} from "../tickets/ticket-client.js";
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
  const resposta = await chamados.listar(usuario);
  if (!resposta.ok) throw new Error("legado fora do ar durante uma tool: ainda sem tratamento");
  return {
    resultado: { tool: "consultar_chamados", resposta },
    trace: descreverLista(resposta.valor),
  };
}

function descreverLista(lista: readonly Chamado[]): ToolExecutada["trace"] {
  const ids = lista.map((chamado) => chamado.id).join(", ");
  return { resultado: "executou", detalhe: `${String(lista.length)} chamados: ${ids}` };
}

type RespostaDaBusca = Resultado<Chamado, ErroTicketId | ErroDeConsulta>;

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
  if (consulta.ok) return consulta;
  if (ehIndisponivel(consulta.erro)) {
    throw new Error("legado fora do ar durante uma tool: ainda sem tratamento");
  }
  return falha(consulta.erro);
}

function descreverBusca(resposta: RespostaDaBusca): ToolExecutada["trace"] {
  if (resposta.ok) return { resultado: "executou", detalhe: `${resposta.valor.id} encontrado` };
  switch (resposta.erro.motivo) {
    case "formato_invalido":
      return {
        resultado: "argumentos_invalidos",
        detalhe: `id "${resposta.erro.recebido}" fora do formato`,
      };
    case "nao_encontrado":
      return { resultado: "executou", detalhe: `${resposta.erro.id} não encontrado` };
  }
}

export function passoDaTool({ resultado, trace }: ToolExecutada): PassoDaTool {
  return { etapa: "tool", nome: resultado.tool, ...trace };
}
