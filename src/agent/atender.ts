import type { Conversas, Turno } from "../conversas/conversas.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { TicketClient } from "../tickets/ticket-client.js";
import type { AgentStep } from "./agent-step.js";
import { prepararTurno, type Interrupcao } from "./guardas.js";
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

export type Atendimento = {
  readonly tipo: "resposta";
  readonly resposta: RespostaDoTurno;
};

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
  const resposta = preparado.ok
    ? await executarTurno(preparado.valor, modelo, chamados)
    : respostaDaInterrupcao(preparado.erro);

  const registrado = await conversas.registrarTurno(
    usuario,
    turnoParaGravar(mensagem, resposta, agora),
  );
  if (!registrado.ok) {
    if (registrado.erro.motivo === "controle_mudou") {
      throw new Error("analista assumiu durante o turno: ainda sem tratamento");
    }
    return falha(registrado.erro);
  }
  return sucesso({ tipo: "resposta", resposta });
}

function turnoParaGravar(pergunta: string, resposta: RespostaDoTurno, agora: Date): Turno {
  const { mensagem, ...registro } = resposta;
  return { pergunta, resposta: { texto: mensagem, registro }, agora };
}

function respostaDaInterrupcao(interrupcao: Interrupcao): RespostaDoTurno {
  if (interrupcao.motivo !== "limite_da_sessao") {
    throw new Error("conversa fora do agent: silêncio ainda sem tratamento");
  }
  return {
    mensagem: interrupcao.resposta,
    declaracao: null,
    confianca: "baixa",
    trace: interrupcao.trace,
  };
}
