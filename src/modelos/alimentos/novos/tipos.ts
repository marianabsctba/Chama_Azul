// Lote de alimentos novos: cada grupo traz o visual (família de referência, tamanho e cores) e o
// gerador próprio da forma. A família diz como o jogo trata a peça (ave, doce, erva...); o gerador
// desenha a forma. Os nomes ficam em dados/alimentos_novos/<grupo>.json para o catálogo.
import type { Gerador, Visual } from '../pecas';

export interface AlimentoNovo {
  visual: Visual;
  gerar: Gerador;
}

export type Lote = Record<string, AlimentoNovo>;
