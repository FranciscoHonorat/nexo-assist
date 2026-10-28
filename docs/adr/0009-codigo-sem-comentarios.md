# ADR-0009: Código sem comentários

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

Um comentário que explica **o que** o código faz indica que um nome pode ser melhor. Sobre o
**porquê**, há duas escolas:

- _Tidy First?_ (Kent Beck): apaga comentários redundantes, mas aceita comentários explicativos
  quando o código não consegue expressar a razão.
- _Clean Code_ (Robert Martin): comentários são, em geral, uma falha em se expressar pelo código.

## Decisão

O código não tem comentários.

- O **o quê** vira nome: de variável, função, tipo, constante ou de bloco de configuração (a
  configuração flat do ESLint aceita a propriedade `name`).
- O **porquê** mora nos ADRs e nas mensagens de commit.
- **Exceção:** a descrição depois de `// @ts-expect-error:` nos testes de tipo. Ela é a mensagem
  da asserção, o equivalente ao texto de um `it("...")`.

Também evitamos módulos genéricos como `utils`: cada módulo tem um conceito com nome
(`validado.ts`, `resultado.ts`).

## Opções consideradas

| Opção                                                   | Onde mora o porquê       |
| ------------------------------------------------------- | ------------------------ |
| Comentários explicativos no arquivo                     | No próprio código        |
| **Sem comentários; porquê em ADR e commit (escolhida)** | Documentação e histórico |

## Análise de trade-offs

A escolha aproveita o histórico de commits, que o PRD já valoriza, e força nomes melhores. O
custo: quem lê o código precisa ir ao ADR ou ao `git log` para entender uma restrição externa.

## Consequências

- Mais fácil: manter código e explicação em sincronia, porque o nome muda com o código.
- Mais difícil: registrar restrições externas (versões, limites), que exigem um ADR ou um corpo
  de commit.
- Ao fim de cada passo, procurar comentários restantes no código.

## Itens de ação

1. [x] Remover os comentários existentes.
2. [ ] Avaliar uma regra de lint que proíba comentários fora de `@ts-expect-error`.
