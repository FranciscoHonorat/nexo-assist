import { describe, expect, it } from "vitest";
import { criarDiretorio, type PessoaCadastrada } from "./diretorio.js";
import { protegerSenha } from "./senha.js";
import { ana, joao } from "../testes/usuarios.js";

async function cadastro(): Promise<PessoaCadastrada[]> {
  return [
    {
      email: "ana@nexo.com",
      nome: "Ana Souza",
      area: "Financeiro",
      papel: "funcionario",
      senha: await protegerSenha("senha-da-ana"),
    },
    {
      email: "bruno.n1@nexo.com",
      nome: "Bruno Tavares",
      area: "Suporte N1",
      papel: "analista",
      senha: await protegerSenha("senha-do-bruno"),
    },
  ];
}

describe("Diretório de pessoas: entrar com e-mail corporativo e senha", () => {
  it("Dado o e-mail e a senha certos, Então a pessoa entra com o papel e o nome, sem a senha", async () => {
    const diretorio = criarDiretorio(await cadastro());

    const entrou = await diretorio.autenticar({ email: " Ana@Nexo.com ", senha: "senha-da-ana" });

    expect(entrou).toEqual({
      ok: true,
      valor: { id: "ana@nexo.com", nome: "Ana Souza", area: "Financeiro", papel: "funcionario" },
    });
  });

  it.each([
    ["senha errada", { email: "ana@nexo.com", senha: "chute" }],
    ["e-mail que não existe", { email: "ninguem@nexo.com", senha: "senha-da-ana" }],
    ["e-mail de fora da Nexo", { email: "ana@gmail.com", senha: "senha-da-ana" }],
    ["e-mail inválido", { email: "ana", senha: "senha-da-ana" }],
  ])("Dado %s, Então o erro é o mesmo, para não revelar quem tem conta", async (_, credenciais) => {
    const diretorio = criarDiretorio(await cadastro());

    expect(await diretorio.autenticar(credenciais)).toEqual({
      ok: false,
      erro: { motivo: "credenciais_invalidas" },
    });
  });

  it("Dado um id de quem tem conta, Então o diretório devolve a pessoa; de quem não tem, nada", async () => {
    const diretorio = criarDiretorio(await cadastro());

    expect(diretorio.pessoa(ana)).toMatchObject({ nome: "Ana Souza" });
    expect(diretorio.pessoa(joao)).toBeUndefined();
  });
});
