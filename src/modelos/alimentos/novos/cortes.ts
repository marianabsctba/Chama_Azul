// Peças destrinchadas como o livro corta, nas juntas: frango em oito pedaços (cru e assado),
// pato em quatro e coelho em pedaços. Cada pedaço vem do gerador de peças de ave, arrumado na
// tábua como fica depois do corte, com um respiro entre um e outro.
import { criarCtx, type Gerador, type Visual } from '../pecas';
import { gPecaAve } from '../fam_carnes';
import type { Parte } from '../nucleo';
import type { Lote } from './tipos';

interface Pedaco {
  /** Variante do gerador de peças de ave (perna, asa, peito, magret). */
  v: string;
  /** Tamanho do pedaço em metros. */
  t: number;
  a?: number;
  l?: number;
  /** Posição sobre a tábua (x, z) e giro em torno do eixo vertical. */
  x: number;
  z: number;
  giro: number;
  /** Espelha no eixo z (o pedaço do outro lado da ave). */
  espelho?: boolean;
}

/** Monta um conjunto de pedaços com as cores da ave. */
function conjunto(pedacos: Pedaco[], cores: { c1: string; c2?: string; ci: string; cc: string }, d = ''): Gerador {
  return (k) => {
    const out: Parte[] = [];
    pedacos.forEach((p, i) => {
      const vis: Visual = { f: 'peca_ave', v: p.v, t: p.t, a: p.a, l: p.l, c1: cores.c1, c2: cores.c2, ci: cores.ci, cc: cores.cc, d };
      const sub = criarCtx(`${k.id}-${i}`, vis, k.s * 31 + i * 7, 0.3, 0.45, k.ac);
      for (const pt of gPecaAve(sub)) {
        const g = pt.g.clone();
        if (p.espelho) {
          g.scale(1, 1, -1);
          // espelhar inverte a ordem dos triângulos: desfaz para a face continuar para fora
          const idx = g.getIndex();
          if (idx) {
            const a = idx.array as Uint16Array | Uint32Array;
            for (let j = 0; j < a.length; j += 3) { const t = a[j + 1]; a[j + 1] = a[j + 2]; a[j + 2] = t; }
            idx.needsUpdate = true;
          }
          g.computeVertexNormals();
        }
        g.rotateY(p.giro);
        g.translate(p.x, 0, p.z);
        out.push({ ...pt, g, corpo: i === 0 ? pt.corpo : false });
      }
    });
    return out;
  };
}

// frango em oito: 2 coxas, 2 sobrecoxas, 2 asas e o peito em 2 metades
const OITO: Pedaco[] = [
  { v: 'peito', t: 0.15, a: 0.2, l: 0.5, x: -0.06, z: -0.045, giro: 0.15 },
  { v: 'peito', t: 0.15, a: 0.2, l: 0.5, x: -0.06, z: 0.045, giro: -0.15, espelho: true },
  { v: 'perna', t: 0.11, a: 0.32, l: 0.42, x: 0.07, z: -0.075, giro: 0.5 },
  { v: 'perna', t: 0.11, a: 0.32, l: 0.42, x: 0.07, z: 0.075, giro: -0.5, espelho: true },
  { v: 'perna', t: 0.085, a: 0.36, l: 0.5, x: 0.085, z: -0.015, giro: 1.4 },
  { v: 'perna', t: 0.085, a: 0.36, l: 0.5, x: 0.085, z: 0.035, giro: 1.7, espelho: true },
  { v: 'asa', t: 0.12, a: 0.2, l: 0.4, x: -0.02, z: -0.11, giro: -0.3 },
  { v: 'asa', t: 0.12, a: 0.2, l: 0.4, x: -0.02, z: 0.11, giro: 0.3, espelho: true },
];

// pato em quatro: dois peitos com a asa e duas pernas inteiras
const QUATRO: Pedaco[] = [
  { v: 'magret', t: 0.19, a: 0.2, l: 0.5, x: -0.05, z: -0.05, giro: 0.1 },
  { v: 'magret', t: 0.19, a: 0.2, l: 0.5, x: -0.05, z: 0.05, giro: -0.1, espelho: true },
  { v: 'perna', t: 0.17, a: 0.3, l: 0.4, x: 0.09, z: -0.06, giro: 0.45 },
  { v: 'perna', t: 0.17, a: 0.3, l: 0.4, x: 0.09, z: 0.06, giro: -0.45, espelho: true },
];

// coelho: pernas traseiras em dois, dianteiras inteiras e o lombo em três
const COELHO: Pedaco[] = [
  { v: 'perna', t: 0.11, a: 0.3, l: 0.42, x: 0.08, z: -0.07, giro: 0.4 },
  { v: 'perna', t: 0.11, a: 0.3, l: 0.42, x: 0.08, z: 0.07, giro: -0.4, espelho: true },
  { v: 'perna', t: 0.08, a: 0.34, l: 0.46, x: 0.1, z: 0, giro: 1.5 },
  { v: 'perna', t: 0.08, a: 0.34, l: 0.46, x: 0.03, z: 0.13, giro: 0.2, espelho: true },
  { v: 'asa', t: 0.1, a: 0.24, l: 0.4, x: -0.1, z: -0.09, giro: -0.4 },
  { v: 'asa', t: 0.1, a: 0.24, l: 0.4, x: -0.1, z: 0.09, giro: 0.4, espelho: true },
  { v: 'peito', t: 0.075, a: 0.42, l: 0.6, x: -0.05, z: -0.01, giro: Math.PI / 2 },
  { v: 'peito', t: 0.075, a: 0.42, l: 0.6, x: -0.13, z: 0.0, giro: Math.PI / 2 },
  { v: 'peito', t: 0.075, a: 0.42, l: 0.6, x: 0.01, z: -0.02, giro: Math.PI / 2 + 0.2 },
];

const FRANGO_CRU = { c1: '#e2bc98', c2: '#d89c88', ci: '#e8b8a8', cc: '#c8823a' };
const FRANGO_ASSADO = { c1: '#c8823a', c2: '#a8602a', ci: '#f0dcc4', cc: '#b06a28' };
const PATO_CRU = { c1: '#e6ceae', c2: '#d4b494', ci: '#b8584a', cc: '#a85a28' };
const COELHO_CRU = { c1: '#e8b8b0', c2: '#ecc8bc', ci: '#e8b8b0', cc: '#c0864a' };

const vis = (v: string, t: number, c: { c1: string; c2?: string; ci: string; cc: string }): Visual => ({ f: 'peca_ave', v, t, a: 0.3, l: 0.9, c1: c.c1, c2: c.c2, ci: c.ci, cc: c.cc });

export const LOTE: Lote = {
  'frango-em-oito-pedacos': { visual: vis('oito', 0.26, FRANGO_CRU), gerar: conjunto(OITO, FRANGO_CRU) },
  'frango-assado-em-pedacos': { visual: vis('oito-assado', 0.26, FRANGO_ASSADO), gerar: conjunto(OITO, FRANGO_ASSADO, 'assado') },
  'pato-em-quatro': { visual: vis('quatro', 0.3, PATO_CRU), gerar: conjunto(QUATRO, PATO_CRU) },
  'coelho-em-pedacos': { visual: vis('coelho-pedacos', 0.3, COELHO_CRU), gerar: conjunto(COELHO, COELHO_CRU) },
};
