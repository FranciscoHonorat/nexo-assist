import { describe, expect, it } from "vitest";
import type { ContextoDoPasso } from "./agent-step.js";
import { agentStepRoteirizado } from "./roteirizado.js";

const contexto: ContextoDoPasso = { mensagem: "oi", chamadosVencidos: [], resultadosDeTools: [] };

describe("Modelo roteirizado: um teste com roteiro curto falha de forma clara", () => {
  it("Dado um roteiro com uma decisão, Quando o modelo é chamado pela segunda vez, Então a promise é rejeitada dizendo onde o roteiro acabou", async () => {
    const modelo = agentStepRoteirizado([{ tipo: "texto_solto", texto: "oi" }]);
    await modelo.decidir(contexto);

    await expect(modelo.decidir(contexto)).rejects.toThrow(
      "o roteiro do modelo acabou: a chamada 2 não tem decisão, o roteiro tinha 1",
    );
  });
});
