import { describe, expect, it } from "vitest";
import { lerUserId } from "../../domain/user-id.js";
import { novaConversa } from "../../domain/conversa.js";
import { assumidaPor, semIds } from "../../testes/conversas.js";
import { ana, bruno } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import { DESDE_O_COMECO } from "../conversas.js";
import type { FabricaDeConversas } from "./index.js";

const assumidaEm = new Date("2026-10-28T13:05:00Z");
const respondidaEm = new Date("2026-10-28T13:12:00Z");
const carla = valorDe(lerUserId("carla.n1@nexo.com"));

export function cenariosDoAnalista(fabricar: FabricaDeConversas): void {
  describe("registrarMensagemDoAnalista", () => {
    it("Dado uma conversa com o Bruno, Quando ele escreve, Então a mensagem entra no histórico com o nome dele e não conta na sessão da Ana", async () => {
      const conversas = await fabricar();
      const comBruno = await assumidaPor(conversas, ana, bruno, assumidaEm);
      const antes = valorDe(await conversas.historico(ana, DESDE_O_COMECO));

      valorDe(
        await conversas.registrarMensagemDoAnalista(comBruno, {
          texto: "Oi, Ana! Aqui é o Bruno.",
          agora: respondidaEm,
        }),
      );

      expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
        ...semIds(antes),
        {
          autor: "analista",
          analista: bruno,
          texto: "Oi, Ana! Aqui é o Bruno.",
          enviadaEm: respondidaEm,
        },
      ]);
      expect(valorDe(await conversas.atual(ana)).mensagensNaSessao).toBe(0);
    });

    it("Dado uma conversa com o Bruno, Quando a Carla tenta escrever com uma cópia antiga, Então nada é gravado", async () => {
      const conversas = await fabricar();
      const comBruno = await assumidaPor(conversas, ana, bruno, assumidaEm);
      const antes = valorDe(await conversas.historico(ana, DESDE_O_COMECO));

      expect(
        await conversas.registrarMensagemDoAnalista(
          { ...comBruno, analista: carla },
          { texto: "posso ajudar?", agora: respondidaEm },
        ),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toEqual(antes);
    });

    it("Dado uma conversa que o Bruno já devolveu ao agent, Quando ele tenta escrever, Então nada é gravado", async () => {
      const conversas = await fabricar();
      const comBruno = await assumidaPor(conversas, ana, bruno, assumidaEm);
      valorDe(
        await conversas.transicionar(
          { evento: "devolvida", antes: comBruno, depois: novaConversa({ dono: ana }) },
          respondidaEm,
        ),
      );

      expect(
        await conversas.registrarMensagemDoAnalista(comBruno, {
          texto: "mais uma coisa",
          agora: respondidaEm,
        }),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
    });
  });
}
