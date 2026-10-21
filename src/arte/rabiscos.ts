/**
 * Rabiscos de enfeite em volta do tabuleiro (sol, varal de estrelas, lua de
 * touca, nuvens, pedrinhas dorminhocas, arco-íris, baleia, capim, flores).
 * Cada função devolve um <svg> independente, sempre igual (semente fixa).
 */
import { Desenho, elipse, type Tinta } from './lapis.ts';
import { T } from './pecas.ts';
import { gerador, linha, variar, type Ponto } from './traco.ts';

const TINTA_AZUL = '#3b46a8';
const MARROM = '#5a4032';

function svg(id: string, vb: string, d: Desenho, extra = ''): string {
  const r = d.resultado();
  return `<svg class="rabisco ${id}" viewBox="${vb}" aria-hidden="true" overflow="visible"><defs>${r.clips}</defs>${r.corpo}${extra}</svg>`;
}

export function sol(): string {
  const d = new Desenho('sol');
  const rng = gerador('sol-raios');
  let raios = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + variar(rng, 0.08);
    const r1 = 52 + variar(rng, 3);
    const r2 = r1 + 10 + rng() * 9;
    raios += linha(80 + Math.cos(a) * r1, 80 + Math.sin(a) * r1, 80 + Math.cos(a) * r2, 80 + Math.sin(a) * r2, rng, 0.8);
  }
  d.bruto(`<path d="${raios}" fill="none" stroke="#e7a62a" stroke-width="2.2" stroke-linecap="round"/>`);
  d.forma(elipse(80, 80, 44, 43, 0, 18), T.amarelo, { esp: 2.6 });
  d.rosto(80, 80, { esc: 2.3, sono: true, dist: 9 });
  return svg('sol', '0 0 160 160', d);
}

export function varal(): string {
  const d = new Desenho('varal');
  const rng = gerador('varal-fios');
  const corda: Ponto[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    corda.push([8 + t * 584, 14 + Math.sin(t * Math.PI) * 26 + variar(rng, 1.2)]);
  }
  d.linha(corda, MARROM, 1.8);
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const x = 8 + t * 584 + variar(rng, 4);
    const y0 = 14 + Math.sin(t * Math.PI) * 26;
    const comp = 22 + rng() * 40;
    if (i === 3) {
      // aranhinha pendurada
      d.linha([[x, y0], [x + 1, y0 + comp + 16]], '#444', 1);
      const ay = y0 + comp + 20;
      d.mancha(elipse(x + 1, ay, 4.5, 5, 0, 10), '#2f2a2a');
      for (const s of [-1, 1])
        for (const k of [-3, 0, 3]) d.linha([[x + 1, ay + k], [x + 1 + s * 6, ay + k - 2], [x + 1 + s * 9, ay + k + 2]], '#2f2a2a', 1);
      continue;
    }
    d.linha([[x, y0], [x + variar(rng, 1.5), y0 + comp]], MARROM, 1.1, 0.8);
    d.estrela(x, y0 + comp + 9, 10 + rng() * 2, T.dourado);
    d.rosto(x, y0 + comp + 10, { esc: 0.42, sono: rng() < 0.5, dist: 7 });
  }
  return svg('varal', '0 0 600 140', d);
}

export function lua(): string {
  const d = new Desenho('lua');
  d.forma(
    [
      [64, 22],
      [44, 40],
      [36, 70],
      [46, 102],
      [74, 124],
      [104, 126],
      [126, 112],
      [100, 114],
      [76, 104],
      [62, 84],
      [58, 58],
    ],
    { base: '#fbf1c4', traco: '#ead27a', contorno: '#8c7a3a' },
    { esp: 2.8 },
  );
  // touca de dormir
  d.forma(
    [
      [52, 34],
      [70, 8],
      [100, 4],
      [124, 20],
      [134, 44],
      [116, 30],
      [92, 24],
      [72, 30],
    ],
    T.roxoClaro,
    { esp: 2.2 },
  );
  d.forma(elipse(136, 48, 7, 7, 0, 10), { base: '#fff', traco: '#c9c2f2', contorno: '#5d52a8' }, { esp: 2.5 });
  d.estrela(96, 14, 4, T.dourado);
  d.rosto(66, 74, { esc: 1.4, sono: true, dist: 7 });
  return svg('lua', '0 0 150 140', d);
}

export function nuvem(semente = 'nuvem'): string {
  const d = new Desenho(semente);
  d.forma(
    [
      [14, 62, 1],
      [10, 48],
      [22, 36],
      [36, 38],
      [44, 22],
      [64, 16],
      [80, 26],
      [96, 20],
      [114, 30],
      [116, 44],
      [130, 50],
      [128, 62, 1],
    ],
    { base: '#f6f8fd', traco: '#b9c7ea', contorno: TINTA_AZUL },
    { esp: 4, opacidade: 0.5, contorno: 1.6 },
  );
  d.rosto(70, 46, { esc: 1, sono: true, dist: 7 });
  return svg('nuvem', '0 0 140 70', d);
}

export function pedrinha(semente = 'pedra'): string {
  const d = new Desenho(semente);
  d.forma(elipse(40, 36, 32, 19, -4, 16), { base: '#efe6d8', traco: '#c7b298', contorno: '#6b5440' }, { esp: 3, opacidade: 0.6 });
  d.rosto(40, 36, { esc: 0.95, sono: true, dist: 7 });
  return svg('pedrinha', '0 0 90 60', d, `<text x="74" y="16" class="zzz">z</text>`);
}

export function arcoIris(): string {
  const d = new Desenho('arco');
  const cores: Tinta[] = [
    { base: '#f6b3ab', traco: '#d9473c', contorno: '#b33a30' },
    { base: '#f8cf9f', traco: '#e8862e', contorno: '#c66a20' },
    { base: '#faeaa6', traco: '#eec12c', contorno: '#c99c18' },
    { base: '#d2e6b3', traco: '#6aa23c', contorno: '#4f8228' },
    { base: '#c4d3f2', traco: '#4a6fcf', contorno: '#3554a8' },
    { base: '#d6c9f0', traco: '#7f5ec9', contorno: '#5d3fa8' },
  ];
  const cx = 130;
  const cy = 150;
  cores.forEach((t, i) => {
    const r1 = 120 - i * 13;
    const r2 = r1 - 12;
    const pts: Ponto[] = [];
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      pts.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
    }
    for (let k = 12; k >= 0; k--) {
      const a = Math.PI + (k / 12) * Math.PI;
      pts.push([cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]);
    }
    pts[0] = [pts[0][0], pts[0][1], 1];
    pts[12] = [pts[12][0], pts[12][1], 1];
    pts[13] = [pts[13][0], pts[13][1], 1];
    pts[25] = [pts[25][0], pts[25][1], 1];
    d.forma(pts, t, { esp: 2.4, contorno: 0.9, opacidade: 0.6, baseOpacidade: 0.6 });
  });
  // nuvenzinhas nas pontas
  for (const x of [22, 238]) {
    d.forma(
      [
        [x - 26, 152, 1],
        [x - 24, 138],
        [x - 10, 130],
        [x + 4, 132],
        [x + 18, 136],
        [x + 26, 152, 1],
      ],
      { base: '#f8f9fd', traco: '#c8d2ea', contorno: TINTA_AZUL },
      { esp: 5, opacidade: 0.4, contorno: 1.4 },
    );
  }
  return svg('arco', '0 0 260 160', d);
}

export function baleia(): string {
  const d = new Desenho('baleia');
  const tinta = { base: '#dde6f8', traco: '#7e98d8', contorno: TINTA_AZUL };
  // cauda
  d.forma(
    [
      [196, 70],
      [214, 44],
      [236, 30],
      [228, 54],
      [246, 58],
      [222, 72],
      [204, 84],
    ],
    tinta,
    { esp: 4.5, opacidade: 0.45 },
  );
  // corpo
  d.forma(
    [
      [20, 92],
      [26, 66],
      [52, 46],
      [96, 40],
      [140, 48],
      [176, 66],
      [204, 80],
      [190, 98],
      [150, 112],
      [96, 116],
      [50, 110],
    ],
    tinta,
    { esp: 4.5, opacidade: 0.45 },
  );
  d.linha([[30, 96], [70, 102], [120, 104], [170, 96]], TINTA_AZUL, 1.2, 0.6);
  d.linha([[46, 88], [56, 92], [66, 88]], TINTA_AZUL, 1.6);
  d.mancha(elipse(76, 92, 6, 3.4, 0, 10), '#ec7f86', 0.5);
  d.linha([[30, 82], [38, 86]], TINTA_AZUL, 1.3);
  // esguicho
  d.linha([[60, 40], [56, 22], [44, 10]], TINTA_AZUL, 1.6);
  d.linha([[62, 38], [64, 20], [76, 8]], TINTA_AZUL, 1.6);
  d.linha([[61, 40], [61, 14]], TINTA_AZUL, 1.6);
  return svg('baleia', '0 0 260 130', d);
}

export function capim(semente = 'capim'): string {
  const rng = gerador(semente);
  let p = '';
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 4 + variar(rng, 1);
    p += linha(x, 26, x + variar(rng, 5), 4 + rng() * 10, rng, 1.6);
  }
  return `<svg class="rabisco capim" viewBox="0 0 30 30" aria-hidden="true"><path d="${p}" fill="none" stroke="#5f9a3a" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

export function flor(semente = 'flor'): string {
  const d = new Desenho(semente);
  d.linha([[20, 60], [19, 40], [20, 22]], '#5f9a3a', 1.5);
  d.forma(elipse(26, 44, 6, 2.6, -30, 8), T.verde, { esp: 1.6, contorno: 1 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    d.forma(elipse(20 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 4.4, 4.4, 0, 8), { base: '#fbfbf6', traco: '#ddd', contorno: '#6b5a4a' }, { esp: 3, contorno: 1, opacidade: 0.3 });
  }
  d.forma(elipse(20, 16, 3.4, 3.4, 0, 8), T.amarelo, { esp: 1.4, contorno: 0.9 });
  return svg('flor', '0 0 40 62', d);
}

export function cogumelinho(semente = 'cogu'): string {
  const d = new Desenho(semente);
  d.forma(
    [
      [16, 24],
      [24, 24],
      [25, 40],
      [15, 40],
    ],
    T.creme,
    { esp: 2, contorno: 1.1 },
  );
  d.forma(
    [
      [4, 26, 1],
      [8, 14],
      [20, 8],
      [32, 14],
      [36, 26, 1],
    ],
    T.vermelho,
    { esp: 1.8, contorno: 1.1 },
  );
  d.mancha(elipse(14, 17, 2.2, 1.8, 0, 8), '#fff6ea');
  d.mancha(elipse(26, 18, 2, 1.6, 0, 8), '#fff6ea');
  return svg('cogumelinho', '0 0 40 42', d);
}

export function caracol(): string {
  const d = new Desenho('caracol');
  d.forma(
    [
      [6, 40],
      [14, 34],
      [50, 34],
      [62, 26],
      [66, 30],
      [60, 40],
      [56, 44],
      [10, 44],
    ],
    T.creme,
    { esp: 2.4, contorno: 1.2 },
  );
  d.forma(elipse(32, 24, 15, 13, 0, 14), T.areia, { esp: 2.2 });
  const espiral: Ponto[] = [];
  for (let i = 0; i < 18; i++) {
    const a = i * 0.7;
    const r = 1 + i * 0.6;
    espiral.push([32 + Math.cos(a) * r, 24 + Math.sin(a) * r]);
  }
  d.linha(espiral, T.areia.contorno, 1.2);
  d.linha([[60, 28], [62, 18]], MARROM, 1.1);
  d.linha([[64, 29], [70, 20]], MARROM, 1.1);
  d.mancha(elipse(62, 31, 1.2, 1.2, 0, 6), '#2a2130');
  return svg('caracol', '0 0 76 48', d);
}

/** Pequenos rabiscos soltos que enfeitam a página inteira. */
export function enfeitesDaPagina(): Record<string, string> {
  return {
    sol: sol(),
    varal: varal(),
    lua: lua(),
    nuvem1: nuvem('nuvem-a'),
    nuvem2: nuvem('nuvem-b'),
    pedra1: pedrinha('pedra-a'),
    arco: arcoIris(),
    baleia: baleia(),
    capim1: capim('capim-a'),
    capim2: capim('capim-b'),
    flor1: flor('flor-a'),
    cogu1: cogumelinho('cogu-a'),
    caracol: caracol(),
  };
}

