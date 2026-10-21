/**
 * Desenho estático do tabuleiro: grade a caneta marrom (com pontas que passam
 * da borda) e casas escuras pintadas de verde a lápis, como capim.
 * Semente fixa: o desenho é sempre o mesmo.
 */
import { gerador, hachura, linha, n, variar } from './traco.ts';

export const LADO = 800;
export const CASA = 100;
export const VIEWBOX = '-66 -64 932 932';

export function desenharTabuleiro(): { fundo: string; grade: string } {
  let capim = '';
  for (let lin = 0; lin < 8; lin++) {
    for (let col = 0; col < 8; col++) {
      if ((lin + col) % 2 === 0) continue; // casa clara: papel
      const r = gerador(`capim-${lin}-${col}`);
      const x = col * CASA;
      const y = lin * CASA;
      const ang = 64 + variar(r, 5);
      const forte = hachura(x, y, CASA, CASA, ang, 3.3 + variar(r, 0.3), r, { recuo: 4, tremor: 1.3, falha: 0.12 });
      const leve = hachura(x, y, CASA, CASA, ang + 8, 5.5, r, { recuo: 3, tremor: 1.6, falha: 0.3 });
      const atraso = (0.35 + (lin * 8 + col) * 0.012).toFixed(2);
      capim +=
        `<g class="casa-verde" style="--d:${atraso}s">` +
        `<path class="capim leve" d="${leve}"/>` +
        `<path class="capim" d="${forte}"/></g>`;
    }
  }

  const rng = gerador('grade-v2');
  let grade = '';
  for (let i = 0; i <= 8; i++) {
    const p = i * CASA;
    const ext = () => 10 + rng() * 16;
    const dv = linha(p + variar(rng, 1.5), -ext(), p + variar(rng, 2.5), LADO + ext(), rng, 2.2);
    const dh = linha(-ext(), p + variar(rng, 1.5), LADO + ext(), p + variar(rng, 2.5), rng, 2.2);
    grade += `<path class="traco" style="--d:${(i * 0.035).toFixed(2)}s" pathLength="1" d="${dv}"/>`;
    grade += `<path class="traco" style="--d:${(0.02 + i * 0.035).toFixed(2)}s" pathLength="1" d="${dh}"/>`;
  }
  // algumas linhas passadas duas vezes, como caneta que falhou
  for (const i of [0, 3, 8]) {
    const p = i * CASA;
    grade += `<path class="traco repasse" style="--d:0.3s" pathLength="1" d="${linha(p + 1.5, 120 + rng() * 200, p + 2, 420 + rng() * 300, rng, 1.5)}"/>`;
  }
  return { fundo: `<g class="capins">${capim}</g>`, grade };
}

/** Coordenadas escritas à mão, alternando tinta vermelha e azul. */
export function desenharCoordenadas(girado: boolean): string {
  const rng = gerador(girado ? 'coord-g2' : 'coord-n2');
  let s = '';
  for (let i = 0; i < 8; i++) {
    const letra = 'abcdefgh'[girado ? 7 - i : i];
    const num = girado ? i + 1 : 8 - i;
    const xa = i * CASA + 50 + variar(rng, 3);
    const ya = LADO + 50 + variar(rng, 3);
    const xb = -38 + variar(rng, 3);
    const yb = i * CASA + 64 + variar(rng, 3);
    const corA = (girado ? 7 - i : i) % 2 === 0 ? 'tinta-vermelha' : 'tinta-azul';
    const corB = num % 2 === 0 ? 'tinta-azul' : 'tinta-vermelha';
    s += `<text class="${corA}" x="${n(xa)}" y="${n(ya)}" transform="rotate(${variar(rng, 4).toFixed(1)} ${n(xa)} ${n(ya)})">${letra}</text>`;
    s += `<text class="${corB}" x="${n(xb)}" y="${n(yb)}" transform="rotate(${variar(rng, 4).toFixed(1)} ${n(xb)} ${n(yb)})">${num}</text>`;
  }
  return s;
}
