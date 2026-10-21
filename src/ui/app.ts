/**
 * Aplicação: liga regras (Partida), adversário (ClienteIA), arte e interface.
 */
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { ClienteIA } from '../ia/cliente.ts';
import type { Nivel } from '../ia/motor.ts';
import {
  NOME_COR,
  Partida,
  desfazerParaJogador,
  sanPortugues,
  valorMaterial,
  type Situacao,
} from '../regras/partida.ts';
import { CONFIG_PADRAO, restaurar, salvar, type Config, type Modo } from '../regras/salvamento.ts';
import { NOME_BICHO, NOME_PECA, svgPecaAvulsa } from '../arte/pecas.ts';
import { enfeitesDaPagina } from '../arte/rabiscos.ts';
import { Som } from './som.ts';
import { Demonstracao } from './demo.ts';
import { VistaTabuleiro, movimentoReduzido, type PecaNaCasa, type RespostaPressao } from './vista-tabuleiro.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const NOME_NIVEL: Record<Nivel, string> = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };
const ESPERA_MINIMA_IA = 450; // ms — o computador não responde "instantaneamente"

const RECADOS_GERAIS = [
  'a baleia tá bem?',
  'trouxemos lanchinho',
  'seu bispo parece perdido',
  'plano? que plano?',
  'o cavalinho quer pular',
  'respira e pensa',
  'joga baixinho, a lua tá dormindo',
  'foi mal pelo broto',
  'o capim tá crescendo',
  'alguém viu a aranha?',
  'jogada corajosa!',
  'as pedrinhas estão torcendo',
];

export class App {
  private partida = new Partida();
  private config: Config = { ...CONFIG_PADRAO };
  private numero = 1;
  private ia = new ClienteIA();
  private som = new Som();
  private vista: VistaTabuleiro;
  private selecionada: Square | null = null;
  private destinos: Move[] = [];
  private promocao: { from: Square; to: Square } | null = null;
  private resultadoFechado = false;
  private geracao = 0; // muda a cada reinício/desfazer/troca de modo
  private pensando = false;
  private demo: Demonstracao;

  constructor() {
    VistaTabuleiro.instalarDefs($<HTMLElement>('defs-pecas') as unknown as SVGSVGElement);
    this.vista = new VistaTabuleiro($<HTMLElement>('tabuleiro') as unknown as SVGSVGElement, {
      aoPressionar: (c) => this.aoPressionar(c),
      aoSoltar: (de, para) => this.aoSoltar(de, para),
      aoDesmarcar: () => this.desmarcar(),
    });
    this.demo = new Demonstracao(this.vista, $('demo-legenda'), { aoSair: () => this.aoSairDaDemo() });
    this.ligarControles();
    this.desenharEnfeites();

    const r = restaurar();
    if (r) {
      this.partida = r.partida;
      this.config = { ...r.salvo.config };
      this.numero = r.salvo.numero;
    }
    this.som.ligado = this.config.som;
    this.vista.setGirado(this.config.girado);
    this.atualizar();

    void this.abertura().then(() => {
      this.vista.redesenharPecas(this.posicao());
      this.vista.animarEntrada();
      this.agendarIA();
    });
  }

  /** Abertura escrita à mão (uma vez por sessão; clique pula; sem animação se o sistema pedir). */
  private abertura(): Promise<void> {
    const caixa = $<HTMLDivElement>('abertura');
    let jaViu = false;
    try {
      jaViu = sessionStorage.getItem('xadrez-de-caderno:abertura') === '1';
      sessionStorage.setItem('xadrez-de-caderno:abertura', '1');
    } catch {
      /* sem sessionStorage: mostra mesmo assim */
    }
    if (jaViu || movimentoReduzido()) return Promise.resolve();
    caixa.hidden = false;
    document.body.classList.add('com-abertura');
    return new Promise((resolver) => {
      let feito = false;
      const terminar = () => {
        if (feito) return;
        feito = true;
        caixa.classList.add('saindo');
        document.body.classList.remove('com-abertura');
        window.setTimeout(() => {
          caixa.hidden = true;
          caixa.classList.remove('saindo');
        }, 450);
        resolver();
      };
      caixa.addEventListener('pointerdown', terminar, { once: true });
      document.addEventListener('keydown', terminar, { once: true });
      window.setTimeout(terminar, 3900);
    });
  }

  // ------------------------------------------------------------ demonstração

  /** Entra na demonstração: o jogo real fica intacto (partida, ajustes e salvamento não são tocados). */
  private iniciarDemo(): void {
    if (this.demo.emAndamento) return;
    this.cancelarIA();
    this.fecharPromocao();
    this.desmarcar();
    this.vista.marcar({ ultimo: null, selecionada: null, destinos: [], xeque: null, ameacadas: [] });
    document.body.classList.add('em-demo');
    $('demo-sair').hidden = false;
    void this.demo.iniciar();
  }

  private aoSairDaDemo(): void {
    document.body.classList.remove('em-demo');
    $('demo-sair').hidden = true;
    this.vista.setGirado(this.config.girado);
    this.vista.redesenharPecas(this.posicao());
    this.atualizar();
    this.agendarIA();
  }

  // ------------------------------------------------------------ utilidades

  private posicao(): PecaNaCasa[] {
    const out: PecaNaCasa[] = [];
    for (const linha of this.partida.tabuleiro())
      for (const c of linha) if (c) out.push({ casa: c.square, cor: c.color, tipo: c.type });
    return out;
  }

  private vezDoComputador(): boolean {
    return (
      this.config.modo === 'computador' &&
      this.partida.vez() !== this.config.corHumano &&
      !this.partida.situacao().fim
    );
  }

  private salvar(): void {
    salvar({
      versao: 1,
      config: this.config,
      lances: this.partida.uci(),
      reivindicado: this.partida.empateReivindicado,
      numero: this.numero,
    });
  }

  /** Invalida qualquer resposta pendente do computador. */
  private cancelarIA(): void {
    this.geracao++;
    this.ia.cancelar();
    this.pensando = false;
  }

  // ------------------------------------------------------------ jogadas

  private aoPressionar(casa: Square): RespostaPressao {
    if (this.demo.emAndamento) return 'nada';
    if (this.promocao) return 'nada';
    if (this.partida.situacao().fim || this.vezDoComputador()) {
      this.desmarcar();
      return 'nada';
    }
    const peca = this.partida.peca(casa);
    if (this.selecionada && this.destinos.some((m) => m.to === casa)) {
      this.tentarLance(this.selecionada, casa);
      return 'nada';
    }
    if (peca && peca.color === this.partida.vez()) {
      if (this.selecionada === casa) return 'arrastar-ou-desmarcar';
      this.selecionar(casa);
      return this.destinos.length ? 'arrastar' : 'nada';
    }
    if (this.selecionada && peca === undefined) this.som.tocar('invalido');
    this.desmarcar();
    return 'nada';
  }

  private aoSoltar(de: Square, para: Square): boolean {
    if (!this.destinos.some((m) => m.from === de && m.to === para)) {
      this.som.tocar('invalido');
      return false;
    }
    return this.tentarLance(de, para);
  }

  private selecionar(casa: Square): void {
    this.selecionada = casa;
    this.destinos = this.partida.lancesDe(casa);
    this.atualizarMarcas();
  }

  private desmarcar(): void {
    if (!this.selecionada) return;
    this.selecionada = null;
    this.destinos = [];
    this.atualizarMarcas();
  }

  private tentarLance(de: Square, para: Square): boolean {
    const candidatos = this.destinos.filter((m) => m.from === de && m.to === para);
    if (!candidatos.length) return false;
    if (candidatos.some((m) => m.promotion)) {
      this.abrirPromocao(de, para);
      return false;
    }
    return this.executar({ from: de, to: para });
  }

  private executar(l: { from: Square; to: Square; promotion?: PieceSymbol }): boolean {
    const m = this.partida.jogar(l);
    if (!m) return false;
    this.selecionada = null;
    this.destinos = [];
    this.resultadoFechado = false;
    const anim = this.vista.sincronizar(this.posicao(), {
      from: m.from,
      to: m.to,
      captured: m.captured,
      promotion: m.promotion,
      enPassant: m.isEnPassant(),
      color: m.color,
    });
    const s = this.partida.situacao();
    // o som acompanha o impacto/pouso da animação (sem animação, toca na hora)
    const atraso = anim ? Math.round(anim.impacto) : 0;
    const tocar = (f: () => void, ms: number) => (ms <= 0 ? f() : void window.setTimeout(f, ms));
    tocar(() => this.som.tocar(s.xeque && !s.fim ? 'xeque' : m.captured ? 'captura' : 'lance'), atraso);
    if (s.fim) tocar(() => this.som.tocar('fim'), atraso + 280);
    this.salvar();
    this.atualizar();
    this.agendarIA();
    return true;
  }

  // ------------------------------------------------------------ promoção

  private abrirPromocao(de: Square, para: Square): void {
    this.promocao = { from: de, to: para };
    const cor = this.partida.vez();
    const caixa = $<HTMLDivElement>('promocao');
    const opcoes = $<HTMLDivElement>('opcoes-promocao');
    opcoes.innerHTML = (['q', 'r', 'b', 'n'] as PieceSymbol[])
      .map((t) => {
        const nome = NOME_PECA[t][0].toUpperCase() + NOME_PECA[t].slice(1);
        return `<button type="button" class="escolha-promocao" data-peca="${t}" title="${nome} (${NOME_BICHO[cor][t]})" aria-label="${nome}">${svgPecaAvulsa(cor, t)}<span>${nome}</span></button>`;
      })
      .join('');
    const pos = this.vista.posicaoRelativa(para);
    caixa.style.setProperty('--px', `${(Math.min(0.78, Math.max(0.22, pos.x)) * 100).toFixed(2)}%`);
    caixa.style.setProperty('--py', `${(pos.y * 100).toFixed(2)}%`);
    caixa.classList.toggle('embaixo', pos.y < 0.5);
    caixa.hidden = false;
    (opcoes.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private fecharPromocao(): void {
    this.promocao = null;
    $<HTMLDivElement>('promocao').hidden = true;
  }

  // ------------------------------------------------------------ computador

  private agendarIA(): void {
    if (this.demo?.emAndamento) return;
    if (!this.vezDoComputador()) {
      if (this.pensando) {
        this.pensando = false;
        this.atualizarVez();
      }
      return;
    }
    const geracao = ++this.geracao;
    const fenAntes = this.partida.fen;
    const lances = this.partida.uci();
    this.pensando = true;
    this.atualizarVez();
    const espera = new Promise((r) => window.setTimeout(r, movimentoReduzido() ? 150 : ESPERA_MINIMA_IA));
    const pedido = this.ia.pedir(lances, this.config.nivel);
    void Promise.all([pedido, espera, this.vista.aguardarAnimacoes()]).then(([resp]) => {
      if (geracao !== this.geracao || this.partida.fen !== fenAntes || !this.vezDoComputador()) return;
      this.pensando = false;
      if (!resp || !resp.uci) {
        if (resp?.erro) console.error(resp.erro);
        this.atualizarVez();
        return;
      }
      const uci = resp.uci;
      this.executar({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: (uci[4] as PieceSymbol) || undefined,
      });
    });
  }

  // ------------------------------------------------------------ comandos

  novaPartida(): void {
    this.cancelarIA();
    this.fecharPromocao();
    this.partida.reiniciar();
    this.numero++;
    this.selecionada = null;
    this.destinos = [];
    this.resultadoFechado = false;
    this.vista.redesenharPecas(this.posicao());
    this.vista.animarEntrada();
    this.salvar();
    this.atualizar();
    this.agendarIA();
  }

  desfazer(): void {
    this.cancelarIA();
    this.fecharPromocao();
    let n = 0;
    if (this.config.modo === 'computador') n = desfazerParaJogador(this.partida, this.config.corHumano);
    else n = this.partida.desfazer() ? 1 : 0;
    if (!n) {
      this.atualizar();
      return;
    }
    this.selecionada = null;
    this.destinos = [];
    this.resultadoFechado = false;
    this.vista.sincronizar(this.posicao());
    this.som.tocar('lance');
    this.salvar();
    this.atualizar();
    this.agendarIA();
  }

  private podeDesfazer(): boolean {
    const h = this.partida.historico();
    if (this.config.modo === 'computador') return h.some((m) => m.color === this.config.corHumano);
    return h.length > 0;
  }

  girar(): void {
    this.config.girado = !this.config.girado;
    this.vista.setGirado(this.config.girado);
    this.fecharPromocao();
    this.salvar();
    this.atualizarMarcas();
  }

  alternarSom(): void {
    this.config.som = !this.config.som;
    this.som.ligado = this.config.som;
    if (this.config.som) this.som.tocar('lance');
    this.salvar();
    this.atualizarBotoes();
  }

  private mudarModo(modo: Modo): void {
    if (modo === this.config.modo) return;
    this.cancelarIA();
    this.fecharPromocao();
    this.config.modo = modo;
    this.desmarcar();
    this.salvar();
    this.atualizar();
    this.agendarIA();
  }

  private mudarNivel(nivel: Nivel): void {
    if (nivel === this.config.nivel) return;
    this.cancelarIA();
    this.config.nivel = nivel;
    this.salvar();
    this.atualizar();
    this.agendarIA();
  }

  private mudarCor(cor: Color): void {
    if (cor === this.config.corHumano) return;
    this.cancelarIA();
    this.fecharPromocao();
    this.config.corHumano = cor;
    this.config.girado = cor === 'b';
    this.vista.setGirado(this.config.girado);
    this.desmarcar();
    this.salvar();
    this.atualizar();
    this.agendarIA();
  }

  private reivindicar(): void {
    if (this.vezDoComputador()) return;
    if (this.partida.reivindicarEmpate()) {
      this.cancelarIA();
      this.resultadoFechado = false;
      this.som.tocar('fim');
      this.salvar();
      this.atualizar();
    }
  }

  // ------------------------------------------------------------ controles

  private ligarControles(): void {
    $('btn-nova').addEventListener('click', () => this.novaPartida());
    $('btn-desfazer').addEventListener('click', () => this.desfazer());
    $('btn-girar').addEventListener('click', () => this.girar());
    $('btn-som').addEventListener('click', () => this.alternarSom());
    // durante a demonstração só o botão de sair responde (teclado incluído)
    document.addEventListener(
      'click',
      (e) => {
        if (this.demo.emAndamento && !(e.target as HTMLElement).closest('#demo-sair')) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    $('btn-demo').addEventListener('click', () => this.iniciarDemo());
    $('demo-sair').addEventListener('click', () => this.demo.sair());
    $('btn-reivindicar').addEventListener('click', () => this.reivindicar());
    $('resultado-nova').addEventListener('click', () => this.novaPartida());
    $('resultado-fechar').addEventListener('click', () => {
      this.resultadoFechado = true;
      this.atualizarResultado(this.partida.situacao());
    });
    $('cancelar-promocao').addEventListener('click', () => {
      this.fecharPromocao();
      this.atualizarMarcas();
    });
    $('opcoes-promocao').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-peca]') as HTMLButtonElement | null;
      if (!b || !this.promocao) return;
      const { from, to } = this.promocao;
      this.fecharPromocao();
      this.executar({ from, to, promotion: b.dataset.peca as PieceSymbol });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-modo]').forEach((b) =>
      b.addEventListener('click', () => this.mudarModo(b.dataset.modo as Modo)),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-nivel]').forEach((b) =>
      b.addEventListener('click', () => this.mudarNivel(b.dataset.nivel as Nivel)),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-cor]').forEach((b) =>
      b.addEventListener('click', () => this.mudarCor(b.dataset.cor as Color)),
    );
    document.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('com-abertura')) return;
      const alvo = e.target as HTMLElement;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
      if (this.demo.emAndamento) {
        if (e.key === 'Escape') this.demo.sair();
        return;
      }
      if (e.key === 'Escape') {
        if (this.promocao) {
          this.fecharPromocao();
          this.atualizarMarcas();
        } else this.desmarcar();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.desfazer();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'n') this.novaPartida();
      else if (k === 'g') this.girar();
      else if (k === 's') this.alternarSom();
      else if (k === 'd') this.iniciarDemo();
    });
  }

  // ------------------------------------------------------------ renderização

  private atualizar(): void {
    const s = this.partida.situacao();
    this.atualizarMarcas();
    this.atualizarVez();
    this.atualizarBotoes();
    this.atualizarAjustes();
    this.atualizarCapturas();
    this.atualizarLances();
    this.atualizarResultado(s);
    this.atualizarEmpate(s);
    this.atualizarRecado(s);
    $('subtitulo').textContent =
      `partida nº ${this.numero} · ` +
      (this.config.modo === 'dois' ? 'dois jogadores' : `contra o computador (${NOME_NIVEL[this.config.nivel]})`);
  }

  private atualizarMarcas(): void {
    const s = this.partida.situacao();
    const ult = this.partida.ultimo();
    let xeque: Square | null = null;
    if (s.xeque) {
      for (const p of this.posicao()) if (p.tipo === 'k' && p.cor === s.vez) xeque = p.casa;
    }
    const destinos = new Map<Square, boolean>();
    for (const m of this.destinos) destinos.set(m.to, Boolean(m.captured));
    this.vista.marcar({
      ultimo: ult ? { from: ult.from, to: ult.to, cor: ult.color } : null,
      selecionada: this.selecionada,
      destinos: [...destinos].map(([casa, captura]) => ({ casa, captura })),
      xeque,
      ameacadas: this.partida.ameacadas().filter((c) => c !== xeque),
    });
  }

  private atualizarVez(): void {
    const s = this.partida.situacao();
    const vez = $('vez');
    const cor = s.vez;
    if (s.fim) {
      const t = s.fim.vencedor ? `${s.fim.titulo.toLowerCase()} as ${NOME_COR[s.fim.vencedor]} venceram` : s.fim.titulo.toLowerCase();
      vez.innerHTML = `<span class="status-texto fim">${t}</span>`;
      return;
    }
    let texto: string;
    if (this.config.modo === 'computador') {
      if (cor === this.config.corHumano) texto = 'sua vez';
      else texto = this.pensando ? 'o computador está pensando<i>.</i><i>.</i><i>.</i>' : 'vez do computador';
    } else {
      texto = `vez das ${NOME_COR[cor]}`;
    }
    const icone = `<span class="status-icone">${svgPecaAvulsa(cor, 'k')}</span>`;
    vez.innerHTML = `${icone}<span class="status-texto${this.pensando ? ' pensando' : ''}">${texto}</span>${s.xeque ? '<span class="status-xeque">xeque!</span>' : ''}`;
  }

  private atualizarBotoes(): void {
    ($('btn-desfazer') as HTMLButtonElement).disabled = !this.podeDesfazer();
    const bs = $('btn-som') as HTMLButtonElement;
    bs.textContent = this.config.som ? 'som: ligado' : 'som: mudo';
    bs.setAttribute('aria-pressed', String(this.config.som));
  }

  private atualizarAjustes(): void {
    const marca = (sel: string, ativo: (b: HTMLButtonElement) => boolean) =>
      document.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => {
        const a = ativo(b);
        b.classList.toggle('ativa', a);
        b.setAttribute('aria-checked', String(a));
      });
    marca('[data-modo]', (b) => b.dataset.modo === this.config.modo);
    marca('[data-nivel]', (b) => b.dataset.nivel === this.config.nivel);
    marca('[data-cor]', (b) => b.dataset.cor === this.config.corHumano);
    const comp = this.config.modo === 'computador';
    $('linha-nivel').classList.toggle('apagada', !comp);
    $('linha-cor').classList.toggle('apagada', !comp);
    document
      .querySelectorAll<HTMLButtonElement>('#linha-nivel button, #linha-cor button')
      .forEach((b) => (b.disabled = !comp));
  }

  private atualizarCapturas(): void {
    const cap = this.partida.capturadas();
    const vw = valorMaterial(cap.b);
    const vb = valorMaterial(cap.w);
    const linhaCap = (quem: Color, pecas: PieceSymbol[], saldo: number) => {
      const vitima: Color = quem === 'w' ? 'b' : 'w';
      const icones = pecas.map((t) => svgPecaAvulsa(vitima, t, 'mini')).join('');
      return `<div class="linha-captura"><span class="rotulo">${quem === 'w' ? 'brancas' : 'pretas'} pegaram:</span><span class="icones">${icones || '<em>ninguém ainda</em>'}</span>${saldo > 0 ? `<span class="saldo">+${saldo}</span>` : ''}</div>`;
    };
    $('capturas').innerHTML = linhaCap('w', cap.b, vw - vb) + linhaCap('b', cap.w, vb - vw);
  }

  private atualizarLances(): void {
    const h = this.partida.historico();
    const ol = $('lista-lances');
    let html = '';
    for (let i = 0; i < h.length; i += 2) {
      const a = h[i];
      const b = h[i + 1];
      const ult = (k: number) => (k === h.length - 1 ? ' ultimo' : '');
      html += `<li><span class="num">${i / 2 + 1}.</span><span class="lance quente${ult(i)}">${sanPortugues(a.san)}</span>${b ? `<span class="lance fria${ult(i + 1)}">${sanPortugues(b.san)}</span>` : '<span class="lance"></span>'}</li>`;
    }
    if (!h.length) html = `<li class="vazio">nenhum lance ainda — as brancas começam</li>`;
    ol.innerHTML = html;
    const caixa = ol.parentElement;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }

  private atualizarResultado(s: Situacao): void {
    const caixa = $<HTMLDivElement>('resultado');
    if (!s.fim || this.resultadoFechado) {
      caixa.hidden = true;
      return;
    }
    $('resultado-titulo').textContent = s.fim.titulo;
    $('resultado-detalhe').textContent = s.fim.detalhe;
    caixa.hidden = false;
  }

  private atualizarEmpate(s: Situacao): void {
    const aviso = $<HTMLDivElement>('aviso-empate');
    const pode = !s.fim && s.reivindicavel && !this.vezDoComputador();
    aviso.hidden = !pode;
    if (pode) {
      $('aviso-empate-texto').textContent =
        s.reivindicavel === 'tripla' ? 'a posição se repetiu três vezes' : '50 lances sem captura nem lance de peão';
    }
  }

  /** Recadinho no bilhete da esquerda: muda com a partida, mas é sempre o mesmo para a mesma posição. */
  private atualizarRecado(s: Situacao): void {
    const h = this.partida.historico();
    const ult = h[h.length - 1];
    let texto: string;
    if (s.fim) {
      if (s.fim.tipo === 'xequemate')
        texto = s.fim.vencedor === 'w' ? 'o pinguim foi dormir mais cedo' : 'a coruja perdeu a coroa hoje';
      else texto = 'empate: todo mundo divide o lanche';
    } else if (!h.length) {
      texto = 'boa sorte!';
    } else if (s.xeque) {
      texto = s.vez === 'w' ? 'cuidado com a coruja!' : 'protejam o pinguim!';
    } else if (ult?.captured) {
      const vitima: Color = ult.color === 'w' ? 'b' : 'w';
      const opcoes = [`foi mal, ${NOME_BICHO[vitima][ult.captured]}`, `o ${NOME_BICHO[vitima][ult.captured]} vai ficar bem`, 'essa doeu'];
      texto = opcoes[(h.length + this.numero) % opcoes.length];
    } else {
      const cap = this.partida.capturadas();
      const humano = this.config.corHumano;
      const perdeu = valorMaterial(cap[humano]) - valorMaterial(cap[humano === 'w' ? 'b' : 'w']);
      if (this.config.modo === 'computador' && perdeu >= 6) texto = 'desiste? (brincadeira)';
      else texto = RECADOS_GERAIS[(h.length * 5 + this.numero * 3) % RECADOS_GERAIS.length];
    }
    const p = $('recado-texto');
    if (p.textContent !== texto) {
      p.textContent = texto;
      const r = $('recado');
      r.classList.remove('novo');
      void r.offsetWidth;
      r.classList.add('novo');
    }
  }

  private desenharEnfeites(): void {
    const e = enfeitesDaPagina();
    $('enfeites').innerHTML = Object.entries(e)
      .map(([nome, svg]) => `<div class="enf enf-${nome}">${svg}</div>`)
      .join('');
  }
}
