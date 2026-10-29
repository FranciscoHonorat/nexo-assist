import { afterAll, describe, expect, it } from "vitest";
import { novoRascunhoId } from "../../domain/rascunho-id.js";
import { bancoReal, desconectarBancoReal } from "../../testes/postgres-real.js";
import { valorDe } from "../../testes/valor-de.js";
import {
  chamadosIniciais,
  complementoConfirmadoDaAna,
  incidenteDaAna,
  notebookLento,
  rascunhoConfirmadoDaAna,
  t1,
} from "../contrato/fixtures.js";
import { ana } from "../../testes/usuarios.js";
import { verificarContratoDoTicketClient } from "../contrato/index.js";

const url = process.env["TEST_DATABASE_URL"];
const REPETICOES = 20;

describe.skipIf(url === undefined)("PostgreSQL real", () => {
  const fabricar = bancoReal(url ?? "");

  afterAll(desconectarBancoReal);

  verificarContratoDoTicketClient("PostgreSQL real", fabricar);

  describe("corridas entre requisições simultâneas", () => {
    it("o mesmo rascunho criado duas vezes ao mesmo tempo vira um chamado só", async () => {
      for (let vez = 0; vez < REPETICOES; vez++) {
        const servico = await fabricar({ chamados: chamadosIniciais });
        const rascunho = rascunhoConfirmadoDaAna(novoRascunhoId(), notebookLento);

        const [primeiro, segundo] = await Promise.all([
          servico.criar(rascunho, t1),
          servico.criar(rascunho, t1),
        ]);

        expect(valorDe(segundo)).toEqual(valorDe(primeiro));
        expect(valorDe(await servico.listar(ana))).toHaveLength(3);
      }
    });

    it("o mesmo complemento aplicado duas vezes ao mesmo tempo entra uma vez só", async () => {
      for (let vez = 0; vez < REPETICOES; vez++) {
        const servico = await fabricar({ chamados: chamadosIniciais });
        const rascunho = complementoConfirmadoDaAna(novoRascunhoId(), incidenteDaAna.id, "x");

        const resultados = await Promise.all([
          servico.complementar(rascunho, t1),
          servico.complementar(rascunho, t1),
        ]);

        expect(resultados.map((resultado) => resultado.ok)).toEqual([true, true]);
        expect(valorDe(await servico.obter(incidenteDaAna.id, ana)).complementos).toHaveLength(1);
      }
    });

    it("duas mudanças de status diferentes ao mesmo tempo: uma vence e a outra é recusada", async () => {
      for (let vez = 0; vez < REPETICOES; vez++) {
        const servico = await fabricar({ chamados: chamadosIniciais });

        const resultados = await Promise.all([
          servico.alterarStatus(
            incidenteDaAna.id,
            { de: "aberto", para: "aguardando_analista", por: ana },
            t1,
          ),
          servico.alterarStatus(
            incidenteDaAna.id,
            { de: "aberto", para: "resolvido", por: ana },
            t1,
          ),
        ]);

        const sucessos = resultados.filter((resultado) => resultado.ok);
        const motivosDasRecusas = resultados.flatMap((resultado) =>
          resultado.ok ? [] : [resultado.erro.motivo],
        );
        expect(sucessos).toHaveLength(1);
        expect(motivosDasRecusas).toEqual(["status_mudou"]);
      }
    });
  });
});
