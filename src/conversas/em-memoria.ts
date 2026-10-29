import { novaConversa, type Conversa, type Controle } from "../domain/conversa.js";
import { falha, sucesso } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { Conversas, ErroDeControle, Mensagem } from "./conversas.js";

const CONTROLE_MUDOU: ErroDeControle = { motivo: "controle_mudou" };

export function conversasEmMemoria(): Conversas {
  const porDono = new Map<UserId, Conversa<Controle>>();
  const mensagensPorDono = new Map<UserId, readonly Mensagem[]>();
  const conversaDe = (dono: UserId) => porDono.get(dono) ?? novaConversa({ dono });
  const mensagensDe = (dono: UserId) => mensagensPorDono.get(dono) ?? [];
  const acrescentar = (dono: UserId, ...novas: Mensagem[]) => {
    mensagensPorDono.set(dono, [...mensagensDe(dono), ...novas]);
  };

  return {
    atual: (dono) => {
      const conversa = conversaDe(dono);
      porDono.set(dono, conversa);
      const mensagensNaSessao = mensagensDe(dono).filter(
        (mensagem) => mensagem.autor === "funcionario",
      ).length;
      return Promise.resolve(sucesso({ conversa, mensagensNaSessao }));
    },
    transicionar: (depois, esperado) => {
      if (conversaDe(depois.dono).controle !== esperado) {
        return Promise.resolve(falha(CONTROLE_MUDOU));
      }
      porDono.set(depois.dono, depois);
      return Promise.resolve(sucesso(undefined));
    },
    registrarMensagem: (dono, { texto, agora }) => {
      acrescentar(dono, { autor: "funcionario", texto, enviadaEm: agora });
      return Promise.resolve(sucesso(undefined));
    },
    registrarTurno: (dono, { pergunta, resposta, agora }) => {
      acrescentar(dono, { autor: "funcionario", texto: pergunta, enviadaEm: agora });
      if (conversaDe(dono).controle !== "agent") return Promise.resolve(falha(CONTROLE_MUDOU));
      acrescentar(dono, {
        autor: "agent",
        texto: resposta.texto,
        enviadaEm: agora,
        registro: resposta.registro,
      });
      return Promise.resolve(sucesso(undefined));
    },
    historico: (dono) => Promise.resolve(sucesso(mensagensDe(dono))),
  };
}
