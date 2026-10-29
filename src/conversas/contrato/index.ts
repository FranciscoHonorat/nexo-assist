import { describe } from "vitest";
import type { Conversas } from "../conversas.js";
import { cenariosDaConversaAtual } from "./atual.js";
import { cenariosDosTurnos } from "./turnos.js";

export type FabricaDeConversas = () => Conversas | Promise<Conversas>;

export function verificarContratoDeConversas(
  implementacao: string,
  fabricar: FabricaDeConversas,
): void {
  describe(`Conversas (${implementacao}): contrato`, () => {
    cenariosDaConversaAtual(fabricar);
    cenariosDosTurnos(fabricar);
  });
}
