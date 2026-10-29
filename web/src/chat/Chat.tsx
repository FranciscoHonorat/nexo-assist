import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { api, ErroDeApi, ouvirConversa } from "../api.js";
import { Mensagem } from "../comum/Mensagem.js";
import { daSessaoAtual, rascunhoJaResolvido } from "../logica/rotulos.js";
import type { EstadoDaConversa, MensagemDaApi, Nomes } from "../logica/tipos.js";

const AVISO_POR_ERRO: Partial<Record<string, string>> = {
  turno_em_andamento: "Ainda estou respondendo a mensagem anterior.",
  limite_excedido: "Você mandou muitas mensagens em pouco tempo. Tente de novo daqui a pouco.",
  indisponivel: "O serviço está instável. Tente de novo em instantes.",
  rascunho_ja_resolvido: "Esse rascunho já foi resolvido.",
  resolvido_ha_mais_de_7_dias:
    "Esse chamado foi resolvido há mais de 7 dias e não pode ser reaberto.",
  controle_mudou: "A conversa está com um analista agora.",
};

export function Chat() {
  const [mensagens, setMensagens] = useState<readonly MensagemDaApi[]>([]);
  const [nomes, setNomes] = useState<Nomes>({});
  const [estado, setEstado] = useState<EstadoDaConversa | null>(null);
  const [conectado, setConectado] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      ouvirConversa({
        estado: setEstado,
        conexao: setConectado,
        mensagens: (lote) => {
          setNomes((atuais) => ({ ...atuais, ...lote.nomes }));
          setMensagens((atuais) => {
            const vistas = new Set(atuais.map(({ id }) => id));
            return [...atuais, ...lote.mensagens.filter(({ id }) => !vistas.has(id))];
          });
        },
      }),
    [],
  );

  const visiveis = daSessaoAtual(mensagens);
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [visiveis.length]);

  const tentar = async (acao: () => Promise<unknown>) => {
    setAviso(null);
    try {
      await acao();
    } catch (erro) {
      const motivo = erro instanceof ErroDeApi ? erro.motivo : "desconhecido";
      setAviso(AVISO_POR_ERRO[motivo] ?? "Algo deu errado. Tente de novo.");
    }
  };

  const enviar = async (conteudo: string) => {
    if (conteudo.trim() === "" || enviando) return;
    setEnviando(true);
    setTexto("");
    await tentar(() => api.enviar(conteudo));
    setEnviando(false);
  };

  const aoEnviar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    void enviar(texto);
  };

  const comAgent = estado?.controle === "agent";
  const ultimaDoAgent = visiveis.findLast((mensagem) => mensagem.autor === "agent")?.id;

  return (
    <section className="chat">
      <header className="chat-topo">
        <div>
          <h2>Atendimento</h2>
          <p className={`discreto status ${conectado ? "status-online" : ""}`}>
            {estado === null || comAgent
              ? "Assistente online"
              : estado.controle === "aguardando"
                ? "Aguardando um analista · o assistente está pausado"
                : "Um analista está atendendo você"}
          </p>
        </div>
        <button
          type="button"
          disabled={!comAgent}
          title={comAgent ? "" : "Disponível quando a conversa voltar ao assistente"}
          onClick={() => {
            void tentar(() => api.novaSessao());
          }}
        >
          Nova sessão
        </button>
      </header>

      <div className="mensagens" aria-live="polite">
        {visiveis.length === 0 && (
          <p className="vazio">
            Descreva o que está acontecendo. Eu consulto seus chamados, busco na central de ajuda e
            chamo um analista quando precisar.
          </p>
        )}
        {visiveis.map((mensagem) => (
          <Mensagem
            key={mensagem.id}
            mensagem={mensagem}
            nomes={nomes}
            interativa={comAgent && mensagem.id === ultimaDoAgent && !enviando}
            rascunhoResolvido={rascunhoJaResolvido(visiveis, mensagem.id)}
            acoes={{
              escolher: (opcao) => {
                void enviar(opcao);
              },
              confirmar: (id) => {
                void tentar(() => api.confirmar(id));
              },
              descartar: (id) => {
                void tentar(() => api.descartar(id));
              },
            }}
          />
        ))}
        {enviando && <div className="digitando">Nexo Assist está pensando…</div>}
        <div ref={fim} />
      </div>

      {aviso !== null && (
        <p className="aviso" role="alert">
          {aviso}
        </p>
      )}

      <form className="compor" onSubmit={aoEnviar}>
        <input
          aria-label="Mensagem"
          placeholder="Escreva para o Nexo…"
          value={texto}
          maxLength={2000}
          onChange={(evento) => {
            setTexto(evento.target.value);
          }}
        />
        <button type="submit" className="primario" disabled={enviando || texto.trim() === ""}>
          Enviar
        </button>
      </form>
      {estado !== null && (
        <p className="contador discreto">
          {estado.mensagensNaSessao}/{estado.limite} mensagens nesta sessão
        </p>
      )}
    </section>
  );
}
