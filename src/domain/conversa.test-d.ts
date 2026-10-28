import { describe, expectTypeOf, it } from "vitest";
import {
  agentPodeResponder,
  assumir,
  finalizar,
  novaConversa,
  transferir,
  type Conversa,
  type Controle,
  type Desfecho,
  type MotivoDeTransferencia,
} from "./conversa.js";
import type { UserId } from "./user-id.js";

declare const ana: UserId;
declare const bruno: UserId;
declare const agora: Date;
declare const comAgent: Conversa<"agent">;
declare const aguardando: Conversa<"aguardando">;
declare const comAnalista: Conversa<"analista">;
declare const qualquer: Conversa<Controle>;

describe("Conversa: garantias em tempo de compilação", () => {
  it("os estados de controle e os motivos são listas fechadas", () => {
    expectTypeOf<Controle>().toEqualTypeOf<"agent" | "aguardando" | "analista">();
    expectTypeOf<MotivoDeTransferencia>().toEqualTypeOf<
      "pedido_do_funcionario" | "caso_critico" | "chamado_vencido" | "baixa_confianca"
    >();
    expectTypeOf<Desfecho>().toEqualTypeOf<"devolvida" | "encerrada">();
  });

  it("toda conversa nasce com o agent", () => {
    expectTypeOf(novaConversa({ dono: ana })).toEqualTypeOf<Conversa<"agent">>();
  });

  it("só se transfere uma conversa que está com o agent", () => {
    transferir(comAgent, { motivo: "caso_critico", resumo: "rede parada", agora });
    // @ts-expect-error: já está na fila
    transferir(aguardando, { motivo: "caso_critico", resumo: "rede parada", agora });
    // @ts-expect-error: já está com um analista
    transferir(comAnalista, { motivo: "caso_critico", resumo: "rede parada", agora });
    // @ts-expect-error: motivo fora do Anexo A
    transferir(comAgent, { motivo: "porque_sim", resumo: "rede parada", agora });
  });

  it("só se assume uma conversa que está na fila", () => {
    expectTypeOf(assumir(aguardando, { analista: bruno, agora })).toEqualTypeOf<
      Conversa<"analista">
    >();
    // @ts-expect-error: o agent ainda está atendendo
    assumir(comAgent, { analista: bruno, agora });
    // @ts-expect-error: outro analista já assumiu
    assumir(comAnalista, { analista: bruno, agora });
  });

  it("só se finaliza uma conversa que está com um analista", () => {
    finalizar(comAnalista, { desfecho: "encerrada", por: bruno, agora });
    // @ts-expect-error: ninguém assumiu ainda
    finalizar(aguardando, { desfecho: "encerrada", por: bruno, agora });
    // @ts-expect-error: desfecho fora da lista
    finalizar(comAnalista, { desfecho: "resolvida", por: bruno, agora });
  });

  it("o analista só existe quando a conversa está com um analista", () => {
    expectTypeOf(comAnalista.analista).toEqualTypeOf<UserId>();
    expectTypeOf(aguardando).not.toHaveProperty("analista");
    expectTypeOf(comAgent).not.toHaveProperty("transferencia");
  });

  it("agentPodeResponder estreita o tipo para a conversa com o agent", () => {
    if (agentPodeResponder(qualquer)) {
      expectTypeOf(qualquer).toEqualTypeOf<Conversa<"agent">>();
    } else {
      expectTypeOf(qualquer).toEqualTypeOf<Conversa<"aguardando"> | Conversa<"analista">>();
    }
  });
});
