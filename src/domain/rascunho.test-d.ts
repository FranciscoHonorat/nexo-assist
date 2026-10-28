import { describe, expectTypeOf, it } from "vitest";
import type { DadosDoChamado } from "./chamado.js";
import type { RascunhoId } from "./rascunho-id.js";
import {
  confirmar,
  criarRascunho,
  descartar,
  type Complemento,
  type ConteudoDoRascunho,
  type ErroDeConteudo,
  type ErroDeTransicao,
  type NovoChamado,
  type Rascunho,
} from "./rascunho.js";
import type { Resultado } from "./resultado.js";
import type { TicketId } from "./ticket-id.js";
import type { UserId } from "./user-id.js";

declare function criarChamado(rascunho: Rascunho<"confirmado", NovoChamado>): void;
declare function complementarChamado(rascunho: Rascunho<"confirmado", Complemento>): void;
declare const id: RascunhoId;
declare const ana: UserId;
declare const dados: DadosDoChamado;
declare const inc20311: TicketId;
declare const agora: Date;
declare const pendente: Rascunho<"pendente", NovoChamado>;
declare const pendenteDeComplemento: Rascunho<"pendente", Complemento>;

describe("Rascunho: garantias em tempo de compilação", () => {
  it("o conteúdo é um chamado novo ou um complemento", () => {
    expectTypeOf<ConteudoDoRascunho>().toEqualTypeOf<NovoChamado | Complemento>();
    expectTypeOf<NovoChamado>().toEqualTypeOf<{
      readonly tipo: "novo_chamado";
      readonly dados: DadosDoChamado;
    }>();
    expectTypeOf<Complemento>().toEqualTypeOf<{
      readonly tipo: "complemento";
      readonly chamado: TicketId;
      readonly texto: string;
    }>();
  });

  it("criarRascunho deduz o tipo de conteúdo e pode falhar por conteúdo vazio", () => {
    const novo = criarRascunho({ id, dono: ana, conteudo: { tipo: "novo_chamado", dados }, agora });
    const extra = criarRascunho({
      id,
      dono: ana,
      conteudo: { tipo: "complemento", chamado: inc20311, texto: "mais detalhes" },
      agora,
    });

    expectTypeOf(novo).toEqualTypeOf<
      Resultado<Rascunho<"pendente", NovoChamado>, ErroDeConteudo>
    >();
    expectTypeOf(extra).toEqualTypeOf<
      Resultado<Rascunho<"pendente", Complemento>, ErroDeConteudo>
    >();
    expectTypeOf<ErroDeConteudo["campo"]>().toEqualTypeOf<"titulo" | "descricao" | "texto">();
  });

  it("confirmar e descartar preservam o tipo de conteúdo", () => {
    expectTypeOf(confirmar(pendente, { por: ana, agora })).toEqualTypeOf<
      Resultado<Rascunho<"confirmado", NovoChamado>, ErroDeTransicao>
    >();
    expectTypeOf(confirmar(pendenteDeComplemento, { por: ana, agora })).toEqualTypeOf<
      Resultado<Rascunho<"confirmado", Complemento>, ErroDeTransicao>
    >();
    expectTypeOf(descartar(pendente, { por: ana, agora })).toEqualTypeOf<
      Resultado<Rascunho<"descartado", NovoChamado>, ErroDeTransicao>
    >();
  });

  it("um tipo de rascunho não serve no lugar do outro", () => {
    const novo = confirmar(pendente, { por: ana, agora });
    const extra = confirmar(pendenteDeComplemento, { por: ana, agora });

    if (novo.ok && extra.ok) {
      criarChamado(novo.valor);
      complementarChamado(extra.valor);
      // @ts-expect-error: um complemento não cria chamado
      criarChamado(extra.valor);
      // @ts-expect-error: um chamado novo não complementa outro
      complementarChamado(novo.valor);
    }
  });

  it("dono, id e quem confirma precisam ser ids validados", () => {
    const conteudo = { tipo: "novo_chamado", dados } as const;

    // @ts-expect-error: e-mail cru não é UserId
    criarRascunho({ id, dono: "ana@nexo.com", conteudo, agora });
    // @ts-expect-error: texto cru não é RascunhoId
    criarRascunho({ id: "rsc_0f8fad5b-d9cb-469f-a165-70867728950e", dono: ana, conteudo, agora });
    // @ts-expect-error: quem confirma vem da sessão, não de um texto
    confirmar(pendente, { por: "ana@nexo.com", agora });
    const complementoComIdCru = { tipo: "complemento", chamado: "INC-20311", texto: "x" } as const;
    // @ts-expect-error: o chamado complementado precisa ser um TicketId validado
    criarRascunho({ id, dono: ana, conteudo: complementoComIdCru, agora });
  });

  it("os dados seguem as listas fechadas do Anexo A", () => {
    const categoriaInventada = {
      tipo: "novo_chamado",
      dados: { ...dados, categoria: "impressora" },
    } as const;
    // @ts-expect-error: "impressora" não é uma categoria do service desk
    criarRascunho({ id, dono: ana, conteudo: categoriaInventada, agora });
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
      conteudo: { tipo: "novo_chamado", dados },
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
    expectTypeOf<Rascunho<"pendente", NovoChamado>["dono"]>().toEqualTypeOf<UserId>();
    expectTypeOf<Rascunho<"confirmado", NovoChamado>>().toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"pendente", NovoChamado>>().not.toHaveProperty("confirmadoEm");
    expectTypeOf<Rascunho<"descartado", NovoChamado>>().toHaveProperty("descartadoEm");
  });
});
