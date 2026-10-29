import { beforeAll, describe, expect, it } from "vitest";
import {
  TEMPO_PARA_MIGRAR,
  bancoDeTesteComDrizzle,
  migrarBancoDeTeste,
} from "../../testes/banco-de-teste.js";
import { ana, joao } from "../../testes/usuarios.js";
import { valorDe } from "../../testes/valor-de.js";
import { incidenteDaAna, incidenteDoJoao, requisicaoDaAna } from "../contrato/fixtures.js";
import { semearChamados } from "./semente.js";

beforeAll(migrarBancoDeTeste, TEMPO_PARA_MIGRAR);

describe("Semente dos chamados de exemplo", () => {
  it("Dado um banco sem chamados, Quando a aplicação sobe, Então os chamados de exemplo entram, cada um para o seu dono", async () => {
    const { db, servico } = await bancoDeTesteComDrizzle({ chamados: [] });

    expect(await semearChamados(db, [incidenteDaAna, requisicaoDaAna, incidenteDoJoao])).toBe(3);

    expect(valorDe(await servico.listar(ana))).toHaveLength(2);
    expect(valorDe(await servico.listar(joao))).toEqual([incidenteDoJoao]);
  });

  it("Dado um banco que já tem chamados, Quando a aplicação sobe de novo, Então nada é duplicado nem sobrescrito", async () => {
    const { db, servico } = await bancoDeTesteComDrizzle({ chamados: [incidenteDaAna] });

    expect(await semearChamados(db, [incidenteDaAna, requisicaoDaAna])).toBe(0);
    expect(valorDe(await servico.listar(ana))).toEqual([incidenteDaAna]);
  });

  it("Dado um chamado de exemplo com complementos, Então eles entram junto, na ordem", async () => {
    const { db, servico } = await bancoDeTesteComDrizzle({ chamados: [] });
    const complementado = {
      ...incidenteDaAna,
      complementos: [
        { texto: "reiniciei e continua", em: incidenteDaAna.criadoEm },
        { texto: "agora não liga", em: incidenteDaAna.atualizadoEm },
      ],
    };

    await semearChamados(db, [complementado]);

    expect(valorDe(await servico.obter(incidenteDaAna.id, ana)).complementos).toEqual(
      complementado.complementos,
    );
  });
});
