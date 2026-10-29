import { describe, expect, it } from "vitest";
import { assumir } from "../../domain/conversa.js";
import { lerUserId } from "../../domain/user-id.js";
import { colocarNaFila } from "../../testes/conversas.js";
import { ana, bruno } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import type { FabricaDeConversas } from "./index.js";

const pedidaEm = new Date("2026-10-28T13:00:00Z");
const assumidaEm = new Date("2026-10-28T13:05:00Z");
const carla = valorDe(lerUserId("carla.n1@nexo.com"));

export function cenariosDasTransicoes(fabricar: FabricaDeConversas): void {
  describe("transicionar", () => {
    it("Dado uma conversa transferida, Quando o funcionário volta, Então ela continua na fila", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);

      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(fila);
    });

    it("Dado uma conversa transferida e assumida, Quando o funcionário volta, Então ela continua com o analista", async () => {
      const conversas = await fabricar();
      const comBruno = assumir(await colocarNaFila(conversas, ana, pedidaEm), {
        analista: bruno,
        agora: assumidaEm,
      });
      valorDe(await conversas.transicionar(comBruno, "aguardando"));

      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(comBruno);
    });

    it("Dado dois analistas assumindo a mesma conversa, Então só o primeiro consegue", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);
      valorDe(
        await conversas.transicionar(
          assumir(fila, { analista: bruno, agora: assumidaEm }),
          "aguardando",
        ),
      );

      expect(
        await conversas.transicionar(
          assumir(fila, { analista: carla, agora: assumidaEm }),
          "aguardando",
        ),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.atual(ana)).conversa).toMatchObject({ analista: bruno });
    });
  });

  describe("registrarTurno condicional", () => {
    it("Dado que um analista assumiu durante o turno, Quando o agent tenta responder, Então a pergunta fica no histórico e a resposta não", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);
      valorDe(
        await conversas.transicionar(
          assumir(fila, { analista: bruno, agora: assumidaEm }),
          "aguardando",
        ),
      );

      expect(
        await conversas.registrarTurno(ana, {
          pergunta: "ainda está aí?",
          resposta: { texto: "Estou sim!", registro: { trace: [] } },
          agora: assumidaEm,
        }),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.historico(ana))).toEqual([
        { autor: "funcionario", texto: "ainda está aí?", enviadaEm: assumidaEm },
      ]);
    });
  });
}
