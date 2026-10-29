import { describe, expect, it } from "vitest";
import { DESDE_O_COMECO } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { falha } from "../domain/resultado.js";
import { lerUserId } from "../domain/user-id.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { colocarNaFila } from "../testes/conversas.js";
import { appDeTeste, lerEventos } from "../testes/http.js";
import { ana, bruno, joao } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { incidenteDaAna, incidenteDoJoao } from "../tickets/contrato/fixtures.js";

const CONVERSA_DA_ANA = "/api/console/conversas/ana@nexo.com";

async function comAnaNaFila() {
  const teste = await appDeTeste({ chamados: [incidenteDaAna, incidenteDoJoao] });
  valorDe(await teste.conversas.atual(ana));
  valorDe(
    await teste.conversas.registrarMensagem(ana, {
      texto: "quero um analista",
      agora: teste.relogio.agora,
    }),
  );
  await colocarNaFila(teste.conversas, ana, teste.relogio.agora);
  valorDe(await teste.conversas.atual(joao));
  return { ...teste, cookie: await teste.entrar("bruno.n1@nexo.com") };
}

describe("HTTP: o console do analista", () => {
  it("Dado conversas da Ana e do João, Então o analista vê a lista com o nome, a área, o estado e a última mensagem", async () => {
    const { pedir, cookie } = await comAnaNaFila();

    const lista = await pedir("GET", "/api/console/conversas", { cookie });

    expect(lista.status).toBe(200);
    expect(await lista.json()).toMatchObject({
      conversas: [
        {
          pessoa: { id: ana, nome: "Ana Souza", area: "Financeiro" },
          conversa: { controle: "aguardando", transferencia: { motivo: "pedido_do_funcionario" } },
          ultima: { autor: "sistema", evento: { tipo: "transferida" } },
          mensagensNaSessao: 1,
        },
        { pessoa: { id: joao, nome: "João Lima" }, conversa: { controle: "agent" }, ultima: null },
      ],
    });
  });

  it("Dado a conversa da Ana, Então o analista vê o histórico e só os chamados dela", async () => {
    const { pedir, cookie } = await comAnaNaFila();

    const detalhe = await (await pedir("GET", CONVERSA_DA_ANA, { cookie })).json();

    expect(detalhe).toMatchObject({
      pessoa: { nome: "Ana Souza" },
      conversa: { controle: "aguardando" },
      mensagens: [{ texto: "quero um analista" }, { evento: { tipo: "transferida" } }],
      chamados: [{ id: incidenteDaAna.id }],
    });
  });

  it("Dado a conversa da Ana na fila, Quando o Bruno assume, responde e encerra, Então tudo entra no histórico com o nome dele", async () => {
    const { pedir, cookie, conversas } = await comAnaNaFila();

    expect((await pedir("POST", `${CONVERSA_DA_ANA}/assumir`, { cookie })).status).toBe(204);
    expect(
      (
        await pedir("POST", `${CONVERSA_DA_ANA}/mensagens`, {
          cookie,
          corpo: { texto: "Oi, Ana!" },
        })
      ).status,
    ).toBe(204);
    expect((await pedir("POST", `${CONVERSA_DA_ANA}/encerrar`, { cookie })).status).toBe(204);

    expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO)).slice(-3)).toMatchObject([
      { evento: { tipo: "assumida", analista: bruno } },
      { autor: "analista", analista: bruno, texto: "Oi, Ana!" },
      { evento: { tipo: "encerrada" } },
    ]);
  });

  it("Dado a conversa assumida pelo Bruno, Quando a Carla tenta assumir, responder ou encerrar, Então recebe 409", async () => {
    const { pedir, cookie, entrar } = await comAnaNaFila();
    await pedir("POST", `${CONVERSA_DA_ANA}/assumir`, { cookie });
    const daCarla = await entrar("carla.n1@nexo.com");

    for (const [acao, corpo] of [
      ["assumir", undefined],
      ["mensagens", { texto: "oi" }],
      ["encerrar", undefined],
      ["devolver", undefined],
    ] as const) {
      const resposta = await pedir("POST", `${CONVERSA_DA_ANA}/${acao}`, {
        cookie: daCarla,
        ...(corpo === undefined ? {} : { corpo }),
      });
      expect(resposta.status).toBe(409);
    }
  });

  it("Dado a conversa na fila, Quando um analista devolve, Então o agent volta", async () => {
    const { pedir, cookie, conversas } = await comAnaNaFila();

    expect((await pedir("POST", `${CONVERSA_DA_ANA}/devolver`, { cookie })).status).toBe(204);
    expect(valorDe(await conversas.atual(ana)).conversa.controle).toBe("agent");
  });

  it("Dado um e-mail inválido ou uma resposta vazia, Então a resposta é 400", async () => {
    const { pedir, cookie } = await comAnaNaFila();
    await pedir("POST", `${CONVERSA_DA_ANA}/assumir`, { cookie });

    expect((await pedir("GET", "/api/console/conversas/ana@gmail.com", { cookie })).status).toBe(
      400,
    );
    expect(
      (await pedir("POST", `${CONVERSA_DA_ANA}/mensagens`, { cookie, corpo: { texto: " " } }))
        .status,
    ).toBe(400);
  });

  it("Dado o console conectado, Quando uma conversa muda, Então chega o aviso de qual conversa mudou, sem o conteúdo", async () => {
    const { pedir, cookie, conversas, relogio } = await comAnaNaFila();
    const conectado = await pedir("GET", "/api/console/eventos", { cookie });

    const eventos = lerEventos(conectado, 1);
    valorDe(await conversas.registrarMensagem(joao, { texto: "segredo", agora: relogio.agora }));

    expect(await eventos).toEqual([{ evento: "conversa", dados: { dono: joao } }]);
  });

  it("Dado o banco de conversas fora do ar, Então a lista e o detalhe respondem 503", async () => {
    const base = conversasEmMemoria();
    const { pedir, entrar } = await appDeTeste({
      baseDasConversas: {
        ...base,
        listar: () => Promise.resolve(falha(INDISPONIVEL)),
        historico: () => Promise.resolve(falha(INDISPONIVEL)),
      },
    });
    const cookie = await entrar("bruno.n1@nexo.com");

    expect((await pedir("GET", "/api/console/conversas", { cookie })).status).toBe(503);
    expect((await pedir("GET", CONVERSA_DA_ANA, { cookie })).status).toBe(503);
  });

  it("Dado uma ação para um e-mail inválido, Então a resposta é 400 e nada é tentado", async () => {
    const { pedir, cookie } = await comAnaNaFila();

    expect(
      (await pedir("POST", "/api/console/conversas/ana@gmail.com/assumir", { cookie })).status,
    ).toBe(400);
  });

  it("Dado a conversa de alguém que saiu do diretório, Então o console mostra o e-mail no lugar do nome", async () => {
    const { pedir, cookie, conversas } = await comAnaNaFila();
    valorDe(await conversas.atual(valorDe(lerUserId("ex.funcionario@nexo.com"))));

    const lista = (await (await pedir("GET", "/api/console/conversas", { cookie })).json()) as {
      conversas: { pessoa: { id: string; nome: string } }[];
    };

    expect(lista.conversas.map(({ pessoa }) => pessoa)).toContainEqual(
      expect.objectContaining({ id: "ex.funcionario@nexo.com", nome: "ex.funcionario@nexo.com" }),
    );
  });
});
