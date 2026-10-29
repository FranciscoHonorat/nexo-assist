export type Json =
  string | number | boolean | null | readonly Json[] | { readonly [chave: string]: Json };
