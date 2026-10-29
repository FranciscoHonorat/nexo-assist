# ADR-0015: Fronteiras verificadas pelo lint

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O [ADR-0001](0001-servico-de-chamados-in-process.md) colocou o serviço de chamados no mesmo
processo da aplicação, atrás da interface `TicketClient`. O risco dessa escolha é a fronteira
virar só uma convenção: nada físico impede que o código do agent importe a versão em memória
direto e passe a depender dela.

O domínio (`src/domain`) é puro hoje: só importa os próprios módulos. Nada garante que continue
assim.

## Decisão

As fronteiras são verificadas pelo ESLint e declaradas em `src/arquitetura/fronteiras.ts`:

| Fronteira              | Regra                                                                 | Exceções                                              |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Do serviço de chamados | Fora de `src/tickets`, só a interface `ticket-client.js` é importável | Testes; `src/composicao`, que monta as implementações |
| De conversas           | Fora de `src/conversas`, só a interface `conversas.js` é importável   | Testes; `src/composicao`                              |
| Do domínio             | `src/domain` não importa nada de fora dele                            | Testes                                                |
| Da infraestrutura      | `src/infraestrutura` não importa `tickets`, `conversas` nem `agent`   | Testes                                                |
| Do framework de agent  | `@mastra/*`, `@ai-sdk/*` e `ai` só dentro de `src/agent/mastra`       | Testes                                                |

- Cada fronteira é **uma regra própria** num plugin local (`fronteiras/<nome>`), que verifica
  `import … from`, `export … from` e `export * from` contra uma `RegExp` do que é proibido e do
  que é permitido.
- Cada violação mostra uma mensagem que explica a regra e aponta para a linha do import.
- Como o lint roda no pre-commit e no CI ([ADR-0007](0007-esteira-de-qualidade.md)), uma
  violação não chega a ser commitada.
- Uma fronteira nova é uma entrada em `FRONTEIRAS`: `{ nome, protege, exceto, proibe, permite, porque }`.
- Uma fronteira de pacotes declara os nomes com `pacotes("@mastra/*", "ai")`: `@mastra/*` cobre o
  escopo inteiro, e `ai` cobre o pacote e seus subcaminhos (`ai/test`), mas não `aiko`.
- O `eslint.config.js` importa esse módulo `.ts` diretamente, usando o _type stripping_ do
  Node 24.

## Opções consideradas

| Opção                                             | Quebra o build | Fronteiras se somam no mesmo arquivo     | Dependência extra |
| ------------------------------------------------- | -------------- | ---------------------------------------- | ----------------- |
| Convenção documentada                             | Não            | —                                        | Nenhuma           |
| `dependency-cruiser`                              | Sim            | Sim                                      | Uma ferramenta    |
| `no-restricted-imports`, uma config por fronteira | Sim            | **Não**: a última config apaga as outras | Nenhuma           |
| **Regra própria por fronteira (escolhida)**       | Sim            | Sim                                      | Nenhuma           |

## Análise de trade-offs

**Por que não o `no-restricted-imports`:** a primeira versão usava essa regra nativa, uma
configuração por fronteira. Na configuração flat do ESLint, duas entradas que configuram a mesma
regra para o mesmo arquivo não se somam: a última substitui a anterior. Com a fronteira de
conversas valendo para `src/**`, ela apagaria a de chamados em `src/agent` sem aviso. Registrar a
regra nativa sob vários nomes exigiria `builtinRules`, que o ESLint 10 marca como obsoleta. A
regra própria tem cerca de 15 linhas e não depende de API interna.

A regra olha o texto do import, não o arquivo resolvido. Um import escrito de um
jeito inesperado (um alias de caminho, por exemplo) poderia escapar. O projeto não usa aliases, e
o `dependency-cruiser` fica como alternativa se isso mudar.

**Exceção para testes:** testes de outras camadas podem usar a versão em memória como dublê. Essa
é a forma mais fiel de testar quem consome o serviço, porque a versão em memória passa no mesmo
contrato que qualquer implementação real.

**Por que a fronteira do domínio:** as dependências só podem apontar para dentro. Se o domínio
importasse o serviço de chamados ou o agent, as regras de negócio passariam a depender de
detalhes de infraestrutura, e os testes do domínio deixariam de ser lógica pura.

## Como foi verificado

- 32 testes analisam trechos de código escritos no próprio teste, com um ESLint montado só com as
  regras de fronteira, incluindo reexportações.
- Arquivos temporários que violavam as quatro fronteiras foram barrados pelo `eslint` real do
  projeto. Um mesmo arquivo violando chamados e conversas recebeu os dois erros, provando que as
  fronteiras se somam.

## Consequências

- Mais fácil: confiar que o agent só fala com a interface.
- Mais difícil: nada relevante; um import proibido mostra o motivo na mensagem.
- A composição monta o modelo por `mastraComAnthropic`, sem importar o AI SDK: o tipo do modelo
  do Mastra não vaza para fora de `src/agent/mastra`.

## Itens de ação

1. [x] Fronteira do serviço de chamados.
2. [x] Fronteira do domínio.
3. [x] Fronteiras de conversas e da infraestrutura compartilhada.
4. [x] Fronteira do framework de agent ([ADR-0005](0005-mastra-minimo.md)).
5. [x] Fronteira da interface: `web/` conhece o servidor só pelo contrato da API
       ([ADR-0022](0022-borda-http-acesso-e-limites.md)).
