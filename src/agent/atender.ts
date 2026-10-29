import type { Conversas, Turno } from "../conversas/conversas.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { AgentStep } from "./agent-step.js";
import { prepararTurno, type Interrupcao, type TurnoPronto } from "./guardas.js";
import { executarTurno, type RespostaDoTurno } from "./turno.js";

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

  const preparado = await prepararTurno(
    { usuario, conversa, mensagem, mensagensNaSessao, agora },
    chamados,
  );
  const decidido = await decidirResposta(preparado, modelo, chamados);
  if (!decidido.ok) {
    const registrada = await conversas.registrarMensagem(usuario, { texto: mensagem, agora });
    return registrada.ok ? sucesso(silencio(decidido.erro)) : registrada;
  }

  const registrado = await conversas.registrarTurno(
    usuario,
    turnoParaGravar(mensagem, decidido.valor, agora),
  );
  if (registrado.ok) return sucesso({ tipo: "resposta", resposta: decidido.valor });
  if (registrado.erro.motivo === "controle_mudou") return sucesso(silencio("analista_assumiu"));
  return falha(registrado.erro);
}

async function decidirResposta(
  preparado: Resultado<TurnoPronto, Interrupcao>,
  modelo: AgentStep,
  chamados: TicketClient,
): Promise<Resultado<RespostaDoTurno, MotivoDoSilencio>> {
  if (preparado.ok) return sucesso(await executarTurno(preparado.valor, modelo, chamados));
  switch (preparado.erro.motivo) {
    case "limite_da_sessao":
      return sucesso({
        mensagem: preparado.erro.resposta,
        declaracao: null,
        confianca: "baixa",
        trace: preparado.erro.trace,
      });
    case "conversa_na_fila":
    case "conversa_com_analista":
      return falha(preparado.erro.motivo);
  }
}

function silencio(motivo: MotivoDoSilencio): Atendimento {
  return { tipo: "silencio", motivo };
}

function turnoParaGravar(pergunta: string, resposta: RespostaDoTurno, agora: Date): Turno {
  const { mensagem, ...registro } = resposta;
  return { pergunta, resposta: { texto: mensagem, registro }, agora };
}
