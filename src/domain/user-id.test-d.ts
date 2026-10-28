import { describe, expectTypeOf, it } from "vitest";
import type { Resultado } from "./resultado.js";
import type { TicketId } from "./ticket-id.js";
import { lerUserId, type ErroUserId, type UserId } from "./user-id.js";

declare function listarChamadosDe(dono: UserId): void;
declare const ticketId: TicketId;

describe("UserId: garantias em tempo de compilação", () => {
  it("só se obtém um UserId lendo um texto, e a leitura pode falhar", () => {
    expectTypeOf(lerUserId).returns.toEqualTypeOf<Resultado<UserId, ErroUserId>>();
  });

  it("um e-mail escrito pelo LLM não é UserId", () => {
    // @ts-expect-error: precisa vir da sessão, via lerUserId
    listarChamadosDe("joao@nexo.com");
  });

  it("ids de entidades diferentes não se misturam", () => {
    // @ts-expect-error: TicketId não é UserId
    listarChamadosDe(ticketId);
  });

  it("os motivos de erro são uma lista fechada", () => {
    expectTypeOf<ErroUserId["motivo"]>().toEqualTypeOf<"email_invalido" | "dominio_externo">();
  });
});
