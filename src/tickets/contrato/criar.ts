import { describe, expect, it } from "vitest";
import { valorDe } from "../../testes/valor-de.js";
import { tipoDoChamado } from "../../domain/ticket-id.js";
import {
  RASCUNHO_1,
  RASCUNHO_2,
  ana,
  chamadosIniciais,
  notebookLento,
  rascunhoConfirmadoDaAna,
  segundoMonitor,
  t1,
  type Fabrica,
} from "./fixtures.js";

export function cenariosDeCriacao(fabricar: Fabrica): void {
  const comChamados = () => fabricar({ chamados: chamadosIniciais });

  describe("criar", () => {
    it("cria um chamado aberto com os dados confirmados e o dono do rascunho", async () => {
      const chamado = valorDe(
        await comChamados().criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1),
      );

      expect(chamado).toMatchObject({
        dono: ana,
        dados: notebookLento,
        status: "aberto",
        criadoEm: t1,
        atualizadoEm: t1,
        complementos: [],
      });
    });

    it.each([
      ["incidente", notebookLento],
      ["requisicao", segundoMonitor],
    ] as const)("o prefixo do id combina com o tipo (%s)", async (tipo, dados) => {
      const chamado = valorDe(
        await comChamados().criar(rascunhoConfirmadoDaAna(RASCUNHO_1, dados), t1),
      );

      expect(tipoDoChamado(chamado.id)).toBe(tipo);
    });

    it("o chamado criado aparece na lista do dono", async () => {
      const servico = comChamados();
      const chamado = valorDe(
        await servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1),
      );

      expect(valorDe(await servico.listar(ana))).toContainEqual(chamado);
    });

    it("repetir a criação com o mesmo rascunho devolve o mesmo chamado, sem duplicar", async () => {
      const servico = comChamados();
      const rascunho = rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento);

      const primeiro = valorDe(await servico.criar(rascunho, t1));
      const repetido = valorDe(await servico.criar(rascunho, t1));

      expect(repetido).toEqual(primeiro);
      expect(valorDe(await servico.listar(ana))).toHaveLength(3);
    });

    it("rascunhos diferentes viram chamados diferentes", async () => {
      const servico = comChamados();

      const primeiro = valorDe(
        await servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1),
      );
      const segundo = valorDe(
        await servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_2, notebookLento), t1),
      );

      expect(segundo.id).not.toBe(primeiro.id);
      expect(valorDe(await servico.listar(ana))).toHaveLength(4);
    });
  });
}
