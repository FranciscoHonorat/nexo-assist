import type {
  ApiDoChat,
  ApiDoConsole,
  ErroDaApi,
  EstadoDaConversa,
  LoteDaApi,
  Pessoa,
} from "./logica/tipos.js";

export class ErroDeApi extends Error {
  constructor(
    readonly status: number,
    readonly motivo: ErroDaApi["erro"] | "desconhecido",
  ) {
    super(`a API respondeu ${String(status)}: ${motivo}`);
  }
}

async function pedir<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(caminho, {
    method: metodo,
    credentials: "same-origin",
    ...(corpo === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) }),
  });
  if (!resposta.ok) {
    const lido = (await resposta.json().catch(() => ({}))) as Partial<ErroDaApi>;
    throw new ErroDeApi(resposta.status, lido.erro ?? "desconhecido");
  }
  return resposta.status === 204 ? (undefined as T) : ((await resposta.json()) as T);
}

const conversa = (dono: string) => `/api/console/conversas/${encodeURIComponent(dono)}`;

export const api = {
  eu: () => pedir<{ pessoa: Pessoa }>("GET", "/api/eu"),
  entrar: (email: string, senha: string) =>
    pedir<{ pessoa: Pessoa }>("POST", "/api/entrar", { email, senha }),
  sair: () => pedir<undefined>("POST", "/api/sair"),
  enviar: (texto: string) => pedir<ApiDoChat["atendimento"]>("POST", "/api/mensagens", { texto }),
  confirmar: (id: string) =>
    pedir<ApiDoChat["chamado"]>("POST", `/api/rascunhos/${encodeURIComponent(id)}/confirmar`),
  descartar: (id: string) =>
    pedir<undefined>("POST", `/api/rascunhos/${encodeURIComponent(id)}/descartar`),
  novaSessao: () => pedir<undefined>("POST", "/api/sessao"),
  console: {
    listar: () => pedir<ApiDoConsole["lista"]>("GET", "/api/console/conversas"),
    detalhe: (dono: string) => pedir<ApiDoConsole["detalhe"]>("GET", conversa(dono)),
    assumir: (dono: string) => pedir<undefined>("POST", `${conversa(dono)}/assumir`),
    devolver: (dono: string) => pedir<undefined>("POST", `${conversa(dono)}/devolver`),
    encerrar: (dono: string) => pedir<undefined>("POST", `${conversa(dono)}/encerrar`),
    responder: (dono: string, texto: string) =>
      pedir<undefined>("POST", `${conversa(dono)}/mensagens`, { texto }),
  },
};

type OuvintesDaConversa = {
  readonly estado: (estado: EstadoDaConversa) => void;
  readonly mensagens: (lote: LoteDaApi) => void;
  readonly conexao: (conectado: boolean) => void;
};

export function ouvirConversa(ouvintes: OuvintesDaConversa): () => void {
  const fonte = new EventSource("/api/conversa/eventos");
  fonte.addEventListener("open", () => {
    ouvintes.conexao(true);
  });
  fonte.addEventListener("error", () => {
    ouvintes.conexao(false);
  });
  fonte.addEventListener("estado", (evento: MessageEvent<string>) => {
    ouvintes.estado(JSON.parse(evento.data) as EstadoDaConversa);
  });
  fonte.addEventListener("mensagens", (evento: MessageEvent<string>) => {
    ouvintes.mensagens(JSON.parse(evento.data) as LoteDaApi);
  });
  return () => {
    fonte.close();
  };
}

export function ouvirConsole(aoMudar: (dono: string) => void): () => void {
  const fonte = new EventSource("/api/console/eventos");
  fonte.addEventListener("conversa", (evento: MessageEvent<string>) => {
    aoMudar((JSON.parse(evento.data) as { dono: string }).dono);
  });
  return () => {
    fonte.close();
  };
}
