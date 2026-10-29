import type { Artigo } from "./central-de-ajuda.js";

export const ARTIGOS: readonly Artigo[] = [
  {
    id: "KB-001",
    titulo: "VPN com erro 809",
    conteudo:
      "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
  },
  {
    id: "KB-002",
    titulo: "Horário do service desk",
    conteudo: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
  },
  {
    id: "KB-003",
    titulo: "Senha bloqueada no SAP ou na rede",
    conteudo:
      "Depois de 5 tentativas erradas a senha é bloqueada por 30 minutos. Para desbloquear na hora, use a opção Esqueci minha senha no portal de acesso, com o código enviado ao celular cadastrado.",
  },
  {
    id: "KB-004",
    titulo: "Caixa de e-mail cheia",
    conteudo:
      "A caixa de e-mail tem 50 GB. Apague mensagens grandes da pasta Itens enviados e esvazie a lixeira. Para ampliar a cota, peça uma requisição na categoria E-mail.",
  },
  {
    id: "KB-005",
    titulo: "Instalar um software homologado",
    conteudo:
      "Softwares homologados são instalados pelo portal de softwares, sem chamado. Um software fora da lista precisa de uma requisição com a justificativa e a aprovação do gestor.",
  },
  {
    id: "KB-006",
    titulo: "Notebook lento",
    conteudo:
      "Reinicie o notebook, feche abas e programas que não estiver usando e confira se há atualizações do Windows pendentes. Se continuar lento depois de reiniciar, abra um chamado de hardware.",
  },
  {
    id: "KB-007",
    titulo: "Autenticação em dois fatores num celular novo",
    conteudo:
      "Ao trocar de celular, instale o aplicativo autenticador e leia o QR code no portal de acesso, ainda com o celular antigo. Sem o celular antigo, um analista precisa redefinir o segundo fator.",
  },
  {
    id: "KB-008",
    titulo: "Wi-Fi para visitantes",
    conteudo:
      "A rede Nexo-Visitantes tem senha diária, mostrada na recepção. Ela não dá acesso aos sistemas internos; para isso, use a VPN.",
  },
];
