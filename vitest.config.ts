import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test-d.ts",
        "src/tickets/contrato/**",
        "src/testes/**",
      ],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
