import type {
  ApiDoChat,
  ApiDoConsole,
  ErroDaApi,
  EstadoDaConversa,
  LoteDaApi,
  MensagemDaApi,
  PessoaDaApi,
} from "../../../src/http/contrato.js";

export type { ApiDoChat, ApiDoConsole, ErroDaApi, EstadoDaConversa, LoteDaApi, MensagemDaApi };

export type Pessoa = PessoaDaApi["pessoa"];
export type RegistroDaApi = Extract<MensagemDaApi, { readonly autor: "agent" }>["registro"];
export type EventoDaApi = Extract<MensagemDaApi, { readonly autor: "sistema" }>["evento"];
export type PassoDaApi = RegistroDaApi["trace"][number];
export type ResumoDaApi = ApiDoConsole["lista"]["conversas"][number];
export type DetalheDaApi = ApiDoConsole["detalhe"];
export type ChamadoDaApi = DetalheDaApi["chamados"][number];
export type RascunhoDaApi = NonNullable<RegistroDaApi["anexos"]["rascunho"]>;
export type Nomes = LoteDaApi["nomes"];
