# ADR-0004: PostgreSQL com Drizzle; PGlite nos testes

**Status:** Aceito
**Data:** 2026-10-28
**Decisores:** FranciscoHonorat

## Contexto

Conversas, chamados e o estado de cada conversa precisam sobreviver a um reinício. O desenho
depende de duas capacidades do banco:

- **escrita condicional atômica**, usada em todas as transições de estado;
- **restrição `UNIQUE`**, usada pela chave de idempotência na criação de chamados.

Também precisamos rodar localmente com poucos comandos e ter testes rápidos.

## Decisão

PostgreSQL com Drizzle como camada de acesso tipada e de migrations.

- Local: `docker compose up`.
- Testes: **PGlite**, um PostgreSQL compilado para WebAssembly que roda dentro do processo de
  teste. O banco é criado e migrado uma vez por arquivo de teste, e cada teste começa com
  `TRUNCATE` e o reinício das sequências.
- Produção: PostgreSQL gerenciado pela plataforma de deploy.

## Opções consideradas

### Opção A: SQLite

| Dimensão            | Avaliação                   |
| ------------------- | --------------------------- |
| Rodar localmente    | Zero setup                  |
| Escrita condicional | Sim (escritas serializadas) |
| Deploy              | Exige volume persistente    |
| Várias instâncias   | Não                         |

### Opção B: PostgreSQL (escolhida)

| Dimensão            | Avaliação                                       |
| ------------------- | ----------------------------------------------- |
| Rodar localmente    | `docker compose up`                             |
| Escrita condicional | Sim                                             |
| Deploy              | Banco gerenciado                                |
| Várias instâncias   | Sim, e `LISTEN/NOTIFY` substitui o EventEmitter |

## Análise de trade-offs

Os motivos são a paridade entre desenvolvimento, teste e produção (sem bugs que só aparecem num
dos bancos) e o caminho de escala já previsto na [ADR-0002](0002-tempo-real-com-sse.md).

**Não é motivo:** portabilidade entre bancos. Os schemas do Drizzle são específicos de cada
dialeto (`pgTable` e `sqliteTable`), então trocar de banco depois não sai de graça.

## Como ficou o esquema

- **O banco também garante os tipos do domínio.** `status`, `tipo`, `categoria`, `prioridade` e
  `afetados` são `ENUM`s do PostgreSQL. Cada lista é declarada com
  `satisfies readonly <TipoDoDomínio>[]`, e um teste de tipo prova que cada `ENUM` é exatamente a
  união do domínio. Os formatos do `TicketId` e do `UserId` são restrições `CHECK`. Por isso, a
  leitura usa `$type<TicketId>()` sem revalidar.
- **A idempotência fica no banco:** `UNIQUE` em `rascunho_id`, nas duas tabelas. A criação usa
  `INSERT … ON CONFLICT DO NOTHING` seguido de uma releitura.
- **Os números dos chamados vêm de `SEQUENCE`s**, uma por tipo, a partir de 30000 e com limite de
  9 dígitos. O id é montado no próprio banco: `prefixo || '-' || nextval(sequência)`.
- **A transição condicional é SQL:** o domínio decide, e o banco confirma com
  `UPDATE … WHERE status = :de`. Se a linha mudou no meio do caminho, o `UPDATE` afeta 0 linhas e
  a decisão é refeita com o estado novo.
- **Migrations** em SQL gerado pelo `drizzle-kit` e versionado em `drizzle/`. O mesmo arquivo é
  aplicado no PGlite e no PostgreSQL real.

## Como foi verificado

- A compatibilidade entre PGlite e Drizzle foi conferida antes de qualquer código: o `UPDATE`
  condicional afetou 1 linha e depois 0, e o `UNIQUE` disparou o código 23505. O plano B
  (Testcontainers) não foi necessário.
- O cliente PostgreSQL passa no **mesmo contrato** da versão em memória e da resiliente.
- Medição para os testes: criar e migrar um PGlite custa cerca de 1.900 ms, clonar cerca de
  360 ms, e `TRUNCATE` cerca de 4 ms. Com o `TRUNCATE`, a esteira completa caiu de 53 s para 18 s.

## Consequências

- Mais fácil: testes com o banco real; escala futura.
- Mais difícil: setup local, que depende de Docker.
- **O PGlite tem uma conexão só**, então não reproduz duas transações ao mesmo tempo. Por isso
  existe uma segunda bateria, `postgres-real.test.ts`, que roda o contrato e três corridas (cada
  uma repetida 20 vezes) contra um PostgreSQL 18.6 de verdade:
  - localmente, com `docker compose up` e o `.env` criado a partir do `.env.example`;
  - no CI, com um serviço PostgreSQL no GitHub Actions, em todo push.
- **A esteira local exige o banco no ar.** Só o banco real exercita os caminhos de concorrência:
  sem ele, a cobertura de branches cai de 97,93% para 94,84%, abaixo do mínimo. Em vez de baixar o
  mínimo, o `npm run check` lê o `.env` e roda igual ao CI. O pre-commit roda só o `npm test`, que
  pula os testes de integração quando não há `TEST_DATABASE_URL`, então o commit continua rápido e
  não depende do Docker.
- **Bug de concorrência encontrado e corrigido:** em `complementar`, a checagem de "complemento já
  aplicado" acontecia fora da transação, e duas tentativas simultâneas do mesmo rascunho faziam a
  segunda esbarrar no `UNIQUE` e lançar um erro. Um teste com PostgreSQL real reproduziu o erro
  (código 23505) antes da correção. Agora o `INSERT` usa `ON CONFLICT DO NOTHING` dentro da
  transação, e quem perde a corrida devolve o estado atual do chamado.
- **Vulnerabilidades:** o `npm audit` aponta 4 moderadas, todas vindas do `drizzle-kit` (uma
  versão antiga do `esbuild`, cujo problema é o servidor de desenvolvimento). O `drizzle-kit` é
  só uma ferramenta de desenvolvimento, e as dependências de produção têm 0 vulnerabilidades.

## Itens de ação

1. [x] `docker-compose.yml` com PostgreSQL.
2. [x] Schema e primeira migration.
3. [x] Fixture de teste com PGlite.
4. [ ] Indisponibilidade do banco vira `indisponivel`.
5. [x] Testes de concorrência com PostgreSQL real, e a correção do `complementar`.
6. [ ] Aplicar as migrations na inicialização em produção.
