import { describe, expect, it } from "vitest";
import { ana, joao } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import type { FabricaDeConversas } from "./index.js";
import { DESDE_O_COMECO } from "../conversas.js";

const agora = new Date("2026-10-28T13:00:00Z");

export function cenariosDoHistorico(fabricar: FabricaDeConversas): void {
  describe("historico a partir de um cursor", () => {
    it("Dado três mensagens, Quando o histórico é pedido depois da primeira, Então vêm só as duas seguintes, e os ids crescem na ordem de entrada", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      for (const texto of ["primeira", "segunda", "terceira"]) {
        valorDe(await conversas.registrarMensagem(ana, { texto, agora }));
      }
      const ids = valorDe(await conversas.historico(ana, DESDE_O_COMECO)).map(({ id }) => id);

      const depois = valorDe(await conversas.historico(ana, ids[0] ?? DESDE_O_COMECO));

      expect(depois).toMatchObject([{ texto: "segunda" }, { texto: "terceira" }]);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toEqual(ids.toSorted((a, b) => a - b));
    });

    it("Dado mensagens da Ana e do João, Quando a Ana pede o histórico, Então só vêm as dela", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      valorDe(await conversas.atual(joao));
      valorDe(await conversas.registrarMensagem(joao, { texto: "minha senha é…", agora }));
      valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora }));

      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toMatchObject([
        { texto: "oi" },
      ]);
    });
  });
}
