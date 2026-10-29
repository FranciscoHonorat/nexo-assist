import { describe, expect, it } from "vitest";
import { novaConversa } from "../domain/conversa.js";
import { MINUTO } from "../domain/tempo.js";
import { valorDe } from "../testes/valor-de.js";
import type { Chamado } from "../domain/chamado.js";
import {
  incidenteDaAna,
  incidenteDoJoao,
  requisicaoDaAna,
  t1,
} from "../tickets/contrato/fixtures.js";
import { ana } from "../testes/usuarios.js";
import { ticketClientEmMemoria, type Operacao } from "../tickets/em-memoria.js";
import { prepararTurno } from "./guardas.js";
import type { ChamadaDeTool, Decisao, Declaracao } from "./agent-step.js";
import { agentStepRoteirizado, type AgentStepRoteirizado } from "./roteirizado.js";
import type { PassoDaTool } from "./tools.js";
import { executarTurno, LIMITE_DE_ITERACOES, RESPOSTA_DO_LIMITE_DE_ITERACOES } from "./turno.js";

async function cenarioDaAna(
  mensagem: string,
  chamados: readonly Chamado[] = [],
  { foraDoAr = false } = {},
) {
  const consultas: Operacao[] = [];
  const cliente = ticketClientEmMemoria(
    { chamados },
    {
      falhar: (operacao) => {
        consultas.push(operacao);
        return foraDoAr ? "antes" : undefined;
      },
    },
  );
  const turno = valorDe(
    await prepararTurno(
      {
        usuario: ana,
        conversa: novaConversa({ dono: ana }),
        mensagem,
        mensagensNaSessao: 0,
        agora: new Date(t1.getTime() + MINUTO),
      },
      cliente,
    ),
  );
  return { turno, chamados: cliente, consultas };
}

const declaracaoDaSaudacao = {
  entendeu: "o funcionário só cumprimentou",
  confianca: "alta",
  porque: "a mensagem não descreve nenhum problema",
} as const;

function responde(mensagem: string, declaracao: Declaracao = declaracaoDaSaudacao): Decisao {
  return { tipo: "responder", declaracao, mensagem };
}

function textoSolto(texto: string): Decisao {
  return { tipo: "texto_solto", texto };
}

function chamaTools(...chamadas: ChamadaDeTool[]): Decisao {
  return { tipo: "tools", chamadas };
}

function vistoDepoisDasTools(modelo: AgentStepRoteirizado) {
  return modelo.contextosRecebidos[1]?.resultadosDeTools;
}

function passoDeTool(
  nome: PassoDaTool["nome"],
  resultado: PassoDaTool["resultado"],
  detalhe: string,
): PassoDaTool {
  return { etapa: "tool", nome, resultado, detalhe };
}

describe("Turno do agent: toda saída passa pela tool responder", () => {
  it("Dado que o modelo responde direto, Quando o turno roda, Então a mensagem e a declaração saem do responder", async () => {
    const { turno, chamados } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([responde("Bom dia, Ana! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia, Ana! Em que posso ajudar?",
      declaracao: declaracaoDaSaudacao,
    });
    expect(modelo.contextosRecebidos).toMatchObject([{ mensagem: "bom dia" }]);
  });

  it("Dado que o modelo responde com texto solto, Quando o turno roda, Então o texto vira a mensagem, sem declaração e com confiança baixa", async () => {
    const { turno, chamados } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([textoSolto("Bom dia! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia! Em que posso ajudar?",
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace).toContainEqual({
      etapa: "resposta",
      resultado: "nao_declarou",
      detalhe: "o modelo respondeu com texto solto, fora da tool responder",
    });
  });
});

describe("Tool consultar_chamados: o agent vê só os chamados de quem está falando", () => {
  it("Dado chamados da Ana e do João, Quando o modelo consulta os chamados, Então recebe só os da Ana antes de responder", async () => {
    const { turno, chamados } = await cenarioDaAna("como está meu chamado do notebook?", [
      incidenteDaAna,
      requisicaoDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      responde("O INC-20311 está aberto e atrasado."),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta.mensagem).toBe("O INC-20311 está aberto e atrasado.");
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        tool: "consultar_chamados",
        resposta: { ok: true, valor: [incidenteDaAna, requisicaoDaAna] },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("consultar_chamados", "executou", "2 chamados: INC-20311, REQ-10442"),
    );
  });
});

describe("Limite de iterações: o modelo não fica preso num loop de tools", () => {
  it("Dado um modelo que só pede tools, Quando o turno roda, Então ele é chamado 5 vezes e o turno termina com uma resposta fixa", async () => {
    const { turno, chamados } = await cenarioDaAna("e meus chamados?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado(
      Array.from({ length: LIMITE_DE_ITERACOES + 1 }, () =>
        chamaTools({ tool: "consultar_chamados" }),
      ),
    );

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(LIMITE_DE_ITERACOES).toBe(5);
    expect(modelo.contextosRecebidos).toHaveLength(5);
    expect(resposta).toMatchObject({
      mensagem: RESPOSTA_DO_LIMITE_DE_ITERACOES,
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace.filter((passo) => passo.etapa === "tool")).toHaveLength(4);
    expect(resposta.trace.at(-1)).toEqual({
      etapa: "resposta",
      resultado: "limite_de_iteracoes",
      detalhe: "o modelo pediu tools 5 vezes sem responder",
    });
  });
});

describe("Tool obter_chamado: o LLM propõe o id, o código valida antes de consultar", () => {
  it("Dado um id fora do formato, Quando o modelo pede o chamado, Então o serviço não é consultado e o erro volta ao modelo", async () => {
    const { turno, chamados, consultas } = await cenarioDaAna("e o chamado abc?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "abc" } }),
      responde("Não reconheci esse número. Os chamados começam com INC- ou REQ-."),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(consultas).toEqual(["listar"]);
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        tool: "obter_chamado",
        resposta: { ok: false, erro: { motivo: "formato_invalido", recebido: "abc" } },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "argumentos_invalidos", 'id "abc" fora do formato'),
    );
  });

  it("Dado um id válido de um chamado da Ana, Quando o modelo pede o chamado, Então recebe o chamado consultado em nome da Ana", async () => {
    const { turno, chamados, consultas } = await cenarioDaAna("e o INC-20311?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20311" } }),
      responde("O INC-20311 está aberto."),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(consultas).toEqual(["listar", "obter"]);
    expect(vistoDepoisDasTools(modelo)).toEqual([
      { tool: "obter_chamado", resposta: { ok: true, valor: incidenteDaAna } },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "executou", "INC-20311 encontrado"),
    );
  });

  it("Dado um chamado do João, Quando a Ana pede esse id, Então a resposta é não encontrado, igual a um id que não existe", async () => {
    const { turno, chamados } = await cenarioDaAna("e o INC-20150?", [
      incidenteDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20150" } }),
      responde("Não encontrei o INC-20150 entre os seus chamados."),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        tool: "obter_chamado",
        resposta: { ok: false, erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id } },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "executou", "INC-20150 não encontrado"),
    );
  });
});

describe("Legado fora do ar durante uma tool: o turno segue e o modelo fica sabendo", () => {
  it("Dado o serviço de chamados fora do ar, Quando o modelo consulta os chamados, Então recebe indisponível e ainda responde", async () => {
    const { turno, chamados } = await cenarioDaAna("e meus chamados?", [incidenteDaAna], {
      foraDoAr: true,
    });
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      responde("O sistema de chamados está fora do ar agora. Quer que eu chame um analista?"),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(resposta.mensagem).toBe(
      "O sistema de chamados está fora do ar agora. Quer que eu chame um analista?",
    );
    expect(vistoDepoisDasTools(modelo)).toEqual([
      { tool: "consultar_chamados", resposta: { ok: false, erro: { motivo: "indisponivel" } } },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("consultar_chamados", "indisponivel", "serviço de chamados indisponível"),
    );
  });

  it("Dado o serviço de chamados fora do ar, Quando o modelo pede um chamado pelo id, Então recebe indisponível e ainda responde", async () => {
    const { turno, chamados } = await cenarioDaAna("e o INC-20311?", [incidenteDaAna], {
      foraDoAr: true,
    });
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20311" } }),
      responde("O sistema de chamados está fora do ar agora. Quer que eu chame um analista?"),
    ]);

    const resposta = await executarTurno(turno, modelo, chamados);

    expect(vistoDepoisDasTools(modelo)).toEqual([
      { tool: "obter_chamado", resposta: { ok: false, erro: { motivo: "indisponivel" } } },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "indisponivel", "serviço de chamados indisponível"),
    );
  });
});
