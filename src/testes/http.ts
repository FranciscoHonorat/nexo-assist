import { criarDiretorio, type PessoaCadastrada } from "../acesso/diretorio.js";
import { protegerSenha } from "../acesso/senha.js";
import type { Decisao } from "../agent/agent-step.js";
import { agentStepRoteirizado, type AgentStepRoteirizado } from "../agent/roteirizado.js";
import type { Conversas } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import type { Chamado } from "../domain/chamado.js";
import { HORA } from "../domain/tempo.js";
import { criarApp } from "../http/app.js";
import { avisosEmProcesso } from "../tempo-real/avisos.js";
import { conversasQueAvisam } from "../tempo-real/conversas-que-avisam.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";

export const SENHA = "senha-de-teste";
export const VERSAO_DE_TESTE = "3f2a9c1";
export const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";

let cadastro: Promise<PessoaCadastrada[]> | undefined;

async function cadastrar(): Promise<PessoaCadastrada[]> {
  const senha = await protegerSenha(SENHA);
  return [
    { email: "ana@nexo.com", nome: "Ana Souza", area: "Financeiro", papel: "funcionario", senha },
    { email: "joao@nexo.com", nome: "João Lima", area: "Comercial", papel: "funcionario", senha },
    {
      email: "bruno.n1@nexo.com",
      nome: "Bruno Tavares",
      area: "Suporte N1",
      papel: "analista",
      senha,
    },
    {
      email: "carla.n1@nexo.com",
      nome: "Carla Nunes",
      area: "Suporte N1",
      papel: "analista",
      senha,
    },
  ];
}

type Opcoes = {
  readonly roteiro?: readonly Decisao[];
  readonly modelo?: AgentStepRoteirizado;
  readonly chamados?: readonly Chamado[];
  readonly maximoDeTurnos?: number;
  readonly baseDasConversas?: Conversas;
};

export async function appDeTeste({
  roteiro = [],
  modelo = agentStepRoteirizado(roteiro),
  chamados = [],
  maximoDeTurnos = 20,
  baseDasConversas = conversasEmMemoria(),
}: Opcoes = {}) {
  const avisos = avisosEmProcesso();
  const conversas = conversasQueAvisam(baseDasConversas, avisos);
  const relogio = { agora: new Date("2026-10-29T13:00:00Z") };
  const app = criarApp({
    diretorio: criarDiretorio(await (cadastro ??= cadastrar())),
    segredo: SEGREDO,
    conversas,
    avisos,
    chamados: ticketClientEmMemoria({ chamados }),
    modelo,
    agora: () => relogio.agora,
    cookieSeguro: false,
    limiteDeTurnos: { maximo: maximoDeTurnos, janela: HORA },
    versao: VERSAO_DE_TESTE,
  });

  const pedir = (
    metodo: string,
    caminho: string,
    {
      cookie,
      corpo,
      cabecalhos = {},
    }: {
      readonly cookie?: string;
      readonly corpo?: unknown;
      readonly cabecalhos?: Record<string, string>;
    } = {},
  ) =>
    app.request(caminho, {
      method: metodo,
      headers: {
        origin: "http://localhost",
        ...(cookie === undefined ? {} : { cookie }),
        ...(corpo === undefined ? {} : { "content-type": "application/json" }),
        ...cabecalhos,
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });

  const entrar = async (email: string) => {
    const resposta = await pedir("POST", "/api/entrar", { corpo: { email, senha: SENHA } });
    const cookie = resposta.headers.get("set-cookie")?.split(";")[0];
    if (cookie === undefined)
      throw new Error(`não entrou como ${email}: ${String(resposta.status)}`);
    return cookie;
  };

  return { app, conversas, avisos, modelo, relogio, pedir, entrar };
}

export async function lerEventos(resposta: Response, quantos: number) {
  const leitor = resposta.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (leitor === undefined) throw new Error("a resposta não tem corpo");
  const eventos: { readonly evento: string; readonly id?: string; readonly dados: unknown }[] = [];
  let pendente = "";
  while (eventos.length < quantos) {
    const { value, done } = await leitor.read();
    if (done) break;
    pendente += value;
    const blocos = pendente.split("\n\n");
    pendente = blocos.pop() ?? "";
    for (const bloco of blocos) {
      const campos = Object.fromEntries(
        bloco.split("\n").map((linha) => {
          const separador = linha.indexOf(":");
          return [linha.slice(0, separador), linha.slice(separador + 1).trim()];
        }),
      );
      if (campos["event"] === "ping") continue;
      eventos.push({
        evento: campos["event"] ?? "message",
        ...(campos["id"] === undefined ? {} : { id: campos["id"] }),
        dados: JSON.parse(campos["data"] ?? "null"),
      });
    }
  }
  await leitor.cancel();
  return eventos;
}
