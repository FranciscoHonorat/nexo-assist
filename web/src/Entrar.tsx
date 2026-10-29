import { useState, type SyntheticEvent } from "react";
import { api, ErroDeApi } from "./api.js";
import type { Pessoa } from "./logica/tipos.js";

export function Entrar({ aoEntrar }: { readonly aoEntrar: (pessoa: Pessoa) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (evento: SyntheticEvent) => {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      aoEntrar((await api.entrar(email, senha)).pessoa);
    } catch (falha) {
      setErro(
        falha instanceof ErroDeApi && falha.status === 401
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar agora. Tente de novo.",
      );
    } finally {
      setEntrando(false);
    }
  };

  return (
    <main className="entrada">
      <section className="vitrine">
        <p className="marca">Nexo Assist</p>
        <p className="discreto-claro">Service desk de TI da Nexo</p>
        <h1>Seu problema de TI, resolvido em uma conversa.</h1>
        <p className="discreto-claro">
          Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de
          ajuda e chama um analista quando precisa.
        </p>
      </section>
      <section className="formulario">
        <form onSubmit={(evento) => void entrar(evento)}>
          <h2>Entrar</h2>
          <p className="discreto">Use seu e-mail corporativo e a senha da rede Nexo.</p>
          <label>
            E-mail corporativo
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(evento) => {
                setEmail(evento.target.value);
              }}
              placeholder="nome@nexo.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(evento) => {
                setSenha(evento.target.value);
              }}
            />
          </label>
          {erro !== null && (
            <p className="aviso" role="alert">
              {erro}
            </p>
          )}
          <button type="submit" className="primario" disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>
          <p className="discreto">Problema para entrar? Ligue no ramal 4000.</p>
        </form>
      </section>
    </main>
  );
}
