import type { UserId } from "../domain/user-id.js";

export type PoliticaDeTurnos = { readonly maximo: number; readonly janela: number };

export type Liberacao = "liberado" | "turno_em_andamento" | "limite_excedido";

export function criarLimiteDeTurnos({ maximo, janela }: PoliticaDeTurnos) {
  const emAndamento = new Set<UserId>();
  const iniciosPorPessoa = new Map<UserId, readonly number[]>();
  return {
    comecar: (pessoa: UserId, agora: Date): Liberacao => {
      if (emAndamento.has(pessoa)) return "turno_em_andamento";
      const recentes = (iniciosPorPessoa.get(pessoa) ?? []).filter(
        (inicio) => agora.getTime() - inicio < janela,
      );
      iniciosPorPessoa.set(pessoa, recentes);
      if (recentes.length >= maximo) return "limite_excedido";
      iniciosPorPessoa.set(pessoa, [...recentes, agora.getTime()]);
      emAndamento.add(pessoa);
      return "liberado";
    },
    terminar: (pessoa: UserId) => {
      emAndamento.delete(pessoa);
    },
  };
}

export type LimiteDeTurnos = ReturnType<typeof criarLimiteDeTurnos>;
