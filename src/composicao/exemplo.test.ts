import { describe, expect, it } from "vitest";
import { criarDiretorio } from "../acesso/diretorio.js";
import { podeSerAtualizado } from "../domain/chamado.js";
import { estaVencido } from "../domain/prazo.js";
import { chamadosDeExemplo, PESSOAS_DE_EXEMPLO, SENHA_DE_DEMONSTRACAO } from "./exemplo.js";

const agora = new Date("2026-10-29T15:00:00Z");

describe("Dados de exemplo (Anexo B)", () => {
  it("toda pessoa de exemplo entra com a senha de demonstração", async () => {
    const diretorio = criarDiretorio(PESSOAS_DE_EXEMPLO);

    const entradas = await Promise.all(
      PESSOAS_DE_EXEMPLO.map(({ email }) =>
        diretorio.autenticar({ email, senha: SENHA_DE_DEMONSTRACAO }),
      ),
    );

    expect(entradas.every((entrada) => entrada.ok)).toBe(true);
    expect(new Set(PESSOAS_DE_EXEMPLO.map(({ papel }) => papel))).toEqual(
      new Set(["funcionario", "analista"]),
    );
  });

  it("os chamados cobrem aberto, vencido, resolvido há poucos dias e chamados de outra pessoa", () => {
    const chamados = chamadosDeExemplo(agora);
    const diretorio = criarDiretorio(PESSOAS_DE_EXEMPLO);
    const vencido = (chamado: (typeof chamados)[number]) =>
      chamado.status !== "resolvido" &&
      estaVencido(chamado.dados.prioridade, chamado.atualizadoEm, agora);

    expect(chamados.some((chamado) => chamado.status === "aberto" && !vencido(chamado))).toBe(true);
    expect(chamados.some(vencido)).toBe(true);
    expect(
      chamados.some(
        (chamado) => chamado.status === "resolvido" && podeSerAtualizado(chamado, agora),
      ),
    ).toBe(true);
    expect(new Set(chamados.map(({ dono }) => dono)).size).toBeGreaterThan(1);
    expect(chamados.every(({ dono }) => diretorio.pessoa(dono)?.papel === "funcionario")).toBe(
      true,
    );
  });
});
