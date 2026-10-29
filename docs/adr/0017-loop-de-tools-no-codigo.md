# ADR-0017: Loop de tools no código, com o modelo decidindo um passo por vez

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O [ADR-0005](0005-mastra-minimo.md) deixava o trecho "LLM ⇄ tools, no máximo 5 iterações" com
o framework. Esse trecho concentra regras que não podem depender dele:

- as tools rodam com o usuário da sessão, nunca com um usuário vindo do modelo;
- os argumentos propostos pelo modelo são validados antes de qualquer consulta;
- o loop para em 5 chamadas ao modelo;
- texto solto vira resposta com confiança baixa ([ADR-0003](0003-saida-do-agent-via-tool.md));
- cada tool executada deixa um fato no trace.

Se o loop ficasse dentro do Mastra, essas regras só poderiam ser testadas com o framework de pé,
e trocar de framework exigiria reescrevê-las.

## Decisão

O loop é código nosso (`executarTurno`, em `src/agent/turno.ts`). O `AgentStep` faz **uma
decisão por chamada**: recebe o contexto e devolve uma `Decisao`.

| Decisão               | O que o loop faz                                                                |
| --------------------- | ------------------------------------------------------------------------------- |
| `responder`           | Conclui o turno com a mensagem e a declaração do modelo                         |
| `texto_solto`         | Conclui com o texto como mensagem, sem declaração e com confiança baixa         |
| `declaracao_invalida` | Como `texto_solto`, e o trace lista os campos que o modelo errou                |
| `recusa`              | Conclui com uma mensagem fixa que oferece um analista, com confiança baixa      |
| `tools`               | Executa as tools e chama o modelo de novo com os resultados; para na 5ª chamada |

- **Entrada só pelas guardas.** `executarTurno` aceita apenas `TurnoPronto`
  ([ADR-0016](0016-guardas-do-turno.md)).
- **As tools não recebem usuário.** `ChamadaDeTool` não tem campo para isso; as tools usam o
  usuário do turno. A privacidade vem do formato da chamada.
- **Argumentos validados pelo domínio.** `obter_chamado` recebe o id como texto cru e passa por
  `lerTicketId`. Um id inválido não chega ao serviço: o erro volta ao modelo, que pode corrigir.
- **Respostas no formato `Resultado`.** Toda tool devolve `{ tool, resposta: Resultado<…> }`. Os
  tipos saem de um mapa por tool (`RespostasPorTool`), e `RespostaDoServico` já inclui o erro
  `indisponivel`.
- **Limite de 5 chamadas ao modelo.** Se a 5ª decisão ainda pedir tools, elas não são
  executadas: o turno termina com uma mensagem fixa que oferece um analista.
- **Trace com formato único.** Todo passo tem `etapa` (`guarda`, `tool` ou `resposta`), e o
  tipo é uma união fechada verificada em teste de tipo.

O Mastra (passo 7d) só vai traduzir uma chamada ao modelo para uma `Decisao`.

## Opções consideradas

| Opção                                 | Regras testáveis sem framework | Troca de framework | Controle do limite |
| ------------------------------------- | ------------------------------ | ------------------ | ------------------ |
| Loop do Mastra (`maxSteps`)           | Não                            | Reescreve o loop   | Do framework       |
| **Loop próprio, uma decisão por vez** | Sim                            | Um adaptador       | Nosso              |

## Análise de trade-offs

**Custo:** o loop do framework vem pronto; o nosso tem cerca de 50 linhas. Em troca, todas as
regras acima são testadas com o `agentStepRoteirizado`, sem rede e sem LLM.

**Tools com efeito colateral:** não executar as tools pedidas na 5ª chamada evita que uma ação
(como criar um chamado) aconteça sem uma resposta que a explique.

**Legado fora do ar durante uma tool:** o turno não quebra. O modelo recebe `indisponivel` e
decide o que dizer, e o trace registra o fato. É a mesma linha do
[ADR-0014](0014-legado-fora-do-ar.md).

**Chamado de outro funcionário:** `obter_chamado` repassa o `nao_encontrado` do serviço sem
alterá-lo. O contrato do `TicketClient` devolve o mesmo erro para um id inexistente e para um
chamado de outro dono, então o agent não revela que o chamado existe.

## Como foi verificado

- 9 cenários BDD em `turno.test.ts`: resposta direta, texto solto, consulta só dos chamados do
  usuário, limite de iterações, id inválido, id válido, chamado de outro funcionário e legado
  fora do ar em cada tool.
- Teste de tipo: a etapa de um passo do trace é uma lista fechada.
- O modelo roteirizado rejeita a promise e diz em que chamada o roteiro acabou, para que um
  teste com roteiro curto falhe de forma clara.

## Consequências

- Mais fácil: acrescentar uma tool (uma entrada em `RespostasPorTool`, uma variante em
  `ChamadaDeTool` e uma função em `tools.ts`); trocar o framework.
- Mais difícil: o loop é nosso para manter, e as chamadas paralelas de tool ficam sob nossa
  responsabilidade.

## Itens de ação

1. [x] Interface `AgentStep` e modelo roteirizado.
2. [x] Loop com limite, fallback e trace.
3. [x] Tools `consultar_chamados` e `obter_chamado`.
4. [x] `MastraAgentStep` traduzindo uma chamada ao modelo em `Decisao` (passo 7d).
5. [x] Tools de rascunho e transferência; a confirmação ficou fora das tools
       ([ADR-0019](0019-acoes-do-agent.md)).
