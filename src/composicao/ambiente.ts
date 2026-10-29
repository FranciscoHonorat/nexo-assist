import { z } from "zod";
import { MODELOS_DA_ANTHROPIC, type ModeloDaAnthropic } from "../agent/mastra/anthropic.js";
import { ESFORCOS } from "../agent/mastra/mastra-agent-step.js";
import { falha, sucesso, type Resultado } from "../domain/resultado.js";

export type Ambiente = {
  readonly banco: string;
  readonly porta: number;
  readonly modelo: ModeloDaAnthropic;
};

export type ErroDeAmbiente = {
  readonly motivo: "variaveis_invalidas";
  readonly variaveis: readonly string[];
};

const preenchida = z.string().trim().min(1);

const ambiente = z
  .object({
    DATABASE_URL: preenchida,
    ANTHROPIC_API_KEY: preenchida,
    LLM_MODEL: z.enum(MODELOS_DA_ANTHROPIC),
    LLM_EFFORT: z.enum(ESFORCOS),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  })
  .transform((variaveis): Ambiente => ({
    banco: variaveis.DATABASE_URL,
    porta: variaveis.PORT,
    modelo: {
      chave: variaveis.ANTHROPIC_API_KEY,
      nome: variaveis.LLM_MODEL,
      esforco: variaveis.LLM_EFFORT,
    },
  }));

export function lerAmbiente(
  variaveis: Readonly<Record<string, string | undefined>>,
): Resultado<Ambiente, ErroDeAmbiente> {
  const lido = ambiente.safeParse(variaveis);
  if (lido.success) return sucesso(lido.data);
  const invalidas = new Set(lido.error.issues.map(({ path }) => String(path[0])));
  return falha({ motivo: "variaveis_invalidas", variaveis: [...invalidas] });
}
