# ADR-0011: Prazos em horas úteis no horário de São Paulo

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

O Anexo A do PRD define o prazo de cada prioridade: Crítica em 1 hora, Alta em 4 horas úteis,
Média em 3 dias úteis e Baixa em 5 dias úteis. O service desk funciona de segunda a sexta, das 8h
às 18h, e chamados críticos têm plantão 24 horas. O prazo vale para a primeira resposta e para
cada atualização; passado o prazo, o chamado está vencido.

Saber se um chamado está vencido é uma guarda do pipeline e um dos motivos de transferência para
um analista. O cálculo precisa ser determinístico e não pode depender do fuso horário da máquina
onde roda.

## Decisão

- **Um único relógio de horas úteis.** Como o expediente tem 10 horas, 3 dias úteis equivalem a
  30 horas úteis e 5 dias úteis a 50. Um chamado aberto fora do expediente começa a contar na
  próxima abertura.
- **Crítica usa o relógio corrido**, a qualquer hora e em qualquer dia.
- **Vencido significa `agora > prazo`.** Exatamente no prazo, ainda não venceu.
- **O prazo conta a partir da última atualização** (ou da abertura, se não houve nenhuma).
- **Horário de São Paulo com deslocamento fixo de UTC−03:00.** O cálculo usa apenas aritmética
  sobre UTC e nunca o fuso do processo.
- **`InstanteEmSaoPaulo`**, um `number` com marca própria, separa o horário local dos
  milissegundos UTC dentro do módulo.

## Opções consideradas

| Opção                                       | Determinístico | Dependência | Disponível no Node 24      |
| ------------------------------------------- | -------------- | ----------- | -------------------------- |
| Fuso da máquina (`getHours`)                | Não            | Nenhuma     | Sim                        |
| `Temporal` com `America/Sao_Paulo`          | Sim            | Nenhuma     | Não, sem flag experimental |
| Biblioteca de datas com fuso                | Sim            | Externa     | Sim                        |
| **Deslocamento fixo UTC−03:00** (escolhida) | Sim            | Nenhuma     | Sim                        |

## Análise de trade-offs

O deslocamento fixo é correto porque o Brasil não tem horário de verão desde 2019. O offset de
`America/Sao_Paulo` foi conferido como UTC−03:00 em janeiro e em julho de 2026.

Para provar que o resultado não depende do ambiente, a suíte de prazos foi executada manualmente
com a máquina em cinco fusos (São Paulo, UTC, Tóquio, Kiritimati e Los Angeles). A esteira roda
num fuso só.

A marca `InstanteEmSaoPaulo` impede que funções do módulo recebam milissegundos UTC no lugar do
horário local, e o contrário. Ela **não** protege as APIs nativas: `new Date(instante)` aceita
qualquer `number`, inclusive um com marca. Por isso a conversão de volta passa sempre por
`deSaoPaulo`.

## Consequências

- Mais fácil: testar prazos com datas fixas, em qualquer máquina.
- Mais difícil: suportar outro fuso ou a volta do horário de verão, que exigiria trocar o
  deslocamento fixo por uma regra de fuso.
- **Feriados ficam fora do escopo**: o PRD não fala deles. Revisitar se a Nexo tiver um
  calendário de feriados.
- Revisitar o uso de `Temporal` quando ele estiver disponível sem flag no Node.

## Itens de ação

1. [x] `calcularPrazo` e `estaVencido`.
2. [ ] Rodar a suíte de prazos em mais de um fuso no CI (matriz com `TZ`).
3. [ ] Calendário de feriados, se for necessário.
