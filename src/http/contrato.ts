import type { Pessoa } from "../acesso/diretorio.js";
import type { Atendimento } from "../agent/atender.js";
import type { RespostaDoTurno } from "../agent/turno.js";
import type { ErroDoConsole } from "../console/atendimento.js";
import type { Mensagem, ResumoDaConversa } from "../conversas/conversas.js";
import type { Chamado } from "../domain/chamado.js";
import type { Controle, Conversa } from "../domain/conversa.js";
import type { JsonDe } from "../infraestrutura/json.js";
import type { ErroDeConfirmacao } from "../agent/confirmar.js";
import type { ErroDeControle } from "../conversas/conversas.js";

export type RegistroDoAgent = Omit<RespostaDoTurno, "mensagem">;

type MensagemComRegistro =
  | Exclude<Mensagem, { readonly autor: "agent" }>
  | (Omit<Extract<Mensagem, { readonly autor: "agent" }>, "registro"> & {
      readonly registro: RegistroDoAgent;
    });

export type MensagemDaApi = JsonDe<MensagemComRegistro>;

export type NomesDosAnalistas = Readonly<Record<string, string>>;

export type EstadoDaConversa = {
  readonly controle: Controle;
  readonly mensagensNaSessao: number;
  readonly limite: number;
};

export type LoteDeMensagens = {
  readonly mensagens: readonly Mensagem[];
  readonly nomes: NomesDosAnalistas;
};

export type LoteDaApi = {
  readonly mensagens: readonly MensagemDaApi[];
  readonly nomes: NomesDosAnalistas;
};

export type ResumoNoConsole = Omit<ResumoDaConversa, "conversa"> & {
  readonly pessoa: Pessoa;
  readonly conversa: Conversa<Controle>;
};

export type DetalheNoConsole = {
  readonly pessoa: Pessoa;
  readonly conversa: Conversa<Controle>;
  readonly mensagens: readonly Mensagem[];
  readonly nomes: NomesDosAnalistas;
  readonly chamados: readonly Chamado[];
};

export type ApiDoConsole = {
  readonly lista: {
    readonly conversas: readonly (JsonDe<Omit<ResumoNoConsole, "ultima">> & {
      readonly ultima: MensagemDaApi | null;
    })[];
  };
  readonly detalhe: JsonDe<Omit<DetalheNoConsole, "mensagens">> & {
    readonly mensagens: readonly MensagemDaApi[];
  };
};

export type ApiDoChat = {
  readonly atendimento: JsonDe<Atendimento>;
  readonly chamado: JsonDe<{ readonly chamado: Chamado }>;
};

export type PessoaDaApi = JsonDe<{ readonly pessoa: Pessoa }>;

export type MotivoDeErro = (ErroDeConfirmacao | ErroDoConsole | ErroDeControle)["motivo"];

export type ErroDaApi = {
  readonly erro:
    | MotivoDeErro
    | "credenciais_invalidas"
    | "corpo_invalido"
    | "sem_sessao"
    | "sem_permissao"
    | "turno_em_andamento"
    | "limite_excedido";
};
