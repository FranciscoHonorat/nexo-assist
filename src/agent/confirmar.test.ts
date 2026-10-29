import { describe, expect, it } from "vitest";
import { DESDE_O_COMECO } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import type { Chamado } from "../domain/chamado.js";
import type { Rascunho } from "../domain/rascunho.js";
import { falha, sucesso } from "../domain/resultado.js";
import { DIA, MINUTO } from "../domain/tempo.js";
import {
  COMPLEMENTO_DO_NOTEBOOK,
  NOVO_NOTEBOOK_LENTO,
  rascunhoPendente,
} from "../testes/rascunhos.js";
import { ana, joao } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { existente, incidenteDaAna, notebookLento, t1 } from "../tickets/contrato/fixtures.js";
import { ticketClientEmMemoria } from "../tickets/em-memoria.js";
import { confirmarRascunho, descartarRascunho } from "./confirmar.js";

const propostoEm = t1;
const clicadoEm = new Date(t1.getTime() + 2 * MINUTO);

function cliqueDa(id: string, por = ana) {
  return { id, por, agora: clicadoEm };
}

async function comRascunhoGuardado(
  rascunho: Rascunho<"pendente">,
  { chamados = [incidenteDaAna] as readonly Chamado[], foraDoAr = false } = {},
) {
  const conversas = conversasEmMemoria();
  valorDe(await conversas.atual(ana));
  valorDe(await conversas.guardarRascunho(rascunho));
  const servicos = {
    conversas,
    chamados: ticketClientEmMemoria(
      { chamados },
      { falhar: () => (foraDoAr ? "antes" : undefined) },
    ),
  };
  return { servicos, id: rascunho.id as string, rascunho };
}

describe("Confirmar um rascunho: só o clique da dona cria o chamado", () => {
  it("Dado um rascunho de chamado novo, Quando a Ana confirma, Então o chamado é criado com os dados do rascunho e o rascunho fica confirmado", async () => {
    const { servicos, id, rascunho } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    const confirmado = await confirmarRascunho(cliqueDa(id), servicos);

    expect(confirmado).toMatchObject({
      ok: true,
      valor: { dono: ana, dados: notebookLento, status: "aberto", criadoEm: clicadoEm },
    });
    expect(valorDe(await servicos.chamados.listar(ana))).toHaveLength(2);
    expect(await servicos.conversas.rascunhoPendente(rascunho.id, ana)).toEqual({
      ok: false,
      erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
    });
  });

  it("Dado um rascunho confirmado, Quando o chamado é criado, Então a conversa da Ana registra qual chamado foi criado, para o agent e para a tela", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    const criado = valorDe(await confirmarRascunho(cliqueDa(id), servicos));

    expect(valorDe(await servicos.conversas.historico(ana, DESDE_O_COMECO))).toMatchObject([
      { autor: "sistema", evento: { tipo: "chamado_criado", chamado: criado.id } },
    ]);
  });

  it("Dado um rascunho já confirmado, Quando a Ana clica de novo, Então nenhum chamado novo é criado e ela recebe que já foi confirmado", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );
    valorDe(await confirmarRascunho(cliqueDa(id), servicos));

    expect(await confirmarRascunho(cliqueDa(id), servicos)).toEqual({
      ok: false,
      erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
    });
    expect(valorDe(await servicos.chamados.listar(ana))).toHaveLength(2);
  });

  it("Dado um rascunho da Ana, Quando o João tenta confirmá-lo pelo id, Então não o encontra e nada é criado", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    expect(await confirmarRascunho(cliqueDa(id, joao), servicos)).toEqual({
      ok: false,
      erro: { motivo: "rascunho_nao_encontrado" },
    });
    expect(valorDe(await servicos.chamados.listar(joao))).toEqual([]);
  });

  it("Dado um id fora do formato, Quando alguém tenta confirmar, Então o erro é de formato e nada é consultado", async () => {
    const { servicos } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    expect(await confirmarRascunho(cliqueDa("rsc_123"), servicos)).toEqual({
      ok: false,
      erro: { motivo: "formato_invalido", recebido: "rsc_123" },
    });
  });

  it("Dado um rascunho de complemento, Quando a Ana confirma, Então o texto entra no chamado", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(COMPLEMENTO_DO_NOTEBOOK, propostoEm),
    );

    const confirmado = await confirmarRascunho(cliqueDa(id), servicos);

    expect(confirmado).toMatchObject({
      ok: true,
      valor: {
        id: "INC-20311",
        complementos: [{ texto: COMPLEMENTO_DO_NOTEBOOK.texto, em: clicadoEm }],
      },
    });
  });

  it("Dado um complemento de um chamado que passou dos 7 dias resolvido antes do clique, Quando a Ana confirma, Então a confirmação é recusada e o rascunho continua pendente", async () => {
    const resolvidoHa8Dias = existente("INC-20311", ana, notebookLento, {
      status: "resolvido",
      atualizadoEm: new Date(clicadoEm.getTime() - 8 * DIA),
    });
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(COMPLEMENTO_DO_NOTEBOOK, propostoEm),
      { chamados: [resolvidoHa8Dias] },
    );

    expect(await confirmarRascunho(cliqueDa(id), servicos)).toEqual({
      ok: false,
      erro: { motivo: "resolvido_ha_mais_de_7_dias", id: resolvidoHa8Dias.id },
    });
  });

  it("Dado o serviço de chamados fora do ar, Quando a Ana confirma, Então ela recebe indisponível e o rascunho continua pendente para tentar de novo", async () => {
    const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm);
    const { servicos, id } = await comRascunhoGuardado(rascunho, { foraDoAr: true });

    expect(await confirmarRascunho(cliqueDa(id), servicos)).toEqual({
      ok: false,
      erro: { motivo: "indisponivel" },
    });
    expect(await servicos.conversas.rascunhoPendente(rascunho.id, ana)).toMatchObject({ ok: true });
    expect(valorDe(await servicos.conversas.historico(ana, DESDE_O_COMECO))).toEqual([]);
  });
});

describe("Confirmar com o armazenamento adulterado: o domínio ainda protege", () => {
  it("Dado um armazenamento que devolve à Ana o rascunho do João, Quando a Ana confirma, Então a confirmação é recusada e nada é criado", async () => {
    const doJoao = rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm, joao);
    const { servicos } = await comRascunhoGuardado(doJoao);
    const adulterado = {
      ...servicos,
      conversas: {
        ...servicos.conversas,
        rascunhoPendente: () => Promise.resolve(sucesso(doJoao)),
      },
    };

    expect(await confirmarRascunho(cliqueDa(doJoao.id), adulterado)).toMatchObject({
      ok: false,
      erro: { motivo: "nao_e_o_dono", tentouPor: ana },
    });
    expect(await descartarRascunho(cliqueDa(doJoao.id), adulterado)).toMatchObject({
      ok: false,
      erro: { motivo: "nao_e_o_dono" },
    });
    expect(valorDe(await servicos.chamados.listar(joao))).toEqual([]);
  });
});

describe("Descartar um rascunho", () => {
  it("Dado um rascunho pendente, Quando a Ana descarta, Então nada é criado e o rascunho não pode mais ser confirmado", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    expect(await descartarRascunho(cliqueDa(id), servicos)).toEqual({
      ok: true,
      valor: undefined,
    });
    expect(await confirmarRascunho(cliqueDa(id), servicos)).toEqual({
      ok: false,
      erro: { motivo: "rascunho_ja_resolvido", status: "descartado" },
    });
    expect(valorDe(await servicos.chamados.listar(ana))).toEqual([incidenteDaAna]);
  });

  it("Dado um rascunho da Ana, Quando o João tenta descartá-lo, Então não o encontra e o rascunho continua pendente", async () => {
    const { servicos, id, rascunho } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );

    expect(await descartarRascunho(cliqueDa(id, joao), servicos)).toEqual({
      ok: false,
      erro: { motivo: "rascunho_nao_encontrado" },
    });
    expect(await servicos.conversas.rascunhoPendente(rascunho.id, ana)).toMatchObject({ ok: true });
  });

  it("Dado que um clique de confirmação venceu a corrida, Quando o descarte tenta resolver o rascunho, Então ele recebe que o rascunho já foi confirmado", async () => {
    const { servicos, id } = await comRascunhoGuardado(
      rascunhoPendente(NOVO_NOTEBOOK_LENTO, propostoEm),
    );
    const jaConfirmado = {
      ...servicos.conversas,
      resolverRascunho: () =>
        Promise.resolve(falha({ motivo: "rascunho_ja_resolvido", status: "confirmado" } as const)),
    };

    expect(await descartarRascunho(cliqueDa(id), { conversas: jaConfirmado })).toEqual({
      ok: false,
      erro: { motivo: "rascunho_ja_resolvido", status: "confirmado" },
    });
  });
});
