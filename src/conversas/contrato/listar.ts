import { describe, expect, it } from "vitest";
import { colocarNaFila } from "../../testes/conversas.js";
import { ana, joao } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import type { FabricaDeConversas } from "./index.js";

const agora = new Date("2026-10-28T13:00:00Z");

export function cenariosDaLista(fabricar: FabricaDeConversas): void {
  describe("listar", () => {
    it("Dado conversas da Ana e do João, Então a lista traz cada uma com o estado, a última mensagem da sessão e a contagem, da atividade mais recente para a mais antiga", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      valorDe(await conversas.atual(joao));
      valorDe(await conversas.registrarMensagem(ana, { texto: "notebook lento", agora }));
      const fila = await colocarNaFila(conversas, ana, agora);
      valorDe(await conversas.registrarMensagem(joao, { texto: "e a VPN?", agora }));

      expect(valorDe(await conversas.listar())).toMatchObject([
        {
          conversa: { dono: joao, controle: "agent" },
          ultima: { texto: "e a VPN?" },
          mensagensNaSessao: 1,
        },
        {
          conversa: fila,
          ultima: { autor: "sistema", evento: { tipo: "transferida" } },
          mensagensNaSessao: 1,
        },
      ]);
    });

    it("Dado uma conversa sem mensagens na sessão, Então ela aparece no fim, sem última mensagem", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora }));
      valorDe(await conversas.iniciarSessao(ana, agora));
      valorDe(await conversas.atual(joao));

      expect(valorDe(await conversas.listar())).toMatchObject([
        {
          conversa: { dono: ana },
          ultima: { evento: { tipo: "sessao_iniciada" } },
          mensagensNaSessao: 0,
        },
        { conversa: { dono: joao }, ultima: null, mensagensNaSessao: 0 },
      ]);
    });
  });
}
