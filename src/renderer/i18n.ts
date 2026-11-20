// Textos da interface (pt-BR padrão) e formatação de hora no fuso do navegador.

import type { Status } from '@shared/types';

const ptBR = {
  'status.available': 'Disponível',
  'status.working': 'Trabalhando agora',
  'status.waiting': 'Esperando você',
  'status.problem': 'Com problema',
  'legend.available': 'Disponível · na recarga',
  'legend.working': 'Trabalhando agora',
  'legend.waiting': 'Esperando você · na área amarela',
  'legend.problem': 'Com problema · dá para tentar de novo',
  'legend.next': '⏰ = próxima rotina agendada do bot',
  'legend.hint': 'Arrastar: girar · Espaço+arrastar: mover · rolagem: zoom · duplo clique: focar. Clique num bot para ver a conversa e responder. Na lista, passe o mouse num bot para escolher a skin, baixar a imagem ou mandar mensagem. Clique na mesa de um departamento para falar com o grupo dele: os bots se reúnem nela para responder.',
  live: 'ao vivo',
  offline: 'sem ligação',
  replay: 'Repetir últimas falas',
  title: 'Sala 3D',
  bots: 'Bots',
  all: 'Todos',
  viewAll: 'Ver tudo',
  timeline: 'Linha do tempo',
  'timeline.empty': 'Nada nos últimos 30 minutos.',
  settings: 'Configurações',
  connections: 'Conexões',
  'chat.empty': 'Ainda não há conversa com este bot.',
  'chat.placeholder': 'Mensagem...',
  'chat.readonly': 'Esta plataforma não aceita mensagens pela sala.',
  'chat.you': 'Você',
  'ask.pending': 'Pergunta pendente: ',
  'ask.default': 'este bot precisa de uma resposta sua.',
  'ask.yes': 'Sim, pode seguir',
  'ask.no': 'Não, não faça isso',
  'ask.explain': 'Me explique melhor antes',
  'ask.signin': 'Este bot espera você entrar numa conta',
  'ask.secret': 'Este bot espera uma chave ou senha',
  'ask.secure': '. Isso só pode ser feito no próprio app da plataforma — senha, chave e código nunca passam pela sala.',
  'problem.default': 'A última tarefa deste bot falhou.',
  retry: 'Tentar de novo',
  'next.routine': '⏰ Próxima rotina: ',
  'dept.title': 'Falar com um departamento',
  'dept.sub': 'A mensagem vai para todos os bots escolhidos',
  'dept.empty': 'Escolha o departamento e escreva. Cada bot dele recebe a mesma mensagem.',
  'group.empty': 'Nada dito neste grupo na última meia hora. Escreva e os bots se reúnem na mesa para responder.',
  close: 'Fechar',
  send: 'Enviar',
  skinOf: 'Skin de ',
  noSkin: 'Sem skin',
  chooseSkin: 'Escolher skin',
  download: 'Baixar a imagem deste bot',
  message: 'Enviar mensagem',
  chief: 'Chefe de equipe',
  fullscreen: 'Tela cheia (tecla F)',
  fullscreenExit: 'Sair da tela cheia (tecla F ou Esc)',
  viewRoom: 'Ver a sala inteira',
  zone: 'AGUARDANDO VOCÊ',
  dock: 'RECARGA',
} as const;

export type TKey = keyof typeof ptBR;
const dict: Record<string, string> = ptBR;
export const t = (k: TKey): string => dict[k] ?? k;
export const statusText = (s: Status) => t(('status.' + s) as TKey);

let tz: string | undefined;
export function setTimeZone(z: string | undefined) {
  tz = z || undefined;
}
const opt = (o: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => (tz ? { ...o, timeZone: tz } : o);
export const hm = (at: number) => new Date(at).toLocaleTimeString('pt-BR', opt({ hour: '2-digit', minute: '2-digit' }));
export const hms = (at: number) => new Date(at).toLocaleTimeString('pt-BR', opt({}));
export const dayTime = (at?: number) => (at ? new Date(at).toLocaleString('pt-BR', opt({ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : 'agora');
