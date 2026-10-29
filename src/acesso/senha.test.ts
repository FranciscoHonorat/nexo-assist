import { describe, expect, it } from "vitest";
import { conferirSenha, protegerSenha } from "./senha.js";

describe("Senha guardada só como hash", () => {
  it("Dado uma senha protegida, Então a mesma senha confere e o hash não contém a senha", async () => {
    const hash = await protegerSenha("nexo-2026");

    expect(hash).not.toContain("nexo-2026");
    expect(await conferirSenha("nexo-2026", hash)).toBe(true);
  });

  it("Dado uma senha protegida, Então outra senha não confere", async () => {
    expect(await conferirSenha("nexo-2027", await protegerSenha("nexo-2026"))).toBe(false);
  });

  it("Dado a mesma senha protegida duas vezes, Então os hashes são diferentes, por causa do sal", async () => {
    expect(await protegerSenha("nexo-2026")).not.toEqual(await protegerSenha("nexo-2026"));
  });

  it.each(["", "texto-qualquer", "scrypt$x$y", "scrypt$00$zz"])(
    "Dado um hash fora do formato (%j), Então nenhuma senha confere",
    async (hash) => {
      expect(await conferirSenha("nexo-2026", hash)).toBe(false);
    },
  );
});
