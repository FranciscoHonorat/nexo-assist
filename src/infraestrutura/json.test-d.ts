import { describe, expectTypeOf, it } from "vitest";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { JsonDe } from "./json.js";

describe("JsonDe: o formato de um valor depois de passar por JSON", () => {
  it("datas viram texto, marcas de validação somem e as uniões literais ficam", () => {
    expectTypeOf<
      JsonDe<{
        readonly em: Date;
        readonly dono: UserId;
        readonly chamados: readonly TicketId[];
        readonly autor: "agent" | "analista";
        readonly talvez?: number;
      }>
    >().toEqualTypeOf<{
      readonly em: string;
      readonly dono: string;
      readonly chamados: readonly string[];
      readonly autor: "agent" | "analista";
      readonly talvez?: number;
    }>();
    expectTypeOf<"rafael@nexo.com">().toExtend<JsonDe<UserId>>();
    expectTypeOf<"INC-30001">().toExtend<JsonDe<TicketId>>();
  });
});
