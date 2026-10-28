import type { Chamado } from "../domain/chamado.js";
import { agentPodeResponder, type Conversa, type Controle } from "../domain/conversa.js";
import { estaVencido } from "../domain/prazo.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { TicketClient } from "../tickets/ticket-client.js";

declare const preparadoPelasGuardas: unique symbol;

export const LIMITE_DE_MENSAGENS_POR_SESSAO = 30;

export const RESPOSTA_DO_LIMITE =
  "Você chegou ao limite de 30 mensagens desta sessão. Se precisar, posso chamar um analista, ou você pode continuar numa nova sessão.";

export type NomeDaGuarda = "controle" | "limite" | "vencidos";

export type PassoDoTrace = {
  readonly guarda: NomeDaGuarda;
  readonly resultado: "passou" | "interrompeu" | "nao_verificou";
  readonly detalhe: string;
};

type Trace = readonly PassoDoTrace[];

export type Interrupcao =
  | { readonly motivo: "conversa_na_fila"; readonly trace: Trace }
  | { readonly motivo: "conversa_com_analista"; readonly trace: Trace }
  | { readonly motivo: "limite_da_sessao"; readonly resposta: string; readonly trace: Trace };

export type EntradaDoTurno = {
  readonly usuario: UserId;
  readonly conversa: Conversa<Controle>;
  readonly mensagem: string;
  readonly mensagensNaSessao: number;
  readonly agora: Date;
};

export type TurnoPronto = {
  readonly usuario: UserId;
  readonly conversa: Conversa<"agent">;
  readonly mensagem: string;
  readonly agora: Date;
  readonly chamadosVencidos: readonly Chamado[];
  readonly trace: Trace;
  readonly [preparadoPelasGuardas]: true;
};

export async function prepararTurno(
  { usuario, conversa, mensagem, mensagensNaSessao, agora }: EntradaDoTurno,
  chamados: TicketClient,
): Promise<Resultado<TurnoPronto, Interrupcao>> {
  if (!agentPodeResponder(conversa)) {
    switch (conversa.controle) {
      case "aguardando":
        return falha({
          motivo: "conversa_na_fila",
          trace: [
            {
              guarda: "controle",
              resultado: "interrompeu",
              detalhe: "conversa aguardando um analista",
            },
          ],
        });
      case "analista":
        return falha({
          motivo: "conversa_com_analista",
          trace: [
            {
              guarda: "controle",
              resultado: "interrompeu",
              detalhe: `conversa com ${conversa.analista}`,
            },
          ],
        });
    }
  }
  const controle: PassoDoTrace = {
    guarda: "controle",
    resultado: "passou",
    detalhe: "conversa com o agent",
  };

  const numeroDaMensagem = mensagensNaSessao + 1;
  const contagem = `${String(numeroDaMensagem)} de ${String(LIMITE_DE_MENSAGENS_POR_SESSAO)} mensagens`;
  if (numeroDaMensagem > LIMITE_DE_MENSAGENS_POR_SESSAO) {
    return falha({
      motivo: "limite_da_sessao",
      resposta: RESPOSTA_DO_LIMITE,
      trace: [controle, { guarda: "limite", resultado: "interrompeu", detalhe: contagem }],
    });
  }
  const limite: PassoDoTrace = { guarda: "limite", resultado: "passou", detalhe: contagem };

  const doUsuario = await chamados.listar(usuario);
  if (!doUsuario.ok) {
    return sucesso(
      marcarComoPronto({
        usuario,
        conversa,
        mensagem,
        agora,
        chamadosVencidos: [],
        trace: [
          controle,
          limite,
          {
            guarda: "vencidos",
            resultado: "nao_verificou",
            detalhe: "serviço de chamados indisponível",
          },
        ],
      }),
    );
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

  return sucesso(
    marcarComoPronto({
      usuario,
      conversa,
      mensagem,
      agora,
      chamadosVencidos,
      trace: [controle, limite, { guarda: "vencidos", resultado: "passou", detalhe }],
    }),
  );
}

function marcarComoPronto(turno: Omit<TurnoPronto, typeof preparadoPelasGuardas>): TurnoPronto {
  return Object.freeze(turno) as TurnoPronto;
}
