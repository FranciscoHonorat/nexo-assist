import { novaConversa, type Conversa, type Controle } from "../domain/conversa.js";
import { sucesso } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { Conversas, Mensagem } from "./conversas.js";

export function conversasEmMemoria(): Conversas {
  const porDono = new Map<UserId, Conversa<Controle>>();
  const mensagensPorDono = new Map<UserId, readonly Mensagem[]>();
  const mensagensDe = (dono: UserId) => mensagensPorDono.get(dono) ?? [];

  return {
    atual: (dono) => {
      const conversa = porDono.get(dono) ?? novaConversa({ dono });
      porDono.set(dono, conversa);
      const mensagensNaSessao = mensagensDe(dono).filter(
        (mensagem) => mensagem.autor === "funcionario",
      ).length;
      return Promise.resolve(sucesso({ conversa, mensagensNaSessao }));
    },
    registrarTurno: (dono, { pergunta, resposta, agora }) => {
      mensagensPorDono.set(dono, [
        ...mensagensDe(dono),
        { autor: "funcionario", texto: pergunta, enviadaEm: agora },
        { autor: "agent", texto: resposta.texto, enviadaEm: agora, registro: resposta.registro },
      ]);
      return Promise.resolve(sucesso(undefined));
    },
    historico: (dono) => Promise.resolve(sucesso(mensagensDe(dono))),
  };
}
