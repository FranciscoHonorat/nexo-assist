import { describe, expect, it } from "vitest";
import type { EventoDaConversa } from "../conversas/conversas.js";
import { lerTicketId } from "../domain/ticket-id.js";
import { bruno } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { paraMensagemAnterior } from "./eventos.js";

const INC_20311 = valorDe(lerTicketId("INC-20311"));

describe("Eventos da conversa contados ao modelo", () => {
  it.each<[EventoDaConversa, string]>([
    [
      { tipo: "transferida", motivo: "chamado_vencido" },
      "A conversa foi transferida para um analista (motivo: chamado_vencido).",
    ],
    [{ tipo: "assumida", analista: bruno }, "O analista bruno.n1@nexo.com assumiu a conversa."],
    [{ tipo: "devolvida" }, "O analista devolveu a conversa ao agent."],
    [{ tipo: "encerrada" }, "O analista encerrou o atendimento."],
    [
      { tipo: "chamado_criado", chamado: INC_20311 },
      "O funcionário confirmou o rascunho e o chamado INC-20311 foi criado.",
    ],
    [
      { tipo: "chamado_complementado", chamado: INC_20311 },
      "O funcionário confirmou o complemento e o chamado INC-20311 foi atualizado.",
    ],
    [{ tipo: "rascunho_descartado" }, "O funcionário descartou o rascunho; nada foi criado."],
    [{ tipo: "sessao_iniciada" }, "O funcionário começou uma nova sessão."],
  ])("%o vira o aviso: %s", (evento, texto) => {
    expect(
      paraMensagemAnterior({ id: 1, autor: "sistema", evento, enviadaEm: new Date() }),
    ).toEqual({ autor: "sistema", texto });
  });
});
