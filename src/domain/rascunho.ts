import { lerDadosDoChamado, type DadosDoChamado, type ErroDeDados } from "./chamado.js";
import type { RascunhoId } from "./rascunho-id.js";
import { falha, sucesso, type Resultado } from "./resultado.js";
import type { TicketId } from "./ticket-id.js";
import type { UserId } from "./user-id.js";

declare const confirmadoPeloFuncionario: unique symbol;

export type NovoChamado = {
  readonly tipo: "novo_chamado";
  readonly dados: DadosDoChamado;
};

export type Complemento = {
  readonly tipo: "complemento";
  readonly chamado: TicketId;
  readonly texto: string;
};

export type ConteudoDoRascunho = NovoChamado | Complemento;

type ConteudoDoTipo<T extends ConteudoDoRascunho["tipo"]> = Extract<
  ConteudoDoRascunho,
  { readonly tipo: T }
>;

type CamposComuns<C extends ConteudoDoRascunho> = {
  readonly id: RascunhoId;
  readonly dono: UserId;
  readonly conteudo: C;
  readonly criadoEm: Date;
};

type PorStatus<C extends ConteudoDoRascunho> = {
  pendente: CamposComuns<C> & {
    readonly status: "pendente";
  };
  confirmado: CamposComuns<C> & {
    readonly status: "confirmado";
    readonly confirmadoEm: Date;
    readonly [confirmadoPeloFuncionario]: true;
  };
  descartado: CamposComuns<C> & {
    readonly status: "descartado";
    readonly descartadoEm: Date;
  };
};

export type StatusRascunho = keyof PorStatus<ConteudoDoRascunho>;

export type Rascunho<
  S extends StatusRascunho,
  C extends ConteudoDoRascunho = ConteudoDoRascunho,
> = PorStatus<C>[S];

export type ErroDeTransicao = {
  readonly motivo: "nao_e_o_dono";
  readonly rascunhoId: RascunhoId;
  readonly tentouPor: UserId;
};

type ErroDeComplemento = {
  readonly motivo: "campo_vazio";
  readonly campo: "texto";
};

export type ErroDeConteudo = ErroDeDados | ErroDeComplemento;

type Autoria = {
  readonly por: UserId;
  readonly agora: Date;
};

type NovoRascunho<C extends ConteudoDoRascunho> = {
  readonly id: RascunhoId;
  readonly dono: UserId;
  readonly conteudo: C;
  readonly agora: Date;
};

export function criarRascunho<C extends ConteudoDoRascunho>(
  novo: NovoRascunho<C>,
): Resultado<Rascunho<"pendente", ConteudoDoTipo<C["tipo"]>>, ErroDeConteudo> {
  const conteudo = lerConteudo(novo.conteudo);
  if (!conteudo.ok) return conteudo;
  return sucesso(
    Object.freeze({
      id: novo.id,
      dono: novo.dono,
      conteudo: conteudo.valor,
      status: "pendente",
      criadoEm: novo.agora,
    }),
  );
}

export function confirmar<C extends ConteudoDoRascunho>(
  rascunho: Rascunho<"pendente", C>,
  { por, agora }: Autoria,
): Resultado<Rascunho<"confirmado", C>, ErroDeTransicao> {
  return somenteODono(rascunho, por, () =>
    aplicarMarca({ ...rascunho, status: "confirmado", confirmadoEm: agora }),
  );
}

export function descartar<C extends ConteudoDoRascunho>(
  rascunho: Rascunho<"pendente", C>,
  { por, agora }: Autoria,
): Resultado<Rascunho<"descartado", C>, ErroDeTransicao> {
  return somenteODono(rascunho, por, () =>
    Object.freeze({ ...rascunho, status: "descartado", descartadoEm: agora }),
  );
}

function lerConteudo<C extends ConteudoDoRascunho>(
  conteudo: C,
): Resultado<ConteudoDoTipo<C["tipo"]>, ErroDeConteudo> {
  return lerPorTipo(conteudo) as Resultado<ConteudoDoTipo<C["tipo"]>, ErroDeConteudo>;
}

function lerPorTipo(conteudo: ConteudoDoRascunho): Resultado<ConteudoDoRascunho, ErroDeConteudo> {
  switch (conteudo.tipo) {
    case "novo_chamado":
      return lerNovoChamado(conteudo);
    case "complemento":
      return lerComplemento(conteudo);
  }
}

function lerNovoChamado(conteudo: NovoChamado): Resultado<NovoChamado, ErroDeDados> {
  const dados = lerDadosDoChamado(conteudo.dados);
  if (!dados.ok) return dados;
  return sucesso(Object.freeze({ tipo: conteudo.tipo, dados: dados.valor }));
}

function lerComplemento(conteudo: Complemento): Resultado<Complemento, ErroDeComplemento> {
  const texto = conteudo.texto.trim();
  if (texto === "") return falha({ motivo: "campo_vazio", campo: "texto" });
  return sucesso(Object.freeze({ ...conteudo, texto }));
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

type SemMarca<C extends ConteudoDoRascunho> = Omit<
  Rascunho<"confirmado", C>,
  typeof confirmadoPeloFuncionario
>;

function aplicarMarca<C extends ConteudoDoRascunho>(
  confirmado: SemMarca<C>,
): Rascunho<"confirmado", C> {
  return Object.freeze(confirmado) as Rascunho<"confirmado", C>;
}
