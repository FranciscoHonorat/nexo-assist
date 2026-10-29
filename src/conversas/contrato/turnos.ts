import { describe, expect, it } from "vitest";
import { ana } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import type { FabricaDeConversas } from "./index.js";

const agora = new Date("2026-10-28T13:00:00Z");

export function cenariosDosTurnos(fabricar: FabricaDeConversas): void {
  describe("registrarTurno", () => {
    it("Dado uma conversa com o agent, Quando um turno é registrado, Então a pergunta e a resposta entram no histórico, na ordem, e a sessão conta uma mensagem", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));

      valorDe(
        await conversas.registrarTurno(ana, {
          pergunta: "meu notebook está lento",
          resposta: { texto: "Vou abrir um chamado.", registro: { confianca: "alta", trace: [] } },
          agora,
        }),
      );

      expect(valorDe(await conversas.historico(ana))).toEqual([
        { autor: "funcionario", texto: "meu notebook está lento", enviadaEm: agora },
        {
          autor: "agent",
          texto: "Vou abrir um chamado.",
          enviadaEm: agora,
          registro: { confianca: "alta", trace: [] },
        },
      ]);
      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(1);
    });
  });

  describe("registrarMensagem", () => {
    it("Dado uma conversa, Quando só o funcionário fala, Então a mensagem entra no histórico e conta na sessão", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));

      valorDe(await conversas.registrarMensagem(ana, { texto: "alguém aí?", agora }));

      expect(valorDe(await conversas.historico(ana))).toEqual([
        { autor: "funcionario", texto: "alguém aí?", enviadaEm: agora },
      ]);
      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(1);
    });
  });
}
