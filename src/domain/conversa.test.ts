import { describe, expect, it } from "vitest";
import {
  agentPodeResponder,
  assumir,
  finalizar,
  novaConversa,
  transferir,
  type Conversa,
  type Controle,
} from "./conversa.js";
import { valorDe } from "../testes/valor-de.js";
import { lerUserId } from "./user-id.js";

const ana = valorDe(lerUserId("ana@nexo.com"));
const bruno = valorDe(lerUserId("bruno.n1@nexo.com"));
const carla = valorDe(lerUserId("carla.n2@nexo.com"));
const t0 = new Date("2026-10-28T10:00:00Z");
const t1 = new Date("2026-10-28T10:05:00Z");
const t2 = new Date("2026-10-28T10:30:00Z");

const transferencia = {
  motivo: "chamado_vencido",
  resumo: "INC-20311 vencido há 2 dias; notebook segue lento.",
  pedidaEm: t0,
} as const;

const comAgent = () => novaConversa({ dono: ana });
const aguardando = () =>
  valorDe(
    transferir(comAgent(), {
      motivo: transferencia.motivo,
      resumo: transferencia.resumo,
      agora: t0,
    }),
  );
const comBruno = () => assumir(aguardando(), { analista: bruno, agora: t1 });

describe("Conversa: transições de controle", () => {
  it("nasce com o agent", () => {
    expect(comAgent()).toEqual({ dono: ana, controle: "agent" });
  });

  it("transferir leva motivo, resumo e horário para a fila", () => {
    expect(aguardando()).toEqual({ dono: ana, controle: "aguardando", transferencia });
  });

  it("o resumo é aparado", () => {
    const conversa = transferir(comAgent(), {
      motivo: "pedido_do_funcionario",
      resumo: "  quer falar com alguém  ",
      agora: t0,
    });

    expect(valorDe(conversa)).toMatchObject({ transferencia: { resumo: "quer falar com alguém" } });
  });

  it.each(["", "   "])("não transfere sem resumo do caso: %j", (resumo) => {
    expect(transferir(comAgent(), { motivo: "caso_critico", resumo, agora: t0 })).toEqual({
      ok: false,
      erro: { motivo: "resumo_vazio" },
    });
  });

  it("um analista assume a conversa da fila", () => {
    expect(comBruno()).toEqual({
      dono: ana,
      controle: "analista",
      transferencia,
      analista: bruno,
      assumidaEm: t1,
    });
  });

  it.each(["devolvida", "encerrada"] as const)(
    "o analista que assumiu finaliza (%s): a conversa volta ao agent e o atendimento fica registrado",
    (desfecho) => {
      expect(finalizar(comBruno(), { desfecho, por: bruno, agora: t2 })).toEqual({
        ok: true,
        valor: {
          conversa: { dono: ana, controle: "agent" },
          atendimento: {
            dono: ana,
            transferencia,
            analista: bruno,
            assumidaEm: t1,
            desfecho,
            finalizadoEm: t2,
          },
        },
      });
    },
  );

  it("outro analista não finaliza o atendimento de um colega", () => {
    expect(finalizar(comBruno(), { desfecho: "encerrada", por: carla, agora: t2 })).toEqual({
      ok: false,
      erro: { motivo: "nao_e_o_analista", tentouPor: carla },
    });
  });

  it("os objetos são imutáveis em runtime", () => {
    const finalizado = valorDe(
      finalizar(comBruno(), { desfecho: "encerrada", por: bruno, agora: t2 }),
    );

    expect(Object.isFrozen(comAgent())).toBe(true);
    expect(Object.isFrozen(aguardando())).toBe(true);
    expect(Object.isFrozen(comBruno())).toBe(true);
    expect(Object.isFrozen(finalizado.conversa)).toBe(true);
    expect(Object.isFrozen(finalizado.atendimento)).toBe(true);
  });
});

describe("agentPodeResponder", () => {
  it.each<[Controle, () => Conversa<Controle>, boolean]>([
    ["agent", comAgent, true],
    ["aguardando", aguardando, false],
    ["analista", comBruno, false],
  ])("com a conversa em %s: %s", (_, conversa, esperado) => {
    expect(agentPodeResponder(conversa())).toBe(esperado);
  });
});
