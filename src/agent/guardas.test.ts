import { describe, expect, it } from "vitest";
import {
  assumir,
  novaConversa,
  transferir,
  type Conversa,
  type Controle,
} from "../domain/conversa.js";
import { MINUTO } from "../domain/tempo.js";
import { lerUserId } from "../domain/user-id.js";
import { valorDe } from "../testes/valor-de.js";
import {
  existente,
  incidenteDaAna,
  requisicaoDaAna,
  senhaDoSap,
  t0,
  t1,
} from "../tickets/contrato/fixtures.js";
import { ana } from "../testes/usuarios.js";
import { ticketClientEmMemoria, type Operacao } from "../tickets/em-memoria.js";
import type { Chamado } from "../domain/chamado.js";
import {
  prepararTurno,
  RESPOSTA_DO_LIMITE,
  type NomeDaGuarda,
  type PassoDaGuarda,
} from "./guardas.js";

const bruno = valorDe(lerUserId("bruno.n1@nexo.com"));

const resolvidoHaSeisDias = existente("INC-20160", ana, senhaDoSap, {
  status: "resolvido",
  atualizadoEm: t0,
});

function servico(chamados: readonly Chamado[], { foraDoAr = false } = {}) {
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
  return { cliente, consultas };
}

const comAgent = novaConversa({ dono: ana });
const naFila = valorDe(
  transferir(comAgent, { motivo: "pedido_do_funcionario", resumo: "quer um humano", agora: t1 }),
);
const comAnalista = assumir(naFila, { analista: bruno, agora: t1 });

function passou(nome: NomeDaGuarda, detalhe: string): PassoDaGuarda {
  return { etapa: "guarda", nome, resultado: "passou", detalhe };
}

type GuardaQue<Resultado extends PassoDaGuarda["resultado"]> = {
  [Nome in NomeDaGuarda]: Resultado extends PassoDaGuarda<Nome>["resultado"] ? Nome : never;
}[NomeDaGuarda];

function interrompeu(nome: GuardaQue<"interrompeu">, detalhe: string): PassoDaGuarda {
  return { etapa: "guarda", nome, resultado: "interrompeu", detalhe };
}

function naoVerificou(nome: GuardaQue<"nao_verificou">, detalhe: string): PassoDaGuarda {
  return { etapa: "guarda", nome, resultado: "nao_verificou", detalhe };
}

function entrada(conversa: Conversa<Controle>, mensagensNaSessao = 3) {
  return {
    usuario: ana,
    conversa,
    mensagem: "meu notebook continua lento",
    mensagensNaSessao,
    agora: new Date(t1.getTime() + MINUTO),
  };
}

describe("Guarda de controle: o agent só fala quando a conversa é dele", () => {
  it("Dado que a conversa está na fila, Quando chega uma mensagem, Então o agent fica em silêncio", async () => {
    const { cliente, consultas } = servico([incidenteDaAna]);

    expect(await prepararTurno(entrada(naFila), cliente)).toEqual({
      ok: false,
      erro: {
        motivo: "conversa_na_fila",
        trace: [interrompeu("controle", "conversa aguardando um analista")],
      },
    });
    expect(consultas).toEqual([]);
  });

  it("Dado que um analista assumiu, Quando chega uma mensagem, Então o agent fica em silêncio", async () => {
    const { cliente, consultas } = servico([incidenteDaAna]);

    expect(await prepararTurno(entrada(comAnalista), cliente)).toEqual({
      ok: false,
      erro: {
        motivo: "conversa_com_analista",
        trace: [interrompeu("controle", "conversa com bruno.n1@nexo.com")],
      },
    });
    expect(consultas).toEqual([]);
  });
});

describe("Guarda de limite: no máximo 30 mensagens por sessão", () => {
  it("Dado 29 mensagens anteriores, Quando chega a 30ª, Então ela passa", async () => {
    const { cliente } = servico([]);

    const turno = valorDe(await prepararTurno(entrada(comAgent, 29), cliente));

    expect(turno.trace).toContainEqual(passou("limite", "30 de 30 mensagens"));
  });

  it("Dado 30 mensagens anteriores, Quando chega a 31ª, Então a resposta é fixa, sem LLM e sem consultar chamados", async () => {
    const { cliente, consultas } = servico([incidenteDaAna]);

    expect(await prepararTurno(entrada(comAgent, 30), cliente)).toEqual({
      ok: false,
      erro: {
        motivo: "limite_da_sessao",
        resposta: RESPOSTA_DO_LIMITE,
        trace: [
          passou("controle", "conversa com o agent"),
          interrompeu("limite", "31 de 30 mensagens"),
        ],
      },
    });
    expect(consultas).toEqual([]);
  });
});

describe("Guarda de vencidos: o agent já sabe o que está atrasado", () => {
  it("Dado chamados abertos e resolvidos, Quando o turno é preparado, Então só os abertos fora do prazo entram no contexto", async () => {
    const { cliente } = servico([incidenteDaAna, requisicaoDaAna, resolvidoHaSeisDias]);

    const turno = valorDe(await prepararTurno(entrada(comAgent), cliente));

    expect(turno.chamadosVencidos.map((chamado) => chamado.id)).toEqual([incidenteDaAna.id]);
    expect(turno.trace).toContainEqual(passou("vencidos", "INC-20311 vencido"));
  });

  it("Dado que nada está atrasado, Então o trace diz isso", async () => {
    const { cliente } = servico([requisicaoDaAna]);

    const turno = valorDe(await prepararTurno(entrada(comAgent), cliente));

    expect(turno.chamadosVencidos).toEqual([]);
    expect(turno.trace).toContainEqual(passou("vencidos", "nenhum chamado vencido"));
  });

  it("Dado que o legado está fora do ar, Então o turno segue e o trace registra que não foi possível verificar", async () => {
    const { cliente } = servico([incidenteDaAna], { foraDoAr: true });

    const turno = valorDe(await prepararTurno(entrada(comAgent), cliente));

    expect(turno.chamadosVencidos).toEqual([]);
    expect(turno.trace).toContainEqual(
      naoVerificou("vencidos", "serviço de chamados indisponível"),
    );
  });
});

describe("Turno pronto", () => {
  it("passa pelas três guardas, na ordem, e carrega a conversa e a mensagem", async () => {
    const { cliente, consultas } = servico([requisicaoDaAna]);

    const turno = valorDe(await prepararTurno(entrada(comAgent, 3), cliente));

    expect(turno.trace.map((passo) => passo.nome)).toEqual(["controle", "limite", "vencidos"]);
    expect(turno).toMatchObject({
      usuario: ana,
      conversa: comAgent,
      mensagem: "meu notebook continua lento",
    });
    expect(consultas).toEqual(["listar"]);
  });
});
