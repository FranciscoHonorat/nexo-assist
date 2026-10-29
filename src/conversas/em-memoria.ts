import { novaConversa, type Conversa, type Controle } from "../domain/conversa.js";
import { sucesso } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { Conversas } from "./conversas.js";

export function conversasEmMemoria(): Conversas {
  const porDono = new Map<UserId, Conversa<Controle>>();
  return {
    atual: (dono) => {
      const conversa = porDono.get(dono) ?? novaConversa({ dono });
      porDono.set(dono, conversa);
      return Promise.resolve(sucesso({ conversa, mensagensNaSessao: 0 }));
    },
  };
}
