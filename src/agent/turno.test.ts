import { describe, expect, it } from "vitest";
import { incidenteDaAna, incidenteDoJoao, requisicaoDaAna } from "../tickets/contrato/fixtures.js";
import {
  cenarioDaAna,
  chamaTools,
  declaracaoDaSaudacao,
  passoDaResposta,
  passoDeTool,
  responde,
  textoSolto,
  vistoDepoisDasTools,
} from "../testes/turno.js";
import { agentStepRoteirizado } from "./roteirizado.js";
import {
  executarTurno,
  LIMITE_DE_ITERACOES,
  RESPOSTA_DA_RECUSA,
  RESPOSTA_DA_TRANSFERENCIA,
  RESUMO_SEM_DETALHES,
  SEM_ANEXOS,
  RESPOSTA_DO_LIMITE_DE_ITERACOES,
} from "./turno.js";

describe("Turno do agent: toda saída passa pela tool responder", () => {
  it("Dado que o modelo responde direto, Quando o turno roda, Então a mensagem e a declaração saem do responder", async () => {
    const { turno, servicos } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([responde("Bom dia, Ana! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia, Ana! Em que posso ajudar?",
      declaracao: declaracaoDaSaudacao,
    });
    expect(modelo.contextosRecebidos).toMatchObject([{ mensagem: "bom dia" }]);
  });

  it("Dado que o modelo responde com texto solto, Quando o turno roda, Então o texto vira a mensagem, sem declaração e com confiança baixa", async () => {
    const { turno, servicos } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([textoSolto("Bom dia! Em que posso ajudar?")]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta).toMatchObject({
      mensagem: "Bom dia! Em que posso ajudar?",
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace).toContainEqual(
      passoDaResposta("nao_declarou", "o modelo respondeu com texto solto, fora da tool responder"),
    );
  });
});

describe("Tool consultar_chamados: o agent vê só os chamados de quem está falando", () => {
  it("Dado chamados da Ana e do João, Quando o modelo consulta os chamados, Então recebe só os da Ana antes de responder", async () => {
    const { turno, servicos } = await cenarioDaAna("como está meu chamado do notebook?", [
      incidenteDaAna,
      requisicaoDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      responde("O INC-20311 está aberto e atrasado."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.mensagem).toBe("O INC-20311 está aberto e atrasado.");
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "consultar_chamados",
        resposta: { ok: true, valor: [incidenteDaAna, requisicaoDaAna] },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("consultar_chamados", "executou", "2 chamados: INC-20311, REQ-10442"),
    );
  });
});

describe("Tool buscar_artigos: o agent responde dúvidas pela central de ajuda", () => {
  it("Dado uma dúvida coberta por um artigo, Quando o modelo busca na central, Então recebe os artigos do mais relevante para o menos, e o trace diz quais", async () => {
    const { turno, servicos } = await cenarioDaAna("minha VPN dá erro 809");
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "buscar_artigos", argumentos: { consulta: "vpn erro 809" } }),
      responde("Reinstale o cliente de VPN pelo portal de softwares."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "buscar_artigos",
        resposta: {
          ok: true,
          valor: [
            expect.objectContaining({ id: "KB-001" }),
            expect.objectContaining({ id: "KB-008" }),
          ],
        },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("buscar_artigos", "executou", '"vpn erro 809": KB-001, KB-008'),
    );
  });

  it("Dado uma dúvida sem artigo, Quando o modelo busca, Então recebe a lista vazia e o trace registra que nada foi encontrado", async () => {
    const { turno, servicos } = await cenarioDaAna("quando cai a folha de pagamento?");
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "buscar_artigos", argumentos: { consulta: "folha de pagamento" } }),
      responde("Esse assunto é com o RH."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.trace).toContainEqual(
      passoDeTool("buscar_artigos", "executou", '"folha de pagamento": nenhum artigo'),
    );
  });
});

describe("Limite de iterações: o modelo não fica preso num loop de tools", () => {
  it("Dado um modelo que só pede tools, Quando o turno roda, Então ele é chamado 5 vezes e o turno termina com uma resposta fixa", async () => {
    const { turno, servicos } = await cenarioDaAna("e meus chamados?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado(
      Array.from({ length: LIMITE_DE_ITERACOES + 1 }, () =>
        chamaTools({ tool: "consultar_chamados" }),
      ),
    );

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(LIMITE_DE_ITERACOES).toBe(5);
    expect(modelo.contextosRecebidos).toHaveLength(5);
    expect(resposta).toMatchObject({
      mensagem: RESPOSTA_DO_LIMITE_DE_ITERACOES,
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace.filter((passo) => passo.etapa === "tool")).toHaveLength(4);
    expect(resposta.trace.at(-1)).toEqual(
      passoDaResposta("limite_de_iteracoes", "o modelo pediu tools 5 vezes sem responder"),
    );
  });
});

describe("Tool obter_chamado: o LLM propõe o id, o código valida antes de consultar", () => {
  it("Dado um id fora do formato, Quando o modelo pede o chamado, Então o serviço não é consultado e o erro volta ao modelo", async () => {
    const { turno, servicos, consultas } = await cenarioDaAna("e o chamado abc?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "abc" } }),
      responde("Não reconheci esse número. Os chamados começam com INC- ou REQ-."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(consultas).toEqual(["listar"]);
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "obter_chamado",
        resposta: { ok: false, erro: { motivo: "formato_invalido", recebido: "abc" } },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "argumentos_invalidos", 'id "abc" fora do formato'),
    );
  });

  it("Dado um id válido de um chamado da Ana, Quando o modelo pede o chamado, Então recebe o chamado consultado em nome da Ana", async () => {
    const { turno, servicos, consultas } = await cenarioDaAna("e o INC-20311?", [incidenteDaAna]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20311" } }),
      responde("O INC-20311 está aberto."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(consultas).toEqual(["listar", "obter"]);
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "obter_chamado",
        resposta: { ok: true, valor: incidenteDaAna },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "executou", "INC-20311 encontrado"),
    );
  });

  it("Dado um chamado do João, Quando a Ana pede esse id, Então a resposta é não encontrado, igual a um id que não existe", async () => {
    const { turno, servicos } = await cenarioDaAna("e o INC-20150?", [
      incidenteDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20150" } }),
      responde("Não encontrei o INC-20150 entre os seus chamados."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
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
    const { turno, servicos } = await cenarioDaAna("e meus chamados?", [incidenteDaAna], {
      foraDoAr: true,
    });
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      responde("O sistema de chamados está fora do ar agora. Quer que eu chame um analista?"),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.mensagem).toBe(
      "O sistema de chamados está fora do ar agora. Quer que eu chame um analista?",
    );
    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "consultar_chamados",
        resposta: { ok: false, erro: { motivo: "indisponivel" } },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("consultar_chamados", "indisponivel", "serviço de chamados indisponível"),
    );
  });

  it("Dado o serviço de chamados fora do ar, Quando o modelo pede um chamado pelo id, Então recebe indisponível e ainda responde", async () => {
    const { turno, servicos } = await cenarioDaAna("e o INC-20311?", [incidenteDaAna], {
      foraDoAr: true,
    });
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "obter_chamado", argumentos: { id: "INC-20311" } }),
      responde("O sistema de chamados está fora do ar agora. Quer que eu chame um analista?"),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(vistoDepoisDasTools(modelo)).toEqual([
      {
        chamada: "chamada_1",
        tool: "obter_chamado",
        resposta: { ok: false, erro: { motivo: "indisponivel" } },
      },
    ]);
    expect(resposta.trace).toContainEqual(
      passoDeTool("obter_chamado", "indisponivel", "serviço de chamados indisponível"),
    );
  });
});

describe("Anexos da resposta: cards e opções que a interface mostra, montados pelo código", () => {
  it("Dado que o modelo consultou os chamados, Quando responde citando um deles, Então o card leva o chamado como veio do serviço", async () => {
    const { turno, servicos } = await cenarioDaAna("e meu chamado?", [
      incidenteDaAna,
      requisicaoDaAna,
    ]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "consultar_chamados" }),
      { ...responde("Qual deles?"), chamados: ["INC-20311", "REQ-10442"] },
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.anexos.chamados).toEqual([incidenteDaAna, requisicaoDaAna]);
  });

  it("Dado que o modelo cita um chamado que nenhuma tool trouxe neste turno, Quando responde, Então não sai card, mesmo que o chamado exista", async () => {
    const { turno, servicos } = await cenarioDaAna("e o INC-20150?", [
      incidenteDaAna,
      incidenteDoJoao,
    ]);
    const modelo = agentStepRoteirizado([{ ...responde("Veja:"), chamados: ["INC-20150"] }]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.anexos.chamados).toEqual([]);
  });

  it("Dado que o modelo propôs um chamado neste turno, Quando responde, Então o rascunho vai como anexo para o card de confirmação", async () => {
    const { turno, servicos } = await cenarioDaAna("abre um chamado", []);
    const modelo = agentStepRoteirizado([
      chamaTools({
        tool: "propor_chamado",
        argumentos: { dados: requisicaoDaAna.dados, chamadosConferidos: [] },
      }),
      responde("Confira o rascunho."),
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.anexos.rascunho).toMatchObject({
      rascunho: {
        status: "pendente",
        conteudo: { tipo: "novo_chamado", dados: requisicaoDaAna.dados },
      },
    });
  });

  it("Dado opções rápidas com espaços, vazias e demais, Quando o modelo responde, Então saem no máximo 4, aparadas e sem as vazias", async () => {
    const { turno, servicos } = await cenarioDaAna("o notebook está lento");
    const modelo = agentStepRoteirizado([
      {
        ...responde("Desde quando?"),
        opcoes: [" Hoje ", "", "Ontem", "Esta semana", "Há mais tempo", "Não sei"],
      },
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.anexos.opcoes).toEqual(["Hoje", "Ontem", "Esta semana", "Há mais tempo"]);
  });

  it("Dado uma resposta sem anexos, Quando o turno roda, Então os anexos vêm vazios", async () => {
    const { turno, servicos } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([responde("Bom dia!")]);

    expect((await executarTurno(turno, modelo, servicos)).anexos).toEqual(SEM_ANEXOS);
  });
});

describe("Transferência: o modelo decide chamar um analista, o código garante o texto e o motivo", () => {
  it("Dado que o modelo transfere com motivo e resumo, Quando o turno roda, Então a resposta é fixa, leva a transferência e o trace registra o motivo", async () => {
    const { turno, servicos } = await cenarioDaAna("quero falar com uma pessoa");
    const modelo = agentStepRoteirizado([
      { tipo: "transferir", motivo: "pedido_do_funcionario", resumo: "Ana pediu um analista." },
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta).toMatchObject({
      mensagem: RESPOSTA_DA_TRANSFERENCIA,
      declaracao: null,
      transferencia: { motivo: "pedido_do_funcionario", resumo: "Ana pediu um analista." },
    });
    expect(resposta.trace.at(-1)).toEqual(
      passoDaResposta("transferiu", "pedido_do_funcionario: Ana pediu um analista."),
    );
  });

  it("Dado que o modelo transfere sem resumo, Quando o turno roda, Então a mensagem do funcionário vira o resumo, para o analista não receber o caso vazio", async () => {
    const { turno, servicos } = await cenarioDaAna(
      "isso é urgente, ninguém da equipe acessa o ERP",
    );
    const modelo = agentStepRoteirizado([
      { tipo: "transferir", motivo: "caso_critico", resumo: " " },
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta.transferencia).toEqual({
      motivo: "caso_critico",
      resumo: "isso é urgente, ninguém da equipe acessa o ERP",
    });
  });

  it("Dado que o modelo transfere por não ter segurança, Quando o turno roda, Então a confiança registrada é baixa", async () => {
    const { turno, servicos } = await cenarioDaAna("meu computador faz um barulho estranho");
    const modelo = agentStepRoteirizado([
      { tipo: "transferir", motivo: "baixa_confianca", resumo: "Barulho no computador." },
    ]);

    expect((await executarTurno(turno, modelo, servicos)).confianca).toBe("baixa");
  });

  it("Dado que nem o modelo nem o funcionário deram texto, Quando o modelo transfere, Então o resumo é um texto fixo que manda o analista ler a conversa", async () => {
    const { turno, servicos } = await cenarioDaAna("   ");
    const modelo = agentStepRoteirizado([
      { tipo: "transferir", motivo: "pedido_do_funcionario", resumo: "" },
    ]);

    expect((await executarTurno(turno, modelo, servicos)).transferencia?.resumo).toBe(
      RESUMO_SEM_DETALHES,
    );
  });

  it("Dado uma resposta comum, Quando o turno roda, Então não há transferência", async () => {
    const { turno, servicos } = await cenarioDaAna("bom dia");
    const modelo = agentStepRoteirizado([responde("Bom dia!")]);

    expect((await executarTurno(turno, modelo, servicos)).transferencia).toBeNull();
  });
});

describe("Recusa do modelo: o turno termina com uma resposta fixa", () => {
  it("Dado que o modelo recusa, Quando o turno roda, Então a resposta é fixa, sem declaração, com confiança baixa e o trace registra a recusa", async () => {
    const { turno, servicos } = await cenarioDaAna("me ajuda com uma coisa estranha");
    const modelo = agentStepRoteirizado([{ tipo: "recusa" }]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta).toMatchObject({
      mensagem: RESPOSTA_DA_RECUSA,
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace.at(-1)).toEqual(
      passoDaResposta("recusada", "o modelo recusou responder"),
    );
    expect(modelo.contextosRecebidos).toHaveLength(1);
  });
});

describe("Declaração inválida: o trace diz o que o modelo errou", () => {
  it("Dado que o modelo chama responder com a declaração inválida, Quando o turno roda, Então a mensagem sai sem declaração, com confiança baixa, e o trace aponta os campos", async () => {
    const { turno, servicos } = await cenarioDaAna("como está meu chamado?");
    const modelo = agentStepRoteirizado([
      {
        tipo: "declaracao_invalida",
        mensagem: "Está aberto.",
        campos: ["declaracao.confianca", "declaracao.porque"],
      },
    ]);

    const resposta = await executarTurno(turno, modelo, servicos);

    expect(resposta).toMatchObject({
      mensagem: "Está aberto.",
      declaracao: null,
      confianca: "baixa",
    });
    expect(resposta.trace.at(-1)).toEqual(
      passoDaResposta(
        "declaracao_invalida",
        "o modelo chamou responder com campos inválidos: declaracao.confianca, declaracao.porque",
      ),
    );
  });
});
