import type { Conversas, Mensagem } from "../conversas/conversas.js";
import type { Resultado } from "../domain/resultado.js";
import type { UserId } from "../domain/user-id.js";
import type { ErroDeInfraestrutura } from "../infraestrutura/indisponivel.js";
import type { AvisoDeConversa, Avisos } from "./avisos.js";

type Fontes = {
  readonly conversas: Pick<Conversas, "historico">;
  readonly avisos: Avisos;
};

export async function* acompanharConversa(
  dono: UserId,
  ultimaVista: number,
  { conversas, avisos }: Fontes,
  sinal: AbortSignal,
): AsyncGenerator<Resultado<readonly Mensagem[], ErroDeInfraestrutura>, void> {
  const despertador = criarDespertador();
  const pararDeOuvir = avisos.ouvir((aviso) => {
    if (aviso.dono === dono) despertador.tocar();
  });
  sinal.addEventListener("abort", despertador.tocar);
  let cursor = ultimaVista;
  try {
    while (!sinal.aborted) {
      const novas = await conversas.historico(dono, cursor);
      if (!novas.ok) {
        yield novas;
        return;
      }
      const ultima = novas.valor.at(-1);
      if (ultima !== undefined) {
        cursor = ultima.id;
        yield novas;
      }
      await despertador.esperar();
    }
  } finally {
    pararDeOuvir();
    sinal.removeEventListener("abort", despertador.tocar);
  }
}

export async function* acompanharAvisos(
  avisos: Avisos,
  sinal: AbortSignal,
): AsyncGenerator<AvisoDeConversa, void> {
  const despertador = criarDespertador();
  const recebidos: AvisoDeConversa[] = [];
  const pararDeOuvir = avisos.ouvir((aviso) => {
    recebidos.push(aviso);
    despertador.tocar();
  });
  sinal.addEventListener("abort", despertador.tocar);
  try {
    while (!sinal.aborted) {
      yield* recebidos.splice(0);
      await despertador.esperar();
    }
  } finally {
    pararDeOuvir();
    sinal.removeEventListener("abort", despertador.tocar);
  }
}

function criarDespertador() {
  let tocou = false;
  let acordar: (() => void) | undefined;
  return {
    tocar: () => {
      tocou = true;
      acordar?.();
    },
    esperar: async () => {
      if (!tocou) await new Promise<void>((resolver) => (acordar = resolver));
      tocou = false;
      acordar = undefined;
    },
  };
}
