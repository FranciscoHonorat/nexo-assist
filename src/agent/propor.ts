import { lerPrioridade, podeSerAtualizado } from "../domain/chamado.js";
import { calcularPrazo } from "../domain/prazo.js";
import { novoRascunhoId } from "../domain/rascunho-id.js";
import { criarRascunho } from "../domain/rascunho.js";
import { falha, sucesso } from "../domain/resultado.js";
import { lerTicketId } from "../domain/ticket-id.js";
import type {
  ArgumentosInvalidos,
  PropostaDeChamado,
  PropostaDeComplemento,
  RespostaDa,
} from "./agent-step.js";
import type { ContextoDasTools } from "./tools.js";

export async function proporChamado(
  argumentos: PropostaDeChamado | ArgumentosInvalidos,
  { usuario, agora, servicos }: ContextoDasTools,
): Promise<RespostaDa<"propor_chamado">> {
  if ("invalidos" in argumentos) {
    return falha({ motivo: "argumentos_invalidos", campos: argumentos.invalidos });
  }
  const rascunho = criarRascunho({
    id: novoRascunhoId(),
    dono: usuario,
    conteudo: { tipo: "novo_chamado", dados: argumentos.dados },
    agora,
  });
  if (!rascunho.ok) return rascunho;
  const { dados } = rascunho.valor.conteudo;
  const prioridade = lerPrioridade(dados);
  if (!prioridade.ok) return prioridade;

  const doFuncionario = await servicos.chamados.listar(usuario);
  if (!doFuncionario.ok) return doFuncionario;
  const candidatos = doFuncionario.valor.filter(
    (chamado) =>
      chamado.dados.categoria === dados.categoria &&
      podeSerAtualizado(chamado, agora) &&
      !argumentos.chamadosConferidos.includes(chamado.id),
  );
  if (candidatos.length > 0) return falha({ motivo: "possivel_duplicidade", candidatos });

  const guardado = await servicos.rascunhos.guardarRascunho(rascunho.valor);
  if (!guardado.ok) return guardado;
  return sucesso({ rascunho: rascunho.valor, prazo: calcularPrazo(prioridade.valor, agora) });
}

export async function proporComplemento(
  argumentos: PropostaDeComplemento | ArgumentosInvalidos,
  { usuario, agora, servicos }: ContextoDasTools,
): Promise<RespostaDa<"propor_complemento">> {
  if ("invalidos" in argumentos) {
    return falha({ motivo: "argumentos_invalidos", campos: argumentos.invalidos });
  }
  const id = lerTicketId(argumentos.chamado);
  if (!id.ok) return id;
  const chamado = await servicos.chamados.obter(id.valor, usuario);
  if (!chamado.ok) return chamado;
  if (!podeSerAtualizado(chamado.valor, agora)) {
    return falha({ motivo: "resolvido_ha_mais_de_7_dias", id: chamado.valor.id });
  }
  const rascunho = criarRascunho({
    id: novoRascunhoId(),
    dono: usuario,
    conteudo: { tipo: "complemento", chamado: chamado.valor.id, texto: argumentos.texto },
    agora,
  });
  if (!rascunho.ok) return rascunho;
  const guardado = await servicos.rascunhos.guardarRascunho(rascunho.valor);
  if (!guardado.ok) return guardado;
  return sucesso({ rascunho: rascunho.valor, chamado: chamado.valor });
}
