import { describe, expectTypeOf, it } from "vitest";
import type { Chamado } from "../domain/chamado.js";
import type { Complemento, NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeComplementacao, ErroDeConsulta, TicketClient } from "./ticket-client.js";

declare const servico: TicketClient;
declare const ana: UserId;
declare const id: TicketId;
declare const agora: Date;
declare const pendente: Rascunho<"pendente", NovoChamado>;
declare const complemento: Rascunho<"confirmado", Complemento>;
declare const novoChamado: Rascunho<"confirmado", NovoChamado>;
declare const complementoPendente: Rascunho<"pendente", Complemento>;

describe("TicketClient: garantias em tempo de compilação", () => {
  it("toda operação é assíncrona, como num sistema legado", () => {
    expectTypeOf(servico.listar).returns.toEqualTypeOf<Promise<readonly Chamado[]>>();
    expectTypeOf(servico.obter).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeConsulta>>
    >();
    expectTypeOf(servico.criar).returns.toEqualTypeOf<Promise<Chamado>>();
    expectTypeOf(servico.complementar).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeComplementacao>>
    >();
  });

  it("complementar pode falhar por privacidade ou por prazo de reabertura", () => {
    expectTypeOf<ErroDeComplementacao>().toEqualTypeOf<
      ErroDeConsulta | { readonly motivo: "resolvido_ha_mais_de_7_dias"; readonly id: TicketId }
    >();
  });

  it("só se complementa a partir de um rascunho de complemento confirmado", () => {
    void servico.complementar(complemento, agora);
    // @ts-expect-error: o funcionário ainda não confirmou
    void servico.complementar(complementoPendente, agora);
    // @ts-expect-error: um chamado novo não complementa outro
    void servico.complementar(novoChamado, agora);
  });

  it("só se cria chamado a partir de um rascunho confirmado", () => {
    // @ts-expect-error: o funcionário ainda não confirmou
    void servico.criar(pendente, agora);
    // @ts-expect-error: um complemento não cria chamado novo
    void servico.criar(complemento, agora);
  });

  it("quem consulta é sempre um UserId validado", () => {
    // @ts-expect-error: e-mail cru, possivelmente escrito pelo LLM
    void servico.listar("joao@nexo.com");
    // @ts-expect-error: e-mail cru, possivelmente escrito pelo LLM
    void servico.obter(id, "joao@nexo.com");
    // @ts-expect-error: texto cru não é TicketId
    void servico.obter("INC-20311", ana);
  });
});
