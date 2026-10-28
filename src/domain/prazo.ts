import { DIA, HORA } from "./tempo.js";

declare const relogioDeSaoPaulo: unique symbol;

type InstanteEmSaoPaulo = number & { readonly [relogioDeSaoPaulo]: true };

export type Prioridade = "critica" | "alta" | "media" | "baixa";

const DESLOCAMENTO_DE_SAO_PAULO = -3 * HORA;
const ABERTURA = 8 * HORA;
const FECHAMENTO = 18 * HORA;
const DOMINGO = 0;
const SABADO = 6;

type RegraDePrazo = {
  readonly relogio: "corrido" | "util";
  readonly horas: number;
};

const REGRAS = {
  critica: { relogio: "corrido", horas: 1 },
  alta: { relogio: "util", horas: 4 },
  media: { relogio: "util", horas: 30 },
  baixa: { relogio: "util", horas: 50 },
} as const satisfies Record<Prioridade, RegraDePrazo>;

export function calcularPrazo(prioridade: Prioridade, desde: Date): Date {
  const regra = REGRAS[prioridade];
  switch (regra.relogio) {
    case "corrido":
      return new Date(desde.getTime() + regra.horas * HORA);
    case "util":
      return somarHorasUteis(desde, regra.horas);
  }
}

export function estaVencido(prioridade: Prioridade, desde: Date, agora: Date): boolean {
  return agora.getTime() > calcularPrazo(prioridade, desde).getTime();
}

function somarHorasUteis(desde: Date, horas: number): Date {
  return deSaoPaulo(avancarNoExpediente(paraSaoPaulo(desde), horas * HORA));
}

function avancarNoExpediente(instante: InstanteEmSaoPaulo, restante: number): InstanteEmSaoPaulo {
  const inicio = proximoInstanteUtil(instante);
  const fechamento = fechamentoDe(inicioDoDia(inicio));
  const disponivel = fechamento - inicio;
  if (restante <= disponivel) return avancar(inicio, restante);
  return avancarNoExpediente(fechamento, restante - disponivel);
}

function proximoInstanteUtil(instante: InstanteEmSaoPaulo): InstanteEmSaoPaulo {
  const dia = inicioDoDia(instante);
  if (!ehDiaUtil(dia) || instante >= fechamentoDe(dia)) return aberturaDe(proximoDiaUtil(dia));
  return instante < aberturaDe(dia) ? aberturaDe(dia) : instante;
}

function proximoDiaUtil(dia: InstanteEmSaoPaulo): InstanteEmSaoPaulo {
  const seguinte = avancar(dia, DIA);
  return ehDiaUtil(seguinte) ? seguinte : proximoDiaUtil(seguinte);
}

function ehDiaUtil(dia: InstanteEmSaoPaulo): boolean {
  const diaDaSemana = new Date(dia).getUTCDay();
  return diaDaSemana !== DOMINGO && diaDaSemana !== SABADO;
}

function inicioDoDia(instante: InstanteEmSaoPaulo): InstanteEmSaoPaulo {
  return emSaoPaulo(Math.floor(instante / DIA) * DIA);
}

function aberturaDe(dia: InstanteEmSaoPaulo): InstanteEmSaoPaulo {
  return avancar(dia, ABERTURA);
}

function fechamentoDe(dia: InstanteEmSaoPaulo): InstanteEmSaoPaulo {
  return avancar(dia, FECHAMENTO);
}

function avancar(instante: InstanteEmSaoPaulo, duracao: number): InstanteEmSaoPaulo {
  return emSaoPaulo(instante + duracao);
}

function paraSaoPaulo(data: Date): InstanteEmSaoPaulo {
  return emSaoPaulo(data.getTime() + DESLOCAMENTO_DE_SAO_PAULO);
}

function deSaoPaulo(instante: InstanteEmSaoPaulo): Date {
  return new Date(instante - DESLOCAMENTO_DE_SAO_PAULO);
}

function emSaoPaulo(milissegundos: number): InstanteEmSaoPaulo {
  return milissegundos as InstanteEmSaoPaulo;
}
