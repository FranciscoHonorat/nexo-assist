import { describe, expectTypeOf, it } from "vitest";
import { confirmar, criarRascunho, descartar, type Rascunho } from "./rascunho.js";

declare function criarChamado(rascunho: Rascunho<"confirmado">): void;

describe("Rascunho: garantias em tempo de compilação", () => {
  it("criarRascunho produz um rascunho pendente", () => {
    expectTypeOf(criarRascunho).returns.toEqualTypeOf<Rascunho<"pendente">>();
  });

  it("confirmar e descartar só aceitam rascunho pendente", () => {
    expectTypeOf(confirmar).parameter(0).toEqualTypeOf<Rascunho<"pendente">>();
    expectTypeOf(descartar).parameter(0).toEqualTypeOf<Rascunho<"pendente">>();
  });

  it("operações que exigem confirmação rejeitam pendente e descartado", () => {
    const pendente = criarRascunho("d-1", new Date());

    // @ts-expect-error: pendente ainda não foi confirmado pelo funcionário
    criarChamado(pendente);
    // @ts-expect-error: descartado nunca pode virar chamado
    criarChamado(descartar(pendente, new Date()));

    criarChamado(confirmar(pendente, new Date()));
  });

  it("um rascunho confirmado não pode ser forjado com um literal", () => {
    const forjado = {
      id: "d-1",
      status: "confirmado",
      criadoEm: new Date(),
      confirmadoEm: new Date(),
    } as const;

    // @ts-expect-error: só confirmar() produz Rascunho<"confirmado">
    criarChamado(forjado);
  });

  it("não se confirma duas vezes nem se confirma um descartado", () => {
    const confirmado = confirmar(criarRascunho("d-1", new Date()), new Date());
    const descartado = descartar(criarRascunho("d-2", new Date()), new Date());

    // @ts-expect-error: já confirmado
    confirmar(confirmado, new Date());
    // @ts-expect-error: descartado é estado final
    confirmar(descartado, new Date());
  });

  it("confirmadoEm só existe no rascunho confirmado", () => {
    expectTypeOf<Rascunho<"confirmado">>().toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"pendente">>().not.toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"descartado">>().toHaveProperty("descartadoEm");
  });
});
