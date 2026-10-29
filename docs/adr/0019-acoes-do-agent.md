# ADR-0019: Ações do agent: o modelo propõe, o clique confirma, o código verifica

**Status:** Aceito
**Data:** 2026-10-29
**Decisores:** FranciscoHonorat

## Contexto

O Anexo A do PRD tem regras que não podem depender do modelo acertar:

- o chamado só é criado ou atualizado **depois da confirmação** do funcionário;
- **sem duplicidade:** um problema que já tem chamado aberto (ou resolvido há até 7 dias) atualiza
  o chamado, não abre outro;
- **prioridade** pela combinação de impacto e urgência, com prazo por prioridade;
- **transferência** a pedido, em casos críticos, em chamados vencidos ou sem segurança, com um
  resumo, e o agent em silêncio depois dela.

Até aqui o agent só lia chamados. Também faltava contexto: o modelo via só a mensagem atual, sem
as anteriores, e o aviso de chamados vencidos nunca chegava ao prompt.

## Decisão

**1. O modelo propõe; o código valida e guarda um rascunho pendente.**

| Tool                 | O que o código verifica antes de guardar                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `propor_chamado`     | Campos completos; `critica` só para equipe ou empresa; nenhum chamado da mesma categoria que ainda possa ser atualizado |
| `propor_complemento` | Id no formato; o chamado é do funcionário; aberto ou resolvido há até 7 dias (`podeSerAtualizado`); texto não vazio     |

- **Duplicidade sem adivinhação:** o código não sabe se dois textos falam do mesmo problema, mas
  sabe quais chamados poderiam ser o mesmo. Se houver candidatos, a proposta volta como
  `possivel_duplicidade`, com os chamados. O modelo só consegue propor de novo listando cada um em
  `chamadosConferidos`: a conferência fica explícita e registrada no trace.
- **O prazo vem do código** (`calcularPrazo`), não do modelo.
- **Argumentos fora do schema não derrubam o turno:** o adaptador entrega a chamada com
  `invalidos`, e o modelo recebe `argumentos_invalidos` com os campos.

**2. A confirmação não é uma tool.** Só o clique no card chama `confirmarRascunho` (ou
`descartarRascunho`), com o id do rascunho e o usuário da sessão:

- o rascunho é buscado **pelo id e pelo dono**: o de outra pessoa é "não encontrado";
- `confirmar` aplica a marca `confirmadoPeloFuncionario` e recusa quem não é o dono, mesmo que o
  armazenamento devolva o rascunho errado;
- `criar` e `complementar` são idempotentes pelo id do rascunho
  ([ADR-0012](0012-complemento-e-reabertura-de-chamados.md)); o rascunho só é marcado como
  resolvido **depois** de aplicado. Se o legado cair, o rascunho continua pendente e o clique pode
  ser repetido. O segundo clique recebe `rascunho_ja_resolvido`.
- `conformeOConteudo` escolhe entre criar e complementar com **um ramo obrigatório por tipo de
  conteúdo**: um tipo novo de rascunho não compila até ter o seu ramo.

**3. Os rascunhos moram no módulo de conversas** (`guardarRascunho`, `rascunhoPendente`,
`resolverRascunho`), em memória e na tabela `rascunhos`, verificados pelo mesmo contrato.
`resolverRascunho` é condicional (`WHERE status = 'pendente'`): dois cliques simultâneos, um
confirmando e outro descartando, não valem os dois.

**4. Transferir é uma decisão final do modelo**, `transferir_para_analista`, com motivo e resumo:

- a resposta ao funcionário é um texto fixo; o motivo e o resumo vão para o trace;
- resumo vazio vira a mensagem do funcionário; se ela também for vazia, um texto fixo manda o
  analista ler a conversa: o analista nunca recebe um caso sem resumo;
- argumentos inválidos ainda transferem, com motivo `baixa_confianca`: na dúvida, chamar uma
  pessoa é o lado seguro;
- `atenderMensagem` grava a resposta e só então move a conversa para a fila, com
  `transicionar(…, "agent")`. Se o banco cair nesse passo, o atendimento é `indisponivel`, para a
  interface não dizer que um analista foi chamado.

**5. Anexos da resposta, montados pelo código.** O `responder` aceita `opcoes` (respostas rápidas)
e `chamados` (ids para mostrar como cards). O código:

- só monta o card de um chamado que uma tool trouxe **neste turno, em nome deste funcionário**;
  citar o id de um chamado de outra pessoa não gera card;
- anexa o rascunho da última proposta bem-sucedida do turno, para o card de confirmação;
- apara as opções, tira as vazias e corta em 4.

**6. Contexto do modelo.** O turno leva as últimas 20 mensagens da sessão
(`MENSAGENS_ANTERIORES_NO_CONTEXTO`), para o custo por turno não crescer sem limite. Os chamados
vencidos entram como um aviso marcado como "do sistema, não do funcionário", junto da mensagem
atual.

## Opções consideradas

| Opção                                           | Confirmação garantida | Duplicidade                      |
| ----------------------------------------------- | --------------------- | -------------------------------- |
| Tool `criar_chamado` e instrução no prompt      | Não                   | Depende do modelo                |
| Tool `confirmar_rascunho` lendo o "sim" do chat | Depende do modelo     | Depende do modelo                |
| **Proposta, clique no card e candidatos**       | Pelo tipo e pelo dono | Conferência explícita e no trace |

## Análise de trade-offs

**Confirmar pelo clique, não pelo texto:** um "pode criar" digitado não confirma nada. É menos
conversacional, mas é o que faz a regra valer mesmo com o modelo errando, e o card já é parte do
protótipo.

**Candidatos por categoria:** a regra pode pedir conferência de chamados que falam de outro
assunto da mesma categoria. O custo é uma chamada a mais ao modelo nesse caso; o ganho é que
nenhuma duplicidade passa sem o modelo ter visto o chamado parecido.

**Prioridade:** só a combinação que o Anexo A proíbe com clareza (`critica` para uma pessoa só) é
recusada pelo código. Escolher entre `alta` e `media` depende de entender a urgência, e fica com o
modelo e com a eval ([ADR-0006](0006-modelo-de-llm.md)).

**Transição de status pelo LLM** ([ADR-0013](0013-transicoes-de-status-do-chamado.md), item 3):
nenhuma história do PRD pede que o funcionário mude o status pelo chat. Reabrir já acontece pelo
complemento. A leitura fica para quando houver essa história.

## Como foi verificado

- 19 cenários das propostas: rascunho guardado com o prazo do código, campo vazio, argumentos fora
  do schema, candidatos abertos e resolvidos há 4 e 8 dias, chamado de outro funcionário,
  prioridade crítica para uma pessoa e para a equipe, legado e banco de conversas fora do ar.
- 11 cenários de confirmação e descarte, incluindo o clique repetido, o clique de outra pessoa, o
  armazenamento adulterado, o legado fora do ar e a corrida entre confirmar e descartar.
- 5 testes de contrato dos rascunhos, em memória e no PGlite; a privacidade pelo dono foi
  sabotada no cliente Postgres e o contrato pegou.
- Teste de tipo: `conformeOConteudo` sem o ramo do complemento, ou com o ramo errado, não compila.

## Consequências

- Mais fácil: acrescentar uma verificação a uma proposta (uma linha em `propor.ts` e um motivo em
  `descreverErro`, que o compilador cobra).
- Mais difícil: a interface precisa de dois endpoints a mais (confirmar e descartar).
- O resultado do clique entra no histórico na mesma transação que resolve o rascunho
  ([ADR-0021](0021-historico-com-eventos-e-console.md)), e o modelo o lê como aviso do sistema.

## Itens de ação

1. [x] `propor_chamado` e `propor_complemento` com as verificações.
2. [x] Rascunhos persistidos e resolução condicional.
3. [x] `confirmarRascunho` e `descartarRascunho`.
4. [x] Transferência como decisão final.
5. [x] Anexos da resposta e contexto das mensagens anteriores.
6. [x] Resultado do clique no histórico.
7. [ ] Endpoints de confirmar e descartar.
