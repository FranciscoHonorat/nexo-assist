import { describe, expectTypeOf, it } from "vitest";
import type { Afetados, Categoria, DadosDoChamado } from "./chamado.js";
import type { Prioridade } from "./prazo.js";
import type { TipoChamado } from "./ticket-id.js";

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
