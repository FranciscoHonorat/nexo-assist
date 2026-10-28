import { falha, sucesso, type Resultado } from "./resultado.js";
import type { ErroDeLeitura, Validado } from "./validado.js";

const DOMINIO_CORPORATIVO = "nexo.com";

export type UserId = Validado<`${string}@${typeof DOMINIO_CORPORATIVO}`, "UserId">;

export type ErroUserId = ErroDeLeitura<"email_invalido" | "dominio_externo">;

const FORMATO_DE_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function lerUserId(email: string): Resultado<UserId, ErroUserId> {
  const normalizado = email.trim().toLowerCase();
  if (!FORMATO_DE_EMAIL.test(normalizado))
    return falha({ motivo: "email_invalido", recebido: email });
  if (!normalizado.endsWith(`@${DOMINIO_CORPORATIVO}`))
    return falha({ motivo: "dominio_externo", recebido: email });
  return sucesso(normalizado as UserId);
}
