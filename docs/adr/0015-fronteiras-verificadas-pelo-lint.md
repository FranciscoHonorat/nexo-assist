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

Duas fronteiras são verificadas pelo ESLint (`no-restricted-imports`), declaradas em
`src/arquitetura/fronteiras.ts`:

| Fronteira              | Regra                                                                 | Exceções                                              |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Do serviço de chamados | Fora de `src/tickets`, só a interface `ticket-client.js` é importável | Testes; `src/composicao`, que monta as implementações |
| Do domínio             | `src/domain` não importa nada de fora dele                            | Testes                                                |

- Cada violação mostra uma mensagem que explica a regra e aponta o ADR.
- Como o lint roda no pre-commit e no CI ([ADR-0007](0007-esteira-de-qualidade.md)), uma
  violação não chega a ser commitada.
- Uma fronteira nova é uma chamada a `fronteira({ nome, protege, exceto, proibe, porque })`.
- O `eslint.config.js` importa esse módulo `.ts` diretamente, usando o _type stripping_ do
  Node 24.

## Opções consideradas

| Opção                                   | Quebra o build | Testável | Dependência extra |
| --------------------------------------- | -------------- | -------- | ----------------- |
| Convenção documentada                   | Não            | Não      | Nenhuma           |
| `dependency-cruiser`                    | Sim            | Sim      | Uma ferramenta    |
| **`no-restricted-imports` (escolhida)** | Sim            | Sim      | Nenhuma           |

## Análise de trade-offs

O `no-restricted-imports` olha o texto do import, não o arquivo resolvido. Um import escrito de um
jeito inesperado (um alias de caminho, por exemplo) poderia escapar. O projeto não usa aliases, e
o `dependency-cruiser` fica como alternativa se isso mudar.

**Exceção para testes:** testes de outras camadas podem usar a versão em memória como dublê. Essa
é a forma mais fiel de testar quem consome o serviço, porque a versão em memória passa no mesmo
contrato que qualquer implementação real.

**Por que a fronteira do domínio:** as dependências só podem apontar para dentro. Se o domínio
importasse o serviço de chamados ou o agent, as regras de negócio passariam a depender de
detalhes de infraestrutura, e os testes do domínio deixariam de ser lógica pura.

## Como foi verificado

- 13 testes analisam trechos de código escritos no próprio teste, com um ESLint montado só com as
  regras de fronteira.
- Arquivos temporários que violavam as duas fronteiras foram barrados pelo `eslint` real do
  projeto, provando que a configuração usa as regras.

## Consequências

- Mais fácil: confiar que o agent só fala com a interface.
- Mais difícil: nada relevante; um import proibido mostra o motivo na mensagem.
- Quando o agent existir, acrescentar a fronteira do Mastra
  ([ADR-0005](0005-mastra-minimo.md)): `@mastra/*` só dentro de `src/agent/mastra`.

## Itens de ação

1. [x] Fronteira do serviço de chamados.
2. [x] Fronteira do domínio.
3. [ ] Fronteira do Mastra, quando o agent existir.
