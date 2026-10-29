import { describe, expectTypeOf, it } from "vitest";
import type { PassoDoTurno } from "./turno.js";

describe("Trace do turno: garantias em tempo de compilação", () => {
  it("todo passo diz de que etapa veio, e a etapa é uma lista fechada", () => {
    expectTypeOf<PassoDoTurno["etapa"]>().toEqualTypeOf<"guarda" | "resposta">();
  });
});
