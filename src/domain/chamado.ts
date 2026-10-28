import { falha, sucesso, type Resultado } from "./resultado.js";
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

export type Chamado = {
  readonly id: TicketId;
  readonly dono: UserId;
  readonly dados: DadosDoChamado;
  readonly status: StatusDoChamado;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
};

const CAMPOS_OBRIGATORIOS_DE_TEXTO = ["titulo", "descricao"] as const;

export type ErroDeConteudo = {
  readonly motivo: "campo_vazio";
  readonly campo: (typeof CAMPOS_OBRIGATORIOS_DE_TEXTO)[number];
};

export function lerDadosDoChamado(
  dados: DadosDoChamado,
): Resultado<DadosDoChamado, ErroDeConteudo> {
  const aparados = { ...dados, titulo: dados.titulo.trim(), descricao: dados.descricao.trim() };
  const campoVazio = CAMPOS_OBRIGATORIOS_DE_TEXTO.find((campo) => aparados[campo] === "");
  if (campoVazio) return falha({ motivo: "campo_vazio", campo: campoVazio });
  return sucesso(Object.freeze(aparados));
}
