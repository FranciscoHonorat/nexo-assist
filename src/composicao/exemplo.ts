import type { PessoaCadastrada } from "../acesso/diretorio.js";
import type { Chamado, DadosDoChamado } from "../domain/chamado.js";
import { DIA, HORA } from "../domain/tempo.js";
import { lerTicketId } from "../domain/ticket-id.js";
import { lerUserId, type UserId } from "../domain/user-id.js";

export const SENHA_DE_DEMONSTRACAO = "nexo-demo-2026";

export const PESSOAS_DE_EXEMPLO: readonly PessoaCadastrada[] = [
  {
    email: "ana.souza@nexo.com",
    nome: "Ana Souza",
    area: "Financeiro",
    papel: "funcionario",
    senha: "scrypt$Hp_C75kFQ9BeqsXLG6yHsw$BNnYmJDdoKMUprnFxhYdqRiAXu5GcW3K_F83T3o36g0",
  },
  {
    email: "carla.mendes@nexo.com",
    nome: "Carla Mendes",
    area: "Comercial",
    papel: "funcionario",
    senha: "scrypt$wvAHau0z3E6uQ02vY6qeqQ$WYi_WWJmKTKCiHpVhPi-47cD_RZU1DHYnuwwfeUnANs",
  },
  {
    email: "diego.ramos@nexo.com",
    nome: "Diego Ramos",
    area: "Operações",
    papel: "funcionario",
    senha: "scrypt$ntg7Akbly2uRUr2Gwp-qnQ$SiKGEBaoSltxDszSESLbYjTWbA5p6DIM7hNSfJWckYo",
  },
  {
    email: "rafael.lima@nexo.com",
    nome: "Rafael Lima",
    area: "Suporte N2",
    papel: "analista",
    senha: "scrypt$eYmXU33v03HmAeYqMbNfUA$7k1DDmU9OcnQv0U35EV7--ALzS_MToZL8zp2L8V5NgQ",
  },
  {
    email: "bruno.tavares@nexo.com",
    nome: "Bruno Tavares",
    area: "Suporte N1",
    papel: "analista",
    senha: "scrypt$3SLYmVb_Q1xP4mkv7JbKFw$6M4b4aVWBHQQrUQW_GhVVWx7c0jPQo4D137Z4RqVRYU",
  },
];

export function chamadosDeExemplo(agora: Date): readonly Chamado[] {
  const ha = (tempo: number) => new Date(agora.getTime() - tempo);
  const ana = id("ana.souza@nexo.com");
  const carla = id("carla.mendes@nexo.com");
  return [
    chamado("INC-20311", ana, notebookLento, "aguardando_analista", ha(9 * DIA), ha(6 * DIA)),
    chamado("INC-20298", ana, pastaFinanceiro, "aberto", ha(2 * DIA), ha(3 * HORA)),
    chamado("REQ-10442", ana, segundoMonitor, "aprovado", ha(12 * DIA), ha(3 * DIA)),
    chamado("INC-20150", ana, senhaDoSap, "resolvido", ha(10 * DIA), ha(4 * DIA)),
    chamado("REQ-10450", carla, acessoAoSap, "aberto", ha(5 * HORA), ha(5 * HORA)),
  ];
}

const notebookLento: DadosDoChamado = {
  titulo: "Notebook lento após atualização do Windows",
  descricao: "Lentidão geral desde a atualização. Reiniciar e rodar o diagnóstico não resolveu.",
  tipo: "incidente",
  categoria: "hardware",
  prioridade: "media",
  afetados: "so_eu",
};

const pastaFinanceiro: DadosDoChamado = {
  titulo: "Acesso à pasta Financeiro no SharePoint",
  descricao: "Perdi o acesso de edição à pasta Financeiro depois da troca de gestor.",
  tipo: "incidente",
  categoria: "acesso",
  prioridade: "media",
  afetados: "so_eu",
};

const segundoMonitor: DadosDoChamado = {
  titulo: "Segundo monitor para home office",
  descricao: "Preciso de um segundo monitor para trabalhar de casa.",
  tipo: "requisicao",
  categoria: "hardware",
  prioridade: "baixa",
  afetados: "so_eu",
};

const senhaDoSap: DadosDoChamado = {
  titulo: "Senha do SAP bloqueada",
  descricao: "A senha do SAP bloqueou depois de três tentativas.",
  tipo: "incidente",
  categoria: "acesso",
  prioridade: "media",
  afetados: "so_eu",
};

const acessoAoSap: DadosDoChamado = {
  titulo: "Acesso ao SAP para a equipe comercial",
  descricao: "Duas pessoas novas da equipe precisam de acesso ao SAP ainda hoje.",
  tipo: "requisicao",
  categoria: "acesso",
  prioridade: "alta",
  afetados: "minha_equipe",
};

function chamado(
  numero: string,
  dono: UserId,
  dados: DadosDoChamado,
  status: Chamado["status"],
  criadoEm: Date,
  atualizadoEm: Date,
): Chamado {
  const lido = lerTicketId(numero);
  if (!lido.ok) throw new Error(`número de exemplo inválido: ${numero}`);
  return { id: lido.valor, dono, dados, status, criadoEm, atualizadoEm, complementos: [] };
}

function id(email: string): UserId {
  const lido = lerUserId(email);
  if (!lido.ok) throw new Error(`e-mail de exemplo inválido: ${email}`);
  return lido.valor;
}
