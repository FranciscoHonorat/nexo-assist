import { falha, type Resultado } from "../domain/resultado.js";
import { INDISPONIVEL, type ErroDeInfraestrutura } from "./indisponivel.js";

const CODIGOS_DE_REDE = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
]);

const CLASSE_DE_CONEXAO_DO_POSTGRES = "08";

const SQLSTATES_DE_INDISPONIBILIDADE = new Set(["57P01", "57P02", "57P03", "53300"]);

const MENSAGENS_DE_CONEXAO_ENCERRADA = [
  "Connection terminated",
  "Client has encountered a connection error",
  "timeout exceeded when trying to connect",
];

export function ehFalhaDeInfraestrutura(erro: unknown): boolean {
  return cadeiaDeCausas(erro).some(ehFalhaDireta);
}

function cadeiaDeCausas(erro: unknown): readonly Error[] {
  const vistos = new Set<unknown>();
  const cadeia: Error[] = [];
  let atual = erro;
  while (atual instanceof Error && !vistos.has(atual)) {
    vistos.add(atual);
    cadeia.push(atual);
    atual = atual.cause;
  }
  return cadeia;
}

function ehFalhaDireta(erro: Error): boolean {
  const codigo = "code" in erro && typeof erro.code === "string" ? erro.code : undefined;
  if (codigo !== undefined) {
    return (
      CODIGOS_DE_REDE.has(codigo) ||
      codigo.startsWith(CLASSE_DE_CONEXAO_DO_POSTGRES) ||
      SQLSTATES_DE_INDISPONIBILIDADE.has(codigo)
    );
  }
  return MENSAGENS_DE_CONEXAO_ENCERRADA.some((inicio) => erro.message.startsWith(inicio));
}

export async function protegerDaQuedaDoBanco<T, E extends { readonly motivo: string }>(
  executar: () => Promise<Resultado<T, E>>,
): Promise<Resultado<T, E | ErroDeInfraestrutura>> {
  try {
    return await executar();
  } catch (erro) {
    if (ehFalhaDeInfraestrutura(erro)) return falha(INDISPONIVEL);
    throw erro;
  }
}
