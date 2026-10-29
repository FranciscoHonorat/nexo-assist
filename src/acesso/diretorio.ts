import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import { lerUserId, type UserId } from "../domain/user-id.js";
import { randomUUID } from "node:crypto";
import { conferirSenha, protegerSenha } from "./senha.js";

export const PAPEIS = ["funcionario", "analista"] as const;

export type Papel = (typeof PAPEIS)[number];

export type Pessoa = {
  readonly id: UserId;
  readonly nome: string;
  readonly area: string;
  readonly papel: Papel;
};

export type PessoaCadastrada = Omit<Pessoa, "id"> & {
  readonly email: string;
  readonly senha: string;
};

export type Credenciais = { readonly email: string; readonly senha: string };

export type ErroDeAcesso = { readonly motivo: "credenciais_invalidas" };

export type Diretorio = {
  readonly autenticar: (credenciais: Credenciais) => Promise<Resultado<Pessoa, ErroDeAcesso>>;
  readonly pessoa: (id: UserId) => Pessoa | undefined;
};

export function criarDiretorio(cadastro: readonly PessoaCadastrada[]): Diretorio {
  const senhaDeQuemNaoExiste = protegerSenha(randomUUID());
  const porId = new Map(
    cadastro.map(({ email, senha, ...pessoa }) => {
      const id = lerUserId(email);
      if (!id.ok) throw new Error(`cadastro com e-mail inválido: ${email}`);
      return [id.valor, { pessoa: { id: id.valor, ...pessoa }, senha }] as const;
    }),
  );
  return {
    autenticar: async ({ email, senha }) => {
      const id = lerUserId(email);
      const cadastrada = id.ok ? porId.get(id.valor) : undefined;
      const guardada = cadastrada?.senha ?? (await senhaDeQuemNaoExiste);
      const confere = await conferirSenha(senha, guardada);
      return cadastrada !== undefined && confere
        ? sucesso(cadastrada.pessoa)
        : falha({ motivo: "credenciais_invalidas" });
    },
    pessoa: (id) => porId.get(id)?.pessoa,
  };
}
