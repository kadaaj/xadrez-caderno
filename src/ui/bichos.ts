/**
 * Controles de um bicho do tabuleiro: expressão do rosto (olhos e boca),
 * direção do olhar e piscadas. Tudo por atributos/variáveis CSS — o desenho
 * em si não é refeito, então a troca é instantânea e barata.
 */

export type Expressao =
  | 'normal'
  | 'feliz' // olhos em arquinho (peça escolhida, pouso, vitória)
  | 'bravo' // pálpebras enviesadas (quem vai capturar)
  | 'xis' // > < (capturado)
  | 'espiral' // tonto
  | 'alerta' // olhos arregalados (ameaça, antes de pular)
  | 'meio' // pálpebras meio fechadas (sono, indiferença)
  | 'cantando'; // olhos felizes e boquinha em "o"

export function expressao(g: Element, e: Expressao): void {
  if (e === 'normal') g.removeAttribute('data-exp');
  else g.setAttribute('data-exp', e);
}

export function expressaoAtual(g: Element): Expressao {
  return (g.getAttribute('data-exp') as Expressao | null) ?? 'normal';
}

/** Direção do olhar: x e y entre -1 e 1 (a pupila e o rosto deslizam um pouco). */
export function olhar(g: SVGElement, x: number, y: number): void {
  g.style.setProperty('--ox', x.toFixed(2));
  g.style.setProperty('--oy', y.toFixed(2));
}

export function olharReto(g: SVGElement): void {
  g.style.removeProperty('--ox');
  g.style.removeProperty('--oy');
}

/** Olhar na direção de um vetor (em unidades do tabuleiro), com intensidade que cai com a distância. */
export function olharPara(g: SVGElement, dx: number, dy: number): void {
  const d = Math.hypot(dx, dy);
  if (d < 1) {
    olharReto(g);
    return;
  }
  const f = Math.min(1, 0.55 + 140 / (d + 140));
  olhar(g, (dx / d) * f, (dy / d) * f * 0.9);
}

/** Piscada: a pálpebra desce e sobe (≈ 170 ms). */
export function piscar(g: Element): Animation[] {
  const anims: Animation[] = [];
  for (const p of g.querySelectorAll<SVGElement>('.palpebra')) {
    anims.push(
      p.animate(
        [
          { transform: 'scaleY(0.001)' },
          { transform: 'scaleY(1)', offset: 0.38 },
          { transform: 'scaleY(1)', offset: 0.52 },
          { transform: 'scaleY(0.001)' },
        ],
        { duration: 170, easing: 'ease-in-out' },
      ),
    );
  }
  return anims;
}

export function partes(g: Element, papel: string): SVGElement[] {
  return [...g.querySelectorAll<SVGElement>(`.p-${papel}`)];
}
