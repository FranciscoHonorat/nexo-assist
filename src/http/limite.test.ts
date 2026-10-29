import { describe, expect, it } from "vitest";
import { MINUTO } from "../domain/tempo.js";
import { ana, joao } from "../testes/usuarios.js";
import { criarLimiteDeTurnos } from "./limite.js";

const inicio = new Date("2026-10-29T13:00:00Z");
const depois = (minutos: number) => new Date(inicio.getTime() + minutos * MINUTO);

describe("Limite de turnos por pessoa: protege o custo do LLM", () => {
  it("Dado um turno da Ana em andamento, Quando ela manda outro, Então o segundo espera o primeiro", () => {
    const limite = criarLimiteDeTurnos({ maximo: 10, janela: 60 * MINUTO });

    expect(limite.comecar(ana, inicio)).toBe("liberado");
    expect(limite.comecar(ana, inicio)).toBe("turno_em_andamento");
    expect(limite.comecar(joao, inicio)).toBe("liberado");

    limite.terminar(ana);
    expect(limite.comecar(ana, inicio)).toBe("liberado");
  });

  it("Dado o máximo de turnos na janela, Então o próximo é recusado até a janela andar", () => {
    const limite = criarLimiteDeTurnos({ maximo: 2, janela: 60 * MINUTO });
    for (const minuto of [0, 10]) {
      limite.comecar(ana, depois(minuto));
      limite.terminar(ana);
    }

    expect(limite.comecar(ana, depois(59))).toBe("limite_excedido");
    expect(limite.comecar(ana, depois(60))).toBe("liberado");
  });
});
