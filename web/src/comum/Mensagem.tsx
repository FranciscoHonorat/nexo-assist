import { useState } from "react";
import { acoesDoTurno, AFETADOS, CATEGORIA, PRIORIDADE, textoDoEvento } from "../logica/rotulos.js";
import type { MensagemDaApi, Nomes, RascunhoDaApi, RegistroDaApi } from "../logica/tipos.js";
import { CartaoDeChamado } from "./CartaoDeChamado.js";
import { dataEHora, hora } from "./formato.js";

export type AcoesDaMensagem = {
  readonly escolher: (opcao: string) => void;
  readonly confirmar: (rascunho: string) => void;
  readonly descartar: (rascunho: string) => void;
};

type Props = {
  readonly mensagem: MensagemDaApi;
  readonly nomes: Nomes;
  readonly interativa: boolean;
  readonly rascunhoResolvido: boolean;
  readonly acoes?: AcoesDaMensagem;
};

export function Mensagem({ mensagem, nomes, interativa, rascunhoResolvido, acoes }: Props) {
  switch (mensagem.autor) {
    case "funcionario":
      return (
        <div className="linha linha-funcionario">
          <div className="balao balao-funcionario">{mensagem.texto}</div>
          <time>{hora(mensagem.enviadaEm)}</time>
        </div>
      );
    case "analista":
      return (
        <div className="linha">
          <div className="autor">
            {nomes[mensagem.analista] ?? mensagem.analista}{" "}
            <span className="discreto">· analista</span>
          </div>
          <div className="balao balao-analista">{mensagem.texto}</div>
          <time>{hora(mensagem.enviadaEm)}</time>
        </div>
      );
    case "sistema":
      return (
        <div className="evento" role="status">
          {textoDoEvento(mensagem.evento, nomes)} · {hora(mensagem.enviadaEm)}
        </div>
      );
    case "agent":
      return (
        <RespostaDoAgent
          texto={mensagem.texto}
          enviadaEm={mensagem.enviadaEm}
          registro={mensagem.registro}
          interativa={interativa}
          rascunhoResolvido={rascunhoResolvido}
          {...(acoes === undefined ? {} : { acoes })}
        />
      );
  }
}

function RespostaDoAgent({
  texto,
  enviadaEm,
  registro,
  interativa,
  rascunhoResolvido,
  acoes,
}: {
  readonly texto: string;
  readonly enviadaEm: string;
  readonly registro: RegistroDaApi;
  readonly interativa: boolean;
  readonly rascunhoResolvido: boolean;
  readonly acoes?: AcoesDaMensagem;
}) {
  const [aberto, setAberto] = useState(false);
  const { anexos } = registro;
  return (
    <div className="linha">
      <div className="autor">Nexo Assist</div>
      <ul className="acoes-do-agent">
        {acoesDoTurno(registro).map((acao) => (
          <li key={acao}>{acao}</li>
        ))}
      </ul>
      <div className="balao balao-agent">{texto}</div>
      {anexos.chamados.map((chamado) => (
        <CartaoDeChamado key={chamado.id} chamado={chamado} />
      ))}
      {anexos.rascunho !== null && (
        <CartaoDoRascunho
          proposto={anexos.rascunho}
          resolvido={rascunhoResolvido || acoes === undefined}
          {...(acoes === undefined ? {} : { acoes })}
        />
      )}
      {interativa && acoes !== undefined && anexos.opcoes.length > 0 && (
        <div className="opcoes">
          {anexos.opcoes.map((opcao) => (
            <button
              key={opcao}
              type="button"
              className="opcao"
              onClick={() => {
                acoes.escolher(opcao);
              }}
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="como-decidiu"
        aria-expanded={aberto}
        onClick={() => {
          setAberto(!aberto);
        }}
      >
        {aberto ? "Esconder" : "Como o agent decidiu"} · confiança {registro.confianca}
      </button>
      {aberto && <ComoDecidiu registro={registro} />}
      <time>{hora(enviadaEm)}</time>
    </div>
  );
}

function ComoDecidiu({ registro }: { readonly registro: RegistroDaApi }) {
  const { declaracao, transferencia, trace } = registro;
  return (
    <section className="decisao" aria-label="Como o agent decidiu">
      {declaracao === null ? (
        <p className="discreto">
          O modelo não declarou o que entendeu; o código respondeu com uma mensagem fixa.
        </p>
      ) : (
        <dl className="campos">
          <div>
            <dt>Entendeu</dt>
            <dd>{declaracao.entendeu}</dd>
          </div>
          <div>
            <dt>Confiança</dt>
            <dd>{declaracao.confianca}</dd>
          </div>
          <div>
            <dt>Por quê</dt>
            <dd>{declaracao.porque}</dd>
          </div>
        </dl>
      )}
      {transferencia !== null && (
        <p>
          <strong>Resumo para o analista:</strong> {transferencia.resumo}
        </p>
      )}
      <ol className="trace">
        {trace.map((passo, indice) => (
          <li key={indice} className={`passo passo-${passo.resultado}`}>
            <span className="passo-etapa">
              {passo.etapa === "resposta" ? "resposta" : passo.nome}
            </span>
            <span className="passo-resultado">{passo.resultado}</span>
            <span className="passo-detalhe">{passo.detalhe}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CartaoDoRascunho({
  proposto,
  resolvido,
  acoes,
}: {
  readonly proposto: RascunhoDaApi;
  readonly resolvido: boolean;
  readonly acoes?: AcoesDaMensagem;
}) {
  const { rascunho } = proposto;
  const conteudo = rascunho.conteudo;
  return (
    <article className="cartao cartao-rascunho">
      <header className="cartao-topo">
        <span>
          {conteudo.tipo === "novo_chamado" ? "Novo chamado" : `Complemento de ${conteudo.chamado}`}
        </span>
        <span className={resolvido ? "selo selo-sucesso" : "selo selo-aguardando"}>
          {resolvido ? "Resolvido" : "Aguardando confirmação"}
        </span>
      </header>
      {conteudo.tipo === "novo_chamado" ? (
        <>
          <h4>{conteudo.dados.titulo}</h4>
          <p className="discreto">{conteudo.dados.descricao}</p>
          <dl className="campos">
            <div>
              <dt>Categoria</dt>
              <dd>{CATEGORIA[conteudo.dados.categoria]}</dd>
            </div>
            <div>
              <dt>Prioridade</dt>
              <dd>
                {PRIORIDADE[conteudo.dados.prioridade]}
                {"prazo" in proposto && <> · resposta até {dataEHora(proposto.prazo)}</>}
              </dd>
            </div>
            <div>
              <dt>Afetados</dt>
              <dd>{AFETADOS[conteudo.dados.afetados]}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p>{conteudo.texto}</p>
      )}
      {!resolvido && acoes !== undefined && (
        <div className="botoes">
          <button
            type="button"
            className="primario"
            onClick={() => {
              acoes.confirmar(rascunho.id);
            }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              acoes.descartar(rascunho.id);
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}
