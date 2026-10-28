export type Resultado<T, E> =
  { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly erro: E };

export function sucesso<T>(valor: T): Resultado<T, never> {
  return { ok: true, valor };
}

export function falha<E>(erro: E): Resultado<never, E> {
  return { ok: false, erro };
}

export function encadear<T, E, U, F>(
  resultado: Resultado<T, E>,
  proximo: (valor: T) => Resultado<U, F>,
): Resultado<U, E | F> {
  return resultado.ok ? proximo(resultado.valor) : resultado;
}
