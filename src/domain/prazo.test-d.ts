import { describe, expectTypeOf, it } from "vitest";
import { calcularPrazo, estaVencido, type Prioridade } from "./prazo.js";

declare const agora: Date;

describe("Prazo: garantias em tempo de compilação", () => {
  it("as prioridades são as quatro do Anexo A", () => {
    expectTypeOf<Prioridade>().toEqualTypeOf<"critica" | "alta" | "media" | "baixa">();
  });

  it("prioridade fora da lista não compila", () => {
    // @ts-expect-error: "urgente" não é uma prioridade do service desk
    calcularPrazo("urgente", agora);
    // @ts-expect-error: "urgente" não é uma prioridade do service desk
    estaVencido("urgente", agora, agora);
  });

  it("prazo é um instante; vencido é um sim ou não", () => {
    expectTypeOf(calcularPrazo).returns.toEqualTypeOf<Date>();
    expectTypeOf(estaVencido).returns.toEqualTypeOf<boolean>();
  });
});
