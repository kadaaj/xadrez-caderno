/**
 * Ferramentas de "traço de caneta": aleatoriedade com semente fixa e
 * geradores de caminhos SVG levemente irregulares. Como a semente é fixa,
 * o mesmo desenho sai idêntico em toda renderização (sem tremulação).
 */

export type Ponto = [number, number] | [number, number, 1]; // 1 = canto (sem suavizar)

export function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
export function gerador(seed: number | string): () => number {
  let a = typeof seed === 'string' ? semente(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const n = (v: number) => Math.round(v * 10) / 10;

/** Valor em [-amp, amp]. */
export function variar(rng: () => number, amp: number): number {
  return (rng() * 2 - 1) * amp;
}

/**
 * Curva suave (Catmull-Rom → Bézier) passando pelos pontos, com tremor leve.
 * Pontos marcados como canto mantêm a quina.
 */
export function curva(pontos: Ponto[], rng: () => number, tremor = 0.6, fechada = true): string {
  const p = pontos.map((q) => [q[0] + variar(rng, tremor), q[1] + variar(rng, tremor), q[2] ?? 0]);
  const tam = p.length;
  const ponto = (i: number) => (fechada ? p[(i + tam) % tam] : p[Math.max(0, Math.min(tam - 1, i))]);
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  const segs = fechada ? tam : tam - 1;
  const k = 1 / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = ponto(i - 1);
    const p1 = ponto(i);
    const p2 = ponto(i + 1);
    const p3 = ponto(i + 2);
    const c1 = p1[2] ? [p1[0], p1[1]] : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = p2[2] ? [p2[0], p2[1]] : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return fechada ? d + 'Z' : d;
}

/** Linha à mão: leve curvatura e pontas imprecisas. */
export function linha(x1: number, y1: number, x2: number, y2: number, rng: () => number, amp = 1.2): string {
  const ax = x1 + variar(rng, amp * 0.6);
  const ay = y1 + variar(rng, amp * 0.6);
  const bx = x2 + variar(rng, amp * 0.6);
  const by = y2 + variar(rng, amp * 0.6);
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const bojo = variar(rng, amp) * Math.min(1, len / 120) * 1.6;
  const t = 0.35 + rng() * 0.3;
  const cx = ax + dx * t - (dy / len) * bojo;
  const cy = ay + dy * t + (dx / len) * bojo;
  return `M${n(ax)} ${n(ay)} Q${n(cx)} ${n(cy)} ${n(bx)} ${n(by)}`;
}

/** Círculo à mão: raio oscilante e final que ultrapassa o início. */
export function circulo(cx: number, cy: number, r: number, rng: () => number, volta = 1.08, tremor = 0.05): string {
  const passos = 14;
  const inicio = rng() * Math.PI * 2;
  const pts: Ponto[] = [];
  const total = Math.round(passos * volta);
  for (let i = 0; i <= total; i++) {
    const a = inicio + (i / passos) * Math.PI * 2;
    const rr = r * (1 + variar(rng, tremor)) * (1 - (i / total) * 0.04);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return curva(pts, rng, 0, false);
}

/** Pontos de um círculo (para usar como contorno fechado). */
export function pontosCirculo(cx: number, cy: number, r: number, passos = 12): Ponto[] {
  const pts: Ponto[] = [];
  for (let i = 0; i < passos; i++) {
    const a = (i / passos) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Espelha meio contorno (do centro do topo, descendo pela direita) para formar o contorno inteiro. */
export function espelhar(metade: Ponto[], eixo = 50): Ponto[] {
  const esquerda = metade
    .slice(1, -1)
    .reverse()
    .map((p) => (p[2] ? ([2 * eixo - p[0], p[1], 1] as Ponto) : ([2 * eixo - p[0], p[1]] as Ponto)));
  return [...metade, ...esquerda];
}

/**
 * Hachura: linhas paralelas cobrindo um retângulo, cortadas nas bordas
 * (Liang–Barsky) com pontas imprecisas.
 */
export function hachura(
  x: number,
  y: number,
  w: number,
  h: number,
  angulo: number,
  espaco: number,
  rng: () => number,
  opcoes: { recuo?: number; tremor?: number; falha?: number } = {},
): string {
  const recuo = opcoes.recuo ?? 0;
  const tremor = opcoes.tremor ?? 1;
  const falha = opcoes.falha ?? 0;
  const x0 = x + recuo;
  const y0 = y + recuo;
  const x1 = x + w - recuo;
  const y1 = y + h - recuo;
  const a = (angulo * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // normal
  const nx = -dy;
  const ny = dx;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const raio = Math.hypot(x1 - x0, y1 - y0) / 2;
  let d = '';
  for (let off = -raio + espaco * rng(); off < raio; off += espaco * (0.85 + rng() * 0.3)) {
    const px = cx + nx * off;
    const py = cy + ny * off;
    // recorte da reta px + t*dx, py + t*dy no retângulo
    let t0 = -Infinity;
    let t1 = Infinity;
    const lados: [number, number][] = [
      [-dx, px - x0],
      [dx, x1 - px],
      [-dy, py - y0],
      [dy, y1 - py],
    ];
    let fora = false;
    for (const [p, q] of lados) {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) fora = true;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    if (fora || t0 >= t1) continue;
    if (falha && rng() < falha) continue;
    const ini = t0 + rng() * 2.2 * tremor;
    const fim = t1 - rng() * 2.2 * tremor;
    if (fim - ini < 2) continue;
    const ax = px + dx * ini + variar(rng, 0.5 * tremor);
    const ay = py + dy * ini + variar(rng, 0.5 * tremor);
    const bx = px + dx * fim + variar(rng, 0.5 * tremor);
    const by = py + dy * fim + variar(rng, 0.5 * tremor);
    const mx = (ax + bx) / 2 + variar(rng, 0.6 * tremor);
    const my = (ay + by) / 2 + variar(rng, 0.6 * tremor);
    d += `M${n(ax)} ${n(ay)}Q${n(mx)} ${n(my)} ${n(bx)} ${n(by)}`;
  }
  return d;
}

/** Rabisco em zigue-zague (usado para "riscar" peças capturadas). */
export function rabisco(cx: number, cy: number, larg: number, alt: number, rng: () => number, voltas = 6): string {
  const pts: Ponto[] = [];
  for (let i = 0; i <= voltas * 2; i++) {
    const t = i / (voltas * 2);
    const x = cx - larg / 2 + t * larg + variar(rng, 3);
    const y = cy + (i % 2 === 0 ? -alt / 2 : alt / 2) + variar(rng, 4);
    pts.push([x, y]);
  }
  return curva(pts, rng, 0.5, false);
}

/** Oval à mão (como `circulo`, mas com raios diferentes). */
export function oval(cx: number, cy: number, rx: number, ry: number, rng: () => number, volta = 1.08, tremor = 0.05): string {
  const passos = 14;
  const inicio = rng() * Math.PI * 2;
  const pts: Ponto[] = [];
  const total = Math.round(passos * volta);
  for (let i = 0; i <= total; i++) {
    const a = inicio + (i / passos) * Math.PI * 2;
    const k = 1 + variar(rng, tremor);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return curva(pts, rng, 0, false);
}
