import type { Conversas, ErroDeControle } from "../conversas/conversas.js";
import {
  assumir,
  finalizar,
  novaConversa,
  peloAnalista,
  type Controle,
  type Conversa,
  type Desfecho,
  type ErroDoAnalista,
} from "../domain/conversa.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";

export type AcaoDoAnalista = {
  readonly dono: UserId;
  readonly analista: UserId;
  readonly agora: Date;
};

export type ErroDoConsole =
  | { readonly motivo: "conversa_em_outro_estado"; readonly controle: Controle }
  | { readonly motivo: "campo_vazio"; readonly campo: "texto" }
  | ErroDoAnalista
  | ErroDeControle
  | ErroDeInfraestrutura;

type Feito = Promise<Resultado<undefined, ErroDoConsole>>;

export async function assumirConversa(acao: AcaoDoAnalista, conversas: Conversas): Feito {
  const conversa = await conversaDe(acao, conversas);
  if (!conversa.ok) return conversa;
  if (conversa.valor.controle !== "aguardando") return emOutroEstado(conversa.valor);
  return conversas.transicionar(
    { evento: "assumida", antes: conversa.valor, depois: assumir(conversa.valor, acao) },
    acao.agora,
  );
}

export async function responderComoAnalista(
  { texto, ...acao }: AcaoDoAnalista & { readonly texto: string },
  conversas: Conversas,
): Feito {
  const aparado = texto.trim();
  if (aparado === "") return falha({ motivo: "campo_vazio", campo: "texto" });
  const conversa = await conversaDe(acao, conversas);
  if (!conversa.ok) return conversa;
  if (conversa.valor.controle !== "analista") return emOutroEstado(conversa.valor);
  const doAnalista = peloAnalista(conversa.valor, acao.analista);
  if (!doAnalista.ok) return doAnalista;
  return conversas.registrarMensagemDoAnalista(doAnalista.valor, {
    texto: aparado,
    agora: acao.agora,
  });
}

export async function devolverAoAgent(acao: AcaoDoAnalista, conversas: Conversas): Feito {
  const conversa = await conversaDe(acao, conversas);
  if (!conversa.ok) return conversa;
  switch (conversa.valor.controle) {
    case "agent":
      return emOutroEstado(conversa.valor);
    case "aguardando":
      return conversas.transicionar(
        { evento: "devolvida", antes: conversa.valor, depois: novaConversa(conversa.valor) },
        acao.agora,
      );
    case "analista":
      return finalizarAtendimento(conversa.valor, "devolvida", acao, conversas);
  }
}

export async function encerrarAtendimento(acao: AcaoDoAnalista, conversas: Conversas): Feito {
  const conversa = await conversaDe(acao, conversas);
  if (!conversa.ok) return conversa;
  if (conversa.valor.controle !== "analista") return emOutroEstado(conversa.valor);
  return finalizarAtendimento(conversa.valor, "encerrada", acao, conversas);
}

async function conversaDe({ dono }: AcaoDoAnalista, conversas: Conversas) {
  const atual = await conversas.atual(dono);
  return atual.ok ? sucesso(atual.valor.conversa) : atual;
}

async function finalizarAtendimento(
  conversa: Conversa<"analista">,
  desfecho: Desfecho,
  { analista, agora }: AcaoDoAnalista,
  conversas: Conversas,
): Feito {
  const finalizada = finalizar(conversa, { desfecho, por: analista, agora });
  if (!finalizada.ok) return finalizada;
  return conversas.transicionar(
    { evento: desfecho, antes: conversa, depois: finalizada.valor.conversa },
    agora,
  );
}

function emOutroEstado(conversa: Conversa<Controle>): Resultado<never, ErroDoConsole> {
  return falha({ motivo: "conversa_em_outro_estado", controle: conversa.controle });
}
