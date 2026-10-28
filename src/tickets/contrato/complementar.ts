import { describe, expect, it } from "vitest";
import { valorDe } from "../../testes/valor-de.js";
import { lerTicketId } from "../../domain/ticket-id.js";
import { DIA, MINUTO } from "../../domain/tempo.js";
import {
  RASCUNHO_1,
  ana,
  antesDeT1,
  chamadosIniciais,
  complementoConfirmadoDaAna,
  existente,
  incidenteDaAna,
  incidenteDoJoao,
  joao,
  notebookLento,
  senhaDoSap,
  t0,
  t1,
  type Fabrica,
} from "./fixtures.js";

export function cenariosDeComplemento(fabricar: Fabrica): void {
  const comChamados = () => fabricar({ chamados: chamadosIniciais });

  describe("complementar", () => {
    const texto = "Agora também está travando ao abrir o Teams.";
    const resolvidoDaAna = (resolvidoHa: number) =>
      existente("INC-20160", ana, senhaDoSap, {
        status: "resolvido",
        atualizadoEm: antesDeT1(resolvidoHa),
      });

    it("acrescenta o texto, renova a última atualização e mantém o status", async () => {
      const servico = comChamados();

      const resultado = await servico.complementar(
        complementoConfirmadoDaAna(RASCUNHO_1, incidenteDaAna.id, texto),
        t1,
      );

      const esperado = { ...incidenteDaAna, atualizadoEm: t1, complementos: [{ texto, em: t1 }] };
      expect(resultado).toEqual({ ok: true, valor: esperado });
      expect(await servico.obter(incidenteDaAna.id, ana)).toEqual({ ok: true, valor: esperado });
    });

    it("um chamado aguardando analista continua aguardando", async () => {
      const aguardando = existente("INC-20170", ana, notebookLento, {
        status: "aguardando_analista",
        atualizadoEm: t0,
      });

      const resultado = await fabricar({ chamados: [aguardando] }).complementar(
        complementoConfirmadoDaAna(RASCUNHO_1, aguardando.id, texto),
        t1,
      );

      expect(resultado).toMatchObject({ ok: true, valor: { status: "aguardando_analista" } });
    });

    it.each([
      ["há 3 dias", 3 * DIA],
      ["há exatamente 7 dias", 7 * DIA],
    ])("um chamado resolvido %s é reaberto", async (_, resolvidoHa) => {
      const resolvido = resolvidoDaAna(resolvidoHa);

      const resultado = await fabricar({ chamados: [resolvido] }).complementar(
        complementoConfirmadoDaAna(RASCUNHO_1, resolvido.id, texto),
        t1,
      );

      expect(resultado).toEqual({
        ok: true,
        valor: {
          ...resolvido,
          status: "aberto",
          atualizadoEm: t1,
          complementos: [{ texto, em: t1 }],
        },
      });
    });

    it("um chamado resolvido há mais de 7 dias não é reaberto nem alterado", async () => {
      const resolvido = resolvidoDaAna(7 * DIA + MINUTO);
      const servico = fabricar({ chamados: [resolvido] });

      const resultado = await servico.complementar(
        complementoConfirmadoDaAna(RASCUNHO_1, resolvido.id, texto),
        t1,
      );

      expect(resultado).toEqual({
        ok: false,
        erro: { motivo: "resolvido_ha_mais_de_7_dias", id: resolvido.id },
      });
      expect(await servico.obter(resolvido.id, ana)).toEqual({ ok: true, valor: resolvido });
    });

    it("repetir o mesmo complemento não o duplica", async () => {
      const servico = comChamados();
      const rascunho = complementoConfirmadoDaAna(RASCUNHO_1, incidenteDaAna.id, texto);

      const primeiro = await servico.complementar(rascunho, t1);
      const repetido = await servico.complementar(rascunho, t1);

      expect(repetido).toEqual(primeiro);
      expect(await servico.obter(incidenteDaAna.id, ana)).toMatchObject({
        valor: { complementos: [{ texto, em: t1 }] },
      });
    });

    it("o chamado de outra pessoa é tratado como inexistente e não é alterado", async () => {
      const servico = comChamados();

      const resultado = await servico.complementar(
        complementoConfirmadoDaAna(RASCUNHO_1, incidenteDoJoao.id, texto),
        t1,
      );

      expect(resultado).toEqual({
        ok: false,
        erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id },
      });
      expect(await servico.obter(incidenteDoJoao.id, joao)).toEqual({
        ok: true,
        valor: incidenteDoJoao,
      });
    });

    it("um chamado que não existe devolve o mesmo erro", async () => {
      const inexistente = valorDe(lerTicketId("INC-99999"));

      expect(
        await comChamados().complementar(
          complementoConfirmadoDaAna(RASCUNHO_1, inexistente, texto),
          t1,
        ),
      ).toEqual({ ok: false, erro: { motivo: "nao_encontrado", id: inexistente } });
    });
  });
}
