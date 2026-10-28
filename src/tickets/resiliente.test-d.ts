import { describe, expectTypeOf, it } from "vitest";
import {
  ticketClientResiliente,
  type DependenciasDeEspera,
  type PoliticaDeRetry,
} from "./resiliente.js";
import type { TicketClient } from "./ticket-client.js";

declare const base: TicketClient;

describe("TicketClient resiliente: garantias em tempo de compilação", () => {
  it("é um TicketClient que envolve outro TicketClient", () => {
    expectTypeOf(ticketClientResiliente(base)).toEqualTypeOf<TicketClient>();
  });

  it("a política e as dependências têm formato fechado", () => {
    expectTypeOf<PoliticaDeRetry>().toEqualTypeOf<{
      readonly tentativas: number;
      readonly esperaInicial: number;
      readonly fator: number;
    }>();
    expectTypeOf<DependenciasDeEspera>().toEqualTypeOf<{
      readonly esperar: (milissegundos: number) => Promise<void>;
      readonly aleatorio: () => number;
    }>();
  });
});
