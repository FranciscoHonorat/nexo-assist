import type { EventoDaConversa, Mensagem } from "../conversas/conversas.js";
import type { MensagemAnterior } from "./agent-step.js";

export function paraMensagemAnterior(mensagem: Mensagem): MensagemAnterior {
  return mensagem.autor === "sistema"
    ? { autor: "sistema", texto: descreverEvento(mensagem.evento) }
    : { autor: mensagem.autor, texto: mensagem.texto };
}

function descreverEvento(evento: EventoDaConversa): string {
  switch (evento.tipo) {
    case "transferida":
      return `A conversa foi transferida para um analista (motivo: ${evento.motivo}).`;
    case "assumida":
      return `O analista ${evento.analista} assumiu a conversa.`;
    case "devolvida":
      return "O analista devolveu a conversa ao agent.";
    case "encerrada":
      return "O analista encerrou o atendimento.";
    case "chamado_criado":
      return `O funcionário confirmou o rascunho e o chamado ${evento.chamado} foi criado.`;
    case "chamado_complementado":
      return `O funcionário confirmou o complemento e o chamado ${evento.chamado} foi atualizado.`;
    case "rascunho_descartado":
      return "O funcionário descartou o rascunho; nada foi criado.";
    case "sessao_iniciada":
      return "O funcionário começou uma nova sessão.";
  }
}
