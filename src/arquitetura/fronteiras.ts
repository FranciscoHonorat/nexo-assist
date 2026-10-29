import type { ESLint, Linter, Rule } from "eslint";

const ARQUIVOS_DE_TESTE = [
  "src/**/*.test.ts",
  "src/**/*.test-d.ts",
  "src/testes/**",
  "src/tickets/contrato/**",
  "src/conversas/contrato/**",
];

type Fronteira = {
  readonly nome: string;
  readonly protege: readonly string[];
  readonly exceto?: readonly string[];
  readonly proibe: RegExp;
  readonly permite?: RegExp;
  readonly porque: string;
};

const FRONTEIRAS: readonly Fronteira[] = [
  {
    nome: "do-servico-de-chamados",
    protege: ["src/**/*.ts"],
    exceto: ["src/tickets/**", "src/composicao/**"],
    proibe: /\/tickets\//,
    permite: /\/tickets\/ticket-client\.js$/,
    porque:
      "Fora de src/tickets, o serviço de chamados é usado só pela interface TicketClient (ADR-0001).",
  },
  {
    nome: "de-conversas",
    protege: ["src/**/*.ts"],
    exceto: ["src/conversas/**", "src/composicao/**"],
    proibe: /\/conversas\//,
    permite: /\/conversas\/conversas\.js$/,
    porque: "Fora de src/conversas, as conversas são usadas só pela interface Conversas.",
  },
  {
    nome: "do-framework-de-agent",
    protege: ["src/**/*.ts"],
    exceto: ["src/agent/mastra/**"],
    proibe: pacotes("@mastra/*", "@ai-sdk/*", "ai"),
    porque:
      "Mastra e AI SDK só dentro de src/agent/mastra; o resto usa a interface AgentStep (ADR-0005).",
  },
  {
    nome: "do-dominio",
    protege: ["src/domain/**/*.ts"],
    proibe: /^\.\.\//,
    porque: "O domínio é a camada mais interna: ele não importa nada de fora de src/domain.",
  },
  {
    nome: "da-infraestrutura",
    protege: ["src/infraestrutura/**/*.ts"],
    proibe: /\/(tickets|conversas|agent)\//,
    porque:
      "A infraestrutura compartilhada não depende dos módulos de negócio: são eles que dependem dela.",
  },
];

function pacotes(...nomes: readonly string[]): RegExp {
  const alternativas = nomes.map((nome) =>
    nome.endsWith("/*") ? escapar(nome.slice(0, -1)) : `${escapar(nome)}(/|$)`,
  );
  return new RegExp(`^(${alternativas.join("|")})`);
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const PLUGIN = "fronteiras";

type DeclaracaoComOrigem = Rule.Node & {
  readonly source?: { readonly value?: unknown } | null | undefined;
};

function regra({ proibe, permite, porque }: Fronteira): Rule.RuleModule {
  return {
    meta: { type: "problem", schema: [] },
    create: (contexto) => {
      const verificar = (declaracao: DeclaracaoComOrigem) => {
        const caminho = String(declaracao.source?.value);
        if (proibe.test(caminho) && !permite?.test(caminho)) {
          contexto.report({ node: declaracao, message: porque });
        }
      };
      return {
        ImportDeclaration: verificar,
        ExportNamedDeclaration: verificar,
        ExportAllDeclaration: verificar,
      };
    },
  };
}

const plugin: ESLint.Plugin = {
  rules: Object.fromEntries(FRONTEIRAS.map((fronteira) => [fronteira.nome, regra(fronteira)])),
};

function configuracao({ nome, protege, exceto = [] }: Fronteira): Linter.Config {
  return {
    name: `fronteira-${nome}`,
    files: [...protege],
    ignores: [...exceto, ...ARQUIVOS_DE_TESTE],
    plugins: { [PLUGIN]: plugin },
    rules: { [`${PLUGIN}/${nome}`]: "error" },
  };
}

export const fronteiras: Linter.Config[] = FRONTEIRAS.map(configuracao);
