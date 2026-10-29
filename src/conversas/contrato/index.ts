import { describe } from "vitest";
import type { Conversas } from "../conversas.js";
import { cenariosDoAnalista } from "./analista.js";
import { cenariosDaConversaAtual } from "./atual.js";
import { cenariosDoHistorico } from "./historico.js";
import { cenariosDaLista } from "./listar.js";
import { cenariosDosRascunhos } from "./rascunhos.js";
import { cenariosDaSessao } from "./sessao.js";
import { cenariosDasTransicoes } from "./transicoes.js";
import { cenariosDosTurnos } from "./turnos.js";

export type FabricaDeConversas = () => Conversas | Promise<Conversas>;

export function verificarContratoDeConversas(
  implementacao: string,
  fabricar: FabricaDeConversas,
): void {
  describe(`Conversas (${implementacao}): contrato`, () => {
    cenariosDaConversaAtual(fabricar);
    cenariosDosTurnos(fabricar);
    cenariosDoHistorico(fabricar);
    cenariosDasTransicoes(fabricar);
    cenariosDosRascunhos(fabricar);
    cenariosDoAnalista(fabricar);
    cenariosDaSessao(fabricar);
    cenariosDaLista(fabricar);
  });
}
