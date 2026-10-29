import { afterAll, describe, expect, it } from "vitest";
import { assumir } from "../../domain/conversa.js";
import { lerUserId } from "../../domain/user-id.js";
import { colocarNaFila } from "../../testes/conversas.js";
import { conversasReais, desconectarBancoReal } from "../../testes/postgres-real.js";
import { ana, bruno } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import { DESDE_O_COMECO } from "../conversas.js";
import { verificarContratoDeConversas } from "../contrato/index.js";

const url = process.env["TEST_DATABASE_URL"];
const REPETICOES = 20;
const ESCRITAS_SIMULTANEAS = 10;
const TEMPO_DAS_CORRIDAS = 30_000;
const agora = new Date("2026-10-28T13:00:00Z");
const carla = valorDe(lerUserId("carla.n1@nexo.com"));

describe.skipIf(url === undefined)("Conversas no PostgreSQL real", () => {
  const fabricar = conversasReais(url ?? "");

  afterAll(desconectarBancoReal);

  verificarContratoDeConversas("PostgreSQL real", fabricar);

  describe("corridas entre requisições simultâneas", () => {
    it(
      "quem acompanha pelo cursor enquanto várias mensagens são gravadas ao mesmo tempo não pula nenhuma",
      async () => {
        for (let vez = 0; vez < REPETICOES; vez++) {
          const conversas = await fabricar();
          valorDe(await conversas.atual(ana));
          const vistas: number[] = [];
          let cursor = DESDE_O_COMECO;
          let gravando = true;
          const lerNovas = async () => {
            const novas = valorDe(await conversas.historico(ana, cursor));
            vistas.push(...novas.map(({ id }) => id));
            cursor = novas.at(-1)?.id ?? cursor;
            return novas.length;
          };
          const acompanhar = async () => {
            while (gravando) {
              await lerNovas();
              await new Promise((ceder) => setImmediate(ceder));
            }
            while ((await lerNovas()) > 0);
          };
          const acompanhando = acompanhar();

          await Promise.all(
            Array.from({ length: ESCRITAS_SIMULTANEAS }, (_, i) =>
              conversas.registrarMensagem(ana, { texto: `mensagem ${String(i)}`, agora }),
            ),
          );
          gravando = false;
          await acompanhando;

          const gravadas = valorDe(await conversas.historico(ana, DESDE_O_COMECO));
          expect(vistas).toEqual(gravadas.map(({ id }) => id));
        }
      },
      TEMPO_DAS_CORRIDAS,
    );

    it(
      "dois analistas assumindo ao mesmo tempo: só um vence e só um evento entra no histórico",
      async () => {
        for (let vez = 0; vez < REPETICOES; vez++) {
          const conversas = await fabricar();
          const fila = await colocarNaFila(conversas, ana, agora);

          const resultados = await Promise.all(
            [bruno, carla].map((analista) =>
              conversas.transicionar(
                { evento: "assumida", antes: fila, depois: assumir(fila, { analista, agora }) },
                agora,
              ),
            ),
          );

          expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
          const assumidas = valorDe(await conversas.historico(ana, DESDE_O_COMECO)).filter(
            (mensagem) => mensagem.autor === "sistema" && mensagem.evento.tipo === "assumida",
          );
          expect(assumidas).toHaveLength(1);
        }
      },
      TEMPO_DAS_CORRIDAS,
    );
  });
});
