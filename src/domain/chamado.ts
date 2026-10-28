import { falha, sucesso, type Resultado } from "./resultado.js";
import { DIA } from "./tempo.js";
import type { Prioridade } from "./prazo.js";
import type { TicketId, TipoChamado } from "./ticket-id.js";
import type { UserId } from "./user-id.js";

export type Categoria = "acesso" | "rede_e_vpn" | "hardware" | "software" | "email" | "outros";

export type Afetados = "so_eu" | "minha_equipe" | "empresa";

export type DadosDoChamado = {
  readonly titulo: string;
  readonly descricao: string;
  readonly tipo: TipoChamado;
  readonly categoria: Categoria;
  readonly prioridade: Prioridade;
  readonly afetados: Afetados;
};

export type StatusDoChamado = "aberto" | "aguardando_analista" | "aprovado" | "resolvido";

export type ComplementoDoChamado = {
  readonly texto: string;
  readonly em: Date;
};

export type Chamado = {
  readonly id: TicketId;
  readonly dono: UserId;
  readonly dados: DadosDoChamado;
  readonly status: StatusDoChamado;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
  readonly complementos: readonly ComplementoDoChamado[];
};

const CAMPOS_OBRIGATORIOS_DE_TEXTO = ["titulo", "descricao"] as const;

export type ErroDeDados = {
  readonly motivo: "campo_vazio";
  readonly campo: (typeof CAMPOS_OBRIGATORIOS_DE_TEXTO)[number];
};

export function lerDadosDoChamado(dados: DadosDoChamado): Resultado<DadosDoChamado, ErroDeDados> {
  const aparados = { ...dados, titulo: dados.titulo.trim(), descricao: dados.descricao.trim() };
  const campoVazio = CAMPOS_OBRIGATORIOS_DE_TEXTO.find((campo) => aparados[campo] === "");
  if (campoVazio) return falha({ motivo: "campo_vazio", campo: campoVazio });
  return sucesso(Object.freeze(aparados));
}

const PRAZO_DE_REABERTURA = 7 * DIA;

export type ErroDeReabertura = {
  readonly motivo: "resolvido_ha_mais_de_7_dias";
  readonly id: TicketId;
};

type NovoComplemento = {
  readonly texto: string;
  readonly agora: Date;
};

export function complementarChamado(
  chamado: Chamado,
  { texto, agora }: NovoComplemento,
): Resultado<Chamado, ErroDeReabertura> {
  const resolvidoHa = agora.getTime() - chamado.atualizadoEm.getTime();
  if (chamado.status === "resolvido" && resolvidoHa > PRAZO_DE_REABERTURA)
    return falha({ motivo: "resolvido_ha_mais_de_7_dias", id: chamado.id });
  return sucesso(
    Object.freeze({
      ...chamado,
      status: chamado.status === "resolvido" ? "aberto" : chamado.status,
      atualizadoEm: agora,
      complementos: Object.freeze([...chamado.complementos, Object.freeze({ texto, em: agora })]),
    }),
  );
}

type DestinosPermitidos = {
  aberto: "aguardando_analista" | "aprovado" | "resolvido";
  aguardando_analista: "aberto" | "resolvido";
  aprovado: "resolvido";
  resolvido: never;
};

export type TransicaoDeStatus = {
  [De in StatusDoChamado]: [DestinosPermitidos[De]] extends [never]
    ? never
    : { readonly de: De; readonly para: DestinosPermitidos[De] };
}[StatusDoChamado];

export type ErroDeConflitoDeStatus = {
  readonly motivo: "status_mudou";
  readonly id: TicketId;
  readonly esperado: StatusDoChamado;
  readonly atual: StatusDoChamado;
};

export function alterarStatusDoChamado(
  chamado: Chamado,
  { de, para }: TransicaoDeStatus,
  agora: Date,
): Resultado<Chamado, ErroDeConflitoDeStatus> {
  if (chamado.status === para) return sucesso(chamado);
  if (chamado.status !== de)
    return falha({ motivo: "status_mudou", id: chamado.id, esperado: de, atual: chamado.status });
  return sucesso(Object.freeze({ ...chamado, status: para, atualizadoEm: agora }));
}
