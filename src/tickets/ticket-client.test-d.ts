import { describe, expectTypeOf, it } from "vitest";
import type { Chamado } from "../domain/chamado.js";
import type { Complemento, NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeConsulta, TicketClient } from "./ticket-client.js";

declare const servico: TicketClient;
declare const ana: UserId;
declare const id: TicketId;
declare const agora: Date;
declare const pendente: Rascunho<"pendente", NovoChamado>;
declare const complemento: Rascunho<"confirmado", Complemento>;

describe("TicketClient: garantias em tempo de compilação", () => {
  it("toda operação é assíncrona, como num sistema legado", () => {
    expectTypeOf(servico.listar).returns.toEqualTypeOf<Promise<readonly Chamado[]>>();
    expectTypeOf(servico.obter).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeConsulta>>
    >();
    expectTypeOf(servico.criar).returns.toEqualTypeOf<Promise<Chamado>>();
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
