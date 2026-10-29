export type Artigo = {
  readonly id: string;
  readonly titulo: string;
  readonly conteudo: string;
};

export const LIMITE_DE_ARTIGOS = 3;

const PESO_NO_TITULO = 2;
const PESO_NO_CONTEUDO = 1;
const TAMANHO_MINIMO_PARA_VARIACAO = 4;

const PALAVRAS_VAZIAS = new Set(
  (
    "a o as os um uma de da do das dos em na no nas nos para pra por com sem que qual quais " +
    "quando como onde meu minha meus minhas seu sua e ou mas nao sim ser esta estou tem ter " +
    "isso esse essa eu voce me se ao aos pelo pela"
  ).split(" "),
);

export type CentralDeAjuda = {
  readonly buscar: (consulta: string) => readonly Artigo[];
};

type ArtigoIndexado = {
  readonly artigo: Artigo;
  readonly termosDoTitulo: readonly string[];
  readonly termosDoConteudo: readonly string[];
};

export function criarCentralDeAjuda(artigos: readonly Artigo[]): CentralDeAjuda {
  const indexados = artigos.map((artigo): ArtigoIndexado => ({
    artigo,
    termosDoTitulo: termosDe(artigo.titulo),
    termosDoConteudo: termosDe(artigo.conteudo),
  }));
  return {
    buscar: (consulta) => {
      const termos = termosDe(consulta);
      if (termos.length === 0) return [];
      return indexados
        .map((indexado) => ({ artigo: indexado.artigo, relevancia: relevancia(termos, indexado) }))
        .filter(({ relevancia }) => relevancia > 0)
        .sort((a, b) => b.relevancia - a.relevancia)
        .slice(0, LIMITE_DE_ARTIGOS)
        .map(({ artigo }) => artigo);
    },
  };
}

function relevancia(
  termos: readonly string[],
  { termosDoTitulo, termosDoConteudo }: ArtigoIndexado,
): number {
  return termos.reduce((soma, termo) => {
    if (contem(termosDoTitulo, termo)) return soma + PESO_NO_TITULO;
    if (contem(termosDoConteudo, termo)) return soma + PESO_NO_CONTEUDO;
    return soma;
  }, 0);
}

function contem(palavras: readonly string[], termo: string): boolean {
  return palavras.some((palavra) => mesmaPalavra(palavra, termo));
}

function mesmaPalavra(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < TAMANHO_MINIMO_PARA_VARIACAO) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function termosDe(texto: string): readonly string[] {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((palavra) => palavra !== "" && !PALAVRAS_VAZIAS.has(palavra));
}
