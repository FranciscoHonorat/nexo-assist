import { describe, expectTypeOf, it } from "vitest";
import type { Resultado } from "./resultado.js";
import { lerTicketId, tipoDoChamado, type ErroTicketId, type TicketId } from "./ticket-id.js";

declare function buscarChamado(id: TicketId): void;
declare const incidente: TicketId<"INC">;
declare const requisicao: TicketId<"REQ">;

describe("TicketId: garantias em tempo de compilação", () => {
  it("só se obtém um TicketId lendo um texto, e a leitura pode falhar", () => {
    expectTypeOf(lerTicketId).returns.toEqualTypeOf<Resultado<TicketId, ErroTicketId>>();
  });

  it("um texto qualquer não é TicketId, mesmo com o formato certo", () => {
    // @ts-expect-error: string vinda do LLM precisa passar por lerTicketId
    buscarChamado("INC-20311");
  });

  it("o resultado precisa ser verificado antes do uso", () => {
    const lido = lerTicketId("INC-20311");

    expectTypeOf(lido).not.toHaveProperty("valor");

    if (lido.ok) expectTypeOf(lido.valor).toEqualTypeOf<TicketId>();
  });

  it("o tipo do chamado é deduzido do prefixo do id", () => {
    expectTypeOf(tipoDoChamado(incidente)).toEqualTypeOf<"incidente">();
    expectTypeOf(tipoDoChamado(requisicao)).toEqualTypeOf<"requisicao">();
    expectTypeOf(tipoDoChamado(incidente as TicketId)).toEqualTypeOf<"incidente" | "requisicao">();
  });

  it("os prefixos são só INC e REQ", () => {
    // @ts-expect-error: CHG não é um tipo de chamado do Anexo A
    expectTypeOf<TicketId<"CHG">>();
  });
});
