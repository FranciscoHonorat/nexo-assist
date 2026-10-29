import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HORA } from "../domain/tempo.js";
import { lerUserId, type UserId } from "../domain/user-id.js";
import { PAPEIS, type Papel, type Pessoa } from "./diretorio.js";

export const DURACAO_DA_SESSAO = 8 * HORA;

export type Sessao = {
  readonly id: UserId;
  readonly papel: Papel;
  readonly expiraEm: Date;
};

type Chave = { readonly agora: Date; readonly segredo: string };

const conteudo = z.object({
  id: z.string().transform((email, contexto) => {
    const id = lerUserId(email);
    if (!id.ok) contexto.addIssue({ code: "custom", message: id.erro.motivo });
    return id.ok ? id.valor : z.NEVER;
  }),
  papel: z.enum(PAPEIS),
  expiraEm: z.number().transform((instante) => new Date(instante)),
});

export function emitirSessao(
  { id, papel }: Pick<Pessoa, "id" | "papel">,
  { agora, segredo }: Chave,
) {
  const carga = Buffer.from(
    JSON.stringify({ id, papel, expiraEm: agora.getTime() + DURACAO_DA_SESSAO }),
  ).toString("base64url");
  return `${carga}.${assinar(carga, segredo)}`;
}

export function lerSessao(token: string, { agora, segredo }: Chave): Sessao | undefined {
  const [carga, assinatura, ...sobra] = token.split(".");
  if (carga === undefined || assinatura === undefined || sobra.length > 0) return undefined;
  if (!mesmaAssinatura(assinatura, assinar(carga, segredo))) return undefined;
  const lida = conteudo.safeParse(lerJson(Buffer.from(carga, "base64url").toString("utf8")));
  if (!lida.success || lida.data.expiraEm <= agora) return undefined;
  return lida.data;
}

function assinar(carga: string, segredo: string): string {
  return createHmac("sha256", segredo).update(carga).digest("base64url");
}

function mesmaAssinatura(recebida: string, esperada: string): boolean {
  const [a, b] = [Buffer.from(recebida), Buffer.from(esperada)];
  return a.length === b.length && timingSafeEqual(a, b);
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}
