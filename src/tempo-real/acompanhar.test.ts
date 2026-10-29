import { describe, expect, it } from "vitest";
import { DESDE_O_COMECO, type Conversas, type Mensagem } from "../conversas/conversas.js";
import { conversasEmMemoria } from "../conversas/em-memoria.js";
import { falha } from "../domain/resultado.js";
import { INDISPONIVEL } from "../infraestrutura/indisponivel.js";
import { ana, joao } from "../testes/usuarios.js";
import { valorDe } from "../testes/valor-de.js";
import { acompanharAvisos, acompanharConversa } from "./acompanhar.js";
import { avisosEmProcesso, type Avisos } from "./avisos.js";
import { conversasQueAvisam } from "./conversas-que-avisam.js";

const agora = new Date("2026-10-28T13:00:00Z");

function cenario(base: Conversas = conversasEmMemoria()) {
  const avisos = avisosEmProcesso();
  return { avisos, conversas: conversasQueAvisam(base, avisos) };
}

async function escrever(conversas: Conversas, ...textos: string[]) {
  for (const texto of textos) valorDe(await conversas.registrarMensagem(ana, { texto, agora }));
}

function textos(mensagens: readonly Mensagem[]) {
  return mensagens.flatMap((mensagem) => ("texto" in mensagem ? [mensagem.texto] : []));
}

async function proxima(acompanhando: ReturnType<typeof acompanharConversa>) {
  const { done, value } = await acompanhando.next();
  if (done === true) throw new Error("o acompanhamento terminou antes da próxima entrega");
  return value;
}

describe("Acompanhar a conversa: o banco é a fonte, o aviso só acorda", () => {
  it("Dado mensagens gravadas antes de conectar, Quando a Ana conecta do começo, Então recebe todas de uma vez", async () => {
    const { conversas, avisos } = cenario();
    valorDe(await conversas.atual(ana));
    await escrever(conversas, "um", "dois");
    const controle = new AbortController();

    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas, avisos },
      controle.signal,
    );

    expect(textos(valorDe(await proxima(acompanhando)))).toEqual(["um", "dois"]);
    controle.abort();
  });

  it("Dado uma reconexão com o último id visto, Então chegam só as mensagens perdidas, sem repetir", async () => {
    const { conversas, avisos } = cenario();
    valorDe(await conversas.atual(ana));
    await escrever(conversas, "vista");
    const [vista] = valorDe(await conversas.historico(ana, DESDE_O_COMECO));
    await escrever(conversas, "perdida 1", "perdida 2");
    const controle = new AbortController();

    const acompanhando = acompanharConversa(
      ana,
      vista?.id ?? DESDE_O_COMECO,
      { conversas, avisos },
      controle.signal,
    );

    expect(textos(valorDe(await proxima(acompanhando)))).toEqual(["perdida 1", "perdida 2"]);
    controle.abort();
  });

  it("Dado a Ana conectada, Quando uma mensagem nova é gravada, Então ela chega pelo acompanhamento", async () => {
    const { conversas, avisos } = cenario();
    valorDe(await conversas.atual(ana));
    await escrever(conversas, "antiga");
    const controle = new AbortController();
    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas, avisos },
      controle.signal,
    );
    await proxima(acompanhando);

    const chegando = proxima(acompanhando);
    await escrever(conversas, "nova");

    expect(textos(valorDe(await chegando))).toEqual(["nova"]);
    controle.abort();
  });

  it("Dado uma mensagem gravada enquanto a primeira leitura ainda acontece, Então ela não se perde", async () => {
    const base = conversasEmMemoria();
    const avisos = avisosEmProcesso();
    const conversas = conversasQueAvisam(base, avisos);
    valorDe(await conversas.atual(ana));
    let leituras = 0;
    const comEscritaNoMeio: Conversas = {
      ...conversas,
      historico: async (dono, depois) => {
        const lidas = await conversas.historico(dono, depois);
        leituras += 1;
        if (leituras === 1) await escrever(conversas, "durante a leitura");
        return lidas;
      },
    };
    const controle = new AbortController();

    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas: comEscritaNoMeio, avisos },
      controle.signal,
    );

    expect(textos(valorDe(await proxima(acompanhando)))).toEqual(["durante a leitura"]);
    controle.abort();
  });

  it("Dado mensagens do João, Então o acompanhamento da Ana não as entrega", async () => {
    const { conversas, avisos } = cenario();
    valorDe(await conversas.atual(ana));
    valorDe(await conversas.atual(joao));
    const controle = new AbortController();
    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas, avisos },
      controle.signal,
    );

    const chegando = proxima(acompanhando);
    valorDe(await conversas.registrarMensagem(joao, { texto: "minha senha é…", agora }));
    await escrever(conversas, "oi");

    expect(textos(valorDe(await chegando))).toEqual(["oi"]);
    controle.abort();
  });

  it("Dado o banco fora do ar, Então o acompanhamento entrega indisponível e termina, para o cliente reconectar", async () => {
    const { avisos } = cenario();
    const base = conversasEmMemoria();
    const foraDoAr: Conversas = { ...base, historico: () => Promise.resolve(falha(INDISPONIVEL)) };

    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas: foraDoAr, avisos },
      new AbortController().signal,
    );

    expect(await acompanhando.next()).toEqual({ done: false, value: falha(INDISPONIVEL) });
    expect(await acompanhando.next()).toEqual({ done: true, value: undefined });
  });

  it("Dado a Ana desconectando, Então o acompanhamento termina e para de ouvir os avisos", async () => {
    const avisos = contandoOuvintes(avisosEmProcesso());
    const conversas = conversasQueAvisam(conversasEmMemoria(), avisos);
    valorDe(await conversas.atual(ana));
    const controle = new AbortController();
    const acompanhando = acompanharConversa(
      ana,
      DESDE_O_COMECO,
      { conversas, avisos },
      controle.signal,
    );

    const terminando = acompanhando.next();
    controle.abort();

    expect(await terminando).toEqual({ done: true, value: undefined });
    expect(avisos.ouvintes()).toBe(0);
  });
});

function contandoOuvintes(avisos: Avisos) {
  let ativos = 0;
  return {
    ...avisos,
    ouvir: (ouvinte: Parameters<Avisos["ouvir"]>[0]) => {
      ativos += 1;
      const parar = avisos.ouvir(ouvinte);
      return () => {
        ativos -= 1;
        parar();
      };
    },
    ouvintes: () => ativos,
  };
}

describe("Acompanhar os avisos de todas as conversas (console)", () => {
  it("Dado avisos seguidos, Então cada um chega uma vez, na ordem, e desconectar para de ouvir", async () => {
    const avisos = contandoOuvintes(avisosEmProcesso());
    const controle = new AbortController();
    const acompanhando = acompanharAvisos(avisos, controle.signal);

    const primeiro = acompanhando.next();
    avisos.avisar({ dono: ana });
    avisos.avisar({ dono: joao });

    expect(await primeiro).toEqual({ done: false, value: { dono: ana } });
    expect(await acompanhando.next()).toEqual({ done: false, value: { dono: joao } });
    const terminando = acompanhando.next();
    controle.abort();
    expect(await terminando).toEqual({ done: true, value: undefined });
    expect(avisos.ouvintes()).toBe(0);
  });
});
