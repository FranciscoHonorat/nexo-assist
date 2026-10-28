import { describe, expectTypeOf, it } from "vitest";
import type { RascunhoId } from "./rascunho-id.js";
import {
  confirmar,
  criarRascunho,
  descartar,
  type ErroDeTransicao,
  type Rascunho,
} from "./rascunho.js";
import type { Resultado } from "./resultado.js";
import type { UserId } from "./user-id.js";

declare function criarChamado(rascunho: Rascunho<"confirmado">): void;
declare const id: RascunhoId;
declare const ana: UserId;
declare const agora: Date;

const pendente = criarRascunho({ id, dono: ana, agora });

describe("Rascunho: garantias em tempo de compilação", () => {
  it("criarRascunho produz um rascunho pendente", () => {
    expectTypeOf(criarRascunho).returns.toEqualTypeOf<Rascunho<"pendente">>();
  });

  it("confirmar e descartar só aceitam rascunho pendente e podem falhar", () => {
    expectTypeOf(confirmar).parameter(0).toEqualTypeOf<Rascunho<"pendente">>();
    expectTypeOf(descartar).parameter(0).toEqualTypeOf<Rascunho<"pendente">>();
    expectTypeOf(confirmar).returns.toEqualTypeOf<
      Resultado<Rascunho<"confirmado">, ErroDeTransicao>
    >();
    expectTypeOf(descartar).returns.toEqualTypeOf<
      Resultado<Rascunho<"descartado">, ErroDeTransicao>
    >();
  });

  it("dono, id e quem confirma precisam ser ids validados", () => {
    // @ts-expect-error: e-mail cru não é UserId
    criarRascunho({ id, dono: "ana@nexo.com", agora });
    // @ts-expect-error: texto cru não é RascunhoId
    criarRascunho({ id: "rsc_0f8fad5b-d9cb-469f-a165-70867728950e", dono: ana, agora });
    // @ts-expect-error: quem confirma vem da sessão, não de um texto
    confirmar(pendente, { por: "ana@nexo.com", agora });
  });

  it("só um rascunho confirmado, já verificado, vira chamado", () => {
    const confirmacao = confirmar(pendente, { por: ana, agora });
    const descarte = descartar(pendente, { por: ana, agora });

    // @ts-expect-error: pendente ainda não foi confirmado pelo funcionário
    criarChamado(pendente);
    // @ts-expect-error: a confirmação pode ter falhado
    criarChamado(confirmacao);
    if (descarte.ok) {
      // @ts-expect-error: descartado nunca pode virar chamado
      criarChamado(descarte.valor);
    }

    if (confirmacao.ok) criarChamado(confirmacao.valor);
  });

  it("um rascunho confirmado não pode ser forjado com um literal", () => {
    const forjado = {
      id,
      dono: ana,
      status: "confirmado",
      criadoEm: agora,
      confirmadoEm: agora,
    } as const;

    // @ts-expect-error: só confirmar() produz Rascunho<"confirmado">
    criarChamado(forjado);
  });

  it("não se confirma duas vezes nem se confirma um descartado", () => {
    const confirmacao = confirmar(pendente, { por: ana, agora });
    const descarte = descartar(pendente, { por: ana, agora });

    if (confirmacao.ok) {
      // @ts-expect-error: já confirmado
      confirmar(confirmacao.valor, { por: ana, agora });
    }
    if (descarte.ok) {
      // @ts-expect-error: descartado é estado final
      confirmar(descarte.valor, { por: ana, agora });
    }
  });

  it("todo rascunho tem dono; confirmadoEm só existe no confirmado", () => {
    expectTypeOf<Rascunho<"pendente">["dono"]>().toEqualTypeOf<UserId>();
    expectTypeOf<Rascunho<"confirmado">>().toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"pendente">>().not.toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"descartado">>().toHaveProperty("descartadoEm");
  });
});
