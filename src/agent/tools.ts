import { ARTIGOS } from "../ajuda/artigos.js";
import { criarCentralDeAjuda } from "../ajuda/central-de-ajuda.js";
import { sucesso } from "../domain/resultado.js";
import { lerTicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { Conversas } from "../conversas/conversas.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { ChamadaDeTool, RespostaDa, ResultadoDeTool } from "./agent-step.js";
import { proporChamado, proporComplemento } from "./propor.js";

export type ServicosDoTurno = {
  readonly chamados: TicketClient;
  readonly rascunhos: Pick<Conversas, "guardarRascunho">;
};

export type ContextoDasTools = {
  readonly usuario: UserId;
  readonly agora: Date;
  readonly servicos: ServicosDoTurno;
};

export type PassoDaTool = {
  readonly etapa: "tool";
  readonly nome: ChamadaDeTool["tool"];
  readonly resultado: "executou" | "argumentos_invalidos" | "recusou" | "indisponivel";
  readonly detalhe: string;
};

export type ToolExecutada = {
  readonly resultado: ResultadoDeTool;
  readonly trace: Pick<PassoDaTool, "resultado" | "detalhe">;
};

type Trace = ToolExecutada["trace"];

type ErroDeTool = Extract<ResultadoDeTool["resposta"], { readonly ok: false }>["erro"];

const CENTRAL_DE_AJUDA = criarCentralDeAjuda(ARTIGOS);

export async function executarTool(
  chamada: ChamadaDeTool,
  contexto: ContextoDasTools,
): Promise<ToolExecutada> {
  const { usuario, servicos } = contexto;
  const { id } = chamada;
  switch (chamada.tool) {
    case "consultar_chamados": {
      const resposta = await servicos.chamados.listar(usuario);
      return {
        resultado: { chamada: id, tool: chamada.tool, resposta },
        trace: ouErro(resposta, (chamados) =>
          executou(`${String(chamados.length)} chamados: ${idsDe(chamados)}`),
        ),
      };
    }
    case "obter_chamado": {
      const resposta = await buscarPorId(chamada.argumentos.id, usuario, servicos.chamados);
      return {
        resultado: { chamada: id, tool: chamada.tool, resposta },
        trace: ouErro(resposta, (chamado) => executou(`${chamado.id} encontrado`)),
      };
    }
    case "buscar_artigos": {
      const { consulta } = chamada.argumentos;
      const artigos = CENTRAL_DE_AJUDA.buscar(consulta);
      return {
        resultado: { chamada: id, tool: chamada.tool, resposta: sucesso(artigos) },
        trace: executou(
          `"${consulta}": ${artigos.length === 0 ? "nenhum artigo" : idsDe(artigos)}`,
        ),
      };
    }
    case "propor_chamado": {
      const resposta = await proporChamado(chamada.argumentos, contexto);
      return {
        resultado: { chamada: id, tool: chamada.tool, resposta },
        trace: ouErro(resposta, ({ rascunho }) => {
          const { tipo, categoria, prioridade, afetados } = rascunho.conteudo.dados;
          return executou(
            `rascunho de ${tipo} em ${categoria}, prioridade ${prioridade}, para ${afetados}`,
          );
        }),
      };
    }
    case "propor_complemento": {
      const resposta = await proporComplemento(chamada.argumentos, contexto);
      return {
        resultado: { chamada: id, tool: chamada.tool, resposta },
        trace: ouErro(resposta, ({ chamado }) =>
          executou(`rascunho de complemento para ${chamado.id}`),
        ),
      };
    }
  }
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

function idsDe(itens: readonly { readonly id: string }[]): string {
  return itens.map(({ id }) => id).join(", ");
}

function ouErro<T>(
  resposta:
    { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly erro: ErroDeTool },
  descreverSucesso: (valor: T) => Trace,
): Trace {
  return resposta.ok ? descreverSucesso(resposta.valor) : descreverErro(resposta.erro);
}

function executou(detalhe: string): Trace {
  return { resultado: "executou", detalhe };
}

function descreverErro(erro: ErroDeTool): Trace {
  switch (erro.motivo) {
    case "argumentos_invalidos":
      return {
        resultado: "argumentos_invalidos",
        detalhe: `campos inválidos: ${erro.campos.join(", ")}`,
      };
    case "formato_invalido":
      return {
        resultado: "argumentos_invalidos",
        detalhe: `id "${erro.recebido}" fora do formato`,
      };
    case "campo_vazio":
      return { resultado: "argumentos_invalidos", detalhe: `campo vazio: ${erro.campo}` };
    case "nao_encontrado":
      return executou(`${erro.id} não encontrado`);
    case "prioridade_incompativel":
      return {
        resultado: "recusou",
        detalhe: `prioridade ${erro.prioridade} para ${erro.afetados}`,
      };
    case "possivel_duplicidade":
      return {
        resultado: "recusou",
        detalhe: `possível duplicidade com ${idsDe(erro.candidatos)}`,
      };
    case "resolvido_ha_mais_de_7_dias":
      return { resultado: "recusou", detalhe: `${erro.id} resolvido há mais de 7 dias` };
    case "indisponivel":
      return { resultado: "indisponivel", detalhe: "serviço de chamados indisponível" };
  }
}

export function passoDaTool({ resultado, trace }: ToolExecutada): PassoDaTool {
  return { etapa: "tool", nome: resultado.tool, ...trace };
}
