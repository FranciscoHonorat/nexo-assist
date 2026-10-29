import type { Chamado } from "../domain/chamado.js";
import { agentPodeResponder, type Conversa, type Controle } from "../domain/conversa.js";
import { estaVencido } from "../domain/prazo.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { MensagemAnterior } from "./agent-step.js";

declare const preparadoPelasGuardas: unique symbol;

export const LIMITE_DE_MENSAGENS_POR_SESSAO = 30;

export const RESPOSTA_DO_LIMITE =
  "Você chegou ao limite de 30 mensagens desta sessão. Se precisar, posso chamar um analista, ou você pode continuar numa nova sessão.";

type ResultadosPorGuarda = {
  controle: "passou" | "interrompeu";
  limite: "passou" | "interrompeu";
  vencidos: "passou" | "nao_verificou";
};

export type NomeDaGuarda = keyof ResultadosPorGuarda;

export type PassoDaGuarda<N extends NomeDaGuarda = NomeDaGuarda> = {
  [Nome in N]: {
    readonly etapa: "guarda";
    readonly nome: Nome;
    readonly resultado: ResultadosPorGuarda[Nome];
    readonly detalhe: string;
  };
}[N];

type TraceDasGuardas = readonly PassoDaGuarda[];

export type Interrupcao =
  | { readonly motivo: "conversa_na_fila"; readonly trace: TraceDasGuardas }
  | { readonly motivo: "conversa_com_analista"; readonly trace: TraceDasGuardas }
  | {
      readonly motivo: "limite_da_sessao";
      readonly resposta: string;
      readonly trace: TraceDasGuardas;
    };

export type EntradaDoTurno = {
  readonly usuario: UserId;
  readonly conversa: Conversa<Controle>;
  readonly mensagem: string;
  readonly anteriores: readonly MensagemAnterior[];
  readonly mensagensNaSessao: number;
  readonly agora: Date;
};

export type TurnoPronto = {
  readonly usuario: UserId;
  readonly conversa: Conversa<"agent">;
  readonly mensagem: string;
  readonly anteriores: readonly MensagemAnterior[];
  readonly agora: Date;
  readonly chamadosVencidos: readonly Chamado[];
  readonly trace: TraceDasGuardas;
  readonly [preparadoPelasGuardas]: true;
};

export async function prepararTurno(
  { usuario, conversa, mensagem, anteriores, mensagensNaSessao, agora }: EntradaDoTurno,
  chamados: TicketClient,
): Promise<Resultado<TurnoPronto, Interrupcao>> {
  const controle = guardaDoControle(conversa);
  if (!controle.ok) return controle;

  const limite = guardaDoLimite(mensagensNaSessao);
  if (!limite.ok) return interrompidoDepoisDe([controle.valor.passo], limite.erro);

  const vencidos = await guardaDosVencidos(usuario, agora, chamados);

  return sucesso(
    marcarComoPronto({
      usuario,
      conversa: controle.valor.conversa,
      mensagem,
      anteriores,
      agora,
      chamadosVencidos: vencidos.chamadosVencidos,
      trace: [controle.valor.passo, limite.valor.passo, vencidos.passo],
    }),
  );
}

function guardaDoControle(
  conversa: Conversa<Controle>,
): Resultado<{ readonly conversa: Conversa<"agent">; readonly passo: PassoDaGuarda }, Interrupcao> {
  if (agentPodeResponder(conversa)) {
    return sucesso({ conversa, passo: passo("controle", "passou", "conversa com o agent") });
  }
  switch (conversa.controle) {
    case "aguardando":
      return falha({
        motivo: "conversa_na_fila",
        trace: [passo("controle", "interrompeu", "conversa aguardando um analista")],
      });
    case "analista":
      return falha({
        motivo: "conversa_com_analista",
        trace: [passo("controle", "interrompeu", `conversa com ${conversa.analista}`)],
      });
  }
}

function guardaDoLimite(
  mensagensNaSessao: number,
): Resultado<{ readonly passo: PassoDaGuarda }, Interrupcao> {
  const numeroDaMensagem = mensagensNaSessao + 1;
  const contagem = `${String(numeroDaMensagem)} de ${String(LIMITE_DE_MENSAGENS_POR_SESSAO)} mensagens`;
  if (numeroDaMensagem > LIMITE_DE_MENSAGENS_POR_SESSAO) {
    return falha({
      motivo: "limite_da_sessao",
      resposta: RESPOSTA_DO_LIMITE,
      trace: [passo("limite", "interrompeu", contagem)],
    });
  }
  return sucesso({ passo: passo("limite", "passou", contagem) });
}

async function guardaDosVencidos(
  usuario: UserId,
  agora: Date,
  chamados: TicketClient,
): Promise<{ readonly chamadosVencidos: readonly Chamado[]; readonly passo: PassoDaGuarda }> {
  const doUsuario = await chamados.listar(usuario);
  if (!doUsuario.ok) {
    return {
      chamadosVencidos: [],
      passo: passo("vencidos", "nao_verificou", "serviço de chamados indisponível"),
    };
  }
  const chamadosVencidos = doUsuario.valor.filter(
    (chamado) =>
      chamado.status !== "resolvido" &&
      estaVencido(chamado.dados.prioridade, chamado.atualizadoEm, agora),
  );
  const detalhe =
    chamadosVencidos.length === 0
      ? "nenhum chamado vencido"
      : chamadosVencidos.map((chamado) => `${chamado.id} vencido`).join(", ");
  return { chamadosVencidos, passo: passo("vencidos", "passou", detalhe) };
}

function interrompidoDepoisDe(
  anteriores: TraceDasGuardas,
  interrupcao: Interrupcao,
): Resultado<never, Interrupcao> {
  return falha({ ...interrupcao, trace: [...anteriores, ...interrupcao.trace] });
}

function passo<N extends NomeDaGuarda>(
  nome: N,
  resultado: ResultadosPorGuarda[N],
  detalhe: string,
): PassoDaGuarda<N> {
  return { etapa: "guarda", nome, resultado, detalhe };
}

function marcarComoPronto(turno: Omit<TurnoPronto, typeof preparadoPelasGuardas>): TurnoPronto {
  return Object.freeze(turno) as TurnoPronto;
}
