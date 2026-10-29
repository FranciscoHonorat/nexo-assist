import type { Resultado } from "../domain/resultado.js";
import { envolverOperacoes, type TicketClient } from "./ticket-client.js";
import { ehIndisponivel } from "../infraestrutura/indisponivel.js";

export type PoliticaDeRetry = {
  readonly tentativas: number;
  readonly esperaInicial: number;
  readonly fator: number;
};

export type DependenciasDeEspera = {
  readonly esperar: (milissegundos: number) => Promise<void>;
  readonly aleatorio: () => number;
};

const POLITICA_PADRAO: PoliticaDeRetry = { tentativas: 4, esperaInicial: 200, fator: 2 };

const RELOGIO_REAL: DependenciasDeEspera = {
  esperar: (milissegundos) =>
    new Promise((resolve) => {
      setTimeout(resolve, milissegundos);
    }),
  aleatorio: Math.random,
};

export function ticketClientResiliente(
  base: TicketClient,
  politica: PoliticaDeRetry = POLITICA_PADRAO,
  { esperar, aleatorio }: DependenciasDeEspera = RELOGIO_REAL,
): TicketClient {
  const tentar = async <T, E extends { readonly motivo: string }>(
    executar: () => Promise<Resultado<T, E>>,
    tentativa = 0,
  ): Promise<Resultado<T, E>> => {
    const resultado = await executar();
    const ultimaTentativa = tentativa + 1 >= politica.tentativas;
    if (resultado.ok || !ehIndisponivel(resultado.erro) || ultimaTentativa) return resultado;
    await esperar(esperaComJitter(politica, tentativa, aleatorio()));
    return tentar(executar, tentativa + 1);
  };

  return envolverOperacoes(base, (executar) => tentar(executar));
}

function esperaComJitter(
  { esperaInicial, fator }: PoliticaDeRetry,
  tentativa: number,
  sorteio: number,
): number {
  const metade = (esperaInicial * fator ** tentativa) / 2;
  return metade + sorteio * metade;
}
