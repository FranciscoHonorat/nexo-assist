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

## Como foi implementado

- `src/tempo-real/avisos.ts`: a interface `Avisos` (o `EventBus`) com `EventEmitter`. O aviso leva
  só o dono da conversa, nunca o conteúdo.
- `conversasQueAvisam(conversas, avisos)` decora `Conversas`: toda escrita que chegou ao banco
  avisa **depois** de gravada. Cada operação é listada no decorador, então uma operação nova não
  compila até alguém decidir se ela avisa.
- `acompanharConversa(dono, ultimaVista, …)` é um gerador: passa a ouvir, lê o banco a partir do
  cursor e, a cada aviso da mesma conversa, lê de novo a partir do último id entregue. Um aviso
  que chega durante uma leitura não se perde. Banco fora do ar entrega `indisponivel` e termina,
  para o cliente reconectar com o último id (`Last-Event-ID`).
- O cursor depende de as escritas da mesma conversa serem serializadas
  ([ADR-0021](0021-historico-com-eventos-e-console.md)).

## Como foi verificado

7 cenários do acompanhamento (conexão do começo, reconexão sem repetir, mensagem nova, escrita
durante a primeira leitura, mensagens de outra pessoa, banco fora do ar, desconexão), 10 do
decorador e, no PostgreSQL real, um leitor pelo cursor durante escritas simultâneas. Com o
despertador sabotado para esquecer um aviso, dois cenários falharam.

## Itens de ação

1. [x] Definir a interface `EventBus`.
2. [ ] Endpoint SSE com recuperação do estado ao reconectar (o acompanhamento está pronto; falta o
       HTTP).
3. [x] Testar que nenhuma mensagem se perde numa reconexão.
