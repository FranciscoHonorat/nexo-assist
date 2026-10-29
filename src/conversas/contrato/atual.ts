import { describe, expect, it } from "vitest";
import { valorDe } from "../../testes/valor-de.js";
import { ana } from "../../testes/usuarios.js";
import type { FabricaDeConversas } from "./index.js";

export function cenariosDaConversaAtual(fabricar: FabricaDeConversas): void {
  describe("atual", () => {
    it("Dado um funcionário sem conversa, Quando ele chega, Então começa uma conversa com o agent, sem mensagens na sessão", async () => {
      const conversas = await fabricar();

      expect(valorDe(await conversas.atual(ana))).toEqual({
        conversa: { dono: ana, controle: "agent" },
        mensagensNaSessao: 0,
      });
    });
  });
}
