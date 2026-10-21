/**
 * Motor de xadrez próprio do "Xadrez de Caderno".
 *
 * Tabuleiro em caixa de correio 10x12, geração de lances legais completa
 * (roque, en passant, promoção), avaliação material + tabelas de posição
 * e busca negamax com poda alfa-beta, busca de quiescência, tabela de
 * transposição, lances assassinos e aprofundamento iterativo.
 *
 * Este arquivo é puro (sem DOM): roda dentro do Web Worker e também nos testes.
 */

// ---------------------------------------------------------------------------
// Representação
// ---------------------------------------------------------------------------

export const VAZIO = 0;
export const PEAO = 1;
export const CAVALO = 2;
export const BISPO = 3;
export const TORRE = 4;
export const DAMA = 5;
export const REI = 6;
export const BRANCO = 0;
export const PRETO = 8;
const FORA = 16;

const F_CAPTURA = 1;
const F_EP = 2;
const F_ROQUE = 4;
const F_DUPLO = 8;

const N_DIRS = [-21, -19, -12, -8, 8, 12, 19, 21];
const B_DIRS = [-11, -9, 9, 11];
const R_DIRS = [-10, -1, 1, 10];
const K_DIRS = [-11, -10, -9, -1, 1, 9, 10, 11];

const sq = (file: number, rank: number) => 21 + file + rank * 10;
const fileOf = (s: number) => (s % 10) - 1;
const rankOf = (s: number) => Math.floor(s / 10) - 2;

export function nomeCasa(s: number): string {
  return 'abcdefgh'[fileOf(s)] + String(rankOf(s) + 1);
}
export function casaDeNome(n: string): number {
  return sq(n.charCodeAt(0) - 97, n.charCodeAt(1) - 49);
}

// Máscaras de direito de roque: 1=K branco, 2=Q branco, 4=k preto, 8=q preto
const MASCARA_ROQUE = new Uint8Array(120).fill(15);
MASCARA_ROQUE[sq(4, 0)] = 15 & ~3;
MASCARA_ROQUE[sq(0, 0)] = 15 & ~2;
MASCARA_ROQUE[sq(7, 0)] = 15 & ~1;
MASCARA_ROQUE[sq(4, 7)] = 15 & ~12;
MASCARA_ROQUE[sq(0, 7)] = 15 & ~8;
MASCARA_ROQUE[sq(7, 7)] = 15 & ~4;

export const deLance = (m: number) => m & 127;
export const paraLance = (m: number) => (m >> 7) & 127;
const promoLance = (m: number) => (m >> 14) & 7;
const flagsLance = (m: number) => (m >> 17) & 15;
const criaLance = (de: number, para: number, promo: number, flags: number) =>
  de | (para << 7) | (promo << 14) | (flags << 17);

// ---------------------------------------------------------------------------
// Zobrist (duas chaves de 32 bits) com semente fixa
// ---------------------------------------------------------------------------

let semente = 0x9e3779b9;
function aleatorio32(): number {
  semente ^= semente << 13;
  semente ^= semente >>> 17;
  semente ^= semente << 5;
  return semente | 0;
}
const Z1 = new Int32Array(16 * 120);
const Z2 = new Int32Array(16 * 120);
for (let i = 0; i < Z1.length; i++) {
  Z1[i] = aleatorio32();
  Z2[i] = aleatorio32();
}
const ZV1 = aleatorio32();
const ZV2 = aleatorio32();
const ZR1 = new Int32Array(16);
const ZR2 = new Int32Array(16);
for (let i = 0; i < 16; i++) {
  ZR1[i] = aleatorio32();
  ZR2[i] = aleatorio32();
}
const ZE1 = new Int32Array(120);
const ZE2 = new Int32Array(120);
for (let i = 0; i < 120; i++) {
  ZE1[i] = aleatorio32();
  ZE2[i] = aleatorio32();
}

// ---------------------------------------------------------------------------
// Avaliação (tabelas "simplified evaluation function", vista das brancas,
// índice 0 = a8)
// ---------------------------------------------------------------------------

const VALOR = [0, 100, 320, 330, 500, 900, 0];

const PST_PEAO = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
  10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
  -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_CAVALO = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
  0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
  5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_BISPO = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
  -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
  -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];
const PST_TORRE = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
  0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
  5, 5, 0, 0, 0,
];
const PST_DAMA = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0,
  0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_REI_MEIO = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
  -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
  10, 30, 20,
];
const PST_REI_FINAL = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30,
  30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30,
  -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30,
  -50,
];
const PSTS = [null, PST_PEAO, PST_CAVALO, PST_BISPO, PST_TORRE, PST_DAMA];
const FASE = [0, 0, 1, 1, 2, 4, 0];

// ---------------------------------------------------------------------------
// Posição
// ---------------------------------------------------------------------------

export const MATE = 30000;

export class Posicao {
  tab = new Uint8Array(120);
  lado = BRANCO; // BRANCO ou PRETO
  roque = 0;
  ep = 0; // casa de en passant (0 = nenhuma)
  meiosLances = 0;
  reis = [0, 0];
  h1 = 0;
  h2 = 0;

  // pilhas para desfazer
  private pCap: number[] = [];
  private pRoque: number[] = [];
  private pEp: number[] = [];
  private pMeios: number[] = [];
  private pH1: number[] = [];
  private pH2: number[] = [];
  historicoH1: number[] = [];
  historicoH2: number[] = [];
  /** Lances atualmente aplicados (permite desfazer tudo se a busca for interrompida). */
  lancesFeitos: number[] = [];

  constructor(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    this.carregar(fen);
  }

  carregar(fen: string): void {
    this.tab.fill(FORA);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) this.tab[sq(f, r)] = VAZIO;
    const [disp, vez, roque, ep, meios] = fen.trim().split(/\s+/);
    let r = 7;
    let f = 0;
    for (const c of disp) {
      if (c === '/') {
        r--;
        f = 0;
      } else if (c >= '1' && c <= '8') {
        f += Number(c);
      } else {
        const tipo = 'pnbrqk'.indexOf(c.toLowerCase()) + 1;
        const cor = c === c.toLowerCase() ? PRETO : BRANCO;
        this.tab[sq(f, r)] = tipo | cor;
        if (tipo === REI) this.reis[cor >> 3] = sq(f, r);
        f++;
      }
    }
    this.lado = vez === 'b' ? PRETO : BRANCO;
    this.roque = 0;
    if (roque && roque !== '-') {
      if (roque.includes('K')) this.roque |= 1;
      if (roque.includes('Q')) this.roque |= 2;
      if (roque.includes('k')) this.roque |= 4;
      if (roque.includes('q')) this.roque |= 8;
    }
    this.ep = ep && ep !== '-' ? casaDeNome(ep) : 0;
    this.meiosLances = meios ? Number(meios) || 0 : 0;
    this.recalcularHash();
    this.historicoH1 = [this.h1];
    this.historicoH2 = [this.h2];
    this.lancesFeitos = [];
  }

  private recalcularHash(): void {
    let a = 0;
    let b = 0;
    for (let s = 21; s < 99; s++) {
      const p = this.tab[s];
      if (p !== VAZIO && p !== FORA) {
        a ^= Z1[p * 120 + s];
        b ^= Z2[p * 120 + s];
      }
    }
    if (this.lado === PRETO) {
      a ^= ZV1;
      b ^= ZV2;
    }
    a ^= ZR1[this.roque];
    b ^= ZR2[this.roque];
    if (this.ep) {
      a ^= ZE1[this.ep];
      b ^= ZE2[this.ep];
    }
    this.h1 = a;
    this.h2 = b;
  }

  atacada(s: number, porCor: number): boolean {
    const t = this.tab;
    // peões
    if (porCor === BRANCO) {
      if (t[s - 9] === (PEAO | BRANCO) || t[s - 11] === (PEAO | BRANCO)) return true;
    } else {
      if (t[s + 9] === (PEAO | PRETO) || t[s + 11] === (PEAO | PRETO)) return true;
    }
    const cav = CAVALO | porCor;
    for (let i = 0; i < 8; i++) if (t[s + N_DIRS[i]] === cav) return true;
    const rei = REI | porCor;
    for (let i = 0; i < 8; i++) if (t[s + K_DIRS[i]] === rei) return true;
    const bis = BISPO | porCor;
    const tor = TORRE | porCor;
    const dam = DAMA | porCor;
    for (let i = 0; i < 4; i++) {
      const d = B_DIRS[i];
      let x = s + d;
      while (t[x] === VAZIO) x += d;
      if (t[x] === bis || t[x] === dam) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = R_DIRS[i];
      let x = s + d;
      while (t[x] === VAZIO) x += d;
      if (t[x] === tor || t[x] === dam) return true;
    }
    return false;
  }

  emXeque(): boolean {
    return this.atacada(this.reis[this.lado >> 3], this.lado ^ PRETO);
  }

  /** Gera lances pseudo-legais (o rei pode ficar em xeque). */
  gerar(lista: number[], soCapturas = false): void {
    const t = this.tab;
    const eu = this.lado;
    const ele = eu ^ PRETO;
    const frente = eu === BRANCO ? 10 : -10;
    const rankInicial = eu === BRANCO ? 1 : 6;
    const rankPromo = eu === BRANCO ? 7 : 0;
    for (let s = 21; s < 99; s++) {
      const p = t[s];
      if (p === VAZIO || p === FORA || (p & 8) !== eu) continue;
      const tipo = p & 7;
      if (tipo === PEAO) {
        const um = s + frente;
        // capturas
        for (const lado of [frente - 1, frente + 1]) {
          const alvo = s + lado;
          const q = t[alvo];
          if (q !== VAZIO && q !== FORA && (q & 8) === ele) {
            if (rankOf(alvo) === rankPromo) {
              for (let pr = DAMA; pr >= CAVALO; pr--) lista.push(criaLance(s, alvo, pr, F_CAPTURA));
            } else lista.push(criaLance(s, alvo, 0, F_CAPTURA));
          } else if (alvo === this.ep && this.ep !== 0) {
            lista.push(criaLance(s, alvo, 0, F_CAPTURA | F_EP));
          }
        }
        if (t[um] === VAZIO) {
          if (rankOf(um) === rankPromo) {
            for (let pr = DAMA; pr >= CAVALO; pr--)
              if (!soCapturas || pr === DAMA) lista.push(criaLance(s, um, pr, 0));
          } else if (!soCapturas) {
            lista.push(criaLance(s, um, 0, 0));
            if (rankOf(s) === rankInicial && t[um + frente] === VAZIO)
              lista.push(criaLance(s, um + frente, 0, F_DUPLO));
          }
        }
        continue;
      }
      if (tipo === CAVALO || tipo === REI) {
        const dirs = tipo === CAVALO ? N_DIRS : K_DIRS;
        for (let i = 0; i < 8; i++) {
          const alvo = s + dirs[i];
          const q = t[alvo];
          if (q === FORA) continue;
          if (q === VAZIO) {
            if (!soCapturas) lista.push(criaLance(s, alvo, 0, 0));
          } else if ((q & 8) === ele) lista.push(criaLance(s, alvo, 0, F_CAPTURA));
        }
        if (tipo === REI && !soCapturas) this.gerarRoques(lista, s);
        continue;
      }
      const dirs = tipo === BISPO ? B_DIRS : tipo === TORRE ? R_DIRS : K_DIRS;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        let alvo = s + d;
        while (true) {
          const q = t[alvo];
          if (q === FORA) break;
          if (q === VAZIO) {
            if (!soCapturas) lista.push(criaLance(s, alvo, 0, 0));
          } else {
            if ((q & 8) === ele) lista.push(criaLance(s, alvo, 0, F_CAPTURA));
            break;
          }
          alvo += d;
        }
      }
    }
  }

  private gerarRoques(lista: number[], s: number): void {
    const t = this.tab;
    const eu = this.lado;
    const ele = eu ^ PRETO;
    if (eu === BRANCO) {
      if (s !== sq(4, 0)) return;
      if (this.roque & 1 && t[sq(5, 0)] === VAZIO && t[sq(6, 0)] === VAZIO && t[sq(7, 0)] === (TORRE | BRANCO)) {
        if (!this.atacada(s, ele) && !this.atacada(sq(5, 0), ele) && !this.atacada(sq(6, 0), ele))
          lista.push(criaLance(s, sq(6, 0), 0, F_ROQUE));
      }
      if (this.roque & 2 && t[sq(3, 0)] === VAZIO && t[sq(2, 0)] === VAZIO && t[sq(1, 0)] === VAZIO && t[sq(0, 0)] === (TORRE | BRANCO)) {
        if (!this.atacada(s, ele) && !this.atacada(sq(3, 0), ele) && !this.atacada(sq(2, 0), ele))
          lista.push(criaLance(s, sq(2, 0), 0, F_ROQUE));
      }
    } else {
      if (s !== sq(4, 7)) return;
      if (this.roque & 4 && t[sq(5, 7)] === VAZIO && t[sq(6, 7)] === VAZIO && t[sq(7, 7)] === (TORRE | PRETO)) {
        if (!this.atacada(s, ele) && !this.atacada(sq(5, 7), ele) && !this.atacada(sq(6, 7), ele))
          lista.push(criaLance(s, sq(6, 7), 0, F_ROQUE));
      }
      if (this.roque & 8 && t[sq(3, 7)] === VAZIO && t[sq(2, 7)] === VAZIO && t[sq(1, 7)] === VAZIO && t[sq(0, 7)] === (TORRE | PRETO)) {
        if (!this.atacada(s, ele) && !this.atacada(sq(3, 7), ele) && !this.atacada(sq(2, 7), ele))
          lista.push(criaLance(s, sq(2, 7), 0, F_ROQUE));
      }
    }
  }

  private xorPeca(p: number, s: number): void {
    this.h1 ^= Z1[p * 120 + s];
    this.h2 ^= Z2[p * 120 + s];
  }

  /** Executa um lance; devolve false (e desfaz) se deixar o rei em xeque. */
  fazer(m: number): boolean {
    const t = this.tab;
    const de = deLance(m);
    const para = paraLance(m);
    const fl = flagsLance(m);
    const promo = promoLance(m);
    const p = t[de];
    const eu = this.lado;

    this.lancesFeitos.push(m);
    this.pRoque.push(this.roque);
    this.pEp.push(this.ep);
    this.pMeios.push(this.meiosLances);
    this.pH1.push(this.h1);
    this.pH2.push(this.h2);

    let capturada = t[para];
    if (fl & F_EP) {
      const casaCap = para + (eu === BRANCO ? -10 : 10);
      capturada = t[casaCap];
      t[casaCap] = VAZIO;
      this.xorPeca(capturada, casaCap);
    } else if (capturada !== VAZIO) {
      this.xorPeca(capturada, para);
    }
    this.pCap.push(capturada);

    this.xorPeca(p, de);
    t[de] = VAZIO;
    const nova = promo ? promo | eu : p;
    t[para] = nova;
    this.xorPeca(nova, para);

    if ((p & 7) === REI) {
      this.reis[eu >> 3] = para;
      if (fl & F_ROQUE) {
        let tDe: number;
        let tPara: number;
        if (para > de) {
          tDe = para + 1;
          tPara = para - 1;
        } else {
          tDe = para - 2;
          tPara = para + 1;
        }
        const torre = t[tDe];
        t[tDe] = VAZIO;
        t[tPara] = torre;
        this.xorPeca(torre, tDe);
        this.xorPeca(torre, tPara);
      }
    }

    // roque / en passant / contadores
    this.h1 ^= ZR1[this.roque];
    this.h2 ^= ZR2[this.roque];
    this.roque &= MASCARA_ROQUE[de] & MASCARA_ROQUE[para];
    this.h1 ^= ZR1[this.roque];
    this.h2 ^= ZR2[this.roque];
    if (this.ep) {
      this.h1 ^= ZE1[this.ep];
      this.h2 ^= ZE2[this.ep];
    }
    this.ep = fl & F_DUPLO ? (de + para) >> 1 : 0;
    if (this.ep) {
      this.h1 ^= ZE1[this.ep];
      this.h2 ^= ZE2[this.ep];
    }
    this.meiosLances = (p & 7) === PEAO || capturada !== VAZIO ? 0 : this.meiosLances + 1;
    this.lado ^= PRETO;
    this.h1 ^= ZV1;
    this.h2 ^= ZV2;
    this.historicoH1.push(this.h1);
    this.historicoH2.push(this.h2);

    if (this.atacada(this.reis[eu >> 3], this.lado)) {
      this.desfazer(m);
      return false;
    }
    return true;
  }

  desfazer(m: number): void {
    const t = this.tab;
    const de = deLance(m);
    const para = paraLance(m);
    const fl = flagsLance(m);
    const promo = promoLance(m);
    this.historicoH1.pop();
    this.historicoH2.pop();
    this.lancesFeitos.pop();
    this.lado ^= PRETO;
    const eu = this.lado;
    const capturada = this.pCap.pop()!;
    this.roque = this.pRoque.pop()!;
    this.ep = this.pEp.pop()!;
    this.meiosLances = this.pMeios.pop()!;
    this.h1 = this.pH1.pop()!;
    this.h2 = this.pH2.pop()!;

    const movida = t[para];
    t[de] = promo ? PEAO | eu : movida;
    if (fl & F_EP) {
      t[para] = VAZIO;
      t[para + (eu === BRANCO ? -10 : 10)] = capturada;
    } else {
      t[para] = capturada;
    }
    if ((movida & 7) === REI && !promo) {
      this.reis[eu >> 3] = de;
      if (fl & F_ROQUE) {
        let tDe: number;
        let tPara: number;
        if (para > de) {
          tDe = para + 1;
          tPara = para - 1;
        } else {
          tDe = para - 2;
          tPara = para + 1;
        }
        t[tDe] = t[tPara];
        t[tPara] = VAZIO;
      }
    }
  }

  lancesLegais(): number[] {
    const pseudo: number[] = [];
    this.gerar(pseudo);
    const legais: number[] = [];
    for (const m of pseudo) {
      if (this.fazer(m)) {
        legais.push(m);
        this.desfazer(m);
      }
    }
    return legais;
  }

  /** A posição atual já ocorreu antes (desde o último lance irreversível)? */
  repetida(): boolean {
    const n = this.historicoH1.length - 1;
    const limite = Math.max(0, n - this.meiosLances);
    for (let i = n - 2; i >= limite; i -= 2) {
      if (this.historicoH1[i] === this.h1 && this.historicoH2[i] === this.h2) return true;
    }
    return false;
  }

  avaliar(): number {
    const t = this.tab;
    let mg = 0;
    let fase = 0;
    let reiB = 0;
    let reiP = 0;
    let bisposB = 0;
    let bisposP = 0;
    for (let s = 21; s < 99; s++) {
      const p = t[s];
      if (p === VAZIO || p === FORA) continue;
      const tipo = p & 7;
      const f = fileOf(s);
      const r = rankOf(s);
      if (p & PRETO) {
        const idx = r * 8 + f;
        if (tipo === REI) reiP = idx;
        else {
          mg -= VALOR[tipo] + PSTS[tipo]![idx];
          fase += FASE[tipo];
          if (tipo === BISPO) bisposP++;
        }
      } else {
        const idx = (7 - r) * 8 + f;
        if (tipo === REI) reiB = idx;
        else {
          mg += VALOR[tipo] + PSTS[tipo]![idx];
          fase += FASE[tipo];
          if (tipo === BISPO) bisposB++;
        }
      }
    }
    if (bisposB >= 2) mg += 30;
    if (bisposP >= 2) mg -= 30;
    const fz = Math.min(fase, 24);
    const rei =
      ((PST_REI_MEIO[reiB] - PST_REI_MEIO[reiP]) * fz + (PST_REI_FINAL[reiB] - PST_REI_FINAL[reiP]) * (24 - fz)) / 24;
    const total = mg + rei;
    return this.lado === BRANCO ? total : -total;
  }

  /** Desfaz lances até restarem `n` aplicados. */
  voltarPara(n: number): void {
    while (this.lancesFeitos.length > n) this.desfazer(this.lancesFeitos[this.lancesFeitos.length - 1]);
  }

  perft(prof: number): number {
    if (prof === 0) return 1;
    const lista: number[] = [];
    this.gerar(lista);
    let n = 0;
    for (const m of lista) {
      if (this.fazer(m)) {
        n += prof === 1 ? 1 : this.perft(prof - 1);
        this.desfazer(m);
      }
    }
    return n;
  }
}

export function lanceParaUci(m: number): string {
  const promo = promoLance(m);
  return nomeCasa(deLance(m)) + nomeCasa(paraLance(m)) + (promo ? ' nbrq'[promo - 1] : '');
}

export function acharLance(pos: Posicao, uci: string): number | null {
  for (const m of pos.lancesLegais()) if (lanceParaUci(m) === uci) return m;
  return null;
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

export type Nivel = 'facil' | 'medio' | 'dificil';

export interface ConfigNivel {
  profundidadeMax: number;
  tempoMs: number;
  ruido: number; // centipeões de ruído aleatório na raiz
  chanceAleatorio: number; // chance de jogar um lance legal qualquer
}

export const NIVEIS: Record<Nivel, ConfigNivel> = {
  facil: { profundidadeMax: 1, tempoMs: 400, ruido: 140, chanceAleatorio: 0.18 },
  medio: { profundidadeMax: 3, tempoMs: 1200, ruido: 18, chanceAleatorio: 0 },
  dificil: { profundidadeMax: 32, tempoMs: 2200, ruido: 0, chanceAleatorio: 0 },
};

const TT_TAM = 1 << 19;
const TT_MASCARA = TT_TAM - 1;
const TT_EXATO = 1;
const TT_INF = 2; // limite inferior (beta cutoff)
const TT_SUP = 3; // limite superior

class Abortar extends Error {}

export class Buscador {
  private ttChave = new Int32Array(TT_TAM);
  private ttLance = new Int32Array(TT_TAM);
  private ttValor = new Int32Array(TT_TAM);
  private ttProf = new Int8Array(TT_TAM);
  private ttTipo = new Uint8Array(TT_TAM);
  private assassinos = new Int32Array(128 * 2);
  private historia = new Int32Array(16 * 120);
  private nos = 0;
  private limite = 0;
  private agora: () => number;
  nosTotais = 0;
  profundidadeAtingida = 0;

  constructor(agora: () => number = () => Date.now()) {
    this.agora = agora;
  }

  private pontuarLances(pos: Posicao, lances: number[], ttLance: number, ply: number): Int32Array {
    const pts = new Int32Array(lances.length);
    const k1 = this.assassinos[ply * 2];
    const k2 = this.assassinos[ply * 2 + 1];
    for (let i = 0; i < lances.length; i++) {
      const m = lances[i];
      if (m === ttLance) pts[i] = 1_000_000;
      else if (flagsLance(m) & F_CAPTURA) {
        const vitima = flagsLance(m) & F_EP ? PEAO : pos.tab[paraLance(m)] & 7;
        const atacante = pos.tab[deLance(m)] & 7;
        pts[i] = 100_000 + VALOR[vitima] * 10 - VALOR[atacante] / 10 + (promoLance(m) ? 5000 : 0);
      } else if (promoLance(m)) pts[i] = 90_000 + VALOR[promoLance(m)];
      else if (m === k1) pts[i] = 80_000;
      else if (m === k2) pts[i] = 79_000;
      else pts[i] = this.historia[pos.tab[deLance(m)] * 120 + paraLance(m)];
    }
    return pts;
  }

  private static escolherProximo(lances: number[], pts: Int32Array, i: number): void {
    let melhor = i;
    for (let j = i + 1; j < lances.length; j++) if (pts[j] > pts[melhor]) melhor = j;
    if (melhor !== i) {
      const tm = lances[i];
      lances[i] = lances[melhor];
      lances[melhor] = tm;
      const tp = pts[i];
      pts[i] = pts[melhor];
      pts[melhor] = tp;
    }
  }

  private checarTempo(): void {
    if ((++this.nos & 2047) === 0 && this.agora() > this.limite) throw new Abortar();
  }

  private quiescencia(pos: Posicao, alfa: number, beta: number, ply: number): number {
    this.checarTempo();
    const parado = pos.avaliar();
    if (ply >= 100) return parado;
    if (parado >= beta) return parado;
    if (parado > alfa) alfa = parado;
    const lances: number[] = [];
    pos.gerar(lances, true);
    const pts = this.pontuarLances(pos, lances, 0, Math.min(ply, 127));
    for (let i = 0; i < lances.length; i++) {
      Buscador.escolherProximo(lances, pts, i);
      const m = lances[i];
      if (!pos.fazer(m)) continue;
      const v = -this.quiescencia(pos, -beta, -alfa, ply + 1);
      pos.desfazer(m);
      if (v >= beta) return v;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }

  private negamax(pos: Posicao, prof: number, alfa: number, beta: number, ply: number): number {
    this.checarTempo();
    if (ply > 0 && (pos.meiosLances >= 100 || pos.repetida())) return 0;
    const emXeque = pos.emXeque();
    if (emXeque && ply < 60) prof++;
    if (prof <= 0) return this.quiescencia(pos, alfa, beta, ply);

    const idx = pos.h1 & TT_MASCARA;
    let ttLance = 0;
    if (this.ttChave[idx] === pos.h2) {
      ttLance = this.ttLance[idx];
      if (ply > 0 && this.ttProf[idx] >= prof) {
        let v = this.ttValor[idx];
        if (v > MATE - 200) v -= ply;
        else if (v < -MATE + 200) v += ply;
        const tipo = this.ttTipo[idx];
        if (tipo === TT_EXATO) return v;
        if (tipo === TT_INF && v >= beta) return v;
        if (tipo === TT_SUP && v <= alfa) return v;
      }
    }

    const lances: number[] = [];
    pos.gerar(lances);
    const pts = this.pontuarLances(pos, lances, ttLance, Math.min(ply, 127));
    const alfaOriginal = alfa;
    let melhor = -MATE - 1;
    let melhorLance = 0;
    let legais = 0;
    for (let i = 0; i < lances.length; i++) {
      Buscador.escolherProximo(lances, pts, i);
      const m = lances[i];
      if (!pos.fazer(m)) continue;
      legais++;
      const v = -this.negamax(pos, prof - 1, -beta, -alfa, ply + 1);
      pos.desfazer(m);
      if (v > melhor) {
        melhor = v;
        melhorLance = m;
      }
      if (v > alfa) alfa = v;
      if (alfa >= beta) {
        if (!(flagsLance(m) & F_CAPTURA)) {
          const p = Math.min(ply, 127);
          if (this.assassinos[p * 2] !== m) {
            this.assassinos[p * 2 + 1] = this.assassinos[p * 2];
            this.assassinos[p * 2] = m;
          }
          this.historia[pos.tab[deLance(m)] * 120 + paraLance(m)] += prof * prof;
        }
        break;
      }
    }
    if (legais === 0) return emXeque ? -MATE + ply : 0;

    let guardar = melhor;
    if (guardar > MATE - 200) guardar += ply;
    else if (guardar < -MATE + 200) guardar -= ply;
    this.ttChave[idx] = pos.h2;
    this.ttLance[idx] = melhorLance;
    this.ttValor[idx] = guardar;
    this.ttProf[idx] = prof;
    this.ttTipo[idx] = melhor <= alfaOriginal ? TT_SUP : melhor >= beta ? TT_INF : TT_EXATO;
    return melhor;
  }

  /**
   * Escolhe um lance para o lado que joga. `aleatorio` permite testes
   * determinísticos.
   */
  escolher(pos: Posicao, nivel: Nivel, aleatorio: () => number = Math.random): number | null {
    const cfg = NIVEIS[nivel];
    const raiz = pos.lancesLegais();
    if (raiz.length === 0) return null;
    if (raiz.length === 1) return raiz[0];
    this.nosTotais = 0;
    this.nos = 0;
    this.profundidadeAtingida = 0;

    if (cfg.chanceAleatorio > 0 && aleatorio() < cfg.chanceAleatorio) {
      return raiz[Math.floor(aleatorio() * raiz.length)];
    }

    this.limite = this.agora() + cfg.tempoMs;
    const base = pos.lancesFeitos.length;
    this.assassinos.fill(0);
    this.historia.fill(0);

    // Níveis com ruído: avalia cada lance da raiz com janela completa.
    if (cfg.ruido > 0) {
      let melhorLance = raiz[0];
      for (let prof = 1; prof <= cfg.profundidadeMax; prof++) {
        try {
          let melhorValor = -Infinity;
          let candidato = raiz[0];
          for (const m of raiz) {
            pos.fazer(m);
            const v = -this.negamax(pos, prof - 1, -MATE - 1, MATE + 1, 1);
            pos.desfazer(m);
            const comRuido = v + (aleatorio() * 2 - 1) * cfg.ruido;
            if (comRuido > melhorValor) {
              melhorValor = comRuido;
              candidato = m;
            }
          }
          melhorLance = candidato;
          this.profundidadeAtingida = prof;
        } catch (e) {
          pos.voltarPara(base);
          if (!(e instanceof Abortar)) throw e;
          break;
        }
      }
      this.nosTotais = this.nos;
      return melhorLance;
    }

    // Nível difícil: aprofundamento iterativo com alfa-beta completo na raiz.
    let melhorLance = raiz[0];
    for (let prof = 1; prof <= cfg.profundidadeMax; prof++) {
      let alfa = -MATE - 1;
      const beta = MATE + 1;
      let candidato = 0;
      // lance anterior primeiro
      raiz.sort((a, b) => (a === melhorLance ? -1 : b === melhorLance ? 1 : 0));
      try {
        for (const m of raiz) {
          pos.fazer(m);
          const v = -this.negamax(pos, prof - 1, -beta, -alfa, 1);
          pos.desfazer(m);
          if (v > alfa) {
            alfa = v;
            candidato = m;
          }
        }
        melhorLance = candidato || melhorLance;
        this.profundidadeAtingida = prof;
        if (alfa > MATE - 200) break; // mate encontrado
      } catch (e) {
        pos.voltarPara(base);
        if (!(e instanceof Abortar)) throw e;
        // Se a iteração parcial já encontrou algo melhor que o lance principal, aproveita.
        if (candidato) melhorLance = candidato;
        break;
      }
      if (this.agora() > this.limite - cfg.tempoMs * 0.45) break; // não começa iteração que não termina
    }
    this.nosTotais = this.nos;
    return melhorLance;
  }
}
