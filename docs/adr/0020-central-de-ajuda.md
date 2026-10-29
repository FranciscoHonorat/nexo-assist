# ADR-0020: Central de ajuda com busca por palavras, no código

**Status:** Aceito
**Data:** 2026-10-29
**Decisores:** FranciscoHonorat

## Contexto

O PRD pede de 5 a 10 artigos curtos e que o agent resolva dúvidas por eles, sem abrir chamado.
Com poucos artigos, curtos e em português, a busca precisa encontrar o artigo pelas palavras do
funcionário, com ou sem acento, no singular ou no plural.

## Decisão

- `src/ajuda` tem os 8 artigos de exemplo (`artigos.ts`) e `criarCentralDeAjuda(artigos)`, que
  indexa os termos de cada artigo **uma vez** e devolve `buscar(consulta)`.
- Os termos são normalizados: sem acento, minúsculos, sem palavras vazias ("de", "minha", "qual").
  Duas palavras de 4 letras ou mais são a mesma quando uma começa com a outra ("senha" e
  "senhas").
- Cada termo da consulta vale 2 se aparece no título e 1 se aparece só no conteúdo. Saem no máximo
  3 artigos, do mais relevante para o menos, e nada sai se nenhum termo bate.
- O agent usa a tool `buscar_artigos`; o trace registra a consulta e os ids encontrados.

## Opções consideradas

| Opção                            | Infraestrutura extra    | Custo por busca      | Acerto com 8 artigos |
| -------------------------------- | ----------------------- | -------------------- | -------------------- |
| Todos os artigos no prompt       | Nenhuma                 | Tokens em todo turno | Alto                 |
| Embeddings e busca vetorial      | Modelo e índice         | Uma chamada          | Alto                 |
| Full-text search do PostgreSQL   | Configuração `unaccent` | Uma consulta         | Alto                 |
| **Busca por palavras no código** | Nenhuma                 | Zero                 | Alto                 |

## Análise de trade-offs

Colocar os artigos no prompt gastaria tokens em todo turno, mesmo nos que não são dúvidas,
contra o critério de custo por conversa. Embeddings e full-text acertariam melhor sinônimos
("internet" por "rede"), mas trazem infraestrutura para 8 artigos. A busca no código é pura,
testável e roda em microssegundos. Se a central crescer, a interface `CentralDeAjuda` permite
trocar a implementação sem mexer no agent.

## Como foi verificado

7 testes: o artigo do erro 809 primeiro, busca sem acento, plural, assunto fora da central, busca
só com palavras vazias, limite de 3 com ordem por relevância e o tamanho da central de exemplo.

## Consequências

- Mais fácil: acrescentar um artigo é uma entrada em `ARTIGOS`.
- Mais difícil: sinônimos não são encontrados; o modelo pode reformular a consulta e buscar de
  novo.

## Itens de ação

1. [x] Artigos de exemplo e busca.
2. [x] Tool `buscar_artigos`.
3. [ ] Medir na eval quantas dúvidas são resolvidas sem chamado.
