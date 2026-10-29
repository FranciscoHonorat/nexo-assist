# ADR-0005: Mastra em uso mínimo, contido atrás de `AgentStep`

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD exige "Mastra (preferência) ou LangGraph.js" para o agent. Ao mesmo tempo, o projeto
segue o princípio de simplicidade na infraestrutura e nos frameworks.

No nosso desenho, o pipeline de cada turno é código próprio:

```
autenticação → controle da conversa → limite de mensagens → chamados vencidos
  → [LLM ⇄ tools, no máximo 5 iterações]
  → controle ainda é do agent? → grava resposta e trace → emite evento
```

Só o passo entre colchetes precisa de um framework de agent.

## Decisão

Usar do Mastra apenas `Agent`, tools com schemas Zod, o contexto de execução (para injetar o
`userId` da sessão nas tools) e o streaming. Não usar workflows, memória, storage, evals,
telemetria nem o servidor do Mastra.

O Mastra fica contido em `agent/mastra/`, atrás da interface `AgentStep`:

- `MastraAgentStep`: produção.
- `ScriptedAgentStep`: um modelo roteirizado para os testes BDD.

## Opções consideradas

| Opção                         | Cumpre o PRD | Acoplamento | Complexidade |
| ----------------------------- | ------------ | ----------- | ------------ |
| Mastra completo               | Sim          | Alto        | Alta         |
| **Mastra mínimo (escolhida)** | Sim          | Baixo       | Baixa        |
| SDK da Anthropic direto       | Não          | Nenhum      | Baixa        |
| LangGraph.js                  | Sim          | Alto        | Alta         |

## Análise de trade-offs

Como pipeline, guardas, trace e transições são código próprio, o peso da escolha do framework é
baixo. O critério de desempate é a preferência explícita do PRD.

O SDK direto foi descartado porque o PRD lista o framework entre os **requisitos**, não entre os
diferenciais.

## Consequências

- Mais fácil: trocar o framework (um arquivo); testar o fluxo com um modelo roteirizado.
- Mais difícil: nenhum recurso pronto do Mastra além do loop de tools.
- Saída de emergência: se o Mastra atrapalhar (por exemplo, não repassar o streaming de
  argumentos de tool), implementar `AnthropicSdkAgentStep` com o loop manual.

## Itens de ação

1. [x] Interface `AgentStep`, que faz uma decisão por chamada; o loop de tools ficou no código
       ([ADR-0017](0017-loop-de-tools-no-codigo.md)).
2. [x] `ScriptedAgentStep` para os testes BDD (`agentStepRoteirizado`).
3. [x] `MastraAgentStep`, com `mastraComAnthropic` montando o modelo a partir da configuração.
4. [x] Regra de lint: `@mastra/*`, `@ai-sdk/*` e `ai` só podem ser importados em `agent/mastra/`
       ([ADR-0015](0015-fronteiras-verificadas-pelo-lint.md)).
