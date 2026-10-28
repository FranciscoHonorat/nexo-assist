export type Prioridade = "critica" | "alta" | "media" | "baixa";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
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
  let local = desde.getTime() + DESLOCAMENTO_DE_SAO_PAULO;
  let restante = horas * HORA;
  for (;;) {
    local = proximoInstanteUtil(local);
    const fechamento = inicioDoDia(local) + FECHAMENTO;
    const disponivel = fechamento - local;
    if (restante <= disponivel) return new Date(local + restante - DESLOCAMENTO_DE_SAO_PAULO);
    restante -= disponivel;
    local = fechamento;
  }
}

function proximoInstanteUtil(local: number): number {
  const dia = inicioDoDia(local);
  if (ehDiaUtil(dia) && local < dia + ABERTURA) return dia + ABERTURA;
  if (ehDiaUtil(dia) && local < dia + FECHAMENTO) return local;
  let proximoDia = dia + DIA;
  while (!ehDiaUtil(proximoDia)) proximoDia += DIA;
  return proximoDia + ABERTURA;
}

function inicioDoDia(local: number): number {
  return Math.floor(local / DIA) * DIA;
}

function ehDiaUtil(inicioDoDia: number): boolean {
  const diaDaSemana = new Date(inicioDoDia).getUTCDay();
  return diaDaSemana !== DOMINGO && diaDaSemana !== SABADO;
}
