/**
 * As peças são bichinhos desenhados a lápis de cor (SVG próprio, semente fixa).
 *
 * Brancas (time quente): cogumelo (peão), castelinho de areia (torre),
 * pônei-cervo (cavalo), broto de capuz pontudo (bispo), abelha de coroa (dama),
 * coruja de coroa com cruz (rei).
 * Pretas (time roxo): fantasminha (peão), bicho-peludo de ameias (torre),
 * unicórnio (cavalo), magrinho de chapéu-mitra (bispo), cacatua de coroa (dama),
 * pinguim de coroa com cruz (rei).
 *
 * Cada bicho carrega uma pista da peça de xadrez: ameias na torre, cabeça de
 * cavalo, ponta com fenda no bispo, coroa de bolinhas na dama e cruz no rei.
 */
import type { Color, PieceSymbol } from 'chess.js';
import { Desenho, elipse, type Tinta } from './lapis.ts';
import type { Ponto } from './traco.ts';

const C = 1 as const;

export const T: Record<string, Tinta> = {
  vermelho: { base: '#ee9a8c', traco: '#cf3b2f', contorno: '#8a2f24' },
  creme: { base: '#faedd6', traco: '#ebbb85', contorno: '#9c5f36' },
  laranja: { base: '#f7c995', traco: '#e47a2c', contorno: '#93461f' },
  amarelo: { base: '#fae6a4', traco: '#efb526', contorno: '#94671a' },
  areia: { base: '#f3d4a3', traco: '#d98b43', contorno: '#8c5225' },
  marrom: { base: '#5b3d2a', traco: '#3d271a', contorno: '#2d1c12' },
  verde: { base: '#d3e7b5', traco: '#6a9f3a', contorno: '#46702a' },
  dourado: { base: '#f8df8c', traco: '#e3a822', contorno: '#93670f' },
  rubi: { base: '#f0a0a8', traco: '#d6404f', contorno: '#8c2633' },
  asa: { base: '#f3f7fb', traco: '#a8c4e4', contorno: '#6683ad' },
  roxo: { base: '#7f77cf', traco: '#3b2f9e', contorno: '#251c6e' },
  roxoClaro: { base: '#c9c2f2', traco: '#7466cf', contorno: '#382c8c' },
  anil: { base: '#5d58b8', traco: '#25217e', contorno: '#191660' },
  barriga: { base: '#e9e6fb', traco: '#a39bdf', contorno: '#3a3290' },
  bico: { base: '#fbd77a', traco: '#eba21c', contorno: '#8c5f10' },
  pessego: { base: '#fbe0bd', traco: '#ee9d55', contorno: '#9c5f36' },
  vermelhoEscuro: { base: '#dd7468', traco: '#a82a22', contorno: '#8a2f24' },
  rosa: { base: '#f6bcc0', traco: '#dd6a76', contorno: '#8c2e3a' },
};

const PE_QUENTE = T.laranja;
const PE_FRIO = T.bico;

function coroa(d: Desenho, cx: number, base: number, larg: number, alt: number, tipo: 'rei' | 'dama'): void {
  const l = larg / 2;
  const pts: Ponto[] =
    tipo === 'dama'
      ? [
          [cx - l, base, C],
          [cx - l - 1, base - alt, C],
          [cx - l * 0.5, base - alt * 0.45, C],
          [cx, base - alt * 1.08, C],
          [cx + l * 0.5, base - alt * 0.45, C],
          [cx + l + 1, base - alt, C],
          [cx + l, base, C],
        ]
      : [
          [cx - l, base, C],
          [cx - l, base - alt * 0.85, C],
          [cx - l * 0.45, base - alt * 0.5, C],
          [cx, base - alt, C],
          [cx + l * 0.45, base - alt * 0.5, C],
          [cx + l, base - alt * 0.85, C],
          [cx + l, base, C],
        ];
  d.forma(pts, T.dourado, { esp: 1.7, contorno: 1.3, tremor: 0.2 });
  if (tipo === 'dama') {
    for (const [x, y] of [
      [cx - l - 1, base - alt],
      [cx, base - alt * 1.08],
      [cx + l + 1, base - alt],
    ])
      d.forma(elipse(x, y - 1.6, 2.1, 2.1, 0, 8), T.rubi, { esp: 1.3, contorno: 0.9, tremor: 0.1 });
  } else {
    // cruz no topo: marca do rei
    const y = base - alt;
    d.forma(
      [
        [cx - 1.4, y + 1, C],
        [cx - 1.4, y - 3.2, C],
        [cx - 4.2, y - 3.2, C],
        [cx - 4.2, y - 6, C],
        [cx - 1.4, y - 6, C],
        [cx - 1.4, y - 9.5, C],
        [cx + 1.4, y - 9.5, C],
        [cx + 1.4, y - 6, C],
        [cx + 4.2, y - 6, C],
        [cx + 4.2, y - 3.2, C],
        [cx + 1.4, y - 3.2, C],
        [cx + 1.4, y + 1, C],
      ],
      T.dourado,
      { esp: 1.4, contorno: 1.1, tremor: 0.1 },
    );
    d.forma(elipse(cx, base - alt * 0.32, 2, 2, 0, 8), T.rubi, { esp: 1.3, contorno: 0.8, tremor: 0.1 });
  }
}

function pezinhos(d: Desenho, cx: number, y: number, dist: number, t: Tinta): void {
  d.parte('pes', [cx - dist, y - 3], () => d.forma(elipse(cx - dist, y, 5.2, 3, -6, 10), t, { esp: 1.8, contorno: 1.2 }), { lado: -1 });
  d.parte('pes', [cx + dist, y - 3], () => d.forma(elipse(cx + dist, y, 5.2, 3, 6, 10), t, { esp: 1.8, contorno: 1.2 }), { lado: 1 });
}

/** Bracinhos de toquinho nas laterais (desenhados ATRÁS do corpo, sobem quando o bicho pula). */
function bracinhos(d: Desenho, xe: number, xd: number, y: number, t: Tinta, comp = 6.4): void {
  d.parte('braco', [xe + 4, y - 5], () => d.forma(elipse(xe, y, 4.1, comp, 26, 10), t, { esp: 1.7, contorno: 1.15 }), { lado: -1 });
  d.parte('braco', [xd - 4, y - 5], () => d.forma(elipse(xd, y, 4.1, comp, -26, 10), t, { esp: 1.7, contorno: 1.15 }), { lado: 1 });
}

// ---------------------------------------------------------------- brancas

function cogumelo(d: Desenho): void {
  const PELE = '#f9d5ab';
  // pezinhos (cada um é uma parte: chutam para trás ao pular)
  d.parte('pes', [42, 87], () => d.forma(elipse(42, 90, 5.6, 3.2, -6, 10), PE_QUENTE, { esp: 1.8, contorno: 1.2 }), { lado: -1 });
  d.parte('pes', [58, 87], () => d.forma(elipse(58, 90, 5.6, 3.2, 6, 10), PE_QUENTE, { esp: 1.8, contorno: 1.2 }), { lado: 1 });
  // bracinhos (atrás do corpo; sobem quando o bicho pula)
  d.parte('braco', [36, 64], () => d.forma(elipse(31, 70, 4.1, 6.6, 28, 10), T.pessego, { esp: 1.7, contorno: 1.15 }), { lado: -1 });
  d.parte('braco', [64, 64], () => d.forma(elipse(69, 70, 4.1, 6.6, -28, 10), T.pessego, { esp: 1.7, contorno: 1.15 }), { lado: 1 });
  // corpo (pé do cogumelo)
  d.forma(
    [
      [36, 50],
      [64, 50],
      [68, 64],
      [67, 79],
      [60, 89],
      [40, 89],
      [33, 79],
      [32, 64],
    ],
    T.pessego,
    { esp: 2.5 },
  );
  d.mancha(elipse(45, 72, 8, 11, 12, 10), '#fff8ec', 0.4);
  // chapéu: lamelas, calota, faixa de sombra e pintas (tudo balança junto)
  d.parte('topo', [50, 55], () => {
    d.forma(
      [
        [23, 52, C],
        [50, 59.5, C],
        [77, 52, C],
        [67, 58],
        [50, 61.5],
        [33, 58],
      ],
      T.creme,
      { esp: 2, contorno: 1.2 },
    );
    for (const x of [33, 38.5, 44, 50, 56, 61.5, 67])
      d.linha([[x, 56.8 + Math.abs(x - 50) * 0.04], [x + (x - 50) * 0.1, 60.6 - Math.abs(x - 50) * 0.05]], T.creme.contorno, 0.9, 0.7);
    d.forma(
      [
        [19, 52, C],
        [22, 39],
        [33, 27],
        [50, 21],
        [67, 27],
        [78, 39],
        [81, 52, C],
        [66, 55.5],
        [50, 56.5],
        [34, 55.5],
      ],
      T.vermelho,
      { esp: 2.0 },
    );
    d.forma(
      [
        [19.5, 51, C],
        [34, 53.6],
        [50, 54.6],
        [66, 53.6],
        [80.5, 51, C],
        [81, 52.4, C],
        [66, 55.5],
        [50, 56.5],
        [34, 55.5],
        [19, 52.4, C],
      ],
      T.vermelhoEscuro,
      { esp: 1.4, contorno: 0, opacidade: 0.8, baseOpacidade: 0.75 },
    );
    for (const [x, y, rx, ry] of [
      [33, 39, 4.8, 3.8],
      [50, 29.5, 4.2, 3.3],
      [66, 40, 5.2, 4],
      [44, 45, 2.7, 2.2],
      [74, 49, 2.5, 2],
      [27, 48, 2, 1.7],
      [57, 46, 2.2, 1.8],
    ])
      d.mancha(elipse(x, y, rx, ry, 10, 10), '#fff6ea', 0.96);
    d.mancha(elipse(38, 31, 6, 2.4, -38, 8), '#ffffff', 0.32);
  }, { solta: true });
  d.rosto(50, 67, { esc: 1.08, pele: PELE, rx: 3.6, ry: 4.5 });
}

function castelinho(d: Desenho): void {
  pezinhos(d, 50, 90, 12, PE_QUENTE);
  bracinhos(d, 20.5, 79.5, 66, T.areia);
  d.forma(
    [
      [25, 88, C],
      [26, 44, C],
      [23, 44, C],
      [23, 30, C],
      [32, 30, C],
      [32, 37, C],
      [40, 37, C],
      [40, 30, C],
      [49, 30, C],
      [49, 37, C],
      [56, 37, C],
      [56, 30, C],
      [65, 30, C],
      [65, 37, C],
      [70, 37, C],
      [70, 30, C],
      [77, 30, C],
      [77, 44, C],
      [74, 44, C],
      [75, 88, C],
    ],
    T.areia,
    { esp: 2.2, tremor: 0.3 },
  );
  // tijolinhos
  for (const [a, b, y] of [
    [30, 40, 50],
    [60, 70, 52],
    [34, 44, 80],
    [57, 67, 78],
  ])
    d.linha([[a, y], [b, y + 0.6]], T.areia.contorno, 1.2, 0.7);
  d.linha([[24, 44], [76, 44]], T.areia.contorno, 1.4, 0.8);
  // broto no topo (balança com atraso)
  d.parte('topo', [69, 30], () => {
    d.linha([[69, 30], [70, 23], [72, 17]], T.verde.contorno, 1.6);
    d.forma(elipse(76.5, 16, 5.5, 2.8, -30, 10), T.verde, { esp: 1.6, contorno: 1.1 });
    d.forma(elipse(67, 19.5, 4, 2.2, 35, 10), T.verde, { esp: 1.6, contorno: 1.1 });
  });
  d.rosto(50, 63, { esc: 1.1, pele: '#f1d3a6', rx: 3.5, ry: 4.4 });
}

function ponei(d: Desenho, quente: boolean): void {
  const corpo = quente ? T.laranja : T.roxo;
  const crina = quente ? T.dourado : T.roxoClaro;
  const rabo = quente ? T.rosa : T.roxoClaro;
  const casco = quente ? T.marrom : T.anil;
  const pele = quente ? '#f7c995' : '#7f77cf';
  const perna = (x: number, y0: number, y1: number, fase: number, ch: number) =>
    d.parte(
      'perna',
      [x, y0],
      () => {
        d.forma(
          [
            [x - 3.2, y0, C],
            [x + 3.2, y0, C],
            [x + 3.5, y1, C],
            [x - 3.4, y1, C],
          ],
          corpo,
          { esp: 1.8, contorno: 1.3 },
        );
        d.forma(elipse(x, ch, 4.3, 2.3, 0, 8), casco, { esp: 1.5, contorno: 1 });
      },
      { fase },
    );
  // patas de trás (atrás do corpo)
  perna(48, 62, 86, 0, 86.5);
  perna(76, 62, 86, 1, 86.5);
  // rabo (balança)
  d.parte('rabo', [76, 58], () => {
    d.forma(
      [
        [76, 58],
        [84, 53],
        [91, 58],
        [90, 70],
        [84, 79],
        [85, 69],
        [79, 63],
      ],
      rabo,
      { esp: 1.7, contorno: 1.3 },
    );
    d.linha([[84, 58], [87, 66]], rabo.contorno, 0.9, 0.7);
  });
  // corpo
  d.forma(elipse(60, 64, 23, 12.5, -4, 16), corpo, { esp: 2.2 });
  d.mancha(elipse(60, 71, 15, 4.5, -3, 10), quente ? '#fdeccf' : '#cfc9f2', 0.4);
  // patas da frente
  perna(42, 66, 89, 1, 89.5);
  perna(69, 66, 89, 0, 89.5);
  // pescoço
  d.forma(
    [
      [36, 62],
      [30, 46],
      [32, 34],
      [44, 33],
      [48, 46],
      [52, 58],
    ],
    corpo,
    { esp: 2.1, contorno: 1.4 },
  );
  // crina em espetinhos (balança com o pescoço)
  d.parte('crina', [46, 34], () => {
    d.forma(
      [
        [37, 21, C],
        [45, 16.5, C],
        [45, 24],
        [52, 21.5, C],
        [51, 30],
        [58, 31, C],
        [54, 39],
        [61, 42, C],
        [55.5, 48],
        [61, 54, C],
        [55, 57],
        [50, 50],
        [46, 40],
        [42, 30],
      ],
      crina,
      { esp: 1.6, contorno: 1.2 },
    );
    d.linha([[46, 22], [50, 36], [53, 50]], crina.contorno, 0.9, 0.6);
  });
  if (!quente) {
    // selinha dourada
    d.forma(elipse(60, 54, 7, 3.5, -4, 10), T.dourado, { esp: 1.5, contorno: 1 });
  } else {
    // pintinhas de filhote
    for (const [x, y] of [
      [56, 58],
      [64, 61],
      [70, 57],
      [60, 67],
      [52, 63],
    ])
      d.mancha(elipse(x, y, 2, 1.6, 0, 8), '#fff4e3', 0.9);
  }
  // cabeça (focinho para a esquerda, como o cavalo do xadrez): gira no pescoço
  d.parte('cabeca', [40, 44], () => {
    d.forma(
      [
        [26, 26],
        [36, 21],
        [44, 26],
        [44, 36],
        [37, 41],
        [26, 47],
        [16, 48],
        [12, 43],
        [15, 36],
      ],
      corpo,
      { esp: 2.1 },
    );
    d.forma(elipse(16.5, 44, 6.5, 4.6, -12, 10), quente ? T.creme : T.roxoClaro, { esp: 1.8, contorno: 1.2 });
    d.mancha(elipse(13.4, 42.6, 0.9, 0.9, 0, 6), '#2a2130');
    // orelhas e chifres/galhos: balançam um pouco depois da cabeça
    d.parte('topo', [37, 24], () => {
      d.forma(
        [
          [36, 22, C],
          [37.5, 11, C],
          [43, 22, C],
        ],
        corpo,
        { esp: 1.6, contorno: 1.2 },
      );
      d.forma(
        [
          [37.6, 20, C],
          [38.2, 14.5, C],
          [41, 20, C],
        ],
        quente ? T.rosa : T.roxoClaro,
        { esp: 1.4, contorno: 0, opacidade: 0.7 },
      );
      if (quente) {
        // galhadas de cervo
        d.linha([[30, 22], [27, 12], [22, 8]], T.marrom.contorno, 2);
        d.linha([[27, 13], [31, 7]], T.marrom.contorno, 1.8);
        d.linha([[42, 21], [46, 11], [51, 8]], T.marrom.contorno, 2);
        d.linha([[46, 12], [44, 6]], T.marrom.contorno, 1.8);
      } else {
        // chifre de unicórnio
        d.forma(
          [
            [27, 23, C],
            [21, 6, C],
            [32, 20, C],
          ],
          T.dourado,
          { esp: 1.3, contorno: 1.2, tremor: 0.1 },
        );
        d.linha([[23.5, 12], [28, 13]], T.dourado.contorno, 0.9);
        d.linha([[25, 17], [29.5, 17.5]], T.dourado.contorno, 0.9);
      }
    });
    // olho (com pálpebra e pupila que se movem), bochecha e boquinha
    d.rostoGrupo(() => {
      d.olho(31, 31, { esc: 1.05, rx: 3.9, ry: 4.9, pele, branco: !quente, lado: 1 });
      d.mancha(elipse(26, 39.5, 3.4, 2, -10, 10), '#ec7f86', 0.55);
      d.boca(21.5, 45.6, { esc: 0.75 });
    });
  });
}

function broto(d: Desenho): void {
  pezinhos(d, 50, 90, 8, PE_QUENTE);
  bracinhos(d, 25, 75, 68, T.amarelo, 6);
  // antenas (balançam com atraso)
  d.parte('topo', [50, 24], () => {
    d.linha([[44, 22], [39, 12], [33, 9]], T.marrom.contorno, 1.4);
    d.linha([[56, 22], [61, 12], [67, 9]], T.marrom.contorno, 1.4);
    d.forma(elipse(32.5, 9, 2.4, 2.4, 0, 8), T.marrom, { esp: 1.2, contorno: 0.8 });
    d.forma(elipse(67.5, 9, 2.4, 2.4, 0, 8), T.marrom, { esp: 1.2, contorno: 0.8 });
  });
  // corpo-gota
  const corpo: Ponto[] = [
    [50, 15, C],
    [60, 30],
    [70, 50],
    [72, 68],
    [65, 84],
    [50, 89],
    [35, 84],
    [28, 68],
    [30, 50],
    [40, 30],
  ];
  d.forma(corpo, T.amarelo, { esp: 2.4 });
  // capuz pontudo (como a mitra do bispo)
  d.forma(
    [
      [50, 15, C],
      [60, 30],
      [69, 47],
      [64, 53],
      [56, 50],
      [50, 54],
      [44, 50],
      [36, 53],
      [31, 47],
      [40, 30],
    ],
    T.laranja,
    { esp: 1.9 },
  );
  // listras do capuz e a fenda da mitra
  d.linha([[43, 32], [40, 48]], T.laranja.contorno, 1.1, 0.8);
  d.linha([[57, 32], [60, 48]], T.laranja.contorno, 1.1, 0.8);
  d.linha([[56, 25], [47, 39]], T.laranja.contorno, 1.8);
  d.rosto(50, 66, { esc: 1.08, pele: '#fae6a4', rx: 3.5, ry: 4.4 });
}

function abelha(d: Desenho): void {
  pezinhos(d, 50, 91, 8, T.marrom);
  // asas (batem ao pular)
  d.parte('asa', [40, 54], () => d.forma(elipse(31, 42, 10, 15, -28, 14), T.asa, { esp: 2.6, contorno: 1.2, opacidade: 0.5 }), { lado: -1 });
  d.parte('asa', [60, 54], () => d.forma(elipse(69, 42, 10, 15, 28, 14), T.asa, { esp: 2.6, contorno: 1.2, opacidade: 0.5 }), { lado: 1 });
  // varinha com estrela, na mão direita
  d.parte('braco', [68, 66], () => {
    d.linha([[72, 72], [84, 46]], T.marrom.contorno, 2);
    d.estrela(85, 42, 6.5, T.dourado);
    d.forma(elipse(72, 71, 3.6, 3, 0, 8), T.amarelo, { esp: 1.5, contorno: 1.1 });
  }, { lado: 1 });
  // corpo listrado
  const corpo = elipse(50, 64, 20, 24.5, 0, 18);
  d.forma(corpo, T.amarelo, { esp: 2.3 });
  for (const y of [58, 70, 81]) {
    const meia = Math.sqrt(Math.max(0, 1 - ((y - 64) / 24.5) ** 2)) * 20;
    d.forma(
      [
        [50 - meia + 1, y - 2.6],
        [50, y - 3.4],
        [50 + meia - 1, y - 2.6],
        [50 + meia - 1.5, y + 2.4],
        [50, y + 3.2],
        [50 - meia + 1.5, y + 2.4],
      ],
      T.marrom,
      { esp: 1.6, contorno: 0, opacidade: 0.9 },
    );
  }
  d.forma(corpo, { ...T.amarelo, base: 'none' }, { esp: 50, contorno: 1.7, opacidade: 0 });
  // antenas e coroa (a coroa voa quando a abelha é capturada)
  d.parte(
    'topo',
    [50, 44],
    () => {
      d.linha([[44, 41], [40, 33]], T.marrom.contorno, 1.3);
      d.linha([[56, 41], [60, 33]], T.marrom.contorno, 1.3);
      coroa(d, 50, 42, 22, 11, 'dama');
    },
    { solta: true },
  );
  d.rosto(50, 50, { esc: 1.02, pele: '#fae6a4', rx: 3.5, ry: 4.4 });
}

function coruja(d: Desenho): void {
  pezinhos(d, 50, 92, 9, PE_QUENTE);
  // asas (batem ao pular)
  d.parte('braco', [28, 48], () => d.forma(elipse(26, 63, 7, 17, 12, 12), T.areia, { esp: 2 }), { lado: -1 });
  d.parte('braco', [72, 48], () => d.forma(elipse(74, 63, 7, 17, -12, 12), T.areia, { esp: 2 }), { lado: 1 });
  // corpo com tufos
  d.forma(
    [
      [24, 40],
      [26, 26, C],
      [36, 33],
      [50, 31],
      [64, 33],
      [74, 26, C],
      [76, 40],
      [78, 60],
      [72, 80],
      [60, 89],
      [40, 89],
      [28, 80],
      [22, 60],
    ],
    T.creme,
    { esp: 2.4 },
  );
  // barriga com peninhas
  d.forma(elipse(50, 72, 15, 15, 0, 14), { ...T.creme, base: '#fdf6e8' }, { esp: 3.2, contorno: 1, opacidade: 0.4 });
  for (const [x, y] of [
    [44, 66],
    [52, 67],
    [48, 74],
    [56, 75],
    [42, 78],
    [50, 81],
  ])
    d.linha([[x - 2.5, y], [x, y + 2], [x + 2.5, y]], T.areia.contorno, 1, 0.7);
  // olhos grandes de coruja: disco de penas em volta e olho com pálpebra
  for (const x of [40, 60]) {
    d.forma(elipse(x, 48, 9.4, 9.4, 0, 14), { base: '#fffdf6', traco: '#e8c48f', contorno: T.areia.contorno }, { esp: 3.5, opacidade: 0.3, contorno: 1.4 });
  }
  d.rostoGrupo(() => {
    for (const lado of [-1, 1] as const)
      d.olho(50 + lado * 10, 48.5, { rx: 4.3, ry: 4.8, esclera: [7.4, 7.4], pele: '#fbf0dc', lado });
  });
  d.forma(
    [
      [46.5, 55, C],
      [53.5, 55, C],
      [50, 61.5, C],
    ],
    T.bico,
    { esp: 1.3, contorno: 1.1, tremor: 0.1 },
  );
  d.mancha(elipse(31, 58, 3.6, 2.2, 0, 10), '#ec7f86', 0.55);
  d.mancha(elipse(69, 58, 3.6, 2.2, 0, 10), '#ec7f86', 0.55);
  d.parte('topo', [50, 34], () => coroa(d, 50, 32, 24, 13, 'rei'), { solta: true });
}

// ---------------------------------------------------------------- pretas

function fantasminha(d: Desenho): void {
  bracinhos(d, 22, 78, 62, T.roxo, 5.2);
  d.parte('topo', [50, 30], () => {
    d.linha([[50, 30], [50.5, 21]], T.anil.contorno, 1.4);
    d.estrela(51, 18, 4.6, T.dourado);
  });
  d.forma(
    [
      [50, 29],
      [62, 32],
      [70, 44],
      [73, 62],
      [77, 86, C],
      [70, 82],
      [64, 88, C],
      [57, 83],
      [50, 89, C],
      [43, 83],
      [36, 88, C],
      [30, 82],
      [23, 86, C],
      [27, 62],
      [30, 44],
      [38, 32],
    ],
    T.roxo,
    { esp: 2.0, opacidade: 0.85 },
  );
  d.mancha(elipse(39, 41, 4, 6, 25, 10), '#ffffff', 0.18);
  d.rosto(50, 57, { esc: 1.02, branco: true, pele: '#7f77cf' });
}

function peludo(d: Desenho): void {
  bracinhos(d, 19, 81, 62, T.roxo, 5.6);
  // corpo peludo com ameias no alto (a torre do time roxo)
  const pts: Ponto[] = [
    [23, 88, C],
    [22, 66],
    [24, 52],
    [22, 40],
    [21, 27, C],
    [32, 27, C],
    [33, 35],
    [40, 36, C],
    [40, 27, C],
    [52, 27, C],
    [52, 36, C],
    [60, 35],
    [61, 27, C],
    [72, 27, C],
    [77, 27, C],
    [78, 40],
    [76, 52],
    [78, 66],
    [77, 88, C],
    [70, 91],
    [63, 87],
    [56, 91],
    [49, 87],
    [42, 91],
    [35, 87],
    [29, 91],
  ];
  d.forma(pts, T.roxo, { esp: 1.8, opacidade: 0.9 });
  // pelinhos espetados nas bordas e na barriga
  for (const [x, y, dx, dy] of [
    [22, 46, -4, -2],
    [23, 60, -4, 1],
    [22, 76, -4, 0],
    [78, 46, 4, -2],
    [77, 60, 4, 1],
    [78, 76, 4, 0],
    [24, 27, -2, -4],
    [36, 27, 0, -4],
    [46, 27, 0, -4],
    [56, 27, 0, -4],
    [66, 27, 0, -4],
    [76, 27, 2, -4],
  ])
    d.linha([[x, y], [x + dx, y + dy]], T.roxo.contorno, 1.4);
  for (const [x, y] of [
    [33, 52],
    [66, 51],
    [30, 74],
    [70, 74],
    [44, 82],
    [58, 83],
  ])
    d.linha([[x, y], [x + 2.5, y - 3.5]], T.roxoClaro.base, 1.5, 0.9);
  d.parte('topo', [50, 27], () => {
    d.estrela(27, 22, 2.6, T.dourado);
    d.estrela(46, 22, 2.6, T.dourado);
    d.estrela(67, 22, 2.6, T.dourado);
  });
  d.rosto(50, 58, { esc: 1.1, branco: true, boca: 'o', pele: '#7f77cf' });
}

function mago(d: Desenho): void {
  pezinhos(d, 50, 91, 8, PE_FRIO);
  bracinhos(d, 31, 69, 74, T.roxoClaro, 5.4);
  // corpinho
  d.forma(elipse(50, 73, 17, 16, 0, 16), T.roxoClaro, { esp: 2.2 });
  // chapéu-mitra (voa quando o mago é capturado)
  d.parte('topo', [50, 60], () => {
  d.forma(
    [
      [33, 60, C],
      [36, 46],
      [42, 30],
      [50, 12, C],
      [58, 30],
      [64, 46],
      [67, 60, C],
      [50, 63],
    ],
    T.anil,
    { esp: 1.8, opacidade: 0.9 },
  );
  // aba e faixa
  d.forma(elipse(50, 60, 21, 4.4, 0, 14), T.roxo, { esp: 1.7 });
  d.linha([[38, 48], [50, 50], [62, 48]], T.dourado.traco, 2.2);
  // fenda da mitra
  d.linha([[55, 25], [46, 38]], '#e9e6fb', 2);
  d.estrela(44, 42, 2.8, T.dourado);
  d.estrela(58, 36, 2.2, T.dourado);
  d.forma(elipse(50, 11, 2.8, 2.8, 0, 8), T.dourado, { esp: 1.2, contorno: 1 });
  }, { solta: true });
  d.rosto(50, 73, { esc: 1.02, boca: 'reta', pele: '#c9c2f2', rx: 3.4, ry: 4.3 });
}

function cacatua(d: Desenho): void {
  pezinhos(d, 50, 91, 8, PE_FRIO);
  // crista em leque (abre e fecha com o movimento; voa na captura)
  d.parte('topo', [50, 46], () => {
  const penas: [number, number][] = [
    [-34, 26],
    [-17, 30],
    [0, 32],
    [17, 30],
    [34, 26],
  ];
  for (const [ang, comp] of penas) {
    const a = ((ang - 90) * Math.PI) / 180;
    const bx = 50;
    const by = 44;
    const tx = bx + Math.cos(a) * comp;
    const ty = by + Math.sin(a) * comp;
    const px = -Math.sin(a) * 4.5;
    const py = Math.cos(a) * 4.5;
    d.forma(
      [
        [bx + px, by + py],
        [tx + px * 0.3, ty + py * 0.3],
        [tx, ty - 1, C],
        [tx - px * 0.3, ty - py * 0.3],
        [bx - px, by - py],
      ],
      T.roxo,
      { esp: 1.6, contorno: 1.2 },
    );
    d.forma(elipse(tx, ty - 1.5, 1.9, 1.9, 0, 6), T.dourado, { esp: 1.1, contorno: 0.8 });
  }
  }, { solta: true });
  // asas
  d.parte('braco', [34, 56], () => d.forma(elipse(29, 67, 7, 15, 15, 12), T.anil, { esp: 1.8 }), { lado: -1 });
  d.parte('braco', [66, 56], () => d.forma(elipse(71, 67, 7, 15, -15, 12), T.anil, { esp: 1.8 }), { lado: 1 });
  // corpo
  d.forma(elipse(50, 66, 21, 24, 0, 18), T.roxo, { esp: 2.0, opacidade: 0.85 });
  d.forma(elipse(50, 74, 12, 13, 0, 12), T.barriga, { esp: 2.8, contorno: 0.9, opacidade: 0.5 });
  // bico
  d.forma(
    [
      [46, 58, C],
      [54, 58, C],
      [50, 65, C],
    ],
    T.bico,
    { esp: 1.3, contorno: 1.1, tremor: 0.1 },
  );
  d.parte('topo', [50, 46], () => coroa(d, 50, 45, 16, 8, 'dama'), { solta: true });
  d.rosto(50, 53, { esc: 1, branco: true, boca: 'nenhuma', dist: 9, pele: '#7f77cf' });
}

function pinguim(d: Desenho): void {
  pezinhos(d, 50, 92, 10, PE_FRIO);
  // nadadeiras (batem ao pular)
  d.parte('braco', [27, 48], () => d.forma(elipse(22, 62, 6, 16, 22, 12), T.anil, { esp: 1.8 }), { lado: -1 });
  d.parte('braco', [73, 48], () => d.forma(elipse(78, 62, 6, 16, -22, 12), T.anil, { esp: 1.8 }), { lado: 1 });
  // corpo
  d.forma(
    [
      [50, 22],
      [66, 27],
      [76, 44],
      [79, 66],
      [72, 84],
      [58, 90],
      [42, 90],
      [28, 84],
      [21, 66],
      [24, 44],
      [34, 27],
    ],
    T.anil,
    { esp: 1.9, opacidade: 0.9 },
  );
  // barriga e rosto claro
  d.forma(
    [
      [50, 40],
      [62, 46],
      [67, 64],
      [63, 82],
      [50, 87],
      [37, 82],
      [33, 64],
      [38, 46],
    ],
    T.barriga,
    { esp: 2.8, contorno: 1, opacidade: 0.55 },
  );
  d.forma(
    [
      [46, 48, C],
      [54, 48, C],
      [50, 54, C],
    ],
    T.bico,
    { esp: 1.3, contorno: 1.1, tremor: 0.1 },
  );
  d.parte('topo', [50, 27], () => coroa(d, 50, 25, 26, 13, 'rei'), { solta: true });
  d.rosto(50, 41, { esc: 1.08, branco: true, boca: 'nenhuma', dist: 9, pele: '#e9e6fb' });
}

// ---------------------------------------------------------------- montagem

const DESENHOS: Record<Color, Record<PieceSymbol, (d: Desenho) => void>> = {
  w: { p: cogumelo, r: castelinho, n: (d) => ponei(d, true), b: broto, q: abelha, k: coruja },
  b: { p: fantasminha, r: peludo, n: (d) => ponei(d, false), b: mago, q: cacatua, k: pinguim },
};

export const NOME_PECA: Record<PieceSymbol, string> = {
  p: 'peão',
  n: 'cavalo',
  b: 'bispo',
  r: 'torre',
  q: 'dama',
  k: 'rei',
};

export const NOME_BICHO: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: 'cogumelo', r: 'castelinho', n: 'cervinho', b: 'broto', q: 'abelha rainha', k: 'coruja rei' },
  b: { p: 'fantasminha', r: 'peludo', n: 'unicórnio', b: 'mago', q: 'cacatua rainha', k: 'pinguim rei' },
};

interface Render {
  clips: string;
  corpo: string;
}
const renders = new Map<string, Render>();

function render(cor: Color, tipo: PieceSymbol): Render {
  const id = idPeca(cor, tipo);
  let r = renders.get(id);
  if (!r) {
    const d = new Desenho(id);
    DESENHOS[cor][tipo](d);
    r = d.resultado();
    renders.set(id, r);
  }
  return r;
}

/** Definições compartilhadas (recortes das hachuras) e símbolos para usos estáticos (painel, promoção). */
export function defsPecas(): string {
  let clips = '';
  let simbolos = '';
  for (const cor of ['w', 'b'] as Color[]) {
    for (const tipo of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) {
      const r = render(cor, tipo);
      clips += r.clips;
      simbolos += `<symbol id="${idPeca(cor, tipo)}" viewBox="0 0 100 100" overflow="visible"><g class="bicho">${corpoComPostura(r.corpo)}</g></symbol>`;
    }
  }
  return `${clips}${simbolos}`;
}

function corpoComPostura(corpo: string): string {
  return `<g class="postura" style="transform-origin:50px 92px">${corpo}</g>`;
}

const moldes = new Map<string, SVGGElement>();

/**
 * Cria o grupo de um bicho para o tabuleiro: cada peça do jogo tem o seu
 * próprio conjunto de partes (olhos, topo, braços...) para animar separadamente.
 * Os recortes das hachuras vêm de `defsPecas` (ids compartilhados).
 */
export function criarBicho(cor: Color, tipo: PieceSymbol): SVGGElement {
  const id = idPeca(cor, tipo);
  let molde = moldes.get(id);
  if (!molde) {
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g') as SVGGElement;
    g.setAttribute('class', 'escala');
    g.setAttribute('transform', 'translate(-11 -24) scale(1.22)');
    g.innerHTML = corpoComPostura(render(cor, tipo).corpo);
    molde = g;
    moldes.set(id, molde);
  }
  return molde.cloneNode(true) as SVGGElement;
}

export function idPeca(cor: Color, tipo: PieceSymbol): string {
  return `peca-${cor}${tipo}`;
}

/** SVG avulso de uma peça (painel, promoção). */
export function svgPecaAvulsa(cor: Color, tipo: PieceSymbol, classe = ''): string {
  return `<svg class="${classe}" viewBox="0 -8 100 108" aria-hidden="true" overflow="visible"><use href="#${idPeca(cor, tipo)}" width="100" height="100"/></svg>`;
}
