import type { Resultado } from "../domain/resultado.js";
import type { TicketClient } from "./ticket-client.js";

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
  const espera = (tentativa: number): number => {
    const metade = (politica.esperaInicial * politica.fator ** tentativa) / 2;
    return metade + aleatorio() * metade;
  };

  const tentar = async <T, E extends { readonly motivo: string }>(
    executar: () => Promise<Resultado<T, E>>,
    tentativa = 0,
  ): Promise<Resultado<T, E>> => {
    const resultado = await executar();
    const ultimaTentativa = tentativa + 1 >= politica.tentativas;
    if (resultado.ok || resultado.erro.motivo !== "indisponivel" || ultimaTentativa)
      return resultado;
    await esperar(espera(tentativa));
    return tentar(executar, tentativa + 1);
  };

  return {
    listar: (dono) => tentar(() => base.listar(dono)),
    obter: (id, por) => tentar(() => base.obter(id, por)),
    criar: (rascunho, agora) => tentar(() => base.criar(rascunho, agora)),
    complementar: (rascunho, agora) => tentar(() => base.complementar(rascunho, agora)),
    alterarStatus: (id, alteracao, agora) => tentar(() => base.alterarStatus(id, alteracao, agora)),
  };
}
