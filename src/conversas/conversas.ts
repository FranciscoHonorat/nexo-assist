import type { Conversa, Controle } from "../domain/conversa.js";
import type { Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { Json } from "../infraestrutura/json.js";

export type ConversaAtual = {
  readonly conversa: Conversa<Controle>;
  readonly mensagensNaSessao: number;
};

type CamposDaMensagem = {
  readonly texto: string;
  readonly enviadaEm: Date;
};

export type Mensagem =
  | (CamposDaMensagem & { readonly autor: "funcionario" })
  | (CamposDaMensagem & { readonly autor: "agent"; readonly registro: Json });

export type Turno = {
  readonly pergunta: string;
  readonly resposta: { readonly texto: string; readonly registro: Json };
  readonly agora: Date;
};

export type ErroDeControle = { readonly motivo: "controle_mudou" };

type Resposta<T, E = never> = Promise<Resultado<T, E | ErroDeInfraestrutura>>;

export type Conversas = {
  readonly atual: (dono: UserId) => Resposta<ConversaAtual>;
  readonly transicionar: (
    depois: Conversa<Controle>,
    esperado: Controle,
  ) => Resposta<undefined, ErroDeControle>;
  readonly registrarMensagem: (
    dono: UserId,
    mensagem: { readonly texto: string; readonly agora: Date },
  ) => Resposta<undefined>;
  readonly registrarTurno: (dono: UserId, turno: Turno) => Resposta<undefined, ErroDeControle>;
  readonly historico: (dono: UserId) => Resposta<readonly Mensagem[]>;
};
