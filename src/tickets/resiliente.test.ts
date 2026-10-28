import { afterEach, describe, expect, it, vi } from "vitest";
import { valorDe } from "../testes/valor-de.js";
import {
  ana,
  chamadosIniciais,
  incidenteDoJoao,
  notebookLento,
  RASCUNHO_1,
  rascunhoConfirmadoDaAna,
  t1,
} from "./contrato/fixtures.js";
import { verificarContratoDoTicketClient } from "./contrato/index.js";
import { ticketClientEmMemoria, type FalhaSimulada, type Operacao } from "./em-memoria.js";
import { ticketClientResiliente } from "./resiliente.js";

const semEspera = { esperar: () => Promise.resolve(), aleatorio: () => 1 };

verificarContratoDoTicketClient("resiliente sobre a versão em memória", (inicial) =>
  ticketClientResiliente(ticketClientEmMemoria(inicial), undefined, semEspera),
);

function legado(roteiro: readonly (FalhaSimulada | undefined)[]) {
  const chamadas: Operacao[] = [];
  const base = ticketClientEmMemoria(
    { chamados: chamadosIniciais },
    {
      falhar: (operacao) => {
        chamadas.push(operacao);
        return roteiro[chamadas.length - 1];
      },
    },
  );
  return { base, chamadas };
}

const rascunho = () => rascunhoConfirmadoDaAna(RASCUNHO_1, notebookLento);

describe("TicketClient resiliente", () => {
  describe("quais falhas são repetidas", () => {
    it("o legado cai duas vezes antes de executar; a terceira tentativa dá certo", async () => {
      const { base, chamadas } = legado(["antes", "antes"]);
      const servico = ticketClientResiliente(base, undefined, semEspera);

      const resultado = await servico.criar(rascunho(), t1);

      expect(resultado).toMatchObject({ ok: true, valor: { dados: notebookLento } });
      expect(chamadas).toEqual(["criar", "criar", "criar"]);
    });

    it("o legado cai duas vezes depois de executar; o chamado não é duplicado", async () => {
      const { base } = legado(["depois", "depois"]);
      const servico = ticketClientResiliente(base, undefined, semEspera);

      const resultado = await servico.criar(rascunho(), t1);

      expect(resultado.ok).toBe(true);
      expect(valorDe(await servico.listar(ana))).toHaveLength(3);
    });

    it("um erro de regra volta na hora, sem nova tentativa", async () => {
      const { base, chamadas } = legado([]);
      const servico = ticketClientResiliente(base, undefined, semEspera);

      const resultado = await servico.obter(incidenteDoJoao.id, ana);

      expect(resultado).toEqual({
        ok: false,
        erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id },
      });
      expect(chamadas).toEqual(["obter"]);
    });

    it("depois da última tentativa, devolve a indisponibilidade", async () => {
      const { base, chamadas } = legado(["antes", "antes", "antes", "antes", "antes"]);
      const servico = ticketClientResiliente(base, undefined, semEspera);

      expect(await servico.listar(ana)).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
      expect(chamadas).toHaveLength(4);
    });

    it("a quantidade de tentativas pode ser configurada", async () => {
      const { base, chamadas } = legado(["antes", "antes", "antes"]);
      const servico = ticketClientResiliente(
        base,
        { tentativas: 2, esperaInicial: 200, fator: 2 },
        semEspera,
      );

      expect(await servico.listar(ana)).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
      expect(chamadas).toHaveLength(2);
    });
  });

  describe("quanto esperar entre as tentativas", () => {
    function esperasCom(aleatorio: number, roteiro: readonly (FalhaSimulada | undefined)[]) {
      const esperas: number[] = [];
      const { base } = legado(roteiro);
      const servico = ticketClientResiliente(base, undefined, {
        esperar: (milissegundos) => {
          esperas.push(milissegundos);
          return Promise.resolve();
        },
        aleatorio: () => aleatorio,
      });
      return { servico, esperas };
    }

    it("a espera dobra a cada tentativa: 200, 400 e 800 ms no máximo", async () => {
      const { servico, esperas } = esperasCom(1, ["antes", "antes", "antes", "antes"]);

      await servico.listar(ana);

      expect(esperas).toEqual([200, 400, 800]);
    });

    it("o sorteio nunca espera menos que a metade: 100, 200 e 400 ms no mínimo", async () => {
      const { servico, esperas } = esperasCom(0, ["antes", "antes", "antes", "antes"]);

      await servico.listar(ana);

      expect(esperas).toEqual([100, 200, 400]);
    });

    it("não espera quando dá certo de primeira", async () => {
      const { servico, esperas } = esperasCom(1, []);

      await servico.listar(ana);

      expect(esperas).toEqual([]);
    });
  });

  describe("com as dependências padrão", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("espera de verdade entre as tentativas", async () => {
      vi.useFakeTimers();
      const { base, chamadas } = legado(["antes"]);
      const servico = ticketClientResiliente(base);

      const resultado = servico.listar(ana);
      await vi.advanceTimersByTimeAsync(99);
      expect(chamadas).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(101);
      expect(chamadas).toHaveLength(2);
      expect((await resultado).ok).toBe(true);
    });
  });
});
