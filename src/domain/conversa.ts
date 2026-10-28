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

type PorControle = {
  agent: {
    readonly dono: UserId;
    readonly controle: "agent";
  };
  aguardando: {
    readonly dono: UserId;
    readonly controle: "aguardando";
    readonly transferencia: Transferencia;
  };
  analista: {
    readonly dono: UserId;
    readonly controle: "analista";
    readonly transferencia: Transferencia;
    readonly analista: UserId;
    readonly assumidaEm: Date;
  };
};

export type Controle = keyof PorControle;

export type Conversa<C extends Controle> = PorControle[C];

export type AtendimentoFinalizado = {
  readonly dono: UserId;
  readonly transferencia: Transferencia;
  readonly analista: UserId;
  readonly assumidaEm: Date;
  readonly desfecho: Desfecho;
  readonly finalizadoEm: Date;
};

export type ErroDeTransferencia = { readonly motivo: "resumo_vazio" };

export type ErroDeFinalizacao = { readonly motivo: "nao_e_o_analista"; readonly tentouPor: UserId };

export function novaConversa({ dono }: { readonly dono: UserId }): Conversa<"agent"> {
  return Object.freeze({ dono, controle: "agent" });
}

export function transferir(
  conversa: Conversa<"agent">,
  {
    motivo,
    resumo,
    agora,
  }: { readonly motivo: MotivoDeTransferencia; readonly resumo: string; readonly agora: Date },
): Resultado<Conversa<"aguardando">, ErroDeTransferencia> {
  const resumoAparado = resumo.trim();
  if (resumoAparado === "") return falha({ motivo: "resumo_vazio" });
  return sucesso(
    Object.freeze({
      dono: conversa.dono,
      controle: "aguardando",
      transferencia: { motivo, resumo: resumoAparado, pedidaEm: agora },
    }),
  );
}

export function assumir(
  conversa: Conversa<"aguardando">,
  { analista, agora }: { readonly analista: UserId; readonly agora: Date },
): Conversa<"analista"> {
  return Object.freeze({ ...conversa, controle: "analista", analista, assumidaEm: agora });
}

export function finalizar(
  conversa: Conversa<"analista">,
  {
    desfecho,
    por,
    agora,
  }: { readonly desfecho: Desfecho; readonly por: UserId; readonly agora: Date },
): Resultado<
  { readonly conversa: Conversa<"agent">; readonly atendimento: AtendimentoFinalizado },
  ErroDeFinalizacao
> {
  if (por !== conversa.analista) return falha({ motivo: "nao_e_o_analista", tentouPor: por });
  return sucesso({
    conversa: novaConversa({ dono: conversa.dono }),
    atendimento: Object.freeze({
      dono: conversa.dono,
      transferencia: conversa.transferencia,
      analista: conversa.analista,
      assumidaEm: conversa.assumidaEm,
      desfecho,
      finalizadoEm: agora,
    }),
  });
}

export function agentPodeResponder(conversa: Conversa<Controle>): conversa is Conversa<"agent"> {
  return conversa.controle === "agent";
}
