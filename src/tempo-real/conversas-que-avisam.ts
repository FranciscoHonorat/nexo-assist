import type { Conversas } from "../conversas/conversas.js";
import type { Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { Avisos } from "./avisos.js";

export function conversasQueAvisam(conversas: Conversas, avisos: Avisos): Conversas {
  const avisarSeGravou =
    (dono: UserId) =>
    <R extends Resultado<unknown, { readonly motivo: string }>>(resultado: R): R => {
      if (resultado.ok || resultado.erro.motivo !== "indisponivel") avisos.avisar({ dono });
      return resultado;
    };
  return {
    atual: (dono) => conversas.atual(dono),
    historico: (dono, depois) => conversas.historico(dono, depois),
    guardarRascunho: (rascunho) => conversas.guardarRascunho(rascunho),
    rascunhoPendente: (id, dono) => conversas.rascunhoPendente(id, dono),
    transicionar: (transicao, agora) =>
      conversas.transicionar(transicao, agora).then(avisarSeGravou(transicao.depois.dono)),
    registrarMensagem: (dono, mensagem) =>
      conversas.registrarMensagem(dono, mensagem).then(avisarSeGravou(dono)),
    registrarMensagemDoAnalista: (conversa, mensagem) =>
      conversas.registrarMensagemDoAnalista(conversa, mensagem).then(avisarSeGravou(conversa.dono)),
    registrarTurno: (dono, turno) =>
      conversas.registrarTurno(dono, turno).then(avisarSeGravou(dono)),
    iniciarSessao: (dono, agora) => conversas.iniciarSessao(dono, agora).then(avisarSeGravou(dono)),
    resolverRascunho: (resolucao) =>
      conversas.resolverRascunho(resolucao).then(avisarSeGravou(resolucao.rascunho.dono)),
  };
}
