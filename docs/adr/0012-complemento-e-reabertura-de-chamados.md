# ADR-0012: Complemento e reabertura de chamados

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O Anexo A do PRD define três regras que se aplicam a complementar um chamado:

- **Sem duplicidade:** se já existe um chamado aberto sobre o mesmo problema, ele é atualizado, não
  duplicado. Chamados resolvidos há até 7 dias podem ser reabertos.
- **Abertura:** o agent mostra um rascunho e só cria **ou atualiza** o chamado depois da confirmação
  do funcionário.
- **Prazos:** o prazo vale para a primeira resposta e para cada atualização.

O serviço de chamados é legado e pode cair, então a mesma operação pode chegar mais de uma vez.

## Decisão

1. **Complementar também exige um rascunho confirmado.** O `Rascunho` é genérico no tipo de
   conteúdo: `Rascunho<"confirmado", NovoChamado>` só serve para `criar`, e
   `Rascunho<"confirmado", Complemento>` só serve para `complementar`. Trocar um pelo outro não
   compila.
2. **Idempotência pelo id do rascunho**, como na criação. O resultado de cada rascunho aplicado
   fica guardado, inclusive quando é uma falha de regra: repetir devolve a mesma resposta, sem
   acrescentar o complemento de novo.
3. **Reabertura inclusiva:** um chamado resolvido há **até 7 dias, inclusive**, é reaberto. Os 7
   dias são corridos, não úteis, porque o Anexo A não fala em dias úteis para essa regra. Depois
   disso, a resposta é `resolvido_ha_mais_de_7_dias`, e o agent deve propor um chamado novo.
4. **O momento da resolução é o `atualizadoEm` de um chamado `resolvido`.** Resolver é a última
   atualização de um chamado, e o modelo não tem um campo `resolvidoEm` separado.
5. **Todo complemento renova o `atualizadoEm`.** Assim, o prazo da prioridade volta a contar a
   partir dele ([ADR-0011](0011-prazos-em-horas-uteis-de-sao-paulo.md)).
6. **A regra mora no domínio** (`complementarChamado` em `chamado.ts`). A checagem de dono fica no
   serviço, porque é controle de acesso: um chamado de outra pessoa devolve `nao_encontrado`, o
   mesmo erro de um id inexistente.

## Opções consideradas

### Onde mora a regra de reabertura

| Opção                       | Reuso por um cliente real | Testável sem serviço |
| --------------------------- | ------------------------- | -------------------- |
| Dentro da versão em memória | Não                       | Não                  |
| **No domínio (escolhida)**  | Sim                       | Sim                  |

### Como guardar o momento da resolução

| Opção                                               | Simplicidade | Precisão                                         |
| --------------------------------------------------- | ------------ | ------------------------------------------------ |
| Campo `resolvidoEm` opcional                        | Média        | Alta                                             |
| Chamado como união por status                       | Baixa        | Alta                                             |
| **`atualizadoEm` do chamado resolvido** (escolhida) | Alta         | Alta, enquanto resolver for a última atualização |

## Análise de trade-offs

Usar o `atualizadoEm` depende de uma premissa: um chamado resolvido não recebe outras
atualizações. Se o sistema real permitir, por exemplo, comentários internos em chamados
resolvidos, a regra passa a medir a partir do último comentário. Nesse caso, a opção certa é o
chamado como união por status, com `resolvidoEm` só no estado `resolvido`.

Guardar também as falhas de regra na idempotência evita que um retry produza uma resposta
diferente. Falhas de infraestrutura (o legado fora do ar) não devem ser guardadas, porque uma
nova tentativa pode dar certo. Isso entra junto com as falhas injetáveis.

## Consequências

- Mais fácil: qualquer implementação de `TicketClient` reutiliza a regra de reabertura.
- Mais difícil: mudar a premissa sobre o `atualizadoEm` exige mudar o modelo do chamado.
- O contrato verifica o limite exato: resolvido há 7 dias reabre; há 7 dias e 1 minuto, não.

## Itens de ação

1. [x] Rascunho genérico no tipo de conteúdo.
2. [x] `complementar` no contrato e na versão em memória.
3. [x] Regra de reabertura no domínio.
4. [ ] Não guardar falhas de infraestrutura na idempotência.
