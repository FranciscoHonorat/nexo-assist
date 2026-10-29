import { novaConversa, type Conversa, type Controle } from "../domain/conversa.js";
import { falha, sucesso } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { RascunhoId } from "../domain/rascunho-id.js";
import type { Rascunho, StatusRascunho } from "../domain/rascunho.js";
import {
  DESDE_O_COMECO,
  maisRecentePrimeiro,
  eventoDa,
  eventoDaResolucao,
  mesmoControle,
  resolvidoEm,
  type ConteudoDaMensagem,
  type Conversas,
  type ErroDeControle,
  type Mensagem,
} from "./conversas.js";

const CONTROLE_MUDOU: ErroDeControle = { motivo: "controle_mudou" };

export function conversasEmMemoria(): Conversas {
  const porDono = new Map<UserId, Conversa<Controle>>();
  const mensagensPorDono = new Map<UserId, readonly Mensagem[]>();
  const rascunhos = new Map<RascunhoId, Rascunho<StatusRascunho>>();
  const sessaoDesde = new Map<UserId, number>();
  const conversaDe = (dono: UserId) => porDono.get(dono) ?? novaConversa({ dono });
  const mensagensDe = (dono: UserId) => mensagensPorDono.get(dono) ?? [];
  const daSessao = (dono: UserId, depois = DESDE_O_COMECO) => {
    const desde = Math.max(depois, sessaoDesde.get(dono) ?? DESDE_O_COMECO);
    return mensagensDe(dono).filter((mensagem) => mensagem.id > desde);
  };
  let ultimoId = 0;
  const acrescentar = (dono: UserId, enviadaEm: Date, conteudo: ConteudoDaMensagem) => {
    ultimoId += 1;
    mensagensPorDono.set(dono, [...mensagensDe(dono), { ...conteudo, id: ultimoId, enviadaEm }]);
  };

  return {
    atual: (dono) => {
      const conversa = conversaDe(dono);
      porDono.set(dono, conversa);
      const mensagensNaSessao = doFuncionario(daSessao(dono));
      return Promise.resolve(sucesso({ conversa, mensagensNaSessao }));
    },
    listar: () => {
      const resumos = [...porDono.values()].map((conversa) => {
        const daSessaoAtual = daSessao(conversa.dono);
        return {
          conversa,
          ultima: daSessaoAtual.at(-1) ?? null,
          mensagensNaSessao: doFuncionario(daSessaoAtual),
        };
      });
      return Promise.resolve(sucesso(resumos.toSorted(maisRecentePrimeiro)));
    },
    transicionar: (transicao, agora) => {
      const { antes, depois } = transicao;
      if (!mesmoControle(conversaDe(depois.dono), antes)) {
        return Promise.resolve(falha(CONTROLE_MUDOU));
      }
      porDono.set(depois.dono, depois);
      acrescentar(depois.dono, agora, { autor: "sistema", evento: eventoDa(transicao) });
      return Promise.resolve(sucesso(undefined));
    },
    registrarMensagem: (dono, { texto, agora }) => {
      acrescentar(dono, agora, { autor: "funcionario", texto });
      return Promise.resolve(sucesso(undefined));
    },
    registrarMensagemDoAnalista: (conversa, { texto, agora }) => {
      if (!mesmoControle(conversaDe(conversa.dono), conversa)) {
        return Promise.resolve(falha(CONTROLE_MUDOU));
      }
      acrescentar(conversa.dono, agora, { autor: "analista", analista: conversa.analista, texto });
      return Promise.resolve(sucesso(undefined));
    },
    registrarTurno: (dono, { pergunta, resposta, agora }) => {
      acrescentar(dono, agora, { autor: "funcionario", texto: pergunta });
      if (conversaDe(dono).controle !== "agent") return Promise.resolve(falha(CONTROLE_MUDOU));
      acrescentar(dono, agora, { autor: "agent", ...resposta });
      return Promise.resolve(sucesso(undefined));
    },
    iniciarSessao: (dono, agora) => {
      if (conversaDe(dono).controle !== "agent") return Promise.resolve(falha(CONTROLE_MUDOU));
      sessaoDesde.set(dono, ultimoId);
      acrescentar(dono, agora, { autor: "sistema", evento: { tipo: "sessao_iniciada" } });
      return Promise.resolve(sucesso(undefined));
    },
    historico: (dono, depois) => Promise.resolve(sucesso(daSessao(dono, depois))),
    guardarRascunho: (rascunho) => {
      rascunhos.set(rascunho.id, rascunho);
      return Promise.resolve(sucesso(undefined));
    },
    rascunhoPendente: (id, dono) => {
      const rascunho = rascunhos.get(id);
      if (rascunho?.dono !== dono) {
        return Promise.resolve(falha({ motivo: "rascunho_nao_encontrado" }));
      }
      if (rascunho.status !== "pendente") {
        return Promise.resolve(falha({ motivo: "rascunho_ja_resolvido", status: rascunho.status }));
      }
      return Promise.resolve(sucesso(rascunho));
    },
    resolverRascunho: (resolucao) => {
      const resolvido = resolucao.rascunho;
      const atual = rascunhos.get(resolvido.id);
      if (atual === undefined) throw new Error("rascunho resolvido sem ter sido guardado");
      if (atual.status !== "pendente") {
        return Promise.resolve(falha({ motivo: "rascunho_ja_resolvido", status: atual.status }));
      }
      rascunhos.set(resolvido.id, resolvido);
      acrescentar(resolvido.dono, resolvidoEm(resolucao), {
        autor: "sistema",
        evento: eventoDaResolucao(resolucao),
      });
      return Promise.resolve(sucesso(undefined));
    },
  };
}

function doFuncionario(mensagens: readonly Mensagem[]): number {
  return mensagens.filter(({ autor }) => autor === "funcionario").length;
}
