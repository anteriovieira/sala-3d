// "O que está fazendo": rótulo curto ("Navegando na web") fica no rótulo do bot;
// frase de conversa (comentário longo vindo da plataforma) vira balão de fala.

const MAX_LABEL = 28;

export function splitDoing(doing: string | undefined): { label?: string; speech?: string } {
  const d = (doing || '').trim();
  if (!d) return {};
  const sentence = d.length > MAX_LABEL || /[.!?:…]\s|[.!?…]$/.test(d);
  return sentence ? { speech: d } : { label: d };
}
