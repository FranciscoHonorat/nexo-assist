import { describe, expect, it } from "vitest";
import type { AgentStepRoteirizado } from "../agent/roteirizado.js";
import { DESDE_O_COMECO } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { NOVO_NOTEBOOK_LENTO, rascunhoPendente } from "../testes/rascunhos.js";
import { assumidaPor, colocarNaFila } from "../testes/conversas.js";
import { appDeTeste, lerEventos } from "../testes/http.js";
import { ana, bruno, joao } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";

const declaracao = { entendeu: "cumprimento", confianca: "alta", porque: "só disse oi" } as const;
const responde = (mensagem: string) => ({ tipo: "responder", declaracao, mensagem }) as const;

describe("HTTP: o chat do funcionário", () => {
  it("Dado a Ana na sessão, Quando ela manda uma mensagem, Então o turno é gravado na conversa dela, nunca na de quem o corpo disser", async () => {
    const { pedir, entrar, conversas } = await appDeTeste({ roteiro: [responde("Bom dia!")] });
    const cookie = await entrar("ana@nexo.com");

    const resposta = await pedir("POST", "/api/mensagens", {
      cookie,
      corpo: { texto: "bom dia", usuario: "joao@nexo.com" },
    });

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ tipo: "resposta" });
    expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toMatchObject([
      { autor: "funcionario", texto: "bom dia" },
      { autor: "agent", texto: "Bom dia!" },
    ]);
    expect(valorDe(await conversas.historico(joao, DESDE_O_COMECO))).toEqual([]);
  });

  it.each([
    ["vazio", { texto: "   " }],
    ["longo demais", { texto: "a".repeat(2001) }],
    ["sem texto", {}],
  ])("Dado um texto %s, Então a resposta é 400 e o modelo não é chamado", async (_, corpo) => {
    const { pedir, entrar, modelo } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");

    expect((await pedir("POST", "/api/mensagens", { cookie, corpo })).status).toBe(400);
    expect(modelo.contextosRecebidos).toEqual([]);
  });

  it("Dado um turno da Ana em andamento, Quando ela manda outra mensagem, Então a segunda recebe 429", async () => {
    let liberar: (() => void) | undefined;
    const lento: AgentStepRoteirizado = {
      contextosRecebidos: [],
      iniciarTurno: () => ({
        decidir: () =>
          new Promise((resolver) => {
            liberar = () => {
              resolver(responde("pronto"));
            };
          }),
      }),
    };
    const { pedir, entrar } = await appDeTeste({ modelo: lento });
    const cookie = await entrar("ana@nexo.com");

    const primeira = pedir("POST", "/api/mensagens", { cookie, corpo: { texto: "um" } });
    await new Promise((resolver) => setTimeout(resolver, 10));
    const segunda = await pedir("POST", "/api/mensagens", { cookie, corpo: { texto: "dois" } });
    liberar?.();

    expect(segunda.status).toBe(429);
    expect(await segunda.json()).toEqual({ erro: "turno_em_andamento" });
    expect((await primeira).status).toBe(200);
  });

  it("Dado o máximo de turnos na janela, Então o próximo recebe 429 e o modelo não é chamado", async () => {
    const { pedir, entrar, modelo } = await appDeTeste({
      roteiro: [responde("um")],
      maximoDeTurnos: 1,
    });
    const cookie = await entrar("ana@nexo.com");
    await pedir("POST", "/api/mensagens", { cookie, corpo: { texto: "um" } });

    const excedida = await pedir("POST", "/api/mensagens", { cookie, corpo: { texto: "dois" } });

    expect(excedida.status).toBe(429);
    expect(await excedida.json()).toEqual({ erro: "limite_excedido" });
    expect(modelo.contextosRecebidos).toHaveLength(1);
  });

  it("Dado um rascunho da Ana, Quando ela confirma, Então o chamado é criado; o segundo clique recebe 409 e o João não o encontra", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, relogio.agora);
    valorDe(await conversas.atual(ana));
    valorDe(await conversas.guardarRascunho(rascunho));
    const doJoao = await entrar("joao@nexo.com");
    const caminho = `/api/rascunhos/${rascunho.id}/confirmar`;

    expect((await pedir("POST", caminho, { cookie: doJoao })).status).toBe(404);
    const confirmada = await pedir("POST", caminho, { cookie });
    expect(confirmada.status).toBe(200);
    expect(await confirmada.json()).toMatchObject({ chamado: { dono: ana, status: "aberto" } });
    expect((await pedir("POST", caminho, { cookie })).status).toBe(409);
  });

  it("Dado um rascunho da Ana, Quando ela descarta, Então ele não pode mais ser confirmado", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, relogio.agora);
    valorDe(await conversas.atual(ana));
    valorDe(await conversas.guardarRascunho(rascunho));

    expect(
      (await pedir("POST", `/api/rascunhos/${rascunho.id}/descartar`, { cookie })).status,
    ).toBe(204);
    expect(
      (await pedir("POST", `/api/rascunhos/${rascunho.id}/confirmar`, { cookie })).status,
    ).toBe(409);
    expect((await pedir("POST", "/api/rascunhos/qualquer/confirmar", { cookie })).status).toBe(404);
  });

  it("Dado a conversa com o agent, Quando a Ana pede nova sessão, Então ela começa; na fila, a resposta é 409", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    valorDe(await conversas.atual(ana));

    expect((await pedir("POST", "/api/sessao", { cookie })).status).toBe(204);
    await colocarNaFila(conversas, ana, relogio.agora);
    expect((await pedir("POST", "/api/sessao", { cookie })).status).toBe(409);
  });
});

describe("HTTP: a conversa em tempo real (SSE)", () => {
  it("Dado mensagens gravadas, Quando a Ana conecta, Então recebe o estado e as mensagens, com o id da última", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    valorDe(await conversas.atual(ana));
    valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora: relogio.agora }));

    const [estado, mensagens] = await lerEventos(
      await pedir("GET", "/api/conversa/eventos", { cookie }),
      2,
    );

    expect(estado).toEqual({
      evento: "estado",
      dados: { controle: "agent", mensagensNaSessao: 1, limite: 30 },
    });
    expect(mensagens).toMatchObject({
      evento: "mensagens",
      id: "1",
      dados: { mensagens: [{ id: 1, autor: "funcionario", texto: "oi" }] },
    });
  });

  it("Dado uma reconexão com Last-Event-ID, Então chegam só as mensagens depois dele", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    valorDe(await conversas.atual(ana));
    for (const texto of ["vista", "perdida"]) {
      valorDe(await conversas.registrarMensagem(ana, { texto, agora: relogio.agora }));
    }

    const [, mensagens] = await lerEventos(
      await pedir("GET", "/api/conversa/eventos", { cookie, cabecalhos: { "last-event-id": "1" } }),
      2,
    );

    expect(mensagens).toMatchObject({ dados: { mensagens: [{ texto: "perdida" }] } });
  });

  it("Dado a Ana conectada, Quando o João escreve, Então nada do João chega a ela", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    valorDe(await conversas.atual(ana));
    valorDe(await conversas.atual(joao));
    const conectada = pedir("GET", "/api/conversa/eventos", { cookie });

    const eventos = lerEventos(await conectada, 2);
    valorDe(
      await conversas.registrarMensagem(joao, { texto: "minha senha", agora: relogio.agora }),
    );
    valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora: relogio.agora }));

    expect((await eventos)[1]).toMatchObject({ dados: { mensagens: [{ texto: "oi" }] } });
  });

  it("Dado a conversa com o Bruno, Quando ele escreve, Então a mensagem chega à Ana com o nome dele", async () => {
    const { pedir, entrar, conversas, relogio } = await appDeTeste();
    const cookie = await entrar("ana@nexo.com");
    const comBruno = await assumidaPor(conversas, ana, bruno, relogio.agora);
    valorDe(
      await conversas.registrarMensagemDoAnalista(comBruno, { texto: "Oi!", agora: relogio.agora }),
    );

    const [, mensagens] = await lerEventos(
      await pedir("GET", "/api/conversa/eventos", { cookie }),
      2,
    );

    expect(mensagens).toMatchObject({ dados: { nomes: { [bruno]: "Bruno Tavares" } } });
  });

  it("Dado o banco fora do ar durante o acompanhamento, Então chega um evento de erro e a conexão fecha, para o navegador reconectar", async () => {
    const base = conversasEmMemoria();
    const { pedir, entrar } = await appDeTeste({
      baseDasConversas: { ...base, historico: () => Promise.resolve(falha(INDISPONIVEL)) },
    });
    const cookie = await entrar("ana@nexo.com");

    const eventos = await lerEventos(await pedir("GET", "/api/conversa/eventos", { cookie }), 3);

    expect(eventos).toEqual([
      { evento: "estado", dados: { controle: "agent", mensagensNaSessao: 0, limite: 30 } },
      { evento: "erro", dados: { erro: "indisponivel" } },
    ]);
  });
});
