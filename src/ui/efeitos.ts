/**
 * Pequenos efeitos de tinta que acompanham as jogadas. Tudo é SVG desenhado
 * no código com semente fixa (nada de explosões prontas): poeirinha no chão,
 * anel de pouso, tremidinhas ao lado da cabeça, "pof" de impacto, estrelas de
 * tontura e notinhas musicais.
 */
import type { Color } from 'chess.js';
import { circulo, curva, gerador, linha, n, oval, variar, type Ponto } from '../arte/traco.ts';

const NS = 'http://www.w3.org/2000/svg';

export function grupo(classe: string, x: number, y: number, html: string, estilo = ''): SVGGElement {
  // o grupo de fora só posiciona; a animação CSS fica no de dentro (senão sobrescreveria o transform)
  const g = document.createElementNS(NS, 'g') as SVGGElement;
  g.setAttribute('transform', `translate(${n(x)} ${n(y)})`);
  g.innerHTML = `<g class="${classe}"${estilo ? ` style="${estilo}"` : ''}>${html}</g>`;
  return g;
}

export const classeTinta = (cor: Color) => (cor === 'w' ? 'ef-quente' : 'ef-fria');

/** Anel desenhado ao redor do bicho que acabou de pousar (com o tracinho de conferido). */
export function anel(x: number, y: number, cor: Color, semente: string): SVGGElement {
  const r = gerador(`anel-${semente}`);
  const d = circulo(50, 60, 41, r, 1.12, 0.05);
  const tique = `${linha(78, 22, 86, 30, r, 0.6)}${linha(86, 30, 98, 14, r, 0.6)}`;
  return grupo(
    `ef-anel ${classeTinta(cor)}`,
    x,
    y,
    `<path class="anel-risco" pathLength="1" d="${d}"/><path class="anel-tique" pathLength="1" d="${tique}"/>`,
  );
}

/** Nuvenzinha de poeira nos pés (rabisco de três bolinhas). */
export function poeira(x: number, y: number, lado: -1 | 1, semente: string): SVGGElement {
  const r = gerador(`poeira-${semente}`);
  let h = '';
  for (const [dx, dy, rr] of [
    [-14, 0, 7],
    [2, 4, 9],
    [17, 0, 6],
  ] as const)
    h += `<path d="${oval(50 + dx * lado, 90 + dy, rr * 1.25, rr * 0.85, r, 1.1, 0.12)}"/>`;
  return grupo('ef-poeira', x, y, h, `--lado:${lado}`);
}

/** Tremidinhas "(( ))" dos dois lados da cabeça, como quando o bicho amassa ao pousar. */
export function tremidinhas(x: number, y: number, cor: Color): SVGGElement {
  const arco = (cx: number, lado: number, raio: number) =>
    `<path d="M${n(cx + lado * raio * 0.45)} ${n(34 - raio)}Q${n(cx - lado * raio * 0.5)} 34 ${n(cx + lado * raio * 0.45)} ${n(34 + raio)}" />`;
  return grupo(
    `ef-tremor ${classeTinta(cor)}`,
    x,
    y,
    `${arco(24, 1, 8)}${arco(19, 1, 12)}${arco(76, -1, 8)}${arco(81, -1, 12)}`,
  );
}

/** Impacto: seis tracinhos saindo do ponto (pequeno, não cobre o tabuleiro). */
export function pof(x: number, y: number, cor: Color, semente: string): SVGGElement {
  const r = gerador(`pof-${semente}`);
  let h = '';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + variar(r, 0.25);
    const r0 = 15 + r() * 4;
    const r1 = 27 + r() * 9;
    h += `<path d="${linha(50 + Math.cos(a) * r0, 54 + Math.sin(a) * r0 * 0.8, 50 + Math.cos(a) * r1, 54 + Math.sin(a) * r1 * 0.8, r, 0.8)}"/>`;
  }
  return grupo(`ef-pof ${classeTinta(cor)}`, x, y, h);
}

function estrelaPath(cx: number, cy: number, raio: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? raio : raio * 0.45;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return d + 'Z';
}

/** Estrelas de tontura orbitando acima da cabeça (vai dentro do grupo do bicho, então acompanha o tombo). */
export function tontura(): SVGGElement {
  let h = '';
  const volta = 1.1;
  for (let i = 0; i < 4; i++) {
    const atraso = -(i / 4) * volta;
    h += `<g class="orb-x" style="animation-delay:${atraso.toFixed(2)}s"><g class="orb-y" style="animation-delay:${(atraso - volta / 4).toFixed(2)}s"><path class="estrelinha" d="${estrelaPath(0, 0, 6.6)}"/></g></g>`;
  }
  return grupo('ef-tontura', 50, 8, h);
}

/** Gota de suor (de susto). */
export function gota(cx: number, cy: number, r: number): string {
  return `M${n(cx)} ${n(cy - r * 1.9)} C${n(cx + r * 0.4)} ${n(cy - r * 0.9)} ${n(cx + r)} ${n(cy - r * 0.2)} ${n(cx + r)} ${n(cy + r * 0.35)} A${n(r)} ${n(r)} 0 0 1 ${n(cx - r)} ${n(cy + r * 0.35)} C${n(cx - r)} ${n(cy - r * 0.2)} ${n(cx - r * 0.4)} ${n(cy - r * 0.9)} ${n(cx)} ${n(cy - r * 1.9)}Z`;
}

/** Notinha musical desenhada à caneta (colcheia). */
export function notas(x: number, y: number, cor: Color, semente: string): SVGGElement {
  const r = gerador(`notas-${semente}`);
  const nota = (cx: number, cy: number, k: number) => {
    const cabeca = oval(cx, cy, 4.4 * k, 3.2 * k, r, 1.08, 0.05);
    const haste = linha(cx + 4.2 * k, cy - 1, cx + 4.2 * k, cy - 17 * k, r, 0.4);
    const bandeira = curva(
      [
        [cx + 4.2 * k, cy - 17 * k],
        [cx + 9 * k, cy - 12 * k],
        [cx + 8 * k, cy - 7 * k],
      ] as Ponto[],
      r,
      0.2,
      false,
    );
    return `<path class="nota-cab" d="${cabeca}"/><path d="${haste}"/><path d="${bandeira}"/>`;
  };
  return grupo(`ef-notas ${classeTinta(cor)}`, x, y, `${nota(78, 22, 1)}${nota(94, 8, 0.8)}`);
}
