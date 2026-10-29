import { describe, expectTypeOf, it } from "vitest";
import type { Conversa } from "../domain/conversa.js";
import type { Transicao } from "./conversas.js";

declare const comAgent: Conversa<"agent">;
declare const aguardando: Conversa<"aguardando">;
declare const comAnalista: Conversa<"analista">;

describe("Transicao: o evento amarra o estado de antes e o de depois", () => {
  it("cada evento só aceita os estados que fazem sentido para ele", () => {
    expectTypeOf({
      evento: "assumida",
      antes: aguardando,
      depois: comAnalista,
    } as const).toExtend<Transicao>();
    expectTypeOf({
      evento: "devolvida",
      antes: aguardando,
      depois: comAgent,
    } as const).toExtend<Transicao>();

    // @ts-expect-error: assumir leva a conversa ao analista, nunca de volta ao agent
    const assumidaParaOAgent: Transicao = {
      evento: "assumida",
      antes: aguardando,
      depois: comAgent,
    };
    // @ts-expect-error: só encerra quem assumiu; uma conversa na fila é devolvida
    const encerradaNaFila: Transicao = {
      evento: "encerrada",
      antes: aguardando,
      depois: comAgent,
    };
    // @ts-expect-error: só a conversa com o agent é transferida para a fila
    const transferidaDoAnalista: Transicao = {
      evento: "transferida",
      antes: comAnalista,
      depois: aguardando,
    };
    expectTypeOf([assumidaParaOAgent, encerradaNaFila, transferidaDoAnalista]).toBeArray();
  });
});
