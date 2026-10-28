# ADR-0014: Legado fora do ar

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD avisa que o sistema de chamados é legado e "de vez em quando fica indisponível por alguns
segundos". Uma chamada de rede tem três desfechos, não dois:

1. deu certo;
2. falhou **antes** de executar;
3. **não se sabe**: um timeout em que a operação pode ter acontecido e a resposta se perdeu.

O terceiro é o perigoso. Repetir uma criação nesse caso pode duplicar o chamado, que é justamente
o que o Anexo A proíbe.

## Decisão

1. **A indisponibilidade é um erro tipado em toda operação.** `ErroDeInfraestrutura`
   (`{ motivo: "indisponivel" }`) entra no tipo de retorno de `listar`, `obter`, `criar`,
   `complementar` e `alterarStatus`, por meio de um tipo auxiliar `Resposta<T, E>`. Quem chama é
   obrigado pelo compilador a tratar o legado fora do ar.
2. **A versão em memória simula as duas falhas**, configuradas por uma função `falhar(operacao)`
   injetada na criação:
   - `"antes"`: devolve `indisponivel` sem executar nada;
   - `"depois"`: executa a operação e devolve `indisponivel`, como um timeout em que a resposta se
     perdeu.
3. **Falha de infraestrutura nunca entra no cache de idempotência.** Na falha `"antes"`, nada
   executou; na falha `"depois"`, o que fica guardado é o resultado real da operação. Em nenhum
   caso uma nova tentativa recebe um `indisponivel` antigo.
4. **Os testes de falha ficam fora do contrato**, em `em-memoria.test.ts`, porque um sistema real
   não permite simular falhas.

## Opções consideradas

### Como representar a indisponibilidade

| Opção                                      | O compilador obriga a tratar | Mistura com erros de regra |
| ------------------------------------------ | ---------------------------- | -------------------------- |
| Exceção                                    | Não                          | Não                        |
| **Erro tipado no `Resultado` (escolhida)** | Sim                          | Não: motivo próprio        |

### O que a simulação cobre

| Opção                          | Prova a idempotência no timeout |
| ------------------------------ | ------------------------------- |
| Só falha antes de executar     | Não                             |
| **Antes e depois (escolhida)** | Sim                             |

## Análise de trade-offs

Representar a indisponibilidade no tipo deixa as assinaturas mais longas, e o tipo `Resposta`
existe para que isso não se repita em cada operação.

A falha `"depois"` é a única forma de testar o caso perigoso sem rede. Ela mostrou que as três
escritas já estavam protegidas: `criar` e `complementar` pela idempotência por rascunho
([ADR-0012](0012-complemento-e-reabertura-de-chamados.md)), e `alterarStatus` pela regra de
"já está no destino" ([ADR-0013](0013-transicoes-de-status-do-chamado.md)).

Uma sabotagem mostrou uma fragilidade nos testes: os de `complementar` e `alterarStatus` só
provavam que não havia duplicação, e não que a primeira tentativa tinha executado. Eles passaram
a consultar o chamado entre a falha e a nova tentativa.

## Consequências

- Mais fácil: escrever o retry, porque o erro de infraestrutura é distinguível dos erros de regra.
- Mais difícil: todo consumidor do `TicketClient` precisa tratar `indisponivel`.

## Itens de ação

1. [x] `ErroDeInfraestrutura` em todas as operações.
2. [x] Falhas simuladas antes e depois de executar.
3. [ ] Retry com backoff que repete só falhas de infraestrutura.
