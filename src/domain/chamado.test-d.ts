import { describe, expectTypeOf, it } from "vitest";
import type {
  Afetados,
  Categoria,
  Chamado,
  ComplementoDoChamado,
  DadosDoChamado,
  StatusDoChamado,
} from "./chamado.js";
import type { Prioridade } from "./prazo.js";
import type { TicketId, TipoChamado } from "./ticket-id.js";
import type { UserId } from "./user-id.js";

describe("DadosDoChamado: regras do Anexo A em tipos", () => {
  it("as categorias são as do service desk", () => {
    expectTypeOf<Categoria>().toEqualTypeOf<
      "acesso" | "rede_e_vpn" | "hardware" | "software" | "email" | "outros"
    >();
  });

  it("quem é afetado é uma lista fechada", () => {
    expectTypeOf<Afetados>().toEqualTypeOf<"so_eu" | "minha_equipe" | "empresa">();
  });

  it("todo chamado tem título, descrição, tipo, categoria, prioridade e afetados", () => {
    expectTypeOf<DadosDoChamado>().toEqualTypeOf<{
      readonly titulo: string;
      readonly descricao: string;
      readonly tipo: TipoChamado;
      readonly categoria: Categoria;
      readonly prioridade: Prioridade;
      readonly afetados: Afetados;
    }>();
  });
});

describe("Chamado: o que existe no serviço de chamados", () => {
  it("os status seguem o ciclo de vida do service desk", () => {
    expectTypeOf<StatusDoChamado>().toEqualTypeOf<
      "aberto" | "aguardando_analista" | "aprovado" | "resolvido"
    >();
  });

  it("um chamado tem id validado, dono, dados, status e horários", () => {
    expectTypeOf<Chamado>().toEqualTypeOf<{
      readonly id: TicketId;
      readonly dono: UserId;
      readonly dados: DadosDoChamado;
      readonly status: StatusDoChamado;
      readonly criadoEm: Date;
      readonly atualizadoEm: Date;
      readonly complementos: readonly ComplementoDoChamado[];
    }>();
  });

  it("um complemento registra o texto e quando foi acrescentado", () => {
    expectTypeOf<ComplementoDoChamado>().toEqualTypeOf<{
      readonly texto: string;
      readonly em: Date;
    }>();
  });
});
