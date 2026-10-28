import type { Prioridade } from "./prazo.js";
import type { TipoChamado } from "./ticket-id.js";

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
