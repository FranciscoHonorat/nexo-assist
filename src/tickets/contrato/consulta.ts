import { describe, expect, it } from "vitest";
import { valorDe } from "../../testes/valor-de.js";
import { lerTicketId } from "../../domain/ticket-id.js";
import {
  chamadosIniciais,
  incidenteDaAna,
  incidenteDoJoao,
  requisicaoDaAna,
  type Fabrica,
} from "./fixtures.js";
import { ana } from "../../testes/usuarios.js";

export function cenariosDeConsulta(fabricar: Fabrica): void {
  const comChamados = () => fabricar({ chamados: chamadosIniciais });

  describe("listar", () => {
    it("devolve só os chamados do dono", async () => {
      const chamados = valorDe(await (await comChamados()).listar(ana));

      expect(chamados).toHaveLength(2);
      expect(chamados).toEqual(expect.arrayContaining([incidenteDaAna, requisicaoDaAna]));
    });

    it("devolve lista vazia para quem não tem chamados", async () => {
      expect(valorDe(await (await fabricar({ chamados: [] })).listar(ana))).toEqual([]);
    });
  });

  describe("obter", () => {
    it("o dono obtém o próprio chamado", async () => {
      expect(await (await comChamados()).obter(incidenteDaAna.id, ana)).toEqual({
        ok: true,
        valor: incidenteDaAna,
      });
    });

    it("o chamado de outra pessoa é tratado como inexistente, sem revelar que existe", async () => {
      expect(await (await comChamados()).obter(incidenteDoJoao.id, ana)).toEqual({
        ok: false,
        erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id },
      });
    });

    it("um id que não existe devolve o mesmo erro", async () => {
      const inexistente = valorDe(lerTicketId("INC-99999"));

      expect(await (await comChamados()).obter(inexistente, ana)).toEqual({
        ok: false,
        erro: { motivo: "nao_encontrado", id: inexistente },
      });
    });
  });
}
