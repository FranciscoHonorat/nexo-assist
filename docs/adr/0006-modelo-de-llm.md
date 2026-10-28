# ADR-0006: Claude Haiku 5.5 como ponto de partida

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD aceita qualquer provedor de LLM e pede que a escolha seja explicada. O critério de
eficiência pede atenção ao custo por conversa. O agent é quase só tool calling
([ADR-0003](0003-saida-do-agent-via-tool.md)) e conversa em português.

Decidimos usar **um modelo só** em execução: um conjunto de evals, um cache e um comportamento
para medir.

## Decisão

`claude-haiku-5-5` como ponto de partida. `claude-sonnet-5-5` é o upgrade, acionado pela eval: se
a taxa de acerto em prioridade, duplicidade ou transferência ficar abaixo da meta, troca-se o
modelo.

O id do modelo fica na variável `LLM_MODEL`: trocar é configuração, não código. O nível de
esforço fica explícito na configuração (o padrão do Haiku 5.5 é `medium`), para que a eval meça
algo estável.

## Opções consideradas

Preços consultados em 2026-10-28, por milhão de tokens. A estimativa por conversa supõe 10 turnos
com cerca de 6 mil tokens de entrada e 400 de saída por turno, sem prompt caching.

| Modelo              | Entrada | Saída  | Estimativa por conversa |
| ------------------- | ------- | ------ | ----------------------- |
| `claude-haiku-5-5`  | $0.10   | $0.50  | ~$0.01                  |
| `claude-sonnet-5-5` | $2.00   | $10.00 | ~$0.16                  |
| `claude-opus-5-5`   | $4.00   | $20.00 | ~$0.32                  |

## Análise de trade-offs

O agent faz tarefas de dia a dia guiadas por tools e por regras aplicadas no código. Por isso,
partir do modelo mais barato e subir só com evidência faz sentido.

Preço por token não é custo por **conversa resolvida**: um modelo que erra mais pode precisar de
mais turnos ou transferências. A decisão final é da eval, não da tabela.

Só foram comparados modelos da Anthropic, porque eram os únicos com dados atualizados na
decisão.

## Consequências

- Mais fácil: custo baixo; troca de modelo por configuração.
- Mais difícil: o Haiku 5.5 não tem fallback no servidor quando recusa uma resposta
  (`stop_reason: "refusal"`). O pipeline trata isso como mais uma guarda: mensagem fixa e
  registro no trace.
- O custo real por conversa vem do campo `custo` do trace, não desta estimativa.

## Itens de ação

1. [ ] `LLM_MODEL` e o nível de esforço no `.env.example`, validados no boot.
2. [ ] Guarda para recusa do modelo.
3. [ ] Eval de prioridade, duplicidade e transferência, com meta definida.
