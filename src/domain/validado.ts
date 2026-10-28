declare const lidoEValidado: unique symbol;

export type Validado<T, Nome extends string> = T & { readonly [lidoEValidado]: Nome };

export type ErroDeLeitura<Motivo extends string> = {
  readonly motivo: Motivo;
  readonly recebido: string;
};
