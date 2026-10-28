import type { Linter } from "eslint";

const ARQUIVOS_DE_TESTE = [
  "src/**/*.test.ts",
  "src/**/*.test-d.ts",
  "src/testes/**",
  "src/tickets/contrato/**",
];

type Fronteira = {
  readonly nome: string;
  readonly protege: readonly string[];
  readonly exceto?: readonly string[];
  readonly proibe: readonly string[];
  readonly porque: string;
};

function fronteira({ nome, protege, exceto = [], proibe, porque }: Fronteira): Linter.Config {
  return {
    name: `fronteira-${nome}`,
    files: [...protege],
    ignores: [...exceto, ...ARQUIVOS_DE_TESTE],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: [...proibe], message: porque }] }],
    },
  };
}

export const fronteiras: Linter.Config[] = [
  fronteira({
    nome: "do-servico-de-chamados",
    protege: ["src/**/*.ts"],
    exceto: ["src/tickets/**", "src/composicao/**"],
    proibe: ["**/tickets/**", "!**/tickets/ticket-client.js"],
    porque:
      "Fora de src/tickets, o serviço de chamados é usado só pela interface TicketClient (ADR-0001).",
  }),
  fronteira({
    nome: "do-dominio",
    protege: ["src/domain/**/*.ts"],
    proibe: ["../**"],
    porque: "O domínio é a camada mais interna: ele não importa nada de fora de src/domain.",
  }),
];
