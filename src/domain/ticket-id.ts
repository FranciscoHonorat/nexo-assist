import type { Resultado } from "./resultado.js";
import { lerNoFormato, type ErroDeLeitura, type Validado } from "./validado.js";

const TIPO_POR_PREFIXO = {
  INC: "incidente",
  REQ: "requisicao",
} as const;

type TipoPorPrefixo = typeof TIPO_POR_PREFIXO;
type Prefixo = keyof TipoPorPrefixo;

export type TipoChamado = TipoPorPrefixo[Prefixo];

export type TicketId<P extends Prefixo = Prefixo> = Validado<
  `${P}${typeof SEPARADOR}${number}`,
  "TicketId"
>;

export type ErroTicketId = ErroDeLeitura<"formato_invalido">;

const SEPARADOR = "-";
const MAXIMO_DE_DIGITOS = 9;
const PREFIXOS = Object.keys(TIPO_POR_PREFIXO).join("|");
const FORMATO = new RegExp(`^(${PREFIXOS})${SEPARADOR}\\d{1,${String(MAXIMO_DE_DIGITOS)}}$`);

export function lerTicketId(texto: string): Resultado<TicketId, ErroTicketId> {
  return lerNoFormato(texto, { formato: FORMATO, normalizar: (t) => t.trim().toUpperCase() });
}

export function tipoDoChamado<P extends Prefixo>(id: TicketId<P>): TipoPorPrefixo[P] {
  const prefixo = id.slice(0, id.indexOf(SEPARADOR)) as P;
  return TIPO_POR_PREFIXO[prefixo];
}
