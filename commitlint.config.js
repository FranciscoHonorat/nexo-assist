export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "domain",
        "tickets",
        "conversas",
        "agent",
        "ajuda",
        "acesso",
        "console",
        "tempo-real",
        "composicao",
        "arquitetura",
        "api",
        "ui",
        "db",
        "ci",
        "deps",
        "docs",
      ],
    ],
  },
};
