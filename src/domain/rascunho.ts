declare const confirmadoPeloFuncionario: unique symbol;

type CamposComuns = {
  readonly id: string;
  readonly criadoEm: Date;
};

type PorStatus = {
  pendente: CamposComuns & {
    readonly status: "pendente";
  };
  confirmado: CamposComuns & {
    readonly status: "confirmado";
    readonly confirmadoEm: Date;
    readonly [confirmadoPeloFuncionario]: true;
  };
  descartado: CamposComuns & {
    readonly status: "descartado";
    readonly descartadoEm: Date;
  };
};

export type StatusRascunho = keyof PorStatus;

export type Rascunho<S extends StatusRascunho> = PorStatus[S];

export function criarRascunho(id: string, agora: Date): Rascunho<"pendente"> {
  return Object.freeze({ id, status: "pendente", criadoEm: agora });
}

export function confirmar(rascunho: Rascunho<"pendente">, agora: Date): Rascunho<"confirmado"> {
  return aplicarMarca({ ...rascunho, status: "confirmado", confirmadoEm: agora });
}

export function descartar(rascunho: Rascunho<"pendente">, agora: Date): Rascunho<"descartado"> {
  return Object.freeze({ ...rascunho, status: "descartado", descartadoEm: agora });
}

type SemMarca = Omit<Rascunho<"confirmado">, typeof confirmadoPeloFuncionario>;

function aplicarMarca(confirmado: SemMarca): Rascunho<"confirmado"> {
  return Object.freeze(confirmado) as Rascunho<"confirmado">;
}
