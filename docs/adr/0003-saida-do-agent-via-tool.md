# ADR-0003: Toda saída do agent passa pela tool `responder`

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD chama a visibilidade das decisões de "a parte mais importante do desafio": deve ser
possível ver o que o agent entendeu, que ação tomou, com que grau de segurança e por quê.

Um trace confiável é **registrado enquanto as coisas acontecem**, e não reconstruído depois.
Pedir ao LLM "explique o que você fez" numa segunda chamada produz uma narrativa plausível que
pode não bater com o que aconteceu, e ainda dobra o custo.

O trace separa duas coisas:

- **Fatos**, registrados pelo pipeline: guardas, tools chamadas, transições, tentativas, custo.
- **Declarações** do modelo, rotuladas como tal: o que entendeu, a intenção, a confiança, o porquê.

O porquê pertence a quem decidiu. Se uma guarda transferiu a conversa (chamado vencido), o motivo
é um fato. Se o modelo classificou a prioridade, o motivo é uma declaração.

## Decisão

Toda resposta do agent é uma chamada à tool `responder({ declaracao, mensagem })`, validada por
schema. Os passos do trace são transmitidos por SSE assim que acontecem, e a espera vira
progresso visível ("consultando seus chamados...").

Os chips acima de cada resposta são derivados dos **fatos**, nunca da declaração.

## Opções consideradas

### Opção A: declaração primeiro no structured output

O modelo raciocina antes de responder, mas a resposta só aparece depois da declaração.

### Opção B: resposta primeiro no structured output

A resposta aparece logo, mas a declaração gerada depois se aproxima de uma narrativa
reconstruída.

### Opção C: tool final `responder` (escolhida)

Toda saída do agent é uma tool call, e o trace fica 100% estruturado.

| Dimensão      | A      | B        | C                     |
| ------------- | ------ | -------- | --------------------- |
| Transparência | Alta   | Média    | Alta                  |
| Tempo real    | Atrasa | Imediato | Atrasa, com progresso |
| Uniformidade  | Média  | Média    | Alta                  |

## Análise de trade-offs

A transparência é o critério principal do PRD. A latência até a primeira palavra é o custo
aceito, mitigado pelo progresso visível dos passos.

**Correção após consultar a API (2026-10-28):** os modelos atuais da Anthropic recusam o uso
forçado de tool (`tool_choice` `any`/`tool` devolve erro 400). Por isso:

- a tool usa `tool_choice: auto`, `strict: true` e uma instrução explícita no prompt;
- o **fallback determinístico** é obrigatório, e não só um seguro: se chegar texto solto, ele
  vira a mensagem, a declaração fica vazia, o trace registra "modelo não declarou" e a confiança
  final é baixa.

## Consequências

- Mais fácil: auditar decisões; derivar chips e custo por conversa do próprio trace.
- Mais difícil: streaming dos argumentos da tool, que exige validação do JSON parcial antes de
  executar qualquer coisa.
- Validar com um spike se o Mastra repassa o streaming de argumentos de tool.

## Itens de ação

1. [x] Tipos do trace: `PassoDoTurno` e o `trace` de `RespostaDoTurno`
       ([ADR-0017](0017-loop-de-tools-no-codigo.md)).
2. [ ] Schema da tool `responder`.
3. [x] Fallback para texto solto, com teste.
4. [ ] Spike: streaming de argumentos de tool no Mastra.
