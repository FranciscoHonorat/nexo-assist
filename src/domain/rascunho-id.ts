import { randomUUID } from "node:crypto";
import type { Resultado } from "./resultado.js";
import { lerNoFormato, type ErroDeLeitura, type Validado } from "./validado.js";

const PREFIXO = "rsc_";
const UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const FORMATO = new RegExp(`^${PREFIXO}${UUID_V4}$`);

export type RascunhoId = Validado<`${typeof PREFIXO}${string}`, "RascunhoId">;

export type ErroRascunhoId = ErroDeLeitura<"formato_invalido">;

export function novoRascunhoId(): RascunhoId {
  return `${PREFIXO}${randomUUID()}` as RascunhoId;
}

export function lerRascunhoId(texto: string): Resultado<RascunhoId, ErroRascunhoId> {
  return lerNoFormato(texto, { formato: FORMATO, normalizar: (t) => t.trim().toLowerCase() });
}
