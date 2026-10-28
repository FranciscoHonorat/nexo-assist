import { falha, sucesso, type Resultado } from "./resultado.js";

declare const lidoEValidado: unique symbol;

export type Validado<T, Nome extends string> = T & { readonly [lidoEValidado]: Nome };

export type ErroDeLeitura<Motivo extends string> = {
  readonly motivo: Motivo;
  readonly recebido: string;
};

export type RegraDeFormato = {
  readonly formato: RegExp;
  readonly normalizar: (texto: string) => string;
};

export function lerNoFormato<Id extends Validado<string, string>>(
  texto: string,
  regra: RegraDeFormato,
): Resultado<Id, ErroDeLeitura<"formato_invalido">> {
  const normalizado = regra.normalizar(texto);
  if (!regra.formato.test(normalizado))
    return falha({ motivo: "formato_invalido", recebido: texto });
  return sucesso(normalizado as Id);
}
