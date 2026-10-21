/**
 * "Lápis de cor": preenchimento com hachuras, contorno trêmulo e carinhas.
 * Tudo com semente fixa — o desenho sai sempre igual.
 */
import { curva, gerador, hachura, n, variar, type Ponto } from './traco.ts';

export interface Tinta {
  base: string; // tom de fundo (cobre o papel)
  traco: string; // cor das hachuras
  contorno: string; // cor do contorno
}

export interface OpcoesForma {
  ang?: number;
  esp?: number;
  opacidade?: number;
  cruzada?: boolean;
  contorno?: number; // largura (0 = sem contorno)
  tremor?: number;
  baseOpacidade?: number;
}

export interface OpcoesOlho {
  esc?: number;
  rx?: number;
  ry?: number;
  branco?: boolean; // esclera branca em volta da pupila
  esclera?: [number, number]; // raios absolutos da esclera (olho de coruja)
  pele?: string; // cor da pálpebra (a mesma do rosto)
  cor?: string;
  lado?: -1 | 1; // lado do rosto (define para onde aponta o > e a sobrancelha)
  sono?: boolean;
}

export function elipse(cx: number, cy: number, rx: number, ry: number, rot = 0, passos = 14): Ponto[] {
  const pts: Ponto[] = [];
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  for (let i = 0; i < passos; i++) {
    const a = (i / passos) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

function limites(pts: Ponto[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return { x0, y0, x1, y1 };
}

export class Desenho {
  private clips = '';
  private corpo = '';
  private contador = 0;
  readonly rng: () => number;
  private id: string;

  constructor(id: string) {
    this.id = id;
    this.rng = gerador(id);
  }

  /** Forma fechada pintada a lápis. */
  forma(pts: Ponto[], t: Tinta, o: OpcoesForma = {}): this {
    const rng = this.rng;
    const d = curva(pts, rng, o.tremor ?? 0.4, true);
    const b = limites(pts);
    const clip = `${this.id}-k${this.contador++}`;
    this.clips += `<clipPath id="${clip}"><path d="${d}"/></clipPath>`;
    const ang = o.ang ?? 62 + variar(rng, 6);
    const esp = o.esp ?? 2.3;
    const h1 = hachura(b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6, ang, esp, rng, { tremor: 0.7, falha: 0.06 });
    let somb = `<path d="${h1}" stroke="${t.traco}" stroke-width="1.25" opacity="${o.opacidade ?? 0.72}"/>`;
    if (o.cruzada !== false) {
      const h2 = hachura(b.x0 - 3, b.y0 - 3, b.x1 - b.x0 + 6, b.y1 - b.y0 + 6, ang - 75, esp * 1.9, rng, { tremor: 0.8, falha: 0.2 });
      somb += `<path d="${h2}" stroke="${t.traco}" stroke-width="1" opacity="${((o.opacidade ?? 0.72) * 0.45).toFixed(2)}"/>`;
    }
    this.corpo +=
      `<path d="${d}" fill="${t.base}" opacity="${o.baseOpacidade ?? 1}"/>` +
      `<g clip-path="url(#${clip})" fill="none" stroke-linecap="round">${somb}</g>`;
    const largura = o.contorno ?? 1.7;
    if (largura > 0) {
      const d2 = curva(pts, rng, (o.tremor ?? 0.4) + 0.5, true);
      this.corpo +=
        `<path d="${d}" fill="none" stroke="${t.contorno}" stroke-width="${largura}" stroke-linejoin="round" stroke-linecap="round"/>` +
        `<path d="${d2}" fill="none" stroke="${t.contorno}" stroke-width="${(largura * 0.45).toFixed(2)}" opacity="0.45"/>`;
    }
    return this;
  }

  /** Mancha lisa (sem hachura), útil para brilhos e bochechas. */
  mancha(pts: Ponto[], cor: string, opacidade = 1): this {
    this.corpo += `<path d="${curva(pts, this.rng, 0.2, true)}" fill="${cor}" opacity="${opacidade}"/>`;
    return this;
  }

  /** Traço aberto. */
  linha(pts: Ponto[], cor: string, largura = 1.6, opacidade = 1): this {
    this.corpo += `<path d="${curva(pts, this.rng, 0.25, false)}" fill="none" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacidade}"/>`;
    return this;
  }

  /** Markup cru (já pronto). */
  bruto(svg: string): this {
    this.corpo += svg;
    return this;
  }

  /**
   * Parte animável: tudo o que for desenhado dentro de `fn` fica num grupo
   * com papel e ponto de pivô próprios (o coreógrafo gira/desloca por papel).
   * Papéis: topo, braco, rabo, crina, cabeca, perna, pes, asa.
   */
  parte(papel: string, pivo: [number, number], fn: () => void, extra: { lado?: number; fase?: number; solta?: boolean } = {}): this {
    const lado = (extra.lado ? ` data-lado="${extra.lado}"` : '') + (extra.solta ? ' data-solta="1"' : '');
    const fase = extra.fase !== undefined ? ` data-fase="${extra.fase}"` : '';
    this.corpo += `<g class="parte p-${papel}" data-papel="${papel}"${lado}${fase} style="transform-origin:${n(pivo[0])}px ${n(pivo[1])}px">`;
    fn();
    this.corpo += '</g>';
    return this;
  }

  /** Grupo do rosto (os olhos e a boca ficam juntos para acompanhar o olhar). */
  rostoGrupo(fn: () => void): this {
    this.corpo += '<g class="rosto">';
    fn();
    this.corpo += '</g>';
    return this;
  }

  /**
   * Um olho com estados: aberto (pupila que se move, pálpebra que desce),
   * feliz (arco), xis (> ou <), espiral (tontura) e bravo (pálpebra enviesada).
   * O estado é escolhido por `data-exp` na peça (CSS), sem redesenhar nada.
   */
  olho(cx: number, cy: number, o: OpcoesOlho = {}): this {
    const e = o.esc ?? 1;
    const rx = (o.rx ?? 3.2) * e;
    const ry = (o.ry ?? 4.0) * e;
    const cor = o.cor ?? '#2a2130';
    const pele = o.pele ?? '#f7c995';
    const lado = o.lado ?? 1;
    const [erx, ery] = o.esclera ? [o.esclera[0] * e, o.esclera[1] * e] : o.branco ? [rx * 1.5, ry * 1.32] : [rx, ry];
    const temEsclera = !!(o.branco || o.esclera);
    const x = n(cx);
    const y = n(cy);
    // olho fechado fixo (carinhas dormindo nos rabiscos)
    if (o.sono) {
      this.linha([[cx - rx * 1.05, cy], [cx, cy + 1.8 * e], [cx + rx * 1.05, cy]], cor, 1.3 * e);
      return this;
    }
    let s = `<g class="olho" data-lado="${lado}">`;
    // aberto
    s += '<g class="o-aberto">';
    if (temEsclera)
      s += `<ellipse cx="${x}" cy="${y}" rx="${n(erx)}" ry="${n(ery)}" fill="#fbf8f0" stroke="${cor}" stroke-width="${n(0.55 * e)}" stroke-opacity="0.55"/>`;
    s += `<g class="pupila"><ellipse cx="${x}" cy="${y}" rx="${n(rx)}" ry="${n(ry)}" fill="${cor}" transform="rotate(${n(variar(this.rng, 5))} ${x} ${y})"/>`;
    s += `<circle cx="${n(cx - rx * 0.32)}" cy="${n(cy - ry * 0.36)}" r="${n(rx * 0.4)}" fill="#fff"/>`;
    s += `<circle cx="${n(cx + rx * 0.38)}" cy="${n(cy + ry * 0.42)}" r="${n(rx * 0.17)}" fill="#fff" opacity="0.9"/></g>`;
    // pálpebra: cobre o olho de cima para baixo (piscada, sono) e deixa um cílio embaixo
    const lx = temEsclera ? erx : rx;
    const ly = temEsclera ? ery : ry;
    const topo = cy - ly - 0.7 * e;
    const base = cy + ly + 0.7 * e;
    s += `<g class="palpebra" style="transform-origin:${x}px ${n(topo)}px">`;
    s += `<path d="M${n(cx - lx - 0.7 * e)} ${n(topo)}L${n(cx + lx + 0.7 * e)} ${n(topo)}L${n(cx + lx + 0.7 * e)} ${n(base - 1.4 * e)}Q${x} ${n(base + 1.6 * e)} ${n(cx - lx - 0.7 * e)} ${n(base - 1.4 * e)}Z" fill="${pele}"/>`;
    s += `<path d="M${n(cx - lx - 0.4 * e)} ${n(base - 1.3 * e)}Q${x} ${n(base + 1.5 * e)} ${n(cx + lx + 0.4 * e)} ${n(base - 1.3 * e)}" fill="none" stroke="${cor}" stroke-width="${n(1.15 * e)}" stroke-linecap="round"/></g>`;
    s += '</g>';
    // feliz: arquinho para cima
    s += `<path class="o-feliz" d="M${n(cx - rx * 1.15)} ${n(cy + 1.3 * e)}Q${x} ${n(cy - 3.1 * e)} ${n(cx + rx * 1.15)} ${n(cy + 1.3 * e)}" fill="none" stroke="${cor}" stroke-width="${n(1.5 * e)}" stroke-linecap="round"/>`;
    // xis: > ou < (virados para o meio do rosto)
    const a = lado === -1 ? 1 : -1;
    s += `<path class="o-xis" d="M${n(cx - a * 3.2 * e)} ${n(cy - 3.4 * e)}L${n(cx + a * 2.8 * e)} ${y}L${n(cx - a * 3.2 * e)} ${n(cy + 3.4 * e)}" fill="none" stroke="${cor}" stroke-width="${n(1.6 * e)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    // espiral: olho tonto
    let esp = '';
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const ang = t * Math.PI * 5;
      const r = (0.5 + t * 4.4) * e;
      esp += `${i ? 'L' : 'M'}${n(cx + Math.cos(ang) * r)} ${n(cy + Math.sin(ang) * r)}`;
    }
    s += `<g class="o-espiral"><circle cx="${x}" cy="${y}" r="${n(5.4 * e)}" fill="#fbf8f0" stroke="${cor}" stroke-width="${n(0.6 * e)}" stroke-opacity="0.5"/><path d="${esp}" fill="none" stroke="${cor}" stroke-width="${n(1.05 * e)}" stroke-linecap="round"/></g>`;
    // bravo: pálpebra enviesada (mais baixa perto do nariz) com sobrancelha
    const sx = -lado; // sentido do meio do rosto
    const wL = lx + 0.9 * e;
    const pOut = [cx - sx * wL, cy - ly * 0.95];
    const pIn = [cx + sx * wL, cy - ly * 0.02];
    s += `<g class="o-bravo"><path d="M${n(pOut[0])} ${n(topo - 1.2 * e)}L${n(pIn[0])} ${n(topo - 1.2 * e)}L${n(pIn[0])} ${n(pIn[1])}L${n(pOut[0])} ${n(pOut[1])}Z" fill="${pele}"/>`;
    s += `<path d="M${n(pOut[0])} ${n(pOut[1])}L${n(pIn[0])} ${n(pIn[1])}" stroke="${cor}" stroke-width="${n(1.5 * e)}" stroke-linecap="round"/></g>`;
    s += '</g>';
    this.corpo += s;
    return this;
  }

  /** Boca com variantes (sorriso, o, reta, aberta, onda, triste); a "padrão" aparece sem expressão. */
  boca(cx: number, cy: number, o: { esc?: number; padrao?: 'sorriso' | 'o' | 'reta'; cor?: string } = {}): this {
    const e = o.esc ?? 1;
    const cor = o.cor ?? '#2a2130';
    const padrao = o.padrao ?? 'sorriso';
    const x = n(cx);
    const v: Record<string, string> = {
      sorriso: `<path d="M${n(cx - 2.3 * e)} ${n(cy - 0.4)}Q${x} ${n(cy + 2.4 * e)} ${n(cx + 2.3 * e)} ${n(cy - 0.4)}" fill="none" stroke="${cor}" stroke-width="${n(1.15 * e)}" stroke-linecap="round"/>`,
      o: `<ellipse cx="${x}" cy="${n(cy + 0.6)}" rx="${n(1.5 * e)}" ry="${n(1.9 * e)}" fill="${cor}" opacity="0.92"/>`,
      reta: `<path d="M${n(cx - 1.9 * e)} ${n(cy + 0.3)}L${n(cx + 1.9 * e)} ${n(cy + 0.3)}" fill="none" stroke="${cor}" stroke-width="${n(1.15 * e)}" stroke-linecap="round"/>`,
      aberta: `<path d="M${n(cx - 3 * e)} ${n(cy - 0.6)}Q${x} ${n(cy - 1.4)} ${n(cx + 3 * e)} ${n(cy - 0.6)}Q${n(cx + 2.4 * e)} ${n(cy + 4.4 * e)} ${x} ${n(cy + 4.6 * e)}Q${n(cx - 2.4 * e)} ${n(cy + 4.4 * e)} ${n(cx - 3 * e)} ${n(cy - 0.6)}Z" fill="${cor}"/><ellipse cx="${x}" cy="${n(cy + 3.4 * e)}" rx="${n(1.6 * e)}" ry="${n(0.9 * e)}" fill="#ec7f86"/>`,
      onda: `<path d="M${n(cx - 3 * e)} ${n(cy + 0.6)}q${n(1.5 * e)} ${n(-1.8 * e)} ${n(3 * e)} 0t${n(3 * e)} 0" fill="none" stroke="${cor}" stroke-width="${n(1.1 * e)}" stroke-linecap="round"/>`,
      triste: `<path d="M${n(cx - 2.2 * e)} ${n(cy + 1.6)}Q${x} ${n(cy - 1.2 * e)} ${n(cx + 2.2 * e)} ${n(cy + 1.6)}" fill="none" stroke="${cor}" stroke-width="${n(1.15 * e)}" stroke-linecap="round"/>`,
    };
    let s = '';
    for (const k of Object.keys(v)) s += `<g class="b-${k}${k === padrao ? ' b-padrao' : ''}">${v[k]}</g>`;
    this.corpo += s;
    return this;
  }

  /** Carinha: dois olhos, bochechas rosadas e boquinha. */
  rosto(cx: number, cy: number, o: { esc?: number; dist?: number; boca?: 'sorriso' | 'o' | 'reta' | 'nenhuma'; olho?: string; bochecha?: string; sono?: boolean; branco?: boolean; pele?: string; rx?: number; ry?: number } = {}): this {
    const e = o.esc ?? 1;
    const dx = (o.dist ?? 7.5) * e;
    const boch = o.bochecha ?? '#ec7f86';
    return this.rostoGrupo(() => {
      for (const lado of [-1, 1] as const) {
        this.olho(cx + lado * dx, cy, { esc: e, branco: o.branco, pele: o.pele, cor: o.olho, lado, sono: o.sono, rx: o.rx, ry: o.ry });
        this.mancha(elipse(cx + lado * (dx + 4.4 * e), cy + 5 * e, 3.4 * e, 2 * e, 0, 10), boch, 0.55);
      }
      const by = cy + 5.4 * e;
      if (o.sono) {
        this.linha([[cx - 2.2 * e, by - 0.4], [cx, by + 1.3 * e], [cx + 2.2 * e, by - 0.4]], o.olho ?? '#2a2130', 1.15 * e);
      } else if (o.boca !== 'nenhuma') {
        this.boca(cx, by, { esc: e, padrao: o.boca ?? 'sorriso', cor: o.olho });
      }
    });
  }

  /** Estrelinha. */
  estrela(cx: number, cy: number, r: number, t: Tinta): this {
    const pts: Ponto[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.48;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1]);
    }
    return this.forma(pts, t, { esp: 1.6, contorno: 1.1, tremor: 0.15 });
  }

  resultado(): { clips: string; corpo: string } {
    return { clips: this.clips, corpo: this.corpo };
  }
}
