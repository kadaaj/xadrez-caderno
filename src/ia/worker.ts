/// <reference lib="webworker" />
/**
 * Web Worker do adversário: recebe a lista de lances da partida e devolve um lance UCI.
 */
import { Buscador, Posicao, acharLance, lanceParaUci, type Nivel } from './motor.ts';

export interface PedidoIA {
  id: number;
  lances: string[];
  nivel: Nivel;
}
export interface RespostaIA {
  id: number;
  uci: string | null;
  profundidade: number;
  nos: number;
  erro?: string;
}

const buscador = new Buscador(() => performance.now());

self.onmessage = (ev: MessageEvent<PedidoIA>) => {
  const { id, lances, nivel } = ev.data;
  try {
    const pos = new Posicao();
    for (const uci of lances) {
      const m = acharLance(pos, uci);
      if (m === null) throw new Error('Lance inválido recebido: ' + uci);
      pos.fazer(m);
    }
    const m = buscador.escolher(pos, nivel);
    const resp: RespostaIA = {
      id,
      uci: m === null ? null : lanceParaUci(m),
      profundidade: buscador.profundidadeAtingida,
      nos: buscador.nosTotais,
    };
    (self as unknown as Worker).postMessage(resp);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, uci: null, profundidade: 0, nos: 0, erro: String(e) });
  }
};
