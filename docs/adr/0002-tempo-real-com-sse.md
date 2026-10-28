# ADR-0002: Tempo real com SSE e EventEmitter; banco como fonte da verdade

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O chat precisa de respostas em tempo real, e o console do analista precisa ver conversas e
mensagens novas sem recarregar a página. Pela [ADR-0001](0001-servico-de-chamados-in-process.md),
a aplicação roda num único processo.

## Decisão

- O servidor envia eventos por **Server-Sent Events (SSE)**.
- Dentro do processo, os eventos circulam por um **EventEmitter**, atrás de uma interface
  `EventBus`.
- **O banco é a fonte da verdade.** O evento só avisa que algo mudou. Ao (re)conectar, o cliente
  busca no banco o que perdeu e depois volta a ouvir o SSE.
- O evento só é emitido **depois** que o dado foi gravado.
- O deploy usa um **processo de longa duração** (Railway, Fly.io ou Render), não serverless.

## Opções consideradas

### Opção A: broker externo (Redis pub/sub, RabbitMQ, Kafka)

| Dimensão     | Avaliação                              |
| ------------ | -------------------------------------- |
| Complexidade | Alta para o problema                   |
| Custo        | Mais um serviço para rodar e implantar |
| Escala       | Várias instâncias                      |

**Prós:** funciona com várias instâncias.
**Contras:** infraestrutura extra para um problema que um processo só resolve.

### Opção B: SSE com EventEmitter (escolhida)

| Dimensão     | Avaliação          |
| ------------ | ------------------ |
| Complexidade | Baixa              |
| Custo        | Nenhuma peça extra |
| Escala       | Uma instância      |

**Prós:** simples; o SSE reconecta sozinho no navegador.
**Contras:** eventos em memória se perdem num reinício; não funciona entre instâncias.

## Análise de trade-offs

A perda de eventos num reinício é aceitável porque o evento não carrega o dado, só o aviso. Com
o banco como fonte da verdade, nada se perde: o cliente recupera o estado ao reconectar.

A escolha **restringe o deploy**. Em plataformas serverless, cada requisição pode cair numa
instância diferente e efêmera, e o `emit` de uma não chega ao SSE de outra.

## Consequências

- Mais fácil: rodar e testar; nenhum serviço extra.
- Mais difícil: escalar para várias instâncias.
- Revisitar se precisar de mais de uma instância: trocar o EventEmitter por `LISTEN/NOTIFY` do
  PostgreSQL ([ADR-0004](0004-postgres-com-drizzle.md)), mantendo a interface `EventBus`.

## Itens de ação

1. [ ] Definir a interface `EventBus`.
2. [ ] Endpoint SSE com recuperação do estado ao reconectar.
3. [ ] Testar que nenhuma mensagem se perde numa reconexão.
