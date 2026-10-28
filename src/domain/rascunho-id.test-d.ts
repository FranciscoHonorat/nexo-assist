import { describe, expectTypeOf, it } from "vitest";
import type { Resultado } from "./resultado.js";
import {
  lerRascunhoId,
  novoRascunhoId,
  type ErroRascunhoId,
  type RascunhoId,
} from "./rascunho-id.js";
import type { TicketId } from "./ticket-id.js";
import type { UserId } from "./user-id.js";

declare function confirmarPeloClique(id: RascunhoId): void;
declare const ticketId: TicketId;
declare const userId: UserId;

describe("RascunhoId: garantias em tempo de compilação", () => {
  it("gerar sempre funciona; ler pode falhar", () => {
    expectTypeOf(novoRascunhoId).returns.toEqualTypeOf<RascunhoId>();
    expectTypeOf(lerRascunhoId).returns.toEqualTypeOf<Resultado<RascunhoId, ErroRascunhoId>>();
  });

  it("o texto da URL precisa passar pela leitura", () => {
    // @ts-expect-error: string crua vinda do cliente
    confirmarPeloClique("rsc_0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("ids de outras entidades não servem", () => {
    // @ts-expect-error: TicketId não é RascunhoId
    confirmarPeloClique(ticketId);
    // @ts-expect-error: UserId não é RascunhoId
    confirmarPeloClique(userId);
  });
});
