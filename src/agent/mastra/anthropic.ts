import { createAnthropic } from "@ai-sdk/anthropic";
import type { AgentStep } from "../agent-step.js";
import { mastraAgentStep, type Esforco } from "./mastra-agent-step.js";

export const MODELOS_DA_ANTHROPIC = [
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
] as const;

export type ModeloDaAnthropic = {
  readonly chave: string;
  readonly nome: (typeof MODELOS_DA_ANTHROPIC)[number];
  readonly esforco: Esforco;
};

export function mastraComAnthropic(
  { chave, nome, esforco }: ModeloDaAnthropic,
  instrucoes: string,
): AgentStep {
  const anthropic = createAnthropic({ apiKey: chave });
  return mastraAgentStep({ modelo: anthropic(nome), instrucoes, esforco });
}
