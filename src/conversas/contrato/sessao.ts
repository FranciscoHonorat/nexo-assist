import { describe, expect, it } from "vitest";
import { colocarNaFila, semIds } from "../../testes/conversas.js";
import { ana } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import { DESDE_O_COMECO } from "../conversas.js";
import type { FabricaDeConversas } from "./index.js";

const antes = new Date("2026-10-28T13:00:00Z");
const novaEm = new Date("2026-10-28T14:00:00Z");

export function cenariosDaSessao(fabricar: FabricaDeConversas): void {
  describe("iniciarSessao", () => {
    it("Dado três mensagens na sessão, Quando a Ana começa uma nova, Então a contagem zera e o histórico começa pelo início da sessão", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      for (const texto of ["um", "dois", "três"]) {
        valorDe(await conversas.registrarMensagem(ana, { texto, agora: antes }));
      }

      valorDe(await conversas.iniciarSessao(ana, novaEm));

      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(0);
      expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
        { autor: "sistema", evento: { tipo: "sessao_iniciada" }, enviadaEm: novaEm },
      ]);
    });

    it("Dado uma sessão nova, Quando a Ana escreve, Então só as mensagens dela contam", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      valorDe(await conversas.registrarMensagem(ana, { texto: "antiga", agora: antes }));
      valorDe(await conversas.iniciarSessao(ana, novaEm));

      valorDe(await conversas.registrarMensagem(ana, { texto: "nova", agora: novaEm }));

      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(1);
      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toMatchObject([
        { evento: { tipo: "sessao_iniciada" } },
        { texto: "nova" },
      ]);
    });

    it("Dado uma conversa na fila, Quando a Ana tenta começar uma nova sessão, Então é recusado e o histórico continua para o analista", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      valorDe(await conversas.registrarMensagem(ana, { texto: "socorro", agora: antes }));
      await colocarNaFila(conversas, ana, antes);
      const historico = valorDe(await conversas.historico(ana, DESDE_O_COMECO));

      expect(await conversas.iniciarSessao(ana, novaEm)).toEqual({
        ok: false,
        erro: { motivo: "controle_mudou" },
      });
      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toEqual(historico);
      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(1);
    });
  });
}
