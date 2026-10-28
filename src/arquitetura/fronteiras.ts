import type { Linter } from "eslint";

const ARQUIVOS_DE_TESTE = [
  "src/**/*.test.ts",
  "src/**/*.test-d.ts",
  "src/testes/**",
  "src/tickets/contrato/**",
];

export const fronteiras: Linter.Config[] = [
  {
    name: "fronteira-do-servico-de-chamados",
    files: ["src/**/*.ts"],
    ignores: ["src/tickets/**", "src/composicao/**", ...ARQUIVOS_DE_TESTE],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/tickets/**", "!**/tickets/ticket-client.js"],
              message:
                "Fora de src/tickets, o serviço de chamados é usado só pela interface TicketClient (ADR-0001).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "fronteira-do-dominio",
    files: ["src/domain/**/*.ts"],
    ignores: ARQUIVOS_DE_TESTE,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../**"],
              message:
                "O domínio é a camada mais interna: ele não importa nada de fora de src/domain.",
            },
          ],
        },
      ],
    },
  },
];
