import { describe, expect, it } from "vitest";
import type { Chamado, DadosDoChamado } from "../domain/chamado.js";
import { lerRascunhoId } from "../domain/rascunho-id.js";
import { confirmar, criarRascunho } from "../domain/rascunho.js";
import { valorDe } from "../testes/valor-de.js";
import { lerTicketId, tipoDoChamado, type TicketId } from "../domain/ticket-id.js";
import { lerUserId, type UserId } from "../domain/user-id.js";
import type { EstadoInicial, TicketClient } from "./ticket-client.js";

const ana = valorDe(lerUserId("ana@nexo.com"));
const joao = valorDe(lerUserId("joao@nexo.com"));
const t0 = new Date("2026-10-22T10:00:00Z");
const t1 = new Date("2026-10-28T10:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const antesDeT1 = (milissegundos: number) => new Date(t1.getTime() - milissegundos);

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

const senhaDoSap = {
  titulo: "Senha do SAP bloqueada",
  descricao: "A senha do SAP bloqueou depois de três tentativas.",
  tipo: "incidente",
  categoria: "acesso",
  prioridade: "media",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

function existente(
  id: string,
  dono: UserId,
  dados: DadosDoChamado,
  situacao: Pick<Chamado, "status" | "atualizadoEm"> = { status: "aberto", atualizadoEm: t0 },
): Chamado {
  return { id: valorDe(lerTicketId(id)), dono, dados, criadoEm: t0, complementos: [], ...situacao };
}

const incidenteDaAna = existente("INC-20311", ana, notebookLento);
const requisicaoDaAna = existente("REQ-10442", ana, segundoMonitor);
const incidenteDoJoao = existente("INC-20150", joao, notebookLento);

function rascunhoConfirmadoDaAna(rascunhoId: string, dados: DadosDoChamado) {
  const pendente = valorDe(
    criarRascunho({
      id: valorDe(lerRascunhoId(rascunhoId)),
      dono: ana,
      conteudo: { tipo: "novo_chamado", dados },
      agora: t1,
    }),
  );
  return valorDe(confirmar(pendente, { por: ana, agora: t1 }));
}

function complementoConfirmadoDaAna(rascunhoId: string, chamado: TicketId, texto: string) {
  const pendente = valorDe(
    criarRascunho({
      id: valorDe(lerRascunhoId(rascunhoId)),
      dono: ana,
      conteudo: { tipo: "complemento", chamado, texto },
      agora: t1,
    }),
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
          complementos: [],
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
        const resolvido = resolvidoDaAna(7 * DIA + 60_000);
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
  });
}
