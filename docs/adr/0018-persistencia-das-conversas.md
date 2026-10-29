# ADR-0018: Persistência das conversas

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD exige que conversas, chamados e o estado de cada conversa (com o agent ou com um analista)
sobrevivam a um reinício. Três regras dependem do que está gravado, e não do que quem chama diz:

- o limite de 30 mensagens por sessão ([ADR-0016](0016-guardas-do-turno.md));
- o agent em silêncio enquanto a conversa está na fila ou com um analista;
- a corrida entre o agent e o analista: se o analista assume enquanto o modelo pensa, a resposta
  do agent não pode entrar.

## Decisão

O módulo `src/conversas` expõe a interface `Conversas`, com uma implementação em memória e uma
em PostgreSQL, verificadas pelo mesmo contrato:

| Operação            | O que garante                                                                         |
| ------------------- | ------------------------------------------------------------------------------------- |
| `atual`             | Cria a conversa com o agent no primeiro acesso e conta as mensagens da sessão         |
| `transicionar`      | Muda o controle só se ele ainda for o esperado (`UPDATE … WHERE controle = esperado`) |
| `registrarTurno`    | Grava a pergunta sempre; grava a resposta só se a conversa ainda for do agent         |
| `registrarMensagem` | Grava só a mensagem do funcionário, para o analista ver                               |
| `historico`         | Devolve as mensagens na ordem em que entraram                                         |

- **Uma conversa atual por funcionário**, com o dono como chave. O domínio já funciona assim:
  `finalizar` devolve uma conversa nova para o mesmo dono.
- **A sessão é um marco dentro da conversa atual** (atualizado na
  [ADR-0021](0021-historico-com-eventos-e-console.md)). `mensagensNaSessao` conta as mensagens do
  funcionário desde o marco.
- **O registro do agent é um `Json` opaco.** Declaração, confiança e trace são gravados sem que
  conversas importe tipos do agent; o agent depende de conversas, e não o contrário.
- **As regras de estado também estão no banco.** `num_nonnulls` garante que só a conversa fora do
  agent tem transferência e só a conversa com o analista tem analista; só a mensagem do agent
  tem registro.
- **O turno condicional trava a linha da conversa** (`SELECT … FOR UPDATE`) antes de gravar, então
  uma transição concorrente espera ou é vista.
- **Banco fora do ar vira `indisponivel`**, com a mesma proteção do serviço de chamados
  (`protegerDaQuedaDoBanco`, em `src/infraestrutura`).

`atenderMensagem` (`src/agent/atender.ts`) liga tudo: lê a conversa atual, passa pelas guardas,
roda o loop do agent e grava. O resultado é uma `resposta` ou um `silencio`, com o motivo.

## Opções consideradas

| Opção                                    | Corrida agent × analista   | Conversas depende do agent |
| ---------------------------------------- | -------------------------- | -------------------------- |
| Gravar a conversa inteira como JSON      | Exige comparar o documento | Não                        |
| Tipos do agent na tabela de mensagens    | Transição condicional      | Sim                        |
| **Colunas de controle + registro opaco** | Transição condicional      | Não                        |

## Análise de trade-offs

**Registro opaco:** o banco não valida o formato do trace. Em troca, o trace pode evoluir sem
migração, e quem lê (o console do analista) usa os tipos do agent.

**Chave pelo dono:** um funcionário não tem duas conversas abertas ao mesmo tempo. Se o produto
precisar de histórico de sessões encerradas com identificador próprio, entra um id de conversa.

**Pergunta gravada mesmo quando a resposta não entra:** o analista que assumiu precisa ver o que
o funcionário escreveu; descartar a pergunta perderia contexto.

## Como foi verificado

- 7 cenários de contrato, rodando em memória e no PGlite: conversa nova, turno no histórico,
  mensagem só do funcionário, estado na fila e com o analista depois de reiniciar, dois analistas
  disputando a mesma conversa e a resposta descartada quando o analista assume no meio do turno.
- 5 testes com um banco inalcançável: toda operação devolve `indisponivel`.
- 7 cenários de `atenderMensagem`: turno completo, 31ª mensagem com resposta fixa, silêncio na
  fila, silêncio quando o analista assume durante o turno e os três ramos de banco fora do ar.
- Linhas inválidas inseridas à mão no PGlite foram recusadas pelas regras `num_nonnulls`.

## Consequências

- Mais fácil: o console do analista lê o histórico e o trace de uma tabela só; acrescentar uma
  transição é uma chamada a `transicionar` com o estado esperado.
- Mais difícil: o formato do registro do agent não é checado pelo banco.

## Itens de ação

1. [x] Interface `Conversas`, contrato e duas implementações.
2. [x] Transições e turno condicionais.
3. [x] `atenderMensagem` com `mensagensNaSessao` vindo do banco.
4. [x] "Nova sessão" zerando a contagem (`iniciarSessao`,
       [ADR-0021](0021-historico-com-eventos-e-console.md)); o botão fica para a interface.
5. [x] Eventos para o tempo real ([ADR-0002](0002-tempo-real-com-sse.md)) a cada mensagem gravada.
