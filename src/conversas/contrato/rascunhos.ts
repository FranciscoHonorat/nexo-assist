import { describe, expect, it } from "vitest";
import { confirmar, descartar, type Rascunho } from "../../domain/rascunho.js";
import { lerTicketId, type TicketId } from "../../domain/ticket-id.js";
import { semIds } from "../../testes/conversas.js";
import { DESDE_O_COMECO } from "../conversas.js";
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

const INC_NOVO = valorDe(lerTicketId("INC-20520"));

const rascunhoDaAna = () => rascunhoPendente(NOVO_NOTEBOOK_LENTO, criadoEm);
const complementoDaAna = () => rascunhoPendente(COMPLEMENTO_DO_NOTEBOOK, criadoEm);

function confirmadoComChamado(rascunho: Rascunho<"pendente">, chamado: TicketId = INC_NOVO) {
  return { rascunho: valorDe(confirmar(rascunho, { por: ana, agora: confirmadoEm })), chamado };
}

async function comGuardado(fabricar: FabricaDeConversas, criar: () => Rascunho<"pendente">) {
  const conversas = await fabricar();
  valorDe(await conversas.atual(ana));
  const rascunho = criar();
  valorDe(await conversas.guardarRascunho(rascunho));
  return { conversas, rascunho };
}

function descartado(rascunho: Rascunho<"pendente">) {
  return { rascunho: valorDe(descartar(rascunho, { por: ana, agora: confirmadoEm })) };
}

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
      const { conversas, rascunho } = await comGuardado(fabricar, rascunhoDaAna);

      expect(await conversas.rascunhoPendente(rascunho.id, joao)).toEqual({
        ok: false,
        erro: { motivo: "rascunho_nao_encontrado" },
      });
    });

    it("Dado um rascunho confirmado, Quando alguém tenta usá-lo de novo, Então recebe que ele já foi confirmado", async () => {
      const { conversas, rascunho } = await comGuardado(fabricar, rascunhoDaAna);

      valorDe(await conversas.resolverRascunho(confirmadoComChamado(rascunho)));

      expect(await conversas.rascunhoPendente(rascunho.id, ana)).toEqual({
        ok: false,
        erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
      });
    });

    it("Dado dois cliques no mesmo rascunho, um confirmando e outro descartando, Então só o primeiro vale", async () => {
      const { conversas, rascunho } = await comGuardado(fabricar, rascunhoDaAna);
      valorDe(await conversas.resolverRascunho(confirmadoComChamado(rascunho)));

      expect(await conversas.resolverRascunho(descartado(rascunho))).toEqual({
        ok: false,
        erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
      });
      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toHaveLength(1);
    });
  });

  describe("resultado do clique no histórico", () => {
    it.each([
      ["de novo chamado", rascunhoDaAna, { tipo: "chamado_criado", chamado: INC_NOVO }],
      [
        "de complemento",
        complementoDaAna,
        { tipo: "chamado_complementado", chamado: COMPLEMENTO_DO_NOTEBOOK.chamado },
      ],
    ] as const)(
      "Dado um rascunho %s confirmado, Então o histórico da dona ganha o evento com o chamado, no horário da confirmação",
      async (_, criar, evento) => {
        const { conversas, rascunho } = await comGuardado(fabricar, criar);

        valorDe(await conversas.resolverRascunho(confirmadoComChamado(rascunho, evento.chamado)));

        expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
          { autor: "sistema", evento, enviadaEm: confirmadoEm },
        ]);
      },
    );

    it("Dado um rascunho descartado, Então o histórico registra o descarte", async () => {
      const { conversas, rascunho } = await comGuardado(fabricar, rascunhoDaAna);

      valorDe(await conversas.resolverRascunho(descartado(rascunho)));

      expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
        { autor: "sistema", evento: { tipo: "rascunho_descartado" }, enviadaEm: confirmadoEm },
      ]);
    });
  });
}
