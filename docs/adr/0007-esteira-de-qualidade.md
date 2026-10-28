# ADR-0007: Esteira de qualidade local e no CI; versões fixas

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O projeto segue princípios de DevOps: cada passo é um incremento com significado próprio e
qualidade máxima, e a branch principal fica sempre verde. O PRD valoriza commits que contam a
história do desenvolvimento.

## Decisão

Todo incremento passa pelos mesmos portões, **antes do commit** (lefthook) **e no CI** (GitHub
Actions):

| Portão  | Ferramenta                   | Regra                                                                        |
| ------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Tipos   | `tsc`                        | `strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e outras |
| Lint    | ESLint + `typescript-eslint` | `strictTypeChecked`, `switch` exaustivo, nenhum warning                      |
| Formato | Prettier                     | Verificação, sem correção automática no CI                                   |
| Testes  | Vitest                       | Comportamento (`*.test.ts`) e tipos (`*.test-d.ts`); cobertura ≥ 95%         |
| Commits | commitlint                   | Conventional Commits, escopos fixos                                          |

As **evals com LLM real ficam fora da esteira**: custam dinheiro e não são determinísticas.

**Todas as versões são fixas** (sem `^` nem `~`), para builds reproduzíveis.

## Opções consideradas

| Opção                         | Feedback | Garantia                        |
| ----------------------------- | -------- | ------------------------------- |
| Só no CI                      | Lento    | Alta                            |
| Só local                      | Rápido   | Baixa (hooks podem ser pulados) |
| **Local e no CI (escolhida)** | Rápido   | Alta                            |

## Análise de trade-offs

**TypeScript fixo na 6.0.3.** A versão mais recente na decisão era a 7.0.2, mas o
`typescript-eslint` 8.72.1 só aceita TypeScript abaixo da 6.1. Sem ele, o lint não usa
informação de tipos, e regras como `switch` exaustivo e `no-unsafe-*` deixam de funcionar.

**O hook de pre-commit verifica o diretório de trabalho, não só o que está no commit.** Arquivos
não preparados podem esconder um commit quebrado. Para conferir cada commit isoladamente:
`git rebase --exec "npm run check" --root`.

**O Vitest falha quando não existe nenhum teste.** Por isso a esteira entrou no repositório junto
com o primeiro incremento de domínio, e não num commit separado.

## Consequências

- Mais fácil: confiar que todo commit está verde; ler o histórico.
- Mais difícil: commits demoram alguns segundos a mais.
- Revisitar a versão do TypeScript quando o `typescript-eslint` suportar a 7.x.

## Itens de ação

1. [x] Configurar tsc, ESLint, Prettier, Vitest, commitlint e lefthook.
2. [x] Workflow de CI.
3. [x] Primeira execução real do CI, após configurar o remote (2026-10-28, verde em 34s).
