# ADR-0023: Interface em React servida pelo Node, deploy no Railway

**Status:** Aceito
**Data:** 2026-10-29
**Decisores:** FranciscoHonorat

## Contexto

O PRD pede a interface do protótipo (login, chat com cards, rascunho e opções rápidas, console do
analista) e, como diferencial, um deploy. A [ADR-0002](0002-tempo-real-com-sse.md) exige um
processo de longa duração.

## Decisão

- **React + Vite em `web/`**, construído para `web/dist` e servido pelo mesmo processo Node que a
  API: uma origem só, sem CORS, com o cookie `SameSite=Lax`.
- **Cores e fontes do protótipo** (Newsreader, Schibsted Grotesk, IBM Plex Mono), com tema escuro
  e layout de uma coluna abaixo de 900px.
- **A lógica de tela é pura e testada** (`web/src/logica`): ações do turno, texto dos eventos,
  sessão atual, rascunho resolvido e a situação de cada conversa no console. Os componentes ficam
  finos e foram verificados no navegador.
- **Tempo real pelo `EventSource`**, que reconecta sozinho com `Last-Event-ID`. As ações (enviar,
  confirmar, assumir) só fazem o pedido; o resultado chega pelo SSE.
- **Deploy:** `Dockerfile` em dois estágios (build e runtime só com dependências de produção,
  usuário `node`) e `railway.json` com healthcheck em `/api/saude`. As migrations rodam na subida,
  com `pg_advisory_lock`, e a semente só grava chamados num banco vazio.

## Opções consideradas

| Opção                      | Processos | CORS e cookies        | Build             |
| -------------------------- | --------- | --------------------- | ----------------- |
| Next.js                    | 1         | Mesma origem          | Framework inteiro |
| SPA em outro host (Vercel) | 2         | CORS e cookie cruzado | Dois deploys      |
| **Vite servido pelo Node** | 1         | Mesma origem          | `vite build`      |

## Análise de trade-offs

Next.js traria roteamento e renderização no servidor que três telas não precisam, e outra forma de
rodar o backend. Hospedar a SPA em separado obrigaria CORS e cookie entre domínios. Servir o
`web/dist` pelo Hono mantém um deploy, uma origem e o SSE no mesmo processo.

Os componentes React não têm testes automatizados: a lógica que decide o que mostrar está em
funções puras testadas, e o fluxo completo foi exercitado num Chromium headless (login, rascunho,
confirmação, consulta com card, transferência, console assumindo e respondendo, e largura de
celular), sem erros no console do navegador.

## Itens de ação

1. [x] Login, chat e console.
2. [x] Dockerfile, `railway.json` e healthcheck.
3. [x] Publicar no Railway com as variáveis do projeto (feito pelo dono da conta).
4. [x] Deploy contínuo: job `deploy` no CI, depois do `check`, só na `main`. Envia com
       `railway up` e confere que `/api/saude` responde com o SHA do commit, porque o Railway mantém
       a versão anterior no ar quando a nova falha no healthcheck, e uma checagem só de "está de pé"
       passaria com a versão velha.
5. [ ] Testes de ponta a ponta automatizados no CI, se a interface crescer.
