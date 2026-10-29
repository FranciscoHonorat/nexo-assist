import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { api, ErroDeApi, ouvirConsole } from "../api.js";
import { CartaoDeChamado } from "../comum/CartaoDeChamado.js";
import { hora } from "../comum/formato.js";
import { Mensagem } from "../comum/Mensagem.js";
import {
  MOTIVO_DA_TRANSFERENCIA,
  situacaoNoConsole,
  textoDoEvento,
  type Situacao,
} from "../logica/rotulos.js";
import type { DetalheDaApi, MensagemDaApi, Pessoa, ResumoDaApi } from "../logica/tipos.js";

const FILTROS = [
  ["todas", "Todas"],
  ["fila", "Na fila"],
  ["minhas", "Minhas"],
  ["agent", "Com o agent"],
] as const;

type Filtro = (typeof FILTROS)[number][0];

function previa(mensagem: MensagemDaApi | null, nomes: Readonly<Record<string, string>>): string {
  if (mensagem === null) return "Sem mensagens nesta sessão";
  switch (mensagem.autor) {
    case "sistema":
      return textoDoEvento(mensagem.evento, nomes);
    case "agent":
      return `Nexo: ${mensagem.texto}`;
    case "analista":
    case "funcionario":
      return mensagem.texto;
  }
}

export function Console({ eu }: { readonly eu: Pessoa }) {
  const [conversas, setConversas] = useState<readonly ResumoDaApi[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheDaApi | null>(null);
  const [resposta, setResposta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregarLista = useCallback(async () => {
    setConversas((await api.console.listar()).conversas);
  }, []);
  const recarregarDetalhe = useCallback(async (dono: string) => {
    setDetalhe(await api.console.detalhe(dono));
  }, []);

  useEffect(() => {
    void recarregarLista();
  }, [recarregarLista]);
  useEffect(() => {
    if (aberta !== null) void recarregarDetalhe(aberta);
  }, [aberta, recarregarDetalhe]);
  useEffect(
    () =>
      ouvirConsole((dono) => {
        void recarregarLista();
        if (dono === aberta) void recarregarDetalhe(dono);
      }),
    [aberta, recarregarLista, recarregarDetalhe],
  );

  const agir = async (acao: () => Promise<unknown>) => {
    setAviso(null);
    try {
      await acao();
    } catch (erro) {
      const motivo = erro instanceof ErroDeApi ? erro.motivo : "desconhecido";
      setAviso(
        motivo === "nao_e_o_analista" ||
          motivo === "conversa_em_outro_estado" ||
          motivo === "controle_mudou"
          ? "A conversa mudou de mãos enquanto isso. A tela foi atualizada."
          : "Não deu certo agora. Tente de novo.",
      );
    }
    if (aberta !== null) await recarregarDetalhe(aberta);
    await recarregarLista();
  };

  const comSituacao = conversas.map((resumo) => ({
    resumo,
    situacao: situacaoNoConsole(resumo, eu.id),
  }));
  const contagem = (grupo: Situacao["grupo"]) =>
    comSituacao.filter(({ situacao }) => situacao.grupo === grupo).length;
  const termo = busca.trim().toLowerCase();
  const visiveis = comSituacao.filter(
    ({ resumo, situacao }) =>
      (filtro === "todas" || situacao.grupo === filtro) &&
      (termo === "" || `${resumo.pessoa.nome} ${resumo.pessoa.id}`.toLowerCase().includes(termo)),
  );

  const responder = (evento: SyntheticEvent) => {
    evento.preventDefault();
    if (aberta === null || resposta.trim() === "") return;
    const texto = resposta;
    setResposta("");
    void agir(() => api.console.responder(aberta, texto));
  };

  const conversa = detalhe?.conversa;
  const comigo = conversa?.controle === "analista" && conversa.analista === eu.id;

  return (
    <div className="console">
      <aside className="lista">
        <h2>Conversas</h2>
        <input
          aria-label="Pesquisar conversa"
          placeholder="Pesquisar por nome ou e-mail"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
          }}
        />
        <div className="filtros" role="tablist">
          {FILTROS.map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={filtro === valor}
              className={filtro === valor ? "filtro ativo" : "filtro"}
              onClick={() => {
                setFiltro(valor);
              }}
            >
              {rotulo}
              {valor !== "todas" && <span className="contagem">{contagem(valor)}</span>}
            </button>
          ))}
        </div>
        <ul>
          {visiveis.map(({ resumo, situacao }) => (
            <li key={resumo.pessoa.id}>
              <button
                type="button"
                className={aberta === resumo.pessoa.id ? "item aberto" : "item"}
                onClick={() => {
                  setAberta(resumo.pessoa.id);
                }}
              >
                <span className="item-topo">
                  <strong>{resumo.pessoa.nome}</strong>
                  {resumo.ultima !== null && <time>{hora(resumo.ultima.enviadaEm)}</time>}
                </span>
                <span className="item-previa">{previa(resumo.ultima, {})}</span>
                <span className={`selo selo-${situacao.tom}`}>{situacao.rotulo}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="atendimento">
        {detalhe === null || conversa === undefined ? (
          <p className="vazio">Escolha uma conversa para ver o histórico.</p>
        ) : (
          <>
            <header className="chat-topo">
              <div>
                <h2>{detalhe.pessoa.nome}</h2>
                <p className="discreto">
                  {detalhe.pessoa.area} · {detalhe.pessoa.id}
                </p>
              </div>
              <div className="botoes">
                {conversa.controle !== "agent" &&
                  (comigo || conversa.controle === "aguardando") && (
                    <button
                      type="button"
                      onClick={() => void agir(() => api.console.devolver(detalhe.pessoa.id))}
                    >
                      Devolver ao agent
                    </button>
                  )}
                {conversa.controle === "aguardando" && (
                  <button
                    type="button"
                    className="primario"
                    onClick={() => void agir(() => api.console.assumir(detalhe.pessoa.id))}
                  >
                    Assumir atendimento
                  </button>
                )}
                {comigo && (
                  <button
                    type="button"
                    className="primario"
                    onClick={() => void agir(() => api.console.encerrar(detalhe.pessoa.id))}
                  >
                    Encerrar atendimento
                  </button>
                )}
              </div>
            </header>
            {conversa.controle === "aguardando" && (
              <p className="faixa faixa-alerta">
                {detalhe.pessoa.nome} espera um atendente · agent pausado · motivo:{" "}
                {MOTIVO_DA_TRANSFERENCIA[conversa.transferencia.motivo]}
                <br />
                <strong>Resumo:</strong> {conversa.transferencia.resumo}
              </p>
            )}
            {aviso !== null && (
              <p className="aviso" role="alert">
                {aviso}
              </p>
            )}
            <div className="mensagens">
              {detalhe.mensagens.map((mensagem) => (
                <Mensagem
                  key={mensagem.id}
                  mensagem={mensagem}
                  nomes={detalhe.nomes}
                  interativa={false}
                  rascunhoResolvido
                />
              ))}
            </div>
            {comigo ? (
              <form className="compor" onSubmit={responder}>
                <input
                  aria-label="Resposta ao funcionário"
                  placeholder={`Responder a ${detalhe.pessoa.nome}…`}
                  value={resposta}
                  maxLength={2000}
                  onChange={(evento) => {
                    setResposta(evento.target.value);
                  }}
                />
                <button type="submit" className="primario" disabled={resposta.trim() === ""}>
                  Enviar
                </button>
              </form>
            ) : (
              <p className="discreto compor-desligado">
                {conversa.controle === "agent"
                  ? "O agent está atendendo esta conversa."
                  : conversa.controle === "aguardando"
                    ? "Assuma o atendimento para responder."
                    : "Outro analista está atendendo esta conversa."}
              </p>
            )}
          </>
        )}
      </section>

      <aside className="painel">
        {detalhe !== null && (
          <>
            <h3>Chamados de {detalhe.pessoa.nome}</h3>
            {detalhe.chamados.length === 0 ? (
              <p className="discreto">Nenhum chamado.</p>
            ) : (
              detalhe.chamados.map((chamado) => (
                <CartaoDeChamado key={chamado.id} chamado={chamado} />
              ))
            )}
          </>
        )}
      </aside>
    </div>
  );
}
