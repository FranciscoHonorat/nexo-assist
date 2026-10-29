import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Chat } from "./chat/Chat.js";
import { Console } from "./console/Console.js";
import { Entrar } from "./Entrar.js";
import type { Pessoa } from "./logica/tipos.js";

type Acesso =
  | { readonly fase: "carregando" }
  | { readonly fase: "fora" }
  | { readonly fase: "dentro"; readonly pessoa: Pessoa };

export function App() {
  const [acesso, setAcesso] = useState<Acesso>({ fase: "carregando" });

  useEffect(() => {
    api
      .eu()
      .then(({ pessoa }) => {
        setAcesso({ fase: "dentro", pessoa });
      })
      .catch(() => {
        setAcesso({ fase: "fora" });
      });
  }, []);

  switch (acesso.fase) {
    case "carregando":
      return <p className="vazio">Carregando…</p>;
    case "fora":
      return (
        <Entrar
          aoEntrar={(pessoa) => {
            setAcesso({ fase: "dentro", pessoa });
          }}
        />
      );
    case "dentro": {
      const { pessoa } = acesso;
      return (
        <div className="app">
          <header className="barra">
            <span className="marca">Nexo Assist</span>
            <span className="discreto">
              {pessoa.papel === "analista" ? "Console do analista" : "Atendimento"}
            </span>
            <span className="pessoa">
              <strong>{pessoa.nome}</strong>
              <span className="discreto">{pessoa.id}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                void api.sair().finally(() => {
                  setAcesso({ fase: "fora" });
                });
              }}
            >
              Sair
            </button>
          </header>
          {pessoa.papel === "analista" ? <Console eu={pessoa} /> : <Chat />}
        </div>
      );
    }
  }
}
