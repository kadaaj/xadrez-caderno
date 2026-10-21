/**
 * Sons sintetizados com Web Audio (sem arquivos): batida de peça de madeira
 * sobre a mesa, risco de caneta na captura e dois toques no xeque.
 */
export type TipoSom = 'lance' | 'captura' | 'xeque' | 'fim' | 'invalido';

export class Som {
  ligado = true;
  private ctx: AudioContext | null = null;
  private ruido: AudioBuffer | null = null;

  private contexto(): AudioContext | null {
    if (!this.ligado) return null;
    try {
      if (!this.ctx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return null;
        this.ctx = new C();
        const n = this.ctx.sampleRate;
        this.ruido = this.ctx.createBuffer(1, n, n);
        const d = this.ruido.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < n; i++) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          d[i] = (s / 0x7fffffff) * 2 - 1;
        }
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private batida(ctx: AudioContext, t: number, freq: number, vol: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.13);
    this.chiado(ctx, t, 0.03, 2400, vol * 0.5, 1.2);
  }

  private chiado(ctx: AudioContext, t: number, dur: number, freq: number, vol: number, q: number): void {
    if (!this.ruido) return;
    const s = ctx.createBufferSource();
    s.buffer = this.ruido;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  tocar(tipo: TipoSom): void {
    const ctx = this.contexto();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (tipo) {
      case 'lance':
        this.batida(ctx, t, 340, 0.22);
        break;
      case 'captura':
        this.batida(ctx, t, 300, 0.22);
        // risco de caneta: rajadas curtas de ruído agudo
        for (let i = 0; i < 5; i++) this.chiado(ctx, t + 0.05 + i * 0.055, 0.05, 3200 + i * 180, 0.09, 2.5);
        break;
      case 'xeque':
        this.batida(ctx, t, 520, 0.16);
        this.batida(ctx, t + 0.11, 620, 0.14);
        break;
      case 'fim':
        this.batida(ctx, t, 392, 0.15);
        this.batida(ctx, t + 0.14, 330, 0.15);
        this.batida(ctx, t + 0.28, 262, 0.17);
        break;
      case 'invalido':
        this.chiado(ctx, t, 0.08, 900, 0.08, 4);
        break;
    }
  }
}
