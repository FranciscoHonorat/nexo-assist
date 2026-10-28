import { lerDadosDoChamado, type DadosDoChamado, type ErroDeConteudo } from "./chamado.js";
import type { RascunhoId } from "./rascunho-id.js";
import { falha, sucesso, type Resultado } from "./resultado.js";
import type { UserId } from "./user-id.js";

declare const confirmadoPeloFuncionario: unique symbol;

type CamposComuns = {
  readonly id: RascunhoId;
  readonly dono: UserId;
  readonly dados: DadosDoChamado;
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

export type ErroDeTransicao = {
  readonly motivo: "nao_e_o_dono";
  readonly rascunhoId: RascunhoId;
  readonly tentouPor: UserId;
};

export type { ErroDeConteudo };

type Autoria = {
  readonly por: UserId;
  readonly agora: Date;
};

type NovoRascunho = {
  readonly id: RascunhoId;
  readonly dono: UserId;
  readonly dados: DadosDoChamado;
  readonly agora: Date;
};

export function criarRascunho(novo: NovoRascunho): Resultado<Rascunho<"pendente">, ErroDeConteudo> {
  const dados = lerDadosDoChamado(novo.dados);
  if (!dados.ok) return dados;
  return sucesso(
    Object.freeze({
      id: novo.id,
      dono: novo.dono,
      dados: dados.valor,
      status: "pendente",
      criadoEm: novo.agora,
    }),
  );
}

export function confirmar(
  rascunho: Rascunho<"pendente">,
  { por, agora }: Autoria,
): Resultado<Rascunho<"confirmado">, ErroDeTransicao> {
  return somenteODono(rascunho, por, () =>
    aplicarMarca({ ...rascunho, status: "confirmado", confirmadoEm: agora }),
  );
}

export function descartar(
  rascunho: Rascunho<"pendente">,
  { por, agora }: Autoria,
): Resultado<Rascunho<"descartado">, ErroDeTransicao> {
  return somenteODono(rascunho, por, () =>
    Object.freeze({ ...rascunho, status: "descartado", descartadoEm: agora }),
  );
}

function somenteODono<T>(
  rascunho: Rascunho<"pendente">,
  por: UserId,
  transicionar: () => T,
): Resultado<T, ErroDeTransicao> {
  if (por !== rascunho.dono)
    return falha({ motivo: "nao_e_o_dono", rascunhoId: rascunho.id, tentouPor: por });
  return sucesso(transicionar());
}

type SemMarca = Omit<Rascunho<"confirmado">, typeof confirmadoPeloFuncionario>;

function aplicarMarca(confirmado: SemMarca): Rascunho<"confirmado"> {
  return Object.freeze(confirmado) as Rascunho<"confirmado">;
}
