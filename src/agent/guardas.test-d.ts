import { describe, expectTypeOf, it } from "vitest";
import type { Chamado } from "../domain/chamado.js";
import type { Conversa } from "../domain/conversa.js";
import type { UserId } from "../domain/user-id.js";
import type { Interrupcao, PassoDaGuarda, TurnoPronto } from "./guardas.js";

declare function chamarOAgent(turno: TurnoPronto): void;
declare function registrar(passo: PassoDaGuarda): void;
declare const conversa: Conversa<"agent">;
declare const ana: UserId;

describe("Guardas: garantias em tempo de compilação", () => {
  it("depois das guardas, a conversa é sempre do agent", () => {
    expectTypeOf<TurnoPronto["conversa"]>().toEqualTypeOf<Conversa<"agent">>();
    expectTypeOf<TurnoPronto["chamadosVencidos"]>().toEqualTypeOf<readonly Chamado[]>();
  });

  it("um turno não pode ser montado à mão, pulando as guardas", () => {
    const forjado = {
      usuario: ana,
      conversa,
      mensagem: "oi",
      anteriores: [],
      agora: new Date(),
      chamadosVencidos: [],
      trace: [],
    };

    // @ts-expect-error: só prepararTurno produz um TurnoPronto
    chamarOAgent(forjado);
  });

  it("os motivos de interrupção e os resultados das guardas são listas fechadas", () => {
    expectTypeOf<Interrupcao["motivo"]>().toEqualTypeOf<
      "conversa_na_fila" | "conversa_com_analista" | "limite_da_sessao"
    >();
    expectTypeOf<PassoDaGuarda["resultado"]>().toEqualTypeOf<
      "passou" | "interrompeu" | "nao_verificou"
    >();
  });

  it("só a interrupção por limite tem resposta; nas outras o agent fica em silêncio", () => {
    expectTypeOf<Extract<Interrupcao, { motivo: "limite_da_sessao" }>>().toHaveProperty("resposta");
    expectTypeOf<Extract<Interrupcao, { motivo: "conversa_na_fila" }>>().not.toHaveProperty(
      "resposta",
    );
  });

  it("cada guarda só registra os resultados que ela pode produzir", () => {
    registrar({ etapa: "guarda", nome: "controle", resultado: "interrompeu", detalhe: "" });
    registrar({ etapa: "guarda", nome: "limite", resultado: "interrompeu", detalhe: "" });
    registrar({ etapa: "guarda", nome: "vencidos", resultado: "nao_verificou", detalhe: "" });

    // @ts-expect-error: a guarda de vencidos nunca interrompe o turno
    registrar({ etapa: "guarda", nome: "vencidos", resultado: "interrompeu", detalhe: "" });
    // @ts-expect-error: a guarda de controle não depende de serviço externo, então sempre verifica
    registrar({ etapa: "guarda", nome: "controle", resultado: "nao_verificou", detalhe: "" });
    // @ts-expect-error: a guarda de limite não depende de serviço externo, então sempre verifica
    registrar({ etapa: "guarda", nome: "limite", resultado: "nao_verificou", detalhe: "" });
  });
});
