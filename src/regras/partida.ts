/**
 * Camada de regras: envolve o chess.js (validação de lances, xeque, mate,
 * afogamento, repetição etc.) e acrescenta a distinção entre empates
 * automáticos e empates que precisam ser reivindicados.
 *
 * Política de empates (chess.js 1.4 considera "isDraw()" verdadeiro para
 * tripla repetição e regra dos 50 lances; aqui seguimos as Leis da FIDE):
 *  - Automáticos: afogamento, material insuficiente (detector do chess.js),
 *    quíntupla repetição e regra dos 75 lances (calculados aqui).
 *  - Por reivindicação: tripla repetição (isThreefoldRepetition) e regra
 *    dos 50 lances (isDrawByFiftyMoves) — o jogador pode reivindicar ou seguir jogando.
 */
import { Chess, type Move, type PieceSymbol, type Square, type Color } from 'chess.js';

export type Cor = Color;
export type { Move, PieceSymbol, Square };

export type TipoFim =
  | 'xequemate'
  | 'afogamento'
  | 'material'
  | 'quintupla'
  | 'setentaecinco'
  | 'reivindicado-tripla'
  | 'reivindicado-cinquenta';

export interface Fim {
  tipo: TipoFim;
  vencedor: Cor | null;
  titulo: string;
  detalhe: string;
}

export interface Situacao {
  vez: Cor;
  xeque: boolean;
  fim: Fim | null;
  reivindicavel: 'tripla' | 'cinquenta' | null;
}

export interface LanceSimples {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export const NOME_COR: Record<Cor, string> = { w: 'brancas', b: 'pretas' };
export const NOME_TINTA: Record<Cor, string> = { w: 'time laranja', b: 'time roxo' };

function chavePosicao(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export class Partida {
  private xadrez = new Chess();
  private reivindicado: 'tripla' | 'cinquenta' | null = null;

  get fen(): string {
    return this.xadrez.fen();
  }

  vez(): Cor {
    return this.xadrez.turn();
  }

  peca(casa: Square) {
    return this.xadrez.get(casa);
  }

  tabuleiro() {
    return this.xadrez.board();
  }

  historico(): Move[] {
    return this.xadrez.history({ verbose: true });
  }

  ultimo(): Move | null {
    const h = this.historico();
    return h.length ? h[h.length - 1] : null;
  }

  lancesDe(casa: Square): Move[] {
    if (this.situacao().fim) return [];
    return this.xadrez.moves({ square: casa, verbose: true });
  }

  todosLances(): Move[] {
    if (this.situacao().fim) return [];
    return this.xadrez.moves({ verbose: true });
  }

  /** Tenta jogar; devolve o lance ou null se ilegal ou partida encerrada. */
  jogar(l: LanceSimples): Move | null {
    if (this.situacao().fim) return null;
    try {
      return this.xadrez.move({ from: l.from, to: l.to, promotion: l.promotion });
    } catch {
      return null;
    }
  }

  jogarUci(uci: string): Move | null {
    return this.jogar({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: (uci[4] as PieceSymbol) || undefined,
    });
  }

  desfazer(): Move | null {
    this.reivindicado = null;
    return this.xadrez.undo();
  }

  reiniciar(): void {
    this.xadrez.reset();
    this.reivindicado = null;
  }

  reivindicarEmpate(): boolean {
    const s = this.situacao();
    if (s.fim || !s.reivindicavel) return false;
    this.reivindicado = s.reivindicavel;
    return true;
  }

  uci(): string[] {
    return this.historico().map((m) => m.from + m.to + (m.promotion ?? ''));
  }

  /** Quantas vezes a posição atual apareceu na partida. */
  contagemRepeticao(): number {
    const h = this.historico();
    const atual = chavePosicao(this.xadrez.fen());
    let n = 0;
    const posicoes = h.length ? [h[0].before, ...h.map((m) => m.after)] : [this.xadrez.fen()];
    for (const f of posicoes) if (chavePosicao(f) === atual) n++;
    return n;
  }

  meiosLances(): number {
    return Number(this.xadrez.fen().split(' ')[4]) || 0;
  }

  situacao(): Situacao {
    const x = this.xadrez;
    const vez = x.turn();
    const xeque = x.inCheck();
    const base = { vez, xeque, reivindicavel: null } as Situacao;
    const outra: Cor = vez === 'w' ? 'b' : 'w';

    if (x.isCheckmate()) {
      return {
        ...base,
        fim: {
          tipo: 'xequemate',
          vencedor: outra,
          titulo: 'Xeque-mate!',
          detalhe: `As ${NOME_COR[outra]} (${NOME_TINTA[outra]}) vencem.`,
        },
      };
    }
    if (x.isStalemate()) {
      return {
        ...base,
        fim: {
          tipo: 'afogamento',
          vencedor: null,
          titulo: 'Afogamento',
          detalhe: `As ${NOME_COR[vez]} não têm lances legais e não estão em xeque. Empate.`,
        },
      };
    }
    if (x.isInsufficientMaterial()) {
      return {
        ...base,
        fim: {
          tipo: 'material',
          vencedor: null,
          titulo: 'Empate',
          detalhe: 'Material insuficiente para dar xeque-mate.',
        },
      };
    }
    const rep = this.contagemRepeticao();
    if (rep >= 5) {
      return {
        ...base,
        fim: {
          tipo: 'quintupla',
          vencedor: null,
          titulo: 'Empate',
          detalhe: 'A mesma posição apareceu cinco vezes (empate automático).',
        },
      };
    }
    if (this.meiosLances() >= 150) {
      return {
        ...base,
        fim: {
          tipo: 'setentaecinco',
          vencedor: null,
          titulo: 'Empate',
          detalhe: '75 lances de cada lado sem captura nem movimento de peão (empate automático).',
        },
      };
    }
    if (this.reivindicado) {
      return {
        ...base,
        fim: {
          tipo: this.reivindicado === 'tripla' ? 'reivindicado-tripla' : 'reivindicado-cinquenta',
          vencedor: null,
          titulo: 'Empate reivindicado',
          detalhe:
            this.reivindicado === 'tripla'
              ? 'Por tripla repetição de posição.'
              : 'Pela regra dos 50 lances.',
        },
      };
    }
    let reivindicavel: Situacao['reivindicavel'] = null;
    if (x.isThreefoldRepetition()) reivindicavel = 'tripla';
    else if (x.isDrawByFiftyMoves()) reivindicavel = 'cinquenta';
    return { ...base, fim: null, reivindicavel };
  }

  /** Peças de quem joga que estão sendo atacadas pelo adversário (ficam "suando"). */
  ameacadas(): Square[] {
    if (this.situacao().fim) return [];
    const vez = this.xadrez.turn();
    const outra: Cor = vez === 'w' ? 'b' : 'w';
    const r: Square[] = [];
    for (const linha of this.xadrez.board())
      for (const c of linha) if (c && c.color === vez && this.xadrez.isAttacked(c.square, outra)) r.push(c.square);
    return r;
  }

  /** Peças perdidas por cada cor (para o painel de capturas). */
  capturadas(): Record<Cor, PieceSymbol[]> {
    const r: Record<Cor, PieceSymbol[]> = { w: [], b: [] };
    for (const m of this.historico()) {
      if (m.captured) r[m.color === 'w' ? 'b' : 'w'].push(m.captured);
    }
    const ordem = 'qrbnp';
    r.w.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    r.b.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    return r;
  }

  /** Recria uma partida a partir da lista UCI; devolve null se algo for inválido. */
  static deUci(lances: string[], reivindicado: 'tripla' | 'cinquenta' | null = null): Partida | null {
    const p = new Partida();
    for (const l of lances) {
      if (typeof l !== 'string' || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(l)) return null;
      if (!p.jogarUci(l)) return null;
    }
    if (reivindicado) {
      if (p.situacao().reivindicavel !== reivindicado) return null;
      p.reivindicado = reivindicado;
    }
    return p;
  }

  /** Cria uma partida a partir de um FEN (usado nos testes de finais de partida). */
  static deFen(fen: string): Partida {
    const p = new Partida();
    p.xadrez.load(fen);
    return p;
  }

  get empateReivindicado() {
    return this.reivindicado;
  }
}

const LETRAS_PT: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'B', N: 'C' };

/** Converte SAN inglesa para a notação em português (R, D, T, B, C). */
export function sanPortugues(san: string): string {
  return san.replace(/[KQRBN]/g, (c) => LETRAS_PT[c]);
}

const VALORES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function valorMaterial(pecas: PieceSymbol[]): number {
  return pecas.reduce((s, p) => s + VALORES[p], 0);
}

/**
 * Desfaz lances até devolver a vez ao jogador humano (modo contra o computador).
 * Sempre remove pelo menos um lance do humano. Devolve quantos lances foram desfeitos
 * (0 se o humano ainda não jogou).
 */
export function desfazerParaJogador(p: Partida, humano: Cor): number {
  const hist = p.historico();
  if (!hist.some((m) => m.color === humano)) return 0;
  let n = 0;
  while (true) {
    const m = p.desfazer();
    if (!m) break;
    n++;
    if (m.color === humano) break;
  }
  return n;
}
