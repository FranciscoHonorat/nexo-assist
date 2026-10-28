import { describe, expect, it } from "vitest";
import type { DadosDoChamado } from "./chamado.js";
import { lerRascunhoId } from "./rascunho-id.js";
import { confirmar, criarRascunho, descartar } from "./rascunho.js";
import { valorDe } from "../testes/valor-de.js";
import { lerUserId } from "./user-id.js";

const id = valorDe(lerRascunhoId("rsc_0f8fad5b-d9cb-469f-a165-70867728950e"));
const ana = valorDe(lerUserId("ana@nexo.com"));
const joao = valorDe(lerUserId("joao@nexo.com"));
const t0 = new Date("2026-10-28T10:00:00Z");
const t1 = new Date("2026-10-28T10:05:00Z");

const dados = {
  titulo: "Notebook lento após atualização do Windows",
  descricao: "Demora 10 minutos para ligar desde a última atualização.",
  tipo: "incidente",
  categoria: "hardware",
  prioridade: "media",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

const pendenteDaAna = () => valorDe(criarRascunho({ id, dono: ana, dados, agora: t0 }));

describe("Rascunho: comportamento em runtime", () => {
  it("nasce pendente, com dono, dados do chamado e horário de criação", () => {
    expect(pendenteDaAna()).toEqual({ id, dono: ana, dados, status: "pendente", criadoEm: t0 });
  });

  it("título e descrição são aparados", () => {
    const rascunho = criarRascunho({
      id,
      dono: ana,
      dados: { ...dados, titulo: `  ${dados.titulo} `, descricao: ` ${dados.descricao}  ` },
      agora: t0,
    });

    expect(valorDe(rascunho).dados).toEqual(dados);
  });

  it.each([
    ["titulo", ""],
    ["titulo", "   "],
    ["descricao", ""],
    ["descricao", "   "],
  ] as const)("não cria rascunho com %s vazio (%j)", (campo, valor) => {
    expect(
      criarRascunho({ id, dono: ana, dados: { ...dados, [campo]: valor }, agora: t0 }),
    ).toEqual({ ok: false, erro: { motivo: "campo_vazio", campo } });
  });

  it("o dono confirma, e os dados confirmados são os mesmos que ele viu", () => {
    expect(confirmar(pendenteDaAna(), { por: ana, agora: t1 })).toEqual({
      ok: true,
      valor: { id, dono: ana, dados, status: "confirmado", criadoEm: t0, confirmadoEm: t1 },
    });
  });

  it("o dono descarta, e o horário do descarte fica registrado", () => {
    expect(descartar(pendenteDaAna(), { por: ana, agora: t1 })).toEqual({
      ok: true,
      valor: { id, dono: ana, dados, status: "descartado", criadoEm: t0, descartadoEm: t1 },
    });
  });

  it.each([
    ["confirmar", confirmar],
    ["descartar", descartar],
  ] as const)("outra pessoa não pode %s o rascunho", (_, transicao) => {
    expect(transicao(pendenteDaAna(), { por: joao, agora: t1 })).toEqual({
      ok: false,
      erro: { motivo: "nao_e_o_dono", rascunhoId: id, tentouPor: joao },
    });
  });

  it("transições devolvem um novo objeto e não alteram o original", () => {
    const pendente = pendenteDaAna();
    const confirmado = confirmar(pendente, { por: ana, agora: t1 });

    expect(valorDe(confirmado)).not.toBe(pendente);
    expect(pendente.status).toBe("pendente");
  });

  it("os objetos são imutáveis em runtime, inclusive os dados confirmados", () => {
    const pendente = pendenteDaAna();
    const confirmado = valorDe(confirmar(pendente, { por: ana, agora: t1 }));

    expect(Object.isFrozen(pendente)).toBe(true);
    expect(Object.isFrozen(pendente.dados)).toBe(true);
    expect(Object.isFrozen(confirmado)).toBe(true);
    expect(Object.isFrozen(confirmado.dados)).toBe(true);
    expect(Object.isFrozen(valorDe(descartar(pendente, { por: ana, agora: t1 })))).toBe(true);
  });
});
