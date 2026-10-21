/**
 * Salvamento local da partida (localStorage). Guarda apenas a lista de lances
 * em UCI e as preferências; ao restaurar, os lances são revalidados pelo chess.js.
 */
import { Partida, type Cor } from './partida.ts';
import type { Nivel } from '../ia/motor.ts';

export type Modo = 'dois' | 'computador';

export interface Config {
  modo: Modo;
  nivel: Nivel;
  corHumano: Cor;
  girado: boolean;
  som: boolean;
}

export interface Salvo {
  versao: 1;
  config: Config;
  lances: string[];
  reivindicado: 'tripla' | 'cinquenta' | null;
  numero: number;
}

export const CHAVE = 'xadrez-de-caderno:partida';

export const CONFIG_PADRAO: Config = {
  modo: 'computador',
  nivel: 'medio',
  corHumano: 'w',
  girado: false,
  som: true,
};

export interface Armazenamento {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function salvar(dados: Salvo, arm: Armazenamento | null = armazenamentoPadrao()): boolean {
  if (!arm) return false;
  try {
    arm.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch {
    return false;
  }
}

function configValida(c: unknown): c is Config {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    (o.modo === 'dois' || o.modo === 'computador') &&
    (o.nivel === 'facil' || o.nivel === 'medio' || o.nivel === 'dificil') &&
    (o.corHumano === 'w' || o.corHumano === 'b') &&
    typeof o.girado === 'boolean' &&
    typeof o.som === 'boolean'
  );
}

export function restaurar(
  arm: Armazenamento | null = armazenamentoPadrao(),
): { salvo: Salvo; partida: Partida } | null {
  if (!arm) return null;
  let bruto: string | null;
  try {
    bruto = arm.getItem(CHAVE);
  } catch {
    return null;
  }
  if (!bruto) return null;
  try {
    const d = JSON.parse(bruto) as Salvo;
    if (d.versao !== 1 || !Array.isArray(d.lances) || !configValida(d.config)) return null;
    const reiv = d.reivindicado === 'tripla' || d.reivindicado === 'cinquenta' ? d.reivindicado : null;
    const partida = Partida.deUci(d.lances, reiv);
    if (!partida) return null;
    return {
      salvo: { ...d, reivindicado: reiv, numero: Number.isFinite(d.numero) ? d.numero : 1 },
      partida,
    };
  } catch {
    return null;
  }
}
