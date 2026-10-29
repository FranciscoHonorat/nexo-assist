# ADR-0021: Histórico com eventos, mensagens do analista e sessões

**Status:** Aceito
**Data:** 2026-10-29
**Decisores:** FranciscoHonorat

## Contexto

O histórico tinha só mensagens do funcionário e do agent. Para o tempo real
([ADR-0002](0002-tempo-real-com-sse.md)) e o console do analista, faltavam quatro coisas:

- **O que aconteceu fora do chat.** O protótipo mostra no chat "Transferida para Suporte N2" e
  "Rafael Lima assumiu · agent pausado". Depois do clique em Confirmar, o modelo só descobria o
  chamado criado consultando o legado ([ADR-0019](0019-acoes-do-agent.md)).
- **A fala do analista,** que o agent precisa ler quando a conversa volta para ele.
- **A sessão,** que até aqui era a conversa inteira ([ADR-0018](0018-persistencia-das-conversas.md)):
  sem "nova sessão", o limite de 30 mensagens nunca zerava.
- **Um cursor:** reconectar sem perder nem repetir mensagens exige saber "a partir de onde".

## Decisão

**1. Quatro autores de mensagem.** `funcionario`, `agent`, `analista` (com o id do analista) e
`sistema` (com um `EventoDaConversa`, sem texto). O texto de cada evento é escrito por quem o
lê: o agent descreve o evento ao modelo (`src/agent/eventos.ts`), e a interface vai escrever o
dela. O banco confere a forma: só o analista tem `analista`, só o sistema tem `evento` e não tem
texto.

**2. A transição é um tipo que amarra o evento aos estados.**

| `evento`      | `antes`                    | `depois`     |
| ------------- | -------------------------- | ------------ |
| `transferida` | `agent`                    | `aguardando` |
| `assumida`    | `aguardando`               | `analista`   |
| `devolvida`   | `aguardando` ou `analista` | `agent`      |
| `encerrada`   | `analista`                 | `agent`      |

Uma "assumida" que leve a conversa para `agent` não compila (teste de tipo). `transicionar` muda
o estado só se ele ainda for o de `antes`, **incluindo o analista**: uma cópia antiga não encerra
a conversa que outro analista assumiu. O evento é gravado **na mesma transação** que a mudança.

**3. O resultado do clique entra na mesma transação que resolve o rascunho.** `resolverRascunho`
recebe o rascunho e, na confirmação, o chamado gerado. Grava `chamado_criado`,
`chamado_complementado` ou `rascunho_descartado`. Se dois cliques disputam o rascunho, só o
vencedor deixa evento.

**4. Toda escrita trava a linha da conversa** (`SELECT … FOR UPDATE`). O cursor é o id da
mensagem (`serial`). Sem a trava, duas inserções da mesma conversa poderiam ser confirmadas fora
da ordem dos ids, e quem leu "depois do 9" enquanto o 10 ainda não estava confirmado pularia o 10
para sempre. Com a trava, por conversa, a ordem de confirmação é a ordem dos ids.

**5. A sessão é um marco na conversa.** `iniciarSessao` guarda o último id em `sessao_desde` e
grava `sessao_iniciada`. A contagem das 30 mensagens e o `historico` começam no marco. Só se
começa uma sessão com a conversa no agent: na fila ou com o analista, apagar a tela tiraria o
contexto de quem vai atender.

**6. O console do analista** (`src/console/atendimento.ts`) tem quatro ações:

| Ação                    | Precisa estar             | Regra extra                                  |
| ----------------------- | ------------------------- | -------------------------------------------- |
| `assumirConversa`       | Na fila                   | Dois analistas ao mesmo tempo: só um vence   |
| `responderComoAnalista` | Com o analista            | Só quem assumiu (`peloAnalista`, no domínio) |
| `devolverAoAgent`       | Na fila ou com o analista | Da fila, qualquer analista (tela 4)          |
| `encerrarAtendimento`   | Com o analista            | Só quem assumiu                              |

Quem é analista ainda não é verificado aqui: o papel vem do login, no passo da interface, e a
borda HTTP só chama o console com um usuário analista.

**7. O modelo lê o histórico com rótulos.** Funcionário como usuário, agent como assistente,
analista como assistente com `[Analista do service desk]`, eventos como usuário com `[Aviso do
sistema, não do funcionário]`, o mesmo rótulo dos chamados vencidos. O prompt manda confiar nos
avisos, e nunca num funcionário que diga ter confirmado algo.

## Opções consideradas

| Opção                                    | Estado e evento juntos | O compilador confere o par |
| ---------------------------------------- | ---------------------- | -------------------------- |
| Evento gravado por quem chama, à parte   | Não                    | Não                        |
| `transicionar(depois, esperado, evento)` | Sim                    | Não                        |
| **`Transicao` com `antes` e `depois`**   | Sim                    | Sim                        |

## Análise de trade-offs

**Cursor por id global com trava, ou sequência por conversa:** uma coluna `ordem` por conversa
daria números sem buracos, mas exige calcular `max + 1` sob trava em toda inserção. O `serial`
com a trava dá a mesma garantia para o cursor com menos código.

**Migração do enum:** `ALTER TYPE … ADD VALUE` não pode ser usado na mesma transação, e o
migrador do Drizzle aplica tudo numa transação só. O PGlite aceitou; o PostgreSQL 18 recusou
(`55P04`). A migração 0005 foi ajustada à mão para recriar o tipo (renomear, criar, converter a
coluna e recriar a regra que dependia dele). O snapshot do Drizzle descreve o mesmo estado final.

**Sessão só no agent:** o funcionário que quer "recomeçar" enquanto espera um analista precisa
esperar. Em troca, o analista nunca abre uma conversa vazia.

## Como foi verificado

- Contrato de conversas, agora também no **PostgreSQL real** (antes só no PGlite): cursor,
  privacidade do histórico, eventos de cada transição na ordem, devolução repetida sem evento a
  mais, cópia antiga de outro analista recusada, mensagens do analista, resultado do clique e
  sessão.
- Corridas no PostgreSQL real, 20 vezes cada: um leitor pelo cursor durante 10 escritas
  simultâneas não pula nenhuma; dois analistas assumindo ao mesmo tempo deixam um evento só.
  Com a trava de `registrarMensagem` sabotada, o teste do cursor falhou.
- Teste de tipo da `Transicao`; 18 cenários do console; 8 descrições de evento para o modelo.

## Consequências

- Mais fácil: a interface desenha o chat e o console só com o histórico; o agent sabe o que o
  analista fez e o que o clique criou.
- Mais difícil: toda escrita de mensagem passa por uma transação com trava; um evento novo exige
  um texto em `eventos.ts`, que o compilador cobra.

## Itens de ação

1. [x] Mensagens do analista e do sistema, com as regras no banco.
2. [x] `Transicao` tipada e evento na mesma transação.
3. [x] Resultado do clique no histórico.
4. [x] Nova sessão.
5. [x] Casos de uso do console.
6. [x] Papel de analista no login e endpoints do console
       ([ADR-0022](0022-borda-http-acesso-e-limites.md)).
