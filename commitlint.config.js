export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["domain", "tickets", "agent", "api", "ui", "db", "ci", "deps", "docs"],
    ],
  },
};
