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
  teste, com um banco novo por teste.
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

## Consequências

- Mais fácil: testes com o banco real; escala futura.
- Mais difícil: setup local, que depende de Docker.
- Validar no primeiro teste a compatibilidade entre PGlite e Drizzle. Plano B: Testcontainers.

## Itens de ação

1. [ ] `docker-compose.yml` com PostgreSQL.
2. [ ] Schema e primeira migration.
3. [ ] Fixture de teste com PGlite.
