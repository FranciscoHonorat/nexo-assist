import type { EventoDaApi, MensagemDaApi, Nomes, RegistroDaApi, ResumoDaApi } from "./tipos.js";

type NomeDaTool = Extract<RegistroDaApi["trace"][number], { readonly etapa: "tool" }>["nome"];

const ACAO_POR_TOOL = {
  consultar_chamados: "consultou seus chamados",
  obter_chamado: "consultou o chamado",
  buscar_artigos: "buscou na central de ajuda",
  propor_chamado: "montou o rascunho",
  propor_complemento: "montou o complemento",
} as const satisfies Record<NomeDaTool, string>;

export const MOTIVO_DA_TRANSFERENCIA = {
  pedido_do_funcionario: "pedido do funcionário",
  caso_critico: "caso crítico",
  chamado_vencido: "chamado vencido",
  baixa_confianca: "agent sem segurança",
} as const;

export const STATUS_DO_CHAMADO = {
  aberto: "Aberto",
  aguardando_analista: "Aguardando analista",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
} as const;

export const PRIORIDADE = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
} as const;

export const CATEGORIA = {
  acesso: "Acesso",
  rede_e_vpn: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  outros: "Outros",
} as const;

export const AFETADOS = {
  so_eu: "Somente você",
  minha_equipe: "Sua equipe",
  empresa: "Toda a empresa",
} as const;

export function acoesDoTurno({ trace }: RegistroDaApi): readonly string[] {
  const acoes = trace.flatMap((passo) => {
    if (passo.etapa === "tool") {
      return passo.resultado === "recusou" && passo.nome === "propor_chamado"
        ? ["conferiu um rascunho que o código recusou"]
        : [ACAO_POR_TOOL[passo.nome]];
    }
    if (passo.etapa === "resposta" && passo.resultado === "transferiu")
      return ["chamou um analista"];
    return [];
  });
  return [...new Set(acoes)];
}

export function textoDoEvento(evento: EventoDaApi, nomes: Nomes): string {
  switch (evento.tipo) {
    case "transferida":
      return `Transferida para um analista · ${MOTIVO_DA_TRANSFERENCIA[evento.motivo]}`;
    case "assumida":
      return `${nomes[evento.analista] ?? evento.analista} assumiu · agent pausado`;
    case "devolvida":
      return "Devolvida ao Nexo Assist";
    case "encerrada":
      return "Atendimento encerrado";
    case "chamado_criado":
      return `Chamado ${evento.chamado} criado`;
    case "chamado_complementado":
      return `Chamado ${evento.chamado} atualizado`;
    case "rascunho_descartado":
      return "Rascunho descartado";
    case "sessao_iniciada":
      return "Nova sessão";
  }
}

export function daSessaoAtual(mensagens: readonly MensagemDaApi[]): readonly MensagemDaApi[] {
  const inicio = mensagens.findLastIndex(
    (mensagem) => mensagem.autor === "sistema" && mensagem.evento.tipo === "sessao_iniciada",
  );
  return inicio === -1 ? mensagens : mensagens.slice(inicio);
}

const RESOLUCOES: readonly EventoDaApi["tipo"][] = [
  "chamado_criado",
  "chamado_complementado",
  "rascunho_descartado",
];

export function rascunhoJaResolvido(mensagens: readonly MensagemDaApi[], id: number): boolean {
  return mensagens.some(
    (mensagem) =>
      mensagem.id > id && mensagem.autor === "sistema" && RESOLUCOES.includes(mensagem.evento.tipo),
  );
}

export type Situacao = {
  readonly rotulo: string;
  readonly tom: "alerta" | "info" | "neutro" | "sucesso";
  readonly grupo: "fila" | "minhas" | "outras" | "agent";
};

export function situacaoNoConsole({ conversa, ultima }: ResumoDaApi, eu: string): Situacao {
  switch (conversa.controle) {
    case "aguardando":
      return {
        rotulo: `Transferida · ${MOTIVO_DA_TRANSFERENCIA[conversa.transferencia.motivo]}`,
        tom: "alerta",
        grupo: "fila",
      };
    case "analista":
      return conversa.analista === eu
        ? { rotulo: "Você está atendendo", tom: "info", grupo: "minhas" }
        : { rotulo: `Com ${conversa.analista}`, tom: "neutro", grupo: "outras" };
    case "agent":
      return ultima?.autor === "agent" && ultima.registro.confianca === "baixa"
        ? { rotulo: "Agent sem segurança · confiança baixa", tom: "alerta", grupo: "agent" }
        : { rotulo: "Agent atendendo", tom: "sucesso", grupo: "agent" };
  }
}
