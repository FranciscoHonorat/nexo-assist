import type { Resultado } from "../domain/resultado.js";

export function valorDe<T>(resultado: Resultado<T, unknown>): T {
  if (!resultado.ok) throw new Error("fixture inválida");
  return resultado.valor;
}
