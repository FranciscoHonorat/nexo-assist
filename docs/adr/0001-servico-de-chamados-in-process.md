# ADR-0001: Serviço de chamados no mesmo processo, atrás de interface

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O PRD pede um serviço de chamados simulado, **separado do agent**, que permita consultar, criar,
atualizar e transferir chamados. Ele representa um sistema legado que "de vez em quando fica
indisponível por alguns segundos". O projeto também precisa rodar localmente com poucos comandos.

A separação existe para que o sistema real possa substituir o simulado sem mudanças no agent.

## Decisão

O serviço de chamados roda **no mesmo processo** da aplicação e só é acessado pela interface
tipada `TicketClient`. A implementação simulada (`InMemoryTicketClient` ou equivalente) aceita
**falhas injetáveis** para reproduzir a indisponibilidade do legado.

## Opções consideradas

### Opção A: serviço HTTP separado

| Dimensão             | Avaliação                                 |
| -------------------- | ----------------------------------------- |
| Complexidade         | Média: dois processos, rede, configuração |
| Fidelidade ao legado | Alta: timeouts e falhas de rede reais     |
| Rodar localmente     | Dois processos (compose ou concurrently)  |
| Deploy               | Dois serviços                             |

**Prós:** separação evidente; falhas de rede reais.
**Contras:** mais peças para rodar, configurar e implantar.

### Opção B: módulo no mesmo processo atrás de `TicketClient` (escolhida)

| Dimensão             | Avaliação                         |
| -------------------- | --------------------------------- |
| Complexidade         | Baixa                             |
| Fidelidade ao legado | Média: falhas simuladas no código |
| Rodar localmente     | Um processo                       |
| Deploy               | Um serviço                        |

**Prós:** simplicidade de execução e deploy; falhas reproduzíveis em teste.
**Contras:** a separação depende de disciplina, porque nada físico impede um import direto.

## Análise de trade-offs

A simplicidade operacional pesou mais. O risco da opção B (a fronteira virar só uma convenção) é
mitigado por duas garantias automáticas:

1. **Teste de contrato:** uma suíte única que qualquer implementação de `TicketClient` precisa
   passar. Hoje roda contra a simulada; amanhã, sem mudanças, contra o cliente do sistema real.
2. **Regra de import no lint:** o código do agent não pode importar a implementação interna do
   serviço. Violar a fronteira quebra o build.

Por ser nosso, o serviço também concentra duas regras: a **checagem de dono** em toda operação
(um funcionário nunca vê o chamado de outro) e a **chave de idempotência** na criação.

## Consequências

- Mais fácil: rodar, testar e implantar; reproduzir a queda do legado em testes.
- Mais difícil: provar a separação, que agora depende do teste de contrato e do lint.
- Revisitar se o serviço precisar escalar ou ser implantado separadamente.

## Itens de ação

1. [x] Definir a interface `TicketClient`.
2. [x] Escrever a suíte de contrato.
3. [x] Implementar a versão simulada (listar, obter e criar).
4. [ ] Complementar chamado e alterar status.
5. [ ] Falhas injetáveis na versão simulada.
6. [ ] Adicionar a regra de import no ESLint.
