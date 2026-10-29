# Nexo Assist

Agent de service desk de TI da Nexo. O funcionário conversa com o agent, que consulta os chamados
dele, busca na central de ajuda, propõe abrir ou atualizar um chamado e chama um analista quando
precisa. O analista acompanha as conversas num console, assume o atendimento com o agent pausado
e o devolve ou encerra.

> **O LLM propõe, o código garante. Sempre que possível, o compilador garante.**

## Como rodar

Pré-requisitos: Node 24 e Docker.

```bash
docker compose up -d            # PostgreSQL na porta 5433 (bancos nexo e nexo_teste)
cp .env.example .env            # preencha ANTHROPIC_API_KEY e SESSION_SECRET
npm ci
npm run build                   # servidor em dist/ e interface em web/dist/
npm start                       # http://localhost:3000
```

`SESSION_SECRET` precisa de pelo menos 32 caracteres; gere um com `openssl rand -base64 48`. Na
primeira subida, o servidor aplica as migrations e grava os chamados de exemplo.

Para mexer na interface com recarga automática, deixe o `npm start` rodando e use
`npm run dev:web` (Vite em http://localhost:5173, com `/api` apontando para o servidor).

### Pessoas de exemplo

Todas entram com a senha de demonstração **`nexo-demo-2026`**. No código, as senhas existem só
como hash (scrypt).

| E-mail                   | Papel       | Situação                                                 |
| ------------------------ | ----------- | -------------------------------------------------------- |
| `ana.souza@nexo.com`     | Funcionária | INC-20311 vencido, INC-20298 aberto, INC-20150 resolvido |
| `carla.mendes@nexo.com`  | Funcionária | REQ-10450 aberto (os chamados da Ana não aparecem a ela) |
| `diego.ramos@nexo.com`   | Funcionário | Sem chamados                                             |
| `rafael.lima@nexo.com`   | Analista N2 | Console                                                  |
| `bruno.tavares@nexo.com` | Analista N1 | Console                                                  |

Roteiro curto: entre como Ana e pergunte "qual o status do meu chamado do notebook?". Peça um
analista. Em outra janela anônima, entre como Rafael, assuma a conversa e responda.

### Testes e qualidade

```bash
npm run check             # tipos, lint, formato e testes com cobertura (precisa do Postgres)
npm test                  # só os testes, sem o Postgres real
npm run test:integracao   # contratos e corridas no PostgreSQL real
```

## Arquitetura

Um processo Node só ([ADR-0001](docs/adr/0001-servico-de-chamados-in-process.md)), com módulos
separados por fronteiras que o lint verifica
([ADR-0015](docs/adr/0015-fronteiras-verificadas-pelo-lint.md)):

```
web/ (React + Vite) ──HTTP + SSE──▶ src/http (Hono) ──▶ src/agent ──▶ AgentStep ──▶ src/agent/mastra (Mastra + Anthropic)
                                         │                 │
                                         │                 ├──▶ TicketClient ──▶ src/tickets (serviço de chamados simulado)
                                         │                 └──▶ central de ajuda (src/ajuda)
                                         ├──▶ src/console (ações do analista)
                                         ├──▶ src/tempo-real (avisos + acompanhamento)
                                         └──▶ Conversas ──▶ src/conversas (PostgreSQL)
src/domain: chamado, conversa, rascunho, prazos (sem dependências)
src/composicao: lê o ambiente, migra, semeia e liga tudo
```

| Módulo           | O que faz                                                                     |
| ---------------- | ----------------------------------------------------------------------------- |
| `src/domain`     | Regras puras: prioridade e prazo, transições de chamado, conversa e rascunho  |
| `src/tickets`    | Serviço de chamados "legado", atrás da interface `TicketClient`, com retry    |
| `src/conversas`  | Conversas, histórico, rascunhos e sessões, com o estado no banco              |
| `src/agent`      | Guardas, loop de tools, propostas, confirmação pelo clique e transferência    |
| `src/console`    | Assumir, responder, devolver e encerrar                                       |
| `src/tempo-real` | Aviso depois de gravar e acompanhamento sem perda na reconexão                |
| `src/acesso`     | Senhas com scrypt, diretório de pessoas e sessão assinada                     |
| `src/http`       | Rotas, papéis, limite de turnos, SSE e o contrato de tipos que a interface lê |
| `web/`           | Login, chat do funcionário e console do analista                              |

**Persistência:** conversas, mensagens, rascunhos, chamados e o estado de cada conversa ficam no
PostgreSQL e sobrevivem a um reinício.
**Tempo real:** o banco é a fonte da verdade, e o evento só avisa. O navegador reconecta com
`Last-Event-ID` e recebe exatamente o que perdeu
([ADR-0002](docs/adr/0002-tempo-real-com-sse.md)).

## Como o agent decide

1. **Guardas antes do modelo** ([ADR-0016](docs/adr/0016-guardas-do-turno.md)): o agent fica em
   silêncio se a conversa está na fila ou com um analista; a 31ª mensagem da sessão recebe uma
   resposta fixa; os chamados vencidos entram como aviso do sistema.
2. **Loop de tools no código** ([ADR-0017](docs/adr/0017-loop-de-tools-no-codigo.md)): o modelo
   decide um passo por vez, até 5 chamadas por turno: `consultar_chamados`, `obter_chamado`,
   `buscar_artigos`, `propor_chamado`, `propor_complemento`, e termina com `responder` ou
   `transferir_para_analista`.
3. **O código valida cada proposta** ([ADR-0019](docs/adr/0019-acoes-do-agent.md)): campos
   completos, prioridade `critica` só para equipe ou empresa, prazo calculado pelo código e
   duplicidade conferida contra os chamados do próprio funcionário.
4. **Só o clique confirma.** A proposta vira um card; o chamado é criado ou atualizado só quando o
   funcionário clica em Confirmar. Um "pode criar" digitado não cria nada.
5. **Privacidade pelo dono:** toda consulta usa o usuário da sessão, nunca um id vindo do modelo
   ou do corpo do pedido.
6. **Modelo fora do ar:** o turno termina com uma resposta fixa que oferece um analista; a
   pergunta fica gravada.

### Visibilidade das decisões

Acima de cada resposta, a interface mostra as ações do turno ("consultou seus chamados", "buscou
na central de ajuda"). Em **Como o agent decidiu**, aparecem o que o modelo entendeu, a confiança,
o porquê, o resumo da transferência e o trace completo: cada guarda, cada tool com o resultado e
o que o código recusou. O analista vê o mesmo painel no console.

## Qualidade

- TypeScript estrito, com tipos que impedem estados inválidos: rascunho que só vira chamado depois
  de confirmado, transição de conversa que amarra o evento aos estados
  ([ADR-0008](docs/adr/0008-garantias-no-sistema-de-tipos.md)).
- TDD: testes de comportamento (Dado/Quando/Então), testes de tipo e contratos rodados contra a
  versão em memória, o PGlite e o PostgreSQL real, com corridas simuladas.
- Portões no pre-commit e no CI: tipos, lint sem warnings, formato, cobertura ≥ 95% e commitlint
  ([ADR-0007](docs/adr/0007-esteira-de-qualidade.md)).
- Código sem comentários; o porquê está nas ADRs ([docs/adr](docs/adr/README.md)).

## Escolha do LLM

`claude-haiku-5-5` com esforço `medium`, trocável por `LLM_MODEL` sem mudar código
([ADR-0006](docs/adr/0006-modelo-de-llm.md)). As tarefas são guiadas por tools, e as regras que
não podem falhar estão no código, então o modelo mais barato é o ponto de partida (estimativa de
~$0,01 por conversa de 10 turnos). `claude-sonnet-5-5` é o upgrade, se a eval mostrar erros de
prioridade, duplicidade ou transferência.

## Deploy (Railway)

O repositório tem `Dockerfile` e `railway.json` (healthcheck em `/api/saude`).

1. Crie um projeto no Railway com o serviço **PostgreSQL** e um serviço a partir deste repositório.
2. No serviço da aplicação, defina as variáveis: `DATABASE_URL` (referência ao Postgres do
   projeto), `ANTHROPIC_API_KEY`, `LLM_MODEL`, `LLM_EFFORT` e `SESSION_SECRET`. O Railway define a
   `PORT`.
3. O deploy aplica as migrations na subida, protegidas por uma trava no banco. Se o banco não
   responder, o log diz o endereço tentado (sem usuário nem senha) e encerra.

**Deploy contínuo:** todo push na `main` passa pelo CI e, só se ele passar, o job `deploy` envia o
código ao Railway (`railway up`) e espera `/api/saude` responder com o SHA do commit. Se a versão
nova não entrar no ar em 10 minutos, o job falha. Configuração no GitHub (Settings → Secrets and
variables → Actions):

| Tipo     | Nome              | Valor                                                      |
| -------- | ----------------- | ---------------------------------------------------------- |
| Secret   | `RAILWAY_TOKEN`   | Token do projeto (Railway → Project Settings → Tokens)     |
| Variable | `RAILWAY_SERVICE` | Nome do serviço da aplicação no Railway                    |
| Variable | `URL_DE_PRODUCAO` | URL pública, sem barra no fim (`https://….up.railway.app`) |

Desligue o deploy automático pelo GitHub no serviço do Railway (Settings → Source), para cada push
não gerar dois deploys.

**Proteção da chave e do custo:**

- a chave fica só no servidor; a interface nunca a vê, e o erro de configuração lista só os
  nomes das variáveis, nunca os valores;
- só quem entra com uma conta do diretório usa o chat;
- cada pessoa tem um turno por vez e no máximo 40 turnos por hora, além do limite de 30
  mensagens por sessão;
- cada chamada ao modelo tem teto de 4096 tokens de saída e o turno, no máximo 5 chamadas;
- defina também um limite de gasto mensal no console da Anthropic.

## Trade-offs e limitações

- **Uma instância só:** os avisos de tempo real são em memória
  ([ADR-0002](docs/adr/0002-tempo-real-com-sse.md)). Para escalar, troca-se por `LISTEN/NOTIFY`
  sem mudar a interface `Avisos`.
- **Diretório de exemplo no código:** não há cadastro nem troca de senha; um SSO entraria no lugar
  de `criarDiretorio`.
- **Limite de turnos em memória:** zera num reinício; aceitável para uma instância.
- **Sessão por cookie assinado:** não há revogação antes de expirar (8 horas), mas quem sai do
  diretório perde o acesso na hora.
- **Sem eval automatizada ainda:** os testes usam um modelo roteirizado; a qualidade das decisões
  do LLM real precisa de uma eval à parte.

## Decisões

O índice das ADRs está em [docs/adr/README.md](docs/adr/README.md).
