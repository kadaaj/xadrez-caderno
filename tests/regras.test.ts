/**
 * Testes de regras, salvamento e motor. Rodar com: npm test
 * (usa o suporte nativo do Node a TypeScript: Node 22.6+).
 */
import assert from 'node:assert/strict';
import { Partida, desfazerParaJogador, sanPortugues } from '../src/regras/partida.ts';
import { restaurar, salvar, CHAVE, CONFIG_PADRAO, type Armazenamento } from '../src/regras/salvamento.ts';
import { Buscador, Posicao, acharLance, lanceParaUci } from '../src/ia/motor.ts';

let ok = 0;
function teste(nome: string, fn: () => void) {
  try {
    fn();
    ok++;
    console.log('  ok  ' + nome);
  } catch (e) {
    console.error('FALHA ' + nome);
    throw e;
  }
}

const jogar = (p: Partida, lances: string) => {
  for (const l of lances.split(/\s+/).filter(Boolean)) assert.ok(p.jogarUci(l), 'lance ilegal: ' + l);
};

console.log('Regras');
teste('roque pequeno e grande', () => {
  const p = new Partida();
  jogar(p, 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1');
  assert.equal(p.peca('g1')?.type, 'k');
  assert.equal(p.peca('f1')?.type, 'r');
  jogar(p, 'd7d6 d2d3 c8g4 b1c3 d8d7 c1e3 e8c8');
  assert.equal(p.peca('c8')?.type, 'k');
  assert.equal(p.peca('d8')?.type, 'r');
});
teste('roque proibido atravessando casa atacada', () => {
  const q = new Partida();
  jogar(q, 'g2g3 b7b6 g1f3 c8a6 f1h3 e7e6 e2e3 g8f6');
  // bispo em a6 ataca f1 → roque pequeno ilegal
  assert.ok(!q.lancesDe('e1').some((m) => m.to === 'g1'));
  jogar(q, 'd2d3 f6e4');
  assert.ok(q.lancesDe('e1').some((m) => m.to === 'g1'), 'diagonal bloqueada libera o roque');
});
teste('en passant', () => {
  const p = new Partida();
  jogar(p, 'e2e4 a7a6 e4e5 d7d5');
  const ep = p.lancesDe('e5').find((m) => m.to === 'd6');
  assert.ok(ep && ep.isEnPassant());
  const m = p.jogarUci('e5d6')!;
  assert.equal(m.captured, 'p');
  assert.equal(p.peca('d5'), undefined);
});
teste('promoção com escolha (cavalo)', () => {
  const p = new Partida();
  jogar(p, 'h2h4 g7g5 h4g5 h7h6 g5h6 f8g7 h6h7 e7e6');
  const opcoes = p.lancesDe('h7').filter((m) => m.to === 'h8' || m.to === 'g8');
  assert.ok(opcoes.every((m) => m.promotion));
  assert.ok(p.jogar({ from: 'h7', to: 'g8', promotion: 'n' }));
  assert.equal(p.peca('g8')?.type, 'n');
});
teste('xeque-mate (mate do louco)', () => {
  const p = new Partida();
  jogar(p, 'f2f3 e7e5 g2g4 d8h4');
  const s = p.situacao();
  assert.equal(s.fim?.tipo, 'xequemate');
  assert.equal(s.fim?.vencedor, 'b');
  assert.equal(p.jogarUci('a2a3'), null, 'sem lances após o fim');
});
teste('afogamento', () => {
  // Sequência conhecida de afogamento rápido (Sam Loyd, 10 lances)
  const p = new Partida();
  jogar(p, 'e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6');
  const s = p.situacao();
  assert.equal(s.fim?.tipo, 'afogamento');
  assert.equal(s.fim?.vencedor, null);
});
teste('material insuficiente (automático)', () => {
  assert.equal(Partida.deFen('8/8/4k3/8/8/3K4/8/6N1 w - - 0 1').situacao().fim?.tipo, 'material');
  assert.equal(Partida.deFen('8/8/4k3/8/8/3K4/8/6R1 w - - 0 1').situacao().fim, null);
});
teste('tripla repetição é reivindicável (não automática)', () => {
  const p = new Partida();
  jogar(p, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
  const s = p.situacao();
  assert.equal(s.fim, null);
  assert.equal(s.reivindicavel, 'tripla');
  assert.ok(p.reivindicarEmpate());
  assert.equal(p.situacao().fim?.tipo, 'reivindicado-tripla');
  // desfazer remove a reivindicação
  p.desfazer();
  assert.equal(p.situacao().fim, null);
});
teste('quíntupla repetição encerra automaticamente', () => {
  const p = new Partida();
  const ciclo = 'g1f3 g8f6 f3g1 f6g8 ';
  jogar(p, ciclo.repeat(4));
  assert.equal(p.situacao().fim?.tipo, 'quintupla');
});
teste('regra dos 50 (reivindicável) e 75 lances (automática)', () => {
  const x = Partida.deFen('8/8/4k3/8/8/3K4/8/R6r w - - 99 80');
  assert.equal(x.situacao().reivindicavel, null);
  assert.ok(x.jogarUci('a1a2'));
  assert.equal(x.situacao().reivindicavel, 'cinquenta');
  assert.equal(x.situacao().fim, null);
  const y = Partida.deFen('8/8/4k3/8/8/3K4/8/R6r w - - 149 100');
  assert.ok(y.jogarUci('a1a2'));
  assert.equal(y.situacao().fim?.tipo, 'setentaecinco');
  const z = y;
  assert.ok(z);
});
teste('desfazer contra o computador devolve a vez ao humano', () => {
  const p = new Partida();
  jogar(p, 'e2e4 e7e5 g1f3');
  // humano = brancas; vez do computador (pretas) "pensando": desfaz só o lance humano
  assert.equal(desfazerParaJogador(p, 'w'), 1);
  assert.equal(p.vez(), 'w');
  assert.equal(p.historico().length, 2);
  // agora é a vez do humano: desfaz lance do computador + do humano
  assert.equal(desfazerParaJogador(p, 'w'), 2);
  assert.equal(p.vez(), 'w');
  assert.equal(p.historico().length, 0);
  // humano de pretas sem ter jogado: nada a desfazer
  const q = new Partida();
  jogar(q, 'e2e4');
  assert.equal(desfazerParaJogador(q, 'b'), 0);
  assert.equal(q.historico().length, 1);
  jogar(q, 'e7e5 d2d4');
  assert.equal(desfazerParaJogador(q, 'b'), 2);
  assert.equal(q.vez(), 'b');
});
teste('desfazer depois de xeque-mate dado pelo computador', () => {
  const p = new Partida();
  jogar(p, 'f2f3 e7e5 g2g4 d8h4');
  assert.equal(desfazerParaJogador(p, 'w'), 2);
  assert.equal(p.situacao().fim, null);
  assert.equal(p.vez(), 'w');
});
teste('notação em português', () => {
  assert.equal(sanPortugues('Nf3'), 'Cf3');
  assert.equal(sanPortugues('Qxe7+'), 'Dxe7+');
  assert.equal(sanPortugues('Kxf2'), 'Rxf2');
  assert.equal(sanPortugues('Rae1'), 'Tae1');
  assert.equal(sanPortugues('e8=Q#'), 'e8=D#');
  assert.equal(sanPortugues('O-O-O'), 'O-O-O');
});

console.log('Salvamento');
class Memoria implements Armazenamento {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
teste('salva e restaura (com empate reivindicado)', () => {
  const arm = new Memoria();
  const p = new Partida();
  jogar(p, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
  p.reivindicarEmpate();
  salvar({ versao: 1, config: { ...CONFIG_PADRAO, nivel: 'dificil' }, lances: p.uci(), reivindicado: 'tripla', numero: 4 }, arm);
  const r = restaurar(arm)!;
  assert.ok(r);
  assert.equal(r.partida.fen, p.fen);
  assert.equal(r.salvo.config.nivel, 'dificil');
  assert.equal(r.salvo.numero, 4);
  assert.equal(r.partida.situacao().fim?.tipo, 'reivindicado-tripla');
});
teste('rejeita salvamento corrompido', () => {
  const arm = new Memoria();
  arm.setItem(CHAVE, '{nao é json');
  assert.equal(restaurar(arm), null);
  arm.setItem(CHAVE, JSON.stringify({ versao: 1, config: CONFIG_PADRAO, lances: ['e2e5'], reivindicado: null, numero: 1 }));
  assert.equal(restaurar(arm), null);
  arm.setItem(CHAVE, JSON.stringify({ versao: 1, config: { modo: 'x' }, lances: [], reivindicado: null, numero: 1 }));
  assert.equal(restaurar(arm), null);
});

console.log('Motor');
teste('perft (posições de referência)', () => {
  const casos: [string, number, number][] = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
  ];
  for (const [fen, d, esperado] of casos) assert.equal(new Posicao(fen).perft(d), esperado, fen);
});
teste('motor encontra mate em 1 (nível difícil e médio)', () => {
  for (const nivel of ['medio', 'dificil'] as const) {
    const pos = new Posicao('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const m = new Buscador().escolher(pos, nivel, () => 0.5)!;
    assert.equal(lanceParaUci(m), 'a1a8', nivel);
  }
});
teste('motor ganha a dama pendurada (difícil)', () => {
  const pos = new Posicao('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1');
  const m = new Buscador().escolher(pos, 'dificil', () => 0.5)!;
  assert.equal(lanceParaUci(m), 'f3h4');
});
teste('busca interrompida por tempo não altera a posição', () => {
  for (const nivel of ['medio', 'dificil'] as const) {
    const pos = new Posicao('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const antes = [pos.h1, pos.h2, pos.lado, pos.roque, pos.ep, pos.lancesFeitos.length, pos.tab.join()];
    new Buscador().escolher(pos, nivel, () => 0.5);
    assert.deepEqual([pos.h1, pos.h2, pos.lado, pos.roque, pos.ep, pos.lancesFeitos.length, pos.tab.join()], antes);
  }
});
teste('motor e chess.js concordam nos lances legais de uma partida', () => {
  const p = new Partida();
  const pos = new Posicao();
  const rng = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  for (let i = 0; i < 160 && !p.situacao().fim; i++) {
    const a = p.todosLances().map((m) => m.from + m.to + (m.promotion ?? '')).sort();
    const b = pos.lancesLegais().map(lanceParaUci).sort();
    assert.deepEqual(b, a, 'divergência em ' + p.fen);
    const escolha = a[Math.floor(rng() * a.length)];
    p.jogarUci(escolha);
    pos.fazer(acharLance(pos, escolha)!);
  }
});

console.log(`\n${ok} testes passaram.`);
