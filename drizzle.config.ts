import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/tickets/postgres/esquema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
