import { CATEGORIA, PRIORIDADE, STATUS_DO_CHAMADO } from "../logica/rotulos.js";
import type { ChamadoDaApi } from "../logica/tipos.js";
import { dataEHora } from "./formato.js";

export function CartaoDeChamado({ chamado }: { readonly chamado: ChamadoDaApi }) {
  return (
    <article className="cartao">
      <header className="cartao-topo">
        <span className="id">{chamado.id}</span>
        <span className={`selo selo-${chamado.status}`}>{STATUS_DO_CHAMADO[chamado.status]}</span>
      </header>
      <h4>{chamado.dados.titulo}</h4>
      <p className="discreto">{chamado.dados.descricao}</p>
      <dl className="campos">
        <div>
          <dt>Categoria</dt>
          <dd>{CATEGORIA[chamado.dados.categoria]}</dd>
        </div>
        <div>
          <dt>Prioridade</dt>
          <dd>{PRIORIDADE[chamado.dados.prioridade]}</dd>
        </div>
        <div>
          <dt>Última atualização</dt>
          <dd>{dataEHora(chamado.atualizadoEm)}</dd>
        </div>
      </dl>
    </article>
  );
}
