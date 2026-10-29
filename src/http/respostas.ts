import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import type { ErroDaApi, MotivoDeErro } from "./contrato.js";

const STATUS_POR_MOTIVO = {
  formato_invalido: 404,
  rascunho_nao_encontrado: 404,
  nao_e_o_dono: 404,
  nao_encontrado: 404,
  rascunho_ja_resolvido: 409,
  resolvido_ha_mais_de_7_dias: 409,
  conversa_em_outro_estado: 409,
  controle_mudou: 409,
  nao_e_o_analista: 409,
  campo_vazio: 400,
  indisponivel: 503,
} as const satisfies Record<MotivoDeErro, ContentfulStatusCode>;

export function responderErro(c: Context, { motivo }: { readonly motivo: MotivoDeErro }) {
  return recusar(c, STATUS_POR_MOTIVO[motivo], motivo);
}

export function recusar(c: Context, status: ContentfulStatusCode, erro: ErroDaApi["erro"]) {
  return c.json({ erro } satisfies ErroDaApi, status);
}

export async function lerCorpo<T>(c: Context, esquema: z.ZodType<T>): Promise<T | undefined> {
  const corpo: unknown = await c.req.json().catch(() => undefined);
  const lido = esquema.safeParse(corpo);
  return lido.success ? lido.data : undefined;
}
