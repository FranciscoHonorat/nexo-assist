import { describe, expect, it } from "vitest";
import { INSTRUCOES } from "../instrucoes.js";
import { NOMES_DAS_TOOLS } from "./mastra-agent-step.js";

describe("Instruções do agent", () => {
  it.each(NOMES_DAS_TOOLS)(
    "toda tool oferecida ao modelo é explicada nas instruções: %s",
    (nome) => {
      expect(INSTRUCOES).toContain(nome);
    },
  );
});
