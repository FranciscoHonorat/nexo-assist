import { describe, expect, it } from "vitest";
import { valorDe } from "../testes/valor-de.js";
import {
  ana,
  chamadosIniciais,
  complementoConfirmadoDaAna,
  incidenteDaAna,
  notebookLento,
  RASCUNHO_1,
  rascunhoConfirmadoDaAna,
  t1,
} from "./contrato/fixtures.js";
import { verificarContratoDoTicketClient } from "./contrato/index.js";
import { ticketClientEmMemoria, type FalhaSimulada, type Operacao } from "./em-memoria.js";

verificarContratoDoTicketClient("em memória", ticketClientEmMemoria);

const INDISPONIVEL = { ok: false, erro: { motivo: "indisponivel" } };

function falharUmaVez(operacao: Operacao, quando: FalhaSimulada) {
  let jaFalhou = false;
  return (chamada: Operacao): FalhaSimulada | undefined => {
    if (chamada !== operacao || jaFalhou) return undefined;
    jaFalhou = true;
    return quando;
  };
}

const servicoQueFalha = (operacao: Operacao, quando: FalhaSimulada) =>
  ticketClientEmMemoria({ chamados: chamadosIniciais }, { falhar: falharUmaVez(operacao, quando) });

describe("TicketClient em memória: legado fora do ar", () => {
  describe("falha antes de executar", () => {
    it.each<Operacao>(["listar", "obter", "criar", "complementar", "alterarStatus"])(
      "%s devolve indisponível",
      async (operacao) => {
        const servico = servicoQueFalha(operacao, "antes");
        const chamadas = {
          listar: () => servico.listar(ana),
          obter: () => servico.obter(incidenteDaAna.id, ana),
          criar: () => servico.criar(rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento), t1),
          complementar: () =>
            servico.complementar(
              complementoConfirmadoDaAna(RASCUNHO_1, incidenteDaAna.id, "x"),
              t1,
            ),
          alterarStatus: () =>
            servico.alterarStatus(
              incidenteDaAna.id,
              { de: "aberto", para: "resolvido", por: ana },
              t1,
            ),
        } satisfies Record<Operacao, () => Promise<unknown>>;

        expect(await chamadas[operacao]()).toEqual(INDISPONIVEL);
      },
    );

    it("não altera nada, e a nova tentativa executa de verdade", async () => {
      const servico = servicoQueFalha("criar", "antes");
      const rascunho = rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento);

      expect(await servico.criar(rascunho, t1)).toEqual(INDISPONIVEL);
      expect(valorDe(await servico.listar(ana))).toHaveLength(2);

      const novaTentativa = await servico.criar(rascunho, t1);
      expect(novaTentativa).toMatchObject({ ok: true, valor: { dados: notebookLento } });
      expect(valorDe(await servico.listar(ana))).toHaveLength(3);
    });
  });

  describe("falha depois de executar: a resposta se perdeu, mas a operação aconteceu", () => {
    it("criar: a nova tentativa devolve o mesmo chamado, sem duplicar", async () => {
      const servico = servicoQueFalha("criar", "depois");
      const rascunho = rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento);

      expect(await servico.criar(rascunho, t1)).toEqual(INDISPONIVEL);
      expect(valorDe(await servico.listar(ana))).toHaveLength(3);

      const novaTentativa = valorDe(await servico.criar(rascunho, t1));
      expect(valorDe(await servico.listar(ana))).toHaveLength(3);
      expect(valorDe(await servico.listar(ana))).toContainEqual(novaTentativa);
    });

    it("complementar: a nova tentativa não acrescenta o texto de novo", async () => {
      const servico = servicoQueFalha("complementar", "depois");
      const rascunho = complementoConfirmadoDaAna(RASCUNHO_1, incidenteDaAna.id, "mais detalhes");

      expect(await servico.complementar(rascunho, t1)).toEqual(INDISPONIVEL);
      expect(valorDe(await servico.obter(incidenteDaAna.id, ana)).complementos).toEqual([
        { texto: "mais detalhes", em: t1 },
      ]);

      const novaTentativa = valorDe(await servico.complementar(rascunho, t1));
      expect(novaTentativa.complementos).toEqual([{ texto: "mais detalhes", em: t1 }]);
    });

    it("alterarStatus: a nova tentativa encontra o status já no destino e devolve sucesso", async () => {
      const servico = servicoQueFalha("alterarStatus", "depois");
      const alteracao = { de: "aberto", para: "aguardando_analista", por: ana } as const;

      expect(await servico.alterarStatus(incidenteDaAna.id, alteracao, t1)).toEqual(INDISPONIVEL);
      expect(valorDe(await servico.obter(incidenteDaAna.id, ana)).status).toBe(
        "aguardando_analista",
      );

      expect(await servico.alterarStatus(incidenteDaAna.id, alteracao, t1)).toMatchObject({
        ok: true,
        valor: { status: "aguardando_analista" },
      });
    });
  });
});
