import type { Chamado } from "../domain/chamado.js";
import type {
  ChamadoProposto,
  ComplementoProposto,
  DecisaoFinal,
  ResultadoDeTool,
} from "./agent-step.js";

export const LIMITE_DE_OPCOES = 4;

export type Anexos = {
  readonly chamados: readonly Chamado[];
  readonly rascunho: ChamadoProposto | ComplementoProposto | null;
  readonly opcoes: readonly string[];
};

export const SEM_ANEXOS: Anexos = { chamados: [], rascunho: null, opcoes: [] };

export function anexosDo(
  decisao: DecisaoFinal | null,
  resultados: readonly ResultadoDeTool[],
): Anexos {
  const responder = decisao?.tipo === "responder" ? decisao : null;
  return {
    chamados: citadosSemRepetir(responder?.chamados ?? [], resultados.flatMap(chamadosTrazidos)),
    rascunho: resultados.reduce<Anexos["rascunho"]>(
      (ultimo, resultado) => propostaDe(resultado) ?? ultimo,
      null,
    ),
    opcoes: (responder?.opcoes ?? [])
      .map((opcao) => opcao.trim())
      .filter((opcao) => opcao !== "")
      .slice(0, LIMITE_DE_OPCOES),
  };
}

function chamadosTrazidos(resultado: ResultadoDeTool): readonly Chamado[] {
  switch (resultado.tool) {
    case "consultar_chamados":
      return resultado.resposta.ok ? resultado.resposta.valor : [];
    case "obter_chamado":
      return resultado.resposta.ok ? [resultado.resposta.valor] : [];
    case "propor_complemento":
      return resultado.resposta.ok ? [resultado.resposta.valor.chamado] : [];
    case "buscar_artigos":
    case "propor_chamado":
      return [];
  }
}

function propostaDe(resultado: ResultadoDeTool): Anexos["rascunho"] {
  switch (resultado.tool) {
    case "propor_chamado":
    case "propor_complemento":
      return resultado.resposta.ok ? resultado.resposta.valor : null;
    case "consultar_chamados":
    case "obter_chamado":
    case "buscar_artigos":
      return null;
  }
}

function citadosSemRepetir(
  citados: readonly string[],
  trazidos: readonly Chamado[],
): readonly Chamado[] {
  const porId = new Map(trazidos.map((chamado) => [chamado.id as string, chamado]));
  return [...new Set(citados)].flatMap((id) => porId.get(id) ?? []);
}
