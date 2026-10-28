# ADR-0008: Garantias no sistema de tipos; `Resultado` em vez de exceções

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

A simplicidade do projeto vale para a infraestrutura, não para o código: o código deve usar o
sistema de tipos do TypeScript ao máximo. Um erro que não compila não precisa de teste para ser
pego, e ninguém consegue introduzi-lo por descuido.

## Decisão

**Tornar estados ilegais irrepresentáveis.**

1. **Marcas com `unique symbol` não exportado.** Um valor marcado só pode ser produzido pela
   função dona da marca, porque nenhum literal consegue escrever o símbolo.
   - `Validado<T, Nome>`: o valor foi lido e validado. Usado por `TicketId`, `UserId` e
     `RascunhoId`. O nome da marca impede que um id seja usado no lugar de outro.
   - `confirmadoPeloFuncionario`: só `confirmar` produz um `Rascunho<"confirmado">`. Fica
     separada de `Validado` porque o significado é outro.
2. **Um tipo por estado.** `Rascunho<"pendente">`, `Rascunho<"confirmado">` e
   `Rascunho<"descartado">` têm campos diferentes, e as transições só aceitam o estado de origem
   válido.
3. **`Resultado<T, E>` para erros esperados.** Ler um id ou confirmar um rascunho pode falhar, e
   o tipo obriga a verificar `ok` antes de usar o valor. Exceções ficam para erros de programação.
4. **Template literal types** para formatos: `` `${"INC" | "REQ"}-${number}` ``.
5. **Imutabilidade:** campos `readonly` no tipo e `Object.freeze` em runtime.

## Opções consideradas

| Opção                                        | Garantia   | Custo                    |
| -------------------------------------------- | ---------- | ------------------------ |
| `string` e exceções, validação em runtime    | Testes     | Baixo                    |
| Classes com construtor privado               | Compilador | Médio, com runtime extra |
| **Tipos marcados e `Resultado` (escolhida)** | Compilador | Zero em runtime          |

## Análise de trade-offs

As marcas não existem em runtime: o custo é zero. O preço é concentrar as asserções (`as`) em
poucos pontos auditáveis:

- `aplicarMarca` no rascunho, que só acrescenta a marca. Todos os outros campos são verificados
  pelo compilador no tipo `SemMarca`.
- `lerNoFormato` em `validado.ts`, que aplica a marca de validação depois de testar o formato.
- `lerUserId` e `novoRascunhoId`, que têm regras próprias.
- `lerConteudo` no rascunho, que afirma que validar um conteúdo preserva o seu tipo (`NovoChamado`
  continua `NovoChamado`). Eliminá-la exigiria o padrão de uniões correlacionadas do TypeScript,
  que só compila sem asserção quando o conteúdo é uma interseção (`{ tipo } & { dados }`).
  Achatar a interseção para o formato de objeto quebra a correlação. Em 2026-10-28, com o
  TypeScript 6.0.3, não foi possível ter as duas coisas, e a asserção de uma linha ficou.

As garantias de tipo são testadas em arquivos `*.test-d.ts`, com `@ts-expect-error` como
asserção: se o código passar a aceitar algo proibido, o teste falha.

## Consequências

- Mais fácil: passar ids entre camadas sem medo de troca; proteger a confirmação contra o LLM e
  contra o próprio código.
- Mais difícil: dados vindos de fora (banco, URL, LLM) sempre passam por uma função de leitura.
- A imutabilidade é rasa: campos `Date` ainda podem ser alterados por dentro.

## Itens de ação

1. [x] `Resultado`, `Validado`, `TicketId`, `UserId`, `RascunhoId`.
2. [x] `Rascunho` com dono e transições permitidas só ao dono.
3. [x] Máquina de estados da conversa com transições verificadas no tipo.
4. [x] `InstanteEmSaoPaulo` para separar horário local de UTC ([ADR-0011](0011-prazos-em-horas-uteis-de-sao-paulo.md)).
