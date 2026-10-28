import { falha, sucesso, type Resultado } from "./resultado.js";
import type { UserId } from "./user-id.js";

export type MotivoDeTransferencia =
  "pedido_do_funcionario" | "caso_critico" | "chamado_vencido" | "baixa_confianca";

export type Desfecho = "devolvida" | "encerrada";

type Transferencia = {
  readonly motivo: MotivoDeTransferencia;
  readonly resumo: string;
  readonly pedidaEm: Date;
};

type CamposComuns = {
  readonly dono: UserId;
};

type ComTransferencia = CamposComuns & {
  readonly transferencia: Transferencia;
};

type PorControle = {
  agent: CamposComuns & {
    readonly controle: "agent";
  };
  aguardando: ComTransferencia & {
    readonly controle: "aguardando";
  };
  analista: ComTransferencia & {
    readonly controle: "analista";
    readonly analista: UserId;
    readonly assumidaEm: Date;
  };
};

export type Controle = keyof PorControle;

export type Conversa<C extends Controle> = PorControle[C];

export type AtendimentoFinalizado = Omit<Conversa<"analista">, "controle"> & {
  readonly desfecho: Desfecho;
  readonly finalizadoEm: Date;
};

export type ConversaFinalizada = {
  readonly conversa: Conversa<"agent">;
  readonly atendimento: AtendimentoFinalizado;
};

export type ErroDeTransferencia = { readonly motivo: "resumo_vazio" };

export type ErroDeFinalizacao = { readonly motivo: "nao_e_o_analista"; readonly tentouPor: UserId };

type PedidoDeTransferencia = {
  readonly motivo: MotivoDeTransferencia;
  readonly resumo: string;
  readonly agora: Date;
};

type Assuncao = {
  readonly analista: UserId;
  readonly agora: Date;
};

type Finalizacao = {
  readonly desfecho: Desfecho;
  readonly por: UserId;
  readonly agora: Date;
};

export function novaConversa({ dono }: CamposComuns): Conversa<"agent"> {
  return Object.freeze({ dono, controle: "agent" });
}

export function transferir(
  { dono }: Conversa<"agent">,
  { motivo, resumo, agora }: PedidoDeTransferencia,
): Resultado<Conversa<"aguardando">, ErroDeTransferencia> {
  const resumoAparado = resumo.trim();
  if (resumoAparado === "") return falha({ motivo: "resumo_vazio" });
  return sucesso(
    Object.freeze({
      dono,
      controle: "aguardando",
      transferencia: { motivo, resumo: resumoAparado, pedidaEm: agora },
    }),
  );
}

export function assumir(
  conversa: Conversa<"aguardando">,
  { analista, agora }: Assuncao,
): Conversa<"analista"> {
  return Object.freeze({ ...conversa, controle: "analista", analista, assumidaEm: agora });
}

export function finalizar(
  conversa: Conversa<"analista">,
  { desfecho, por, agora }: Finalizacao,
): Resultado<ConversaFinalizada, ErroDeFinalizacao> {
  if (por !== conversa.analista) return falha({ motivo: "nao_e_o_analista", tentouPor: por });
  const { controle, ...atendimento } = conversa;
  return sucesso({
    conversa: novaConversa({ dono: conversa.dono }),
    atendimento: Object.freeze({ ...atendimento, desfecho, finalizadoEm: agora }),
  });
}

export function agentPodeResponder(conversa: Conversa<Controle>): conversa is Conversa<"agent"> {
  return conversa.controle === "agent";
}
