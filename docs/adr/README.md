# Decisões de arquitetura (ADRs)

Cada arquivo registra uma decisão: o contexto, as opções consideradas, o que foi escolhido e o
que muda com a escolha. O código não tem comentários, então o **porquê** das decisões mora aqui
e nas mensagens de commit ([ADR-0009](0009-codigo-sem-comentarios.md)).

## Princípio que orienta todas as decisões

> **O LLM propõe, o código garante. Sempre que possível, o compilador garante.**

Toda regra de negócio que não pode falhar (confirmação antes de criar, privacidade entre
funcionários, agent pausado durante o atendimento humano) é aplicada por código determinístico
ou pelo sistema de tipos, nunca só por uma instrução no prompt.

Padrão recorrente: **transição condicional** (`UPDATE ... WHERE estado = esperado`). Ela resolve a
corrida entre analistas, o clique duplo na confirmação, a corrida entre agent e analista e o retry
de alteração de status.

## Índice

| ADR                                                  | Decisão                                                          | Status | Implementação |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------ | ------------- |
| [0001](0001-servico-de-chamados-in-process.md)       | Serviço de chamados no mesmo processo, atrás de interface        | Aceito | Feito         |
| [0002](0002-tempo-real-com-sse.md)                   | Tempo real com SSE e EventEmitter; banco como fonte da verdade   | Aceito | Em andamento  |
| [0003](0003-saida-do-agent-via-tool.md)              | Toda saída do agent passa pela tool `responder`                  | Aceito | Em andamento  |
| [0004](0004-postgres-com-drizzle.md)                 | PostgreSQL com Drizzle; PGlite nos testes                        | Aceito | Em andamento  |
| [0005](0005-mastra-minimo.md)                        | Mastra em uso mínimo, contido atrás de `AgentStep`               | Aceito | Feito         |
| [0006](0006-modelo-de-llm.md)                        | Claude Haiku 5.5 como ponto de partida                           | Aceito | Em andamento  |
| [0007](0007-esteira-de-qualidade.md)                 | Esteira de qualidade local e no CI; versões fixas                | Aceito | Feito         |
| [0008](0008-garantias-no-sistema-de-tipos.md)        | Garantias no sistema de tipos; `Resultado` em vez de exceções    | Aceito | Feito         |
| [0009](0009-codigo-sem-comentarios.md)               | Código sem comentários                                           | Aceito | Feito         |
| [0010](0010-formato-dos-ids.md)                      | Formato dos ids de chamado, usuário e rascunho                   | Aceito | Feito         |
| [0011](0011-prazos-em-horas-uteis-de-sao-paulo.md)   | Prazos em horas úteis no horário de São Paulo                    | Aceito | Feito         |
| [0012](0012-complemento-e-reabertura-de-chamados.md) | Complemento e reabertura de chamados                             | Aceito | Feito         |
| [0013](0013-transicoes-de-status-do-chamado.md)      | Transições de status do chamado                                  | Aceito | Feito         |
| [0014](0014-legado-fora-do-ar.md)                    | Legado fora do ar                                                | Aceito | Feito         |
| [0015](0015-fronteiras-verificadas-pelo-lint.md)     | Fronteiras verificadas pelo lint                                 | Aceito | Feito         |
| [0016](0016-guardas-do-turno.md)                     | Guardas do turno antes do LLM, com marca e trace                 | Aceito | Feito         |
| [0017](0017-loop-de-tools-no-codigo.md)              | Loop de tools no código, com o modelo decidindo um passo por vez | Aceito | Feito         |
| [0018](0018-persistencia-das-conversas.md)           | Persistência das conversas, com controle e turno condicionais    | Aceito | Feito         |
| [0019](0019-acoes-do-agent.md)                       | O modelo propõe, o clique confirma, o código verifica            | Aceito | Em andamento  |
| [0020](0020-central-de-ajuda.md)                     | Central de ajuda com busca por palavras, no código               | Aceito | Em andamento  |
| [0021](0021-historico-com-eventos-e-console.md)      | Histórico com eventos, mensagens do analista e sessões           | Aceito | Em andamento  |
