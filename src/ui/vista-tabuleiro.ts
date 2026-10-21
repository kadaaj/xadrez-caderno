/**
 * Vista do tabuleiro: camadas do desenho, bichinhos (posicionar, animar,
 * ordenar de trás para frente), marcas (seleção, destinos, trilha do último
 * lance, suor de peça ameaçada, xeque) e gestos de clique/arraste.
 * Não conhece regras: recebe a posição pronta e avisa a aplicação.
 */
import type { Color, PieceSymbol, Square } from 'chess.js';
import { NOME_BICHO, NOME_PECA, criarBicho, defsPecas } from '../arte/pecas.ts';
import { CASA, desenharCoordenadas, desenharTabuleiro, VIEWBOX } from '../arte/tabuleiro.ts';
import { circulo, curva, gerador, linha, n, oval, variar } from '../arte/traco.ts';
import { expressao, olhar, olharReto, piscar } from './bichos.ts';
import { Coreografo, type Mov, type Resultado } from './coreografia.ts';
import { gota } from './efeitos.ts';

const NS = 'http://www.w3.org/2000/svg';

export interface PecaNaCasa {
  casa: Square;
  cor: Color;
  tipo: PieceSymbol;
}

export interface DicaLance {
  from: Square;
  to: Square;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  enPassant?: boolean;
  color: Color;
}

export interface Marcas {
  ultimo: { from: Square; to: Square; cor: Color } | null;
  selecionada: Square | null;
  destinos: { casa: Square; captura: boolean }[];
  xeque: Square | null;
  ameacadas: Square[];
}

export type RespostaPressao = 'arrastar' | 'arrastar-ou-desmarcar' | 'nada';

export interface Ouvintes {
  aoPressionar(casa: Square): RespostaPressao;
  aoSoltar(de: Square, para: Square): boolean;
  aoDesmarcar(): void;
}

export function movimentoReduzido(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export class VistaTabuleiro {
  readonly svg: SVGSVGElement;
  private camadaCoord!: SVGGElement;
  private camadaMarcas!: SVGGElement;
  private camadaPecas!: SVGGElement;
  private camadaTopo!: SVGGElement;
  private camadaEfeitos!: SVGGElement;
  private pecas = new Map<Square, SVGGElement>();
  private girado = false;
  /** Falso durante a demonstração: o tabuleiro não responde a clique nem arraste. */
  entradaAtiva = true;
  private ouvintes: Ouvintes;
  private ultimaSelecao: Square | null = null;
  private temporizadorOrdem = 0;
  private coreo!: Coreografo;
  private arraste: {
    de: Square;
    el: SVGGElement;
    inicio: { x: number; y: number };
    ativo: boolean;
    resposta: RespostaPressao;
    pointerId: number;
  } | null = null;

  constructor(svg: SVGSVGElement, ouvintes: Ouvintes) {
    this.svg = svg;
    this.ouvintes = ouvintes;
    this.montar();
    this.coreo = new Coreografo({
      xy: (c) => this.xy(c),
      efeitos: this.camadaEfeitos,
      camadaPecas: this.camadaPecas,
      todas: () => [...this.pecas].map(([casa, el]) => ({ casa, el })),
      ordenar: () => this.ordenar(),
      posicionarJa: (e, casa) => this.posicionar(e, casa, false),
    });
    this.iniciarVida();
  }

  /** Piscadas ao acaso nos bichos parados (só com movimento permitido e a página visível). */
  private iniciarVida(): void {
    const piscarAlguem = () => {
      const delay = 1100 + Math.random() * 2300;
      window.setTimeout(() => {
        if (!movimentoReduzido() && !document.hidden && this.pecas.size) {
          const lista = [...this.pecas.values()].filter((e) => !e.dataset.ocupada && !e.hasAttribute('data-exp'));
          const e = lista[Math.floor(Math.random() * lista.length)];
          if (e) {
            piscar(e);
            if (Math.random() < 0.2) window.setTimeout(() => piscar(e), 260);
            // de vez em quando espia para o lado
            if (Math.random() < 0.35) {
              olhar(e, (Math.random() * 2 - 1) * 0.9, (Math.random() * 2 - 1) * 0.5);
              window.setTimeout(() => !e.dataset.ocupada && olharReto(e), 700 + Math.random() * 900);
            }
          }
        }
        piscarAlguem();
      }, delay);
    };
    piscarAlguem();
  }

  /** Resolve quando a animação da última jogada terminar (o computador espera para jogar). */
  aguardarAnimacoes(): Promise<void> {
    return this.coreo.aguardar();
  }

  private montar(): void {
    const { fundo, grade } = desenharTabuleiro();
    this.svg.setAttribute('viewBox', VIEWBOX);
    this.svg.innerHTML =
      `<g class="camada-fundo">${fundo}</g>` +
      `<g class="camada-grade">${grade}</g>` +
      `<g class="camada-marcas"></g>` +
      `<g class="camada-coord"></g>` +
      `<g class="camada-pecas"></g>` +
      `<g class="camada-topo"></g>` +
      `<g class="camada-efeitos"></g>`;
    this.camadaMarcas = this.svg.querySelector('.camada-marcas')!;
    this.camadaCoord = this.svg.querySelector('.camada-coord')!;
    this.camadaPecas = this.svg.querySelector('.camada-pecas')!;
    this.camadaTopo = this.svg.querySelector('.camada-topo')!;
    this.camadaEfeitos = this.svg.querySelector('.camada-efeitos')!;
    this.camadaCoord.innerHTML = desenharCoordenadas(this.girado);

    this.svg.addEventListener('pointerdown', (e) => this.pressionar(e));
    this.svg.addEventListener('pointermove', (e) => this.mover(e));
    this.svg.addEventListener('pointerup', (e) => this.soltar(e));
    this.svg.addEventListener('pointercancel', () => this.cancelarArraste());
    this.svg.addEventListener('lostpointercapture', () => {
      if (this.arraste?.ativo) this.cancelarArraste();
    });
  }

  static instalarDefs(alvo: SVGSVGElement): void {
    alvo.innerHTML = `<defs>${defsPecas()}</defs>`;
  }

  animarEntrada(): void {
    if (movimentoReduzido()) return;
    this.svg.classList.remove('desenhando');
    void this.svg.getBoundingClientRect();
    this.svg.classList.add('desenhando');
    window.setTimeout(() => this.svg.classList.remove('desenhando'), 2600);
  }

  setGirado(g: boolean): void {
    if (g === this.girado) return;
    this.coreo.finalizar();
    this.girado = g;
    this.camadaCoord.innerHTML = desenharCoordenadas(g);
    for (const [casa, e] of this.pecas) this.posicionar(e, casa, false);
    this.ordenar();
  }

  // --------------------------------------------------------------- geometria

  /** Centro da casa em coordenadas do desenho (usado pela câmera da demonstração). */
  centro(casa: Square): { x: number; y: number } {
    const { x, y } = this.xy(casa);
    return { x: x + CASA / 2, y: y + CASA / 2 };
  }

  private xy(casa: Square): { x: number; y: number } {
    const f = casa.charCodeAt(0) - 97;
    const r = casa.charCodeAt(1) - 49;
    return this.girado ? { x: (7 - f) * CASA, y: r * CASA } : { x: f * CASA, y: (7 - r) * CASA };
  }

  private casaEm(x: number, y: number): Square | null {
    const c = Math.floor(x / CASA);
    const l = Math.floor(y / CASA);
    if (c < 0 || c > 7 || l < 0 || l > 7) return null;
    const f = this.girado ? 7 - c : c;
    const r = this.girado ? l : 7 - l;
    return (String.fromCharCode(97 + f) + String(r + 1)) as Square;
  }

  private pontoSvg(e: PointerEvent): { x: number; y: number } {
    const m = this.camadaPecas.getScreenCTM();
    if (!m) return { x: -1, y: -1 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  private posicionar(e: SVGGElement, casa: Square, animar: boolean, duracao = 260): void {
    const { x, y } = this.xy(casa);
    const dur = animar && !movimentoReduzido() ? duracao : 0;
    e.style.transition = dur ? `transform ${dur}ms cubic-bezier(.3,.75,.3,1)` : 'none';
    e.style.transform = `translate(${x}px, ${y}px)`;
    e.dataset.x = String(x);
    e.dataset.y = String(y);
  }

  private criarPeca(cor: Color, tipo: PieceSymbol): SVGGElement {
    const g = el('g', { class: 'peca' });
    g.dataset.peca = cor + tipo;
    const t = el('title');
    t.textContent = `${NOME_PECA[tipo]} ${cor === 'w' ? 'branco' : 'preto'} (${NOME_BICHO[cor][tipo]})`;
    g.appendChild(t);
    g.appendChild(criarBicho(cor, tipo));
    g.addEventListener('animationend', (ev) => {
      if (ev.animationName === 'entrar' || ev.animationName === 'surgir' || ev.animationName === 'pulo')
        g.classList.remove('entrando', 'surgindo', 'pulando');
    });
    return g;
  }

  /** O bicho vira outro (promoção): troca o desenho e dá um pulinho de surpresa. */
  private transformar(e: SVGGElement, cor: Color, tipo: PieceSymbol, animar: boolean): void {
    e.dataset.peca = cor + tipo;
    e.querySelector('.escala')?.replaceWith(criarBicho(cor, tipo));
    e.querySelector('title')!.textContent = `${NOME_PECA[tipo]} (${NOME_BICHO[cor][tipo]})`;
    if (animar) {
      e.classList.remove('surgindo');
      void e.getBoundingClientRect();
      e.classList.add('surgindo');
    }
  }

  /** Desenha de trás para frente: bichos mais embaixo na tela ficam na frente. */
  private ordenar(): void {
    const lista = [...this.pecas.values()].sort((a, b) => Number(a.dataset.y) - Number(b.dataset.y));
    for (const e of lista) this.camadaPecas.appendChild(e);
    if (this.arraste?.ativo) this.camadaPecas.appendChild(this.arraste.el);
  }

  private ordenarDepois(ms: number): void {
    window.clearTimeout(this.temporizadorOrdem);
    if (ms <= 0 || movimentoReduzido()) {
      this.ordenar();
      return;
    }
    this.temporizadorOrdem = window.setTimeout(() => this.ordenar(), ms);
  }

  // ------------------------------------------------------------ sincronização

  /**
   * Leva a vista até a posição dada. Com `dica` (um lance de verdade) o bicho
   * que anda e o alvo capturado seguem a coreografia; sem dica (desfazer)
   * os bichos só deslizam de volta. Devolve quando ocorre o impacto/pouso.
   */
  sincronizar(posicao: PecaNaCasa[], dica: DicaLance | null = null, animar = true): Resultado | null {
    this.cancelarArraste();
    this.coreo.finalizar(); // qualquer jogada anterior termina na hora, no estado certo
    const desejado = new Map<Square, string>();
    for (const p of posicao) desejado.set(p.casa, p.cor + p.tipo);

    const removidas: { casa: Square; el: SVGGElement }[] = [];
    const adicionar: Square[] = [];
    for (const [casa, e] of this.pecas) if (desejado.get(casa) !== e.dataset.peca) removidas.push({ casa, el: e });
    for (const [casa, cod] of desejado) {
      const atual = this.pecas.get(casa);
      if (!atual || atual.dataset.peca !== cod) adicionar.push(casa);
    }
    for (const r of removidas) this.pecas.delete(r.casa);

    const novoMapa = new Map<Square, SVGGElement>();
    const usadas = new Set<SVGGElement>();
    const reduzido = movimentoReduzido() || !animar;
    const movs: Mov[] = [];

    if (dica) {
      const origem = removidas.find((r) => r.casa === dica.from && !usadas.has(r.el));
      const idx = adicionar.indexOf(dica.to);
      if (origem && idx >= 0) {
        usadas.add(origem.el);
        adicionar.splice(idx, 1);
        const cod = desejado.get(dica.to)!;
        const tipoAntes = origem.el.dataset.peca![1] as PieceSymbol;
        origem.el.classList.remove('entrando', 'surgindo', 'pulando');
        const promover = origem.el.dataset.peca !== cod;
        const trocar = () => this.transformar(origem.el, cod[0] as Color, cod[1] as PieceSymbol, !reduzido);
        if (promover) origem.el.dataset.peca = cod;
        if (reduzido) {
          this.posicionar(origem.el, dica.to, false);
          if (promover) trocar();
        } else {
          movs.push({
            el: origem.el,
            de: dica.from,
            para: dica.to,
            cor: dica.color,
            tipo: tipoAntes,
            aoChegar: promover ? trocar : undefined,
          });
        }
        novoMapa.set(dica.to, origem.el);
      }
      if (dica.captured) {
        const casaCap = dica.enPassant ? ((dica.to[0] + dica.from[1]) as Square) : dica.to;
        const cap = removidas.find((r) => r.casa === casaCap && !usadas.has(r.el));
        if (cap) {
          usadas.add(cap.el);
          const m = movs[0];
          if (reduzido || !m) cap.el.remove();
          else m.vitima = { el: cap.el, casa: casaCap };
        }
      }
    }

    // pareamento genérico (roque, desfazer)
    for (let i = adicionar.length - 1; i >= 0; i--) {
      const casa = adicionar[i];
      const cod = desejado.get(casa)!;
      const alvo = this.xy(casa);
      let melhor: { casa: Square; el: SVGGElement } | null = null;
      let dist = Infinity;
      for (const r of removidas) {
        if (usadas.has(r.el) || r.el.dataset.peca !== cod) continue;
        const o = this.xy(r.casa);
        const d = Math.hypot(o.x - alvo.x, o.y - alvo.y);
        if (d < dist) {
          dist = d;
          melhor = r;
        }
      }
      if (melhor) {
        usadas.add(melhor.el);
        adicionar.splice(i, 1);
        if (dica && !reduzido) {
          // roque: a torre também faz a sua jogada
          melhor.el.classList.remove('entrando', 'surgindo', 'pulando');
          movs.push({ el: melhor.el, de: melhor.casa, para: casa, cor: cod[0] as Color, tipo: cod[1] as PieceSymbol });
        } else this.posicionar(melhor.el, casa, animar);
        novoMapa.set(casa, melhor.el);
      }
    }

    for (const r of removidas) {
      if (usadas.has(r.el)) continue;
      if (reduzido) r.el.remove();
      else {
        r.el.classList.add('sumindo');
        window.setTimeout(() => r.el.remove(), 260);
      }
    }
    for (const casa of adicionar) {
      const cod = desejado.get(casa)!;
      const e = this.criarPeca(cod[0] as Color, cod[1] as PieceSymbol);
      this.posicionar(e, casa, false);
      if (!reduzido) e.classList.add('surgindo');
      this.camadaPecas.appendChild(e);
      novoMapa.set(casa, e);
    }
    for (const [casa, e] of novoMapa) this.pecas.set(casa, e);

    this.ordenar();
    if (dica && movs.length && !reduzido) {
      return this.coreo.iniciar(movs, dica.color, `${dica.from}${dica.to}${dica.captured ?? ''}${posicao.length}`);
    }
    return null;
  }

  redesenharPecas(posicao: PecaNaCasa[]): void {
    this.cancelarArraste();
    this.coreo.finalizar();
    this.camadaPecas.innerHTML = '';
    this.camadaEfeitos.innerHTML = '';
    this.pecas.clear();
    const reduzido = movimentoReduzido();
    for (const p of posicao) {
      const e = this.criarPeca(p.cor, p.tipo);
      this.posicionar(e, p.casa, false);
      if (!reduzido) {
        e.classList.add('entrando');
        const { x, y } = this.xy(p.casa);
        // aparecem fileira por fileira, de perto para longe
        e.style.setProperty('--atraso', `${(0.7 + ((700 - y) / 100) * 0.08 + (x / 100) * 0.03).toFixed(2)}s`);
      }
      this.camadaPecas.appendChild(e);
      this.pecas.set(p.casa, e);
    }
    this.ordenar();
  }

  // ----------------------------------------------------------------- marcas

  marcar(m: Marcas): void {
    let fundo = '';
    let topo = '';
    if (m.ultimo) {
      // trilha pontilhada do último lance, na cor de quem jogou
      const a = this.xy(m.ultimo.from);
      const b = this.xy(m.ultimo.to);
      const r = gerador(`trilha-${m.ultimo.from}-${m.ultimo.to}`);
      const x1 = a.x + 50;
      const y1 = a.y + 60;
      const x2 = b.x + 50;
      const y2 = b.y + 60;
      const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
      const curvatura = Math.min(40, dist * 0.18) * (r() < 0.5 ? -1 : 1);
      const cx = (x1 + x2) / 2 - ((y2 - y1) / dist) * curvatura;
      const cy = (y1 + y2) / 2 + ((x2 - x1) / dist) * curvatura;
      const passos = Math.max(3, Math.round(dist / 22));
      const classe = m.ultimo.cor === 'w' ? 'trilha-quente' : 'trilha-fria';
      let pontos = '';
      for (let i = 1; i < passos; i++) {
        const t = i / passos;
        const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
        const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
        if (Math.hypot(px - x2, py - y2) < 36 || Math.hypot(px - x1, py - y1) < 14) continue;
        pontos += `<circle cx="${n(px + variar(r, 1.2))}" cy="${n(py + variar(r, 1.2))}" r="${n(3.6 + r() * 1.3)}"/>`;
      }
      fundo += `<g class="${classe}">${pontos}<path class="chao" d="${oval(b.x + 50, b.y + 86, 34, 12, r, 1.12, 0.05)}"/></g>`;
    }
    if (m.selecionada) {
      const { x, y } = this.xy(m.selecionada);
      const r = gerador(`sel-${m.selecionada}`);
      const k = 17;
      const canto = (cx: number, cy: number, sx: number, sy: number) =>
        linha(cx, cy + sy * k, cx + variar(r, 0.8), cy, r, 0.5) + linha(cx, cy, cx + sx * k, cy + variar(r, 0.8), r, 0.5);
      fundo += `<path class="colchetes" d="${canto(x + 7, y + 7, 1, 1)}${canto(x + 93, y + 7, -1, 1)}${canto(x + 7, y + 93, 1, -1)}${canto(x + 93, y + 93, -1, -1)}"/>`;
    }
    for (const d of m.destinos) {
      const { x, y } = this.xy(d.casa);
      const r = gerador(`dst-${d.casa}`);
      if (d.captura) {
        topo += `<path class="alvo-captura" d="${circulo(x + 50, y + 54, 44, r, 1.15, 0.05)}"/>`;
      } else {
        // bolinha laranja com folhinha, como uma frutinha desenhada
        const cx = x + 50 + variar(r, 2);
        const cy = y + 54 + variar(r, 2);
        fundo +=
          `<path class="destino" d="${circulo(cx, cy, 18, r, 1.1, 0.06)}"/>` +
          `<path class="folhinha" d="${curva(
            [
              [cx + 6, cy - 17],
              [cx + 13, cy - 25],
              [cx + 20, cy - 21],
              [cx + 12, cy - 15],
            ],
            r,
            0.3,
            true,
          )}"/>`;
      }
    }
    for (const casa of m.ameacadas) {
      const { x, y } = this.xy(casa);
      const r = gerador(`suor-${casa}`);
      topo += `<g class="suor"><path class="gota-suor" d="${gota(x + 82 + variar(r, 2), y + 14, 6.5)}"/><path class="gota-suor pequena" d="${gota(x + 92, y + 30, 4)}"/></g>`;
    }
    if (m.xeque) {
      const { x, y } = this.xy(m.xeque);
      const r = gerador(`xq-${m.xeque}`);
      topo +=
        `<path class="xeque" d="${circulo(x + 50, y + 52, 47, r, 1.25, 0.05)}"/>` +
        `<path class="xeque fino" d="${circulo(x + 50, y + 53, 42, r, 1.1, 0.06)}"/>` +
        `<text class="xeque-texto" x="${x + 50}" y="${y > 400 ? y - 30 : y + 122}">xeque!</text>`;
    }
    this.camadaMarcas.innerHTML = fundo;
    this.camadaTopo.innerHTML = topo;

    // a peça escolhida fica contente (olhinhos em arco) e dá um pulinho
    for (const [casa, e] of this.pecas) {
      if (e.dataset.ocupada) continue;
      if (casa === m.selecionada) expressao(e, 'feliz');
      else if (e.getAttribute('data-exp') === 'feliz') expressao(e, 'normal');
    }
    if (m.selecionada && m.selecionada !== this.ultimaSelecao && !movimentoReduzido()) {
      const e = this.pecas.get(m.selecionada);
      if (e && !this.arraste?.ativo) {
        e.classList.remove('pulando', 'entrando');
        void e.getBoundingClientRect();
        e.classList.add('pulando');
      }
    }
    this.ultimaSelecao = m.selecionada;
  }

  // ------------------------------------------------------------ interação

  private pressionar(e: PointerEvent): void {
    if (!this.entradaAtiva || e.button !== 0) return;
    const p = this.pontoSvg(e);
    const casa = this.casaEm(p.x, p.y);
    if (!casa) {
      this.ouvintes.aoDesmarcar();
      return;
    }
    const resposta = this.ouvintes.aoPressionar(casa);
    if (resposta === 'nada') return;
    const peca = this.pecas.get(casa);
    if (!peca) return;
    e.preventDefault();
    this.arraste = { de: casa, el: peca, inicio: p, ativo: false, resposta, pointerId: e.pointerId };
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura */
    }
  }

  private mover(e: PointerEvent): void {
    const a = this.arraste;
    if (!a || e.pointerId !== a.pointerId) return;
    const p = this.pontoSvg(e);
    if (!a.ativo) {
      if (Math.hypot(p.x - a.inicio.x, p.y - a.inicio.y) < 8) return;
      a.ativo = true;
      this.coreo.finalizar();
      a.el.classList.remove('entrando', 'surgindo', 'pulando');
      a.el.classList.add('arrastando');
      this.camadaPecas.appendChild(a.el);
      this.svg.classList.add('com-arraste');
    }
    a.el.style.transition = 'none';
    a.el.style.transform = `translate(${p.x - 50}px, ${p.y - 62}px)`;
  }

  private soltar(e: PointerEvent): void {
    const a = this.arraste;
    if (!a || e.pointerId !== a.pointerId) return;
    this.arraste = null;
    this.svg.classList.remove('com-arraste');
    try {
      this.svg.releasePointerCapture(e.pointerId);
    } catch {
      /* ignorado */
    }
    if (!a.ativo) {
      if (a.resposta === 'arrastar-ou-desmarcar') this.ouvintes.aoDesmarcar();
      return;
    }
    a.el.classList.remove('arrastando');
    const p = this.pontoSvg(e);
    const para = this.casaEm(p.x, p.y);
    if (para && para !== a.de && this.ouvintes.aoSoltar(a.de, para)) return;
    if (this.pecas.get(a.de) === a.el) {
      this.posicionar(a.el, a.de, true, 180);
      this.ordenarDepois(200);
    }
  }

  private cancelarArraste(): void {
    const a = this.arraste;
    if (!a) return;
    this.arraste = null;
    this.svg.classList.remove('com-arraste');
    a.el.classList.remove('arrastando');
    if (this.pecas.get(a.de) === a.el) this.posicionar(a.el, a.de, true, 180);
  }

  posicaoRelativa(casa: Square): { x: number; y: number } {
    const { x, y } = this.xy(casa);
    const vb = VIEWBOX.split(' ').map(Number);
    return { x: (x + 50 - vb[0]) / vb[2], y: (y + 50 - vb[1]) / vb[3] };
  }
}
