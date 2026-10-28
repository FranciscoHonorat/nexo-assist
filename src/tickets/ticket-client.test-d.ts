import { describe, expectTypeOf, it } from "vitest";
import type { Chamado, TransicaoDeStatus } from "../domain/chamado.js";
import type { Complemento, NovoChamado, Rascunho } from "../domain/rascunho.js";
import type { Resultado } from "../domain/resultado.js";
import type { TicketId } from "../domain/ticket-id.js";
import type { UserId } from "../domain/user-id.js";
import type {
  ErroDeAlteracaoDeStatus,
  ErroDeComplementacao,
  ErroDeConsulta,
  ErroDeInfraestrutura,
  TicketClient,
} from "./ticket-client.js";

declare const servico: TicketClient;
declare const ana: UserId;
declare const id: TicketId;
declare const agora: Date;
declare const pendente: Rascunho<"pendente", NovoChamado>;
declare const complemento: Rascunho<"confirmado", Complemento>;
declare const novoChamado: Rascunho<"confirmado", NovoChamado>;
declare const complementoPendente: Rascunho<"pendente", Complemento>;

describe("TicketClient: garantias em tempo de compilação", () => {
  it("toda operação é assíncrona e pode encontrar o legado fora do ar", () => {
    expectTypeOf<ErroDeInfraestrutura>().toEqualTypeOf<{ readonly motivo: "indisponivel" }>();
    expectTypeOf(servico.listar).returns.toEqualTypeOf<
      Promise<Resultado<readonly Chamado[], ErroDeInfraestrutura>>
    >();
    expectTypeOf(servico.obter).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeConsulta | ErroDeInfraestrutura>>
    >();
    expectTypeOf(servico.criar).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeInfraestrutura>>
    >();
    expectTypeOf(servico.complementar).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeComplementacao | ErroDeInfraestrutura>>
    >();
    expectTypeOf(servico.alterarStatus).returns.toEqualTypeOf<
      Promise<Resultado<Chamado, ErroDeAlteracaoDeStatus | ErroDeInfraestrutura>>
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

  it("alterarStatus é condicional e pode falhar por privacidade ou por conflito", () => {
    expectTypeOf<ErroDeAlteracaoDeStatus>().toEqualTypeOf<
      | ErroDeConsulta
      | {
          readonly motivo: "status_mudou";
          readonly id: TicketId;
          readonly esperado: Chamado["status"];
          readonly atual: Chamado["status"];
        }
    >();
  });

  it("só transições permitidas compilam", () => {
    void servico.alterarStatus(id, { de: "aberto", para: "aguardando_analista", por: ana }, agora);
    void servico.alterarStatus(
      id,
      { de: "aguardando_analista", para: "resolvido", por: ana },
      agora,
    );
    void servico.alterarStatus(id, { de: "aprovado", para: "resolvido", por: ana }, agora);
    // @ts-expect-error: reabrir só acontece complementando o chamado
    void servico.alterarStatus(id, { de: "resolvido", para: "aberto", por: ana }, agora);
    // @ts-expect-error: uma requisição aprovada não volta a ser aberta
    void servico.alterarStatus(id, { de: "aprovado", para: "aberto", por: ana }, agora);
    // @ts-expect-error: mudar para o mesmo status não é uma transição
    void servico.alterarStatus(id, { de: "aberto", para: "aberto", por: ana }, agora);
  });

  it("as transições permitidas são exatamente as da tabela do service desk", () => {
    expectTypeOf<TransicaoDeStatus>().toEqualTypeOf<
      | { readonly de: "aberto"; readonly para: "aguardando_analista" | "aprovado" | "resolvido" }
      | { readonly de: "aguardando_analista"; readonly para: "aberto" | "resolvido" }
      | { readonly de: "aprovado"; readonly para: "resolvido" }
    >();
  });

  it("quem altera é um UserId validado", () => {
    // @ts-expect-error: e-mail cru, possivelmente escrito pelo LLM
    void servico.alterarStatus(id, { de: "aberto", para: "resolvido", por: "ana@nexo.com" }, agora);
  });
});
