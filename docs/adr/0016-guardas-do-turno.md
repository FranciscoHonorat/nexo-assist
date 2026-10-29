# ADR-0016: Guardas do turno

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

Antes de o LLM ver uma mensagem, três regras precisam valer, e nenhuma delas pode depender do
prompt:

- O agent fica em silêncio enquanto a conversa está na fila ou com um analista.
- Uma sessão tem no máximo 30 mensagens.
- O agent já começa o turno sabendo quais chamados do funcionário estão vencidos.

Se cada regra fosse um `if` solto no fluxo do agent, bastaria um caminho novo esquecer uma delas
para o LLM responder numa conversa que é do analista.

## Decisão

As regras são **guardas** executadas por `prepararTurno` (`src/agent/guardas.ts`), em ordem
fixa: controle → limite → vencidos. Cada guarda é uma função própria, e `prepararTurno` só as
encadeia.

| Guarda   | Quando interrompe                | O que acontece                                                                                     |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| controle | Conversa na fila ou com analista | Silêncio: a interrupção não tem resposta                                                           |
| limite   | A mensagem passaria de 30        | Resposta fixa, sem LLM e sem consultar chamados                                                    |
| vencidos | Nunca                            | Abertos fora do prazo entram no contexto; com o legado fora do ar, o turno segue com a lista vazia |

- **O tipo estreita a cada etapa.** A entrada tem `Conversa<Controle>`; depois da guarda de
  controle, a conversa é `Conversa<"agent">`.
- **Só as guardas produzem um `TurnoPronto`.** O tipo leva uma marca com `unique symbol` não
  exportado ([ADR-0008](0008-garantias-no-sistema-de-tipos.md)). Quem chamar o agent com um
  objeto montado à mão não compila.
- **Cada guarda deixa um passo no trace** (`{ etapa: "guarda", nome, resultado, detalhe }`),
  inclusive quando interrompe. É o registro de fatos que o
  [ADR-0003](0003-saida-do-agent-via-tool.md) separa das falas do LLM.
- **Cada guarda só registra o que ela pode produzir.** Um mapa por guarda fixa os resultados:
  controle e limite passam ou interrompem; vencidos passa ou não verifica. `vencidos` +
  `interrompeu` não compila.
- **Cada guarda conhece só a própria regra.** Quando uma guarda interrompe, `prepararTurno`
  junta os passos anteriores ao trace da interrupção.
- **As interrupções são uma lista fechada** (`Interrupcao`), e só a do limite tem `resposta`.

## Opções consideradas

| Opção                                            | Garantia de que as regras rodaram | Trace        |
| ------------------------------------------------ | --------------------------------- | ------------ |
| Regras no prompt                                 | Nenhuma                           | Não          |
| `if`s no fluxo do agent                          | Revisão de código                 | Manual       |
| Middleware/hooks do Mastra                       | Do framework                      | Do framework |
| **Função `prepararTurno` com marca (escolhida)** | Compilador                        | Por guarda   |

## Análise de trade-offs

**Vencidos não interrompe quando o legado cai.** Barrar o turno por isso deixaria o funcionário
sem atendimento justamente quando o sistema está com problema. O trace registra `nao_verificou`,
então a falta da informação fica visível em vez de virar um "nada vencido" falso. Segue a mesma
linha do [ADR-0014](0014-legado-fora-do-ar.md).

**Ordem fixa, não configurável.** A ordem é parte da regra: a guarda de limite não deve consultar
chamados, e a de controle precisa vir antes de tudo para o agent não gastar nada numa conversa
que não é dele. Uma lista configurável de guardas abriria espaço para trocar essa ordem.

**Fora do Mastra.** As guardas são código próprio, como previsto no
[ADR-0005](0005-mastra-minimo.md); trocar o framework não muda nenhuma delas.

## Como foi verificado

- 8 cenários BDD (Dado/Quando/Então), um bloco por guarda e um para o turno completo, incluindo a
  31ª mensagem e o legado fora do ar.
- 5 testes de tipo: a conversa do `TurnoPronto` é `Conversa<"agent">`, um turno forjado não
  compila, as interrupções e os resultados do trace são listas fechadas, só o limite tem
  resposta e cada guarda só registra os resultados que pode produzir.
- Na refatoração para uma função por guarda, os testes não mudaram e continuaram verdes.

## Consequências

- Mais fácil: acrescentar uma guarda é uma função nova e uma linha em `prepararTurno`; o trace e
  o tipo de saída mostram o que falta.
- Mais difícil: o limite de 30 depende de `mensagensNaSessao`, que vem de quem chama. A contagem
  confiável chega com a persistência das conversas.

## Itens de ação

1. [x] Guardas de controle, limite e vencidos.
2. [x] O loop do agent (`executarTurno`) aceita só `TurnoPronto`
       ([ADR-0017](0017-loop-de-tools-no-codigo.md)).
3. [x] `mensagensNaSessao` lido das conversas persistidas
       ([ADR-0018](0018-persistencia-das-conversas.md)).
