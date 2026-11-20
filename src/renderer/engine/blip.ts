// Som curto de fala, tocado por um <audio> com WAV gerado aqui.
// Não usa WebAudio: em alguns Macs `new AudioContext()` bloqueia a página por ~20 s (a sala congelava no
// primeiro clique). O elemento <audio> abre o áudio fora da thread da página, então nada trava.

let url: string | null = null;

/** Varredura 620 → 940 Hz em 0,24 s, com entrada e saída suaves (o mesmo "blip" da sala antiga). */
function makeWav(): string {
  const rate = 22050, dur = 0.26, n = Math.floor(rate * dur);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = t < 0.09 ? 620 * Math.pow(940 / 620, t / 0.09) : 940;
    phase += (2 * Math.PI * f) / rate;
    const env = t < 0.02 ? t / 0.02 : Math.max(0, Math.exp(-(t - 0.02) * 22));
    v.setInt16(44 + i * 2, Math.round(Math.sin(phase) * env * 0.07 * 32767 * 4), true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

export function playBlip(): void {
  try {
    url ??= makeWav();
    const a = new Audio(url);
    a.volume = 0.6;
    void a.play().catch(() => { /* sem permissão ou sem saída de som */ });
  } catch { /* sem som */ }
}
