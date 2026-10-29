# ADR-0013: Transições de status do chamado

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O status de um chamado muda por vários caminhos: o agent transfere a conversa para um analista,
o analista resolve, uma requisição é aprovada. O serviço de chamados é legado, então uma mesma
mudança pode chegar duas vezes (retry depois de um timeout), e duas pessoas podem mudar o mesmo
chamado ao mesmo tempo.

## Decisão

1. **Tabela de transições permitidas, só em tipos:**

   | De                    | Pode ir para                                   |
   | --------------------- | ---------------------------------------------- |
   | `aberto`              | `aguardando_analista`, `aprovado`, `resolvido` |
   | `aguardando_analista` | `aberto`, `resolvido`                          |
   | `aprovado`            | `resolvido`                                    |
   | `resolvido`           | nenhum                                         |

   `TransicaoDeStatus` é derivado dela por um tipo mapeado sobre `StatusDoChamado`: é a união de
   todos os pares válidos. Pedir uma transição fora da tabela não compila, e um status novo
   esquecido na tabela também não.

2. **Reabrir só acontece por complemento** ([ADR-0012](0012-complemento-e-reabertura-de-chamados.md)).
   Por isso `resolvido` não tem destinos na tabela.

3. **Transição condicional:** `alterarStatus(id, { de, para, por }, agora)`.
   - Status atual igual a `de`: aplica a mudança e renova o `atualizadoEm`.
   - Status atual **já igual a `para`**: devolve sucesso sem alterar nada.
   - Qualquer outro status: devolve `status_mudou`, com o status esperado e o atual.

4. **A regra mora no domínio** (`alterarStatusDoChamado`). O serviço só checa o dono.

## Opções consideradas

### Como validar as transições

| Opção                                     | Erro aparece | Custo em runtime |
| ----------------------------------------- | ------------ | ---------------- |
| Tabela em runtime, checada a cada chamada | Ao executar  | Pequeno          |
| **Tabela em tipos (escolhida)**           | Ao compilar  | Nenhum           |

### O que fazer quando o status já é o destino

| Opção                                 | Retry depois de um timeout    | Duas pessoas pedem a mesma mudança |
| ------------------------------------- | ----------------------------- | ---------------------------------- |
| Tratar como conflito (`status_mudou`) | Falha, mesmo tendo funcionado | A segunda recebe conflito          |
| **Tratar como sucesso (escolhida)**   | Sucesso                       | As duas recebem sucesso            |

## Análise de trade-offs

A tabela em tipos não protege valores que chegam de fora sem tipo, como uma transição escrita pelo
LLM. Esses valores precisam passar por uma função de leitura antes de virar `TransicaoDeStatus`,
como acontece com os ids ([ADR-0008](0008-garantias-no-sistema-de-tipos.md)).

Tratar o "já está no destino" como sucesso torna o retry seguro sem guardar estado extra. O caso
aceito em troca é raro e inofensivo: duas pessoas pedindo a mesma mudança recebem sucesso, e o
resultado final é o que as duas queriam.

## Consequências

- Mais fácil: retry depois de timeout; detectar conflito sem trava.
- Mais difícil: acrescentar um status exige atualizar a tabela, e o compilador lembra disso.
- Quando houver papéis (funcionário e analista), a checagem de dono do `alterarStatus` precisa
  aceitar o analista.

## Itens de ação

1. [x] Tabela de transições e `TransicaoDeStatus`.
2. [x] `alterarStatus` no contrato e na versão em memória.
3. [ ] Leitura de uma transição vinda do LLM: adiada até uma história pedir que o funcionário mude o
       status pelo chat ([ADR-0019](0019-acoes-do-agent.md)).
4. [ ] Permitir que analistas alterem o status de chamados de outras pessoas.
