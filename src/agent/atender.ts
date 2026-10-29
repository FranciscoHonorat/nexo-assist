import {
  DESDE_O_COMECO,
  type Conversas,
  type Mensagem,
  type Turno,
} from "../conversas/conversas.js";
import { transferir, type Conversa } from "../domain/conversa.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import { comoJson } from "../infraestrutura/json.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { AgentStep, MensagemAnterior } from "./agent-step.js";
import { paraMensagemAnterior } from "./eventos.js";
import { prepararTurno, type Interrupcao, type TurnoPronto } from "./guardas.js";
import { executarTurno, SEM_ANEXOS, type RespostaDoTurno, type ServicosDoTurno } from "./turno.js";

export type MensagemRecebida = {
  readonly usuario: UserId;
  readonly mensagem: string;
  readonly agora: Date;
};

export type Dependencias = {
  readonly conversas: Conversas;
  readonly chamados: TicketClient;
  readonly modelo: AgentStep;
};

export const MENSAGENS_ANTERIORES_NO_CONTEXTO = 20;

type MotivoDoSilencio = "conversa_na_fila" | "conversa_com_analista" | "analista_assumiu";

export type Atendimento =
  | { readonly tipo: "resposta"; readonly resposta: RespostaDoTurno }
  | { readonly tipo: "silencio"; readonly motivo: MotivoDoSilencio };

export async function atenderMensagem(
  { usuario, mensagem, agora }: MensagemRecebida,
  { conversas, chamados, modelo }: Dependencias,
): Promise<Resultado<Atendimento, ErroDeInfraestrutura>> {
  const atual = await conversas.atual(usuario);
  if (!atual.ok) return atual;
  const { conversa, mensagensNaSessao } = atual.valor;
  const historico = await conversas.historico(usuario, DESDE_O_COMECO);
  if (!historico.ok) return historico;

  const preparado = await prepararTurno(
    {
      usuario,
      conversa,
      mensagem,
      anteriores: anterioresDo(historico.valor),
      mensagensNaSessao,
      agora,
    },
    chamados,
  );
  const decidido = await decidirResposta(preparado, modelo, { chamados, rascunhos: conversas });
  if (!decidido.ok) {
    const registrada = await conversas.registrarMensagem(usuario, { texto: mensagem, agora });
    return registrada.ok ? sucesso(silencio(decidido.erro)) : registrada;
  }

  const registrado = await conversas.registrarTurno(
    usuario,
    turnoParaGravar(mensagem, decidido.valor, agora),
  );
  if (!registrado.ok) {
    return registrado.erro.motivo === "controle_mudou"
      ? sucesso(silencio("analista_assumiu"))
      : falha(registrado.erro);
  }
  if (preparado.ok) {
    const transferida = await aplicarTransferencia(
      conversas,
      preparado.valor.conversa,
      decidido.valor,
      agora,
    );
    if (!transferida.ok) return transferida;
  }
  return sucesso({ tipo: "resposta", resposta: decidido.valor });
}

async function aplicarTransferencia(
  conversas: Conversas,
  conversa: Conversa<"agent">,
  { transferencia }: RespostaDoTurno,
  agora: Date,
): Promise<Resultado<undefined, ErroDeInfraestrutura>> {
  if (transferencia === null) return sucesso(undefined);
  const fila = transferir(conversa, { ...transferencia, agora });
  if (!fila.ok) throw new Error("o turno entregou uma transferência sem resumo");
  const transicao = await conversas.transicionar(
    { evento: "transferida", antes: conversa, depois: fila.valor },
    agora,
  );
  if (!transicao.ok && transicao.erro.motivo === "indisponivel") return falha(transicao.erro);
  return sucesso(undefined);
}

async function decidirResposta(
  preparado: Resultado<TurnoPronto, Interrupcao>,
  modelo: AgentStep,
  servicos: ServicosDoTurno,
): Promise<Resultado<RespostaDoTurno, MotivoDoSilencio>> {
  if (preparado.ok) return sucesso(await executarTurno(preparado.valor, modelo, servicos));
  switch (preparado.erro.motivo) {
    case "limite_da_sessao":
      return sucesso({
        mensagem: preparado.erro.resposta,
        declaracao: null,
        confianca: "baixa",
        transferencia: null,
        anexos: SEM_ANEXOS,
        trace: preparado.erro.trace,
      });
    case "conversa_na_fila":
    case "conversa_com_analista":
      return falha(preparado.erro.motivo);
  }
}

function anterioresDo(historico: readonly Mensagem[]): readonly MensagemAnterior[] {
  return historico.slice(-MENSAGENS_ANTERIORES_NO_CONTEXTO).map(paraMensagemAnterior);
}

function silencio(motivo: MotivoDoSilencio): Atendimento {
  return { tipo: "silencio", motivo };
}

function turnoParaGravar(pergunta: string, resposta: RespostaDoTurno, agora: Date): Turno {
  const { mensagem, ...registro } = resposta;
  return { pergunta, resposta: { texto: mensagem, registro: comoJson(registro) }, agora };
}
