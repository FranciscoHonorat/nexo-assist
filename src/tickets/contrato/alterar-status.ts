import { describe, expect, it } from "vitest";
import { valorDe } from "../../testes/valor-de.js";
import { lerTicketId } from "../../domain/ticket-id.js";
import { MINUTO } from "../../domain/tempo.js";
import {
  ana,
  chamadosIniciais,
  existente,
  incidenteDaAna,
  incidenteDoJoao,
  joao,
  notebookLento,
  t0,
  t1,
  type Fabrica,
} from "./fixtures.js";

export function cenariosDeAlteracaoDeStatus(fabricar: Fabrica): void {
  const comChamados = () => fabricar({ chamados: chamadosIniciais });

  describe("alterarStatus", () => {
    it("muda o status quando ele ainda é o esperado e renova a última atualização", async () => {
      const servico = await comChamados();

      const resultado = await servico.alterarStatus(
        incidenteDaAna.id,
        { de: "aberto", para: "aguardando_analista", por: ana },
        t1,
      );

      const esperado = { ...incidenteDaAna, status: "aguardando_analista", atualizadoEm: t1 };
      expect(resultado).toEqual({ ok: true, valor: esperado });
      expect(await servico.obter(incidenteDaAna.id, ana)).toEqual({ ok: true, valor: esperado });
    });

    it("se outra pessoa mudou o status no meio do caminho, recusa e informa o status atual", async () => {
      const aguardando = existente("INC-20170", ana, notebookLento, {
        status: "aguardando_analista",
        atualizadoEm: t0,
      });
      const servico = await fabricar({ chamados: [aguardando] });

      const resultado = await servico.alterarStatus(
        aguardando.id,
        { de: "aberto", para: "resolvido", por: ana },
        t1,
      );

      expect(resultado).toEqual({
        ok: false,
        erro: {
          motivo: "status_mudou",
          id: aguardando.id,
          esperado: "aberto",
          atual: "aguardando_analista",
        },
      });
      expect(await servico.obter(aguardando.id, ana)).toEqual({ ok: true, valor: aguardando });
    });

    it("repetir uma mudança que já foi aplicada devolve sucesso sem alterar nada", async () => {
      const servico = await comChamados();
      const transicao = { de: "aberto", para: "aguardando_analista", por: ana } as const;

      const primeira = await servico.alterarStatus(incidenteDaAna.id, transicao, t1);
      const repetida = await servico.alterarStatus(
        incidenteDaAna.id,
        transicao,
        new Date(t1.getTime() + MINUTO),
      );

      expect(repetida).toEqual(primeira);
    });

    it("o chamado de outra pessoa é tratado como inexistente e não é alterado", async () => {
      const servico = await comChamados();

      const resultado = await servico.alterarStatus(
        incidenteDoJoao.id,
        { de: "aberto", para: "resolvido", por: ana },
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
        await (
          await comChamados()
        ).alterarStatus(inexistente, { de: "aberto", para: "resolvido", por: ana }, t1),
      ).toEqual({ ok: false, erro: { motivo: "nao_encontrado", id: inexistente } });
    });
  });
}
