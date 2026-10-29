import type { Conversa, Controle } from "../domain/conversa.js";
import type { Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";

export type ConversaAtual = {
  readonly conversa: Conversa<Controle>;
  readonly mensagensNaSessao: number;
};

export type Conversas = {
  readonly atual: (dono: UserId) => Promise<Resultado<ConversaAtual, ErroDeInfraestrutura>>;
};
