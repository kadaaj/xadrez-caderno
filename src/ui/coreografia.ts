/**
 * Coreografia das jogadas. Cada jogada vira uma sequência com três tempos —
 * antecipação (o bicho se agacha e olha para onde vai), deslocamento (pulo ou
 * deslize) e acomodação (amassa ao pousar, o chapéu e os bracinhos terminam
 * o balanço) — e, numa captura, atacante e alvo seguem a MESMA linha do tempo:
 * o alvo se assusta antes de ser atingido, é jogado para trás, perde o chapéu,
 * fica tonto e só então sai de cena, enquanto o atacante termina na casa.
 *
 * O estado lógico (quem está em qual casa) é decidido antes, em
 * `VistaTabuleiro.sincronizar`; aqui só se anima. Por isso `finalizar()`
 * pode interromper tudo a qualquer momento (desfazer, nova partida, próxima
 * jogada) deixando cada bicho exatamente onde a partida diz que ele está.
 */
import type { Color, PieceSymbol, Square } from 'chess.js';
import { CASA } from '../arte/tabuleiro.ts';
import { expressao, olharPara, olharReto, partes, type Expressao } from './bichos.ts';
import * as ef from './efeitos.ts';

export interface Palco {
  xy(casa: Square): { x: number; y: number };
  efeitos: SVGGElement;
  camadaPecas: SVGGElement;
  todas(): Iterable<{ casa: Square; el: SVGGElement }>;
  ordenar(): void;
  /** Posiciona sem transição (o resultado final; a animação parte da casa de origem). */
  posicionarJa(el: SVGGElement, casa: Square): void;
}

export interface Mov {
  el: SVGGElement;
  de: Square;
  para: Square;
  cor: Color;
  tipo: PieceSymbol;
  vitima?: { el: SVGGElement; casa: Square };
  aoChegar?: () => void; // ex.: promoção troca o bicho ao pousar
}

export interface Resultado {
  impacto: number; // ms até o momento do choque/pouso (para sincronizar o som)
  duracao: number; // ms até tudo terminar
}

const GRITOS = ['ai!', 'ei!', 'nããão', 'uii!', 'socorro!', 'poxa!', 'ops!'];

interface Perfil {
  ant: number;
  vooBase: number;
  vooPor: number;
  alt: number; // altura do pulo em unidades do tabuleiro
  sq: number; // quanto amassa (1 = bastante)
  lean: number; // inclinação do corpo no voo (graus)
}

const PERFIL: Record<PieceSymbol, Perfil> = {
  p: { ant: 150, vooBase: 300, vooPor: 60, alt: 18, sq: 1, lean: 3 },
  n: { ant: 200, vooBase: 470, vooPor: 0, alt: 60, sq: 1.1, lean: 4 },
  b: { ant: 140, vooBase: 300, vooPor: 45, alt: 7, sq: 0.55, lean: 9 },
  r: { ant: 150, vooBase: 300, vooPor: 45, alt: 6, sq: 0.6, lean: 5 },
  q: { ant: 150, vooBase: 310, vooPor: 45, alt: 9, sq: 0.7, lean: 7 },
  k: { ant: 160, vooBase: 360, vooPor: 50, alt: 14, sq: 0.9, lean: 3 },
};

const POUSO = 280;
const ORDEM = ['ini', 'agach', 'ant', 'dec', 'meio', 'pre', 'pouso', 'a1', 'a2', 'fim'] as const;
type Marco = (typeof ORDEM)[number];

export class Coreografo {
  private ativas = new Set<Sequencia>();
  private esperas: (() => void)[] = [];

  constructor(private palco: Palco) {}

  get ocupado(): boolean {
    return this.ativas.size > 0;
  }

  /** Resolve quando nenhuma sequência estiver rodando (o computador espera a jogada anterior acabar). */
  aguardar(): Promise<void> {
    if (!this.ativas.size) return Promise.resolve();
    return new Promise((r) => this.esperas.push(r));
  }

  /** Interrompe tudo na hora: cada bicho vai para o estado final; o alvo capturado some. */
  finalizar(): void {
    for (const s of [...this.ativas]) s.encerrar();
  }

  /** @internal */
  terminou(s: Sequencia): void {
    this.ativas.delete(s);
    if (!this.ativas.size) {
      const r = this.esperas.splice(0);
      for (const f of r) f();
      for (const e of this.palco.todas()) olharReto(e.el);
    }
  }

  iniciar(movs: Mov[], cor: Color, semente: string): Resultado {
    this.finalizar();
    let impacto = 0;
    let duracao = 0;
    for (const m of movs) {
      const s = new Sequencia(this, this.palco);
      this.ativas.add(s);
      const r = s.montar(m, semente);
      impacto = Math.max(impacto, r.impacto);
      duracao = Math.max(duracao, r.duracao);
    }
    // todos os outros bichos acompanham a ação com o olhar
    const alvo = this.palco.xy(movs[0].para);
    const ocupados = new Set<Element>(movs.flatMap((m) => [m.el, ...(m.vitima ? [m.vitima.el] : [])]));
    for (const p of this.palco.todas()) {
      if (ocupados.has(p.el)) continue;
      const o = this.palco.xy(p.casa);
      olharPara(p.el, alvo.x - o.x, alvo.y - o.y);
    }
    void cor;
    return { impacto, duracao };
  }
}

function suave(u: number): number {
  return u * u * (3 - 2 * u);
}

class Sequencia {
  private anims: Animation[] = [];
  private timers: number[] = [];
  private extras: Element[] = [];
  private limpezas: (() => void)[] = [];
  private fim = false;

  constructor(
    private dono: Coreografo,
    private palco: Palco,
  ) {}

  private esperar(ms: number, f: () => void): void {
    this.timers.push(
      window.setTimeout(() => {
        if (!this.fim) f();
      }, Math.max(0, ms)),
    );
  }

  private anim(el: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions): Animation {
    const a = el.animate(quadros, opcoes);
    this.anims.push(a);
    return a;
  }

  private extra(e: Element): void {
    this.palco.efeitos.appendChild(e);
    this.extras.push(e);
  }

  encerrar(): void {
    if (this.fim) return;
    this.fim = true;
    for (const t of this.timers) window.clearTimeout(t);
    for (const a of this.anims) {
      try {
        a.cancel();
      } catch {
        /* já encerrada */
      }
    }
    for (const e of this.extras) e.remove();
    for (const f of this.limpezas) f();
    this.palco.ordenar();
    this.dono.terminou(this);
  }

  montar(m: Mov, semente: string): Resultado {
    const palco = this.palco;
    const o = palco.xy(m.de);
    const t = palco.xy(m.para);
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const dist = Math.hypot(dx, dy) / CASA;
    const s = dx >= 0 ? 1 : -1;
    const pf = PERFIL[m.tipo];
    const ant = pf.ant;
    const voo = Math.min(780, pf.vooBase + pf.vooPor * dist);
    const total = ant + voo + POUSO;
    const captura = !!m.vitima;
    const imp = captura ? ant + voo * 0.9 : ant + voo;
    const fimVitima = captura ? imp + 820 : 0;
    const duracao = Math.max(total + 160, fimVitima);

    // ---- estado inicial
    palco.posicionarJa(m.el, m.para);
    m.el.dataset.ocupada = '1';
    palco.camadaPecas.appendChild(m.el);
    this.limpezas.push(() => {
      delete m.el.dataset.ocupada;
      expressao(m.el, 'normal');
      m.aoChegar?.();
      m.aoChegar = undefined;
    });

    const mar: Record<Marco, number> = {
      ini: 0,
      agach: (ant * 0.5) / total,
      ant: ant / total,
      dec: (ant + voo * 0.14) / total,
      meio: (ant + voo * 0.5) / total,
      pre: (ant + voo * 0.88) / total,
      pouso: (ant + voo) / total,
      a1: (ant + voo + POUSO * 0.34) / total,
      a2: (ant + voo + POUSO * 0.68) / total,
      fim: 1,
    };
    const quadros = (valores: Record<Marco, string>, prop = 'transform'): Keyframe[] =>
      ORDEM.map((k) => ({ offset: mar[k], [prop]: valores[k] }) as Keyframe);

    // ---- trajetória do bicho (posição)
    const tr = (x: number, y: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const passos = 18;
    const traj: Keyframe[] = [
      { offset: 0, transform: tr(o.x, o.y) },
      { offset: ant / total, transform: tr(o.x, o.y) },
    ];
    for (let i = 1; i <= passos; i++) {
      const u = i / passos;
      const e = 0.5 * u + 0.5 * suave(u);
      traj.push({
        offset: (ant + voo * u) / total,
        transform: tr(o.x + dx * e, o.y + dy * e - pf.alt * 4 * u * (1 - u)),
      });
    }
    traj.push({ offset: 1, transform: tr(t.x, t.y) });
    this.anim(m.el, traj, { duration: total, easing: 'linear' });

    // ---- postura (amassa, estica, pousa)
    const f = pf.sq;
    const sc = (a: number, b: number, rot = 0) => `scale(${(1 + (a - 1) * f).toFixed(3)}, ${(1 + (b - 1) * f).toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
    const L = pf.lean * s;
    const postura = m.el.querySelector<SVGElement>('.postura');
    if (postura) {
      this.anim(
        postura,
        quadros({
          ini: sc(1, 1),
          agach: sc(1.07, 0.9, -L * 0.4),
          ant: sc(1.15, 0.78, -L * 0.8),
          dec: sc(0.86, 1.22, L * 0.6),
          meio: sc(0.95, 1.06, L),
          pre: sc(0.93, 1.1, L * 0.4),
          pouso: sc(1.18, 0.74, 0),
          a1: sc(0.95, 1.07, -L * 0.2),
          a2: sc(1.03, 0.97, 0),
          fim: sc(1, 1),
        }),
        { duration: total, easing: 'linear' },
      );
    }

    // ---- partes: acessórios e membros acompanham com atraso (inércia)
    const rotTy = (deg: number, ty = 0) => `rotate(${deg.toFixed(1)}deg) translate(0px, ${ty.toFixed(1)}px)`;
    const porPapel = (papel: string, fn: (el: SVGElement) => Record<Marco, string> | null) => {
      for (const el of partes(m.el, papel)) {
        const v = fn(el);
        if (v) this.anim(el, quadros(v), { duration: total, easing: 'linear' });
      }
    };
    const amp = m.tipo === 'n' ? 1.25 : 1;
    porPapel('topo', () => ({
      ini: rotTy(0),
      agach: rotTy(2 * s, 1),
      ant: rotTy(4 * s, 3),
      dec: rotTy(-16 * s * amp, 3),
      meio: rotTy(-10 * s, -1),
      pre: rotTy(-4 * s, -2),
      pouso: rotTy(18 * s * amp, 3),
      a1: rotTy(-9 * s, -2.5),
      a2: rotTy(4 * s, 0.5),
      fim: rotTy(0),
    }));
    porPapel('braco', (el) => {
      const lado = Number(el.dataset.lado) || 1;
      const g = (v: number) => rotTy(-lado * v);
      return { ini: g(0), agach: g(8), ant: g(16), dec: g(62), meio: g(44), pre: g(30), pouso: g(-6), a1: g(24), a2: g(7), fim: g(0) };
    });
    porPapel('asa', (el) => {
      const lado = Number(el.dataset.lado) || 1;
      const g = (v: number) => rotTy(-lado * v);
      return { ini: g(0), agach: g(6), ant: g(12), dec: g(40), meio: g(14), pre: g(34), pouso: g(-8), a1: g(16), a2: g(-3), fim: g(0) };
    });
    porPapel('rabo', () => ({
      ini: rotTy(0),
      agach: rotTy(-4 * s),
      ant: rotTy(-9 * s),
      dec: rotTy(18 * s),
      meio: rotTy(12 * s),
      pre: rotTy(8 * s),
      pouso: rotTy(-15 * s),
      a1: rotTy(10 * s),
      a2: rotTy(-4 * s),
      fim: rotTy(0),
    }));
    porPapel('crina', () => ({
      ini: rotTy(0),
      agach: rotTy(2 * s),
      ant: rotTy(5 * s),
      dec: rotTy(-12 * s),
      meio: rotTy(-7 * s),
      pre: rotTy(-3 * s),
      pouso: rotTy(13 * s),
      a1: rotTy(-6 * s),
      a2: rotTy(3 * s),
      fim: rotTy(0),
    }));
    porPapel('cabeca', () => ({
      ini: rotTy(0),
      agach: rotTy(-3),
      ant: rotTy(-7),
      dec: rotTy(11),
      meio: rotTy(7),
      pre: rotTy(2),
      pouso: rotTy(-9),
      a1: rotTy(4),
      a2: rotTy(-1.5),
      fim: rotTy(0),
    }));
    porPapel('perna', (el) => {
      const fase = Number(el.dataset.fase) || 0;
      const k = fase ? -1 : 1;
      const g = (v: number) => rotTy(k * v);
      return { ini: g(0), agach: g(6), ant: g(12), dec: g(-40), meio: g(-30), pre: g(14), pouso: g(2), a1: g(-6), a2: g(2), fim: g(0) };
    });
    porPapel('pes', (el) => {
      const lado = Number(el.dataset.lado) || 1;
      return {
        ini: rotTy(0),
        agach: rotTy(0),
        ant: rotTy(0, 1),
        dec: rotTy(lado * 14, -3),
        meio: rotTy(lado * 10, -4),
        pre: rotTy(lado * 4, -2),
        pouso: rotTy(0, 1.5),
        a1: rotTy(0, -1),
        a2: rotTy(0),
        fim: rotTy(0),
      };
    });

    // ---- rosto: olhar e expressão em cada tempo
    const expr = (e: Expressao) => expressao(m.el, e);
    expr(captura ? 'bravo' : 'alerta');
    olharPara(m.el, dx, dy);
    this.esperar(ant + voo * 0.1, () => olharPara(m.el, dx, dy));
    this.esperar(ant + voo, () => {
      expr(captura ? 'bravo' : 'feliz');
      olharReto(m.el);
    });
    this.esperar(ant + voo + POUSO * 0.6, () => expr(captura ? 'feliz' : 'normal'));
    this.esperar(total, () => expr('normal'));

    // ---- efeitos de tinta (pequenos)
    const xDe = o.x;
    const yDe = o.y;
    this.esperar(ant + voo * 0.06, () => this.extra(ef.poeira(xDe, yDe, s === 1 ? -1 : 1, `${semente}-de`)));
    this.esperar(ant + voo, () => {
      this.extra(ef.poeira(t.x, t.y, s === 1 ? 1 : -1, `${semente}-para`));
      this.extra(ef.anel(t.x, t.y, m.cor, `${semente}-${m.para}`));
      if (m.tipo === 'p' || m.tipo === 'n' || m.tipo === 'k') this.extra(ef.tremidinhas(t.x, t.y, m.cor));
    });
    // às vezes o bichinho cantarola depois de um lance tranquilo (escolha criativa, não vem do vídeo)
    if (!captura && semente.length && this.sorteio(`${semente}-canta`) < 0.14) {
      this.esperar(ant + voo + POUSO * 0.4, () => {
        expr('cantando');
        this.extra(ef.notas(t.x, t.y, m.cor, semente));
      });
      this.esperar(total + 500, () => expr('normal'));
    }

    this.esperar(ant + voo * 0.98, () => {
      m.aoChegar?.();
      m.aoChegar = undefined;
    });

    if (captura && m.vitima) this.vitima(m, m.vitima, dx, dy, ant, imp, semente);

    this.esperar(duracao, () => this.encerrar());
    return { impacto: imp, duracao };
  }

  private sorteio(chave: string): number {
    let h = 2166136261;
    for (let i = 0; i < chave.length; i++) {
      h ^= chave.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }

  /** O alvo: assusta-se, é atingido, perde o chapéu, fica tonto, cai e sai de cena. */
  private vitima(
    m: Mov,
    v: { el: SVGGElement; casa: Square },
    dx: number,
    dy: number,
    ant: number,
    imp: number,
    semente: string,
  ): void {
    const palco = this.palco;
    const vp = palco.xy(v.casa);
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = ux >= 0 ? 1 : -1;
    const total = imp + 820;
    const fr = (ms: number) => ms / total;
    const tr = (x: number, y: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

    v.el.dataset.ocupada = '1';
    v.el.style.transition = 'none';
    // o alvo fica por baixo do atacante
    palco.camadaPecas.insertBefore(v.el, m.el);
    this.limpezas.push(() => v.el.remove());

    // susto: olhos arregalados, gotinha de suor, olhando para o atacante
    expressao(v.el, 'alerta');
    olharPara(v.el, -dx, -dy);
    const gotaEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    gotaEl.setAttribute('class', 'gota-suor ef-gota');
    gotaEl.setAttribute('d', ef.gota(vp.x + 82, vp.y + 16, 6.5));
    this.extra(gotaEl);

    // posição: segura na casa, recua um tiquinho ao ver o atacante vir, e é lançado no impacto
    this.anim(
      v.el,
      [
        { offset: 0, transform: tr(vp.x, vp.y), opacity: 1 },
        { offset: fr(ant), transform: tr(vp.x, vp.y), opacity: 1 },
        { offset: fr(imp - 120), transform: tr(vp.x + ux * 5, vp.y + uy * 3), opacity: 1 },
        { offset: fr(imp), transform: tr(vp.x + ux * 5, vp.y + uy * 3), opacity: 1 },
        { offset: fr(imp + 170), transform: tr(vp.x + ux * 34, vp.y - 36), opacity: 1 },
        { offset: fr(imp + 420), transform: tr(vp.x + ux * 56, vp.y + 6), opacity: 1 },
        { offset: fr(imp + 560), transform: tr(vp.x + ux * 58, vp.y + 8), opacity: 1 },
        { offset: 1, transform: tr(vp.x + ux * 60, vp.y + 10), opacity: 0 },
      ],
      { duration: total, easing: 'linear' },
    );
    const post = v.el.querySelector<SVGElement>('.postura');
    if (post) {
      const rot = (g: number, sy = 1, sxx = 1) => `rotate(${g.toFixed(0)}deg) scale(${sxx}, ${sy})`;
      this.anim(
        post,
        [
          { offset: 0, transform: rot(0) },
          { offset: fr(ant), transform: rot(0) },
          { offset: fr(ant + (imp - ant) * 0.3), transform: rot(-3 * sx, 1.06, 0.95) },
          { offset: fr(ant + (imp - ant) * 0.55), transform: rot(3 * sx, 1.06, 0.95) },
          { offset: fr(imp - 40), transform: rot(-5 * sx, 1.08, 0.93) },
          { offset: fr(imp), transform: rot(-8 * sx, 0.9, 1.08) },
          { offset: fr(imp + 200), transform: rot(34 * sx, 1, 1) },
          { offset: fr(imp + 420), transform: rot(78 * sx, 0.95, 1.02) },
          { offset: 1, transform: rot(84 * sx, 0.9, 1) },
        ],
        { duration: total, easing: 'linear' },
      );
    }
    // pernas e braços se debatem; chapéu/coroa voa
    for (const el of [...partes(v.el, 'braco'), ...partes(v.el, 'asa')]) {
      const lado = Number(el.dataset.lado) || 1;
      this.anim(
        el,
        [
          { offset: 0, transform: 'rotate(0deg)' },
          { offset: fr(imp), transform: 'rotate(0deg)' },
          { offset: fr(imp + 150), transform: `rotate(${-lado * 70}deg)` },
          { offset: fr(imp + 300), transform: `rotate(${-lado * 25}deg)` },
          { offset: fr(imp + 450), transform: `rotate(${-lado * 62}deg)` },
          { offset: 1, transform: `rotate(${-lado * 40}deg)` },
        ],
        { duration: total, easing: 'linear' },
      );
    }
    for (const el of partes(v.el, 'perna')) {
      const k = Number(el.dataset.fase) ? -1 : 1;
      this.anim(
        el,
        [
          { offset: 0, transform: 'rotate(0deg)' },
          { offset: fr(imp), transform: 'rotate(0deg)' },
          { offset: fr(imp + 200), transform: `rotate(${k * -42}deg)` },
          { offset: fr(imp + 360), transform: `rotate(${k * 30}deg)` },
          { offset: 1, transform: `rotate(${k * -30}deg)` },
        ],
        { duration: total, easing: 'linear' },
      );
    }
    for (const el of partes(v.el, 'topo')) {
      if (!el.dataset.solta) continue;
      this.anim(
        el,
        [
          { offset: 0, transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
          { offset: fr(imp), transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
          { offset: fr(imp + 330), transform: `translate(${sx * 20}px, -52px) rotate(${sx * 210}deg)`, opacity: 1 },
          { offset: fr(imp + 700), transform: `translate(${sx * 46}px, -14px) rotate(${sx * 420}deg)`, opacity: 0 },
          { offset: 1, transform: `translate(${sx * 46}px, -14px) rotate(${sx * 420}deg)`, opacity: 0 },
        ],
        { duration: total, easing: 'linear' },
      );
    }

    // impacto: tonto, "ai!", estrelas girando, tracinhos de pancada
    this.esperar(imp, () => {
      expressao(v.el, 'xis');
      olharReto(v.el);
      gotaEl.remove();
      this.extra(ef.pof(vp.x, vp.y, m.cor, `${semente}-pof`));
      const gr = this.sorteio(`${semente}-grito`);
      const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      texto.setAttribute('class', 'grito ef-grito');
      texto.setAttribute('x', String(vp.x + 50 + sx * 14));
      texto.setAttribute('y', String(vp.y - 8));
      texto.textContent = GRITOS[Math.floor(gr * GRITOS.length)];
      this.extra(texto);
      const est = ef.tontura();
      v.el.appendChild(est);
    });
    this.esperar(imp + 260, () => expressao(v.el, 'espiral'));
  }
}
