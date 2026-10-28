import { describe, expect, it } from "vitest";
import type { Chamado, DadosDoChamado } from "../domain/chamado.js";
import { lerRascunhoId } from "../domain/rascunho-id.js";
import { confirmar, criarRascunho } from "../domain/rascunho.js";
import { valorDe } from "../testes/valor-de.js";
import { lerTicketId, tipoDoChamado } from "../domain/ticket-id.js";
import { lerUserId, type UserId } from "../domain/user-id.js";
import type { EstadoInicial, TicketClient } from "./ticket-client.js";

const ana = valorDe(lerUserId("ana@nexo.com"));
const joao = valorDe(lerUserId("joao@nexo.com"));
const t0 = new Date("2026-10-22T10:00:00Z");
const t1 = new Date("2026-10-28T10:00:00Z");

const notebookLento = {
  titulo: "Notebook lento após atualização do Windows",
  descricao: "Demora 10 minutos para ligar desde a última atualização.",
  tipo: "incidente",
  categoria: "hardware",
  prioridade: "media",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

const segundoMonitor = {
  titulo: "Segundo monitor para home office",
  descricao: "Preciso de um segundo monitor para trabalhar de casa.",
  tipo: "requisicao",
  categoria: "hardware",
  prioridade: "baixa",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

function existente(id: string, dono: UserId, dados: DadosDoChamado): Chamado {
  return {
    id: valorDe(lerTicketId(id)),
    dono,
    dados,
    status: "aberto",
    criadoEm: t0,
    atualizadoEm: t0,
  };
}

const incidenteDaAna = existente("INC-20311", ana, notebookLento);
const requisicaoDaAna = existente("REQ-10442", ana, segundoMonitor);
const incidenteDoJoao = existente("INC-20150", joao, notebookLento);

function rascunhoConfirmadoDaAna(rascunhoId: string, dados: DadosDoChamado) {
  const pendente = valorDe(
    criarRascunho({ id: valorDe(lerRascunhoId(rascunhoId)), dono: ana, dados, agora: t1 }),
  );
  return valorDe(confirmar(pendente, { por: ana, agora: t1 }));
}

const RASCUNHO_1 = "rsc_0f8fad5b-d9cb-469f-a165-70867728950e";
const RASCUNHO_2 = "rsc_7c9e6679-7425-40de-944b-e07fc1f90ae7";

export function verificarContratoDoTicketClient(
  implementacao: string,
  fabricar: (inicial: EstadoInicial) => TicketClient,
): void {
  const comChamados = () =>
    fabricar({ chamados: [incidenteDaAna, requisicaoDaAna, incidenteDoJoao] });

  describe(`TicketClient (${implementacao}): contrato`, () => {
    describe("listar", () => {
      it("devolve só os chamados do dono", async () => {
        const chamados = await comChamados().listar(ana);

        expect(chamados).toHaveLength(2);
        expect(chamados).toEqual(expect.arrayContaining([incidenteDaAna, requisicaoDaAna]));
      });

      it("devolve lista vazia para quem não tem chamados", async () => {
        expect(await fabricar({ chamados: [] }).listar(ana)).toEqual([]);
      });
    });

    describe("obter", () => {
      it("o dono obtém o próprio chamado", async () => {
        expect(await comChamados().obter(incidenteDaAna.id, ana)).toEqual({
          ok: true,
          valor: incidenteDaAna,
        });
      });

      it("o chamado de outra pessoa é tratado como inexistente, sem revelar que existe", async () => {
        expect(await comChamados().obter(incidenteDoJoao.id, ana)).toEqual({
          ok: false,
          erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id },
        });
      });

      it("um id que não existe devolve o mesmo erro", async () => {
        const inexistente = valorDe(lerTicketId("INC-99999"));

        expect(await comChamados().obter(inexistente, ana)).toEqual({
          ok: false,
          erro: { motivo: "nao_encontrado", id: inexistente },
        });
      });
    });

    describe("criar", () => {
      it("cria um chamado aberto com os dados confirmados e o dono do rascunho", async () => {
        const chamado = await comChamados().criar(
          rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento),
          t1,
        );

        expect(chamado).toMatchObject({
          dono: ana,
          dados: notebookLento,
          status: "aberto",
          criadoEm: t1,
          atualizadoEm: t1,
        });
      });

      it.each([
        ["incidente", notebookLento],
        ["requisicao", segundoMonitor],
      ] as const)("o prefixo do id combina com o tipo (%s)", async (tipo, dados) => {
        const chamado = await comChamados().criar(rascunhoConfirmadoDaAna(RASCUNHO_1, dados), t1);

        expect(tipoDoChamado(chamado.id)).toBe(tipo);
      });

      it("o chamado criado aparece na lista do dono", async () => {
        const servico = comChamados();
        const chamado = await servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1);

        expect(await servico.listar(ana)).toContainEqual(chamado);
      });

      it("repetir a criação com o mesmo rascunho devolve o mesmo chamado, sem duplicar", async () => {
        const servico = comChamados();
        const rascunho = rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento);

        const primeiro = await servico.criar(rascunho, t1);
        const repetido = await servico.criar(rascunho, t1);

        expect(repetido).toEqual(primeiro);
        expect(await servico.listar(ana)).toHaveLength(3);
      });

      it("rascunhos diferentes viram chamados diferentes", async () => {
        const servico = comChamados();

        const primeiro = await servico.criar(
          rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento),
          t1,
        );
        const segundo = await servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_2, notebookLento), t1);

        expect(segundo.id).not.toBe(primeiro.id);
        expect(await servico.listar(ana)).toHaveLength(4);
      });
    });
  });
}
