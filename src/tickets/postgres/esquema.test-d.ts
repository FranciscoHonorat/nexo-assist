import { describe, expectTypeOf, it } from "vitest";
import type { Afetados, Categoria, StatusDoChamado } from "../../domain/chamado.js";
import type { Prioridade } from "../../domain/prazo.js";
import type { TicketId, TipoChamado } from "../../domain/ticket-id.js";
import type { UserId } from "../../domain/user-id.js";
import type { chamados } from "./esquema.js";

type Linha = typeof chamados.$inferSelect;

describe("Esquema: o banco guarda exatamente os tipos do domínio", () => {
  it("cada ENUM do banco é a mesma união do domínio", () => {
    expectTypeOf<Linha["status"]>().toEqualTypeOf<StatusDoChamado>();
    expectTypeOf<Linha["tipo"]>().toEqualTypeOf<TipoChamado>();
    expectTypeOf<Linha["categoria"]>().toEqualTypeOf<Categoria>();
    expectTypeOf<Linha["prioridade"]>().toEqualTypeOf<Prioridade>();
    expectTypeOf<Linha["afetados"]>().toEqualTypeOf<Afetados>();
  });

  it("ids lidos do banco já são ids validados", () => {
    expectTypeOf<Linha["id"]>().toEqualTypeOf<TicketId>();
    expectTypeOf<Linha["dono"]>().toEqualTypeOf<UserId>();
  });
});
