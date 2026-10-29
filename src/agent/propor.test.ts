import { describe, expect, it } from "vitest";
import type { DadosDoChamado } from "../domain/chamado.js";
import { calcularPrazo } from "../domain/prazo.js";
import { DIA, MINUTO } from "../domain/tempo.js";
import { lerRascunhoId } from "../domain/rascunho-id.js";
import { ana } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import {
  cenarioDaAna,
  chamaTools,
  passoDeTool,
  responde,
  vistoDepoisDasTools,
} from "../testes/turno.js";
import {
  existente,
  incidenteDaAna,
  incidenteDoJoao,
  notebookLento,
  senhaDoSap,
  t1,
} from "../tickets/contrato/fixtures.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { agentStepRoteirizado } from "./roteirizado.js";
import { executarTurno } from "./turno.js";

const agoraDoTurno = new Date(t1.getTime() + MINUTO);

const vpnCaiu = {
  titulo: "VPN cai a cada 10 minutos",
  descricao: "Desde hoje cedo a VPN desconecta sozinha a cada 10 minutos.",
  tipo: "incidente",
  categoria: "rede_e_vpn",
  prioridade: "alta",
  afetados: "so_eu",
} as const satisfies DadosDoChamado;

function propoe(dados: DadosDoChamado, chamadosConferidos: readonly string[] = []) {
  return chamaTools({ tool: "propor_chamado", argumentos: { dados, chamadosConferidos } });
}

async function proporNoTurno(
  dados: DadosDoChamado,
  { chamados = [incidenteDaAna], conferidos = [] as readonly string[], foraDoAr = false } = {},
) {
  const cenario = await cenarioDaAna("abre um chamado pra mim", chamados, { foraDoAr });
  const modelo = agentStepRoteirizado([propoe(dados, conferidos), responde("Confira o rascunho.")]);
  const resposta = await executarTurno(cenario.turno, modelo, cenario.servicos);
  return { ...cenario, modelo, resposta, visto: vistoDepoisDasTools(modelo)?.[0]?.resposta };
}

function idDoRascunho(visto: unknown) {
  const { valor } = visto as { valor: { rascunho: { id: string } } };
  return valorDe(lerRascunhoId(valor.rascunho.id));
}

describe("Tool propor_chamado: o LLM propõe o rascunho, o código valida e guarda", () => {
  it("Dado dados completos e nenhum chamado parecido, Quando o modelo propõe, Então o rascunho fica guardado como pendente e o modelo recebe o prazo calculado pelo código", async () => {
    const { visto, resposta, conversas } = await proporNoTurno(vpnCaiu);

    expect(visto).toMatchObject({
      ok: true,
      valor: {
        rascunho: {
          status: "pendente",
          dono: ana,
          conteudo: { tipo: "novo_chamado", dados: vpnCaiu },
        },
        prazo: calcularPrazo("alta", agoraDoTurno),
      },
    });
    const guardado = await conversas.rascunhoPendente(idDoRascunho(visto), ana);
    expect(guardado).toMatchObject({ ok: true, valor: { conteudo: { dados: vpnCaiu } } });
    expect(resposta.trace).toContainEqual(
      passoDeTool(
        "propor_chamado",
        "executou",
        "rascunho de incidente em rede_e_vpn, prioridade alta, para so_eu",
      ),
    );
  });

  it("Dado um título vazio, Quando o modelo propõe, Então nada é guardado e o modelo recebe o campo que falta", async () => {
    const { visto, resposta } = await proporNoTurno({ ...vpnCaiu, titulo: "   " });

    expect(visto).toEqual({ ok: false, erro: { motivo: "campo_vazio", campo: "titulo" } });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_chamado", "argumentos_invalidos", "campo vazio: titulo"),
    );
  });

  it("Dado argumentos que o modelo mandou fora do schema, Quando o modelo propõe, Então o modelo recebe os campos inválidos", async () => {
    const cenario = await cenarioDaAna("abre um chamado", []);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "propor_chamado", argumentos: { invalidos: ["dados.categoria"] } }),
      responde("Qual a categoria?"),
    ]);

    const resposta = await executarTurno(cenario.turno, modelo, cenario.servicos);

    expect(vistoDepoisDasTools(modelo)?.[0]?.resposta).toEqual({
      ok: false,
      erro: { motivo: "argumentos_invalidos", campos: ["dados.categoria"] },
    });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_chamado", "argumentos_invalidos", "campos inválidos: dados.categoria"),
    );
  });
});

describe("Sem duplicidade: o código obriga o modelo a conferir os chamados parecidos", () => {
  const notebookTravando = { ...notebookLento, titulo: "Notebook travando" } as const;

  it("Dado um chamado aberto da Ana na mesma categoria, Quando o modelo propõe sem conferi-lo, Então a proposta é recusada e o modelo recebe o candidato", async () => {
    const { visto, resposta } = await proporNoTurno(notebookTravando);

    expect(visto).toEqual({
      ok: false,
      erro: { motivo: "possivel_duplicidade", candidatos: [incidenteDaAna] },
    });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_chamado", "recusou", "possível duplicidade com INC-20311"),
    );
  });

  it("Dado o mesmo chamado aberto, Quando o modelo diz que o conferiu, Então o rascunho é guardado", async () => {
    const { visto } = await proporNoTurno(notebookTravando, { conferidos: ["INC-20311"] });

    expect(visto).toMatchObject({ ok: true });
  });

  it("Dado um chamado resolvido há 4 dias na mesma categoria, Quando o modelo propõe sem conferir, Então ele é candidato, porque ainda pode ser reaberto", async () => {
    const resolvidoHa4Dias = existente("INC-20150", ana, senhaDoSap, {
      status: "resolvido",
      atualizadoEm: new Date(t1.getTime() - 4 * DIA),
    });
    const { visto } = await proporNoTurno(
      { ...senhaDoSap, titulo: "Senha do SAP bloqueou de novo" },
      { chamados: [resolvidoHa4Dias] },
    );

    expect(visto).toMatchObject({ ok: false, erro: { motivo: "possivel_duplicidade" } });
  });

  it("Dado um chamado resolvido há 8 dias na mesma categoria, Quando o modelo propõe, Então ele não é candidato, porque já não pode ser reaberto", async () => {
    const resolvidoHa8Dias = existente("INC-20150", ana, senhaDoSap, {
      status: "resolvido",
      atualizadoEm: new Date(t1.getTime() - 8 * DIA),
    });
    const { visto } = await proporNoTurno(senhaDoSap, { chamados: [resolvidoHa8Dias] });

    expect(visto).toMatchObject({ ok: true });
  });

  it("Dado um chamado do João na mesma categoria, Quando a Ana propõe, Então ele não é candidato", async () => {
    const { visto } = await proporNoTurno(notebookTravando, { chamados: [incidenteDoJoao] });

    expect(visto).toMatchObject({ ok: true });
  });

  it("Dado o serviço de chamados fora do ar, Quando o modelo propõe, Então nada é guardado e o modelo recebe indisponível", async () => {
    const { visto, resposta } = await proporNoTurno(vpnCaiu, { foraDoAr: true });

    expect(visto).toEqual({ ok: false, erro: { motivo: "indisponivel" } });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_chamado", "indisponivel", "serviço de chamados indisponível"),
    );
  });
});

describe("Prioridade: a regra do Anexo A é verificada pelo código", () => {
  it("Dado prioridade crítica para uma pessoa só, Quando o modelo propõe, Então a proposta é recusada, porque crítica é algo parado para uma equipe ou a empresa", async () => {
    const { visto, resposta } = await proporNoTurno({ ...vpnCaiu, prioridade: "critica" });

    expect(visto).toEqual({
      ok: false,
      erro: { motivo: "prioridade_incompativel", prioridade: "critica", afetados: "so_eu" },
    });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_chamado", "recusou", "prioridade critica para so_eu"),
    );
  });

  it("Dado prioridade crítica para a equipe, Quando o modelo propõe, Então o rascunho é guardado com prazo de 1 hora", async () => {
    const { visto } = await proporNoTurno({
      ...vpnCaiu,
      prioridade: "critica",
      afetados: "minha_equipe",
    });

    expect(visto).toMatchObject({
      ok: true,
      valor: { prazo: calcularPrazo("critica", agoraDoTurno) },
    });
  });
});

describe("Tool propor_complemento: atualizar em vez de duplicar, também só depois da confirmação", () => {
  async function complementarNoTurno(chamado: string, texto: string, chamados = [incidenteDaAna]) {
    const cenario = await cenarioDaAna("o notebook piorou", chamados);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "propor_complemento", argumentos: { chamado, texto } }),
      responde("Confira o complemento."),
    ]);
    const resposta = await executarTurno(cenario.turno, modelo, cenario.servicos);
    return { ...cenario, resposta, visto: vistoDepoisDasTools(modelo)?.[0]?.resposta };
  }

  it("Dado um chamado aberto da Ana, Quando o modelo propõe um complemento, Então o rascunho fica guardado e o modelo recebe o chamado junto", async () => {
    const { visto, resposta, conversas } = await complementarNoTurno(
      "INC-20311",
      "agora não liga mais",
    );

    expect(visto).toMatchObject({
      ok: true,
      valor: {
        rascunho: {
          status: "pendente",
          conteudo: { tipo: "complemento", chamado: "INC-20311", texto: "agora não liga mais" },
        },
        chamado: incidenteDaAna,
      },
    });
    expect(await conversas.rascunhoPendente(idDoRascunho(visto), ana)).toMatchObject({ ok: true });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_complemento", "executou", "rascunho de complemento para INC-20311"),
    );
  });

  it("Dado um chamado resolvido há 8 dias, Quando o modelo propõe um complemento, Então a proposta é recusada, porque ele já não pode ser reaberto", async () => {
    const resolvidoHa8Dias = existente("INC-20150", ana, senhaDoSap, {
      status: "resolvido",
      atualizadoEm: new Date(t1.getTime() - 8 * DIA),
    });
    const { visto, resposta } = await complementarNoTurno("INC-20150", "bloqueou de novo", [
      resolvidoHa8Dias,
    ]);

    expect(visto).toEqual({
      ok: false,
      erro: { motivo: "resolvido_ha_mais_de_7_dias", id: resolvidoHa8Dias.id },
    });
    expect(resposta.trace).toContainEqual(
      passoDeTool("propor_complemento", "recusou", "INC-20150 resolvido há mais de 7 dias"),
    );
  });

  it("Dado um chamado do João, Quando a Ana propõe complementá-lo, Então a resposta é não encontrado", async () => {
    const { visto } = await complementarNoTurno("INC-20150", "também comigo", [incidenteDoJoao]);

    expect(visto).toEqual({
      ok: false,
      erro: { motivo: "nao_encontrado", id: incidenteDoJoao.id },
    });
  });

  it("Dado argumentos fora do schema, Quando o modelo propõe um complemento, Então o modelo recebe os campos inválidos", async () => {
    const cenario = await cenarioDaAna("o notebook piorou", [incidenteDaAna]);
    const modelo = agentStepRoteirizado([
      chamaTools({ tool: "propor_complemento", argumentos: { invalidos: ["texto"] } }),
      responde("O que mudou?"),
    ]);

    await executarTurno(cenario.turno, modelo, cenario.servicos);

    expect(vistoDepoisDasTools(modelo)?.[0]?.resposta).toEqual({
      ok: false,
      erro: { motivo: "argumentos_invalidos", campos: ["texto"] },
    });
  });

  it.each([
    ["INC-20311", "   ", { motivo: "campo_vazio", campo: "texto" }, "campo vazio: texto"],
    ["abc", "piorou", { motivo: "formato_invalido", recebido: "abc" }, 'id "abc" fora do formato'],
  ])(
    "Dado o chamado %s e o texto %j, Quando o modelo propõe, Então nada é guardado e o modelo recebe o erro",
    async (chamado, texto, erro, detalhe) => {
      const { visto, resposta } = await complementarNoTurno(chamado, texto);

      expect(visto).toEqual({ ok: false, erro });
      expect(resposta.trace).toContainEqual(
        passoDeTool("propor_complemento", "argumentos_invalidos", detalhe),
      );
    },
  );
});

describe("Banco de conversas fora do ar ao guardar o rascunho", () => {
  it.each([
    chamaTools({ tool: "propor_chamado", argumentos: { dados: vpnCaiu, chamadosConferidos: [] } }),
    chamaTools({
      tool: "propor_complemento",
      argumentos: { chamado: "INC-20311", texto: "agora não liga" },
    }),
  ])(
    "Dado que não dá para guardar o rascunho, Quando o modelo propõe, Então ele recebe indisponível em vez de um rascunho que não existe",
    async (proposta) => {
      const cenario = await cenarioDaAna("abre um chamado", [incidenteDaAna]);
      const modelo = agentStepRoteirizado([proposta, responde("Tente de novo.")]);
      const servicos = {
        ...cenario.servicos,
        rascunhos: { guardarRascunho: () => Promise.resolve(falha(INDISPONIVEL)) },
      };

      await executarTurno(cenario.turno, modelo, servicos);

      expect(vistoDepoisDasTools(modelo)?.[0]?.resposta).toEqual({
        ok: false,
        erro: { motivo: "indisponivel" },
      });
    },
  );
});
