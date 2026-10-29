import type { Context } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";

export const INTERVALO_DO_PING = 25_000;

export function transmitir(
  c: Context,
  enviar: (stream: SSEStreamingApi, sinal: AbortSignal) => Promise<void>,
) {
  return streamSSE(c, async (stream) => {
    const controle = new AbortController();
    const ping = setInterval(() => {
      void stream.writeSSE({ event: "ping", data: "" });
    }, INTERVALO_DO_PING);
    stream.onAbort(() => {
      controle.abort();
    });
    try {
      await enviar(stream, controle.signal);
    } finally {
      clearInterval(ping);
    }
  });
}

export function evento(nome: string, dados: unknown, id?: number) {
  return {
    event: nome,
    data: JSON.stringify(dados),
    ...(id === undefined ? {} : { id: String(id) }),
  };
}
