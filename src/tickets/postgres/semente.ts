import { sql } from "drizzle-orm";
import type { Chamado } from "../../domain/chamado.js";
import type { Banco } from "../../infraestrutura/banco.js";
import { chamados, complementos } from "./esquema.js";

export function semearChamados(db: Banco, iniciais: readonly Chamado[]): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${chamados} IN EXCLUSIVE MODE`);
    if ((await tx.$count(chamados)) > 0) return 0;
    for (const chamado of iniciais) {
      await tx.insert(chamados).values({
        id: chamado.id,
        dono: chamado.dono,
        ...chamado.dados,
        status: chamado.status,
        criadoEm: chamado.criadoEm,
        atualizadoEm: chamado.atualizadoEm,
      });
      for (const complemento of chamado.complementos) {
        await tx.insert(complementos).values({ chamadoId: chamado.id, ...complemento });
      }
    }
    return iniciais.length;
  });
}
