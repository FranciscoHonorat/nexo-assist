import { EventEmitter } from "node:events";
import type { UserId } from "../domain/user-id.js";

export type AvisoDeConversa = { readonly dono: UserId };

export type Avisos = {
  readonly avisar: (aviso: AvisoDeConversa) => void;
  readonly ouvir: (ouvinte: (aviso: AvisoDeConversa) => void) => () => void;
};

const CONVERSA_MUDOU = "conversa_mudou";

export function avisosEmProcesso(): Avisos {
  const emissor = new EventEmitter<{ [CONVERSA_MUDOU]: [AvisoDeConversa] }>();
  emissor.setMaxListeners(0);
  return {
    avisar: (aviso) => emissor.emit(CONVERSA_MUDOU, aviso),
    ouvir: (ouvinte) => {
      emissor.on(CONVERSA_MUDOU, ouvinte);
      return () => emissor.off(CONVERSA_MUDOU, ouvinte);
    },
  };
}
