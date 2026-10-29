import { describe, expect, it } from "vitest";
import { ARTIGOS } from "./artigos.js";
import { criarCentralDeAjuda, LIMITE_DE_ARTIGOS, type Artigo } from "./central-de-ajuda.js";

function idsEncontrados(consulta: string, artigos: readonly Artigo[] = ARTIGOS): string[] {
  return criarCentralDeAjuda(artigos)
    .buscar(consulta)
    .map((artigo) => artigo.id);
}

describe("Central de ajuda: a busca encontra o artigo pelas palavras do funcionário", () => {
  it("Dado o artigo do erro 809, Quando a busca cita a VPN e o erro, Então ele vem primeiro", () => {
    expect(idsEncontrados("minha VPN dá erro 809")[0]).toBe("KB-001");
  });

  it("Dado o artigo do horário, Quando a busca vem sem acento, Então ele é encontrado", () => {
    expect(idsEncontrados("qual o horario do service desk")).toContain("KB-002");
  });

  it("Dado o artigo de senha bloqueada, Quando a busca usa o plural, Então ele é encontrado", () => {
    expect(idsEncontrados("senhas bloqueadas")).toContain("KB-003");
  });

  it("Dado um assunto fora da central, Quando a busca roda, Então nada volta", () => {
    expect(idsEncontrados("quando cai a folha de pagamento?")).toEqual([]);
  });

  it("Dado uma busca só com palavras vazias, Quando ela roda, Então nada volta", () => {
    expect(idsEncontrados("o que é de para")).toEqual([]);
  });

  it("Dado muitos artigos parecidos, Quando a busca roda, Então volta no máximo o limite, do mais para o menos relevante", () => {
    const parecidos: Artigo[] = Array.from({ length: 5 }, (_, indice) => ({
      id: `KB-9${String(indice)}`,
      titulo: indice === 4 ? "Impressora sem toner" : "Impressora",
      conteudo: "Como resolver problemas com a impressora.",
    }));

    expect(idsEncontrados("impressora sem toner", parecidos)).toHaveLength(LIMITE_DE_ARTIGOS);
    expect(idsEncontrados("impressora sem toner", parecidos)[0]).toBe("KB-94");
  });

  it("a central de exemplo tem de 5 a 10 artigos, como pede o PRD", () => {
    expect(ARTIGOS.length).toBeGreaterThanOrEqual(5);
    expect(ARTIGOS.length).toBeLessThanOrEqual(10);
  });
});
