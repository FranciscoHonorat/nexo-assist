export type ErroDeInfraestrutura = {
  readonly motivo: "indisponivel";
};

export const INDISPONIVEL: ErroDeInfraestrutura = Object.freeze({ motivo: "indisponivel" });

export function ehIndisponivel(erro: { readonly motivo: string }): erro is ErroDeInfraestrutura {
  return erro.motivo === INDISPONIVEL.motivo;
}
