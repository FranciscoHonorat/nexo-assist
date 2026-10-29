import { describe, expect, it } from "vitest";
import { DESDE_O_COMECO, type Conversas } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { assumir, novaConversa, transferir } from "../domain/conversa.js";
import { descartar } from "../domain/rascunho.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { NOVO_NOTEBOOK_LENTO, rascunhoPendente } from "../testes/rascunhos.js";
import { ana, bruno } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { avisosEmProcesso, type AvisoDeConversa } from "./avisos.js";
import { conversasQueAvisam } from "./conversas-que-avisam.js";

const agora = new Date("2026-10-28T13:00:00Z");

function comOuvinte(base: Conversas = conversasEmMemoria()) {
  const avisos = avisosEmProcesso();
  const recebidos: AvisoDeConversa[] = [];
  const parar = avisos.ouvir((aviso) => recebidos.push(aviso));
  return { conversas: conversasQueAvisam(base, avisos), avisos, recebidos, parar };
}

const naFila = () =>
  valorDe(
    transferir(novaConversa({ dono: ana }), { motivo: "caso_critico", resumo: "caiu", agora }),
  );

describe("Conversas que avisam: o aviso sai depois que o banco gravou", () => {
  it.each<[string, (conversas: Conversas) => Promise<unknown>]>([
    ["registrarMensagem", (c) => c.registrarMensagem(ana, { texto: "oi", agora })],
    [
      "registrarTurno",
      (c) =>
        c.registrarTurno(ana, {
          pergunta: "oi",
          resposta: { texto: "olá", registro: {} },
          agora,
        }),
    ],
    [
      "transicionar",
      (c) =>
        c.transicionar(
          { evento: "transferida", antes: novaConversa({ dono: ana }), depois: naFila() },
          agora,
        ),
    ],
    ["iniciarSessao", (c) => c.iniciarSessao(ana, agora)],
    [
      "resolverRascunho",
      async (c) => {
        const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, agora);
        valorDe(await c.guardarRascunho(rascunho));
        return c.resolverRascunho({ rascunho: valorDe(descartar(rascunho, { por: ana, agora })) });
      },
    ],
  ])("Dado uma escrita com %s, Então a conversa da Ana é avisada uma vez", async (_, escrever) => {
    const { conversas, recebidos } = comOuvinte();
    valorDe(await conversas.atual(ana));

    await escrever(conversas);

    expect(recebidos).toEqual([{ dono: ana }]);
  });

  it("Dado uma mensagem do analista, Então a conversa da dona é avisada", async () => {
    const base = conversasEmMemoria();
    valorDe(await base.atual(ana));
    const fila = naFila();
    valorDe(
      await base.transicionar(
        { evento: "transferida", antes: novaConversa(fila), depois: fila },
        agora,
      ),
    );
    const comBruno = assumir(fila, { analista: bruno, agora });
    valorDe(await base.transicionar({ evento: "assumida", antes: fila, depois: comBruno }, agora));
    const { conversas, recebidos } = comOuvinte(base);

    valorDe(await conversas.registrarMensagemDoAnalista(comBruno, { texto: "oi", agora }));

    expect(recebidos).toEqual([{ dono: ana }]);
  });

  it("Dado um ouvinte, Quando o aviso chega, Então a mensagem já pode ser lida do banco", async () => {
    const avisos = avisosEmProcesso();
    const conversas = conversasQueAvisam(conversasEmMemoria(), avisos);
    valorDe(await conversas.atual(ana));
    const lidasNoAviso: Promise<number>[] = [];
    avisos.ouvir(({ dono }) => {
      lidasNoAviso.push(
        conversas.historico(dono, DESDE_O_COMECO).then((lidas) => valorDe(lidas).length),
      );
    });

    valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora }));

    expect(await Promise.all(lidasNoAviso)).toEqual([1]);
  });

  it("Dado leituras e um rascunho guardado, Então ninguém é avisado, porque nenhuma mensagem entrou", async () => {
    const { conversas, recebidos } = comOuvinte();
    const rascunho = rascunhoPendente(NOVO_NOTEBOOK_LENTO, agora);

    valorDe(await conversas.atual(ana));
    valorDe(await conversas.historico(ana, DESDE_O_COMECO));
    valorDe(await conversas.guardarRascunho(rascunho));
    valorDe(await conversas.rascunhoPendente(rascunho.id, ana));

    expect(recebidos).toEqual([]);
  });

  it("Dado o banco fora do ar, Então a escrita não avisa ninguém", async () => {
    const base = {
      ...conversasEmMemoria(),
      registrarMensagem: () => Promise.resolve(falha(INDISPONIVEL)),
    };
    const { conversas, recebidos } = comOuvinte(base);

    await conversas.registrarMensagem(ana, { texto: "oi", agora });

    expect(recebidos).toEqual([]);
  });

  it("Dado um ouvinte que parou de ouvir, Então ele não recebe mais avisos", async () => {
    const { conversas, recebidos, parar } = comOuvinte();
    valorDe(await conversas.atual(ana));

    parar();
    valorDe(await conversas.registrarMensagem(ana, { texto: "oi", agora }));

    expect(recebidos).toEqual([]);
  });
});
