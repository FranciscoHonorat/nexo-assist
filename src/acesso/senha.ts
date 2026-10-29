import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const ALGORITMO = "scrypt";
const TAMANHO_DO_SAL = 16;
const TAMANHO_DA_CHAVE = 32;

function derivar(senha: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, TAMANHO_DA_CHAVE, (erro, chave) => {
      if (erro) rejeitar(erro);
      else resolver(chave);
    });
  });
}

export async function protegerSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_DO_SAL);
  const chave = await derivar(senha, sal);
  return [ALGORITMO, sal.toString("base64url"), chave.toString("base64url")].join("$");
}

export async function conferirSenha(senha: string, guardada: string): Promise<boolean> {
  const [algoritmo, sal, chave] = guardada.split("$");
  if (algoritmo !== ALGORITMO || sal === undefined || chave === undefined) return false;
  const esperada = Buffer.from(chave, "base64url");
  if (esperada.length !== TAMANHO_DA_CHAVE) return false;
  const derivada = await derivar(senha, Buffer.from(sal, "base64url"));
  return timingSafeEqual(derivada, esperada);
}
