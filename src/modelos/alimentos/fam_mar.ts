// Famílias de pescados: peixes roliços e chatos, filés e postas, crustáceos,
// bivalves, conchas em espiral e lula.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, malhaAneis, PI, TAU, V,
  type CorFn, type Parte, type RGB, type Anel,
} from './nucleo';
import { folha, caule, contornos, olho, grao, disco, type Ctx, type Gerador } from './pecas';
import { lamina, olhoPeixe, apontar, cintila } from './mar_pecas';

const PRETO: RGB = [0.01, 0.01, 0.012];
const BRANCO_OLHO: RGB = [0.75, 0.72, 0.6];

/* ------------------------------------------------------------------ */
/* Espécies de peixe roliço: proporções, nadadeiras e desenho da pele   */
/* ------------------------------------------------------------------ */

type TipoNad = 'tri' | 'foice' | 'arred' | 'longa' | 'espinhosa' | 'mista' | 'filamento';
/** Nadadeira mediana: de u0 a u1 ao longo do corpo (0 no pedúnculo, 1 no focinho), altura em fração de T. */
interface Nad { u0: number; u1: number; alt: number; tipo: TipoNad; varre?: number; cor?: string }
type TipoCauda = 'garfo' | 'lua' | 'reta' | 'redonda' | 'ponta';

interface Especie {
  /** Posição da altura máxima ao longo do corpo. */
  um: number;
  /** Altura e largura do pedúnculo em fração do máximo. */
  ped: number;
  pedL: number;
  /** Expoente de enchimento do tronco (menor = mais cheio perto do rabo). */
  cheio: number;
  /** Fração da altura acima da linha do focinho. */
  fracT: number;
  /** Expoentes (p, q) do perfil da cabeça: topo e ventre. */
  cabT: [number, number];
  cabB: [number, number];
  cauda: { tipo: TipoCauda; comp: number; alt: number; garfo: number };
  dorsais: Nad[];
  anais: Nad[];
  /** Posição da adiposa (0 = sem). */
  adiposa: number;
  /** Pínulas atrás da segunda dorsal e da anal (cavala). */
  pinulas: number;
  /** Peitoral: distância do focinho, comprimento e raiz em fração de T, altura (yn) da raiz. */
  peit: { d: number; comp: number; larg: number; yn: number; abre: number } | null;
  pelv: { u: number; comp: number } | null;
  /** Olho: raio, distância do focinho e altura relativa (yn). */
  olho: number;
  dOlho: number;
  ynOlho: number;
  /** Boca: canto (distância do focinho), altura e inclinação; fim do opérculo. */
  dBoca: number;
  ynBoca: number;
  inclBoca: number;
  dOp: number;
  /** Seção em ovo: positivo estreita o dorso. */
  ov: number;
  /** Tamanho das escamas em fração de T (0 = pele lisa). */
  escama: number;
  barb: { n: number; comp: number } | null;
  /** Deitado de lado na tábua (o tamboril repousa de barriga). */
  deitado: boolean;
  /** Cores extras: ventre, nadadeiras dorsais e ventrais, íris, pinta, linha lateral, margem da cauda. */
  cores: { ventre?: string; nadD?: string; nadV?: string; iris?: string; pinta?: string; linha?: string; margem?: string };
  /** Palavras de desenho da pele, somadas às da tabela visual. */
  padrao: string;
}

const P0: Especie = {
  um: 0.56, ped: 0.3, pedL: 0.4, cheio: 0.8, fracT: 0.55,
  cabT: [2, 0.62], cabB: [1.8, 0.6],
  cauda: { tipo: 'garfo', comp: 0.18, alt: 0.21, garfo: 0.7 },
  dorsais: [{ u0: 0.5, u1: 0.66, alt: 0.1, tipo: 'tri' }],
  anais: [{ u0: 0.14, u1: 0.27, alt: 0.07, tipo: 'tri' }],
  adiposa: 0, pinulas: 0,
  peit: { d: 0.235, comp: 0.12, larg: 0.035, yn: -0.45, abre: 0.3 },
  pelv: { u: 0.47, comp: 0.075 },
  olho: 0.012, dOlho: 0.065, ynOlho: 0.32,
  dBoca: 0.1, ynBoca: -0.08, inclBoca: -0.12, dOp: 0.21,
  ov: 0.12, escama: 0.012, barb: null, deitado: true, cores: {}, padrao: '',
};

const ESPECIES: Record<string, Partial<Especie>> = {
  salmao: {
    um: 0.56, ped: 0.27, cauda: { tipo: 'garfo', comp: 0.19, alt: 0.2, garfo: 0.74 },
    dorsais: [{ u0: 0.49, u1: 0.63, alt: 0.1, tipo: 'tri' }], adiposa: 0.2,
    anais: [{ u0: 0.13, u1: 0.25, alt: 0.07, tipo: 'tri' }],
    olho: 0.011, dOlho: 0.06, dBoca: 0.105, dOp: 0.2,
    cores: { nadD: '5c6670', nadV: 'c8ccd0', iris: 'c8c0a0', margem: '3a4048' }, padrao: 'pintas',
  },
  truta: {
    um: 0.55, ped: 0.33, cauda: { tipo: 'garfo', comp: 0.18, alt: 0.2, garfo: 0.9 },
    dorsais: [{ u0: 0.48, u1: 0.62, alt: 0.1, tipo: 'tri' }], adiposa: 0.21,
    anais: [{ u0: 0.13, u1: 0.25, alt: 0.08, tipo: 'tri' }],
    olho: 0.016, dOlho: 0.065, dBoca: 0.1, dOp: 0.21, escama: 0.008,
    cores: { nadD: '7a7c5a', nadV: 'd8b0a0', iris: 'c8b070', pinta: '1c1a16' }, padrao: 'pintasdensas faixa',
  },
  sardinha: {
    um: 0.55, ped: 0.22, cauda: { tipo: 'garfo', comp: 0.19, alt: 0.22, garfo: 0.42 },
    dorsais: [{ u0: 0.44, u1: 0.58, alt: 0.09, tipo: 'tri' }],
    anais: [{ u0: 0.08, u1: 0.2, alt: 0.035, tipo: 'tri' }],
    peit: { d: 0.22, comp: 0.1, larg: 0.03, yn: -0.6, abre: 0.25 }, pelv: { u: 0.45, comp: 0.06 },
    olho: 0.026, dOlho: 0.07, ynOlho: 0.25, dBoca: 0.07, ynBoca: 0.05, inclBoca: 0.25, dOp: 0.22,
    escama: 0.022, cores: { nadD: '8090a0', nadV: 'e6eaee', iris: 'e8e4d8' }, padrao: 'semlinha pontos',
  },
  arenque: {
    um: 0.55, ped: 0.22, cauda: { tipo: 'garfo', comp: 0.18, alt: 0.21, garfo: 0.42 },
    dorsais: [{ u0: 0.45, u1: 0.58, alt: 0.085, tipo: 'tri' }],
    anais: [{ u0: 0.08, u1: 0.2, alt: 0.035, tipo: 'tri' }],
    peit: { d: 0.22, comp: 0.09, larg: 0.03, yn: -0.6, abre: 0.25 }, pelv: { u: 0.46, comp: 0.055 },
    olho: 0.024, dOlho: 0.065, ynOlho: 0.25, dBoca: 0.07, ynBoca: 0.05, inclBoca: 0.3, dOp: 0.22,
    escama: 0.022, cores: { nadD: '8a98a8', nadV: 'e6eaee', iris: 'e8e0d0' }, padrao: 'semlinha',
  },
  cavala: {
    um: 0.56, ped: 0.13, pedL: 0.55, cheio: 0.7, cauda: { tipo: 'lua', comp: 0.17, alt: 0.24, garfo: 0.32 },
    dorsais: [{ u0: 0.55, u1: 0.72, alt: 0.085, tipo: 'espinhosa' }, { u0: 0.33, u1: 0.42, alt: 0.065, tipo: 'foice' }],
    anais: [{ u0: 0.3, u1: 0.39, alt: 0.06, tipo: 'foice' }], pinulas: 5,
    peit: { d: 0.22, comp: 0.09, larg: 0.03, yn: -0.15, abre: 0.25 }, pelv: { u: 0.64, comp: 0.05 },
    olho: 0.02, dOlho: 0.06, ynOlho: 0.28, dBoca: 0.08, dOp: 0.21, escama: 0.004,
    cores: { nadD: '3a5050', nadV: 'd8dde0', iris: 'd8d0b0' }, padrao: 'listras iridescente',
  },
  tainha: {
    um: 0.55, ped: 0.34, fracT: 0.5, cabT: [1.5, 0.55], cauda: { tipo: 'garfo', comp: 0.18, alt: 0.2, garfo: 0.68 },
    dorsais: [{ u0: 0.57, u1: 0.65, alt: 0.075, tipo: 'espinhosa' }, { u0: 0.33, u1: 0.42, alt: 0.075, tipo: 'tri' }],
    anais: [{ u0: 0.3, u1: 0.41, alt: 0.07, tipo: 'tri' }],
    peit: { d: 0.22, comp: 0.09, larg: 0.03, yn: 0.05, abre: 0.25 }, pelv: { u: 0.58, comp: 0.06 },
    olho: 0.017, dOlho: 0.055, ynOlho: 0.3, dBoca: 0.045, ynBoca: -0.1, inclBoca: 0, dOp: 0.2, escama: 0.03,
    cores: { nadD: '6a747c', nadV: 'c8ccd0', iris: 'd8d0b8' }, padrao: 'linhas semlinha',
  },
  vermelho: {
    um: 0.58, ped: 0.27, fracT: 0.62, cabT: [2.2, 0.6], cauda: { tipo: 'garfo', comp: 0.19, alt: 0.27, garfo: 0.72 },
    dorsais: [{ u0: 0.3, u1: 0.78, alt: 0.1, tipo: 'mista' }],
    anais: [{ u0: 0.17, u1: 0.32, alt: 0.085, tipo: 'mista' }],
    peit: { d: 0.25, comp: 0.15, larg: 0.035, yn: -0.4, abre: 0.3 }, pelv: { u: 0.68, comp: 0.09 },
    olho: 0.026, dOlho: 0.085, ynOlho: 0.38, dBoca: 0.11, ynBoca: -0.15, dOp: 0.27, escama: 0.024,
    cores: { ventre: 'f2c0b4', nadD: 'd8463a', nadV: 'e8806a', iris: 'd04030' }, padrao: '',
  },
  'peixe-imperador': {
    um: 0.58, ped: 0.25, fracT: 0.62, cabT: [2.4, 0.6], cauda: { tipo: 'garfo', comp: 0.18, alt: 0.28, garfo: 0.7 },
    dorsais: [{ u0: 0.28, u1: 0.78, alt: 0.11, tipo: 'mista' }],
    anais: [{ u0: 0.16, u1: 0.32, alt: 0.09, tipo: 'mista' }],
    peit: { d: 0.27, comp: 0.17, larg: 0.035, yn: -0.35, abre: 0.3 }, pelv: { u: 0.68, comp: 0.1 },
    olho: 0.03, dOlho: 0.09, ynOlho: 0.4, dBoca: 0.09, ynBoca: -0.2, dOp: 0.28, escama: 0.024,
    cores: { ventre: 'f4c8bc', nadD: 'c84a3c', nadV: 'e88070', iris: 'e0a020' }, padrao: '',
  },
  perca: {
    um: 0.56, ped: 0.3, fracT: 0.6, cabT: [2, 0.6], cauda: { tipo: 'garfo', comp: 0.17, alt: 0.22, garfo: 0.82 },
    dorsais: [{ u0: 0.5, u1: 0.72, alt: 0.11, tipo: 'espinhosa' }, { u0: 0.28, u1: 0.47, alt: 0.09, tipo: 'tri' }],
    anais: [{ u0: 0.17, u1: 0.28, alt: 0.075, tipo: 'tri' }],
    peit: { d: 0.25, comp: 0.11, larg: 0.035, yn: -0.3, abre: 0.3 }, pelv: { u: 0.68, comp: 0.08 },
    olho: 0.022, dOlho: 0.075, ynOlho: 0.35, dBoca: 0.09, dOp: 0.26, escama: 0.018,
    cores: { ventre: 'e8e4c8', nadD: '6a6a48', nadV: 'e06030', iris: 'e0b030' }, padrao: 'faixas',
  },
  carpa: {
    um: 0.55, ped: 0.38, fracT: 0.6, cheio: 0.7, cabT: [1.8, 0.6], cauda: { tipo: 'garfo', comp: 0.18, alt: 0.26, garfo: 0.55 },
    dorsais: [{ u0: 0.34, u1: 0.67, alt: 0.1, tipo: 'longa' }],
    anais: [{ u0: 0.15, u1: 0.24, alt: 0.085, tipo: 'tri' }],
    peit: { d: 0.23, comp: 0.11, larg: 0.035, yn: -0.6, abre: 0.3 }, pelv: { u: 0.47, comp: 0.08 },
    olho: 0.015, dOlho: 0.065, ynOlho: 0.28, dBoca: 0.05, ynBoca: -0.05, inclBoca: -0.2, dOp: 0.22, escama: 0.042,
    barb: { n: 4, comp: 0.035 }, cores: { ventre: 'eadcb0', nadD: '7a6a3a', nadV: 'b07a48', iris: 'd8b040' }, padrao: '',
  },
  bagre: {
    um: 0.62, ped: 0.34, pedL: 0.45, fracT: 0.45, cabT: [1.4, 0.5], cabB: [2.2, 0.55], ov: -0.08,
    cauda: { tipo: 'garfo', comp: 0.16, alt: 0.19, garfo: 0.6 },
    dorsais: [{ u0: 0.63, u1: 0.71, alt: 0.1, tipo: 'tri' }], adiposa: 0.27,
    anais: [{ u0: 0.11, u1: 0.33, alt: 0.055, tipo: 'longa' }],
    peit: { d: 0.2, comp: 0.1, larg: 0.03, yn: -0.65, abre: 0.4 }, pelv: { u: 0.47, comp: 0.07 },
    olho: 0.009, dOlho: 0.07, ynOlho: 0.45, dBoca: 0.07, ynBoca: -0.2, inclBoca: 0, dOp: 0.2, escama: 0,
    barb: { n: 6, comp: 0.2 }, cores: { ventre: 'ece6d8', nadD: '4a463c', nadV: '8a8270', iris: 'b0a060' }, padrao: 'semlinha',
  },
  bacalhau: {
    um: 0.6, ped: 0.28, cabT: [1.9, 0.6], cauda: { tipo: 'reta', comp: 0.15, alt: 0.2, garfo: 0.95 },
    dorsais: [{ u0: 0.6, u1: 0.74, alt: 0.08, tipo: 'arred' }, { u0: 0.36, u1: 0.56, alt: 0.07, tipo: 'arred' }, { u0: 0.12, u1: 0.32, alt: 0.065, tipo: 'arred' }],
    anais: [{ u0: 0.36, u1: 0.56, alt: 0.06, tipo: 'arred' }, { u0: 0.12, u1: 0.32, alt: 0.06, tipo: 'arred' }],
    peit: { d: 0.26, comp: 0.1, larg: 0.035, yn: -0.25, abre: 0.3 }, pelv: { u: 0.79, comp: 0.07 },
    olho: 0.014, dOlho: 0.075, ynOlho: 0.42, dBoca: 0.1, ynBoca: -0.15, inclBoca: -0.1, dOp: 0.24, escama: 0.006,
    barb: { n: 1, comp: 0.04 }, cores: { ventre: 'ece8dc', nadD: '6a6448', nadV: 'b8b49c', iris: 'b8b08a', linha: 'e8e4d0' }, padrao: 'sarda linhaclara',
  },
  hadoque: {
    um: 0.6, ped: 0.27, cabT: [1.9, 0.6], cauda: { tipo: 'reta', comp: 0.15, alt: 0.19, garfo: 0.88 },
    dorsais: [{ u0: 0.62, u1: 0.74, alt: 0.11, tipo: 'tri' }, { u0: 0.36, u1: 0.57, alt: 0.065, tipo: 'arred' }, { u0: 0.13, u1: 0.32, alt: 0.06, tipo: 'arred' }],
    anais: [{ u0: 0.36, u1: 0.56, alt: 0.055, tipo: 'arred' }, { u0: 0.13, u1: 0.32, alt: 0.055, tipo: 'arred' }],
    peit: { d: 0.25, comp: 0.1, larg: 0.035, yn: -0.25, abre: 0.3 }, pelv: { u: 0.79, comp: 0.06 },
    olho: 0.016, dOlho: 0.075, ynOlho: 0.42, dBoca: 0.08, ynBoca: -0.2, dOp: 0.24, escama: 0.006,
    barb: { n: 1, comp: 0.02 }, cores: { ventre: 'ecebe8', nadD: '50545a', nadV: 'c8c8c8', iris: 'c0c0b0', linha: '1a1a1c' }, padrao: 'mancha linhaescura',
  },
  merluza: {
    um: 0.6, ped: 0.26, cabT: [1.7, 0.6], cauda: { tipo: 'reta', comp: 0.13, alt: 0.15, garfo: 0.9 },
    dorsais: [{ u0: 0.63, u1: 0.72, alt: 0.08, tipo: 'tri' }, { u0: 0.08, u1: 0.6, alt: 0.055, tipo: 'longa' }],
    anais: [{ u0: 0.08, u1: 0.5, alt: 0.05, tipo: 'longa' }],
    peit: { d: 0.26, comp: 0.13, larg: 0.03, yn: -0.2, abre: 0.3 }, pelv: { u: 0.77, comp: 0.06 },
    olho: 0.02, dOlho: 0.08, ynOlho: 0.4, dBoca: 0.12, ynBoca: -0.05, inclBoca: 0.15, dOp: 0.26, escama: 0.008,
    cores: { ventre: 'f0f0ec', nadD: '7a8088', nadV: 'd8dce0', iris: 'd8d4c0' }, padrao: 'iridescente',
  },
  enguia: {
    um: 0.72, ped: 0.22, pedL: 0.35, cheio: 0.5, fracT: 0.5, cabT: [2, 0.6], cabB: [2, 0.6],
    cauda: { tipo: 'ponta', comp: 0.03, alt: 0.05, garfo: 1 },
    dorsais: [{ u0: 0.01, u1: 0.62, alt: 0.035, tipo: 'longa', varre: 0.2 }],
    anais: [{ u0: 0.01, u1: 0.47, alt: 0.03, tipo: 'longa', varre: 0.2 }],
    peit: { d: 0.1, comp: 0.035, larg: 0.012, yn: -0.1, abre: 0.4 }, pelv: null,
    olho: 0.0055, dOlho: 0.022, ynOlho: 0.4, dBoca: 0.03, ynBoca: -0.1, inclBoca: 0, dOp: 0.085, ov: 0, escama: 0,
    cores: { ventre: 'c8c0a0', nadD: '3a3e30', nadV: '5a5a48', iris: 'b0a070' }, padrao: 'semlinha',
  },
  'peixe-anjo': {
    um: 0.86, ped: 0.38, pedL: 0.35, cheio: 0.55, fracT: 0.5, cabT: [1.4, 0.45], cabB: [2.4, 0.4], ov: -0.05,
    cauda: { tipo: 'redonda', comp: 0.12, alt: 0.12, garfo: 1 },
    dorsais: [{ u0: 0.4, u1: 0.5, alt: 0.05, tipo: 'arred' }, { u0: 0.12, u1: 0.3, alt: 0.05, tipo: 'arred' }],
    anais: [{ u0: 0.12, u1: 0.27, alt: 0.04, tipo: 'arred' }],
    peit: null, pelv: null,
    olho: 0.012, dOlho: 0.13, ynOlho: 0.75, dBoca: 0.2, ynBoca: -0.05, inclBoca: 0, dOp: 0.4, escama: 0,
    deitado: false, cores: { ventre: 'f0e8dc', nadD: '5a4636', nadV: '8a7058', iris: 'b09060' }, padrao: 'semlinha mosqueado isca',
  },
  'mahi-mahi': {
    um: 0.78, ped: 0.13, pedL: 0.5, cheio: 0.9, fracT: 0.72, cabT: [5, 0.5], cabB: [2, 0.6],
    cauda: { tipo: 'lua', comp: 0.19, alt: 0.27, garfo: 0.3 },
    dorsais: [{ u0: 0.09, u1: 0.95, alt: 0.075, tipo: 'longa', varre: 0.35 }],
    anais: [{ u0: 0.09, u1: 0.5, alt: 0.06, tipo: 'longa', varre: 0.35 }],
    peit: { d: 0.2, comp: 0.1, larg: 0.03, yn: -0.25, abre: 0.3 }, pelv: { u: 0.73, comp: 0.07 },
    olho: 0.014, dOlho: 0.055, ynOlho: -0.05, dBoca: 0.065, ynBoca: -0.35, inclBoca: 0, dOp: 0.18, escama: 0.004,
    cores: { ventre: 'f0e0a0', nadD: '2a5a8a', nadV: 'd8c060', iris: 'c0a040' }, padrao: 'pintasazuis semlinha',
  },
  tilapia: {
    um: 0.55, ped: 0.38, fracT: 0.6, cabT: [2, 0.6], cauda: { tipo: 'reta', comp: 0.17, alt: 0.27, garfo: 1 },
    dorsais: [{ u0: 0.2, u1: 0.78, alt: 0.1, tipo: 'mista' }],
    anais: [{ u0: 0.17, u1: 0.34, alt: 0.09, tipo: 'mista' }],
    peit: { d: 0.27, comp: 0.14, larg: 0.035, yn: -0.35, abre: 0.3 }, pelv: { u: 0.66, comp: 0.1 },
    olho: 0.024, dOlho: 0.09, ynOlho: 0.35, dBoca: 0.065, ynBoca: -0.05, inclBoca: 0, dOp: 0.27, escama: 0.035,
    cores: { ventre: 'dcdcd8', nadD: '5a6060', nadV: '9aa0a0', iris: 'c8a030' }, padrao: 'faixas caudalistrada',
  },
  'carpa-do-mar': {
    um: 0.56, ped: 0.22, fracT: 0.6, cabT: [2.6, 0.58], cauda: { tipo: 'garfo', comp: 0.19, alt: 0.3, garfo: 0.5 },
    dorsais: [{ u0: 0.25, u1: 0.76, alt: 0.09, tipo: 'mista' }],
    anais: [{ u0: 0.17, u1: 0.34, alt: 0.075, tipo: 'mista' }],
    peit: { d: 0.26, comp: 0.17, larg: 0.03, yn: -0.3, abre: 0.25 }, pelv: { u: 0.66, comp: 0.08 },
    olho: 0.024, dOlho: 0.1, ynOlho: 0.38, dBoca: 0.065, ynBoca: -0.15, dOp: 0.27, escama: 0.022,
    cores: { ventre: 'eef0f2', nadD: '7a8088', nadV: 'b0b4b8', iris: 'd8b040', linha: '4a5058' }, padrao: 'faixaouro opmancha linhas',
  },
  'peixe-cabra': {
    um: 0.74, ped: 0.3, fracT: 0.58, cabT: [1.3, 0.5], cabB: [2.2, 0.6], ov: 0.02,
    cauda: { tipo: 'reta', comp: 0.15, alt: 0.18, garfo: 0.85 },
    dorsais: [{ u0: 0.56, u1: 0.73, alt: 0.1, tipo: 'espinhosa' }, { u0: 0.14, u1: 0.53, alt: 0.065, tipo: 'longa' }],
    anais: [{ u0: 0.14, u1: 0.5, alt: 0.06, tipo: 'longa' }],
    peit: { d: 0.26, comp: 0.26, larg: 0.07, yn: -0.45, abre: 0.5 }, pelv: { u: 0.78, comp: 0.1 },
    olho: 0.024, dOlho: 0.1, ynOlho: 0.55, dBoca: 0.07, ynBoca: -0.45, inclBoca: 0, dOp: 0.27, escama: 0.008,
    cores: { ventre: 'f2dccc', nadD: 'c06048', nadV: 'e0a090', iris: 'd0a040', margem: '3a7aa0' }, padrao: 'cabecaossea',
  },
  'peixe-galo': {
    um: 0.5, ped: 0.12, pedL: 0.6, cheio: 0.7, fracT: 0.52, cabT: [2.2, 0.62], cabB: [2, 0.62],
    cauda: { tipo: 'reta', comp: 0.14, alt: 0.15, garfo: 1 },
    dorsais: [{ u0: 0.46, u1: 0.76, alt: 0.15, tipo: 'filamento' }, { u0: 0.12, u1: 0.44, alt: 0.09, tipo: 'longa' }],
    anais: [{ u0: 0.12, u1: 0.4, alt: 0.08, tipo: 'longa' }, { u0: 0.42, u1: 0.5, alt: 0.05, tipo: 'espinhosa' }],
    peit: { d: 0.29, comp: 0.08, larg: 0.03, yn: -0.2, abre: 0.3 }, pelv: { u: 0.7, comp: 0.14 },
    olho: 0.026, dOlho: 0.13, ynOlho: 0.42, dBoca: 0.14, ynBoca: -0.1, inclBoca: 0.35, dOp: 0.33, escama: 0.004,
    cores: { ventre: 'd8d4c0', nadD: '7a7a5a', nadV: 'a8a688', iris: 'd8c060' }, padrao: 'manchagrande semlinha',
  },
};

// garoupa e cherne: cabeça grande, bocarra com a mandíbula saliente e cauda arredondada
const GAROUPA: Partial<Especie> = {
  um: 0.55, ped: 0.36, fracT: 0.56, cheio: 0.7, cabT: [1.8, 0.62], cabB: [1.6, 0.62],
  cauda: { tipo: 'redonda', comp: 0.17, alt: 0.22, garfo: 1 },
  dorsais: [{ u0: 0.24, u1: 0.74, alt: 0.085, tipo: 'mista' }],
  anais: [{ u0: 0.16, u1: 0.31, alt: 0.08, tipo: 'mista' }],
  peit: { d: 0.31, comp: 0.14, larg: 0.045, yn: -0.3, abre: 0.3 }, pelv: { u: 0.64, comp: 0.1 },
  olho: 0.016, dOlho: 0.1, ynOlho: 0.48, dBoca: 0.15, ynBoca: -0.12, inclBoca: 0.3, dOp: 0.33, escama: 0.008,
};

const ESPECIES2: Record<string, Partial<Especie>> = {
  garoupa: { ...GAROUPA, cores: { ventre: 'e8dcc8', nadD: '5a3e2c', nadV: '7a5a40', iris: 'c09040', margem: '2a1e16' }, padrao: 'manchas semlinha' },
  cherne: { ...GAROUPA, cauda: { tipo: 'reta', comp: 0.16, alt: 0.22, garfo: 0.95 }, cores: { ventre: 'd8d0c4', nadD: '4a3e34', nadV: '6a5c50', iris: 'b0a080', margem: 'd8d0c0' }, padrao: 'mosqueado' },
};
Object.assign(ESPECIES, ESPECIES2);

function especie(k: Ctx): Especie {
  const e = { ...P0, ...(ESPECIES[k.id] ?? {}) };
  // peixe genérico: deduz um pouco das palavras de detalhe
  if (!ESPECIES[k.id]) {
    if (k.tem('enguia')) Object.assign(e, ESPECIES.enguia);
    if (k.tem('tamboril')) Object.assign(e, ESPECIES['peixe-anjo']);
    if (k.tem('duasdorsais')) e.dorsais = [{ u0: 0.56, u1: 0.7, alt: 0.08, tipo: 'espinhosa' }, { u0: 0.3, u1: 0.48, alt: 0.07, tipo: 'tri' }];
    if (k.tem('barbilhao')) e.barb = { n: 2, comp: 0.04 };
  }
  return e;
}

/* ------------------------------------------------------------------ */
/* Peixe roliço: construído em pé (dorso em +Y, cabeça em +X, largura  */
/* em Z) e depois deitado de lado, com um flanco virado para cima        */
/* ------------------------------------------------------------------ */

const BRANCO_V: RGB = [0.86, 0.86, 0.84];
const PRETO_P: RGB = [0.012, 0.012, 0.014];
const hex = (h: string | undefined, pad: RGB): RGB => (h ? rgb('#' + h) : pad);

export const gPeixe: Gerador = (k) => {
  const e = especie(k);
  const { c1, c2, c3, s } = k;
  const pal = ' ' + e.padrao + ' ';
  const tem = (w: string) => k.tem(w) || pal.includes(' ' + w + ' ');
  const out: Parte[] = [];
  const T = k.T, H = T * k.A, Wm = T * k.L;
  const Lc = T * e.cauda.comp;
  const xS = T / 2, xB0 = -T / 2 + Lc * 0.92, Lb = xS - xB0;
  const X = (u: number) => xB0 + u * Lb;
  const uDe = (d: number) => 1 - (d * T) / Lb;
  const um = e.um, umW = Math.min(0.86, um + 0.06);
  const ease = (w: number) => suave(0, 1, w) ** e.cheio;
  const topo = (u: number) => {
    if (u < um) return H * lerp(e.ped / 2, e.fracT, ease(u / um));
    const w = clamp((u - um) / (1 - um));
    return H * e.fracT * Math.max(0, 1 - w ** e.cabT[0]) ** e.cabT[1];
  };
  const fundo = (u: number) => {
    if (u < um) return H * lerp(e.ped / 2, 1 - e.fracT, ease(u / um));
    const w = clamp((u - um) / (1 - um));
    return H * (1 - e.fracT) * Math.max(0, 1 - w ** e.cabB[0]) ** e.cabB[1];
  };
  const rzF = (u: number) => {
    if (u < umW) return (Wm / 2) * lerp(e.pedL, 1, ease(u / umW));
    const w = clamp((u - umW) / (1 - umW));
    return (Wm / 2) * Math.max(0, 1 - w ** 2.2) ** 0.5;
  };
  const ry = (u: number) => (topo(u) + fundo(u)) / 2;
  const cy = (u: number) => (topo(u) - fundo(u)) / 2;
  const ySup = (u: number, yn: number) => cy(u) + ry(u) * yn;
  const zSup = (u: number, yn: number) => rzF(u) * Math.sqrt(Math.max(0, 1 - yn * yn)) * (1 - e.ov * yn);
  const uOp = uDe(e.dOp), uBoca = uDe(e.dBoca), uOlho = uDe(e.dOlho);
  const rOlho = e.olho * T;

  /* ---------------- cores ---------------- */
  const cV = hex(e.cores.ventre, mix(c2, BRANCO_V, 0.6));
  const cD = hex(e.cores.nadD, mix(c1, c3, 0.45));
  const cVn = hex(e.cores.nadV, mix(c2, c3, 0.5));
  const cPinta = hex(e.cores.pinta, mul(c1, 0.25));
  const cIris = hex(e.cores.iris, [0.7, 0.62, 0.42]);
  const cLinha = e.cores.linha ? rgb('#' + e.cores.linha) : null;
  const fP = 1 / (T * 0.035), fPd = 1 / (T * 0.03), fS = 1 / (T * 0.011), fA = 1 / (T * 0.045);
  const fCint = 1 / Math.max(0.0015, T * 0.004);
  const sz = e.escama * T;
  const olhoXY = V(X(uOlho), ySup(uOlho, e.ynOlho), 0);
  const ymBoca = (u: number) => e.ynBoca + e.inclBoca * (1 - u) / Math.max(0.01, 1 - uBoca);
  const uBorda = (yn: number) => uOp - 0.035 * (1 - yn * yn);
  const disco = (x: number, y: number, cx: number, cy2: number, r: number) => 1 - suave(r * 0.8, r, Math.hypot(x - cx, y - cy2));

  const corPele: CorFn = (x, y, z, u, a) => {
    const yn = Math.cos(a);
    const n1 = fbm(x * 9 / T, y * 9 / T, z * 9 / T, s);
    // contra-sombreamento: dorso escuro, flanco, ventre claro
    const flanco = mul(c2, 0.5);
    let c = mix(flanco, c1, suave(0.12, 0.52, yn + 0.15 * n1));
    c = mix(c, mix(flanco, c1, 0.45), suave(-0.1, 0.2, yn) * (1 - suave(0.2, 0.5, yn)) * 0.5);
    c = mix(c, mul(cV, 0.72), suave(-0.35, -0.8, yn + 0.1 * n1));
    const lado = Math.abs(yn) < 0.7 ? 1 - Math.abs(yn) / 0.7 : 0;
    if (tem('iridescente')) {
      const sh = 0.5 + 0.5 * Math.sin(x * 26 / T + yn * 5 + n1 * 2);
      c = mix(c, mix([0.35, 0.62, 0.85], [0.85, 0.6, 0.8], sh), 0.16 * lado);
    }
    const dCab = (u - uBorda(yn)) / 0.012;
    const cabeca = suave(-0.5, 0.5, dCab);
    // desenhos da espécie
    if (tem('pintas')) {
      const p = 1 - suave(0.2, 0.3, celula(x * fP, y * fP, z * fP, s));
      c = mix(c, cPinta, p * suave(0.05, 0.35, yn) * 0.9);
    }
    if (tem('pintasdensas')) {
      const p = 1 - suave(0.3, 0.4, celula(x * fPd, y * fPd, z * fPd, s + 4));
      c = mix(c, cPinta, p * suave(-0.65, -0.25, yn) * 0.9);
    }
    if (tem('sarda')) {
      const p = 1 - suave(0.22, 0.34, celula(x * fS, y * fS, z * fS, s + 2));
      c = mix(c, mul(mix(c1, [0.35, 0.25, 0.12], 0.4), 0.7), p * suave(-0.5, 0.1, yn) * 0.7);
    }
    if (tem('pintasazuis')) {
      const p = 1 - suave(0.15, 0.22, celula(x * fA, y * fA, z * fA, s + 6));
      c = mix(c, c3, p * lado * 0.85 * (1 - cabeca));
    }
    if (tem('manchas')) {
      // garoupa: manchas escuras irregulares em faixas e pintas claras
      const m1 = suave(0.0, 0.3, fbm(x * 14 / T, y * 14 / T, z * 14 / T, s + 11) + 0.25 * Math.sin(x * 40 / T));
      c = mix(c, mul(c1, 0.5), m1 * suave(-0.7, -0.2, yn) * 0.75);
      c = mix(c, mul(c2, 1.2), (1 - suave(0.16, 0.24, celula(x * fP * 1.3, y * fP * 1.3, z * fP * 1.3, s + 12))) * 0.6);
    }
    if (tem('mosqueado')) {
      const p = suave(0.05, 0.35, fbm(x * 16 / T, y * 16 / T, z * 16 / T, s + 8));
      c = mix(c, mul(c1, 0.55), p * suave(-0.2, 0.3, yn) * 0.7);
      c = mix(c, mul(c2, 1.25), (1 - suave(0.15, 0.25, celula(x * fP, y * fP, z * fP, s + 1))) * suave(0, 0.4, yn) * 0.5);
    }
    if (tem('faixa')) c = mix(c, c3, (1 - suave(0.12, 0.38, Math.abs(yn - 0.05 - 0.08 * n1))) * 0.6 * (0.4 + 0.6 * suave(0.05, 0.3, u)));
    if (tem('listras')) {
      const ph = (x / T) * 2 * PI * 15 + 1.8 * Math.sin(yn * 4 + (x / T) * 7);
      c = mix(c, mul(c1, 0.32), suave(0.35, 0.75, Math.sin(ph)) * suave(0.18, 0.4, yn) * (1 - cabeca) * 0.9);
    }
    if (tem('faixas')) {
      const nb = 7;
      const b = suave(-0.2, 0.9, Math.sin(u * 2 * PI * nb * 0.75 + 0.6 * n1 + 1.2));
      c = mix(c, mul(c1, 0.5), b * suave(-0.6, 0.3, yn) * (1 - cabeca) * suave(0.03, 0.15, u) * 0.6);
    }
    if (tem('linhas')) {
      const l = Math.abs(Math.sin(yn * PI * 3.4 + 0.4)) ** 6;
      c = mix(c, mul(c, 0.7), l * suave(-0.5, -0.2, yn) * suave(0.8, 0.6, yn) * (1 - cabeca));
    }
    if (tem('pontos')) {
      for (let i = 0; i < 5; i++) {
        const uu = uOp - 0.06 - i * 0.065;
        c = mix(c, mul(c1, 0.45), disco(x, y, X(uu), ySup(uu, 0.35), T * 0.011) * 0.85);
      }
    }
    if (tem('mancha')) { const uu = uOp - 0.07; c = mix(c, PRETO_P, disco(x, y, X(uu), ySup(uu, 0.3), T * 0.028) * 0.85); }
    if (tem('manchagrande')) {
      const cx2 = X(0.44), cy2 = ySup(0.44, 0.05), d = Math.hypot(x - cx2, y - cy2);
      c = mix(c, mix(cV, [0.9, 0.85, 0.6], 0.3), (1 - suave(T * 0.065, T * 0.075, d)) * suave(T * 0.045, T * 0.055, d) * 0.7);
      c = mix(c, PRETO_P, (1 - suave(T * 0.03, T * 0.05, d)) * 0.9);
    }
    // linha lateral
    if (!tem('semlinha')) {
      const ynL = 0.28 + 0.12 * suave(0.45, 0.85, u);
      const l = (1 - suave(0.02, 0.07, Math.abs(yn - ynL))) * suave(0.03, 0.12, u) * (1 - cabeca);
      const cl = cLinha ?? (tem('linhaclara') ? mix(c, [0.9, 0.88, 0.8], 0.8) : mul(c, 0.78));
      c = mix(c, cl, l * 0.8);
    }
    // escamas: grade desencontrada com a borda livre escura virada para o rabo
    if (sz > 0) {
      const lin = y / (sz * 0.75), row = Math.floor(lin), fy = lin - row;
      const xs = x / sz + (row & 1) * 0.5, fx = xs - Math.floor(xs);
      const aro = suave(0.36, 0.5, Math.hypot(fx - 0.6, (fy - 0.5) * 1.1));
      const f = (1 - cabeca) * suave(0.0, 0.06, u) * (e.escama > 0.02 ? 1 : 0.6);
      c = mul(c, 1 - f * (0.22 * aro - 0.06 * (1 - aro)));
    }
    // cabeça: opérculo mais metálico, fenda da guelra escura, boca, focinho
    c = mix(c, mul(mix(c, c2, 0.25), 1.06), cabeca * 0.4 * lado);
    if (tem('cabecaossea')) c = mix(c, mul(c, 0.8), cabeca * suave(0.2, 0.6, fbm(x * 60 / T, y * 60 / T, z * 60 / T, s)) * 0.6);
    const fenda = Math.exp(-(((dCab + 0.25) / 0.4) ** 2)) * suave(0.92, 0.7, Math.abs(yn + 0.05));
    c = mix(c, mix(c, [0.25, 0.05, 0.05], 0.5), fenda * 0.75);
    if (tem('opmancha')) c = mix(c, PRETO_P, disco(x, y, X(uOp + 0.025), ySup(uOp + 0.025, 0.5), T * 0.015) * 0.7);
    if (tem('faixaouro')) c = mix(c, [0.85, 0.55, 0.1], (1 - suave(T * 0.006, T * 0.012, Math.abs(x - olhoXY.x - rOlho * 0.2))) * suave(0.5, 0.75, yn) * 0.9);
    const boca = Math.exp(-(((yn - ymBoca(u)) / 0.08) ** 2)) * suave(uBoca - 0.004, uBoca + 0.012, u);
    c = mix(c, [0.05, 0.03, 0.03], boca * 0.85);
    c = mix(c, mul(c, 1.15), Math.exp(-(((yn - ymBoca(u) + 0.1) / 0.06) ** 2)) * suave(uBoca, uBoca + 0.02, u) * 0.6);
    // maxila: placa acima da boca, com a borda de trás marcada
    const mx = suave(uBoca - 0.01, uBoca + 0.01, u) * suave(0, 0.04, yn - ymBoca(u)) * (1 - suave(0.16, 0.22, yn - ymBoca(u)));
    c = mix(c, mul(c, 0.8), mx * 0.55);
    // pele em volta do olho
    const dO = Math.hypot(x - olhoXY.x, y - olhoXY.y);
    c = mix(c, mix(mul(c1, 0.6), cIris, 0.3), (1 - suave(rOlho * 1.05, rOlho * 1.55, dO)) * 0.7);
    // brilho por vértice (escamas soltas)
    return mul(c, 1 + (0.035 + 0.05 * lado) * cintila(x, y, z, fCint, s));
  };

  /* ---------------- corpo ---------------- */
  const nA = 76, mA = 52;
  const dens = (u: number) => 1 + 1.6 * suave(uOp - 0.14, uOp - 0.02, u) + 0.6 * suave(0.1, 0, u) + 1.2 * suave(0.95, 1, u);
  const NF = 600, acc = [0];
  for (let i = 1; i <= NF; i++) acc.push(acc[i - 1] + dens((i - 0.5) / NF));
  const uDeAcc = (q: number) => {
    const alvo = q * acc[NF];
    let i = 1;
    while (i < NF && acc[i] < alvo) i++;
    return (i - 1 + (alvo - acc[i - 1]) / (acc[i] - acc[i - 1])) / NF;
  };
  const UY = V(0, 1, 0), UZ = V(0, 0, 1);
  const an: Anel[] = [];
  const r0 = ry(0);
  an.push({ c: V(X(0) - r0 * 0.25, cy(0), 0), u: UY, w: UZ, ry: r0 * 0.7, rz: rzF(0) * 0.7, t: 0 });
  for (let i = 0; i < nA; i++) {
    const u = uDeAcc(i / nA);
    an.push({ c: V(X(u), cy(u), 0), u: UY, w: UZ, ry: Math.max(1e-5, ry(u)), rz: Math.max(1e-5, rzF(u)), t: u });
  }
  const corpoG = malhaAneis(an, {
    m: mA, cor: corPele,
    polos: [V(X(0) - r0 * 0.45, cy(0), 0), V(X(1), cy(1), 0)],
    desloc: (p, u, a) => {
      const yn = Math.cos(a);
      p.z *= 1 - e.ov * yn;
      const jan = suave(0.85, 0.55, Math.abs(yn + 0.05));
      const d = (u - uBorda(yn)) / 0.012;
      let f = 1 + 0.02 * suave(-0.2, 0.5, d) * suave(3.5, 1.5, d) * jan - 0.05 * Math.exp(-(((d + 0.3) / 0.45) ** 2)) * jan;
      f -= 0.2 * Math.exp(-(((yn - ymBoca(u)) / 0.08) ** 2)) * suave(uBoca - 0.005, uBoca + 0.02, u);
      p.z *= f;
    },
  });
  out.push(parte(corpoG, k.ac, true));

  /* ---------------- nadadeiras ---------------- */
  const UZn = () => UZ;
  const corRaiz = (u: number, yn: number) => corPele(X(u), ySup(u, yn), 0, u, Math.acos(clamp(yn, -1, 1)));
  const corNad = (base: RGB, sR: number, r: number, nR: number, p: THREE.Vector3, o: { raiz?: RGB; margem?: RGB | null; pintas?: boolean; transl?: number } = {}): RGB => {
    const raio = (0.5 + 0.5 * Math.sin(2 * PI * sR * nR)) ** 2;
    let c = mix(base, mul(base, 0.68), raio * 0.55);
    c = mix(c, mix(base, [0.9, 0.9, 0.86], 0.4), (1 - raio) * suave(0.3, 1, r) * (o.transl ?? 0.3) * 0.5);
    if (o.margem) c = mix(c, o.margem, suave(0.75, 1, r) * 0.75);
    if (o.pintas) c = mix(c, cPinta, (1 - suave(0.14, 0.22, celula(p.x * fPd, p.y * fPd, p.z * fPd, s + 3))) * 0.85);
    if (o.raiz) c = mix(o.raiz, c, suave(0.0, 0.3, r));
    return mul(c, 1 + 0.04 * cintila(p.x, p.y, p.z, fCint, s));
  };
  const ePad = Math.max(0.0012, T * 0.0055);
  const eMin = Math.max(0.0003, T * 0.0007);
  const pintasNad = tem('pintas') || tem('pintasdensas');

  // perfil da borda de cada tipo (s = 0 atrás, 1 na frente)
  const perfilNad = (tipo: TipoNad, sR: number, nR: number) => {
    const raio = 0.5 + 0.5 * Math.sin(2 * PI * sR * nR);
    const corte = 0.68 + 0.32 * raio ** 0.5;
    switch (tipo) {
      case 'tri': return 0.2 + 0.8 * sR ** 1.6;
      case 'foice': return 0.12 + 0.88 * sR ** 2.6;
      case 'arred': return 0.1 + 0.9 * Math.sin(PI * clamp(0.04 + 0.92 * sR)) ** 0.7;
      case 'longa': return (0.55 + 0.45 * sR ** 0.6) * Math.sin(PI * clamp(sR)) ** 0.25;
      case 'espinhosa': return (0.15 + 0.85 * Math.sin(PI * clamp(0.12 + 0.8 * sR)) ** 0.6) * corte;
      case 'mista': {
        const mole = 0.3 + 0.85 * Math.sin(PI * clamp(sR / 0.5)) ** 0.7;
        const dura = (0.7 + 0.1 * (sR - 0.45) / 0.55) * corte;
        return lerp(mole, dura, suave(0.38, 0.5, sR));
      }
      case 'filamento': return (0.35 + 0.65 * sR ** 0.5) * (0.55 + 0.9 * raio ** 6);
    }
  };

  const mediana = (nd: Nad, lado: 1 | -1) => {
    const Hd = nd.alt * T;
    const nR = clamp(Math.round((nd.u1 - nd.u0) * (nd.tipo === 'longa' ? 38 : 60)), 5, 16);
    const varre = nd.varre ?? (nd.tipo === 'espinhosa' || nd.tipo === 'filamento' ? 0.35 : 0.6);
    const base = nd.cor ? rgb('#' + nd.cor) : lado > 0 ? cD : cVn;
    const raizYn = lado > 0 ? 0.95 : -0.95;
    const ePeso = nd.tipo === 'espinhosa' || nd.tipo === 'mista' || nd.tipo === 'filamento' ? 1.2 : 1;
    return lamina({
      ns: nR * 3, nr: nd.tipo === 'longa' && nd.alt < 0.05 ? 3 : 4,
      P: (sR, r) => {
        const u = lerp(nd.u0, nd.u1, sR);
        const h = Hd * perfilNad(nd.tipo, sR, nR);
        return V(X(u) - varre * h * r - 0.18 * varre * h * r * r, ySup(u, raizYn) + lado * h * r, 0);
      },
      N: UZn,
      esp: (sR, r) => eMin + ePad * ePeso * (1 - r) ** 1.2 * (0.55 + 0.45 * Math.sin(PI * clamp(sR))),
      pregas: Hd * 0.012, raios: nR,
      cor: (sR, r, p) => corNad(base, sR, r, nR, p, { raiz: corRaiz(lerp(nd.u0, nd.u1, sR), raizYn), pintas: pintasNad && lado > 0, transl: 0.45 }),
    });
  };

  // cauda
  {
    const ct = e.cauda;
    const u0 = 0.035;
    const xr = X(u0), hr = ry(u0) * 0.92, yc = cy(u0);
    const Hc = ct.alt * T;
    const Lf = Lc * 0.92 + u0 * Lb;
    const nR = ct.tipo === 'ponta' ? 6 : 10;
    const comp = (sg: number) => {
      const a = Math.abs(sg);
      switch (ct.tipo) {
        case 'garfo': return ct.garfo + (1 - ct.garfo) * a ** 1.25;
        case 'lua': return ct.garfo + (1 - ct.garfo) * a ** 0.75;
        case 'reta': return (ct.garfo + (1 - ct.garfo) * a ** 1.5) * (1 - 0.16 * suave(0.7, 1, a) ** 2);
        case 'redonda': return 0.68 + 0.32 * Math.sqrt(Math.max(0, 1 - a * a));
        case 'ponta': return Math.max(0.05, 1 - a) ** 0.7;
      }
    };
    const vao = (sg: number) => {
      const a = Math.abs(sg);
      const k2 = ct.tipo === 'redonda' ? 0.85 : ct.tipo === 'reta' ? 1 - 0.1 * suave(0.75, 1, a) : 1;
      return sg * (Hc / 2) * k2;
    };
    const margem = e.cores.margem ? rgb('#' + e.cores.margem) : null;
    out.push(parte(lamina({
      ns: nR * 3, nr: 6,
      P: (sR, r) => {
        const sg = 2 * sR - 1;
        const L = Lf * comp(sg);
        const yt = yc + vao(sg);
        const curva = ct.tipo === 'lua' ? -0.12 * Lf * Math.abs(sg) ** 2 * r * r : 0;
        return V(xr - L * r + curva * 0, lerp(yc + sg * hr, yt, r ** 0.85) + (ct.tipo === 'lua' ? Math.sign(sg) * 0.06 * Hc * r * r * Math.abs(sg) : 0), 0);
      },
      N: UZn,
      esp: (sR, r) => eMin + Math.min(rzF(u0) * 1.1, ePad * 1.1) * (1 - r) ** 1.4 * (0.6 + 0.4 * Math.sin(PI * sR)),
      pregas: Hc * 0.01, raios: nR,
      cor: (sR, r, p) => {
        let c = corNad(cD, sR, r, nR, p, { raiz: corRaiz(u0, 2 * sR - 1), margem, pintas: pintasNad, transl: 0.4 });
        if (tem('caudalistrada')) c = mix(c, mul(cD, 0.45), suave(0.3, 0.8, Math.sin(r * PI * 7)) * suave(0.2, 0.4, r) * 0.6);
        return c;
      },
    }), 'acetinado'));
  }
  for (const nd of e.dorsais) out.push(parte(mediana(nd, 1), 'acetinado'));
  for (const nd of e.anais) out.push(parte(mediana(nd, -1), 'acetinado'));

  // adiposa: lobo carnudo sem raios entre a dorsal e o rabo
  if (e.adiposa > 0) {
    const ua = e.adiposa, du = (T * 0.035) / Lb, Ha = T * 0.028;
    out.push(parte(lamina({
      ns: 8, nr: 4,
      P: (sR, r) => {
        const u = ua - du + 2 * du * sR;
        const h = Ha * Math.sin(PI * clamp(0.08 + 0.84 * sR)) ** 0.6 * (0.7 + 0.3 * (1 - sR));
        return V(X(u) - 0.7 * h * r * r, ySup(u, 0.95) + h * r, 0);
      },
      N: UZn,
      esp: (sR, r) => eMin + ePad * 1.6 * (1 - r * 0.8) * Math.sin(PI * clamp(sR)) ** 0.5,
      cor: (sR, r, p) => mul(mix(corRaiz(ua, 0.95), cD, r * 0.4), 1 + 0.04 * cintila(p.x, p.y, p.z, fCint, s)),
    }), k.ac));
  }

  // pínulas (cavala)
  for (let i = 0; i < e.pinulas; i++) {
    const uu = lerp(0.29, 0.08, i / Math.max(1, e.pinulas - 1));
    for (const lado of [1, -1] as const) {
      const h = T * 0.016, du = (T * 0.012) / Lb;
      out.push(parte(lamina({
        ns: 3, nr: 2,
        P: (sR, r) => { const u = uu - du / 2 + du * sR; return V(X(u) - h * r * 0.7, ySup(u, lado * 0.95) + lado * h * r * (0.4 + 0.6 * sR), 0); },
        N: UZn,
        esp: (_sR, r) => eMin + ePad * 0.6 * (1 - r),
        cor: (sR, r, p) => corNad(lado > 0 ? cD : cVn, sR, r, 1, p, { raiz: corRaiz(uu, lado * 0.95) }),
      }), 'acetinado'));
    }
  }

  // peitorais e pélvicas: o lado de cima (z < 0 antes de deitar) fica levemente aberto,
  // o de baixo encostado no corpo para a peça assentar na tábua
  if (e.peit) {
    const pe = e.peit;
    const u = uOp - 0.012 - (pe.d - e.dOp) * T / Lb * 0;
    for (const sg of [-1, 1]) {
      const cima = !e.deitado || sg < 0;
      const dyn = (pe.larg * T) / Math.max(1e-4, ry(u));
      const raiz = (sR: number) => {
        const yn = clamp(pe.yn - dyn / 2 + dyn * sR, -0.95, 0.9);
        const uu = u - 0.004 * sR;
        return V(X(uu), ySup(uu, yn), sg * zSup(uu, yn) * 0.9);
      };
      const R = raiz(1).sub(raiz(0)).normalize();
      const beta = cima ? pe.abre : 0.02;
      const dir = V(-Math.cos(beta), -0.18, sg * Math.sin(beta)).normalize();
      dir.addScaledVector(R, -dir.dot(R)).normalize();
      const N = new THREE.Vector3().crossVectors(R, dir).normalize();
      const nR = 7;
      const base = mix(cVn, cD, 0.25);
      out.push(parte(lamina({
        ns: nR * 3, nr: 4,
        P: (sR, r) => {
          const fi = lerp(-0.35, 0.18, sR);
          const rd = dir.clone().multiplyScalar(Math.cos(fi)).addScaledVector(R, Math.sin(fi));
          const L = pe.comp * T * (0.5 + 0.5 * Math.sin(PI * clamp(0.15 + 0.75 * sR)) ** 0.8);
          return raiz(sR).addScaledVector(rd, L * r).addScaledVector(N, -sg * 0.04 * L * r * r * (cima ? 1 : 0));
        },
        N: () => N,
        esp: (sR, r) => eMin + ePad * 0.8 * (1 - r) ** 1.3,
        pregas: pe.comp * T * 0.012, raios: nR,
        cor: (sR, r, p) => corNad(base, sR, r, nR, p, { raiz: corRaiz(u, pe.yn), margem: e.cores.margem ? rgb('#' + e.cores.margem) : null, transl: 0.55 }),
      }), 'acetinado'));
    }
  }
  if (e.pelv) {
    const pv = e.pelv;
    for (const sg of [-1, 1]) {
      const cima = !e.deitado || sg < 0;
      const du = (T * 0.025) / Lb;
      const raiz = (sR: number) => {
        const uu = pv.u - du / 2 + du * sR;
        return V(X(uu), ySup(uu, -0.88), sg * zSup(uu, -0.88) * 0.8);
      };
      const R = raiz(1).sub(raiz(0)).normalize();
      const dir = V(-0.92, -0.38, sg * (cima ? 0.3 : 0.02)).normalize();
      dir.addScaledVector(R, -dir.dot(R)).normalize();
      const N = new THREE.Vector3().crossVectors(R, dir).normalize();
      const nR = 5;
      out.push(parte(lamina({
        ns: nR * 3, nr: 4,
        P: (sR, r) => {
          const L = pv.comp * T * (0.45 + 0.55 * sR ** 0.7);
          return raiz(sR).addScaledVector(dir, L * r).addScaledVector(R, -0.35 * L * r * (1 - sR));
        },
        N: () => N,
        esp: (sR, r) => eMin + ePad * 0.7 * (1 - r) ** 1.3,
        pregas: pv.comp * T * 0.012, raios: nR,
        cor: (sR, r, p) => corNad(cVn, sR, r, nR, p, { raiz: corRaiz(pv.u, -0.9), transl: 0.55 }),
      }), 'acetinado'));
    }
  }

  // olhos: cúpula meio enterrada, orientada pela normal da pele
  for (const sg of [-1, 1]) {
    const u = uOlho, yn = e.ynOlho;
    const du = 0.004, dy = 0.02;
    const z0 = zSup(u, yn);
    const dzdx = (zSup(u + du, yn) - zSup(u - du, yn)) / (2 * du * Lb);
    const dzdy = (zSup(u, yn + dy) - zSup(u, yn - dy)) / Math.max(1e-6, ySup(u, yn + dy) - ySup(u, yn - dy));
    const n = V(-dzdx, -dzdy, 1).normalize();
    n.z *= sg;
    const pos = V(X(u), ySup(u, yn), sg * z0).addScaledVector(n, -rOlho * 0.28);
    const g = olhoPeixe(rOlho, cIris, mul(c1, 0.35), { pupila: 0.6 });
    out.push(parte(apontar(g, n, pos), 'umido'));
  }

  // barbilhões: fios com espessura, colados ao plano do corpo para não erguer a peça
  if (e.barb) {
    const b = e.barb;
    const rb = Math.max(0.0009, T * 0.005);
    for (let i = 0; i < b.n; i++) {
      const par = Math.floor(i / 2), sg = i % 2 ? 1 : -1;
      const queixo = b.n === 1;
      const uu = queixo ? uDe(e.dBoca * 0.55) : par === 0 ? uBoca : uDe(e.dBoca * (par === 1 ? 0.6 : 0.4));
      const yn = queixo ? -0.98 : ymBoca(uu) - 0.05 - par * 0.25;
      const p0 = V(X(uu), ySup(uu, yn), queixo ? 0 : sg * zSup(uu, yn) * 0.9);
      const L = b.comp * T * (par === 0 ? 1 : 0.55);
      const pts = queixo
        ? [p0, p0.clone().add(V(-L * 0.2, -L * 0.6, 0)), p0.clone().add(V(-L * 0.45, -L * 0.9, 0))]
        : [p0, p0.clone().add(V(L * 0.1, -L * 0.25, sg * L * 0.05)), p0.clone().add(V(-L * 0.35, -L * 0.45, sg * L * 0.06)), p0.clone().add(V(-L * 0.85, -L * 0.6, sg * L * 0.04))];
      const cb = mix(c1, c2, 0.3);
      out.push(parte(tubo(pts, { raio: (t) => rb * (1 - 0.7 * t), m: 6, n: 14, cor: (x, y, z) => mul(cb, 1 + 0.08 * ruido(x * 400, y * 400, z * 400, s)) }), 'acetinado'));
    }
  }

  // isca do tamboril: filamento com a ponta carnuda sobre a cabeça, e a mandíbula
  // de baixo saliente contornando a frente, com dentes claros
  if (tem('isca')) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const q = (i / 16) * 2 - 1;
      const u = lerp(uBoca, 0.985, 1 - Math.abs(q) ** 1.5);
      const yn = ymBoca(u) - 0.06;
      pts.push(V(X(u) + T * 0.006 * (1 - Math.abs(q)), ySup(u, yn), Math.sign(q) * zSup(u, yn) * 1.01 + (q === 0 ? 0 : 0)));
    }
    const rl = T * 0.009;
    out.push(parte(tubo(pts, {
      raio: (t) => rl * (0.55 + 0.45 * Math.sin(PI * t)), m: 8, n: 48, achata: 0.7, cima: V(0, 1, 0),
      cor: (x, y, z, t, a) => {
        const dente = Math.abs(Math.sin(t * PI * 40)) ** 6 * suave(0.3, 0.9, Math.cos(a));
        return mix(mul(c1, 0.75), [0.85, 0.82, 0.72], dente * 0.85);
      },
    }), k.ac));
  }
  if (tem('isca')) {
    const u = uDe(e.dBoca * 0.5);
    const p0 = V(X(u), ySup(u, 0.98), 0);
    const L = T * 0.1;
    const pts = [p0, p0.clone().add(V(L * 0.1, L * 0.5, 0)), p0.clone().add(V(L * 0.4, L * 0.8, 0)), p0.clone().add(V(L * 0.75, L * 0.6, 0))];
    out.push(parte(tubo(pts, { raio: (t) => T * 0.003 * (1 - 0.5 * t), m: 6, n: 12, cor: () => mul(c1, 0.8) }), 'acetinado'));
    out.push(parte(tf(elipsoide(T * 0.008, T * 0.006, T * 0.006, () => mix(c2, [0.9, 0.85, 0.7], 0.4), 5, 8), [pts[3].x, pts[3].y, 0]), 'acetinado'));
  }

  if (e.deitado) for (const pt of out) pt.g.rotateX(PI / 2);
  return out;
};


/* ------------------------------------------------------------------ */
/* peixe chato (deitado com o lado escuro para cima)                    */
/* ------------------------------------------------------------------ */

export const gPeixeChato: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const T = k.T;
  const raia = k.v.v === 'arraia';
  const redondo = k.tem('redondo');
  const halibute = k.id === 'linguado-gigante';
  const Lc = raia ? 0 : T * (redondo ? 0.13 : 0.12);
  const Lr = raia ? T * 0.42 : 0; // rabo fino da raia
  const xS = T / 2, xB0 = -T / 2 + (raia ? Lr : Lc * 0.85);
  const Lb = xS - xB0;
  const X = (u: number) => xB0 + u * Lb;
  const W = T * k.L * (raia ? 1 : 0.92), Hm = T * k.A;
  // contorno visto de cima (meia largura relativa)
  const contorno = (u: number) => {
    if (raia) {
      const pico = 0.5;
      const f = u < pico ? (u / pico) ** 0.85 : (1 - (u - pico) / (1 - pico)) ** 1.15;
      return Math.max(0.03, f) * (1 - 0.12 * Math.sin(PI * u) ** 4);
    }
    const um = redondo ? 0.52 : 0.55;
    if (u < um) {
      const w = u / um;
      return lerp(redondo ? 0.16 : 0.11, 1, suave(0, 1, w) ** (redondo ? 0.55 : 0.7));
    }
    const w = (u - um) / (1 - um);
    return Math.max(0, 1 - w ** (redondo ? 2.2 : 2.6)) ** (redondo ? 0.55 : 0.5);
  };
  const rzF = (u: number) => (W / 2) * contorno(u);
  // espessura: maior no meio do corpo, fina nas bordas e no pedúnculo
  const ryF = (u: number) => (Hm / 2) * Math.max(0.15, Math.sqrt(contorno(u))) * (raia ? lerp(0.5, 1, Math.sin(PI * clamp(u * 1.2))) : 1);
  const cyF = (u: number) => ryF(u);
  const fat = (z: number, u: number) => (raia ? Math.max(0, 1 - Math.abs(z) / Math.max(1e-5, rzF(u))) ** 0.5 : 1);
  // altura da face de cima em (u, z)
  const ySup = (u: number, z: number) => {
    const q = clamp(Math.abs(z) / Math.max(1e-5, rzF(u)));
    return cyF(u) + ryF(u) * Math.sqrt(Math.max(0, 1 - q * q)) * 1.15 * fat(z, u);
  };
  const uOp = raia ? 0.75 : redondo ? 0.74 : 0.77;
  const uOlho = raia ? 0.8 : redondo ? 0.84 : 0.88;
  const zOlho = raia ? 0.11 * W : 0.06 * W;
  const rOlho = T * (raia ? 0.014 : halibute ? 0.014 : 0.018);
  const olhos = raia
    ? [V(X(uOlho), 0, zOlho), V(X(uOlho), 0, -zOlho)]
    : [V(X(uOlho), 0, zOlho), V(X(uOlho - 0.05), 0, zOlho - W * 0.11)];
  const fP = 1 / (T * 0.045), fT = 1 / (T * 0.03);
  const ventre = mix(c3, BRANCO_V, 0.3);
  const tubs = k.tem('tuberculos');
  const corTopo: CorFn = (x, y, z, u, a) => {
    const cima = Math.cos(a) > 0;
    const n1 = fbm(x * 10 / T, 0, z * 10 / T, s);
    if (!cima) {
      // lado cego: branco perolado, com a borda levemente rosada
      const borda = suave(0.6, 1, Math.abs(Math.sin(a)));
      let c = mix(ventre, mix(ventre, [0.85, 0.7, 0.65], 0.4), borda * 0.4);
      if (raia) {
        // boca, narinas e fendas branquiais na face de baixo
        const dx = x - X(0.83), boca = 1 - suave(T * 0.004, T * 0.008, Math.abs(dx + (z * z) / (W * 0.5)) + Math.max(0, Math.abs(z) - W * 0.06));
        c = mix(c, mul(ventre, 0.45), boca * 0.8);
        for (let i = 0; i < 5; i++) {
          const gx = X(0.62 + i * 0.03);
          for (const sg of [-1, 1]) c = mix(c, mul(ventre, 0.6), (1 - suave(T * 0.003, T * 0.006, Math.hypot((x - gx) * 2.5, z - sg * W * 0.12))) * 0.7);
        }
      }
      return mul(c, 1 + 0.03 * cintila(x, y, z, 1 / (T * 0.004), s));
    }
    let c = mix(c1, c2, suave(0.0, 0.6, n1) * 0.65);
    c = mix(c, mul(c1, 1.18), suave(0.1, 0.5, fbm(x * 25 / T, 0, z * 25 / T, s + 3)) * 0.35);
    if (k.tem('pintas')) {
      const cel = celula(x * fP, 0, z * fP, s);
      c = mix(c, raia ? mul(c2, 0.6) : mul(c2, 0.55), (1 - suave(0.22, 0.32, cel)) * 0.85);
    }
    if (tubs) c = mix(c, mul(c1, 1.4), (1 - suave(0.1, 0.2, celula(x * fT, 0, z * fT, s + 3))) * 0.8);
    if (raia) {
      // manchas claras em ocelo e pontos escuros miúdos
      c = mix(c, mul(c1, 1.3), (1 - suave(0.18, 0.28, celula(x * fP * 0.8, 0, z * fP * 0.8, s + 5))) * 0.5);
      c = mix(c, mul(c1, 0.5), (1 - suave(0.1, 0.17, celula(x * fP * 2.5, 0, z * fP * 2.5, s + 7))) * 0.6);
    }
    // linha lateral: reta no meio, com arco sobre a peitoral
    if (!raia) {
      const zl = W * 0.01 + (k.tem('pintas') ? 0 : 0) + W * 0.07 * Math.exp(-(((u - uOp + 0.06) / 0.07) ** 2));
      const l = (1 - suave(W * 0.004, W * 0.012, Math.abs(z - zl))) * suave(0.04, 0.12, u) * suave(uOp + 0.01, uOp - 0.03, u);
      c = mix(c, mul(c, 0.7), l * 0.8);
      // opérculo: arco escuro atrás da cabeça
      const d = u - uOp + 0.05 * (z / W) ** 2 * 4;
      c = mix(c, mul(c, 0.55), Math.exp(-((d / 0.008) ** 2)) * (1 - suave(W * 0.2, W * 0.32, Math.abs(z))) * 0.8);
      // boca: arco curto na ponta, puxado para o lado de baixo do olho
      const bx = x - X(0.985), bz = z + W * 0.04;
      const boca = (1 - suave(T * 0.002, T * 0.005, Math.abs(Math.hypot(bx * 1.2, bz) - W * 0.06))) * suave(0.95, 0.97, u) * (bz < W * 0.04 ? 1 : 0);
      c = mix(c, [0.12, 0.08, 0.06], boca * 0.8);
    } else {
      // espiráculos atrás dos olhos e espinhos no dorso
      for (const o of olhos) c = mix(c, mul(c1, 0.35), (1 - suave(T * 0.006, T * 0.01, Math.hypot(x - o.x + T * 0.035, z - o.z))) * 0.8);
      c = mix(c, [0.7, 0.64, 0.5], (1 - suave(T * 0.0015, T * 0.003, Math.abs(z))) * (Math.abs(Math.sin(x * 600 / T)) ** 8) * 0.5);
    }
    // pele em volta dos olhos
    for (const o of olhos) c = mix(c, mul(c1, 0.6), (1 - suave(rOlho * 1.1, rOlho * 1.7, Math.hypot(x - o.x, z - o.z))) * 0.6);
    // borda mais clara e translúcida
    c = mix(c, mix(c, ventre, 0.35), suave(0.75, 1, Math.abs(Math.sin(a))) * 0.6);
    return mul(c, 1 + 0.05 * cintila(x, y, z, 1 / (T * 0.004), s));
  };
  // corpo: anéis ao longo de X, face de cima abaulada e de baixo achatada
  const nA = raia ? 56 : 50, mA = raia ? 44 : 36;
  const an: Anel[] = [];
  for (let i = 1; i < nA; i++) {
    const u = 0.5 - 0.5 * Math.cos((PI * i) / nA);
    an.push({ c: V(X(u), cyF(u), 0), u: V(0, 1, 0), w: V(0, 0, 1), ry: Math.max(1e-5, ryF(u)), rz: Math.max(1e-5, rzF(u)), t: u });
  }
  out.push(parte(malhaAneis(an, {
    m: mA, cor: corTopo,
    polos: [V(X(0), cyF(0), 0), V(X(1), cyF(1), 0)],
    desloc: (p, u, a) => {
      const yn = Math.cos(a), cyu = cyF(u);
      const f = raia ? fat(p.z, u) : 1;
      if (yn > 0) p.y = cyu + (p.y - cyu) * 1.15 * f;
      else p.y = cyu + (p.y - cyu) * 0.85 * Math.max(0.35, f);
      if (tubs && yn > 0) p.y += Hm * 0.06 * (1 - suave(0.1, 0.22, celula(p.x * fT, 0, p.z * fT, s + 3)));
      if (!raia && yn > 0) {
        // olhos ficam numa elevação; opérculo marca um degrau
        for (const o of olhos) p.y += rOlho * 0.5 * (1 - suave(rOlho, rOlho * 2.2, Math.hypot(p.x - o.x, p.z - o.z)));
      }
    },
  }), k.ac, true));

  const N_CIMA = V(0, 1, 0);
  const eMin = Math.max(0.0003, T * 0.0006);
  // franja de nadadeiras (dorsal num lado, anal no outro), deitada na tábua
  const franja = (sg: number, u0: number, u1: number, Hf: number) => {
    const nR = Math.round((u1 - u0) * 22);
    return lamina({
      ns: nR * 3, nr: 3,
      P: (sR, r) => {
        const u = lerp(u0, u1, sR);
        const du = 0.01;
        const dz = (rzF(u + du) - rzF(u - du)) / (2 * du * Lb);
        const n = V(-dz, 0, sg).normalize();
        const h = Hf * Math.sin(PI * clamp(sR)) ** 0.45 * (0.75 + 0.25 * Math.sin(PI * sR * 0.8));
        const base = V(X(u), cyF(u) * 0.95, sg * rzF(u) * 0.86);
        return base.addScaledVector(n, h * r * 1.12 + rzF(u) * 0.14 * r).add(V(-h * 0.45 * r, -cyF(u) * 0.5 * r, 0));
      },
      N: () => N_CIMA,
      esp: (sR, r) => eMin + Hm * 0.22 * (1 - r) ** 1.2,
      pregas: Hf * 0.03, raios: nR,
      cor: (sR, r, p, f) => {
        const u = lerp(u0, u1, sR);
        const raio = (0.5 + 0.5 * Math.sin(2 * PI * sR * nR)) ** 2;
        const cimaF = f > 0;
        let c = cimaF ? mix(mix(c1, c2, 0.3), ventre, 0.04 + 0.16 * r) : mix(ventre, [0.8, 0.7, 0.62], 0.2 * r);
        c = mix(c, mul(c, 0.7), raio * 0.5);
        if (cimaF && k.tem('pintas')) c = mix(c, mul(c2, 0.6), (1 - suave(0.18, 0.28, celula(p.x * fP * 1.4, 0, p.z * fP * 1.4, s + 2))) * 0.6);
        return c;
      },
    });
  };
  if (!raia) {
    const Hf = T * (halibute ? 0.045 : redondo ? 0.07 : 0.06);
    out.push(parte(franja(1, 0.06, 0.95, Hf), 'acetinado'));
    out.push(parte(franja(-1, 0.06, 0.72, Hf), 'acetinado'));
    // cauda: leque deitado
    const u0 = 0.04, hr = rzF(u0) * 0.95;
    const nR = 10;
    const Hc = W * (halibute ? 0.42 : 0.36);
    out.push(parte(lamina({
      ns: nR * 3, nr: 5,
      P: (sR, r) => {
        const sg = 2 * sR - 1;
        const L = (Lc + u0 * Lb) * (halibute ? 0.82 + 0.18 * Math.abs(sg) ** 1.2 : 0.7 + 0.3 * Math.sqrt(Math.max(0, 1 - sg * sg)));
        return V(X(u0) - L * r, cyF(u0) * (1 - 0.4 * r), lerp(sg * hr, sg * Hc / 2 * (redondo ? 0.9 : 1), r ** 0.9));
      },
      N: () => N_CIMA,
      esp: (_sR, r) => eMin + Math.min(Hm * 0.25, ryF(u0)) * (1 - r) ** 1.3,
      pregas: Hc * 0.012, raios: nR,
      cor: (sR, r, p, f) => {
        const raio = (0.5 + 0.5 * Math.sin(2 * PI * sR * nR)) ** 2;
        const cimaF = f > 0;
        let c = cimaF ? mix(mix(c1, c2, 0.3), ventre, 0.04 + 0.16 * r) : ventre;
        c = mix(c, mul(c, 0.7), raio * 0.5);
        return mix(c, mul(c1, 0.6), suave(0.85, 1, r) * 0.4);
      },
    }), 'acetinado'));
    // peitoral do lado de cima, pequena e deitada sobre o corpo
    const up = uOp - 0.015;
    const pr = V(X(up), ySup(up, W * 0.18) - Hm * 0.05, W * 0.18);
    const nR2 = 6;
    out.push(parte(lamina({
      ns: nR2 * 3, nr: 4,
      P: (sR, r) => {
        const fi = lerp(-0.5, 0.35, sR);
        const L = T * (redondo ? 0.07 : 0.06) * (0.6 + 0.4 * Math.sin(PI * sR));
        return pr.clone().add(V(-Math.cos(fi) * L * r, Hm * 0.12 * r, Math.sin(fi) * L * r + (sR - 0.5) * W * 0.04));
      },
      N: () => N_CIMA,
      esp: (_sR, r) => eMin + Hm * 0.1 * (1 - r),
      pregas: T * 0.0008, raios: nR2,
      cor: (sR, r) => mix(mul(mix(c1, c2, 0.4), 0.9), mix(c1, ventre, 0.3), r * 0.5 + 0.2 * (0.5 + 0.5 * Math.sin(2 * PI * sR * nR2))),
    }), 'acetinado'));
  } else {
    // rabo fino da raia com espinhos e duas dorsais pequenas na ponta
    const p0 = V(X(0.06), Hm * 0.42, 0);
    const pts = [p0, V(xB0 - Lr * 0.35, Hm * 0.34, W * 0.01), V(xB0 - Lr * 0.7, Hm * 0.24, -W * 0.01), V(-T / 2, Hm * 0.13, 0)];
    out.push(parte(tubo(pts, {
      raio: (t) => Hm * lerp(0.42, 0.12, t), m: 8, n: 24, achata: 1.5, cima: V(0, 1, 0),
      cor: (x, y, z, t, a) => {
        const cima = Math.cos(a) > -0.2;
        const esp = (1 - suave(0.05, 0.25, Math.abs(Math.sin(t * PI * 22)))) * suave(0.8, 0.95, Math.cos(a));
        return mix(cima ? mix(c1, c2, 0.3) : ventre, [0.85, 0.8, 0.65], esp * 0.8);
      },
    }), k.ac));
    for (const tt of [0.72, 0.86]) {
      const crv = new THREE.CatmullRomCurve3(pts);
      const q = crv.getPointAt(tt);
      const Hd = T * 0.02;
      out.push(parte(lamina({
        ns: 6, nr: 3,
        P: (sR, r) => V(q.x + (sR - 0.5) * T * 0.03 - Hd * 0.5 * r, q.y + Hm * 0.1 + Hd * r * Math.sin(PI * clamp(0.15 + 0.7 * sR)), q.z),
        N: () => V(0, 0, 1),
        esp: (_sR, r) => eMin + Hm * 0.1 * (1 - r),
        cor: () => mix(c1, c2, 0.4),
      }), 'acetinado'));
    }
  }
  // olhos saltados no lado de cima
  for (const o of olhos) {
    const y = ySup((o.x - xB0) / Lb, o.z) + (raia ? 0 : rOlho * 0.5);
    const g = olhoPeixe(rOlho, raia ? [0.4, 0.36, 0.25] : [0.42, 0.32, 0.14], mul(c1, 0.4), { pupila: raia ? 0.45 : 0.62 });
    out.push(parte(apontar(g, V(0.15, 1, 0).normalize(), V(o.x, y - rOlho * 0.15, o.z)), 'umido'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* filé, manta, posta e ova                                             */
/* ------------------------------------------------------------------ */

export const gFilePeixe: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const fC = 1 / Math.max(0.001, k.T * 0.004);

  if (v === 'posta') {
    // posta deitada: corte transversal do peixe (dorso em +X, ventre em -X), pele em volta,
    // quatro cones de músculo em anéis, septos claros em cruz e a espinha (ou cartilagem) no centro
    const R = k.T / 2, H = k.T * k.A, l = k.L < 0.95 ? 0.72 : k.L;
    const cartilagem = k.id === 'cacao' || k.id === 'tubarao';
    const cavidade = k.tem('cavidade') || k.id === 'peixe-espada';
    const forma = (a: number) => {
      const sx = Math.sin(a);
      let f = 1 + 0.06 * sx - 0.04 * Math.cos(2 * a);
      if (cavidade) f -= 0.32 * Math.exp(-(((a - 1.5 * PI) / 0.22) ** 2));
      return f;
    };
    const cor: CorFn = (x, y, z, t, a) => {
      const rr = Math.hypot(x / R, z / (R * l));
      const naBorda = rr > 0.94 * forma(a) || (y > H * 0.08 && y < H * 0.92);
      if (naBorda) {
        // pele: dorso escuro, ventre claro
        const c = mix(c2, c1, suave(-0.4, 0.5, x / R));
        return mul(c, 1 + 0.06 * cintila(x, y, z, fC, s));
      }
      const qx = Math.abs(x) - R * 0.42, qz = Math.abs(z) - R * l * 0.38;
      const anel = Math.abs(Math.sin(Math.hypot(qx, qz * 1.2) / R * PI * 4.5 + 0.4 * fbm(x * 40 / R, 0, z * 40 / R, s))) ** 2;
      const claro = (ci[0] + ci[1] + ci[2]) / 3 > 0.6;
      let c = mix(ci, claro ? mix(mul(ci, 0.66), [0.8, 0.72, 0.6], 0.2) : mix(ci, c3, 0.45), anel * (claro ? 0.6 : 0.45));
      // septos: linha horizontal (dorso-ventre) e vertical (lado a lado)
      c = mix(c, c3, (1 - suave(R * 0.012, R * 0.03, Math.abs(z))) * 0.55);
      c = mix(c, c3, (1 - suave(R * 0.012, R * 0.03, Math.abs(x + R * 0.05))) * 0.4 * suave(0.1, 0.3, rr));
      // gordura escura sob a pele e linha de sangue no flanco
      c = mix(c, mul(ci, 0.62), suave(0.8, 0.93, rr) * 0.6);
      c = mix(c, mix(ci, [0.45, 0.12, 0.1], 0.5), (1 - suave(R * 0.04, R * 0.09, Math.hypot(x - R * 0.05, Math.abs(z) - R * l * 0.85))) * 0.6);
      // espinha ou cartilagem
      const dc = Math.hypot(x, z) / R;
      if (cartilagem) {
        c = mix(c, [0.82, 0.84, 0.86], (1 - suave(0.1, 0.13, dc)) * 0.9);
        c = mix(c, [0.55, 0.58, 0.6], (1 - suave(0.04, 0.06, Math.abs(dc - 0.1))) * 0.7);
      } else {
        c = mix(c, mix(c3, [0.95, 0.93, 0.88], 0.5), (1 - suave(0.06, 0.09, dc)) * 0.9);
        c = mix(c, mul(ci, 0.7), (1 - suave(0.015, 0.03, dc)) * 0.7);
        // espinhos dorsal e ventral saindo da vértebra
        c = mix(c, [0.93, 0.9, 0.84], (1 - suave(R * 0.01, R * 0.02, Math.abs(z))) * (1 - suave(0.3, 0.55, dc)) * 0.6);
      }
      if (cavidade) c = mix(c, mul(ci, 0.8), (1 - suave(0.08, 0.16, Math.hypot(x / R + 0.55, z / R))) * 0.5);
      return mul(c, 1 + 0.04 * fbm(x * 90, y * 90, z * 90, s) + 0.03 * cintila(x, y, z, fC, s));
    };
    const b = H * 0.18;
    out.push(parte(torno({
      caminho: [[0, 0], [R * 0.5, 0], [R - b, 0], [R, b], [R, H - b], [R - b, H], [R * 0.5, H], [0, H]],
      n: 30, m: 64, l, cor,
      mod: (_t, a) => forma(a) * (1 + 0.012 * ruido(Math.cos(a) * 6, Math.sin(a) * 6, 0, s)),
    }), 'umido', true));
    return out;
  }

  if (v === 'ova') {
    // par de lobos de ova unidos numa ponta, membrana com veias
    const L = k.T, R = (L * k.L) / 2;
    const fG = 1 / (L * 0.012);
    const cor: CorFn = (x, y, z) => {
      let c = mul(c1, 1 + 0.08 * fbm(x * 60 / L, y * 60 / L, z * 60 / L, s));
      c = mix(c, c2, (1 - suave(0.2, 0.42, celula(x * fG, y * fG, z * fG, s))) * 0.55);
      const veia = 1 - suave(0.0, 0.05, Math.abs(fbm(x * 18 / L, y * 18 / L, z * 18 / L, s + 4)));
      c = mix(c, [0.45, 0.06, 0.05], veia * 0.55);
      return c;
    };
    for (const sg of [-1, 1]) {
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 34, m: 22, cor,
        perfil: (t) => {
          const r = R * Math.sin(PI * clamp(t)) ** 0.6 * (1 - 0.25 * (1 - t)) * (sg > 0 ? 1 : 0.88);
          return { ry: r * 0.72, rz: r, cy: R * 0.72, cz: sg * R * (0.15 + 0.85 * (1 - suave(0.85, 1, t))) * 0.95 };
        },
        desloc: (p) => { if (p.y < R * 0.1) p.y = R * 0.1 - (R * 0.1 - p.y) * 0.3; },
      }), 'umido', true));
    }
    return out;
  }

  // filé, lado e manta: deitados com a pele para baixo e a carne para cima
  const L = k.T, W = L * k.L, H = L * k.A;
  const manta = v === 'manta';
  const filete = v === 'filete';
  const nf = filete ? k.v.n ?? 3 : 1;
  const salgado = manta || k.tem('sal');
  const nMio = manta ? 14 : filete ? 9 : 18;
  for (let i = 0; i < nf; i++) {
    const zOff = nf > 1 ? (i - (nf - 1) / 2) * W * 1.25 : 0;
    const ang = nf > 1 ? (i - (nf - 1) / 2) * 0.06 : 0;
    const Wl = W * (filete ? 1 : 1);
    // largura ao longo do comprimento (t = 0 no rabo, 1 na cabeça)
    const larg = (t: number) => {
      if (manta) return lerp(0.32, 1, t ** 0.7) * Math.sqrt(suave(0, 0.06, t)) * Math.sqrt(suave(1, 0.92, t));
      return Math.sqrt(suave(0, 0.12, t)) * lerp(0.35, 1, Math.sqrt(t)) * Math.sqrt(suave(1, 0.9, t));
    };
    const esp = (t: number) => (manta ? 0.8 : lerp(0.25, 1, t ** 0.6)) * Math.sqrt(suave(0, 0.08, t)) * Math.sqrt(suave(1, 0.9, t));
    const cor: CorFn = (x, y, z, t, a) => {
      const xl = x, zl = z - zOff;
      const rz = (Wl / 2) * Math.max(1e-4, larg(t));
      const zn = zl / rz; // -1 ventre, +1 dorso
      if (Math.cos(a) < -0.2 || y < H * 0.06) {
        // pele: prateada no ventre, mais escura no dorso
        let c = mix(mix(c2, [0.85, 0.86, 0.88], 0.35), mul(c2, 0.55), suave(-0.6, 0.6, zn));
        if (manta) c = mix(c, [0.9, 0.88, 0.8], 0.5);
        return mul(c, 1 + 0.07 * cintila(x, y, z, fC, s));
      }
      // miótomos em W: linhas de gordura que dobram no meio e nas bordas
      const w = Math.abs(Math.abs(zn - 0.1) - 0.5);
      const fase = (xl / L) * nMio + w * 1.6 + 0.15 * fbm(x * 30 / L, 0, z * 30 / L, s);
      const lin = Math.abs(Math.sin(PI * fase)) ** (filete ? 4 : 5);
      let c = mix(c1, manta ? mul(c1, 0.8) : c3, lin * (manta ? 0.45 : 0.7));
      // linha de sangue (lado da pele) e bordas mais escuras
      c = mix(c, mul(mix(c1, [0.5, 0.25, 0.2], 0.4), 0.8), (1 - suave(0.04, 0.12, Math.abs(zn - 0.1))) * 0.35 * (manta ? 0 : 1));
      c = mix(c, mul(c1, 0.78), suave(0.75, 1, Math.abs(zn)) * 0.6);
      // ventre mais gordo e claro no salmão
      c = mix(c, mix(c1, c3, 0.5), suave(-0.4, -0.9, zn) * 0.4);
      if (salgado) {
        c = mix(c, [0.92, 0.92, 0.88], (1 - suave(0.1, 0.24, celula(x * 500, y * 500, z * 500, s))) * 0.85);
        c = mix(c, mul(c1, 0.85), suave(0.2, 0.6, fbm(x * 20, 0, z * 20, s + 1)) * 0.3);
      }
      return mul(c, 1 + 0.05 * fbm(x * 70, y * 70, z * 70, s) + 0.03 * cintila(x, y, z, fC, s));
    };
    const g = corpo({
      x0: -L / 2, x1: L / 2, n: nf > 1 ? 26 : 80, m: nf > 1 ? 16 : 34, exp: 2.6, cor, linear: true,
      perfil: (t) => {
        const ry = (H / 2) * Math.max(0.05, esp(t));
        return { ry, rz: (Wl / 2) * Math.max(0.02, larg(t)), cy: ry, cz: zOff };
      },
      desloc: (p, t, a) => {
        if (p.y < 0) p.y = 0;
        const rz = (Wl / 2) * Math.max(1e-4, larg(t));
        const zn = clamp((p.z - zOff) / rz, -1, 1);
        if (Math.cos(a) > 0) {
          // lombo mais alto do lado do dorso, aba fina do ventre
          const f = manta ? 1 - 0.5 * Math.abs(zn) ** 2 + 0.12 * (1 - Math.abs(zn)) : lerp(0.45, 1.15, suave(-1, 0.4, zn));
          p.y *= f;
          // lascas: sulcos rasos nas linhas dos miótomos
          const w = Math.abs(Math.abs(zn - 0.1) - 0.5);
          const fase = (p.x / L) * nMio + w * 1.6;
          p.y -= H * (manta ? 0.04 : 0.05) * Math.abs(Math.sin(PI * fase)) ** 8 * (1 - Math.abs(zn) ** 4);
          // manta: canal da espinha no meio
          if (manta) p.y -= H * 0.25 * (1 - suave(0.02, 0.1, Math.abs(zn))) * suave(0.1, 0.25, t);
        }
        if (ang) {
          const x = p.x, z = p.z - zOff;
          p.x = x * Math.cos(ang) - z * Math.sin(ang);
          p.z = zOff + x * Math.sin(ang) + z * Math.cos(ang);
        }
      },
    });
    out.push(parte(g, k.ac, true));
  }
  if (manta) {
    // resto da cauda na ponta estreita da manta aberta
    const nR = 8;
    out.push(parte(lamina({
      ns: nR * 3, nr: 4,
      P: (sR, r) => V(-L / 2 + L * 0.03 - L * 0.1 * r, H * 0.25, (2 * sR - 1) * (W * 0.12 + W * 0.18 * r)),
      N: () => V(0, 1, 0),
      esp: (_s, r) => H * 0.25 * (1 - r) + 0.0004,
      pregas: L * 0.001, raios: nR,
      cor: (sR, r) => mul(mix(c2, [0.85, 0.82, 0.7], 0.4), 0.85 + 0.25 * (0.5 + 0.5 * Math.sin(2 * PI * sR * nR)) - 0.15 * r),
    }), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* crustáceos: casca crua (o jogo tinge para corCozida ao cozinhar)     */
/* ------------------------------------------------------------------ */

const _mb = new THREE.Matrix4();
/** Leva uma peça feita com +X para frente e +Y para cima até a origem o, apontando para dir. */
function orientar(g: THREE.BufferGeometry, o: THREE.Vector3, dir: THREE.Vector3, cima = V(0, 1, 0)): THREE.BufferGeometry {
  const x = dir.clone().normalize();
  let z = new THREE.Vector3().crossVectors(x, cima);
  if (z.lengthSq() < 1e-8) z = new THREE.Vector3().crossVectors(x, V(0, 0, 1));
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  _mb.makeBasis(x, y, z).setPosition(o);
  g.applyMatrix4(_mb);
  return g;
}

/** Casca com grânulos, manchas e um brilho por vértice. */
function casca(base: RGB, mancha: RGB, f: number, s: number, amp = 0.5): CorFn {
  return (x, y, z) => {
    let c = mix(base, mancha, suave(0.15, 0.55, fbm(x * f, y * f, z * f, s)) * amp);
    c = mix(c, mul(base, 1.35), (1 - suave(0.12, 0.22, celula(x * f * 4, y * f * 4, z * f * 4, s + 1))) * 0.35);
    return mul(c, 1 + 0.05 * cintila(x, y, z, f * 12, s));
  };
}

/** Pata articulada: tubo pelos pontos, com caroço nas juntas e ponta escura. */
function pata(pts: THREE.Vector3[], r0: number, r1: number, cor: CorFn, ponta: RGB, o: { m?: number; n?: number; achata?: number } = {}): THREE.BufferGeometry {
  const nj = pts.length - 1;
  return tubo(pts, {
    raio: (t) => {
      const j = Math.abs(Math.sin(t * PI * nj));
      return lerp(r0, r1, t) * (0.88 + 0.22 * (1 - j) ** 6);
    },
    m: o.m ?? 8, n: o.n ?? nj * 8, achata: o.achata ?? 1, cima: V(0, 1, 0),
    cor: (x, y, z, t, a) => {
      const c = cor(x, y, z, t, a);
      const junta = (1 - Math.abs(Math.sin(t * PI * nj))) ** 10;
      return mix(mix(c, mul(c, 1.3), junta * 0.5), ponta, suave(0.85, 1, t) * 0.8);
    },
  });
}

/** Garra (quela) apontando para +X: palma inchada, dedo fixo e dedo móvel com dentes. */
function quela(L: number, R: number, cor: CorFn, ponta: RGB, dente: RGB, o: { abre?: number; fina?: boolean; s?: number } = {}): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const s = o.s ?? 0;
  const fina = !!o.fina;
  const lp = fina ? 0.5 : 0.58;
  out.push(corpo({
    x0: 0, x1: L * lp, n: 18, m: 18, cor,
    perfil: (t) => {
      const r = R * (0.5 + 0.5 * Math.sin(PI * (0.12 + 0.75 * t)) ** 0.7);
      return { ry: r * (fina ? 0.65 : 0.62), rz: r };
    },
    mod: (t, a) => 1 + 0.05 * (1 - suave(0.1, 0.25, celula(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s))),
  }));
  const abre = o.abre ?? 0.18;
  for (const sg of [-1, 1]) {
    const movel = sg > 0;
    const x0 = L * (lp - 0.06);
    const comp = L - x0;
    out.push(corpo({
      x0, x1: L, n: 16, m: 10,
      cor: (x, y, z, t, a) => {
        const c = cor(x, y, z, t, a);
        const dt = (1 - suave(0.2, 0.5, Math.abs(Math.sin(t * PI * 9)))) * suave(0.5, 1, -sg * Math.sin(a)) * suave(0.1, 0.3, t) * suave(0.95, 0.8, t);
        return mix(mix(c, dente, dt * 0.7), ponta, suave(0.55, 0.95, t) * 0.85);
      },
      perfil: (t) => {
        const r = R * (fina ? 0.32 : 0.4) * (1 - t) ** 0.75 + R * 0.04;
        const zc = sg * R * (0.3 + abre * Math.sin(PI * t ** 0.8) * (movel ? 1.4 : 0.6) - 0.34 * t ** 2.5);
        return { ry: r * 0.75, rz: r, cz: zc, cy: (movel ? 0.06 : -0.06) * R };
      },
      mod: (t, a) => 1 + 0.12 * (1 - suave(0.2, 0.5, Math.abs(Math.sin(t * PI * 9)))) * suave(0.4, 1, -sg * Math.sin(a)) * suave(0.1, 0.3, t),
    }));
    void comp;
  }
  return out;
}

export const gCrustaceo: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const T = k.T;
  const add = (g: THREE.BufferGeometry, corpoP = false) => out.push(parte(g, k.ac, corpoP));
  const BRANCO_C: RGB = [0.82, 0.78, 0.66];
  const baixo = mix(c1, BRANCO_C, 0.55);
  const ESCURO = mul(c1, 0.35);

  if (v === 'caranguejo') {
    // sapateira deitada de barriga: carapaça oval com borda em "massa de torta", garras com pontas pretas
    const Lc = T * 0.46, Wc = T * 0.66, Hc = T * 0.2;
    const xc = -T / 2 + Lc * 0.62;
    const fC = 1 / (T * 0.06);
    const corC: CorFn = (x, y, z, t, a) => {
      let c = mix(baixo, c1, suave(Hc * 0.25, Hc * 0.55, y));
      c = mix(c, mul(c1, 1.25), suave(Hc * 0.5, Hc * 0.95, y) * suave(0.2, 0.6, fbm(x * fC, 0, z * fC, s)) * 0.4);
      // borda: lóbulos mais claros e sulcos escuros
      const borda = suave(0.75, 0.97, Math.abs(Math.sin(a)));
      c = mix(c, mul(c1, 0.65), borda * Math.abs(Math.sin(Math.atan2(z, x - xc) * 9)) ** 8 * 0.6);
      // sulcos das regiões do dorso (gástrica e cardíaca)
      const sx = (x - xc) / Lc, sz = z / Wc;
      const sulco = 1 - suave(0.0, 0.025, Math.abs(Math.hypot(sx * 1.3, sz * 2.2) - 0.32));
      c = mix(c, mul(c, 0.7), sulco * suave(Hc * 0.6, Hc * 0.85, y) * 0.6);
      return mul(c, 1 + 0.05 * cintila(x, y, z, fC * 10, s));
    };
    const cy0 = Hc * 0.42;
    add(corpo({
      x0: xc - Lc / 2, x1: xc + Lc / 2, n: 30, m: 52, cor: corC,
      perfil: (t) => {
        const u = 2 * t - 1;
        const r = Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.4));
        return { ry: (Hc / 2) * r ** 0.5, rz: (Wc / 2) * r ** 0.85 * (1 - 0.18 * Math.max(0, u) ** 2), cy: cy0 };
      },
      mod: (t, a) => {
        // borda recortada em lóbulos na frente e nos lados
        const ang = Math.atan2(Math.sin(a), (t - 0.5) * 2);
        return 1 + 0.06 * Math.abs(Math.sin(a)) ** 4 * Math.abs(Math.sin(ang * 10)) ** 0.6 * suave(0.2, 0.6, t);
      },
      desloc: (p) => {
        if (p.y < cy0) p.y = cy0 - (cy0 - p.y) * 0.75;
        else p.y = cy0 + (p.y - cy0) * 1.2;
      },
    }), true);
    const corP = casca(c1, mul(c1, 0.7), fC * 1.5, s + 2, 0.4);
    // olhos nas órbitas da frente e antenas curtas
    for (const sg of [-1, 1]) {
      const e0 = V(xc + Lc * 0.47, Hc * 0.62, sg * Wc * 0.07);
      add(tubo([e0, e0.clone().add(V(T * 0.015, T * 0.005, sg * T * 0.004))], { raio: T * 0.007, m: 6, n: 4, cor: corP }));
      out.push(parte(tf(elipsoide(T * 0.009, T * 0.008, T * 0.008, () => ESCURO, 5, 8), [e0.x + T * 0.017, e0.y + T * 0.005, e0.z]), 'umido'));
      add(pata([V(xc + Lc * 0.49, Hc * 0.55, sg * Wc * 0.025), V(xc + Lc * 0.49 + T * 0.03, Hc * 0.62, sg * Wc * 0.05)], T * 0.003, T * 0.0018, corP, ESCURO, { m: 5, n: 6 }));
    }
    // quatro pares de patas abertas para os lados e para trás, encostando na tábua
    for (const sg of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const f = i / 3;
        const x0 = xc + Lc * lerp(0.12, -0.32, f);
        const z0 = sg * Wc * lerp(0.36, 0.3, f);
        const ang = lerp(0.25, -0.9, f);
        const d = V(Math.sin(ang) * 0.6, 0, sg * Math.cos(ang)).normalize();
        const Lp = T * lerp(0.3, 0.27, f);
        const p0 = V(x0, Hc * 0.3, z0);
        const p1 = p0.clone().addScaledVector(d, Lp * 0.42).add(V(0, Hc * 0.35, 0));
        const p2 = p1.clone().addScaledVector(d, Lp * 0.33).add(V(-sg * 0 + Math.sin(ang) * Lp * 0.05, -Hc * 0.2, 0));
        const p3 = p2.clone().addScaledVector(d, Lp * 0.27).add(V(Lp * 0.04 * (f - 0.5), -p2.y + T * 0.004, 0));
        add(pata([p0, p1, p2, p3], T * 0.034, T * 0.011, corP, ESCURO, { m: 8, n: 26, achata: 0.7 }));
      }
      // garra: braço curto e quela robusta dobrada para a frente
      const b0 = V(xc + Lc * 0.3, Hc * 0.35, sg * Wc * 0.3);
      const b1 = b0.clone().add(V(T * 0.06, Hc * 0.15, sg * T * 0.1));
      const b2 = b1.clone().add(V(T * 0.08, -Hc * 0.05, -sg * T * 0.02));
      add(pata([b0, b1, b2], T * 0.04, T * 0.035, corP, mul(c1, 0.8), { m: 10, n: 16 }));
      for (const g of quela(T * 0.3, T * 0.072, corP, [0.02, 0.02, 0.02], BRANCO_C, { abre: 0.08, s })) {
        orientar(g, b2.clone().add(V(-T * 0.01, Hc * 0.05, 0)), V(0.82, -0.08, -sg * 0.55));
        add(g);
      }
    }
    return out;
  }

  const camarao = v === 'camarao';
  const lagostim = v === 'lagostim';
  const fC = 1 / (T * 0.05);
  const corP = casca(c1, camarao ? mix(c1, [0.4, 0.5, 0.6], 0.5) : mul(c1, 1.5), fC, s, camarao ? 0.35 : 0.45);

  if (camarao) {
    // camarão de lado (deitado no flanco), construído com o dorso em +Y e a cabeça em +X
    const Lb = T * 1.05;
    const R = Lb * 0.075 * (k.L / 0.22);
    const xc0 = Lb * 0.05, xc1 = Lb * 0.36;
    const corT: CorFn = (x, y, z, t, a) => {
      let c = corP(x, y, z, t, a);
      // translúcido: mais claro embaixo, órgãos escuros na cabeça
      c = mix(c, mix(c1, [0.85, 0.85, 0.82], 0.5), suave(0.1, -0.7, Math.cos(a)) * 0.5);
      if (x > xc0 && x < xc1) c = mix(c, mix(c, [0.25, 0.22, 0.18], 0.6), (1 - suave(0.0, 0.5, Math.hypot((x - (xc0 + xc1) / 2) / (xc1 - xc0) * 2.2, (y - R * 1.1) / R * 1.5))) * 0.5);
      return c;
    };
    // cefalotórax com rostro serrilhado
    add(corpo({
      x0: xc0, x1: xc1, n: 22, m: 22, cor: corT,
      perfil: (t) => { const r = R * Math.sqrt(Math.sin(PI * (0.12 + 0.88 * t) ** 0.85)) * lerp(1.05, 0.55, t ** 2); return { ry: r * 1.05, rz: r * 0.82, cy: R * 1.1 + R * 0.12 * t }; },
    }), true);
    add(corpo({
      x0: xc1 - R * 0.5, x1: xc1 + R * 1.6, n: 14, m: 6, cor: corT,
      perfil: (t) => ({ ry: R * 0.16 * (1 - t) ** 0.8 + R * 0.01, rz: R * 0.07 * (1 - t) + R * 0.01, cy: R * 1.65 + R * 0.35 * t }),
      mod: (t, a) => 1 + 0.6 * Math.max(0, Math.cos(a)) * Math.abs(Math.sin(t * PI * 7)) ** 4 * (1 - t),
    }));
    // abdômen: seis segmentos em arco descendo para trás
    const nseg = 6;
    const pts: THREE.Vector3[] = [];
    const ang0 = 0, ang1 = PI * 0.62, Ra = Lb * 0.36;
    for (let i = 0; i <= 10; i++) {
      const tt = i / 10, an = lerp(ang0, ang1, tt);
      pts.push(V(xc0 + R * 0.2 - Math.sin(an) * Ra, R * 1.1 - (1 - Math.cos(an)) * Ra * 0.85, 0));
    }
    const crvA = new THREE.CatmullRomCurve3(pts);
    add(tubo(pts, {
      raio: (t) => {
        const fs = (t * nseg) % 1;
        return R * lerp(1.0, 0.5, t) * (0.93 + 0.1 * suave(0.0, 0.85, fs) - 0.06 * suave(0.85, 1, fs));
      },
      achata: 0.78, m: 22, n: 60, cima: V(0, 0, 1),
      cor: (x, y, z, t, a) => {
        const fs = (t * nseg) % 1;
        const c = corT(x, y, z, t, a);
        return mix(c, mul(c1, 0.55), suave(0.8, 0.97, fs) * 0.6);
      },
    }), true);
    // leque da cauda: télson e urópodes
    const pf = crvA.getPointAt(1), tg = crvA.getTangentAt(1).normalize();
    const nrm = V(0, 0, 1);
    const lado = new THREE.Vector3().crossVectors(tg, nrm).normalize();
    const leque = (ang: number, L: number, W: number) => {
      const dir = tg.clone().applyAxisAngle(nrm, ang);
      const lat = new THREE.Vector3().crossVectors(dir, nrm).normalize();
      return lamina({
        ns: 6, nr: 6,
        P: (sR, r) => pf.clone().addScaledVector(dir, L * r).addScaledVector(lat, (sR - 0.5) * W * Math.sin(PI * clamp(0.1 + 0.85 * r)) ** 0.6),
        N: () => nrm,
        esp: (_s, r) => R * 0.06 * (1 - r) + T * 0.0006,
        cor: (sR, r) => mix(mix(c1, [0.85, 0.85, 0.82], 0.3), mix(mul(c1, 0.6), [0.55, 0.2, 0.25], 0.35), suave(0.7, 1, r) * 0.8 + 0.1 * Math.abs(Math.sin(sR * 20))),
      });
    };
    add(leque(0, T * 0.16, R * 0.45));
    for (const sg of [-1, 1]) { add(leque(sg * 0.32, T * 0.15, R * 0.6)); add(leque(sg * 0.6, T * 0.14, R * 0.55)); }
    void lado;
    // patas de andar e pleópodes: espessura mínima visível
    const corPata: CorFn = (x, y, z) => mix(c2, c1, 0.3 + 0.2 * ruido(x * 600, y * 600, z * 600, s));
    for (const sg of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = lerp(xc0 + R * 0.2, xc1 - R * 0.3, i / 4);
        const L = T * (0.075 + 0.012 * i);
        const p0 = V(x, R * 0.45, sg * R * 0.35);
        add(pata([p0, p0.clone().add(V(L * 0.25, -L * 0.45, sg * L * 0.15)), p0.clone().add(V(L * 0.5, -L * 0.8, sg * L * 0.22))], T * 0.0055, T * 0.003, corPata, mul(c1, 0.6), { m: 5, n: 10 }));
      }
      for (let i = 1; i < 5; i++) {
        const q = crvA.getPointAt(i / 6.5), tq = crvA.getTangentAt(i / 6.5);
        const dn = V(tq.y, -tq.x, 0).normalize();
        const rr = R * lerp(1, 0.55, i / 6.5);
        const p0 = q.clone().addScaledVector(dn, rr * 0.75).add(V(0, 0, sg * rr * 0.3));
        add(pata([p0, p0.clone().addScaledVector(dn, T * 0.05).addScaledVector(tq, T * 0.02)], T * 0.006, T * 0.003, corPata, mix(c2, [0.8, 0.5, 0.45], 0.4), { m: 5, n: 6, achata: 0.5 }));
      }
      // antenas longas e antênulas, com espessura mínima de ~0,7 mm
      const pA = V(xc1, R * 1.45, sg * R * 0.3);
      const La = Lb * 1.0;
      add(pata([pA, pA.clone().add(V(La * 0.12, La * 0.06, sg * La * 0.03)), pA.clone().add(V(La * 0.05, La * 0.2, sg * La * 0.06)), pA.clone().add(V(-La * 0.3, La * 0.24, sg * La * 0.04)), pA.clone().add(V(-La * 0.62, La * 0.12, sg * La * 0.02))], T * 0.0055, Math.max(0.0007, T * 0.0035), corPata, mul(c2, 0.9), { m: 5, n: 40 }));
      add(pata([pA.clone().add(V(0, R * 0.1, 0)), pA.clone().add(V(T * 0.06, R * 0.5, sg * T * 0.01)), pA.clone().add(V(T * 0.12, R * 0.4, sg * T * 0.02))], T * 0.005, T * 0.0035, corPata, mul(c2, 0.9), { m: 5, n: 10 }));
      // olho pedunculado
      const e0 = V(xc1 - R * 0.15, R * 1.55, sg * R * 0.4);
      add(tubo([e0.clone().add(V(-R * 0.3, -R * 0.1, -sg * R * 0.2)), e0], { raio: R * 0.12, m: 6, n: 4, cor: corT }));
      out.push(parte(tf(elipsoide(R * 0.2, R * 0.2, R * 0.18, () => [0.03, 0.03, 0.035], 6, 10), [e0.x, e0.y, e0.z]), 'umido'));
    }
    // deita de lado: dorso para +Z
    for (const p of out) p.g.rotateX(PI / 2);
    return out;
  }

  // lagosta e lagostim: deitados de barriga, cauda estendida, garras para a frente
  const R = T * 0.085 * (k.L / 0.17) * (lagostim ? 0.95 : 1);
  const xT = -T / 2 + T * 0.09; // começo do leque
  const xa1 = -T / 2 + T * (lagostim ? 0.46 : 0.42); // fim do abdômen / começo da carapaça
  const xc1 = xa1 + T * (lagostim ? 0.26 : 0.27); // ponta da carapaça (sem rostro)
  const Yc = R * 1.0;
  const corC: CorFn = (x, y, z, t, a) => {
    let c = corP(x, y, z, t, a);
    c = mix(c, baixo, suave(0.0, -0.6, Math.cos(a)) * 0.8);
    if (k.tem('cruz')) c = mix(c, mul(c1, 1.6), (1 - suave(R * 0.02, R * 0.06, Math.abs(z))) * suave(0.5, 0.9, Math.cos(a)) * 0.6);
    // sulco cervical
    const xs = x - lerp(xa1, xc1, 0.55) + 0.25 * R * (z / R) ** 2;
    c = mix(c, mul(c, 0.55), (1 - suave(R * 0.02, R * 0.06, Math.abs(xs))) * suave(-0.2, 0.3, Math.cos(a)) * 0.7);
    return c;
  };
  add(corpo({
    x0: xa1 - R * 0.2, x1: xc1, n: 30, m: 30, cor: corC,
    perfil: (t) => {
      const r = R * Math.sqrt(Math.sin(PI * (0.06 + 0.94 * t) ** 0.75)) * lerp(1, 0.62, t ** 2.2);
      return { ry: r * 0.95, rz: r * 0.98, cy: Yc + R * 0.05 * t };
    },
    mod: (t, a) => 1 + 0.03 * (1 - suave(0.1, 0.25, celula(t * 14, Math.cos(a) * 3, Math.sin(a) * 3, s))),
    desloc: (p) => { if (p.y < Yc * 0.35) p.y = Yc * 0.35 - (Yc * 0.35 - p.y) * 0.4; },
  }), true);
  // rostro
  add(corpo({ x0: xc1 - R * 0.35, x1: xc1 + R * 0.7, n: 10, m: 6, cor: corC, perfil: (t) => ({ ry: R * 0.12 * (1 - t) + R * 0.01, rz: R * 0.1 * (1 - t) + R * 0.01, cy: Yc + R * 0.6 + R * 0.1 * t }) }));
  // abdômen: seis anéis que se sobrepõem, com pleuras caindo dos lados
  const nseg = 6;
  const Lseg = (xa1 - xT) / nseg;
  for (let i = 0; i < nseg; i++) {
    const xf = xa1 - i * Lseg + R * 0.05, xr = xf - Lseg * 1.15;
    const rs = R * lerp(0.9, 0.66, i / (nseg - 1));
    add(corpo({
      x0: xr, x1: xf, n: 10, m: 28, exp: 2.4,
      cor: (x, y, z, t, a) => {
        const c = corC(x, y, z, t, a);
        return mix(mix(c, mul(c, 0.6), suave(0.2, 0.0, t) * 0.7), mul(c, 1.2), (1 - suave(0.0, 0.15, Math.abs(t - 0.5))) * 0.15);
      },
      perfil: (t) => ({ ry: rs * 0.72 * (0.9 + 0.1 * Math.sin(PI * t)), rz: rs * (0.92 + 0.08 * t), cy: Yc * 0.88 - i * R * 0.04 }),
      desloc: (p, _t, a) => { const yb = Yc * 0.88 - i * R * 0.04 - rs * 0.3; if (p.y < yb) p.y = yb - (yb - p.y) * 0.3; if (Math.cos(a) < 0.3) p.z *= 1.06; },
    }), i === 0);
  }
  // leque da cauda: télson no meio e dois pares de urópodes
  const pT = V(xT + R * 0.1, Yc * 0.62, 0);
  const lequeL = (ang: number, L: number, W: number) => lamina({
    ns: 8, nr: 7,
    P: (sR, r) => {
      const dir = V(-Math.cos(ang), 0, Math.sin(ang));
      const lat = V(Math.sin(ang), 0, Math.cos(ang));
      return pT.clone().addScaledVector(dir, L * r).addScaledVector(lat, (sR - 0.5) * W * Math.sin(PI * clamp(0.12 + 0.8 * r)) ** 0.5).add(V(0, -Yc * 0.35 * r, 0));
    },
    N: () => V(0, 1, 0),
    esp: (_s, r) => R * 0.08 * (1 - r) + T * 0.0008,
    cor: (sR, r, p) => mix(corC(p.x, p.y, p.z, 0, 0), mix(c2, mul(c1, 0.5), 0.4), suave(0.75, 1, r) * 0.7),
  });
  add(lequeL(0, T * 0.1, R * 0.7));
  for (const sg of [-1, 1]) { add(lequeL(sg * 0.38, T * 0.095, R * 0.75)); add(lequeL(sg * 0.75, T * 0.09, R * 0.7)); }

  // patas de andar: quatro pares, abertas e apoiadas na tábua
  for (const sg of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const x0 = lerp(xc1 - R * 1.0, xa1 + R * 0.3, f);
      const ang = lerp(0.6, -0.5, f);
      const d = V(Math.sin(ang), 0, sg * Math.cos(ang)).normalize();
      const Lp = T * lerp(0.19, 0.22, f) * (lagostim ? 1.05 : 1);
      const p0 = V(x0, Yc * 0.55, sg * R * 0.7);
      const p1 = p0.clone().addScaledVector(d, Lp * 0.35).add(V(0, R * 0.55, 0));
      const p2 = p1.clone().addScaledVector(d, Lp * 0.35).add(V(0, -R * 0.4, 0));
      const p3 = p2.clone().addScaledVector(d, Lp * 0.3).setY(T * 0.004);
      add(pata([p0, p1, p2, p3], T * 0.012, T * 0.0055, corP, mix(c2, [0.85, 0.6, 0.4], 0.3), { m: 7, n: 24 }));
    }
    // antenas: base grossa com espinhos e chicote longo varrendo para trás pelo lado
    const a0 = V(xc1 - R * 0.3, Yc + R * 0.25, sg * R * 0.35);
    const La = T * (lagostim ? 0.75 : 0.95);
    add(pata([a0, a0.clone().add(V(T * 0.05, R * 0.15, sg * T * 0.02)), a0.clone().add(V(T * 0.1, R * 0.1, sg * T * 0.07)), a0.clone().add(V(T * 0.08, 0, sg * T * 0.17)), a0.clone().add(V(-La * 0.2, -Yc * 0.4, sg * T * 0.26)), a0.clone().add(V(-La * 0.55, -Yc * 0.9 + T * 0.003, sg * T * 0.24))], T * 0.016, Math.max(0.0008, T * 0.003), corP, mix(c2, [0.8, 0.4, 0.2], 0.3), { m: 7, n: 60 }));
    add(pata([a0.clone().add(V(0, R * 0.1, -sg * R * 0.2)), a0.clone().add(V(T * 0.07, R * 0.3, -sg * R * 0.05)), a0.clone().add(V(T * 0.12, R * 0.3, sg * R * 0.1))], T * 0.006, T * 0.003, corP, mul(c2, 0.8), { m: 5, n: 12 }));
    // olhos
    const e0 = V(xc1 - R * 0.15, Yc + R * 0.5, sg * R * 0.28);
    add(tubo([e0.clone().add(V(-R * 0.2, -R * 0.1, -sg * R * 0.1)), e0], { raio: R * 0.08, m: 6, n: 4, cor: corC }));
    out.push(parte(tf(elipsoide(R * 0.13, R * 0.12, R * 0.12, () => [0.02, 0.02, 0.025], 6, 10), [e0.x, e0.y, e0.z]), 'umido'));
    // garras: braço (ísquio, mero e carpo) e quela; na lagosta, uma esmagadora e outra cortadora
    const esmaga = !lagostim && sg > 0;
    const esc = lagostim ? 0.62 : esmaga ? 1.12 : 0.95;
    const b0 = V(xc1 - R * 1.1, Yc * 0.65, sg * R * 0.6);
    const b1 = b0.clone().add(V(T * 0.05, R * 0.35, sg * T * 0.08));
    const b2 = b1.clone().add(V(T * 0.09 * esc, R * 0.05, sg * T * 0.05));
    const b3 = b2.clone().add(V(T * 0.05, -R * 0.15, -sg * T * 0.015));
    add(pata([b0, b1, b2, b3], R * 0.3 * esc, R * 0.36 * esc, corP, mul(c1, 0.8), { m: 10, n: 26 }));
    const Lq = T * (lagostim ? 0.22 : 0.29) * esc;
    const Rq = R * (lagostim ? 0.45 : esmaga ? 0.95 : 0.72) * esc;
    for (const g of quela(Lq, Rq, corP, mix(c2, [0.85, 0.55, 0.3], 0.4), BRANCO_C, { abre: esmaga ? 0.08 : 0.2, fina: lagostim || !esmaga, s })) {
      orientar(g, b3.clone().add(V(-R * 0.1, -Yc * 0.1, 0)), V(1, -0.12, sg * 0.12));
      add(g);
    }
  }
  return out;
};


/* ------------------------------------------------------------------ */
/* bivalves                                                             */
/* ------------------------------------------------------------------ */

export const gBivalve: Gerador = (k) => {
  if (k.v.v === 'ostra' || k.v.v === 'ameijoa' || k.v.v === 'vieira') return gConchaFechada(k);
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const mex = v === 'mexilhao', vie = v === 'vieira', ost = v === 'ostra', ame = !mex && !vie && !ost;
  // concha deitada sobre uma valva: valva de baixo funda, de cima mais rasa; umbo (charneira) em -X
  const hT = H * (vie ? 0.32 : ost ? 0.3 : 0.5), hB = H * (vie ? 0.68 : ost ? 0.7 : 0.5);
  const xU = -L / 2 + L * (mex ? 0.02 : vie ? 0.08 : 0.12);
  const R = L / 2;
  const nCost = 17;
  // contorno visto de cima, raio relativo por ângulo em volta do centro (a = 0 em +X)
  const contorno = (a: number) => {
    const ca = Math.cos(a);
    if (mex) return 1;
    if (vie) return (1 - 0.1 * Math.max(0, -ca) ** 3) * (1 + 0.02 * Math.cos(2 * a));
    if (ost) return 1 + 0.1 * Math.cos(2 * a) - 0.06 * ca + 0.07 * ruido(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0, s);
    return 1 + 0.05 * ca - 0.08 * Math.max(0, -ca) ** 2;
  };
  const fasePolar = (x: number, z: number) => Math.atan2(z, x - xU);
  const distU = (x: number, z: number) => Math.hypot(x - xU, z) / L;
  const cor: CorFn = (x, y, z) => {
    const cima = y > 0;
    const d = distU(x, z), ph = fasePolar(x, z);
    const n1 = fbm(x * 40 / L, y * 40 / L, z * 40 / L, s);
    let c: RGB;
    // linhas de crescimento concêntricas a partir do umbo
    const anel = Math.abs(Math.sin(d * (ame ? 36 : ost ? 30 : 45) + n1 * (ame ? 0.4 : 1.5))) ** 3;
    if (mex) {
      c = mix(c1, c2, suave(0.55, 0.95, d) * 0.5 + 0.2 * n1);
      c = mix(c, mul(c1, 0.5), anel * 0.35);
      c = mix(c, [0.45, 0.32, 0.4], (1 - suave(0.04, 0.14, d)) * 0.6);
      c = mix(c, mix(c1, [0.35, 0.25, 0.12], 0.6), suave(0.85, 0.98, d) * 0.5);
    } else if (vie) {
      const cost = 0.5 + 0.5 * Math.cos(ph * nCost * 2);
      c = mix(c2, c1, cost);
      c = mix(c, mul(c, 0.82), anel * 0.3);
      if (!cima) c = mix(c, [0.85, 0.8, 0.72], 0.45);
    } else if (ost) {
      c = mix(c1, c2, suave(-0.3, 0.5, n1));
      c = mix(c, c3, suave(0.2, 0.7, fbm(x * 90 / L, y * 90 / L, z * 90 / L, s + 2)) * 0.5);
      c = mix(c, mul(c, 0.65), anel * 0.5);
      c = mix(c, [0.45, 0.35, 0.45], suave(0.6, 0.9, d) * 0.25);
    } else {
      c = mix(mul(c1, 1.05), mul(c1, 0.7), anel * 0.8);
      // desenho em ziguezague marrom das amêijoas
      const zig = Math.abs(Math.sin(ph * 9 + Math.abs(Math.sin(d * 22)) * 1.4)) ** 4;
      c = mix(c, mul(c2, 0.8), zig * suave(0.2, 0.5, d) * 0.75);
      c = mix(c, mul(c2, 0.8), (1 - suave(0.04, 0.12, d)) * 0.5);
    }
    // junção das valvas: risco escuro
    c = mix(c, mul(c, 0.35), 1 - suave(H * 0.01, H * 0.05, Math.abs(y)));
    return mul(c, 1 + 0.05 * cintila(x, y, z, 1 / (L * 0.012), s));
  };
  const g = torno({
    n: 40, m: 64,
    caminho: (t) => {
      // do polo de baixo (t = 0) à borda (t = 0,5) e ao polo de cima (t = 1)
      if (t < 0.5) { const q = t / 0.5; return [R * Math.sin((q * PI) / 2), -hB * Math.cos((q * PI) / 2) ** (ost ? 0.8 : 0.9)]; }
      const q = (t - 0.5) / 0.5;
      return [R * Math.cos((q * PI) / 2), hT * Math.sin((q * PI) / 2) ** (vie ? 0.75 : 0.9)];
    },
    cor,
    mod: (_t, a) => contorno(PI / 2 - a),
    desloc: (p) => {
      const ry = p.y;
      // mexilhão: gota alongada e levemente curva
      if (mex) {
        const u = (p.x + R) / (2 * R);
        p.z *= (W / L) * (0.15 + 0.95 * Math.sin(PI * clamp(0.02 + 0.62 * u)) ** 0.8);
        p.z += W * 0.25 * (u - 0.5) ** 2 - W * 0.05;
      } else p.z *= W / L;
      const d = distU(p.x, p.z), ph = fasePolar(p.x, p.z);
      const lado = Math.sign(ry);
      // umbo: bico saliente perto da charneira
      p.y += lado * H * 0.12 * (1 - suave(0.0, 0.22, d)) * (mex ? 0.5 : 1);
      if (vie) p.y += lado * H * 0.07 * Math.abs(Math.cos(ph * nCost)) ** 1.5 * suave(0.1, 0.5, d) * (lado > 0 ? 0.6 : 1);
      if (ame) p.y += lado * H * 0.03 * Math.abs(Math.sin(d * 36)) ** 0.5 * suave(0.15, 0.4, d);
      if (ost) {
        // camadas escamosas e superfície irregular
        p.y += lado * H * (0.07 * Math.abs(Math.sin(d * 30 + fbm(p.x * 30 / L, 0, p.z * 30 / L, s) * 2)) + 0.05 * fbm(p.x * 25 / L, ry * 25 / L, p.z * 25 / L, s + 4));
        if (lado > 0) p.y *= 0.85;
      }
    },
  });
  g.translate(0, hB, 0);
  out.push(parte(g, k.ac, true));
  if (vie) {
    // orelhas (aurículas) na charneira
    for (const sg of [-1, 1]) {
      out.push(parte(lamina({
        ns: 6, nr: 4,
        P: (sR, r) => V(xU - L * 0.04 + sR * L * 0.12 * r ** 0.3, hB + hT * 0.15, sg * (W * 0.03 + W * 0.2 * r) * (0.6 + 0.4 * sR)),
        N: () => V(0, 1, 0),
        esp: (_s, r) => H * 0.12 * (1 - r * 0.6),
        cor: (sR, r, p) => cor(p.x, H * 0.2, p.z, 0, 0),
        fecharRaiz: true,
      }), k.ac));
    }
  }
  if (mex && k.tem('barba')) {
    // bisso: tufo de fios marrons saindo da junta do lado reto
    for (let i = 0; i < 9; i++) {
      const x = lerp(-L * 0.25, L * 0.05, i / 8) + k.r.f(-1, 1) * L * 0.01;
      const u = (x + R) / (2 * R);
      const z0 = -Math.sqrt(Math.max(0, R * R - x * x)) * (W / L) * (0.15 + 0.95 * Math.sin(PI * clamp(0.02 + 0.62 * u)) ** 0.8) * 0.92 + W * 0.25 * (u - 0.5) ** 2 - W * 0.05;
      const p0 = V(x, hB, z0);
      out.push(parte(tubo([p0, p0.clone().add(V(k.r.f(-1, 1) * L * 0.03, -hB * 0.3, -W * 0.15)), p0.clone().add(V(k.r.f(-1, 1) * L * 0.05, -hB * 0.85, -W * 0.3))], { raio: (t) => L * 0.007 * (1 - 0.6 * t), m: 5, n: 8, cor: (x2, y2, z2) => mul([0.32, 0.25, 0.14], 1 + 0.15 * ruido(x2 * 900, y2 * 900, z2 * 900, s)) }), 'fosco'));
    }
  }
  void ci;
  return out;
};

/**
 * Bivalve fechado, deitado sobre a valva de baixo, com a charneira (umbo) em -X:
 * ostra em gota irregular, com lâminas escamosas e borda franzida; amêijoa estufada, com
 * estrias concêntricas finas e o bico do umbo saliente; vieira em leque, com costelas radiais
 * fortes, borda ondulada pelas costelas e as duas orelhas retas na charneira.
 */
const gConchaFechada: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const v = k.v.v;
  const ost = v === 'ostra', vie = v === 'vieira', ame = !ost && !vie;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A * (v === 'ameijoa' ? 1.3 : 1), R = L / 2;
  // valva de baixo funda; a de cima rasa na ostra e na vieira, igual na amêijoa
  const hB = H * (ost ? 0.64 : vie ? 0.6 : 0.5), hT = H - hB;
  const eB = ost ? 0.7 : vie ? 0.75 : 1, eT = ost ? 1.15 : vie ? 0.95 : 1;
  const xU = -R * (ost ? 0.97 : vie ? 0.9 : 0.78);
  const fCost = 38; // frequência das costelas da vieira (cerca de 16 no leque)
  const dU = (x: number, z: number) => Math.hypot(x - xU, z) / L;
  const phU = (x: number, z: number) => Math.atan2(z, x - xU);
  const frac = (q: number) => q - Math.floor(q);
  const lamelas = (x: number, z: number) => frac(dU(x, z) * 7.5 + 0.9 * fbm(x * 30 / L, 0, z * 30 / L, s));
  const g = torno({
    n: 40, m: 64,
    caminho: (t) => {
      if (t < 0.5) { const q = t / 0.5; return [R * Math.sin((q * PI) / 2), -hB * Math.cos((q * PI) / 2) ** eB]; }
      const q = (t - 0.5) / 0.5;
      return [R * Math.cos((q * PI) / 2), hT * Math.sin((q * PI) / 2) ** eT];
    },
    desloc: (p, t) => {
      const lado = t > 0.5 ? 1 : -1;
      const rr = Math.min(1, Math.hypot(p.x, p.z) / R);
      const th = Math.atan2(p.z, p.x);
      // contorno visto de cima
      let fr = 1;
      if (ost) fr = 1 + 0.09 * ruido(Math.cos(th) * 2.2, Math.sin(th) * 2.2, 0.4, s) + 0.035 * ruido(Math.cos(th) * 7, Math.sin(th) * 7, 1.3, s + 1);
      else if (ame) fr = 1 + 0.05 * Math.cos(th) - 0.17 * Math.max(0, -Math.cos(th)) ** 1.5;
      else fr = 1 - 0.12 * Math.max(0, -Math.cos(th)) ** 5;
      p.x *= fr;
      p.z *= fr;
      const u = clamp((p.x / R + 1) / 2);
      let lz = W / L;
      if (ost) lz *= (0.3 + 0.75 * Math.sin(PI * clamp(0.06 + 0.72 * u)) ** 0.65) * (1 + 0.1 * ruido(u * 4, 0.7, 0.2, s + 2));
      p.z *= lz;
      const d = dU(p.x, p.z), ph = phU(p.x, p.z);
      if (ost) {
        // lâminas de crescimento em degraus, mais altas na valva funda; caroços e caneluras radiais
        const f = lamelas(p.x, p.z);
        p.y += lado * H * (lado < 0 ? 0.13 : 0.07) * f * f * suave(0.08, 0.35, d);
        p.y += lado * H * 0.07 * fbm(p.x * 22 / L, p.y * 22 / L, p.z * 22 / L, s + 4);
        if (lado < 0) p.y -= H * 0.08 * Math.abs(Math.sin(ph * 6 + 1.5 * fbm(p.x * 10 / L, 0, p.z * 10 / L, s + 5))) ** 2 * suave(0.3, 0.8, d);
        // borda franzida: sobe e desce igual nas duas valvas, que continuam encaixadas
        p.y += H * 0.16 * ruido(th * 2.5, 0.3, 0.9, s + 6) * suave(0.7, 1, rr);
      } else if (ame) {
        // bico do umbo saliente (as estrias concêntricas finas vão na cor: em relevo a malha não as resolve)
        p.y += lado * H * 0.16 * (1 - suave(0, 0.22, d));
      } else {
        // costelas radiais e a borda ondulada que elas formam
        const cost = 0.5 + 0.5 * Math.cos(ph * fCost);
        p.y += lado * H * (lado > 0 ? 0.07 : 0.09) * cost ** 1.4 * suave(0.06, 0.35, d);
        p.y += lado * H * 0.012 * Math.abs(Math.sin(d * PI * 30)) * suave(0.2, 0.5, d);
        p.y += H * 0.07 * Math.cos(ph * fCost) * suave(0.78, 1, rr);
        p.y += lado * H * 0.1 * (1 - suave(0, 0.18, d));
      }
    },
    cor: (x, y, z, t) => {
      const cima = t > 0.5;
      const d = dU(x, z), ph = phU(x, z);
      const n1 = fbm(x * 40 / L, y * 40 / L, z * 40 / L, s);
      let c: RGB;
      if (ost) {
        const f = lamelas(x, z);
        c = mix(mix(c1, c2, suave(-0.3, 0.5, n1)), rgb('#5e5646'), 0.6);
        c = mix(c, rgb('#56604a'), suave(0.2, 0.7, fbm(x * 14 / L, y * 14 / L, z * 14 / L, s + 3)) * 0.35);
        // riscas arroxeadas que partem do umbo
        c = mix(c, rgb('#5a4658'), Math.abs(Math.sin(ph * 5 + n1 * 2)) ** 6 * 0.5 * suave(0.1, 0.4, d));
        // beirada calcária branca de cada lâmina, sombra no degrau
        c = mix(c, mul(c3, 0.92), suave(0.86, 0.98, f) * 0.45);
        c = mix(c, mul(c, 0.6), (1 - suave(0.0, 0.12, f)) * 0.5);
      } else if (ame) {
        const base = mix(c1, rgb('#a09684'), 0.45);
        c = mix(base, mul(base, 0.45), Math.abs(Math.sin(d * PI * 12)) ** 2 * 0.8);
        c = mix(c, mul(base, 0.8), suave(0.3, 0.8, Math.sin(d * PI * 4) * 0.5 + 0.5) * 0.25);
        // desenho em ziguezague marrom e o umbo mais escuro
        const zig = Math.abs(Math.sin(ph * 9 + Math.abs(Math.sin(d * 22)) * 1.4)) ** 5;
        c = mix(c, mul(c2, 0.8), zig * suave(0.2, 0.5, d) * 0.3);
        c = mix(c, mul(c2, 0.75), (1 - suave(0.04, 0.16, d)) * 0.6);
        c = mix(c, rgb('#7a6a7a'), suave(0.9, 1.05, d * 1.05) * 0.3);
      } else {
        const cost = 0.5 + 0.5 * Math.cos(ph * fCost);
        const verm = mix(c1, rgb('#c0502e'), 0.55);
        if (cima) {
          // valva de cima rosada a vermelho-alaranjada, faixas de crescimento mais claras, crista clara
          c = mix(verm, mul(verm, 0.7), (1 - cost) * 0.5);
          c = mix(c, mix(c1, rgb('#f4e4cc'), 0.5), suave(0.55, 0.9, Math.sin(d * PI * 6 + n1) * 0.5 + 0.5) * 0.45);
        } else {
          c = mix(rgb('#f2e2cc'), mix(c1, rgb('#f4e4cc'), 0.4), 0.5 + 0.3 * n1);
          c = mix(c, mul(c, 0.78), (1 - cost) * 0.45);
        }
        c = mix(c, mul(c2, 0.85), (1 - suave(0.03, 0.12, d)) * 0.4);
      }
      // junção das valvas: risco escuro
      c = mix(c, mul(c, 0.35), 1 - suave(H * 0.008, H * 0.04, Math.abs(y)));
      return mul(c, 1 + 0.05 * cintila(x, y, z, 1 / (L * 0.012), s));
    },
  });
  g.translate(0, hB, 0);
  out.push(parte(g, ost ? 'fosco' : k.ac, true));
  if (vie) {
    // orelhas (aurículas) retas dos dois lados da charneira, na altura da junção
    const corOrelha: RGB = mix(c1, rgb('#c0502e'), 0.4);
    for (const sg of [-1, 1]) {
      out.push(parte(lamina({
        ns: 6, nr: 5,
        P: (sR, r) => V(xU - L * 0.015 + sR * L * 0.17 * (1 - 0.45 * r), hB + H * 0.04, sg * (W * 0.03 + W * 0.27 * r) * (1 - 0.3 * sR)),
        N: () => V(0, 1, 0),
        esp: (_s, r) => H * 0.16 * (1 - r * 0.5),
        cor: (sR, r) => mul(corOrelha, 0.85 + 0.15 * Math.abs(Math.sin(sR * 14 + r * 3)) + 0.05 * ruido(sR * 9, r * 9, sg, s)),
        fecharRaiz: true,
      }), k.ac));
    }
  }
  void c3;
  return out;
};

/* ------------------------------------------------------------------ */
/* conchas em espiral (búzio, escargot)                                 */
/* ------------------------------------------------------------------ */

export const gConchaEspiral: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const escargot = k.v.v === 'escargot';
  // concha construída em pé: espira para cima, voltas marcadas por suturas em espiral
  const H = escargot ? k.T * 0.85 : k.T;
  const R = escargot ? k.T / 2 : k.T * 0.3;
  const voltas = escargot ? 3.5 : 6;
  const ombro = escargot ? 0.42 : 0.32; // altura relativa da volta maior
  const env = (u: number) => {
    if (u < ombro) {
      const f = u / ombro;
      return escargot ? Math.sin((f * PI) / 2) ** 0.6 : 0.18 + 0.82 * Math.sin((f * PI) / 2) ** 1.5;
    }
    return (1 - (u - ombro) / (1 - ombro)) ** (escargot ? 0.8 : 1.15);
  };
  const fase = (t: number, a: number) => {
    const f = t * voltas - a / TAU;
    return f - Math.floor(f);
  };
  const g = torno({
    caminho: (u) => [R * env(u), H * u], n: 60, m: 32,
    mod: (t, a) => 1 - 0.14 * suave(0.82, 1, fase(t, a)) * suave(0.05, 0.25, t) + 0.03 * Math.sin(a * 9 + t * 40) * (escargot ? 0 : 1),
    cor: (x, y, z, t, a) => {
      const f = fase(t, a);
      let c = mix(c1, c2, Math.abs(Math.sin(f * PI * 3)) ** 3 * 0.55 + suave(0.3, 0.8, fbm(x * 90, y * 90, z * 90, s)) * 0.25);
      c = mix(c, mul(c2, 0.7), suave(0.85, 0.98, f) * 0.8);
      // abertura (boca) de um lado da volta maior
      const ab = Math.exp(-(((a - PI / 2 + PI) % TAU - PI) ** 2) / 0.35) * suave(0.05, 0.15, t) * suave(ombro + 0.05, ombro - 0.05, t);
      return mix(c, ci, ab * 0.9);
    },
  });
  out.push(parte(g, k.ac, true));
  if (k.tem('carne')) out.push(parte(tf(elipsoide(R * 0.5, H * 0.18, R * 0.35, () => mul(ci, 0.9), 6, 10), [R * 0.75, H * 0.12, 0]), 'umido'));
  // búzio deitado com a espira em +X; escargot fica em pé levemente inclinado
  for (const p of out) {
    if (escargot) p.g.rotateZ(-0.35);
    else p.g.rotateZ(-PI / 2);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* lula                                                                 */
/* ------------------------------------------------------------------ */

export const gCefalopode: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const R = (L * k.L) / 2;
  // lula deitada: manto (tubo) com nadadeiras em losango na ponta (-X), cabeça e braços para +X
  const Lm = L * 0.56;
  const xm0 = -L / 2, xm1 = xm0 + Lm;
  const fCr = 1 / (L * 0.022);
  const corPele: CorFn = (x, y, z) => {
    // cromatóforos: pintinhas vinho-arroxeadas, densas no dorso e raras na barriga
    const cel = celula(x * fCr, y * fCr, z * fCr, s);
    const dorso = suave(R * 0.2, R * 1.5, y);
    let c = mul(c1, 1 + 0.04 * fbm(x * 60 / L, y * 60 / L, z * 60 / L, s));
    c = mix(c, mix(c1, c2, 0.5), dorso * 0.55);
    c = mix(c, mul(c2, 0.8), (1 - suave(0.45, 0.7, cel)) * (0.35 + 0.65 * dorso));
    c = mix(c, mul(c2, 0.85), suave(0.35, 0.75, fbm(x * 14 / L, y * 14 / L, z * 14 / L, s + 2)) * dorso * 0.35);
    return mul(c, 1 + 0.04 * cintila(x, y, z, fCr * 3, s));
  };
  const Ym = R * 0.85;
  out.push(parte(corpo({
    x0: xm0, x1: xm1, n: 34, m: 24, cor: corPele, tampa: true,
    corTampa: (x, y, z) => mix(mul(c1, 0.92), [0.95, 0.93, 0.9], 0.3 + 0.1 * ruido(x * 500, y * 500, z * 500, s)),
    perfil: (t) => { const r = R * Math.sqrt(suave(0, 0.45, t)) * lerp(0.75, 1, t) * (1 + 0.06 * Math.sin(PI * t)); return { ry: r * 0.8, rz: r, cy: Ym }; },
    desloc: (p) => { if (p.y < Ym * 0.25) p.y = Ym * 0.25 - (Ym * 0.25 - p.y) * 0.4; },
  }), 'umido', true));
  // nadadeiras: losango largo na ponta do manto, deitado
  for (const sg of [-1, 1]) {
    out.push(parte(lamina({
      ns: 12, nr: 6,
      P: (sR, r) => {
        const x = xm0 + Lm * (0.03 + 0.4 * sR);
        const t = (x - xm0) / Lm;
        const rr = R * Math.sqrt(suave(0, 0.45, t)) * lerp(0.75, 1, t) * 0.85;
        const largo = R * 1.15 * Math.sin(PI * clamp(sR)) ** 0.7 * (0.55 + 0.45 * (1 - sR));
        return V(x - largo * 0.25 * r, Ym + R * 0.05 - R * 0.25 * r * r, sg * (rr + largo * r));
      },
      N: () => V(0, 1, 0),
      esp: (_s, r) => R * 0.12 * (1 - r) ** 1.2 + L * 0.0008,
      cor: (_s, _r, p) => corPele(p.x, Ym + R * 0.6, p.z, 0, 0),
    }), 'umido'));
  }
  // cabeça curta com olhos grandes
  const xc = xm1 + L * 0.055;
  out.push(parte(corpo({
    x0: xm1 - L * 0.025, x1: xc + L * 0.05, n: 16, m: 20, cor: corPele,
    perfil: (t) => { const r = R * (0.62 + 0.18 * Math.sin(PI * t)) * (1 - 0.25 * t); return { ry: r * 0.72, rz: r, cy: Ym * 0.78 }; },
    desloc: (p) => { if (p.y < Ym * 0.2) p.y = Ym * 0.2 - (Ym * 0.2 - p.y) * 0.4; },
  }), 'umido', true));
  for (const sg of [-1, 1]) {
    const pos = V(xc, Ym * 0.85, sg * R * 0.66);
    const g = olhoPeixe(R * 0.3, [0.35, 0.38, 0.42], mul(c2, 0.6), { pupila: 0.62 });
    out.push(parte(apontar(g, V(0, 0.45, sg).normalize(), pos), 'umido'));
  }
  // oito braços e dois tentáculos com clava, com volume e ventosas claras por baixo
  const x0b = xc + L * 0.04;
  for (let i = 0; i < 10; i++) {
    const tent = i >= 8;
    const sg = i % 2 ? 1 : -1;
    const ord = Math.floor(i / 2);
    const spread = tent ? 0.05 : (ord + 0.6) * 0.07;
    const len = tent ? L * 0.42 : L * lerp(0.2, 0.26, ord / 3);
    const p0 = V(x0b, Ym * 0.6, sg * R * (tent ? 0.15 : 0.12 + ord * 0.1));
    const curva = (k.r.f(-1, 1) * 0.08 + (tent ? 0.02 : 0.05)) * len;
    const pts = [
      p0,
      V(p0.x + len * 0.3, Ym * 0.35, p0.z + sg * spread * len * 0.3),
      V(p0.x + len * 0.62, Ym * 0.22, p0.z + sg * (spread * len * 0.62 + curva)),
      V(p0.x + len * 0.86, Ym * 0.17, p0.z + sg * (spread * len * 0.82 + curva * 1.8)),
      V(p0.x + len, Ym * 0.15, p0.z + sg * (spread * len * 0.9 + curva * 2.6)),
    ];
    const rb = R * (tent ? 0.13 : 0.27 - ord * 0.02);
    out.push(parte(tubo(pts, {
      raio: (t) => tent ? rb * (1 - 0.35 * t) * (1 + 0.9 * suave(0.72, 0.85, t) * suave(1, 0.93, t)) : rb * (1 - 0.85 * t ** 0.9) + L * 0.0012,
      m: 7, n: tent ? 22 : 16, achata: 0.8, cima: V(0, 1, 0),
      cor: (x, y, z, t, a) => {
        const c = corPele(x, y + R * 0.5, z, t, a);
        const ventosa = (1 - suave(0.25, 0.45, Math.abs(Math.sin(t * PI * 28)))) * suave(-0.3, -0.8, Math.cos(a)) * (tent ? suave(0.72, 0.8, t) : 1);
        return mix(c, [0.92, 0.88, 0.84], ventosa * 0.8);
      },
    }), 'umido'));
  }
  return out;
};

export { grao };
