import { describe } from "vitest";
import { cenariosDeAlteracaoDeStatus } from "./alterar-status.js";
import { cenariosDeComplemento } from "./complementar.js";
import { cenariosDeConsulta } from "./consulta.js";
import { cenariosDeCriacao } from "./criar.js";
import type { Fabrica } from "./fixtures.js";

export function verificarContratoDoTicketClient(implementacao: string, fabricar: Fabrica): void {
  describe(`TicketClient (${implementacao}): contrato`, () => {
    cenariosDeConsulta(fabricar);
    cenariosDeCriacao(fabricar);
    cenariosDeComplemento(fabricar);
    cenariosDeAlteracaoDeStatus(fabricar);
  });
}
