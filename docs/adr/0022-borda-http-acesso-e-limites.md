# ADR-0022: Borda HTTP com Hono, sessão assinada e limites de uso

**Status:** Aceito
**Data:** 2026-10-29
**Decisores:** FranciscoHonorat

## Contexto

Faltava o que liga a interface aos casos de uso: login com e-mail corporativo e senha, dois
papéis (funcionário e analista), o chat, o console e o tempo real. Num deploy público, a chave do
LLM e o custo por conversa precisam de proteção.

## Decisão

**1. Hono na borda (`src/http`).** Rotas finas que leem o corpo com zod, chamam os casos de uso e
traduzem o resultado. `Request` e `Response` são os do padrão web, então cada rota é testada com
`app.request()`, sem abrir porta. `secureHeaders` e `csrf` vêm do próprio Hono.

**2. Quem é a pessoa vem só da sessão.** O chat usa sempre o usuário do cookie; um `usuario` no
corpo é ignorado. O papel vem do **diretório**, não do token: quem sai do diretório perde o acesso
na hora, mesmo com o cookie válido.

**3. Sessão assinada, sem estado no servidor** (`src/acesso/sessao.ts`). O cookie leva id, papel
e validade (8 horas), assinados com HMAC-SHA256 e comparados em tempo constante. É `HttpOnly`,
`SameSite=Lax` e `Secure` em produção. Sobrevive a um reinício sem tabela de sessões.

**4. Senhas só como hash** (scrypt com sal). O login responde o mesmo erro para senha errada e
e-mail inexistente, e calcula um hash mesmo quando a pessoa não existe, para o tempo não revelar
quem tem conta.

**5. Erros com status exaustivo.** `STATUS_POR_MOTIVO` tem um status para cada motivo de erro dos
casos de uso (`satisfies Record<MotivoDeErro, …>`): um motivo novo não compila sem status.

**6. Limites de uso.** Um turno por vez por pessoa e no máximo 40 por hora (`src/http/limite.ts`),
além das 30 mensagens por sessão e das 5 chamadas ao modelo por turno. Cada chamada ao modelo tem
teto de 4096 tokens de saída. Se o modelo falhar, o turno conclui com uma resposta fixa, e a
pergunta fica gravada.

**7. SSE.** `/api/conversa/eventos` manda o estado e as mensagens a partir do `Last-Event-ID`;
`/api/console/eventos` manda só "a conversa de X mudou". Um ping a cada 25 segundos mantém a
conexão viva atrás de proxies.

**8. Contrato de tipos** (`src/http/contrato.ts`). A interface importa só esse arquivo, e só tipos
(fronteira `da-interface`). `JsonDe<T>` descreve o valor depois de passar por JSON: datas viram
texto e as marcas de validação somem.

## Opções consideradas

| Opção                        | Testar sem abrir porta | SSE e cookies prontos | Dependências                    |
| ---------------------------- | ---------------------- | --------------------- | ------------------------------- |
| `node:http` à mão            | Não                    | Não                   | Nenhuma                         |
| Express                      | Com supertest          | Parcial               | Várias                          |
| Fastify                      | `inject()`             | Com plugins           | Várias                          |
| **Hono + @hono/node-server** | `app.request()`        | Sim                   | Duas, sem dependências próprias |

## Análise de trade-offs

**Sessão sem estado:** não dá para revogar um cookie antes de ele expirar. Em troca, não há
tabela de sessões, e o diretório consultado a cada pedido cobre a saída de alguém.

**Limite em memória:** zera num reinício, e não vale entre instâncias, o que é coerente com a
instância única da [ADR-0002](0002-tempo-real-com-sse.md).

**Registro do agent tipado pelo contrato:** o banco guarda o registro como `Json` opaco
([ADR-0018](0018-persistencia-das-conversas.md)). O contrato afirma que ele tem a forma de
`RegistroDoAgent`, porque é o que `atenderMensagem` grava. É uma asserção na fronteira, listada na
[ADR-0008](0008-garantias-no-sistema-de-tipos.md).

## Como foi verificado

- 34 testes HTTP: login, cookie, 401, 403 por papel, pedido de outro site recusado, sessão de
  quem saiu do diretório, turno em andamento e limite, confirmar e descartar com o dono certo,
  nova sessão, SSE com `Last-Event-ID` e sem vazamento entre pessoas, e o console completo.
- 25 testes de acesso: hash, diretório e sessão (expirada, adulterada, outro segredo, conteúdo
  fora do formato).
- Servidor real e imagem Docker contra o PostgreSQL: migração, semente, login, chat com o modelo
  fora do ar e SSE.

## Itens de ação

1. [x] Rotas do chat, do console e do tempo real.
2. [x] Login, papéis e sessão.
3. [x] Limites de uso e modelo fora do ar.
