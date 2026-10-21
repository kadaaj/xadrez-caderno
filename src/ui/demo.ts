/**
 * Modo demonstração: uma partida curta, roteirizada, com câmera que se
 * aproxima dos lances e legendas escritas à mão. É SEPARADO do jogo: usa a
 * própria Partida, o tabuleiro fica sem entrada (clique/arraste) e, ao sair,
 * a aplicação devolve exatamente a partida real. A câmera é só o viewBox do
 * SVG — as peças continuam sendo as mesmas animadas do jogo normal.
 * (Zoom e cortes aqui são escolha de apresentação minha, inspirada no
 * vídeo de referência; não fazem parte da animação dos personagens.)
 */
import type { PieceSymbol, Square } from 'chess.js';
import { Partida } from '../regras/partida.ts';
import { VIEWBOX } from '../arte/tabuleiro.ts';
import { VistaTabuleiro, movimentoReduzido, type PecaNaCasa } from './vista-tabuleiro.ts';

interface Passo {
  uci: string;
  legenda: string;
}

export const ROTEIRO: Passo[] = [
  { uci: 'e2e4', legenda: 'o cogumelo abre o caminho: agacha, pula e assenta' },
  { uci: 'd7d5', legenda: 'o fantasminha responde, flutuando' },
  { uci: 'e4d5', legenda: 'captura! o cogumelo vai até lá e o fantasminha fica tonto' },
  { uci: 'd8d5', legenda: 'a cacatua devolve na mesma moeda' },
  { uci: 'b1c3', legenda: 'o cervinho dá um salto por cima de todo mundo' },
  { uci: 'd5a5', legenda: 'a cacatua foge de lado' },
  { uci: 'g1f3', legenda: 'outro salto: agachar, esticar, pousar' },
  { uci: 'g8f6', legenda: 'o unicórnio responde' },
  { uci: 'f1c4', legenda: 'o broto desliza na diagonal' },
  { uci: 'e7e6', legenda: 'um passinho de fantasma' },
  { uci: 'e1g1', legenda: 'roque: o rei e a torre andam juntos' },
  { uci: 'c8d7', legenda: 'o mago se mexe' },
  { uci: 'f3e5', legenda: 'mais um salto, agora para o centro' },
  { uci: 'a5e5', legenda: 'a cacatua captura o cervinho de longe' },
];

const FIM = 'e agora é com você: o jogo de verdade está esperando';

export interface OuvintesDemo {
  /** Chamado quando a demonstração termina ou é interrompida. */
  aoSair(): void;
}

const espera = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export class Demonstracao {
  private partida = new Partida();
  private ativa = false;
  private geracao = 0;
  private quadro = 0;
  private vb = parseViewBox(VIEWBOX);
  private legenda: HTMLElement;

  constructor(
    private vista: VistaTabuleiro,
    legenda: HTMLElement,
    private ouvintes: OuvintesDemo,
  ) {
    this.legenda = legenda;
  }

  get emAndamento(): boolean {
    return this.ativa;
  }

  private posicao(): PecaNaCasa[] {
    const out: PecaNaCasa[] = [];
    for (const linha of this.partida.tabuleiro())
      for (const c of linha) if (c) out.push({ casa: c.square, cor: c.color, tipo: c.type });
    return out;
  }

  /** Começa. A aplicação já deve ter guardado o estado real e limpado as marcas. */
  async iniciar(): Promise<void> {
    if (this.ativa) return;
    this.ativa = true;
    this.partida = new Partida();
    const minha = ++this.geracao;
    this.vista.entradaAtiva = false;
    this.vista.setGirado(false);
    this.vista.redesenharPecas(this.posicao());
    this.vb = parseViewBox(VIEWBOX);
    this.aplicarVB(this.vb);
    this.mostrar('demonstração: a câmera só aparece aqui, o jogo continua guardado');
    await espera(1600);
    for (const passo of ROTEIRO) {
      if (minha !== this.geracao) return;
      const m = this.partida.jogar({ from: passo.uci.slice(0, 2) as Square, to: passo.uci.slice(2, 4) as Square, promotion: passo.uci[4] as PieceSymbol | undefined });
      if (!m) break;
      this.mostrar(passo.legenda);
      await this.camera(this.alvo(m.from, m.to, Boolean(m.captured)), 520, minha);
      if (minha !== this.geracao) return;
      const anim = this.vista.sincronizar(this.posicao(), {
        from: m.from,
        to: m.to,
        captured: m.captured,
        promotion: m.promotion,
        enPassant: m.isEnPassant(),
        color: m.color,
      });
      await this.vista.aguardarAnimacoes();
      await espera(anim ? 500 : 900);
      if (minha !== this.geracao) return;
    }
    this.mostrar(FIM);
    await this.camera(parseViewBox(VIEWBOX), 700, minha);
    await espera(2200);
    if (minha === this.geracao) this.sair();
  }

  /** Termina (fim do roteiro, botão ou Esc): cancela tudo e avisa a aplicação. */
  sair(): void {
    if (!this.ativa) return;
    this.ativa = false;
    this.geracao++;
    cancelAnimationFrame(this.quadro);
    this.aplicarVB(parseViewBox(VIEWBOX));
    this.legenda.hidden = true;
    this.vista.entradaAtiva = true;
    this.ouvintes.aoSair();
  }

  private mostrar(texto: string): void {
    this.legenda.textContent = texto;
    this.legenda.hidden = false;
    this.legenda.classList.remove('nova');
    void this.legenda.offsetWidth;
    this.legenda.classList.add('nova');
  }

  /** Enquadramento: as duas casas com folga, sempre quadrado e dentro do tabuleiro ampliado. */
  private alvo(de: Square, para: Square, captura: boolean): VB {
    const a = this.vista.centro(de);
    const b = this.vista.centro(para);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const lado = Math.min(932, Math.max(captura ? 360 : 420, Math.hypot(a.x - b.x, a.y - b.y) + 330));
    const cheio = parseViewBox(VIEWBOX);
    const x = Math.min(cheio.x + cheio.w - lado, Math.max(cheio.x, cx - lado / 2));
    const y = Math.min(cheio.y + cheio.h - lado, Math.max(cheio.y, cy - lado / 2));
    return { x, y, w: lado, h: lado };
  }

  private aplicarVB(v: VB): void {
    this.vb = v;
    this.vista.svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  }

  private camera(alvo: VB, dur: number, minha: number): Promise<void> {
    cancelAnimationFrame(this.quadro);
    if (movimentoReduzido()) {
      this.aplicarVB(alvo);
      return Promise.resolve();
    }
    const de = this.vb;
    return new Promise((resolver) => {
      const t0 = performance.now();
      const passo = (agora: number) => {
        if (minha !== this.geracao) return resolver();
        const t = Math.min(1, (agora - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // suave nas duas pontas
        this.aplicarVB({
          x: de.x + (alvo.x - de.x) * e,
          y: de.y + (alvo.y - de.y) * e,
          w: de.w + (alvo.w - de.w) * e,
          h: de.h + (alvo.h - de.h) * e,
        });
        if (t < 1) this.quadro = requestAnimationFrame(passo);
        else resolver();
      };
      this.quadro = requestAnimationFrame(passo);
    });
  }
}

interface VB {
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseViewBox(s: string): VB {
  const [x, y, w, h] = s.split(/\s+/).map(Number);
  return { x, y, w, h };
}
