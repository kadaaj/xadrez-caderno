/**
 * Cliente do adversário: conversa com o Web Worker e permite cancelar pedidos.
 * Cancelar encerra o worker (interrompendo a busca) e invalida a resposta pendente,
 * de modo que nenhum lance antigo seja aplicado em uma posição nova.
 */
import type { Nivel } from './motor.ts';
import type { PedidoIA, RespostaIA } from './worker.ts';

export class ClienteIA {
  private worker: Worker | null = null;
  private proximoId = 1;
  private pendente: { id: number; resolver: (r: RespostaIA | null) => void } | null = null;

  private garantirWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev: MessageEvent<RespostaIA>) => {
        const p = this.pendente;
        if (!p || ev.data.id !== p.id) return; // resposta antiga: descartada
        this.pendente = null;
        p.resolver(ev.data);
      };
      this.worker.onerror = (ev) => {
        console.error('Erro no worker da IA:', ev.message);
        const p = this.pendente;
        this.pendente = null;
        this.worker?.terminate();
        this.worker = null;
        p?.resolver(null);
      };
    }
    return this.worker;
  }

  get pensando(): boolean {
    return this.pendente !== null;
  }

  /** Pede um lance. Resolve com null se o pedido for cancelado. */
  pedir(lances: string[], nivel: Nivel): Promise<RespostaIA | null> {
    this.cancelar();
    const id = this.proximoId++;
    return new Promise((resolver) => {
      this.pendente = { id, resolver };
      const pedido: PedidoIA = { id, lances, nivel };
      this.garantirWorker().postMessage(pedido);
    });
  }

  cancelar(): void {
    if (this.pendente) {
      const p = this.pendente;
      this.pendente = null;
      // encerra a busca em andamento; um novo worker será criado no próximo pedido
      this.worker?.terminate();
      this.worker = null;
      p.resolver(null);
    }
  }
}
