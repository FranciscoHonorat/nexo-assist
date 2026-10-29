export type Json =
  string | number | boolean | null | readonly Json[] | { readonly [chave: string]: Json };

export function comoJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}
