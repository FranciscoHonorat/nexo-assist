import { describe, expect, it } from "vitest";
import { assumir, finalizar, novaConversa } from "../../domain/conversa.js";
import { lerUserId } from "../../domain/user-id.js";
import { assumidaPor, colocarNaFila, semIds } from "../../testes/conversas.js";
import { ana, bruno } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import { DESDE_O_COMECO } from "../conversas.js";
import type { FabricaDeConversas } from "./index.js";

const pedidaEm = new Date("2026-10-28T13:00:00Z");
const assumidaEm = new Date("2026-10-28T13:05:00Z");
const finalizadaEm = new Date("2026-10-28T13:30:00Z");
const carla = valorDe(lerUserId("carla.n1@nexo.com"));

export function cenariosDasTransicoes(fabricar: FabricaDeConversas): void {
  describe("transicionar", () => {
    it("Dado uma conversa transferida, Quando o funcionário volta, Então ela continua na fila", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);

      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(fila);
    });

    it("Dado uma conversa transferida e assumida, Quando o funcionário volta, Então ela continua com o analista", async () => {
      const conversas = await fabricar();
      const comBruno = await assumidaPor(conversas, ana, bruno, assumidaEm);

      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(comBruno);
    });

    it("Dado dois analistas assumindo a mesma conversa, Então só o primeiro consegue", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);
      const assumirPor = (analista: typeof bruno) =>
        conversas.transicionar(
          {
            evento: "assumida",
            antes: fila,
            depois: assumir(fila, { analista, agora: assumidaEm }),
          },
          assumidaEm,
        );
      valorDe(await assumirPor(bruno));

      expect(await assumirPor(carla)).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.atual(ana)).conversa).toMatchObject({ analista: bruno });
    });

    it("Dado uma conversa com o Bruno, Quando a Carla tenta encerrá-la com uma cópia antiga, Então nada muda", async () => {
      const conversas = await fabricar();
      const comBruno = await assumidaPor(conversas, ana, bruno, assumidaEm);
      const comCarla = { ...comBruno, analista: carla };

      expect(
        await conversas.transicionar(
          { evento: "encerrada", antes: comCarla, depois: novaConversa({ dono: ana }) },
          finalizadaEm,
        ),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(comBruno);
    });
  });

  describe("eventos das transições no histórico", () => {
    it("Dado uma conversa transferida, assumida e encerrada, Então cada transição entra no histórico como evento do sistema, na ordem e com o horário", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);
      const comBruno = assumir(fila, { analista: bruno, agora: assumidaEm });
      valorDe(
        await conversas.transicionar(
          { evento: "assumida", antes: fila, depois: comBruno },
          assumidaEm,
        ),
      );
      const { conversa } = valorDe(
        finalizar(comBruno, { desfecho: "encerrada", por: bruno, agora: finalizadaEm }),
      );

      valorDe(
        await conversas.transicionar(
          { evento: "encerrada", antes: comBruno, depois: conversa },
          finalizadaEm,
        ),
      );

      expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
        {
          autor: "sistema",
          evento: { tipo: "transferida", motivo: "pedido_do_funcionario" },
          enviadaEm: pedidaEm,
        },
        { autor: "sistema", evento: { tipo: "assumida", analista: bruno }, enviadaEm: assumidaEm },
        { autor: "sistema", evento: { tipo: "encerrada" }, enviadaEm: finalizadaEm },
      ]);
      expect(valorDe(await conversas.atual(ana)).conversa).toEqual(novaConversa({ dono: ana }));
    });

    it("Dado uma conversa na fila, Quando é devolvida ao agent sem ser assumida, Então o agent volta e o histórico registra a devolução", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);

      valorDe(
        await conversas.transicionar(
          { evento: "devolvida", antes: fila, depois: novaConversa({ dono: ana }) },
          assumidaEm,
        ),
      );

      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO)).at(-1)).toMatchObject({
        autor: "sistema",
        evento: { tipo: "devolvida" },
      });
      expect(valorDe(await conversas.atual(ana)).conversa.controle).toBe("agent");
    });

    it("Dado uma devolução repetida, Quando a segunda é recusada, Então nenhum evento a mais entra no histórico", async () => {
      const conversas = await fabricar();
      const fila = await colocarNaFila(conversas, ana, pedidaEm);
      const devolver = () =>
        conversas.transicionar(
          { evento: "devolvida", antes: fila, depois: novaConversa({ dono: ana }) },
          assumidaEm,
        );
      valorDe(await devolver());
      const depoisDaPrimeira = valorDe(await conversas.historico(ana, DESDE_O_COMECO));

      expect(await devolver()).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(valorDe(await conversas.historico(ana, DESDE_O_COMECO))).toEqual(depoisDaPrimeira);
    });
  });

  describe("registrarTurno condicional", () => {
    it("Dado que um analista assumiu durante o turno, Quando o agent tenta responder, Então a pergunta fica no histórico e a resposta não", async () => {
      const conversas = await fabricar();
      await assumidaPor(conversas, ana, bruno, assumidaEm);
      const antes = valorDe(await conversas.historico(ana, DESDE_O_COMECO));

      expect(
        await conversas.registrarTurno(ana, {
          pergunta: "ainda está aí?",
          resposta: { texto: "Estou sim!", registro: { trace: [] } },
          agora: assumidaEm,
        }),
      ).toEqual({ ok: false, erro: { motivo: "controle_mudou" } });
      expect(semIds(valorDe(await conversas.historico(ana, DESDE_O_COMECO)))).toEqual([
        ...semIds(antes),
        { autor: "funcionario", texto: "ainda está aí?", enviadaEm: assumidaEm },
      ]);
    });
  });
}
