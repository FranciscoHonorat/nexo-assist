# ADR-0010: Formato dos ids de chamado, usuário e rascunho

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

Ids chegam de fora em vários pontos: digitados pelo funcionário, escritos pelo LLM, recebidos na
URL do clique de confirmação ou lidos do banco. Cada um precisa de um formato que possa ser
validado e de uma normalização que evite duplicatas.

## Decisão

| Id           | Formato                | Normalização        | Origem                    |
| ------------ | ---------------------- | ------------------- | ------------------------- |
| `TicketId`   | `INC-<n>` ou `REQ-<n>` | `trim` + maiúsculas | Funcionário, LLM, serviço |
| `UserId`     | e-mail em `@nexo.com`  | `trim` + minúsculas | Sessão autenticada        |
| `RascunhoId` | `rsc_` + UUID v4       | `trim` + minúsculas | Gerado pelo sistema; URL  |

- **`TicketId`:** o prefixo segue os tipos do Anexo A do PRD: `INC` para incidente e `REQ` para
  requisição. O tipo do chamado é deduzido do prefixo, inclusive em tempo de compilação. O
  número tem no máximo 9 dígitos (`MAXIMO_DE_DIGITOS`), o que mantém o valor dentro de um
  inteiro seguro.
- **`UserId`:** só o domínio corporativo exato é aceito. Subdomínios (`sub.nexo.com`) e domínios
  parecidos (`nexo.com.br`) são rejeitados com o motivo `dominio_externo`. A normalização impede
  que o mesmo funcionário vire dois.
- **`RascunhoId`:** o UUID v4 torna o id impossível de adivinhar, e o prefixo `rsc_` o distingue
  de qualquer outro id. A regex ancorada rejeita tentativas de path traversal vindas da URL.

## Opções consideradas

Para o `RascunhoId`:

| Opção                            | Adivinhável | Legível |
| -------------------------------- | ----------- | ------- |
| Sequencial (`d-1`, `d-2`)        | Sim         | Alta    |
| **`rsc_` + UUID v4 (escolhida)** | Não         | Média   |

## Análise de trade-offs

Um id sequencial deixaria um funcionário tentar confirmar o rascunho de outro só trocando o
número na URL. A checagem de dono já bloqueia isso, mas um id imprevisível acrescenta uma camada
de defesa.

O domínio `nexo.com` é uma regra de negócio fixa no código. Se a empresa tiver mais de um
domínio, ele vira configuração.

## Consequências

- Mais fácil: `TicketId` e `RascunhoId` são lidos pela mesma função (`lerNoFormato`). O `UserId` tem
  leitura própria porque tem dois motivos de erro e a regra do domínio corporativo.
- Mais difícil: ids de rascunho são longos para depurar.
- Revisitar o domínio corporativo se houver mais de um.

## Itens de ação

1. [x] `lerTicketId`, `lerUserId`, `lerRascunhoId` e `novoRascunhoId`.
