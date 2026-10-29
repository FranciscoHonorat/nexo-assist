import type { SemValidacao } from "../domain/validado.js";

export type Json =
  string | number | boolean | null | readonly Json[] | { readonly [chave: string]: Json };

export function comoJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}

export type JsonDe<T> = T extends Date
  ? string
  : T extends string | number | boolean | null | undefined
    ? SemValidacao<T>
    : T extends readonly (infer Item)[]
      ? readonly JsonDe<Item>[]
      : { readonly [K in keyof T as K extends string ? K : never]: JsonDe<T[K]> };
