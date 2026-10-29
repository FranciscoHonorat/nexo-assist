import { novaConversa } from "../../domain/conversa.js";
import { sucesso } from "../../domain/resultado.js";
import type { Banco } from "../../infraestrutura/banco.js";
import type { Conversas } from "../conversas.js";
import { conversas } from "./esquema.js";

export function conversasPostgres(db: Banco): Conversas {
  return {
    atual: async (dono) => {
      await db.insert(conversas).values({ dono, controle: "agent" }).onConflictDoNothing();
      return sucesso({ conversa: novaConversa({ dono }), mensagensNaSessao: 0 });
    },
  };
}
