import { readFile } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { criarDiretorio } from "../acesso/diretorio.js";
import { INSTRUCOES } from "../agent/instrucoes.js";
import { mastraComAnthropic } from "../agent/mastra/anthropic.js";
import { conversasPostgres } from "../conversas/postgres/cliente.js";
import { HORA } from "../domain/tempo.js";
import { criarApp } from "../http/app.js";
import { ehFalhaDeInfraestrutura } from "../infraestrutura/falhas-do-postgres.js";
import { migrarComTrava } from "../infraestrutura/migracao.js";
import { avisosEmProcesso } from "../tempo-real/avisos.js";
import { conversasQueAvisam } from "../tempo-real/conversas-que-avisam.js";
import { ticketClientPostgres } from "../tickets/postgres/cliente.js";
import { semearChamados } from "../tickets/postgres/semente.js";
import { ticketClientResiliente } from "../tickets/resiliente.js";
import { enderecoDoBanco, lerAmbiente } from "./ambiente.js";
import { chamadosDeExemplo, PESSOAS_DE_EXEMPLO } from "./exemplo.js";

const PASTA_DAS_MIGRACOES = "drizzle";
const PASTA_DA_INTERFACE = "web/dist";
const ARQUIVO_DA_VERSAO = "VERSAO";
const TURNOS_POR_HORA = 40;

const ambiente = lerAmbiente(process.env);
if (!ambiente.ok) {
  console.error(`Variáveis de ambiente inválidas: ${ambiente.erro.variaveis.join(", ")}`);
  process.exit(1);
}
const { banco, porta, modelo, sessao } = ambiente.valor;

const pool = new pg.Pool({ connectionString: banco });
await migrarComTrava(pool, PASTA_DAS_MIGRACOES).catch((erro: unknown) => {
  if (!ehFalhaDeInfraestrutura(erro)) throw erro;
  console.error(
    `Não foi possível conectar ao banco em ${enderecoDoBanco(banco)}. Confira a DATABASE_URL.`,
  );
  process.exit(1);
});
const db = drizzle(pool);
const semeados = await semearChamados(db, chamadosDeExemplo(new Date()));
if (semeados > 0) console.info(`${String(semeados)} chamados de exemplo gravados`);

const avisos = avisosEmProcesso();
const app = criarApp({
  diretorio: criarDiretorio(PESSOAS_DE_EXEMPLO),
  segredo: sessao.segredo,
  conversas: conversasQueAvisam(conversasPostgres(db), avisos),
  avisos,
  chamados: ticketClientResiliente(ticketClientPostgres(db)),
  modelo: mastraComAnthropic(modelo, INSTRUCOES),
  agora: () => new Date(),
  cookieSeguro: sessao.cookieSeguro,
  limiteDeTurnos: { maximo: TURNOS_POR_HORA, janela: HORA },
  versao: await lerVersao(),
});
app.use("/*", serveStatic({ root: PASTA_DA_INTERFACE }));
app.get("*", serveStatic({ path: `${PASTA_DA_INTERFACE}/index.html` }));

const servidor = serve({ fetch: app.fetch, port: porta }, ({ port }) => {
  console.info(`Nexo Assist ouvindo na porta ${String(port)}`);
});

async function lerVersao(): Promise<string> {
  const conteudo = await readFile(ARQUIVO_DA_VERSAO, "utf8").catch(() => "");
  return conteudo.trim() === "" ? "local" : conteudo.trim();
}

process.on("SIGTERM", () => {
  servidor.close(() => {
    void pool.end();
  });
});
