import { describe, expect, it } from "vitest";
import type { MensagemDaApi, RegistroDaApi, ResumoDaApi } from "./tipos.js";
import {
  acoesDoTurno,
  daSessaoAtual,
  rascunhoJaResolvido,
  situacaoNoConsole,
  textoDoEvento,
} from "./rotulos.js";

const em = "2026-10-29T13:00:00.000Z";

function registro(trace: RegistroDaApi["trace"]): RegistroDaApi {
  return {
    declaracao: null,
    confianca: "alta",
    transferencia: null,
    anexos: { chamados: [], rascunho: null, opcoes: [] },
    trace,
  };
}

const sistema = (id: number, evento: Extract<MensagemDaApi, { autor: "sistema" }>["evento"]) =>
  ({ id, autor: "sistema", evento, enviadaEm: em }) as const;

describe("Ações do agent acima de cada resposta", () => {
  it("cada tool executada vira uma ação curta, na ordem e sem repetir; as guardas não aparecem", () => {
    expect(
      acoesDoTurno(
        registro([
          { etapa: "guarda", nome: "controle", resultado: "passou", detalhe: "" },
          { etapa: "tool", nome: "consultar_chamados", resultado: "executou", detalhe: "" },
          { etapa: "tool", nome: "buscar_artigos", resultado: "executou", detalhe: "" },
          { etapa: "tool", nome: "consultar_chamados", resultado: "executou", detalhe: "" },
          { etapa: "tool", nome: "propor_chamado", resultado: "recusou", detalhe: "" },
          { etapa: "resposta", resultado: "transferiu", detalhe: "" },
        ]),
      ),
    ).toEqual([
      "consultou seus chamados",
      "buscou na central de ajuda",
      "conferiu um rascunho que o código recusou",
      "chamou um analista",
    ]);
  });
});

describe("Eventos do sistema no chat", () => {
  it.each([
    [
      { tipo: "transferida", motivo: "chamado_vencido" },
      "Transferida para um analista · chamado vencido",
    ],
    [{ tipo: "assumida", analista: "rafael@nexo.com" }, "Rafael Lima assumiu · agent pausado"],
    [{ tipo: "devolvida" }, "Devolvida ao Nexo Assist"],
    [{ tipo: "encerrada" }, "Atendimento encerrado"],
    [{ tipo: "chamado_criado", chamado: "INC-30001" }, "Chamado INC-30001 criado"],
    [{ tipo: "chamado_complementado", chamado: "INC-20311" }, "Chamado INC-20311 atualizado"],
    [{ tipo: "rascunho_descartado" }, "Rascunho descartado"],
    [{ tipo: "sessao_iniciada" }, "Nova sessão"],
  ] as const)("%o vira %s", (evento, texto) => {
    expect(textoDoEvento(evento, { "rafael@nexo.com": "Rafael Lima" })).toBe(texto);
  });
});

describe("Sessão e rascunhos na tela", () => {
  it("sem nova sessão, a tela mostra tudo; um analista sem nome conhecido aparece pelo e-mail", () => {
    const mensagens: MensagemDaApi[] = [
      { id: 1, autor: "funcionario", texto: "oi", enviadaEm: em },
    ];

    expect(daSessaoAtual(mensagens)).toEqual(mensagens);
    expect(textoDoEvento({ tipo: "assumida", analista: "novo@nexo.com" }, {})).toBe(
      "novo@nexo.com assumiu · agent pausado",
    );
  });

  it("a tela mostra só o que veio desde a última nova sessão", () => {
    const mensagens: MensagemDaApi[] = [
      { id: 1, autor: "funcionario", texto: "antiga", enviadaEm: em },
      sistema(2, { tipo: "sessao_iniciada" }),
      { id: 3, autor: "funcionario", texto: "nova", enviadaEm: em },
    ];

    expect(daSessaoAtual(mensagens).map(({ id }) => id)).toEqual([2, 3]);
  });

  it("um rascunho está resolvido quando um evento de confirmação ou descarte veio depois dele", () => {
    const comRascunho: MensagemDaApi = {
      id: 1,
      autor: "agent",
      texto: "Confira",
      enviadaEm: em,
      registro: registro([]),
    };

    expect(rascunhoJaResolvido([comRascunho], 1)).toBe(false);
    expect(rascunhoJaResolvido([comRascunho, sistema(2, { tipo: "rascunho_descartado" })], 1)).toBe(
      true,
    );
    expect(rascunhoJaResolvido([sistema(1, { tipo: "rascunho_descartado" }), comRascunho], 1)).toBe(
      false,
    );
  });
});

describe("Situação de cada conversa no console", () => {
  const resumo = (conversa: ResumoDaApi["conversa"], ultima: ResumoDaApi["ultima"] = null) =>
    ({
      pessoa: { id: "ana@nexo.com", nome: "Ana", area: "Financeiro", papel: "funcionario" },
      conversa,
      ultima,
      mensagensNaSessao: 1,
    }) as const;
  const transferencia = { motivo: "pedido_do_funcionario", resumo: "x", pedidaEm: em } as const;

  it.each([
    [
      resumo({ dono: "ana@nexo.com", controle: "aguardando", transferencia }),
      { rotulo: "Transferida · pedido do funcionário", tom: "alerta", grupo: "fila" },
    ],
    [
      resumo({
        dono: "ana@nexo.com",
        controle: "analista",
        transferencia,
        analista: "eu@nexo.com",
        assumidaEm: em,
      }),
      { rotulo: "Você está atendendo", tom: "info", grupo: "minhas" },
    ],
    [
      resumo({
        dono: "ana@nexo.com",
        controle: "analista",
        transferencia,
        analista: "outro@nexo.com",
        assumidaEm: em,
      }),
      { rotulo: "Com outro@nexo.com", tom: "neutro", grupo: "outras" },
    ],
    [
      resumo(
        { dono: "ana@nexo.com", controle: "agent" },
        {
          id: 1,
          autor: "agent",
          texto: "?",
          enviadaEm: em,
          registro: { ...registro([]), confianca: "baixa" },
        },
      ),
      { rotulo: "Agent sem segurança · confiança baixa", tom: "alerta", grupo: "agent" },
    ],
    [
      resumo({ dono: "ana@nexo.com", controle: "agent" }),
      { rotulo: "Agent atendendo", tom: "sucesso", grupo: "agent" },
    ],
  ] as const)("%#", (dado, esperado) => {
    expect(situacaoNoConsole(dado, "eu@nexo.com")).toEqual(esperado);
  });
});
