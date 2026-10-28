import { describe, expect, it } from "vitest";
import { calcularPrazo, estaVencido, type Prioridade } from "./prazo.js";

const emSaoPaulo = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

describe("calcularPrazo", () => {
  it.each<[string, Prioridade, string, string]>([
    ["crítica corre 24h, mesmo de madrugada", "critica", "2026-10-28T23:30", "2026-10-29T00:30"],
    ["crítica corre no fim de semana", "critica", "2026-10-31T03:00", "2026-10-31T04:00"],

    ["alta dentro do expediente", "alta", "2026-10-28T10:00", "2026-10-28T14:00"],
    ["alta terminando no fechamento", "alta", "2026-10-28T14:00", "2026-10-28T18:00"],
    ["alta atravessando a noite", "alta", "2026-10-28T16:00", "2026-10-29T10:00"],
    ["alta atravessando o fim de semana", "alta", "2026-10-30T17:00", "2026-11-02T11:00"],
    ["alta aberta no sábado começa na segunda", "alta", "2026-10-31T10:00", "2026-11-02T12:00"],
    ["alta aberta antes do expediente", "alta", "2026-10-28T07:00", "2026-10-28T12:00"],
    ["alta aberta depois do expediente", "alta", "2026-10-28T20:00", "2026-10-29T12:00"],

    ["média são 3 dias úteis", "media", "2026-10-26T10:00", "2026-10-29T10:00"],
    ["média atravessando o fim de semana", "media", "2026-10-29T10:00", "2026-11-03T10:00"],

    ["baixa são 5 dias úteis", "baixa", "2026-10-26T10:00", "2026-11-02T10:00"],
    ["baixa aberta na sexta após o fechamento", "baixa", "2026-10-23T18:00", "2026-10-30T18:00"],
  ])("%s", (_, prioridade, desde, esperado) => {
    expect(calcularPrazo(prioridade, emSaoPaulo(desde))).toEqual(emSaoPaulo(esperado));
  });

  it("usa o horário de São Paulo, não o fuso da máquina", () => {
    const quartaAs17e30EmSaoPaulo = new Date("2026-10-28T20:30:00Z");

    expect(calcularPrazo("alta", quartaAs17e30EmSaoPaulo)).toEqual(
      new Date("2026-10-29T14:30:00Z"),
    );
  });

  it("não altera a data recebida", () => {
    const desde = emSaoPaulo("2026-10-28T16:00");

    calcularPrazo("alta", desde);

    expect(desde).toEqual(emSaoPaulo("2026-10-28T16:00"));
  });
});

describe("estaVencido", () => {
  const desde = emSaoPaulo("2026-10-28T10:00");

  it("exatamente no prazo ainda não está vencido", () => {
    expect(estaVencido("alta", desde, emSaoPaulo("2026-10-28T14:00"))).toBe(false);
  });

  it("passado o prazo, está vencido", () => {
    expect(estaVencido("alta", desde, emSaoPaulo("2026-10-28T14:01"))).toBe(true);
  });

  it("crítica vence uma hora depois, a qualquer hora", () => {
    expect(estaVencido("critica", desde, emSaoPaulo("2026-10-28T11:01"))).toBe(true);
  });

  it("o caso do INC-20311: média sem atualização há 6 dias está vencida", () => {
    const ultimaAtualizacao = emSaoPaulo("2026-10-22T10:00");

    expect(estaVencido("media", ultimaAtualizacao, emSaoPaulo("2026-10-28T10:00"))).toBe(true);
  });
});
