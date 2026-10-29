import { describe, expect, it } from "vitest";
import { confirmar, descartar } from "../../domain/rascunho.js";
import {
  COMPLEMENTO_DO_NOTEBOOK,
  NOVO_NOTEBOOK_LENTO,
  rascunhoPendente,
} from "../../testes/rascunhos.js";
import { ana, joao } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import type { FabricaDeConversas } from "./index.js";

const criadoEm = new Date("2026-10-28T13:00:00Z");
const confirmadoEm = new Date("2026-10-28T13:02:00Z");

const rascunhoDaAna = () => rascunhoPendente(NOVO_NOTEBOOK_LENTO, criadoEm);
const complementoDaAna = () => rascunhoPendente(COMPLEMENTO_DO_NOTEBOOK, criadoEm);

export function cenariosDosRascunhos(fabricar: FabricaDeConversas): void {
  describe("rascunhos", () => {
    it.each([
      ["de novo chamado", rascunhoDaAna],
      ["de complemento", complementoDaAna],
    ])(
      "Dado um rascunho %s guardado, Quando a dona o busca, Então recebe o rascunho pendente como foi guardado",
      async (_, criar) => {
        const conversas = await fabricar();
        valorDe(await conversas.atual(ana));
        const rascunho = criar();

        valorDe(await conversas.guardarRascunho(rascunho));

        expect(valorDe(await conversas.rascunhoPendente(rascunho.id, ana))).toEqual(rascunho);
      },
    );

    it("Dado um rascunho da Ana, Quando o João busca pelo mesmo id, Então não o encontra, como se não existisse", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      const rascunho = rascunhoDaAna();
      valorDe(await conversas.guardarRascunho(rascunho));

      expect(await conversas.rascunhoPendente(rascunho.id, joao)).toEqual({
        ok: false,
        erro: { motivo: "rascunho_nao_encontrado" },
      });
    });

    it("Dado um rascunho confirmado, Quando alguém tenta usá-lo de novo, Então recebe que ele já foi confirmado", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      const rascunho = rascunhoDaAna();
      valorDe(await conversas.guardarRascunho(rascunho));

      valorDe(
        await conversas.resolverRascunho(
          valorDe(confirmar(rascunho, { por: ana, agora: confirmadoEm })),
        ),
      );

      expect(await conversas.rascunhoPendente(rascunho.id, ana)).toEqual({
        ok: false,
        erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
      });
    });

    it("Dado dois cliques no mesmo rascunho, um confirmando e outro descartando, Então só o primeiro vale", async () => {
      const conversas = await fabricar();
      valorDe(await conversas.atual(ana));
      const rascunho = rascunhoDaAna();
      valorDe(await conversas.guardarRascunho(rascunho));
      valorDe(
        await conversas.resolverRascunho(
          valorDe(confirmar(rascunho, { por: ana, agora: confirmadoEm })),
        ),
      );

      expect(
        await conversas.resolverRascunho(
          valorDe(descartar(rascunho, { por: ana, agora: confirmadoEm })),
        ),
      ).toEqual({ ok: false, erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" } });
    });
  });
}
