// Geradores procedurais dos utensílios, por família. Tudo em metros e em
// tamanho real. Itens longos ficam com o comprimento em X e a ponta ativa em
// +X. Cada gerador devolve um THREE.Group com poucas malhas (uma por
// material) e com userData.pega e userData.ponta definidos.
import * as THREE from 'three';
import { COR, type ChaveMaterial } from './material';
import {
  Montador, type V3, PI,
  cilindro, cilX, cilZ, caixa, caixaR, esfera, cuia, torno, tornoX, anel, tubo,
  alcaLateral, placa, placaDeitada, retR, circulo, canelar, loftRet, fundoRet,
  lamina, pontos, arco, matriz,
} from './montador';

export type Gerador = () => THREE.Group;

const sm = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/* ================================================================== */
/* Peças reutilizáveis                                                 */
/* ================================================================== */

interface CaboCfg {
  x0: number; // ponta de trás (mais negativa)
  x1: number; // encontro com a cabeça
  y: number;
  alt: number; // altura total (Y)
  larg: number; // largura total (Z)
  mat?: ChaveMaterial;
  cor?: number;
  rebites?: number;
  furo?: boolean;
  perfil?: 'faca' | 'reto' | 'bojudo' | 'fino';
}

/** Cabo ao longo de X, de seção oval, com rebites e furo de pendurar opcionais. */
function cabo(m: Montador, c: CaboCfg): void {
  const L = c.x1 - c.x0;
  const perfis: Record<string, [number, number][]> = {
    faca: [[0, 0], [0.72, 0], [0.96, 0.05], [1, 0.22], [0.9, 0.58], [0.94, 0.9], [0.88, 1]],
    reto: [[0, 0], [0.8, 0], [1, 0.04], [1, 0.9], [0.85, 1]],
    bojudo: [[0, 0], [0.7, 0], [0.95, 0.08], [1, 0.4], [0.82, 0.8], [0.7, 1]],
    fino: [[0, 0], [0.9, 0], [1, 0.05], [0.8, 0.5], [0.6, 1]],
  };
  const p = perfis[c.perfil ?? 'faca'].map(([r, t]) => [r, c.x0 + t * L] as [number, number]);
  m.add(c.mat ?? 'petroleo', tornoX(p, 14), { p: [0, c.y, 0], s: [1, c.alt / 2, c.larg / 2], cor: c.cor ?? COR.marinho });
  const n = c.rebites ?? 0;
  for (let k = 0; k < n; k++) {
    const x = c.x0 + L * (n === 1 ? 0.5 : 0.18 + (0.62 * k) / (n - 1));
    m.add('inox', cilZ(0.0022, c.larg * 0.98 + 0.001, 10), { p: [x, c.y, 0] });
  }
  if (c.furo) {
    const x = c.x0 + L * 0.08;
    m.add('inoxEscuro', cilZ(0.0035, c.larg + 0.0008, 12), { p: [x, c.y, 0] });
  }
}

interface FacaCfg {
  nome: string;
  lb: number; // comprimento da lâmina
  h: number; // altura da lâmina no calcanhar
  lc: number; // comprimento do cabo
  hc?: number;
  tc?: number;
  esp?: number;
  fio: (u: number) => number;
  dorso: (u: number) => number;
  corCabo?: number;
  matCabo?: ChaveMaterial;
  rebites?: number;
  nx?: number;
  pontaU?: number;
  perfilCabo?: CaboCfg['perfil'];
  yCabo?: number;
  sem_bolster?: boolean;
  matLamina?: ChaveMaterial;
  chanfro?: number;
}

/** Faca genérica: lâmina afinando no fio, reforço de inox, cabo com rebites. */
function faca(c: FacaCfg, extra?: (m: Montador, yc: number) => void): THREE.Group {
  const m = new Montador();
  const hc = c.hc ?? Math.min(c.h * 0.6, 0.023);
  const tc = c.tc ?? 0.018;
  const yc = c.yCabo ?? Math.max(c.h - hc / 2 - 0.002, hc / 2);
  m.add(c.matLamina ?? 'inox', lamina({
    x0: 0, x1: c.lb, fio: c.fio, dorso: c.dorso, esp: c.esp ?? 0.0022, nx: c.nx ?? 28, chanfro: c.chanfro,
  }), { cor: COR.inoxClaro });
  if (!c.sem_bolster) {
    m.add('inox', caixaR(0.012, hc * 1.08, Math.max(tc * 0.7, 0.007), 0.003), { p: [-0.004, yc, 0] });
  }
  cabo(m, {
    x0: -c.lc, x1: c.sem_bolster ? 0.002 : -0.009, y: yc, alt: hc, larg: tc,
    mat: c.matCabo ?? 'petroleo', cor: c.corCabo ?? COR.marinho, rebites: c.rebites ?? 3, perfil: c.perfilCabo,
  });
  extra?.(m, yc);
  const u = c.pontaU ?? 0.55;
  return m.finalizar(c.nome, [-c.lc * 0.5, yc, 0], [c.lb * u, c.fio(u), 0]);
}

interface RecCfg {
  /** Perfil externo [raio, y] do centro do fundo até a boca. */
  fora: [number, number][];
  esp: number;
  matFora: ChaveMaterial;
  corFora: number;
  matDentro?: ChaveMaterial;
  corDentro?: number;
  seg?: number;
  borda?: { mat: ChaveMaterial; cor?: number; r?: number } | null;
  escala?: V3;
  p?: V3;
}

/** Recipiente de torno com parede de espessura, cor por dentro e borda. */
function recipiente(m: Montador, c: RecCfg): { rBoca: number; hBoca: number } {
  const seg = c.seg ?? 32;
  const s = c.escala ?? [1, 1, 1];
  const p = c.p ?? [0, 0, 0];
  m.add(c.matFora, torno(c.fora, seg), { cor: c.corFora, s, p });
  const dentro: [number, number][] = c.fora
    .slice()
    .reverse()
    .map(([r, y]) => [Math.max(r - c.esp, 0), Math.max(y, c.esp)] as [number, number]);
  m.add(c.matDentro ?? c.matFora, torno(dentro, seg), { cor: c.corDentro ?? c.corFora, s, p });
  const [rB, hB] = c.fora[c.fora.length - 1];
  if (c.borda !== null) {
    const b = c.borda ?? { mat: c.matFora };
    m.add(b.mat, anel(rB - c.esp / 2, b.r ?? c.esp * 0.75, seg, 6), {
      p: [p[0], p[1] + hB * s[1], p[2]], s: [s[0], 1, s[2]], cor: b.cor ?? c.corFora,
    });
  }
  return { rBoca: rB, hBoca: hB };
}

/** Perfil de panela de paredes retas com canto arredondado. */
function perfilReto(r: number, h: number, rc = 0.012, abertura = 0): [number, number][] {
  const pts: [number, number][] = [[0, 0], [r - rc, 0]];
  for (let k = 1; k <= 3; k++) {
    const a = -PI / 2 + (k / 3) * (PI / 2);
    pts.push([r - rc + Math.cos(a) * rc, rc + Math.sin(a) * rc]);
  }
  pts.push([r + abertura, h]);
  return pts;
}

/** Perfil de tigela arredondada (quarto de elipse) com pé. */
function perfilTigela(r: number, h: number, rPe: number): [number, number][] {
  const pts: [number, number][] = [[0, 0.002], [rPe, 0], [rPe + 0.002, 0.006]];
  for (let k = 1; k <= 7; k++) {
    const a = (k / 7) * (PI / 2);
    const rr = rPe + (r - rPe) * Math.sin(a);
    const yy = 0.006 + (h - 0.006) * (1 - Math.cos(a));
    pts.push([rr, yy]);
  }
  return pts;
}

interface TampaCfg {
  r: number;
  y: number;
  domo: number;
  mat: ChaveMaterial;
  cor: number;
  botao?: 'madeira' | 'inox' | 'alca';
  escala?: V3;
  p?: V3;
}

/** Tampa em domo com aba de inox e pegador. */
function tampa(m: Montador, c: TampaCfg): number {
  const s = c.escala ?? [1, 1, 1];
  const [px, , pz] = c.p ?? [0, 0, 0];
  const pts: [number, number][] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (PI / 2);
    pts.push([c.r * Math.cos(a), c.domo * Math.sin(a)]);
  }
  pts.reverse();
  m.add(c.mat, torno(pts, 32), { p: [px, c.y + 0.003, pz], s, cor: c.cor });
  m.add('inox', anel(c.r, 0.003, 32, 5), { p: [px, c.y + 0.003, pz], s: [s[0], 1, s[2]] });
  const yt = c.y + 0.003 + c.domo;
  if (c.botao === 'alca') {
    m.add('inox', tubo([[-0.03, yt - 0.002, 0], [-0.02, yt + 0.02, 0], [0.02, yt + 0.02, 0], [0.03, yt - 0.002, 0]], 0.004, 12, 6), { p: [px, 0, pz] });
  } else if (c.botao === 'inox') {
    m.add('inox', torno([[0.008, 0], [0.006, 0.008], [0.016, 0.014], [0.014, 0.02], [0, 0.021]], 16), { p: [px, yt - 0.002, pz] });
  } else {
    m.add('inox', cilindro(0.006, 0.006, 10), { p: [px, yt - 0.002, pz] });
    m.add('madeira', torno([[0.012, 0], [0.018, 0.006], [0.017, 0.016], [0, 0.019]], 16), { p: [px, yt + 0.003, pz], cor: COR.marinho });
  }
  return yt;
}

/** Cabo longo de panela: suporte de inox, rebites e empunhadura que sobe levemente. */
function caboPanela(m: Montador, xParede: number, y: number, comp: number, cor: number = COR.marinho, mat: ChaveMaterial = 'petroleo'): V3 {
  const inc = -0.16;
  const o = { p: [xParede, y, 0] as V3, r: [0, 0, inc] as V3 };
  m.add('inox', caixaR(0.05, 0.016, 0.022, 0.005), { ...o, p: [xParede - 0.012, y, 0] });
  m.add('inox', cilZ(0.003, 0.026, 8), { p: [xParede + 0.004, y + 0.004, 0] });
  m.add('inox', cilZ(0.003, 0.026, 8), { p: [xParede + 0.004, y - 0.004, 0] });
  const g = tornoX([[0.55, -comp], [0.9, -comp + 0.006], [1, -comp * 0.75], [0.85, -comp * 0.25], [0.8, -0.03], [0.85, -0.026]], 14);
  m.add(mat, g, { ...o, s: [1, 0.012, 0.016], cor });
  const fim = new THREE.Vector3(-comp + 0.012, 0, 0).applyMatrix4(matriz(o));
  m.add('inoxEscuro', cilindro(0.0045, 0.026, 12), { p: [fim.x, fim.y - 0.013, 0] });
  const meio = new THREE.Vector3(-comp * 0.5, 0, 0).applyMatrix4(matriz(o));
  return [meio.x, meio.y, 0];
}

/** Lista de posições em grade hexagonal dentro de um raio. */
function hexDentro(R: number, passo: number): [number, number][] {
  const out: [number, number][] = [];
  const nl = Math.ceil(R / passo) + 1;
  for (let i = -nl; i <= nl; i++) {
    for (let j = -nl; j <= nl; j++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * passo;
      const z = j * passo * 0.866;
      if (Math.hypot(x, z) <= R) out.push([x, z]);
    }
  }
  return out;
}

/** Desloca a boca de uma cuia unitária para formar um bico em +X. */
function biquinho(g: THREE.BufferGeometry, amp: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const f = Math.pow(Math.max(0, Math.cos(a)), 8) * Math.pow(Math.max(0, 1 + y), 4);
    pos.setXYZ(i, x + amp * f, y + amp * 0.35 * f, z);
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/* ================================================================== */
/* Facas                                                               */
/* ================================================================== */

const facaChef: Gerador = () =>
  faca({
    nome: 'faca_chef', lb: 0.205, h: 0.048, lc: 0.125, hc: 0.023, tc: 0.019,
    fio: (u) => 0.048 * 0.34 * Math.pow(u, 3),
    dorso: (u) => 0.048 * (1 - 0.66 * Math.pow(u, 2.2)),
  });

const facaLegumes: Gerador = () =>
  faca({
    nome: 'faca_legumes', lb: 0.09, h: 0.02, lc: 0.1, hc: 0.019, tc: 0.016, esp: 0.0016,
    fio: (u) => 0.02 * 0.3 * Math.pow(u, 3),
    dorso: (u) => 0.02 * (1 - 0.7 * Math.pow(u, 1.6)),
    corCabo: COR.madeira, matCabo: 'madeira', rebites: 2, yCabo: 0.011,
  });

const facaDesossar: Gerador = () =>
  faca({
    nome: 'faca_desossar', lb: 0.15, h: 0.026, lc: 0.12, hc: 0.022, tc: 0.018,
    fio: (u) => 0.026 * 0.6 * Math.pow(u, 1.7),
    dorso: (u) => 0.026 * (1 - 0.3 * Math.sin(u * PI * 0.6) - 0.1 * u),
    yCabo: 0.015,
  });

const facaFile: Gerador = () =>
  faca({
    nome: 'faca_file', lb: 0.2, h: 0.021, lc: 0.12, hc: 0.02, tc: 0.017, esp: 0.0013,
    fio: (u) => 0.021 * 0.42 * Math.pow(u, 2.2),
    dorso: (u) => 0.021 * (1 - 0.58 * Math.pow(u, 1.4)),
    corCabo: COR.madeira, matCabo: 'madeira', yCabo: 0.011,
  });

const facaPao: Gerador = () =>
  faca({
    nome: 'faca_pao', lb: 0.23, h: 0.03, lc: 0.12, hc: 0.022, tc: 0.018, nx: 120,
    fio: (u) => 0.0024 * Math.abs(Math.sin(u * PI * 36)) * (u < 0.96 ? 1 : 0) + 0.015 * Math.pow(sm((u - 0.86) / 0.14), 1.5),
    dorso: (u) => 0.03 - 0.015 * Math.pow(sm((u - 0.86) / 0.14), 1.5),
    corCabo: COR.madeira, matCabo: 'madeira', pontaU: 0.5,
  });

const cutelo: Gerador = () =>
  faca(
    {
      nome: 'cutelo', lb: 0.18, h: 0.088, lc: 0.12, hc: 0.026, tc: 0.021, esp: 0.004,
      fio: (u) => 0.006 * u * u, dorso: () => 0.088, corCabo: COR.madeira, matCabo: 'madeira',
      yCabo: 0.088 - 0.016, nx: 12, chanfro: 0.2,
    },
    (m) => {
      // furo de pendurar no canto do dorso
      m.add('inoxEscuro', new THREE.CircleGeometry(0.007, 14), { p: [0.155, 0.072, 0.0021] });
      m.add('inoxEscuro', new THREE.CircleGeometry(0.007, 14), { p: [0.155, 0.072, -0.0021], r: [0, PI, 0] });
    },
  );

const mezzaluna: Gerador = () => {
  const m = new Montador();
  const L = 0.24;
  const R = 0.2;
  const fio = (u: number) => {
    const x = (u - 0.5) * L;
    return R - Math.sqrt(R * R - x * x);
  };
  m.add('inox', lamina({ x0: -L / 2, x1: L / 2, fio, dorso: (u) => fio(u) + 0.045, esp: 0.0024, nx: 30 }), { cor: COR.inoxClaro });
  for (const s of [-1, 1]) {
    const x = (s * L) / 2 - s * 0.012;
    const y0 = fio(s < 0 ? 0.05 : 0.95) + 0.04;
    m.add('inox', cilindro(0.004, 0.03, 8), { p: [x, y0, 0] });
    m.add('madeira', torno([[0, 0], [0.012, 0.002], [0.016, 0.03], [0.014, 0.08], [0.01, 0.1], [0, 0.102]], 14), { p: [x, y0 + 0.025, 0] });
  }
  return m.finalizar('mezzaluna', [-L / 2 + 0.012, 0.12, 0], [0, 0, 0]);
};

const facaOstra: Gerador = () =>
  faca(
    {
      nome: 'faca_ostra', lb: 0.065, h: 0.022, lc: 0.1, hc: 0.03, tc: 0.026, esp: 0.004,
      fio: (u) => 0.011 * Math.pow(u, 1.3), dorso: (u) => 0.022 - 0.011 * Math.pow(u, 1.3),
      corCabo: COR.madeira, matCabo: 'madeira', rebites: 0, perfilCabo: 'bojudo', yCabo: 0.011, sem_bolster: true,
      pontaU: 1,
    },
    (m, yc) => {
      m.add('inox', torno([[0, 0], [0.022, 0.001], [0.022, 0.004], [0, 0.005]], 20).rotateZ(-PI / 2), { p: [-0.004, yc, 0], s: [1, 0.85, 1] });
    },
  );

const facaCanelle: Gerador = () => {
  const m = new Montador();
  cabo(m, { x0: -0.1, x1: 0, y: 0.011, alt: 0.022, larg: 0.02, mat: 'petroleo', cor: COR.marinho, rebites: 2 });
  const s = new THREE.Shape();
  s.absellipse(0.022, 0, 0.022, 0.012, 0, PI * 2, false, 0);
  s.holes.push(circulo(0.004, 0.026, 0.002));
  m.add('inox', placa(s, 0.003, 16), { p: [0, 0.011, 0], cor: COR.inoxClaro });
  m.add('inox', caixa(0.006, 0.004, 0.0035), { p: [0.03, 0.0045, 0], r: [0, 0, 0.6] });
  m.add('inox', caixa(0.012, 0.006, 0.006), { p: [0.003, 0.011, 0] });
  return m.finalizar('faca_canelle', [-0.05, 0.011, 0], [0.03, 0.003, 0]);
};

const descascador: Gerador = () => {
  const m = new Montador();
  const y = 0.01;
  cabo(m, { x0: -0.105, x1: 0, y, alt: 0.02, larg: 0.018, perfil: 'reto', rebites: 0, furo: true });
  for (let k = 0; k < 4; k++) m.add('silicone', anel(0.0095, 0.0012, 16, 4).rotateZ(PI / 2), { p: [-0.08 + k * 0.012, y, 0], s: [1, 1, 0.95], cor: COR.silicone });
  m.add('inox', tubo([[0, y, -0.007], [0.03, y, -0.013], [0.06, y, -0.012], [0.068, y, 0], [0.06, y, 0.012], [0.03, y, 0.013], [0, y, 0.007]], 0.0018, 30, 5));
  m.add('inox', caixa(0.052, 0.002, 0.014), { p: [0.033, y, 0], r: [0.5, 0, 0], cor: COR.inoxClaro });
  m.add('inoxEscuro', caixa(0.04, 0.0025, 0.002), { p: [0.033, y, 0], r: [0.5, 0, 0] });
  return m.finalizar('descascador', [-0.055, y, 0], [0.033, y, 0]);
};

const zester: Gerador = () => {
  const m = new Montador();
  const y = 0.011;
  cabo(m, { x0: -0.1, x1: 0, y, alt: 0.022, larg: 0.02, perfil: 'bojudo', rebites: 0 });
  const s = retR(0.03, 0.018, 0.004);
  m.add('inox', placa(s, 0.002), { p: [0.015, y, 0], r: [PI / 2, 0, 0], cor: COR.inoxClaro });
  m.add('inoxEscuro', caixa(0.003, 0.0024, 0.018), { p: [0.0295, y, 0] });
  for (let k = 0; k < 5; k++) m.add('inoxEscuro', new THREE.CircleGeometry(0.0013, 8).rotateX(-PI / 2), { p: [0.026, y + 0.0012, -0.006 + k * 0.003] });
  return m.finalizar('zester', [-0.05, y, 0], [0.03, y, 0]);
};

const escamador: Gerador = () => {
  const m = new Montador();
  const y = 0.012;
  cabo(m, { x0: -0.12, x1: 0, y, alt: 0.024, larg: 0.022, perfil: 'reto', rebites: 0, furo: true });
  m.add('inox', caixaR(0.07, 0.004, 0.04, 0.0015), { p: [0.035, 0.002, 0], cor: COR.inoxClaro });
  m.add('inox', caixa(0.012, 0.012, 0.012), { p: [0.003, 0.007, 0] });
  for (let k = 0; k < 6; k++) {
    m.add('inoxEscuro', caixa(0.003, 0.004, 0.034), { p: [0.018 + k * 0.009, 0.005, 0], r: [0, 0, 0.6] });
  }
  return m.finalizar('escamador', [-0.06, y, 0], [0.07, 0, 0]);
};

const descarocador: Gerador = () => {
  const m = new Montador();
  // duas hastes articuladas: uma com aro de apoio, outra com pino
  m.add('inox', tubo([[-0.11, 0.012, 0.012], [-0.05, 0.012, 0.009], [0.0, 0.012, 0.002], [0.03, 0.012, 0]], 0.0035, 16, 6));
  m.add('inox', tubo([[-0.11, 0.03, 0.012], [-0.05, 0.03, 0.009], [0.0, 0.026, 0.002], [0.03, 0.03, 0]], 0.0035, 16, 6));
  m.add('silicone', caixaR(0.05, 0.009, 0.012, 0.004), { p: [-0.09, 0.012, 0.011], cor: COR.marinho });
  m.add('silicone', caixaR(0.05, 0.009, 0.012, 0.004), { p: [-0.09, 0.03, 0.011], cor: COR.marinho });
  m.add('inox', cilZ(0.004, 0.012, 10), { p: [-0.005, 0.02, 0.003] });
  m.add('inox', anel(0.011, 0.002, 20, 5), { p: [0.04, 0.012, 0] });
  m.add('inox', cilindro(0.002, 0.016, 8), { p: [0.04, 0.016, 0] });
  m.add('inox', cilindro(0.004, 0.004, 10), { p: [0.04, 0.028, 0] });
  return m.finalizar('descarocador', [-0.09, 0.02, 0.011], [0.04, 0.012, 0]);
};

/* ================================================================== */
/* Tábuas                                                              */
/* ================================================================== */

const tabua: Gerador = () => {
  const m = new Montador();
  const w = 0.4;
  const d = 0.28;
  const h = 0.025;
  m.add('madeira', caixaR(w, h, d, 0.008, 2), { p: [0, h / 2, 0] });
  // canaleta de caldo sugerida por um filete mais escuro
  const gw = w - 0.03;
  const gd = d - 0.03;
  const e = 0.004;
  const y = h + 0.0002;
  m.add('madeira', fundoRet(gw, gd, 0.012, y), { cor: COR.madeiraEscura });
  m.add('madeira', fundoRet(gw - 2 * e, gd - 2 * e, 0.01, y + 0.0003));
  m.add('madeira', new THREE.CircleGeometry(0.008, 14).rotateX(-PI / 2), { p: [-w / 2 + 0.028, y + 0.0006, 0], cor: COR.madeiraEscura });
  m.add('cobalto', cilZ(0.004, 0.004, 8).rotateX(PI / 2).rotateZ(PI / 2), { p: [w / 2 - 0.004, h / 2, d / 2 - 0.03] });
  return m.finalizar('tabua', [-w / 2 + 0.02, h / 2, 0], [0, h, 0]);
};

const tabuaGiratoria: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', torno([[0, 0], [0.07, 0], [0.072, 0.006], [0.05, 0.012], [0.03, 0.02], [0.028, 0.07]], 28));
  m.add('inox', cilindro(0.03, 0.012, 24), { p: [0, 0.07, 0] });
  m.add('ceramica', cilindro(0.15, 0.01, 40), { p: [0, 0.082, 0] });
  m.add('ceramica', anel(0.15, 0.0025, 48, 5), { p: [0, 0.087, 0], cor: COR.filete });
  return m.finalizar('tabua_giratoria', [0.14, 0.087, 0], [0, 0.092, 0]);
};

/* ================================================================== */
/* Tigelas, potes e louça                                              */
/* ================================================================== */

const tigela: Gerador = () => {
  const m = new Montador();
  const { rBoca, hBoca } = recipiente(m, {
    fora: perfilTigela(0.12, 0.11, 0.05), esp: 0.004,
    matFora: 'cobalto', corFora: COR.cobalto, corDentro: COR.creme, borda: { mat: 'cobalto', cor: COR.creme },
  });
  m.add('cobalto', anel(0.051, 0.002, 28, 4), { p: [0, 0.002, 0], cor: COR.creme });
  return m.finalizar('tigela', [rBoca, hBoca, 0], [0, 0.03, 0]);
};

const tigelaMadeira: Gerador = () => {
  const m = new Montador();
  const { rBoca, hBoca } = recipiente(m, {
    fora: perfilReto(0.18, 0.08, 0.02, 0.008), esp: 0.008, matFora: 'madeira', corFora: COR.madeira, seg: 40,
  });
  for (const y of [0.018, 0.062]) m.add('inox', anel(0.18 + (y / 0.08) * 0.008 + 0.001, 0.0022, 48, 4), { p: [0, y, 0], cor: 0xb87a4b });
  return m.finalizar('tigela_madeira', [rBoca, hBoca, 0], [0, 0.02, 0]);
};

const ramequim: Gerador = () => {
  const m = new Montador();
  const fora = torno(perfilReto(0.046, 0.05, 0.006), 48);
  canelar(fora, 20, 0.035, 0.008, 0.046);
  m.add('ceramica', fora);
  m.add('ceramica', torno([[0.041, 0.05], [0.041, 0.008], [0.036, 0.005], [0, 0.005]], 32));
  m.add('ceramica', anel(0.0435, 0.0026, 40, 5), { p: [0, 0.05, 0] });
  m.add('ceramica', anel(0.0465, 0.0009, 40, 3), { p: [0, 0.043, 0], cor: COR.filete });
  return m.finalizar('ramequim', [0.046, 0.04, 0], [0, 0.006, 0]);
};

const pote: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: perfilReto(0.05, 0.13, 0.01), esp: 0.003, matFora: 'vidro', corFora: COR.vidro, borda: null });
  m.add('vidro', anel(0.05, 0.003, 28, 5), { p: [0, 0.122, 0] });
  m.add('silicone', anel(0.049, 0.002, 28, 4), { p: [0, 0.131, 0], cor: COR.marinho });
  // tampa hermética aberta para trás, presa pela dobradiça: vê-se o que está dentro do pote
  m.add('cobalto', torno([[0.053, -0.019], [0.053, -0.005], [0.048, -0.001], [0, 0]], 32), { p: [0, 0.131 + 0.019 * 0.3, -0.053], r: [-1.9, 0, 0] });
  m.add('inox', tubo([[-0.012, 0.128, -0.052], [-0.012, 0.136, -0.058], [0.012, 0.136, -0.058], [0.012, 0.128, -0.052]], 0.0012, 16, 4));
  // a ponta é o centro do fundo por dentro, onde vão as frutas e o líquido
  return m.finalizar('pote', [0.05, 0.07, 0], [0, 0.012, 0]);
};

const copo: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: perfilReto(0.034, 0.11, 0.004, 0.006), esp: 0.0025, matFora: 'vidro', corFora: COR.vidro, borda: { mat: 'vidro', r: 0.0015 } });
  m.add('vidro', cilindro(0.032, 0.008, 28), { cor: 0xc6e2f2 });
  return m.finalizar('copo', [0.035, 0.06, 0], [0.04, 0.11, 0]);
};

const taca: Gerador = () => {
  const m = new Montador();
  m.add('vidro', torno([[0, 0], [0.035, 0.001], [0.036, 0.003], [0.006, 0.006], [0.004, 0.09], [0.012, 0.1], [0.04, 0.13], [0.046, 0.18]], 28));
  m.add('vidro', torno([[0.044, 0.18], [0.038, 0.13], [0.01, 0.102], [0, 0.1]], 28));
  m.add('vidro', anel(0.045, 0.0012, 32, 4), { p: [0, 0.18, 0] });
  return m.finalizar('taca', [0, 0.05, 0], [0.046, 0.18, 0]);
};

const garrafa: Gerador = () => {
  const m = new Montador();
  m.add('vidro', torno([[0, 0], [0.036, 0], [0.038, 0.006], [0.038, 0.17], [0.03, 0.2], [0.014, 0.23], [0.013, 0.26]], 28));
  m.add('vidro', torno([[0.034, 0.17], [0.034, 0.008], [0, 0.006]], 24), { cor: 0xbfe0f0 });
  m.add('cobalto', cilindro(0.015, 0.02, 20), { p: [0, 0.255, 0] });
  for (let k = 0; k < 3; k++) m.add('cobalto', anel(0.0152, 0.0008, 20, 3), { p: [0, 0.26 + k * 0.005, 0], cor: COR.cobaltoClaro });
  return m.finalizar('garrafa', [0, 0.1, 0.038], [0, 0.275, 0]);
};

const pilao: Gerador = () => {
  const m = new Montador();
  recipiente(m, {
    fora: [[0, 0], [0.05, 0], [0.056, 0.01], [0.064, 0.05], [0.064, 0.085], [0.06, 0.09]], esp: 0.014,
    matFora: 'ceramica', corFora: COR.ceramica, corDentro: 0xe6e1d6,
  });
  m.add('ceramica', anel(0.0645, 0.0012, 40, 3), { p: [0, 0.07, 0], cor: COR.filete });
  // mão de pilão apoiada na borda
  const g = torno([[0, 0], [0.016, 0.004], [0.019, 0.02], [0.012, 0.07], [0.011, 0.13], [0.013, 0.15], [0, 0.152]], 18);
  m.add('ceramica', g, { p: [0.0, 0.02, 0], r: [0, 0, -0.55] });
  return m.finalizar('pilao', [0.075, 0.13, 0], [0, 0.016, 0]);
};

const pesosTorta: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: perfilReto(0.06, 0.05, 0.008), esp: 0.004, matFora: 'cobalto', corFora: COR.cobalto, corDentro: COR.creme });
  const g = esfera(0.0055, 6, 4);
  let n = 0;
  for (const [x, z] of hexDentro(0.05, 0.0115)) {
    const y = 0.042 + 0.004 * Math.cos(x * 60) * Math.cos(z * 50);
    m.add('ceramica', g.clone(), { p: [x, y, z], cor: n++ % 3 ? 0xe9e3d6 : COR.barro });
  }
  return m.finalizar('pesos_torta', [0.06, 0.03, 0], [0, 0.048, 0]);
};

function pratoBase(nome: string, r: number, h: number): THREE.Group {
  const m = new Montador();
  m.add('ceramica', torno([[0, 0.003], [r * 0.42, 0], [r * 0.45, 0.004], [r * 0.62, 0.006], [r * 0.85, h * 0.7], [r, h]], 48));
  m.add('ceramica', torno([[r - 0.002, h + 0.002], [r * 0.84, h * 0.75 + 0.003], [r * 0.62, 0.009], [0, 0.009]], 48));
  m.add('ceramica', anel(r - 0.001, 0.0015, 56, 4), { p: [0, h + 0.001, 0] });
  m.add('ceramica', anel(r * 0.9, 0.0008, 56, 3), { p: [0, h * 0.86 + 0.002, 0], cor: COR.filete });
  return m.finalizar(nome, [r, h, 0], [0, 0.01, 0]);
}

const prato: Gerador = () => pratoBase('prato', 0.135, 0.024);
const pires: Gerador = () => pratoBase('pires', 0.072, 0.016);

const travessa: Gerador = () => {
  const m = new Montador();
  const s: V3 = [1, 1, 0.66];
  recipiente(m, {
    fora: perfilReto(0.16, 0.05, 0.015, 0.012), esp: 0.006, matFora: 'ceramica', corFora: COR.ceramica,
    escala: s, seg: 40,
  });
  m.add('ceramica', anel(0.168, 0.0012, 48, 3), { p: [0, 0.042, 0], s: [1, 1, 0.66], cor: COR.filete });
  for (const sx of [-1, 1]) {
    const e = new THREE.Shape();
    e.absellipse(0, 0, 0.03, 0.04, 0, PI * 2, false, 0);
    m.add('ceramica', placaDeitada(e, 0.007), { p: [sx * 0.18, 0.043, 0] });
  }
  return m.finalizar('travessa', [0.19, 0.05, 0], [0, 0.01, 0]);
};

const travessaVidro: Gerador = () => {
  const m = new Montador();
  const w = 0.3;
  const d = 0.2;
  m.add('vidro', loftRet(w, d, 0.025, [[-0.006, 0], [0, 0.006], [0.01, 0.06], [0.012, 0.063], [0.006, 0.06], [-0.004, 0.009], [-0.012, 0.006]], 5));
  m.add('vidro', fundoRet(w - 0.012, d - 0.012, 0.022, 0.0005));
  m.add('vidro', fundoRet(w - 0.024, d - 0.024, 0.016, 0.006));
  for (const sx of [-1, 1]) m.add('vidro', caixaR(0.03, 0.006, 0.1, 0.003), { p: [sx * (w / 2 + 0.02), 0.058, 0] });
  return m.finalizar('travessa_vidro', [w / 2 + 0.025, 0.058, 0], [0, 0.007, 0]);
};

/* ================================================================== */
/* Panelas                                                             */
/* ================================================================== */

interface PanelaCfg {
  nome: string;
  r: number;
  h: number;
  mat?: ChaveMaterial;
  cor?: number;
  dentro?: { mat: ChaveMaterial; cor: number };
  cabo?: number; // comprimento do cabo longo
  alcas?: boolean;
  tampa?: boolean;
  fundo?: boolean;
  esp?: number;
}

function panelaBase(m: Montador, c: PanelaCfg): { pega: V3; ponta: V3; topo: number } {
  const mat = c.mat ?? 'cobalto';
  const cor = c.cor ?? COR.cobalto;
  const esp = c.esp ?? 0.004;
  recipiente(m, {
    fora: perfilReto(c.r, c.h, 0.016), esp, matFora: mat, corFora: cor,
    matDentro: c.dentro?.mat ?? mat, corDentro: c.dentro?.cor ?? COR.creme,
    borda: { mat: 'inox', r: esp * 0.7 }, seg: 32,
  });
  if (c.fundo) m.add('inox', cilindro(c.r - 0.014, 0.005, 36), { p: [0, -0.004, 0] });
  let pega: V3 = [c.r, c.h * 0.8, 0];
  if (c.alcas) {
    for (const a of [0, PI]) m.add('inox', alcaLateral(0.026, 0.0045, c.r - 0.004, c.h * 0.82, a));
    pega = [c.r + 0.02, c.h * 0.82, 0];
  }
  if (c.cabo) pega = caboPanela(m, -c.r + 0.002, c.h * 0.82, c.cabo);
  let topo = c.h;
  if (c.tampa) topo = tampa(m, { r: c.r + 0.002, y: c.h, domo: c.r * 0.22, mat, cor });
  return { pega, ponta: [0, esp + 0.002, 0], topo };
}

function panela(c: PanelaCfg): THREE.Group {
  const m = new Montador();
  const { pega, ponta } = panelaBase(m, c);
  return m.finalizar(c.nome, pega, ponta);
}

const panelaMedia: Gerador = () => panela({ nome: 'panela', r: 0.11, h: 0.12, cabo: 0.18, tampa: false });
const cacarola: Gerador = () => panela({ nome: 'cacarola', r: 0.12, h: 0.09, alcas: true, tampa: false, mat: 'petroleo', cor: COR.petroleo });
const panelaFunda: Gerador = () => panela({ nome: 'panela_funda', r: 0.13, h: 0.24, alcas: true, tampa: false, mat: 'petroleo', cor: COR.petroleo, dentro: { mat: 'inox', cor: COR.inox }, fundo: true });
const panelaPesada: Gerador = () => panela({ nome: 'panela_pesada', r: 0.12, h: 0.13, alcas: true, tampa: false, esp: 0.007, fundo: true });

const panelaVapor: Gerador = () => {
  const m = new Montador();
  panelaBase(m, { nome: '', r: 0.11, h: 0.12, alcas: true, mat: 'cobalto', dentro: { mat: 'inox', cor: COR.inox } });
  // cesto perfurado encaixado acima da água
  recipiente(m, { fora: perfilReto(0.106, 0.1, 0.012), esp: 0.002, matFora: 'inox', corFora: COR.inoxClaro, p: [0, 0.06, 0], borda: { mat: 'inox', r: 0.003 } });
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * 2 * PI;
    m.add('inoxEscuro', new THREE.CircleGeometry(0.0028, 6).rotateY(PI / 2 - a), { p: [Math.cos(a) * 0.1066, 0.13, Math.sin(a) * 0.1066] });
  }
  for (const [x, z] of hexDentro(0.08, 0.025)) m.add('inoxEscuro', new THREE.CircleGeometry(0.003, 6).rotateX(-PI / 2), { p: [x, 0.0625, z] });
  tampa(m, { r: 0.11, y: 0.16, domo: 0.03, mat: 'vidro', cor: COR.vidro, botao: 'inox' });
  for (const a of [PI / 2, -PI / 2]) m.add('inox', alcaLateral(0.018, 0.0028, 0.104, 0.15, a));
  return m.finalizar('panela_vapor', [0.13, 0.1, 0], [0, 0.065, 0]);
};

const panelaPeixe: Gerador = () => {
  const m = new Montador();
  const w = 0.5;
  const d = 0.17;
  const h = 0.12;
  const rc = 0.07;
  m.add('cobalto', loftRet(w, d, rc, [[-0.01, 0], [0, 0.01], [0, h]], 6));
  m.add('cobalto', fundoRet(w - 0.02, d - 0.02, rc - 0.01, 0));
  m.add('cobalto', loftRet(w, d, rc, [[-0.004, h], [-0.004, 0.01], [-0.012, 0.004]], 6), { cor: COR.creme });
  m.add('cobalto', fundoRet(w - 0.024, d - 0.024, rc - 0.012, 0.004), { cor: COR.creme });
  m.add('inox', loftRet(w, d, rc, [[-0.004, h], [-0.002, h + 0.003], [0.001, h]], 6));
  // grade furada com alças
  m.add('inox', fundoRet(w - 0.03, d - 0.03, rc - 0.015, 0.02));
  for (let k = -8; k <= 8; k++) m.add('inoxEscuro', caixa(0.004, 0.0005, d * 0.55), { p: [k * 0.026, 0.0205, 0] });
  for (const sx of [-1, 1]) {
    m.add('inox', tubo([[sx * 0.2, 0.02, -0.03], [sx * 0.2, h + 0.01, -0.03], [sx * 0.2, h + 0.01, 0.03], [sx * 0.2, 0.02, 0.03]], 0.0022, 16, 4));
    m.add('inox', alcaLateral(0.025, 0.004, w / 2 - 0.004, h * 0.8, sx > 0 ? 0 : PI));
  }
  tampa(m, { r: 0.25, y: h, domo: 0.035, mat: 'cobalto', cor: COR.cobalto, escala: [1, 1, d / w], botao: 'alca' });
  return m.finalizar('panela_peixe', [w / 2 + 0.02, h * 0.8, 0], [0, 0.022, 0]);
};

const banhoMaria: Gerador = () => {
  const m = new Montador();
  panelaBase(m, { nome: '', r: 0.1, h: 0.11, cabo: 0.17, mat: 'petroleo', cor: COR.petroleo, dentro: { mat: 'inox', cor: COR.inox } });
  // tigela de inox apoiada na boca da panela
  recipiente(m, { fora: perfilTigela(0.12, 0.09, 0.04), esp: 0.002, matFora: 'inox', corFora: COR.inoxClaro, p: [0, 0.07, 0], borda: { mat: 'inox', r: 0.0025 } });
  return m.finalizar('banho_maria', [0.12, 0.16, 0], [0, 0.074, 0]);
};

const chaleira: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', torno([[0, 0], [0.085, 0], [0.095, 0.01], [0.1, 0.05], [0.09, 0.12], [0.06, 0.16], [0.045, 0.165]], 36));
  m.add('inox', anel(0.047, 0.004, 32, 5), { p: [0, 0.165, 0] });
  tampa(m, { r: 0.045, y: 0.165, domo: 0.012, mat: 'cobalto', cor: COR.cobalto });
  m.add('cobalto', tubo([[0.08, 0.05, 0], [0.12, 0.09, 0], [0.145, 0.14, 0], [0.16, 0.15, 0]], 0.009, 16, 10));
  m.add('inox', tubo([[-0.06, 0.15, 0], [-0.05, 0.24, 0], [0.05, 0.24, 0], [0.06, 0.15, 0]], 0.004, 20, 6), { r: [0, PI / 2, 0] });
  m.add('petroleo', tubo([[0, 0.24, -0.035], [0, 0.247, 0], [0, 0.24, 0.035]], 0.009, 12, 10), { cor: COR.marinho });
  return m.finalizar('chaleira', [0, 0.245, 0], [0.16, 0.15, 0]);
};

const panelaFondue: Gerador = () => {
  const m = new Montador();
  // réchaud de inox com três pés
  m.add('inox', anel(0.09, 0.004, 36, 5), { p: [0, 0.09, 0] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * 2 * PI + PI / 6;
    m.add('inox', tubo([[Math.cos(a) * 0.09, 0.09, Math.sin(a) * 0.09], [Math.cos(a) * 0.11, 0.04, Math.sin(a) * 0.11], [Math.cos(a) * 0.115, 0.003, Math.sin(a) * 0.115]], 0.004, 10, 5));
    m.add('silicone', esfera(0.006, 8, 6), { p: [Math.cos(a) * 0.115, 0.004, Math.sin(a) * 0.115], cor: COR.marinho });
  }
  m.add('inoxEscuro', cilindro(0.03, 0.03, 20), { p: [0, 0.03, 0] });
  m.add('inox', anel(0.032, 0.002, 20, 4), { p: [0, 0.06, 0] });
  // panela pesada esmaltada
  recipiente(m, { fora: perfilTigela(0.09, 0.08, 0.05), esp: 0.006, matFora: 'cobalto', corFora: COR.cobalto, corDentro: COR.creme, p: [0, 0.09, 0], borda: { mat: 'cobalto', cor: COR.creme } });
  caboPanela(m, -0.088, 0.16, 0.12);
  // dois garfos de fondue apoiados na borda
  for (const z of [-0.02, 0.02]) {
    const o = { p: [0.0, 0.17, z] as V3, r: [0, z * 8, 0.7] as V3 };
    m.add('inox', cilX(0.0015, 0.2, 6), o);
    m.add('petroleo', cilX(0.004, 0.06, 8), { ...o, cor: z > 0 ? COR.cobaltoClaro : COR.petroleoClaro });
  }
  return m.finalizar('panela_fondue', [-0.17, 0.16, 0], [0, 0.1, 0]);
};

const tagine: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: [[0, 0], [0.11, 0], [0.13, 0.01], [0.15, 0.045]], esp: 0.006, matFora: 'ceramica', corFora: COR.cobalto, corDentro: COR.creme });
  m.add('ceramica', anel(0.152, 0.003, 48, 4), { p: [0, 0.045, 0], cor: COR.ceramica });
  m.add('ceramica', torno([[0.135, 0.046], [0.12, 0.07], [0.08, 0.12], [0.04, 0.19], [0.018, 0.24], [0.016, 0.255], [0.026, 0.262], [0.02, 0.275], [0, 0.278]], 40), { cor: COR.cobalto });
  m.add('ceramica', anel(0.1, 0.0016, 40, 3), { p: [0, 0.112, 0], cor: COR.ceramica });
  m.add('ceramica', anel(0.055, 0.0014, 32, 3), { p: [0, 0.172, 0], cor: COR.ceramica });
  return m.finalizar('tagine', [0, 0.27, 0], [0, 0.008, 0]);
};

const cuscuzeira: Gerador = () => {
  const m = new Montador();
  panelaBase(m, { nome: '', r: 0.1, h: 0.13, alcas: true, mat: 'cobalto', dentro: { mat: 'inox', cor: COR.inox } });
  // parte de cima, com fundo furado
  recipiente(m, { fora: perfilReto(0.1, 0.12, 0.012), esp: 0.003, matFora: 'cobalto', corFora: COR.cobaltoClaro, corDentro: COR.creme, p: [0, 0.125, 0], borda: { mat: 'inox', r: 0.003 } });
  for (const [x, z] of hexDentro(0.075, 0.02)) m.add('inoxEscuro', new THREE.CircleGeometry(0.0025, 6).rotateX(-PI / 2), { p: [x, 0.129, z] });
  for (const a of [PI / 2, -PI / 2]) m.add('inox', alcaLateral(0.022, 0.0035, 0.097, 0.225, a));
  tampa(m, { r: 0.102, y: 0.245, domo: 0.03, mat: 'cobalto', cor: COR.cobalto });
  return m.finalizar('cuscuzeira', [0.12, 0.11, 0], [0, 0.13, 0]);
};

/* ================================================================== */
/* Frigideiras, wok e chapas                                           */
/* ================================================================== */

interface FrigCfg {
  nome: string;
  r: number;
  h: number;
  abertura: number;
  mat: ChaveMaterial;
  cor: number;
  corDentro: number;
  matDentro: ChaveMaterial;
  cabo: number;
  corCabo?: number;
  matCabo?: ChaveMaterial;
  ajudante?: boolean;
}

function frigideira(c: FrigCfg): THREE.Group {
  const m = new Montador();
  recipiente(m, {
    fora: perfilReto(c.r - c.abertura, c.h, 0.02, c.abertura), esp: 0.004, matFora: c.mat, corFora: c.cor,
    matDentro: c.matDentro, corDentro: c.corDentro, borda: { mat: 'inox', r: 0.0028 }, seg: 40,
  });
  m.add('inox', cilindro(c.r - c.abertura - 0.02, 0.003, 36), { p: [0, -0.002, 0] });
  const pega = caboPanela(m, -c.r + 0.004, c.h * 0.75, c.cabo, c.corCabo ?? COR.marinho, c.matCabo ?? 'petroleo');
  if (c.ajudante) m.add('inox', alcaLateral(0.024, 0.0045, c.r - 0.004, c.h * 0.8, 0));
  return m.finalizar(c.nome, pega, [0, 0.006, 0]);
}

const frigideiraAnti: Gerador = () =>
  frigideira({ nome: 'frigideira', r: 0.13, h: 0.048, abertura: 0.025, mat: 'cobalto', cor: COR.cobalto, matDentro: 'inoxEscuro', corDentro: COR.antiaderente, cabo: 0.2 });

const frigideiraFerro: Gerador = () =>
  frigideira({ nome: 'frigideira_ferro', r: 0.1, h: 0.045, abertura: 0.018, mat: 'inoxEscuro', cor: COR.ferro, matDentro: 'inoxEscuro', corDentro: COR.ferro, cabo: 0.16, corCabo: COR.madeira, matCabo: 'madeira', ajudante: true });

const sauteuse: Gerador = () =>
  frigideira({ nome: 'sauteuse', r: 0.12, h: 0.07, abertura: 0.004, mat: 'petroleo', cor: COR.petroleo, matDentro: 'inox', corDentro: COR.inox, cabo: 0.2, ajudante: true });

const crepeira: Gerador = () =>
  frigideira({ nome: 'crepeira', r: 0.12, h: 0.014, abertura: 0.01, mat: 'inoxEscuro', cor: COR.ferro, matDentro: 'inoxEscuro', corDentro: COR.antiaderente, cabo: 0.2, corCabo: COR.madeira, matCabo: 'madeira' });

const omeleteira: Gerador = () => {
  const m = new Montador();
  const w = 0.18;
  const d = 0.13;
  const h = 0.035;
  m.add('inoxEscuro', loftRet(w, d, 0.01, [[-0.006, 0], [0, 0.006], [0.002, h]], 3), { cor: COR.ferro });
  m.add('inoxEscuro', fundoRet(w - 0.012, d - 0.012, 0.006, 0), { cor: COR.ferro });
  m.add('inoxEscuro', loftRet(w, d, 0.01, [[-0.001, h], [-0.003, 0.007], [-0.009, 0.004]], 3), { cor: COR.antiaderente });
  m.add('inoxEscuro', fundoRet(w - 0.018, d - 0.018, 0.004, 0.004), { cor: COR.antiaderente });
  m.add('inox', loftRet(w, d, 0.01, [[-0.001, h], [0.0005, h + 0.002], [0.003, h]], 3));
  const o = { p: [-w / 2, h * 0.7, 0] as V3, r: [0, 0, -0.25] as V3 };
  m.add('inox', cilX(0.005, 0.05, 8).translate(-0.05, 0, 0), o);
  m.add('madeira', tornoX([[0.5, -0.2], [1, -0.19], [1, -0.06], [0.8, -0.045]], 12), { ...o, s: [1, 0.013, 0.013] });
  return m.finalizar('omeleteira', [-w / 2 - 0.12, h + 0.03, 0], [0, 0.005, 0]);
};

const wok: Gerador = () => {
  const m = new Montador();
  const R = 0.175;
  const fora: [number, number][] = [];
  for (let k = 0; k <= 9; k++) {
    const a = (k / 9) * 1.05;
    fora.push([Math.sin(a) * 0.2, 0.2 - Math.cos(a) * 0.2]);
  }
  const rB = fora[fora.length - 1][0];
  const hB = fora[fora.length - 1][1];
  recipiente(m, { fora, esp: 0.003, matFora: 'inoxEscuro', corFora: COR.ferro, matDentro: 'inoxEscuro', corDentro: 0x3a3634, borda: { mat: 'inox', r: 0.003 }, seg: 40 });
  void R;
  const pega = caboPanela(m, -rB + 0.004, hB * 0.85, 0.22, COR.madeira, 'madeira');
  m.add('petroleo', tubo([[rB - 0.01, hB * 0.85, -0.03], [rB + 0.03, hB * 0.88, -0.02], [rB + 0.03, hB * 0.88, 0.02], [rB - 0.01, hB * 0.85, 0.03]], 0.006, 12, 8), { cor: COR.marinho });
  return m.finalizar('wok', pega, [0, 0.005, 0]);
};

const chapa: Gerador = () => {
  const m = new Montador();
  const w = 0.42;
  const d = 0.24;
  m.add('inoxEscuro', caixaR(w, 0.012, d, 0.004), { p: [0, 0.006, 0], cor: COR.ferro });
  for (let k = 0; k < 11; k++) m.add('inoxEscuro', caixaR(0.006, 0.006, d - 0.03, 0.002), { p: [-w / 2 + 0.035 + k * 0.035, 0.014, 0], cor: 0x343a42 });
  m.add('inoxEscuro', loftRet(w, d, 0.006, [[0, 0.012], [0, 0.02], [-0.004, 0.02]], 2), { cor: COR.ferro });
  for (const sx of [-1, 1]) m.add('inoxEscuro', alcaLateral(0.035, 0.006, w / 2 - 0.006, 0.01, sx > 0 ? 0 : PI), { cor: COR.ferro });
  return m.finalizar('chapa', [w / 2 + 0.03, 0.01, 0], [0, 0.017, 0]);
};

const grelha: Gerador = () => {
  const m = new Montador();
  const w = 0.4;
  const d = 0.3;
  const y = 0.02;
  m.add('inox', tubo([[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]], 0.004, 4, 6, true).scale(1, 1, 1));
  for (let k = 0; k < 16; k++) m.add('inox', cilX(0.0028, w, 6), { p: [-w / 2, y, -d / 2 + 0.015 + k * ((d - 0.03) / 15)] });
  for (const sx of [-1, 1]) m.add('petroleo', tubo([[sx * w / 2, y, -0.05], [sx * (w / 2 + 0.06), y + 0.005, -0.03], [sx * (w / 2 + 0.06), y + 0.005, 0.03], [sx * w / 2, y, 0.05]], 0.006, 14, 8), { cor: COR.marinho });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.add('inox', cilindro(0.003, y, 6), { p: [sx * (w / 2 - 0.01), 0, sz * (d / 2 - 0.01)] });
  return m.finalizar('grelha', [w / 2 + 0.05, y, 0], [0, y + 0.003, 0]);
};

const grade: Gerador = () => {
  const m = new Montador();
  const w = 0.4;
  const d = 0.26;
  const y = 0.018;
  m.add('inox', tubo([[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]], 0.0025, 4, 5, true));
  for (let k = 0; k < 24; k++) m.add('inox', cilX(0.0012, w, 4), { p: [-w / 2, y + 0.002, -d / 2 + 0.01 + k * ((d - 0.02) / 23)] });
  for (let k = 0; k < 3; k++) m.add('inox', cilZ(0.0018, d, 5), { p: [-w / 2 + 0.05 + k * ((w - 0.1) / 2), y - 0.001, 0] });
  for (const sx of [-1, 1]) {
    m.add('inox', tubo([[sx * (w / 2 - 0.02), y, -d / 2], [sx * (w / 2 - 0.02), 0.001, -d / 2 + 0.01], [sx * (w / 2 - 0.02), 0.001, d / 2 - 0.01], [sx * (w / 2 - 0.02), y, d / 2]], 0.002, 16, 5));
  }
  return m.finalizar('grade', [w / 2, y, 0], [0, y + 0.003, 0]);
};

const suportePeixe: Gerador = () => {
  const m = new Montador();
  const w = 0.32;
  const d = 0.14;
  for (const y of [0.004, 0.03]) {
    m.add('inox', tubo([[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]], 0.0025, 4, 5, true));
    for (let k = 0; k < 9; k++) m.add('inox', cilZ(0.0015, d, 4), { p: [-w / 2 + 0.02 + k * ((w - 0.04) / 8), y, 0] });
  }
  m.add('inox', tubo([[w / 2, 0.004, 0], [w / 2 + 0.03, 0.017, 0], [w / 2, 0.03, 0]], 0.003, 8, 5));
  m.add('inox', cilX(0.004, 0.12, 8), { p: [-w / 2 - 0.12, 0.017, 0] });
  cabo(m, { x0: -w / 2 - 0.3, x1: -w / 2 - 0.1, y: 0.017, alt: 0.024, larg: 0.024, mat: 'madeira', cor: COR.madeira, perfil: 'reto', furo: true });
  return m.finalizar('suporte_peixe', [-w / 2 - 0.2, 0.017, 0], [0, 0.017, 0]);
};

/* ================================================================== */
/* Assadeiras e fôrmas                                                 */
/* ================================================================== */

interface BandejaCfg {
  w: number;
  d: number;
  h: number;
  rc: number;
  abre: number;
  mat: ChaveMaterial;
  cor: number;
  corDentro: number;
  matDentro?: ChaveMaterial;
  esp?: number;
  y?: number;
}

/** Bandeja retangular aberta (assadeira, fôrma de pão, terrina) com borda enrolada de inox. */
function bandeja(m: Montador, c: BandejaCfg): void {
  const esp = c.esp ?? 0.003;
  const y = c.y ?? 0;
  const t = (g: THREE.BufferGeometry) => g.translate(0, y, 0);
  m.add(c.mat, t(loftRet(c.w, c.d, c.rc, [[-0.004, 0], [0, 0.004], [c.abre, c.h]], 4)), { cor: c.cor });
  m.add(c.mat, t(fundoRet(c.w - 0.008, c.d - 0.008, Math.max(c.rc - 0.004, 0.001), 0)), { cor: c.cor });
  m.add(c.matDentro ?? c.mat, t(loftRet(c.w, c.d, c.rc, [[c.abre - esp, c.h], [-esp, 0.004 + esp], [-esp - 0.004, esp]], 4)), { cor: c.corDentro });
  m.add(c.matDentro ?? c.mat, t(fundoRet(c.w - 2 * (esp + 0.004), c.d - 2 * (esp + 0.004), Math.max(c.rc - esp - 0.004, 0.001), esp)), { cor: c.corDentro });
  m.add('inox', t(loftRet(c.w, c.d, c.rc, [[c.abre - esp, c.h], [c.abre - esp / 2, c.h + 0.0025], [c.abre + 0.002, c.h]], 4)));
}

const assadeira: Gerador = () => {
  const m = new Montador();
  const w = 0.4;
  bandeja(m, { w, d: 0.28, h: 0.045, rc: 0.02, abre: 0.008, mat: 'petroleo', cor: COR.petroleo, corDentro: COR.creme });
  for (const a of [0, PI]) m.add('inox', alcaLateral(0.03, 0.004, w / 2 + 0.004, 0.04, a));
  return m.finalizar('assadeira', [w / 2 + 0.03, 0.04, 0], [0, 0.004, 0]);
};

const formaQuadrada: Gerador = () => {
  const m = new Montador();
  bandeja(m, { w: 0.23, d: 0.23, h: 0.05, rc: 0.012, abre: 0.003, mat: 'cobalto', cor: COR.cobalto, corDentro: COR.inoxClaro, matDentro: 'inox' });
  return m.finalizar('forma_quadrada', [0.117, 0.05, 0], [0, 0.004, 0]);
};

const formaPao: Gerador = () => {
  const m = new Montador();
  bandeja(m, { w: 0.26, d: 0.12, h: 0.075, rc: 0.012, abre: 0.012, mat: 'cobalto', cor: COR.cobalto, corDentro: COR.inoxClaro, matDentro: 'inox' });
  return m.finalizar('forma_pao', [0.142, 0.075, 0], [0, 0.004, 0]);
};

const terrina: Gerador = () => {
  const m = new Montador();
  const w = 0.3;
  const d = 0.11;
  const h = 0.09;
  bandeja(m, { w, d, h, rc: 0.014, abre: 0.004, mat: 'petroleo', cor: COR.petroleo, corDentro: COR.creme, esp: 0.006 });
  for (const sx of [-1, 1]) m.add('petroleo', caixaR(0.03, 0.012, 0.07, 0.005), { p: [sx * (w / 2 + 0.012), h - 0.01, 0] });
  // tampa com furo de vapor e pegador
  m.add('petroleo', caixaR(w + 0.012, 0.012, d + 0.016, 0.005), { p: [0, h + 0.008, 0] });
  m.add('inoxEscuro', new THREE.CircleGeometry(0.004, 10).rotateX(-PI / 2), { p: [w * 0.3, h + 0.0142, 0] });
  m.add('petroleo', caixaR(0.07, 0.016, 0.022, 0.007), { p: [0, h + 0.02, 0], cor: COR.petroleoClaro });
  return m.finalizar('terrina', [w / 2 + 0.02, h - 0.01, 0], [0, 0.007, 0]);
};

/** Fôrma redonda de torno com parede e fundo, por fora esmaltada e por dentro inox. */
function formaRedonda(nome: string, fora: [number, number][], esp: number, cor: number = COR.cobalto, mat: ChaveMaterial = 'cobalto', caneluras = 0, amp = 0): THREE.Group {
  const m = new Montador();
  const gF = torno(fora, caneluras ? 64 : 40);
  const dentro: [number, number][] = fora.slice().reverse().map(([r, y]) => [Math.max(r - esp, 0), Math.max(y, esp)] as [number, number]);
  const gD = torno(dentro, caneluras ? 64 : 40);
  if (caneluras) {
    canelar(gF, caneluras, amp, esp * 0.5);
    canelar(gD, caneluras, amp, esp * 1.5);
  }
  m.add(mat, gF, { cor });
  m.add('inox', gD, { cor: COR.inoxClaro });
  const [rB, hB] = fora[fora.length - 1];
  if (!caneluras) m.add('inox', anel(rB - esp / 2, esp * 0.8, 48, 5), { p: [0, hB, 0] });
  return m.finalizar(nome, [rB, hB, 0], [0, esp + 0.001, 0]);
}

// fôrmas de bolo em alumínio, para não se confundirem com a tigela azul
const formaBolo: Gerador = () => formaRedonda('forma_bolo', perfilReto(0.11, 0.06, 0.006), 0.002, 0x8e979f, 'inox');
const timbale: Gerador = () => formaRedonda('timbale', [[0, 0], [0.024, 0], [0.026, 0.003], [0.032, 0.07]], 0.0012, COR.inox, 'inox');
const charlotte: Gerador = () => {
  const g = formaRedonda('charlotte', [[0, 0], [0.07, 0], [0.073, 0.004], [0.087, 0.1]], 0.0015, 0x8e979f, 'inox');
  return g;
};
const forminha: Gerador = () => formaRedonda('forminha', [[0, 0], [0.024, 0], [0.026, 0.002], [0.036, 0.02]], 0.0008, COR.inox, 'inox', 18, 0.05);
const formaBrioche: Gerador = () => formaRedonda('forma_brioche', [[0, 0], [0.042, 0], [0.047, 0.005], [0.07, 0.035], [0.088, 0.07]], 0.0015, COR.cobalto, 'cobalto', 12, 0.08);

const forminhaPapel: Gerador = () => {
  const m = new Montador();
  const g = torno([[0, 0], [0.021, 0], [0.022, 0.002], [0.028, 0.03]], 64);
  canelar(g, 28, 0.06, 0.001, 1, true);
  m.add('madeira', g, { cor: 0xcfe3f6 });
  m.add('madeira', new THREE.CircleGeometry(0.021, 20).rotateX(-PI / 2), { p: [0, 0.0006, 0], cor: 0xbcd6f0 });
  return m.finalizar('forminha_papel', [0.028, 0.03, 0], [0, 0.001, 0]);
};

const aro: Gerador = () => {
  const m = new Montador();
  m.add('inox', cilindro(0.115, 0.06, 64, 0.115, true), { cor: COR.inoxClaro });
  m.add('inox', anel(0.1155, 0.002, 64, 5), { p: [0, 0.06, 0] });
  return m.finalizar('aro', [0.115, 0.06, 0], [0.115, 0.0, 0]);
};

const cortador: Gerador = () => {
  const m = new Montador();
  const g = cilindro(0.035, 0.025, 48, 0.035, true);
  canelar(g, 14, 0.05);
  m.add('inox', g, { cor: COR.inoxClaro });
  m.add('inox', anel(0.0355, 0.0018, 48, 5), { p: [0, 0.025, 0] });
  return m.finalizar('cortador', [0, 0.026, 0.035], [0.035, 0, 0]);
};

const formaDesmontavel: Gerador = () => {
  const m = new Montador();
  const r = 0.12;
  const h = 0.07;
  m.add('inox', cilindro(r + 0.008, 0.003, 56));
  m.add('inox', cilindro(r, h, 56, r, true), { p: [0, 0.002, 0], cor: 0x8e979f });
  m.add('inox', cilindro(r - 0.0015, h - 0.001, 56, r - 0.0015, true), { p: [0, 0.003, 0], cor: COR.inoxClaro });
  m.add('inox', anel(r - 0.0007, 0.0025, 56, 5), { p: [0, h + 0.002, 0] });
  m.add('inox', anel(r + 0.0015, 0.002, 56, 4), { p: [0, 0.008, 0] });
  // fecho de mola
  m.add('inox', caixaR(0.012, 0.05, 0.03, 0.003), { p: [r + 0.006, 0.036, 0] });
  m.add('inox', caixaR(0.006, 0.045, 0.012, 0.002), { p: [r + 0.013, 0.036, 0], r: [0, 0, 0.12], cor: COR.inoxClaro });
  return m.finalizar('forma_desmontavel', [r + 0.012, 0.04, 0], [0, 0.004, 0]);
};

const formaTorta: Gerador = () => {
  const m = new Montador();
  const fora = torno([[0.118, 0], [0.12, 0.002], [0.13, 0.03]], 72);
  canelar(fora, 30, 0.025);
  m.add('petroleo', fora);
  const dentro = torno([[0.128, 0.03], [0.118, 0.003], [0.116, 0.002]], 72);
  canelar(dentro, 30, 0.025);
  m.add('inox', dentro, { cor: COR.inoxClaro });
  // fundo removível com a frestinha à vista
  m.add('inox', cilindro(0.114, 0.002, 48));
  m.add('inoxEscuro', anel(0.115, 0.0008, 48, 3), { p: [0, 0.002, 0] });
  m.add('inox', cilindro(0.118, 0.0015, 48), { p: [0, -0.0015, 0] });
  return m.finalizar('forma_torta', [0.13, 0.03, 0], [0, 0.003, 0]);
};

const formaFuro: Gerador = () => {
  const m = new Montador();
  const fora = torno([[0, 0.11], [0.034, 0.11], [0.036, 0.004], [0.05, 0], [0.105, 0], [0.12, 0.1]], 64);
  canelar(fora, 12, 0.06, 0.004, 0.104);
  m.add('cobalto', fora);
  const dentro = torno([[0.116, 0.1], [0.102, 0.004], [0.052, 0.003], [0.038, 0.11]], 64);
  canelar(dentro, 12, 0.06, 0.004, 0.104);
  m.add('inox', dentro, { cor: COR.inoxClaro });
  m.add('inox', anel(0.118, 0.0025, 64, 5), { p: [0, 0.1, 0] });
  m.add('inox', anel(0.036, 0.002, 32, 5), { p: [0, 0.11, 0] });
  return m.finalizar('forma_furo', [0.12, 0.1, 0], [0.075, 0.004, 0]);
};

const formaMuffin: Gerador = () => {
  const m = new Montador();
  const w = 0.3;
  const d = 0.2;
  const h = 0.032;
  const s = retR(w, d, 0.015);
  const furos: [number, number][] = [];
  for (const x of [-0.09, 0, 0.09]) for (const z of [-0.048, 0.048]) furos.push([x, z]);
  for (const [x, z] of furos) s.holes.push(circulo(0.035, x, z));
  m.add('petroleo', placaDeitada(s, 0.0025, 16), { p: [0, h, 0] });
  m.add('inox', loftRet(w, d, 0.015, [[0, h], [0.002, h + 0.004], [0.004, h]], 4));
  for (const [x, z] of furos) {
    m.add('petroleo', torno([[0, 0], [0.024, 0], [0.026, 0.003], [0.035, h]], 28), { p: [x, 0, z] });
    m.add('petroleo', torno([[0.0335, h + 0.0026], [0.0245, 0.004], [0, 0.003]], 28), { p: [x, 0, z], cor: COR.creme });
  }
  return m.finalizar('forma_muffin', [w / 2, h, 0], [0, 0.004, 0]);
};

const formaPizza: Gerador = () => {
  const m = new Montador();
  m.add('inox', torno([[0, 0], [0.152, 0], [0.16, 0.009], [0.162, 0.01]], 56));
  m.add('inox', torno([[0.159, 0.01], [0.15, 0.002], [0, 0.002]], 56), { cor: COR.inoxClaro });
  for (const [x, z] of hexDentro(0.13, 0.022)) m.add('inoxEscuro', new THREE.CircleGeometry(0.0035, 6).rotateX(-PI / 2), { p: [x, 0.0026, z] });
  return m.finalizar('forma_pizza', [0.16, 0.01, 0], [0, 0.003, 0]);
};

const formaGelo: Gerador = () => {
  const m = new Montador();
  m.add('silicone', caixaR(0.22, 0.03, 0.11, 0.006), { p: [0, 0.015, 0] });
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 2; j++) {
      m.add('silicone', caixa(0.025, 0.002, 0.04), { p: [-0.09 + i * 0.03, 0.0296, -0.024 + j * 0.048], cor: COR.siliconeEscuro });
    }
  }
  return m.finalizar('forma_gelo', [0.11, 0.015, 0], [0, 0.03, 0]);
};

const formaRavioli: Gerador = () => {
  const m = new Montador();
  m.add('inox', caixaR(0.3, 0.012, 0.12, 0.003), { p: [0, 0.006, 0] });
  for (let i = 0; i < 6; i++) {
    for (const z of [-0.028, 0.028]) {
      const x = -0.125 + i * 0.05;
      m.add('inoxEscuro', new THREE.CircleGeometry(0.019, 16).rotateX(-PI / 2), { p: [x, 0.0122, z] });
      const g = anel(0.021, 0.0012, 24, 3);
      canelar(g, 16, 0.06);
      m.add('inox', g, { p: [x, 0.0122, z], cor: COR.inoxClaro });
    }
  }
  m.add('madeira', cilX(0.012, 0.1, 16), { p: [-0.05, 0.012, 0.085] });
  m.add('madeira', cilX(0.004, 0.18, 8), { p: [-0.09, 0.012, 0.085], cor: COR.marinho });
  return m.finalizar('forma_ravioli', [-0.13, 0.012, 0.085], [0, 0.012, 0]);
};

const formaPastel: Gerador = () => {
  const m = new Montador();
  const meia = new THREE.Shape();
  meia.absarc(0, 0, 0.06, 0, PI, false);
  meia.lineTo(0.06, 0);
  for (const [sz, dz, rx] of [[-1, -0.002, 0], [1, 0.002, PI]] as [number, number, number][]) {
    const g = placaDeitada(meia, 0.006, 20);
    m.add('silicone', g, { p: [0, 0, dz], r: [0, rx, 0], cor: COR.silicone });
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * PI;
      m.add('silicone', caixa(0.004, 0.004, 0.004), { p: [Math.cos(a) * 0.058 * (rx ? -1 : 1), 0.008, sz * Math.sin(a) * 0.058 + dz], r: [0, a, 0], cor: COR.siliconeEscuro });
    }
    m.add('silicone', caixaR(0.03, 0.006, 0.03, 0.004), { p: [0, 0.003, sz * 0.07 + dz], cor: COR.siliconeEscuro });
  }
  m.add('inox', cilX(0.003, 0.13, 8), { p: [-0.065, 0.003, 0] });
  return m.finalizar('forma_pastel', [0, 0.004, 0.08], [0, 0.007, 0]);
};

const ninho: Gerador = () => {
  const m = new Montador();
  const c: V3 = [0.06, 0.06, 0];
  for (const [R, cor] of [[0.06, COR.inox], [0.048, COR.inoxClaro]] as [number, number][]) {
    for (let k = 0; k < 4; k++) {
      const phi = (k / 4) * PI;
      const pts: V3[] = [];
      for (let i = -6; i <= 6; i++) {
        const t = (i / 6) * (PI / 2);
        pts.push([c[0] + Math.sin(t) * Math.cos(phi) * R, c[1] - Math.cos(t) * R, Math.sin(t) * Math.sin(phi) * R]);
      }
      m.add('inox', tubo(pts, 0.0012, 24, 4), { cor });
    }
    m.add('inox', anel(R, 0.0018, 32, 4), { p: c, cor });
    m.add('inox', anel(R * 0.7, 0.0012, 28, 4), { p: [c[0], c[1] - R * 0.7, 0], cor });
  }
  for (const z of [-0.006, 0.006]) m.add('inox', tubo([[0.0, 0.06, z], [-0.1, 0.07, z], [-0.2, 0.075, z]], 0.0025, 10, 5));
  cabo(m, { x0: -0.32, x1: -0.19, y: 0.075, alt: 0.026, larg: 0.03, mat: 'madeira', cor: COR.madeira, perfil: 'reto' });
  return m.finalizar('ninho', [-0.25, 0.075, 0], [0.06, 0.002, 0]);
};

const cone: Gerador = () => {
  const m = new Montador();
  m.add('inox', torno([[0.1, 0], [0.004, 0.4], [0, 0.401]], 48), { cor: COR.inoxClaro });
  m.add('inox', anel(0.1, 0.003, 48, 5), { p: [0, 0.002, 0] });
  return m.finalizar('cone', [0.05, 0.2, 0], [0, 0.4, 0]);
};

const funil: Gerador = () => {
  const m = new Montador();
  m.add('inox', torno([[0.007, 0], [0.008, 0.05], [0.06, 0.105], [0.062, 0.11]], 32), { cor: COR.inoxClaro });
  m.add('inox', anel(0.062, 0.002, 32, 4), { p: [0, 0.11, 0] });
  m.add('inox', alcaLateral(0.012, 0.002, 0.06, 0.1, 0));
  return m.finalizar('funil', [0.07, 0.1, 0], [0, 0, 0]);
};

const funilTorta: Gerador = () => {
  const m = new Montador();
  m.add('ceramica', torno([[0.024, 0], [0.026, 0.008], [0.018, 0.04], [0.014, 0.065], [0.016, 0.075], [0.009, 0.088]], 24));
  m.add('ceramica', torno([[0.007, 0.088], [0.012, 0.06], [0.018, 0.004]], 20));
  m.add('ceramica', anel(0.022, 0.0012, 24, 3), { p: [0, 0.022, 0], cor: COR.filete });
  m.add('ceramica', esfera(0.0025, 6, 4), { p: [0.014, 0.07, 0.004], cor: COR.filete });
  return m.finalizar('funil_torta', [0.026, 0.03, 0], [0, 0.088, 0]);
};

/* ================================================================== */
/* Peneiras, coadores e cestos                                         */
/* ================================================================== */

/** Malha de peneira: cuia translúcida cinza com alguns arames de inox por cima. */
function malha(m: Montador, R: number, prof: number, y: number, x = 0): void {
  m.add('vidro', cuia(28, 10), { p: [x, y, 0], s: [R, prof, R], cor: 0x8b97a3 });
  for (let k = 0; k < 4; k++) {
    const phi = (k / 4) * PI;
    const pts: V3[] = [];
    for (let i = -8; i <= 8; i++) {
      const t = (i / 8) * (PI / 2);
      pts.push([x + Math.sin(t) * Math.cos(phi) * R, y - Math.cos(t) * prof, Math.sin(t) * Math.sin(phi) * R]);
    }
    m.add('inox', tubo(pts, 0.0007, 24, 3));
  }
  for (const t of [0.5, 1.0]) m.add('inox', anel(Math.sin(t) * R, 0.0007, 32, 3), { p: [x, y - Math.cos(t) * prof, 0] });
}

const peneira: Gerador = () => {
  const m = new Montador();
  const R = 0.1;
  const prof = 0.07;
  malha(m, R, prof, prof);
  m.add('inox', anel(R, 0.004, 48, 6), { p: [0, prof, 0] });
  for (const z of [-0.004, 0.004]) m.add('inox', tubo([[-R + 0.004, prof, z], [-R - 0.05, prof + 0.008, z * 1.5], [-R - 0.1, prof + 0.012, z * 2]], 0.0022, 10, 5));
  cabo(m, { x0: -R - 0.24, x1: -R - 0.09, y: prof + 0.012, alt: 0.022, larg: 0.026, perfil: 'reto', furo: true });
  m.add('inox', tubo([[R - 0.004, prof, 0], [R + 0.025, prof + 0.004, 0], [R + 0.03, prof - 0.008, 0]], 0.0022, 10, 5));
  return m.finalizar('peneira', [-R - 0.165, prof + 0.012, 0], [0, 0.002, 0]);
};

const chinois: Gerador = () => {
  const m = new Montador();
  const R = 0.09;
  const H = 0.2;
  m.add('vidro', torno([[0.002, 0], [R, H]], 32), { cor: 0x8b97a3 });
  m.add('inox', torno([[R - 0.006, H - 0.015], [R, H]], 32), { cor: COR.inox });
  m.add('inox', anel(R, 0.003, 40, 5), { p: [0, H, 0] });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * PI;
    m.add('inox', tubo([[0, 0, 0], [Math.cos(a) * R * 0.5, H * 0.5, Math.sin(a) * R * 0.5], [Math.cos(a) * R, H, Math.sin(a) * R]], 0.0007, 8, 3));
  }
  m.add('inox', cilindro(0.004, 0.006, 8), { p: [0, -0.002, 0] });
  m.add('inox', tubo([[-R + 0.002, H, 0], [-R - 0.06, H + 0.01, 0], [-R - 0.1, H + 0.015, 0]], 0.003, 8, 5));
  cabo(m, { x0: -R - 0.25, x1: -R - 0.09, y: H + 0.015, alt: 0.022, larg: 0.024, perfil: 'reto', furo: true });
  m.add('inox', tubo([[R - 0.002, H, 0], [R + 0.03, H + 0.004, 0], [R + 0.035, H - 0.01, 0]], 0.0025, 10, 5));
  return m.finalizar('chinois', [-R - 0.17, H + 0.015, 0], [0, 0.004, 0]);
};

const escorredor: Gerador = () => {
  const m = new Montador();
  const R = 0.13;
  const h = 0.11;
  const rPe = 0.07;
  recipiente(m, { fora: perfilTigela(R, h, rPe), esp: 0.003, matFora: 'cobalto', corFora: COR.cobalto, corDentro: COR.creme, p: [0, 0.02, 0], borda: { mat: 'inox', r: 0.003 } });
  m.add('cobalto', torno([[0.06, 0], [0.058, 0.022]], 32, ), { cor: COR.cobalto });
  m.add('cobalto', anel(0.06, 0.0025, 32, 4), { p: [0, 0.002, 0] });
  for (const a of [0.45, 0.75, 1.05]) {
    const r = rPe + (R - rPe) * Math.sin(a) + 0.0006;
    const y = 0.02 + 0.006 + (h - 0.006) * (1 - Math.cos(a));
    const n = Math.round(r * 190);
    for (let k = 0; k < n; k++) {
      const b = ((k + (a > 0.7 && a < 0.8 ? 0.5 : 0)) / n) * 2 * PI;
      m.add('ceramica', new THREE.CircleGeometry(0.0032, 6).rotateY(PI / 2 - b), { p: [Math.cos(b) * r, y, Math.sin(b) * r], cor: COR.creme });
    }
  }
  for (const [x, z] of hexDentro(0.05, 0.016)) m.add('ceramica', new THREE.CircleGeometry(0.003, 6).rotateX(-PI / 2), { p: [x, 0.0255, z], cor: COR.ceramica });
  for (const a of [0, PI]) m.add('inox', alcaLateral(0.028, 0.0045, R - 0.004, 0.02 + h * 0.85, a));
  return m.finalizar('escorredor', [R + 0.02, 0.02 + h * 0.85, 0], [0, 0.026, 0]);
};

const coadorPano: Gerador = () => {
  const m = new Montador();
  const R = 0.07;
  const H = 0.2;
  const g = torno([[0, 0], [0.012, 0.012], [0.035, 0.07], [0.058, 0.15], [R, H]], 40);
  canelar(g, 7, 0.06, 0.02, H - 0.01);
  m.add('madeira', g, { cor: COR.tecido });
  m.add('madeira', anel(R + 0.001, 0.0035, 40, 4), { p: [0, H - 0.008, 0], cor: COR.tecidoAzul });
  m.add('inox', anel(R + 0.002, 0.0025, 40, 5), { p: [0, H, 0] });
  m.add('inox', cilX(0.003, 0.06, 8), { p: [-R - 0.06, H, 0] });
  cabo(m, { x0: -R - 0.2, x1: -R - 0.05, y: H, alt: 0.024, larg: 0.024, mat: 'madeira', cor: COR.madeira, perfil: 'reto' });
  return m.finalizar('coador_pano', [-R - 0.12, H, 0], [0, 0, 0]);
};

const cestaFritura: Gerador = () => {
  const m = new Montador();
  const R = 0.09;
  const H = 0.09;
  m.add('vidro', cilindro(R, H, 32, R, true), { cor: 0x8b97a3 });
  m.add('vidro', new THREE.CircleGeometry(R, 32).rotateX(-PI / 2), { p: [0, 0.001, 0], cor: 0x8b97a3 });
  for (const y of [0.001, H * 0.5, H]) m.add('inox', anel(R, y === H ? 0.003 : 0.0015, 40, 4), { p: [0, y, 0] });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * 2 * PI;
    m.add('inox', cilindro(0.001, H, 4), { p: [Math.cos(a) * R, 0, Math.sin(a) * R] });
  }
  m.add('inox', tubo([[-R, H, 0], [-R - 0.08, H + 0.03, 0], [-R - 0.16, H + 0.05, 0]], 0.0035, 10, 6));
  cabo(m, { x0: -R - 0.32, x1: -R - 0.15, y: H + 0.05, alt: 0.026, larg: 0.026, perfil: 'reto', furo: true });
  m.add('inox', tubo([[R, H, 0], [R + 0.03, H, 0], [R + 0.03, H - 0.02, 0]], 0.0025, 8, 5));
  return m.finalizar('cesta_fritura', [-R - 0.24, H + 0.05, 0], [0, 0.002, 0]);
};

const centrifuga: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: perfilTigela(0.13, 0.14, 0.08), esp: 0.003, matFora: 'cobalto', corFora: COR.cobalto, corDentro: COR.creme });
  m.add('vidro', torno([[0.124, 0.142], [0.1, 0.152], [0.04, 0.16], [0, 0.161]], 40));
  m.add('cobalto', torno([[0.03, 0.155], [0.032, 0.17], [0, 0.172]], 24), { cor: COR.cobaltoClaro });
  m.add('inox', caixaR(0.08, 0.008, 0.016, 0.003), { p: [0.04, 0.176, 0] });
  m.add('madeira', cilindro(0.008, 0.03, 12), { p: [0.075, 0.18, 0], cor: COR.marinho });
  return m.finalizar('centrifuga', [0.075, 0.2, 0], [0, 0.01, 0]);
};

const cestaBambu: Gerador = () => {
  const m = new Montador();
  const R = 0.12;
  const h = 0.065;
  for (const y0 of [0, h]) {
    m.add('madeira', cilindro(R, h, 40, R, true), { p: [0, y0, 0], cor: COR.bambu });
    for (const y of [0.006, h - 0.006]) m.add('madeira', anel(R + 0.0015, 0.003, 40, 4), { p: [0, y0 + y, 0], cor: 0xc4a95f });
    for (let k = -6; k <= 6; k++) m.add('madeira', caixa(0.008, 0.003, 2 * Math.sqrt(R * R - Math.pow(k * 0.017, 2))), { p: [k * 0.017, y0 + 0.012, 0], cor: 0xc9b06a });
  }
  const pts: [number, number][] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (PI / 2);
    pts.push([(R + 0.004) * Math.cos(a), 0.035 * Math.sin(a)]);
  }
  pts.reverse();
  m.add('madeira', torno(pts, 40), { p: [0, 2 * h, 0], cor: COR.bambu });
  for (let k = 1; k <= 5; k++) {
    const a = (k / 6) * (PI / 2);
    m.add('madeira', anel((R + 0.004) * Math.cos(a), 0.0016, 36, 3), { p: [0, 2 * h + 0.035 * Math.sin(a), 0], cor: 0xbba05a });
  }
  m.add('madeira', anel(R + 0.005, 0.003, 40, 4), { p: [0, 2 * h, 0], cor: 0xc4a95f });
  m.add('madeira', tubo([[-0.02, 2 * h + 0.034, 0], [0, 2 * h + 0.05, 0], [0.02, 2 * h + 0.034, 0]], 0.003, 10, 4), { cor: 0xc4a95f });
  return m.finalizar('cesta_bambu', [R, h, 0], [0, 0.014, 0]);
};

/* ================================================================== */
/* Batedor, colheres, conchas e espátulas                              */
/* ================================================================== */

const batedor: Gerador = () => {
  const m = new Montador();
  const L = 0.175;
  const y = 0.037;
  cabo(m, { x0: -0.125, x1: -0.004, y, alt: 0.024, larg: 0.024, perfil: 'reto', furo: true });
  m.add('inox', cilX(0.0085, 0.022, 14, 0.007), { p: [-0.008, y, 0] });
  const raio = (s: number) => 0.007 * (1 - s) + 0.029 * Math.sin(PI * Math.pow(s, 1.5));
  const N = 5;
  for (let k = 0; k < N; k++) {
    const phi = (k / N) * PI;
    const pts: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      const r = raio(s);
      pts.push([0.012 + s * L, y + r * Math.cos(phi), r * Math.sin(phi)]);
    }
    for (let i = 11; i >= 0; i--) {
      const s = i / 12;
      const r = raio(s);
      pts.push([0.012 + s * L, y - r * Math.cos(phi), -r * Math.sin(phi)]);
    }
    m.add('inox', tubo(pts, 0.0011, 44, 4), { cor: COR.inoxClaro });
  }
  return m.finalizar('batedor', [-0.065, y, 0], [0.012 + L * 0.7, y - raio(0.7), 0]);
};

interface ColherCfg {
  nome: string;
  a: number; // meio comprimento da cuia
  b: number; // meia largura
  prof: number;
  lc: number;
  mat: ChaveMaterial;
  cor?: number;
  caboAlt: number;
  caboLarg: number;
  matCabo?: ChaveMaterial;
  corCabo?: number;
  grossa?: boolean;
}

function colherBase(c: ColherCfg): THREE.Group {
  const m = new Montador();
  const cx = c.a;
  const y = c.prof;
  m.add(c.mat, cuia(20, 8), { p: [cx, y, 0], s: [c.a, c.prof, c.b], cor: c.cor });
  if (c.grossa) {
    m.add(c.mat, cuia(20, 8), { p: [cx, y, 0], s: [c.a * 0.9, c.prof * 0.8, c.b * 0.87], cor: c.cor });
    m.add(c.mat, new THREE.RingGeometry(0.88, 1, 24, 1).rotateX(-PI / 2), { p: [cx, y, 0], s: [c.a, 1, c.b], cor: c.cor });
  }
  const perfil: [number, number][] = [[0, -c.lc], [0.7, -c.lc + 0.002], [1, -c.lc + 0.012], [1, -c.lc * 0.55], [0.6, -0.012], [0.75, 0.004]];
  m.add(c.matCabo ?? c.mat, tornoX(perfil, 12), { p: [0, y, 0], s: [1, c.caboAlt / 2, c.caboLarg / 2], r: [0, 0, -0.04], cor: c.corCabo ?? c.cor });
  return m.finalizar(c.nome, [-c.lc * 0.6, y + 0.01, 0], [2 * c.a, y * 0.6, 0]);
}

const colherPau: Gerador = () =>
  colherBase({ nome: 'colher_pau', a: 0.036, b: 0.026, prof: 0.012, lc: 0.25, mat: 'madeira', caboAlt: 0.014, caboLarg: 0.018, grossa: true });

const colher: Gerador = () =>
  colherBase({ nome: 'colher', a: 0.032, b: 0.022, prof: 0.011, lc: 0.18, mat: 'inox', cor: COR.inoxClaro, caboAlt: 0.004, caboLarg: 0.022 });

const concha: Gerador = () => {
  const m = new Montador();
  const R = 0.045;
  const P = 0.04;
  const bowl = biquinho(cuia(28, 10), 0.28);
  m.add('inox', bowl, { p: [0, P, 0], s: [R, P, R], cor: COR.inoxClaro });
  m.add('inox', anel(R, 0.0016, 40, 4), { p: [0, P, 0] });
  m.add('inox', tubo([[-R + 0.002, P, 0], [-R - 0.03, P + 0.05, 0], [-R - 0.12, P + 0.09, 0], [-R - 0.22, P + 0.11, 0]], 0.004, 24, 6).scale(1, 1, 1.6));
  cabo(m, { x0: -R - 0.32, x1: -R - 0.2, y: P + 0.112, alt: 0.014, larg: 0.022, perfil: 'reto', furo: true });
  return m.finalizar('concha', [-R - 0.26, P + 0.11, 0], [R + 0.012, P + 0.004, 0]);
};

const escumadeira: Gerador = () => {
  const m = new Montador();
  const R = 0.06;
  const P = 0.012;
  m.add('inox', cuia(28, 6), { p: [0, P, 0], s: [R, P, R], cor: COR.inoxClaro });
  m.add('inox', anel(R, 0.0018, 40, 4), { p: [0, P, 0] });
  for (const [x, z] of hexDentro(R * 0.8, 0.012)) {
    const rho = Math.hypot(x, z) / R;
    const yy = P - P * Math.sqrt(Math.max(0, 1 - rho * rho)) + 0.0005;
    m.add('inoxEscuro', new THREE.CircleGeometry(0.0028, 6).rotateX(-PI / 2), { p: [x, yy, z] });
  }
  m.add('inox', tubo([[-R + 0.002, P, 0], [-R - 0.03, P + 0.03, 0], [-R - 0.14, P + 0.06, 0], [-R - 0.22, P + 0.07, 0]], 0.0035, 20, 6).scale(1, 1, 1.6));
  cabo(m, { x0: -R - 0.33, x1: -R - 0.21, y: P + 0.071, alt: 0.014, larg: 0.022, perfil: 'reto', furo: true });
  return m.finalizar('escumadeira', [-R - 0.27, P + 0.07, 0], [0, 0.002, 0]);
};

const colheresMedida: Gerador = () => {
  const m = new Montador();
  const raios = [0.021, 0.017, 0.013, 0.01];
  const centro: V3 = [-0.1, 0.004, 0];
  m.add('inox', anel(0.014, 0.0015, 20, 4), { p: centro });
  raios.forEach((r, k) => {
    const ang = -0.36 + k * 0.24;
    const giro = matriz({ p: centro, r: [0, ang, 0] });
    const comp = 0.08;
    const local = (g: THREE.BufferGeometry, o: { p: V3; s?: V3 }) => g.applyMatrix4(matriz({ p: o.p, s: o.s })).applyMatrix4(giro);
    m.add('inox', local(caixaR(comp, 0.003, 0.012, 0.0014), { p: [0.012 + comp / 2, 0.0035, 0] }), { cor: COR.inoxClaro });
    m.add('cobalto', local(caixaR(0.03, 0.0008, 0.007, 0.0003), { p: [0.04, 0.0055, 0] }), { cor: k % 2 ? COR.cobalto : COR.petroleo });
    m.add('inox', local(cuia(16, 6), { p: [0.012 + comp + r, r * 0.65, 0], s: [r, r * 0.65, r] }), { cor: COR.inoxClaro });
    m.add('inox', local(anel(r, 0.001, 20, 3), { p: [0.012 + comp + r, r * 0.65, 0] }));
  });
  const p0 = new THREE.Vector3(0.012 + 0.08 + raios[0], 0.004, 0).applyMatrix4(matriz({ p: centro, r: [0, -0.36, 0] }));
  return m.finalizar('colheres_medida', [-0.07, 0.006, 0], [p0.x, p0.y, p0.z]);
};

interface EspatulaCfg {
  nome: string;
  forma: THREE.Shape; // no plano XY, com +X para frente; vira lâmina deitada
  esp: number;
  mat: ChaveMaterial;
  cor?: number;
  degrau?: number; // queda do pescoço (espátula em ângulo)
  lc: number;
  corCabo?: number;
  matCabo?: ChaveMaterial;
  rebites?: number;
  ponta: V3;
}

function espatulaBase(c: EspatulaCfg): THREE.Group {
  const m = new Montador();
  const yc = 0.012;
  const yl = c.degrau ? yc - c.degrau : yc;
  const x0 = c.degrau ? 0.03 : 0.0;
  m.add(c.mat, placaDeitada(c.forma, c.esp, 12), { p: [x0, yl - c.esp / 2, 0], cor: c.cor });
  if (c.degrau) {
    const dx = 0.03;
    const ang = Math.atan2(c.degrau, dx);
    m.add('inox', caixa(Math.hypot(dx, c.degrau) + 0.004, 0.0018, 0.012), { p: [dx / 2, yc - c.degrau / 2, 0], r: [0, 0, -ang] });
  }
  m.add('inox', cilX(0.007, 0.014, 12, 0.006), { p: [-0.012, yc, 0] });
  cabo(m, { x0: -c.lc, x1: -0.01, y: yc, alt: 0.02, larg: 0.02, mat: c.matCabo ?? 'madeira', cor: c.corCabo ?? COR.madeira, rebites: c.rebites ?? 2, perfil: 'faca' });
  const pt: V3 = [c.ponta[0] + x0, yl, c.ponta[2]];
  return m.finalizar(c.nome, [-c.lc * 0.5, yc, 0], pt);
}

function laminaRetaShape(L: number, W: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -W * 0.3);
  s.lineTo(0.02, -W / 2);
  s.lineTo(L - W / 2, -W / 2);
  s.absarc(L - W / 2, 0, W / 2, -PI / 2, PI / 2, false);
  s.lineTo(0.02, W / 2);
  s.lineTo(0, W * 0.3);
  s.lineTo(0, -W * 0.3);
  return s;
}

const espatulaReta: Gerador = () =>
  espatulaBase({ nome: 'espatula_reta', forma: laminaRetaShape(0.2, 0.032), esp: 0.0012, mat: 'inox', cor: COR.inoxClaro, lc: 0.12, ponta: [0.2, 0, 0] });

const espatulaAngulada: Gerador = () =>
  espatulaBase({ nome: 'espatula_angulada', forma: laminaRetaShape(0.2, 0.032), esp: 0.0012, mat: 'inox', cor: COR.inoxClaro, lc: 0.12, degrau: 0.011, ponta: [0.2, 0, 0], corCabo: COR.marinho, matCabo: 'petroleo' });

const espatulaBolo: Gerador = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.008);
  s.lineTo(0.02, -0.012);
  s.lineTo(0.12, -0.03);
  s.quadraticCurveTo(0.135, 0, 0.12, 0.03);
  s.lineTo(0.02, 0.012);
  s.lineTo(0, 0.008);
  s.lineTo(0, -0.008);
  return espatulaBase({ nome: 'espatula_bolo', forma: s, esp: 0.0015, mat: 'inox', cor: COR.inoxClaro, lc: 0.12, degrau: 0.01, ponta: [0.13, 0, 0], corCabo: COR.marinho, matCabo: 'petroleo', rebites: 3 });
};

const espatulaPeixe: Gerador = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.01);
  s.lineTo(0.03, -0.03);
  s.lineTo(0.15, -0.04);
  s.quadraticCurveTo(0.162, 0, 0.155, 0.04);
  s.lineTo(0.03, 0.03);
  s.lineTo(0, 0.01);
  s.lineTo(0, -0.01);
  for (let k = 0; k < 5; k++) {
    const z = -0.022 + k * 0.011;
    const fenda = new THREE.Path();
    fenda.moveTo(0.05, z - 0.0018);
    fenda.lineTo(0.135, z - 0.0018);
    fenda.lineTo(0.135, z + 0.0018);
    fenda.lineTo(0.05, z + 0.0018);
    fenda.lineTo(0.05, z - 0.0018);
    s.holes.push(fenda);
  }
  return espatulaBase({ nome: 'espatula_peixe', forma: s, esp: 0.0016, mat: 'inox', cor: COR.inoxClaro, lc: 0.13, degrau: 0.01, ponta: [0.158, 0, 0], corCabo: COR.marinho, matCabo: 'petroleo', rebites: 3 });
};

const espatulaSilicone: Gerador = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.012);
  s.lineTo(0.02, -0.026);
  s.lineTo(0.095, -0.026);
  s.quadraticCurveTo(0.105, -0.026, 0.105, -0.016);
  s.lineTo(0.105, 0.01);
  s.quadraticCurveTo(0.103, 0.026, 0.08, 0.026);
  s.lineTo(0.02, 0.026);
  s.lineTo(0, 0.012);
  s.lineTo(0, -0.012);
  const m = new Montador();
  const y = 0.01;
  m.add('silicone', placaDeitada(s, 0.005, 12), { p: [0, y - 0.0025, 0] });
  m.add('silicone', caixaR(0.03, 0.009, 0.018, 0.004), { p: [-0.004, y, 0], cor: COR.siliconeEscuro });
  cabo(m, { x0: -0.17, x1: -0.015, y, alt: 0.016, larg: 0.02, perfil: 'reto', furo: true });
  return m.finalizar('espatula_silicone', [-0.09, y, 0], [0.105, y, 0]);
};

const raspador: Gerador = () => {
  const m = new Montador();
  const w = 0.15;
  const h = 0.1;
  m.add('inox', placa(retR(w, h, 0.004), 0.0015), { p: [0, h / 2, 0], cor: COR.inoxClaro });
  m.add('madeira', caixaR(w + 0.004, 0.026, 0.022, 0.009), { p: [0, h + 0.008, 0] });
  for (let k = 0; k < 4; k++) m.add('inox', cilZ(0.0018, 0.023, 8), { p: [-w / 2 + 0.025 + k * ((w - 0.05) / 3), h + 0.004, 0] });
  return m.finalizar('raspador', [0, h + 0.01, 0], [0, 0, 0]);
};

/* ================================================================== */
/* Pinças, pegadores, garfos e varetas                                 */
/* ================================================================== */

const pinca: Gerador = () => {
  const m = new Montador();
  for (const s of [-1, 1]) m.add('inox', caixa(0.2, 0.0018, 0.009), { p: [0, 0.0045, s * 0.008], r: [0, s * 0.035, 0], cor: COR.inoxClaro });
  m.add('inox', caixaR(0.02, 0.006, 0.022, 0.002), { p: [-0.095, 0.004, 0] });
  for (const s of [-1, 1]) m.add('inoxEscuro', caixa(0.05, 0.0002, 0.007), { p: [-0.04, 0.0055, s * 0.0105], r: [0, s * 0.035, 0] });
  return m.finalizar('pinca', [-0.04, 0.005, 0], [0.1, 0.005, 0]);
};

const pegador: Gerador = () => {
  const m = new Montador();
  const L = 0.3;
  for (const s of [-1, 1]) {
    m.add('inox', tubo([[-L / 2, 0.012, s * 0.006], [-0.05, 0.012, s * 0.02], [0.08, 0.012, s * 0.03], [L / 2 - 0.03, 0.012, s * 0.03]], 0.0035, 24, 6));
    m.add('inox', cuia(16, 6), { p: [L / 2 - 0.012, 0.014, s * 0.028], s: [0.024, 0.012, 0.018], r: [-s * PI / 2, 0, 0], cor: COR.inoxClaro });
    m.add('silicone', caixaR(0.09, 0.018, 0.008, 0.003), { p: [-0.08, 0.013, s * 0.016], r: [0, s * 0.11, 0], cor: COR.marinho });
  }
  m.add('inox', anel(0.012, 0.002, 16, 4).rotateX(PI / 2), { p: [-L / 2 - 0.008, 0.013, 0] });
  return m.finalizar('pegador', [-0.08, 0.013, 0], [L / 2, 0.014, 0]);
};

const hashi: Gerador = () => {
  const m = new Montador();
  for (const s of [-1, 1]) {
    const o = { p: [0, 0.0035, s * 0.006] as V3, r: [0, s * 0.012, 0] as V3 };
    m.add('madeira', tornoX([[0, -0.165], [0.0035, -0.164], [0.0034, 0.0], [0.0014, 0.162], [0, 0.165]], 8), { ...o, cor: COR.madeira });
    m.add('madeira', tornoX([[0.0037, -0.165], [0.0037, -0.11]], 8), { ...o, cor: COR.marinho });
  }
  return m.finalizar('hashi', [-0.1, 0.004, 0], [0.165, 0.002, 0]);
};

const garfoCozinha: Gerador = () => {
  const m = new Montador();
  const y = 0.011;
  for (const z of [-0.006, 0.006]) m.add('inox', tubo([[0.02, y, z * 1.6], [0.07, y + 0.002, z], [0.12, y + 0.006, z]], 0.0022, 12, 6), { cor: COR.inoxClaro });
  for (const z of [-0.006, 0.006]) m.add('inox', new THREE.ConeGeometry(0.0022, 0.012, 6).rotateZ(-PI / 2), { p: [0.126, y + 0.0065, z] });
  m.add('inox', caixaR(0.03, 0.008, 0.024, 0.003), { p: [0.008, y, 0] });
  m.add('inox', caixaR(0.012, 0.03, 0.012, 0.003), { p: [-0.012, y, 0] });
  cabo(m, { x0: -0.15, x1: -0.016, y, alt: 0.022, larg: 0.02, mat: 'madeira', cor: COR.madeira, rebites: 3 });
  return m.finalizar('garfo_cozinha', [-0.08, y, 0], [0.132, y + 0.006, 0]);
};

const garfo: Gerador = () => {
  const m = new Montador();
  const s = new THREE.Shape();
  s.moveTo(0, -0.004);
  s.quadraticCurveTo(0.012, -0.012, 0.02, -0.012);
  const dentes = 4;
  const larg = 0.024;
  for (let k = 0; k < dentes; k++) {
    const z0 = -larg / 2 + (k * larg) / dentes;
    const z1 = z0 + larg / dentes - 0.0018;
    s.lineTo(0.056, z0);
    s.lineTo(0.056, z1);
    if (k < dentes - 1) s.lineTo(0.026, z1 + 0.0009);
    else s.lineTo(0.056, larg / 2);
    if (k < dentes - 1) s.lineTo(0.026, z1 + 0.0009);
  }
  s.lineTo(0.02, 0.012);
  s.quadraticCurveTo(0.012, 0.012, 0, 0.004);
  s.lineTo(0, -0.004);
  m.add('inox', placaDeitada(s, 0.0018, 8), { p: [0, 0.006, 0], r: [0, 0, 0.08], cor: COR.inoxClaro });
  m.add('inox', tornoX([[0, -0.135], [0.8, -0.134], [1, -0.12], [0.9, -0.06], [0.35, -0.005], [0.35, 0.002]], 10), { p: [0, 0.007, 0], s: [1, 0.0022, 0.011], cor: COR.inoxClaro });
  return m.finalizar('garfo', [-0.08, 0.007, 0], [0.057, 0.01, 0]);
};

const garfoFondue: Gerador = () => {
  const m = new Montador();
  const y = 0.005;
  m.add('inox', cilX(0.0015, 0.18, 6), { p: [0, y, 0] });
  for (const z of [-0.003, 0.003]) m.add('inox', tubo([[0.18, y, 0], [0.19, y, z], [0.215, y, z]], 0.0011, 8, 4));
  cabo(m, { x0: -0.08, x1: 0.004, y, alt: 0.01, larg: 0.01, perfil: 'bojudo', mat: 'petroleo', cor: COR.cobaltoClaro });
  return m.finalizar('garfo_fondue', [-0.04, y, 0], [0.215, y, 0]);
};

const espetoMetal: Gerador = () => {
  const m = new Montador();
  const y = 0.004;
  m.add('inox', caixa(0.27, 0.0012, 0.004), { p: [0.135, y, 0], cor: COR.inoxClaro });
  m.add('inox', new THREE.ConeGeometry(0.0025, 0.02, 4).rotateZ(-PI / 2).scale(1, 0.4, 1), { p: [0.28, y, 0] });
  m.add('inox', anel(0.012, 0.0016, 18, 4), { p: [-0.012, y, 0] });
  return m.finalizar('espeto_metal', [-0.01, y, 0], [0.29, y, 0]);
};

const espetoMadeira: Gerador = () => {
  const m = new Montador();
  m.add('madeira', tornoX([[0, 0], [0.0016, 0.001], [0.0016, 0.23], [0, 0.25]], 6), { p: [0, 0.0016, 0], cor: COR.bambu });
  return m.finalizar('espeto_madeira', [0.03, 0.0016, 0], [0.25, 0.0016, 0]);
};

const palito: Gerador = () => {
  const m = new Montador();
  m.add('madeira', tornoX([[0, 0], [0.001, 0.006], [0.001, 0.059], [0, 0.065]], 6), { p: [0, 0.001, 0], cor: COR.madeira });
  return m.finalizar('palito', [0.02, 0.001, 0], [0.065, 0.001, 0]);
};

const vareta: Gerador = () => {
  const m = new Montador();
  m.add('madeira', tornoX([[0, 0], [0.012, 0.001], [0.012, 0.999], [0, 1]], 14), { p: [0, 0.012, 0] });
  return m.finalizar('vareta', [0.1, 0.012, 0], [1, 0.012, 0]);
};

const agulha: Gerador = () => {
  const m = new Montador();
  const y = 0.0015;
  m.add('inox', tornoX([[0, 0], [0.0013, 0.004], [0.0013, 0.22], [0, 0.25]], 8), { p: [0, y, 0], cor: COR.inoxClaro });
  m.add('inox', new THREE.TorusGeometry(0.003, 0.0008, 4, 12), { p: [-0.002, y, 0], s: [1.6, 1, 1], r: [PI / 2, 0, 0] });
  m.add('madeira', tubo([[-0.002, y, 0], [-0.02, y, 0.01], [-0.05, y, 0.004], [-0.08, y, 0.016]], 0.0009, 12, 4), { cor: COR.barbante });
  return m.finalizar('agulha', [0.04, y, 0], [0.25, y, 0]);
};

const barbante: Gerador = () => {
  const m = new Montador();
  m.add('madeira', cilindro(0.028, 0.05, 28), { cor: COR.barbante });
  for (let k = 0; k < 8; k++) m.add('madeira', anel(0.0283, 0.0012, 28, 3), { p: [0, 0.004 + k * 0.006, 0], r: [0.04 * (k % 2 ? 1 : -1), 0, 0], cor: 0xdccca8 });
  m.add('madeira', anel(0.012, 0.002, 20, 4), { p: [0, 0.05, 0], cor: COR.papelao });
  m.add('inoxEscuro', new THREE.CircleGeometry(0.011, 16).rotateX(-PI / 2), { p: [0, 0.0505, 0] });
  m.add('madeira', tubo([[0.028, 0.03, 0], [0.05, 0.02, 0.01], [0.08, 0.003, 0.02], [0.12, 0.001, 0.0]], 0.0011, 16, 4), { cor: COR.barbante });
  return m.finalizar('barbante', [0, 0.025, 0.028], [0.12, 0.001, 0]);
};

/* ================================================================== */
/* Massa e confeitaria                                                 */
/* ================================================================== */

const rolo: Gerador = () => {
  const m = new Montador();
  const r = 0.03;
  const L = 0.28;
  m.add('madeira', tornoX([[0, -L / 2], [r - 0.003, -L / 2], [r, -L / 2 + 0.004], [r, L / 2 - 0.004], [r - 0.003, L / 2], [0, L / 2]], 28), { p: [0, r, 0] });
  for (const s of [-1, 1]) {
    m.add('inox', cilX(0.012, 0.006, 16), { p: [s > 0 ? L / 2 : -L / 2 - 0.006, r, 0] });
    const x0 = s > 0 ? L / 2 + 0.006 : -L / 2 - 0.096;
    m.add('petroleo', tornoX(s > 0
      ? [[0.007, x0], [0.011, x0 + 0.01], [0.0135, x0 + 0.06], [0.012, x0 + 0.085], [0, x0 + 0.09]]
      : [[0, x0], [0.012, x0 + 0.005], [0.0135, x0 + 0.03], [0.011, x0 + 0.08], [0.007, x0 + 0.09]], 14), { p: [0, r, 0], cor: COR.marinho });
  }
  return m.finalizar('rolo', [-L / 2 - 0.05, r, 0], [0, 0, 0]);
};

const carretilha: Gerador = () => {
  const m = new Montador();
  const R = 0.028;
  const roda = cilindro(R, 0.0022, 48).translate(0, -0.0011, 0);
  canelar(roda, 22, 0.05);
  m.add('inox', roda.rotateX(PI / 2), { p: [0, R, 0], cor: COR.inoxClaro });
  m.add('inox', cilZ(0.004, 0.012, 10), { p: [0, R, 0] });
  const inc = 0.32;
  const dir = (d: number): V3 => [-Math.cos(inc) * d, R + Math.sin(inc) * d, 0];
  for (const z of [-0.004, 0.004]) m.add('inox', tubo([[0, R, z], dir(0.025), dir(0.045)].map((p, i) => [p[0], p[1], i === 0 ? z : z * 0.5] as V3), 0.0018, 8, 5));
  const g = tornoX([[0, -0.11], [0.8, -0.109], [1, -0.1], [1, -0.02], [0.7, 0]], 12);
  m.add('madeira', g, { p: dir(0.045), r: [0, 0, -inc], s: [1, 0.011, 0.011] });
  const meio = dir(0.1);
  return m.finalizar('carretilha', meio, [0, 0, 0]);
};

const sacoConfeitar: Gerador = () => {
  const m = new Montador();
  const yc = 0.034;
  m.add('silicone', tornoX([[0.012, -0.2], [0.02, -0.17], [0.05, -0.12], [0.06, -0.05], [0.045, 0.05], [0.02, 0.14], [0.009, 0.17]], 24), { p: [0, yc, 0], s: [1, 0.55, 1], cor: 0xa9d3f2 });
  for (const x of [-0.18, -0.172, -0.164]) m.add('silicone', new THREE.TorusGeometry(0.016, 0.003, 5, 16), { p: [x, yc, 0], r: [0, PI / 2, 0], s: [1, 0.6, 1], cor: COR.siliconeEscuro });
  const bico = torno([[0.012, 0], [0.011, 0.012], [0.004, 0.045]], 32);
  canelar(bico, 8, 0.22, 0.02, 1, true);
  m.add('inox', bico.rotateZ(-PI / 2), { p: [0.165, yc, 0], cor: COR.inoxClaro });
  return m.finalizar('saco_confeitar', [-0.1, yc + 0.02, 0], [0.21, yc, 0]);
};

const bico: Gerador = () => {
  const m = new Montador();
  const g = torno([[0.014, 0], [0.014, 0.008], [0.0045, 0.05]], 40);
  canelar(g, 8, 0.24, 0.022, 1, true);
  m.add('inox', g, { cor: COR.inoxClaro });
  m.add('inox', anel(0.0142, 0.001, 32, 3), { p: [0, 0.0005, 0] });
  return m.finalizar('bico', [0, 0.01, 0.014], [0, 0.05, 0]);
};

const pincel: Gerador = () => {
  const m = new Montador();
  const y = 0.009;
  cabo(m, { x0: -0.16, x1: 0.002, y, alt: 0.016, larg: 0.016, mat: 'madeira', cor: COR.madeira, perfil: 'fino', furo: true });
  m.add('inox', tornoX([[0.006, 0], [0.008, 0.004], [0.008, 0.02], [0.007, 0.022]], 14), { p: [0, y, 0], s: [1, 0.75, 1.5] });
  m.add('madeira', tornoX([[0.0065, 0.02], [0.0078, 0.035], [0.0072, 0.06], [0.003, 0.072], [0, 0.073]], 14), { p: [0, y, 0], s: [1, 0.7, 1.55], cor: COR.barbante });
  return m.finalizar('pincel', [-0.08, y, 0], [0.073, y, 0]);
};

/* ================================================================== */
/* Raladores, espremedores e prensas                                   */
/* ================================================================== */

const ralador: Gerador = () => {
  const m = new Montador();
  const w = 0.1;
  const d = 0.075;
  const H = 0.23;
  m.add('inox', loftRet(w, d, 0.006, [[0, 0.01], [-0.006, H]], 3), { cor: COR.inoxClaro });
  m.add('silicone', loftRet(w, d, 0.006, [[-0.001, 0], [0.003, 0.002], [0.003, 0.012], [-0.001, 0.014]], 3), { cor: COR.marinho });
  m.add('inox', loftRet(w, d, 0.006, [[-0.006, H], [-0.0045, H + 0.003], [-0.003, H]], 3));
  m.add('petroleo', tubo([[-0.035, H, 0], [-0.03, H + 0.04, 0], [0.03, H + 0.04, 0], [0.035, H, 0]], 0.006, 16, 8), { cor: COR.marinho });
  const off = (y: number) => -0.006 * (y / H) + 0.0006;
  // face +z: furos grandes
  for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
    const yy = 0.035 + j * 0.026;
    m.add('inoxEscuro', new THREE.CircleGeometry(0.0042, 8), { p: [-0.03 + i * 0.02, yy, d / 2 + off(yy)] });
  }
  // face -z: furinhos
  for (let i = 0; i < 9; i++) for (let j = 0; j < 16; j++) {
    const yy = 0.03 + j * 0.0118;
    m.add('inoxEscuro', new THREE.CircleGeometry(0.0012, 4).rotateY(PI), { p: [-0.036 + i * 0.009, yy, -d / 2 - off(yy)] });
  }
  // face +x: fenda de fatiar
  m.add('inoxEscuro', caixa(0.0004, 0.006, 0.05), { p: [w / 2 + off(0.12), 0.12, 0] });
  m.add('inox', caixa(0.0012, 0.004, 0.05), { p: [w / 2 + off(0.12) + 0.0008, 0.116, 0], cor: COR.inoxClaro });
  // face -x: furos médios
  for (let i = 0; i < 5; i++) for (let j = 0; j < 10; j++) {
    const yy = 0.035 + j * 0.018;
    m.add('inoxEscuro', new THREE.CircleGeometry(0.0024, 5).rotateY(-PI / 2), { p: [-w / 2 - off(yy), yy, -0.024 + i * 0.012] });
  }
  return m.finalizar('ralador', [0, H + 0.04, 0], [0, 0.12, d / 2]);
};

const raladorPlano: Gerador = () => {
  const m = new Montador();
  const y = 0.01;
  m.add('inox', caixaR(0.2, 0.0016, 0.034, 0.0006), { p: [0.1, y, 0], cor: COR.inoxClaro });
  for (const z of [-0.0175, 0.0175]) m.add('inox', caixa(0.2, 0.006, 0.0015), { p: [0.1, y - 0.002, z] });
  for (let i = 0; i < 30; i++) for (let j = 0; j < 4; j++) {
    m.add('inoxEscuro', caixa(0.0035, 0.0003, 0.0022), { p: [0.012 + i * 0.006, y + 0.0009, -0.01 + j * 0.0066 + (i % 2) * 0.003], r: [0, 0.5, 0] });
  }
  m.add('silicone', caixaR(0.012, 0.01, 0.036, 0.003), { p: [0.2, y - 0.004, 0], cor: COR.marinho });
  cabo(m, { x0: -0.12, x1: 0.004, y, alt: 0.02, larg: 0.026, perfil: 'reto', furo: true });
  return m.finalizar('ralador_plano', [-0.06, y, 0], [0.1, y + 0.001, 0]);
};

const mandolina: Gerador = () => {
  const m = new Montador();
  const L = 0.34;
  const inc = 0.28;
  const o = (x: number, y: number, z: number): V3 => [Math.cos(inc) * x - Math.sin(inc) * y, Math.sin(inc) * x + Math.cos(inc) * y + 0.006, z];
  m.add('inox', caixaR(L, 0.006, 0.11, 0.003), { p: o(L / 2, 0, 0), r: [0, 0, inc], cor: COR.inoxClaro });
  for (const z of [-0.058, 0.058]) m.add('petroleo', caixaR(L, 0.016, 0.008, 0.003), { p: o(L / 2, 0.004, z), r: [0, 0, inc], cor: COR.marinho });
  m.add('inoxEscuro', caixa(0.012, 0.007, 0.1), { p: o(L * 0.55, 0.0005, 0), r: [0, 0, inc] });
  m.add('inox', caixa(0.004, 0.002, 0.1), { p: o(L * 0.55 + 0.007, 0.004, 0), r: [0, 0.08, inc] });
  // pé dobrável
  m.add('inox', tubo([[o(L - 0.02, 0, -0.05)[0], o(L - 0.02, 0, 0)[1], -0.05], [o(L - 0.02, 0, 0)[0] + 0.02, 0.002, -0.05], [o(L - 0.02, 0, 0)[0] + 0.02, 0.002, 0.05], [o(L - 0.02, 0, 0)[0], o(L - 0.02, 0, 0)[1], 0.05]], 0.003, 16, 5));
  m.add('silicone', caixaR(0.02, 0.008, 0.11, 0.003), { p: [0.004, 0.004, 0], cor: COR.marinho });
  // protetor de mão
  m.add('cobalto', caixaR(0.06, 0.022, 0.07, 0.008), { p: o(L * 0.25, 0.015, 0), r: [0, 0, inc] });
  m.add('cobalto', cilindro(0.011, 0.03, 14), { p: o(L * 0.25, 0.026, 0), r: [0, 0, inc], cor: COR.cobaltoClaro });
  return m.finalizar('mandolina', o(L * 0.25, 0.05, 0), o(L * 0.55, 0.003, 0));
};

const espremedor: Gerador = () => {
  const m = new Montador();
  recipiente(m, { fora: [[0, 0], [0.065, 0], [0.07, 0.006], [0.085, 0.03]], esp: 0.004, matFora: 'ceramica', corFora: COR.ceramica });
  m.add('ceramica', anel(0.086, 0.0012, 48, 3), { p: [0, 0.024, 0], cor: COR.filete });
  const g = torno([[0.035, 0.004], [0.033, 0.02], [0.022, 0.05], [0.008, 0.075], [0, 0.08]], 40);
  canelar(g, 10, 0.16, 0.008, 0.075, true);
  m.add('ceramica', g);
  m.add('ceramica', tubo([[0.08, 0.026, 0], [0.098, 0.03, 0], [0.11, 0.032, 0]], 0.006, 8, 8).scale(1, 0.6, 1));
  m.add('ceramica', alcaLateral(0.02, 0.0045, 0.08, 0.02, PI));
  return m.finalizar('espremedor', [-0.1, 0.02, 0], [0, 0.08, 0]);
};

const reamer: Gerador = () => {
  const m = new Montador();
  const y = 0.024;
  cabo(m, { x0: -0.09, x1: 0.002, y, alt: 0.024, larg: 0.024, mat: 'madeira', cor: COR.madeira, perfil: 'bojudo' });
  const g = torno([[0.016, 0], [0.024, 0.01], [0.02, 0.04], [0.01, 0.07], [0, 0.08]], 40);
  canelar(g, 8, 0.2, 0.004, 0.075, true);
  m.add('madeira', g.rotateZ(-PI / 2), { p: [0, y, 0] });
  return m.finalizar('reamer', [-0.045, y, 0], [0.08, y, 0]);
};

const amassador: Gerador = () => {
  const m = new Montador();
  const y = 0.045;
  cabo(m, { x0: -0.13, x1: -0.006, y, alt: 0.03, larg: 0.03, perfil: 'bojudo', furo: true });
  m.add('inox', cilX(0.005, 0.15, 10), { p: [-0.008, y, 0] });
  m.add('inox', cilX(0.045, 0.006, 40), { p: [0.142, y, 0], cor: COR.inoxClaro });
  for (const [a, b] of hexDentro(0.035, 0.012)) m.add('inoxEscuro', new THREE.CircleGeometry(0.0035, 6).rotateY(PI / 2), { p: [0.1484, y + a, b] });
  return m.finalizar('amassador', [-0.07, y, 0], [0.148, y, 0]);
};

const espremedorBatata: Gerador = () => {
  const m = new Montador();
  const xc = 0.0;
  const R = 0.042;
  recipiente(m, { fora: perfilReto(R, 0.065, 0.005), esp: 0.0015, matFora: 'inox', corFora: COR.inoxClaro, p: [xc, 0.004, 0], borda: { mat: 'inox', r: 0.0025 } });
  for (const [x, z] of hexDentro(R * 0.8, 0.008)) m.add('inoxEscuro', new THREE.CircleGeometry(0.0018, 5).rotateX(PI / 2), { p: [xc + x, 0.0035, z] });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * 2 * PI;
    for (const yy of [0.02, 0.04]) m.add('inoxEscuro', new THREE.CircleGeometry(0.0018, 5).rotateY(PI / 2 - a), { p: [Math.cos(a) * (R + 0.0004), yy, Math.sin(a) * (R + 0.0004)] });
  }
  // braço de baixo, preso ao cesto
  m.add('inox', tubo([[R, 0.06, 0], [-R - 0.05, 0.065, 0], [-R - 0.2, 0.07, 0]], 0.005, 12, 6).scale(1, 1, 1.6));
  cabo(m, { x0: -R - 0.27, x1: -R - 0.14, y: 0.07, alt: 0.022, larg: 0.028, perfil: 'reto' });
  // braço de cima com o êmbolo
  m.add('inox', cilindro(R - 0.004, 0.006, 28), { p: [xc, 0.07, 0] });
  m.add('inox', cilindro(0.005, 0.02, 8), { p: [xc, 0.074, 0] });
  m.add('inox', tubo([[R + 0.02, 0.098, 0], [0, 0.098, 0], [-R - 0.05, 0.11, 0], [-R - 0.2, 0.1, 0]], 0.005, 12, 6).scale(1, 1, 1.6));
  cabo(m, { x0: -R - 0.27, x1: -R - 0.14, y: 0.1, alt: 0.022, larg: 0.028, perfil: 'reto' });
  m.add('inox', cilZ(0.006, 0.02, 10), { p: [R + 0.02, 0.08, 0] });
  m.add('inox', tubo([[R + 0.002, 0.06, 0], [R + 0.02, 0.08, 0], [R + 0.02, 0.098, 0]], 0.004, 8, 5));
  return m.finalizar('espremedor_batata', [-R - 0.2, 0.085, 0], [xc, 0.003, 0]);
};

const mouli: Gerador = () => {
  const m = new Montador();
  const R = 0.1;
  const y0 = 0.04;
  recipiente(m, { fora: [[0, 0], [0.06, 0], [0.065, 0.004], [R, 0.08]], esp: 0.0018, matFora: 'inox', corFora: COR.inoxClaro, p: [0, y0, 0], borda: { mat: 'inox', r: 0.003 } });
  for (const [x, z] of hexDentro(0.05, 0.009)) m.add('inoxEscuro', new THREE.CircleGeometry(0.002, 5).rotateX(-PI / 2), { p: [x, y0 + 0.0025, z] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * 2 * PI + PI / 3;
    m.add('inox', tubo([[Math.cos(a) * 0.07, y0 + 0.03, Math.sin(a) * 0.07], [Math.cos(a) * 0.085, 0.01, Math.sin(a) * 0.085], [Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09]], 0.0025, 8, 5));
  }
  m.add('inox', tubo([[-R, y0 + 0.08, 0], [-R - 0.06, y0 + 0.085, 0], [-R - 0.09, y0 + 0.088, 0]], 0.004, 8, 5).scale(1, 1, 1.8));
  cabo(m, { x0: -R - 0.22, x1: -R - 0.08, y: y0 + 0.088, alt: 0.022, larg: 0.026, perfil: 'reto', furo: true });
  m.add('inox', tubo([[R, y0 + 0.08, 0], [R + 0.025, y0 + 0.082, 0], [R + 0.03, y0 + 0.07, 0]], 0.003, 8, 5));
  // eixo, lâmina e manivela
  m.add('inox', cilindro(0.004, 0.1, 8), { p: [0, y0 + 0.004, 0] });
  m.add('inox', caixa(0.09, 0.003, 0.025), { p: [0, y0 + 0.012, 0], r: [0.3, 0, 0], cor: COR.inox });
  m.add('inox', tubo([[0, y0 + 0.104, 0], [0.04, y0 + 0.104, 0], [0.075, y0 + 0.1, 0]], 0.0035, 8, 5));
  m.add('madeira', cilindro(0.008, 0.035, 12), { p: [0.075, y0 + 0.1, 0], cor: COR.marinho });
  return m.finalizar('mouli', [-R - 0.15, y0 + 0.088, 0], [0, y0 + 0.003, 0]);
};

/* ================================================================== */
/* Medição                                                             */
/* ================================================================== */

function mostrador(m: Montador, x: number, y: number, R: number, prof: number): void {
  m.add('inox', cilX(R, prof, 28), { p: [x - prof, y, 0] });
  m.add('ceramica', new THREE.CircleGeometry(R * 0.86, 28).rotateY(-PI / 2), { p: [x - prof - 0.0006, y, 0] });
  m.add('inox', new THREE.TorusGeometry(R * 0.93, R * 0.08, 4, 28).rotateY(PI / 2), { p: [x - prof, y, 0] });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * 2 * PI;
    m.add('petroleo', caixa(0.0004, R * 0.14, 0.0012), { p: [x - prof - 0.001, y + Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7], r: [-a, 0, 0], cor: COR.marinho });
  }
  m.add('silicone', caixa(0.0005, R * 0.62, 0.0016), { p: [x - prof - 0.0014, y + R * 0.22, R * 0.1], r: [-0.5, 0, 0], cor: COR.vermelho });
}

const termometroEspeto: Gerador = () => {
  const m = new Montador();
  const R = 0.022;
  m.add('inox', tornoX([[0.002, 0], [0.002, 0.12], [0, 0.135]], 8), { p: [0, R, 0], cor: COR.inoxClaro });
  m.add('inox', cilX(0.004, 0.012, 10), { p: [-0.004, R, 0] });
  mostrador(m, -0.002, R, R, 0.012);
  return m.finalizar('termometro_espeto', [-0.01, R, 0], [0.135, R, 0]);
};

const termometroGordura: Gerador = () => {
  const m = new Montador();
  const R = 0.026;
  m.add('inox', tornoX([[0.0025, 0], [0.0025, 0.28], [0, 0.29]], 8), { p: [0, R, 0], cor: COR.inoxClaro });
  mostrador(m, -0.002, R, R, 0.014);
  // presilha de borda de panela
  m.add('inox', caixaR(0.012, 0.012, 0.012, 0.002), { p: [0.06, R, 0] });
  m.add('inox', placa(retR(0.05, 0.01, 0.003), 0.0012), { p: [0.085, R + 0.008, 0.007], r: [0, 0, 0] });
  m.add('inox', tubo([[0.06, R + 0.006, 0.007], [0.06, R + 0.022, 0.012], [0.11, R + 0.022, 0.012]], 0.0012, 8, 4));
  return m.finalizar('termometro_gordura', [-0.008, R, 0], [0.29, R, 0]);
};

const termometroAcucar: Gerador = () => {
  const m = new Montador();
  const L = 0.3;
  m.add('inox', placaDeitada(retR(L, 0.04, 0.008), 0.0015), { p: [L / 2, 0, 0], cor: COR.inoxClaro });
  m.add('vidro', cilX(0.0055, L - 0.05, 16), { p: [0.02, 0.0075, 0] });
  m.add('silicone', cilX(0.0012, L * 0.55, 6), { p: [L * 0.4, 0.0075, 0], cor: COR.vermelho });
  m.add('silicone', esfera(0.0045, 10, 8), { p: [L - 0.034, 0.0075, 0], cor: COR.vermelho });
  for (let k = 0; k < 22; k++) m.add('petroleo', caixa(0.0008, 0.0004, k % 5 ? 0.006 : 0.011), { p: [0.035 + k * 0.011, 0.0018, 0.012], cor: COR.marinho });
  m.add('inox', caixaR(0.03, 0.012, 0.03, 0.003), { p: [0.03, 0.007, 0] });
  m.add('petroleo', caixaR(0.04, 0.014, 0.03, 0.006), { p: [-0.012, 0.007, 0], cor: COR.marinho });
  return m.finalizar('termometro_acucar', [-0.012, 0.007, 0], [L - 0.034, 0.0075, 0]);
};

const balanca: Gerador = () => {
  const m = new Montador();
  const w = 0.2;
  const d = 0.17;
  m.add('cobalto', caixaR(w, 0.032, d, 0.012, 3), { p: [0, 0.016, 0] });
  m.add('inox', caixaR(w - 0.02, 0.005, d - 0.05, 0.004), { p: [0, 0.0345, -0.012], cor: COR.inoxClaro });
  m.add('inoxEscuro', caixaR(0.07, 0.002, 0.022, 0.002), { p: [-0.025, 0.0325, d / 2 - 0.016], cor: COR.preto });
  m.add('silicone', caixa(0.05, 0.0008, 0.012), { p: [-0.025, 0.0338, d / 2 - 0.016], cor: 0x7fd3ff });
  for (const x of [0.04, 0.065]) m.add('ceramica', cilindro(0.0055, 0.003, 12), { p: [x, 0.032, d / 2 - 0.016] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.add('silicone', cilindro(0.008, 0.003, 10), { p: [sx * (w / 2 - 0.02), -0.002, sz * (d / 2 - 0.02)], cor: COR.marinho });
  return m.finalizar('balanca', [w / 2, 0.02, 0], [0, 0.037, -0.012]);
};

const jarraMedidora: Gerador = () => {
  const m = new Montador();
  const g = biquinho(torno([[0, 0], [0.048, 0], [0.05, 0.005], [0.054, 0.14]], 32).translate(0, -0.14, 0).scale(1 / 0.054, 1 / 0.14, 1 / 0.054), 0.22)
    .scale(0.054, 0.14, 0.054).translate(0, 0.14, 0);
  m.add('vidro', g);
  m.add('vidro', cilindro(0.046, 0.004, 28), { cor: 0xc8e3f3 });
  m.add('vidro', tubo([[-0.052, 0.125, 0], [-0.085, 0.115, 0], [-0.085, 0.04, 0], [-0.05, 0.03, 0]], 0.007, 16, 8), { cor: 0xd2e9f6 });
  for (let k = 0; k < 10; k++) {
    const y = 0.02 + k * 0.011;
    m.add('cobalto', caixa(0.0006, 0.0012, k % 2 ? 0.01 : 0.018), { p: [0, y, -0.0505 - (y / 0.14) * 0.004], r: [0, PI / 2, 0], s: [1, 1, 1] });
  }
  return m.finalizar('jarra_medidora', [-0.085, 0.08, 0], [0.066, 0.143, 0]);
};

/* ================================================================== */
/* Tesouras                                                            */
/* ================================================================== */

function tesouraBase(nome: string, aves: boolean): THREE.Group {
  const m = new Montador();
  const y = 0.004;
  for (const [s, yy] of [[1, y], [-1, y + 0.0024]] as [number, number][]) {
    const sh = new THREE.Shape();
    if (aves) {
      sh.moveTo(-0.012, -0.007);
      sh.quadraticCurveTo(0.05, -0.006, 0.095, 0.006);
      sh.quadraticCurveTo(0.05, 0.004, 0.0, 0.01);
      sh.lineTo(-0.012, 0.007);
    } else {
      sh.moveTo(-0.012, -0.007);
      sh.lineTo(0.09, -0.0012);
      sh.lineTo(0.091, 0.0012);
      sh.lineTo(0.0, 0.009);
      sh.lineTo(-0.012, 0.007);
    }
    sh.lineTo(-0.012, -0.007);
    const g = placaDeitada(sh, 0.0022, 10);
    m.add('inox', g, { p: [0, yy, 0], r: [0, s * 0.06, 0], cor: COR.inoxClaro });
    if (aves) {
      m.add('petroleo', caixaR(0.085, 0.012, 0.014, 0.005), { p: [-0.048, yy + 0.002, s * 0.012], r: [0, -s * 0.18, 0], cor: COR.marinho });
    } else {
      const loop = new THREE.TorusGeometry(1, 0.28, 6, 20).rotateX(PI / 2);
      m.add('petroleo', loop, { p: [-0.06, yy + 0.002, s * 0.022], s: s > 0 ? [0.02, 0.016, 0.014] : [0.03, 0.016, 0.016], cor: COR.marinho });
      m.add('inox', caixa(0.05, 0.003, 0.006), { p: [-0.02, yy, s * 0.011], r: [0, s * 0.5, 0] });
    }
  }
  m.add('inox', cilindro(0.0045, 0.008, 12), { p: [0, y - 0.0015, 0], cor: COR.inox });
  if (aves) {
    const pts: V3[] = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      pts.push([-0.02 - t * 0.03, y + 0.01 + Math.sin(t * PI * 8) * 0.003, (t - 0.5) * 0.024 + Math.cos(t * PI * 8) * 0.003]);
    }
    m.add('inox', tubo(pts, 0.0008, 60, 4));
  }
  return m.finalizar(nome, [-0.06, y + 0.004, 0], [aves ? 0.09 : 0.088, y + 0.001, 0]);
}

const tesoura: Gerador = () => tesouraBase('tesoura', false);
const tesouraAves: Gerador = () => tesouraBase('tesoura_aves', true);

/* ================================================================== */
/* Folhas, panos e embalagens                                          */
/* ================================================================== */

/** Folha retangular deitada, com ondulação e uma ponta enrolada em -X. */
function folha(w: number, d: number, amassado: number, enrolar: boolean): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d, 24, 12).rotateX(-PI / 2);
  const pos = g.getAttribute('position');
  const R = 0.012;
  const x0 = -w / 2 + 0.045;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const z = pos.getZ(i);
    let y = 0.0015 + 0.0012 * Math.sin(x * 40 + z * 13) * Math.cos(z * 31);
    if (amassado) y += amassado * (Math.sin(x * 170 + Math.cos(z * 90) * 3) * Math.cos(z * 150 + x * 40) + 1);
    if (enrolar && x < x0) {
      const t = (x0 - x) / R;
      x = x0 - R * Math.sin(t);
      y = y + R * (1 - Math.cos(t));
    }
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

const folhaManteiga: Gerador = () => {
  const m = new Montador();
  m.add('madeira', folha(0.4, 0.3, 0, true), { cor: COR.papel });
  return m.finalizar('folha_manteiga', [0.18, 0.002, 0.14], [0, 0.002, 0]);
};

const folhaAluminio: Gerador = () => {
  const m = new Montador();
  m.add('inox', folha(0.4, 0.3, 0.0007, true), { cor: COR.inoxClaro });
  return m.finalizar('folha_aluminio', [0.18, 0.002, 0.14], [0, 0.002, 0]);
};

const filme: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', caixaR(0.32, 0.05, 0.05, 0.004), { p: [0, 0.025, 0] });
  m.add('ceramica', caixa(0.12, 0.022, 0.0006), { p: [-0.05, 0.026, 0.0253] });
  m.add('inox', caixa(0.3, 0.004, 0.003), { p: [0, 0.048, 0.024], cor: COR.inoxClaro });
  const g = new THREE.PlaneGeometry(0.29, 0.09, 4, 6);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const v = (pos.getY(i) + 0.045) / 0.09;
    pos.setXYZ(i, pos.getX(i), 0.05 - v * 0.035, 0.026 + v * 0.06 + 0.004 * Math.sin(pos.getX(i) * 30));
  }
  g.computeVertexNormals();
  m.add('vidro', g, { cor: 0xeef7fb });
  return m.finalizar('filme', [-0.14, 0.025, 0], [0, 0.015, 0.086]);
};

const papelToalha: Gerador = () => {
  const m = new Montador();
  m.add('inox', cilindro(0.075, 0.008, 32));
  m.add('inox', cilindro(0.008, 0.28, 10), { p: [0, 0.008, 0] });
  m.add('madeira', cilindro(0.058, 0.24, 36, 0.058, true), { p: [0, 0.015, 0], cor: 0xf7f6f1 });
  m.add('madeira', torno([[0.02, 0.255], [0.058, 0.255]], 32), { cor: 0xf0eee6 });
  m.add('madeira', anel(0.02, 0.002, 20, 4), { p: [0, 0.255, 0], cor: COR.papelao });
  for (let k = 1; k < 4; k++) m.add('madeira', anel(0.0582, 0.0004, 36, 3), { p: [0, 0.015 + k * 0.06, 0], cor: 0xe4e1d8 });
  m.add('madeira', caixa(0.11, 0.2, 0.0012), { p: [0.04, 0.115, 0.058], r: [0, -0.45, 0], cor: 0xf7f6f1 });
  m.add('cobalto', esfera(0.012, 12, 8), { p: [0, 0.295, 0] });
  return m.finalizar('papel_toalha', [0, 0.295, 0], [0.09, 0.03, 0.03]);
};

/** Folha de papel-toalha dobrada, para secar com a mão. */
const folhaPapelToalha: Gerador = () => {
  const m = new Montador();
  m.add('madeira', caixa(0.09, 0.005, 0.07), { p: [0, 0.0025, 0], cor: 0xfafaf6 });
  m.add('madeira', caixa(0.088, 0.0012, 0.068), { p: [0, 0.0058, 0.001], r: [0, 0.04, 0], cor: 0xf3f2ec });
  return m.finalizar('folha_papel_toalha', [0, 0.006, 0], [0, 0, 0]);
};

const pano: Gerador = () => {
  const m = new Montador();
  const w = 0.24;
  const d = 0.16;
  m.add('madeira', caixaR(w, 0.009, d, 0.004), { p: [0, 0.0045, 0], cor: COR.tecido });
  m.add('madeira', caixaR(w - 0.01, 0.009, d - 0.04, 0.004), { p: [0.005, 0.013, 0.016], cor: COR.tecido });
  for (const z of [-0.06, -0.045, 0.06]) m.add('madeira', caixa(w, 0.0008, 0.008), { p: [0, 0.0092, z], cor: COR.tecidoAzul });
  for (const z of [0.0, 0.015]) m.add('madeira', caixa(w - 0.01, 0.0008, 0.008), { p: [0.005, 0.0176, z + 0.016], cor: COR.tecidoAzul });
  m.add('madeira', cilX(0.0045, w - 0.01, 10), { p: [-w / 2 + 0.01, 0.009, -d / 2 + 0.04 + 0.016 - 0.0045], cor: COR.tecido });
  return m.finalizar('pano', [-w / 2 + 0.02, 0.017, 0], [0, 0.018, 0.02]);
};

const folhaBananeira: Gerador = () => {
  const m = new Montador();
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0);
  s.bezierCurveTo(-0.2, 0.14, 0.2, 0.14, 0.3, 0);
  s.bezierCurveTo(0.2, -0.14, -0.2, -0.14, -0.3, 0);
  m.add('madeira', new THREE.ShapeGeometry(s, 24).rotateX(-PI / 2), { p: [0, 0.002, 0], cor: COR.verde });
  m.add('madeira', cilX(0.004, 0.62, 8, 0.0015), { p: [-0.32, 0.003, 0], s: [1, 0.6, 1], cor: 0x86b55c });
  for (let k = -5; k <= 5; k++) {
    if (!k) continue;
    m.add('madeira', caixa(0.0012, 0.0004, 0.2), { p: [k * 0.045, 0.0024, 0], r: [0, 0.35, 0], cor: 0x4f9a44 });
  }
  return m.finalizar('folha_bananeira', [-0.3, 0.003, 0], [0, 0.003, 0]);
};

const sacoPlastico: Gerador = () => {
  const m = new Montador();
  m.add('vidro', caixaR(0.2, 0.006, 0.18, 0.0028), { p: [0, 0.003, 0], cor: 0xeaf5fb });
  m.add('cobalto', caixa(0.2, 0.004, 0.006), { p: [0, 0.004, -0.075] });
  m.add('ceramica', caixa(0.08, 0.0004, 0.025), { p: [-0.04, 0.0063, -0.05] });
  return m.finalizar('saco_plastico', [0, 0.004, -0.085], [0, 0.006, 0.085]);
};

const luva: Gerador = () => {
  const m = new Montador();
  const y = 0.012;
  m.add('silicone', caixaR(0.09, 0.024, 0.085, 0.011, 3), { p: [0, y, 0] });
  const dedos: [number, number, number][] = [[-0.03, 0.06, 0.02], [-0.01, 0.07, 0], [0.012, 0.068, 0], [0.032, 0.055, 0]];
  for (const [z, L, inc] of dedos) m.add('silicone', new THREE.CapsuleGeometry(0.0095, L, 4, 8).rotateZ(-PI / 2), { p: [0.045 + L / 2, y - 0.002, z], r: [0, inc, 0], s: [1, 0.85, 1] });
  m.add('silicone', new THREE.CapsuleGeometry(0.011, 0.045, 4, 8).rotateZ(-PI / 2), { p: [0.03, y - 0.002, -0.06], r: [0, 0.8, 0], s: [1, 0.85, 1] });
  m.add('silicone', tornoX([[0.034, -0.12], [0.036, -0.11], [0.034, -0.04]], 16), { p: [0, y, 0], s: [1, 0.4, 1.2], cor: COR.siliconeEscuro });
  return m.finalizar('luva', [-0.08, y, 0], [0.12, y, 0]);
};

const cartao: Gerador = () => {
  const m = new Montador();
  m.add('madeira', cilindro(0.15, 0.003, 56), { cor: COR.papelao });
  m.add('madeira', new THREE.CircleGeometry(0.149, 56).rotateX(-PI / 2), { p: [0, 0.0031, 0], cor: 0xeef1f4 });
  m.add('madeira', anel(0.14, 0.0008, 56, 3), { p: [0, 0.0032, 0], cor: COR.tecidoAzul });
  return m.finalizar('cartao', [0.15, 0.002, 0], [0, 0.003, 0]);
};

const caixaOvos: Gerador = () => {
  const m = new Montador();
  const w = 0.3;
  const d = 0.1;
  m.add('madeira', loftRet(w, d, 0.012, [[-0.004, 0], [0, 0.004], [0, 0.05]], 3), { cor: 0xbdb6a8 });
  m.add('madeira', fundoRet(w - 0.008, d - 0.008, 0.008, 0), { cor: 0xbdb6a8 });
  m.add('madeira', caixaR(w + 0.004, 0.012, d + 0.004, 0.005), { p: [0, 0.054, 0], cor: 0xc8c1b3 });
  for (let i = 0; i < 6; i++) for (const z of [-0.022, 0.022]) m.add('madeira', esfera(0.02, 10, 6), { p: [-0.125 + i * 0.05, 0.058, z], s: [1, 0.35, 1], cor: 0xc8c1b3 });
  m.add('cobalto', caixa(0.1, 0.0006, 0.03), { p: [0, 0.0605, 0], cor: COR.cobalto });
  return m.finalizar('caixa_ovos', [w / 2, 0.03, 0], [0, 0.065, 0]);
};

const esteira: Gerador = () => {
  const m = new Montador();
  const L = 0.24;
  for (let k = 0; k < 28; k++) m.add('madeira', cilZ(0.0022, L, 6), { p: [-L / 2 + 0.004 + k * 0.00855, 0.0022, 0], cor: k % 2 ? COR.bambu : 0xcdb672 });
  for (const z of [-0.09, -0.03, 0.03, 0.09]) m.add('madeira', cilX(0.0008, L, 4), { p: [-L / 2, 0.0042, z], cor: COR.barbante });
  return m.finalizar('esteira', [-L / 2, 0.003, 0], [0, 0.0045, 0]);
};

const escova: Gerador = () => {
  const m = new Montador();
  m.add('madeira', caixaR(0.11, 0.028, 0.05, 0.01, 3), { p: [0, 0.03, 0] });
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
    m.add('silicone', cilindro(0.0035, 0.017, 6, 0.0045), { p: [-0.045 + i * 0.015, 0, -0.014 + j * 0.014], cor: COR.marinho });
  }
  return m.finalizar('escova', [0, 0.044, 0], [0, 0, 0]);
};

const regua: Gerador = () => {
  const m = new Montador();
  m.add('inox', caixaR(0.31, 0.002, 0.032, 0.0008), { p: [0.155, 0.001, 0], cor: COR.inoxClaro });
  for (let k = 0; k <= 30; k++) m.add('petroleo', caixa(0.0006, 0.0003, k % 5 ? 0.005 : 0.009), { p: [0.005 + k * 0.01, 0.0021, -0.016 + (k % 5 ? 0.0025 : 0.0045)], cor: COR.marinho });
  m.add('inoxEscuro', new THREE.CircleGeometry(0.003, 10).rotateX(-PI / 2), { p: [0.3, 0.0021, 0.006] });
  return m.finalizar('regua', [0.05, 0.002, 0], [0.31, 0.001, 0]);
};

const lapis: Gerador = () => {
  const m = new Montador();
  const r = 0.0038;
  m.add('cobalto', new THREE.CylinderGeometry(r, r, 0.15, 6).rotateZ(-PI / 2), { p: [0.075, r, 0] });
  m.add('madeira', new THREE.ConeGeometry(r * 0.95, 0.018, 6).rotateZ(-PI / 2), { p: [0.159, r, 0] });
  m.add('inoxEscuro', new THREE.ConeGeometry(0.0011, 0.004, 6).rotateZ(-PI / 2), { p: [0.1675, r, 0], cor: COR.preto });
  m.add('inox', cilX(r * 1.02, 0.008, 10), { p: [-0.008, r, 0] });
  m.add('silicone', cilX(r * 0.98, 0.007, 10), { p: [-0.015, r, 0], cor: 0xf0a0a8 });
  return m.finalizar('lapis', [0.06, r, 0], [0.1695, r, 0]);
};

const fita: Gerador = () => {
  const m = new Montador();
  m.add('vidro', torno([[0.025, 0], [0.036, 0], [0.036, 0.019], [0.025, 0.019], [0.025, 0]], 36), { cor: 0xd6e6c8 });
  m.add('madeira', torno([[0.021, 0], [0.025, 0], [0.025, 0.019], [0.021, 0.019], [0.021, 0]], 28), { cor: COR.papelao });
  m.add('vidro', caixa(0.03, 0.019, 0.0006), { p: [0.038, 0.0095, 0.012], r: [0, -0.5, 0], cor: 0xd6e6c8 });
  return m.finalizar('fita', [0, 0.019, 0.03], [0.05, 0.0095, 0.025]);
};

const clipe: Gerador = () => {
  const m = new Montador();
  const r = 0.0005;
  const pts: V3[] = [
    [0.03, r, 0.0], [0.0, r, 0.0], ...arco(0.0, 0.0035, 0.0035, -PI / 2, -1.5 * PI, 6).map(([x, z]) => [x, r, z] as V3),
    [0.028, r, 0.007], ...arco(0.028, 0.0045, 0.0025, PI / 2, -PI / 2, 5).map(([x, z]) => [x, r, z] as V3),
    [0.004, r, 0.002],
  ];
  m.add('inox', tubo(pts, r, 64, 4));
  return m.finalizar('clipe', [0.015, r, 0.004], [0.03, r, 0]);
};

const peso: Gerador = () => {
  const m = new Montador();
  m.add('inoxEscuro', torno([[0, 0], [0.045, 0], [0.048, 0.004], [0.048, 0.036], [0.042, 0.042], [0, 0.042]], 32), { cor: COR.ferro });
  m.add('inoxEscuro', anel(0.0482, 0.0012, 32, 3), { p: [0, 0.03, 0], cor: COR.petroleo });
  m.add('inox', tubo([[-0.02, 0.042, 0], [-0.014, 0.062, 0], [0.014, 0.062, 0], [0.02, 0.042, 0]], 0.004, 14, 6));
  return m.finalizar('peso', [0, 0.062, 0], [0, 0, 0]);
};

const borrifador: Gerador = () => {
  const m = new Montador();
  m.add('vidro', torno([[0, 0], [0.032, 0], [0.034, 0.006], [0.034, 0.14], [0.02, 0.16], [0.014, 0.165]], 28));
  m.add('inox', cilindro(0.0018, 0.15, 6), { p: [0.006, 0.005, 0] });
  m.add('cobalto', cilindro(0.017, 0.02, 20), { p: [0, 0.162, 0] });
  m.add('cobalto', caixaR(0.07, 0.03, 0.026, 0.008), { p: [0.018, 0.195, 0] });
  m.add('inoxEscuro', cilX(0.004, 0.008, 10), { p: [0.053, 0.198, 0], cor: COR.preto });
  m.add('petroleo', tubo([[0.035, 0.18, 0], [0.04, 0.15, 0], [0.032, 0.12, 0]], 0.005, 10, 6).scale(1, 1, 1.6), { cor: COR.marinho });
  return m.finalizar('borrifador', [0.0, 0.09, 0], [0.061, 0.198, 0]);
};

/* ================================================================== */
/* Eletroportáteis                                                     */
/* ================================================================== */

/** Lâmina em S (processador, liquidificador). */
function laminaS(m: Montador, y: number, R: number): void {
  m.add('inox', cilindro(0.007, 0.04, 12), { p: [0, y - 0.02, 0] });
  for (const a of [0, PI]) m.add('inox', caixa(R, 0.0016, 0.012), { p: [Math.cos(a) * R * 0.5, y + (a ? 0.004 : 0), Math.sin(a) * R * 0.5], r: [0.25, a + 0.3, 0], cor: COR.inoxClaro });
}

const processador: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', caixaR(0.2, 0.1, 0.18, 0.02, 3), { p: [0, 0.05, 0] });
  m.add('inox', cilindro(0.012, 0.012, 14), { p: [0.05, 0.035, 0.09], r: [PI / 2, 0, 0], cor: COR.inoxClaro });
  m.add('petroleo', caixaR(0.04, 0.014, 0.004, 0.003), { p: [-0.04, 0.035, 0.091], cor: COR.marinho });
  recipiente(m, { fora: perfilReto(0.085, 0.15, 0.01), esp: 0.003, matFora: 'vidro', corFora: COR.vidro, p: [0, 0.1, 0], borda: null });
  laminaS(m, 0.13, 0.07);
  m.add('vidro', cilindro(0.088, 0.008, 36), { p: [0, 0.25, 0] });
  m.add('vidro', cilindro(0.028, 0.08, 20, 0.028, true), { p: [0.035, 0.258, 0] });
  m.add('cobalto', cilindro(0.025, 0.1, 18), { p: [0.035, 0.27, 0], cor: COR.cobaltoClaro });
  m.add('vidro', caixaR(0.025, 0.12, 0.03, 0.01), { p: [-0.1, 0.17, 0] });
  return m.finalizar('processador', [-0.1, 0.17, 0], [0, 0.13, 0]);
};

const liquidificador: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', loftRet(0.17, 0.17, 0.03, [[0, 0], [-0.012, 0.11]], 4));
  m.add('cobalto', fundoRet(0.146, 0.146, 0.018, 0.11));
  m.add('inox', loftRet(0.17, 0.17, 0.03, [[0.0005, 0.005], [0.0005, 0.02]], 4), { cor: COR.inoxClaro });
  for (let k = 0; k < 3; k++) m.add('ceramica', cilindro(0.007, 0.004, 12), { p: [-0.03 + k * 0.03, 0.06, 0.083], r: [PI / 2, 0, 0] });
  m.add('vidro', loftRet(0.12, 0.12, 0.025, [[-0.01, 0.11], [0, 0.14], [0.012, 0.37]], 4));
  m.add('vidro', fundoRet(0.1, 0.1, 0.015, 0.112));
  laminaS(m, 0.13, 0.06);
  m.add('petroleo', loftRet(0.12, 0.12, 0.025, [[0.014, 0.368], [0.014, 0.385], [0, 0.39]], 4), { cor: COR.marinho });
  m.add('petroleo', fundoRet(0.12, 0.12, 0.025, 0.39), { cor: COR.marinho });
  m.add('vidro', tubo([[-0.07, 0.33, 0], [-0.115, 0.31, 0], [-0.115, 0.18, 0], [-0.068, 0.16, 0]], 0.01, 16, 8), { cor: 0xcfe6f5 });
  for (let k = 0; k < 8; k++) m.add('cobalto', caixa(0.0006, 0.0015, k % 2 ? 0.012 : 0.02), { p: [0.068 + k * 0.0006, 0.17 + k * 0.022, 0], r: [0, PI / 2, 0] });
  return m.finalizar('liquidificador', [-0.115, 0.25, 0], [0, 0.13, 0]);
};

const batedeira: Gerador = () => {
  const m = new Montador();
  // a batedeira é a única peça vermelha da cozinha: vermelho-cereja esmaltado, um charme no meio do azul
  const vermelho = 0xc81d2e;
  m.add('cobalto', caixaR(0.32, 0.05, 0.19, 0.02), { p: [0, 0.025, 0], cor: vermelho });
  m.add('cobalto', caixaR(0.09, 0.22, 0.12, 0.035), { p: [-0.11, 0.15, 0], cor: vermelho });
  m.add('cobalto', new THREE.CapsuleGeometry(0.06, 0.2, 4, 14).rotateZ(PI / 2), { p: [-0.01, 0.29, 0], s: [1, 0.9, 1], cor: vermelho });
  m.add('inox', anel(0.061, 0.004, 28, 5).rotateZ(PI / 2), { p: [0.04, 0.29, 0], s: [1, 0.9, 1] });
  m.add('inox', cilX(0.018, 0.02, 16), { p: [0.16, 0.29, 0] });
  m.add('petroleo', caixaR(0.03, 0.012, 0.01, 0.004), { p: [-0.1, 0.25, 0.062], cor: COR.marinho });
  recipiente(m, { fora: perfilTigela(0.105, 0.15, 0.06), esp: 0.002, matFora: 'inox', corFora: COR.inoxClaro, p: [0.04, 0.05, 0], borda: { mat: 'inox', r: 0.003 }, seg: 28 });
  // batedor balão pendurado no cabeçote
  m.add('inox', cilindro(0.006, 0.04, 10), { p: [0.04, 0.2, 0] });
  for (let k = 0; k < 4; k++) {
    const phi = (k / 4) * PI;
    const pts: V3[] = [];
    for (let i = -6; i <= 6; i++) {
      const th = (i / 6) * (PI / 2);
      const hz = 0.036 * Math.sin(th);
      pts.push([0.04 + hz * Math.cos(phi), 0.2 - 0.13 * Math.cos(th), hz * Math.sin(phi)]);
    }
    m.add('inox', tubo(pts, 0.0012, 24, 4), { cor: COR.inoxClaro });
  }
  return m.finalizar('batedeira', [-0.11, 0.2, 0], [0.04, 0.068, 0]);
};

const maquinaMassa: Gerador = () => {
  const m = new Montador();
  const w = 0.18;
  const h = 0.13;
  const d = 0.16;
  m.add('inox', caixaR(w, h, d, 0.01, 2), { p: [0, h / 2 + 0.02, 0], cor: COR.inoxClaro });
  m.add('inoxEscuro', caixa(w - 0.04, 0.002, 0.03), { p: [0, h + 0.0205, 0] });
  for (const z of [-0.008, 0.008]) m.add('inox', cilX(0.0085, w - 0.04, 20), { p: [-(w - 0.04) / 2, h + 0.013, z], cor: COR.inox });
  // manivela: cubo, braço inclinado para cima e manopla de madeira
  const yh = h * 0.6 + 0.02;
  m.add('inox', cilX(0.012, 0.02, 14), { p: [w / 2, yh, 0] });
  m.add('inox', caixaR(0.012, 0.11, 0.016, 0.004), { p: [w / 2 + 0.024, yh + 0.046, -0.019], r: [-0.4, 0, 0] });
  m.add('madeira', tornoX([[0.009, 0], [0.012, 0.01], [0.012, 0.05], [0.01, 0.06], [0, 0.062]], 12), { p: [w / 2 + 0.03, yh + 0.092, -0.039] });
  // botão de espessura
  m.add('petroleo', cilX(0.016, 0.014, 18), { p: [-w / 2 - 0.014, h * 0.75 + 0.02, 0], cor: COR.marinho });
  for (let k = 0; k < 8; k++) m.add('inox', caixa(0.003, 0.004, 0.003), { p: [-w / 2 - 0.0005, h * 0.75 + 0.02 + Math.cos(k * 0.8) * 0.022, Math.sin(k * 0.8) * 0.022] });
  // presilha (grampo) de mesa, rente à base
  m.add('inox', caixaR(0.04, 0.02, 0.05, 0.004), { p: [0, 0.01, -d / 2 - 0.02] });
  m.add('petroleo', caixaR(0.05, 0.01, 0.014, 0.004), { p: [0, 0.026, -d / 2 - 0.03], cor: COR.marinho });
  return m.finalizar('maquina_massa', [w / 2 + 0.06, yh + 0.092, -0.039], [0, h + 0.022, 0]);
};

const microondas: Gerador = () => {
  // caixa com a porta aberta para o lado, janela escura, prato giratório de vidro no meio e painel de botões
  const m = new Montador();
  const w = 0.46, h = 0.27, d = 0.34;
  m.add('inoxEscuro', caixaR(w, 0.012, d, 0.004), { p: [0, h, 0] });
  m.add('inoxEscuro', caixaR(w, 0.012, d, 0.004), { p: [0, 0.006, 0] });
  m.add('inoxEscuro', caixaR(0.012, h, d, 0.004), { p: [-w / 2, h / 2, 0] });
  m.add('inoxEscuro', caixaR(0.012, h, d, 0.004), { p: [w * 0.22, h / 2, 0] });
  m.add('inoxEscuro', caixaR(w * 0.22, h, d, 0.006), { p: [w * 0.39, h / 2, 0], cor: COR.marinho });
  m.add('inoxEscuro', caixaR(w * 0.72, h, 0.01, 0.004), { p: [-w * 0.14, h / 2, -d / 2] });
  // interior claro
  m.add('ceramica', caixa(w * 0.68, 0.002, d * 0.9), { p: [-w * 0.14, 0.014, 0] });
  // prato giratório
  m.add('vidro', cilindro(0.12, 0.006, 28), { p: [-w * 0.14, 0.02, 0] });
  // botões e visor
  m.add('vidro', caixa(w * 0.14, 0.03, 0.004), { p: [w * 0.39, h * 0.8, d / 2 + 0.002], cor: 0x0e1a2b });
  for (let i = 0; i < 6; i++) m.add('ceramica', caixa(0.022, 0.016, 0.006), { p: [w * 0.36 + (i % 2) * 0.034, h * 0.62 - Math.floor(i / 2) * 0.03, d / 2 + 0.003] });
  // porta aberta: quadro com a janela escura, girada sobre a dobradiça da esquerda
  const porta = new THREE.Group();
  const quadro = caixaR(w * 0.74, h * 0.96, 0.03, 0.006);
  m.add('inoxEscuro', quadro, { p: [-w / 2 - 0.02, h / 2, d / 2 + w * 0.37], r: [0, Math.PI / 2 - 0.15, 0] });
  m.add('vidro', caixa(w * 0.5, h * 0.62, 0.004), { p: [-w / 2 - 0.04, h / 2, d / 2 + w * 0.37], r: [0, Math.PI / 2 - 0.15, 0], cor: 0x101820 });
  void porta;
  return m.finalizar('microondas', [w * 0.39, h * 0.4, d / 2], [-w * 0.14, 0.024, 0]);
};

const churrasqueira: Gerador = () => {
  // churrasqueira de bola: bacia escura sobre pés, brasas acesas no fundo e a grelha por cima
  const m = new Montador();
  const R = 0.26, y0 = 0.42;
  m.add('inoxEscuro', torno([[0, y0], [R * 0.5, y0 + 0.01], [R * 0.85, y0 + 0.06], [R, y0 + 0.15], [R * 1.01, y0 + 0.17], [R * 0.97, y0 + 0.17], [R * 0.82, y0 + 0.07], [0, y0 + 0.02]], 48), { cor: COR.ferro });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    m.add('inox', cilindro(0.012, y0, 10), { p: [Math.cos(a) * R * 0.6, y0 / 2, Math.sin(a) * R * 0.6], r: [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12] });
  }
  // brasas
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39, r = R * 0.6 * Math.sqrt((i + 0.5) / 26);
    m.add('ceramica', esfera(0.022 + (i % 3) * 0.004, 8, 6), { p: [Math.cos(a) * r, y0 + 0.05 + (i % 2) * 0.008, Math.sin(a) * r], cor: i % 4 === 0 ? 0xff7a1a : i % 3 === 0 ? 0xc0391b : 0x2a2420 });
  }
  // grelha
  m.add('inox', anel(R * 0.94, 0.004, 48, 5), { p: [0, y0 + 0.13, 0], r: [Math.PI / 2, 0, 0] });
  for (let i = -6; i <= 6; i++) m.add('inox', cilX(0.0025, 2 * Math.sqrt(Math.max(0, (R * 0.94) ** 2 - (i * 0.036) ** 2)), 6), { p: [0, y0 + 0.13, i * 0.036] });
  return m.finalizar('churrasqueira', [R, y0 + 0.13, 0], [0, y0 + 0.135, 0]);
};

const sorveteira: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', torno([[0, 0], [0.11, 0], [0.115, 0.01], [0.115, 0.18], [0.105, 0.19]], 40));
  m.add('inox', torno([[0.09, 0.19], [0.09, 0.05], [0, 0.05]], 36), { cor: COR.inoxClaro });
  m.add('inox', anel(0.1, 0.01, 40, 5), { p: [0, 0.19, 0] });
  m.add('vidro', torno([[0.105, 0.19], [0.1, 0.2], [0.05, 0.215], [0, 0.216]], 36));
  m.add('cobalto', caixaR(0.08, 0.05, 0.1, 0.02, 3), { p: [0, 0.24, 0], cor: COR.cobaltoClaro });
  m.add('silicone', caixaR(0.012, 0.11, 0.05, 0.004), { p: [0.02, 0.12, 0], cor: COR.marinho });
  m.add('ceramica', cilindro(0.008, 0.004, 12), { p: [0, 0.265, 0.02] });
  return m.finalizar('sorveteira', [0.115, 0.12, 0], [0, 0.06, 0]);
};

const mixer: Gerador = () => {
  const m = new Montador();
  const y = 0.034;
  m.add('cobalto', tornoX([[0, -0.21], [0.026, -0.205], [0.032, -0.16], [0.03, -0.06], [0.024, -0.01], [0.022, 0]], 24), { p: [0, y, 0] });
  m.add('petroleo', caixaR(0.03, 0.006, 0.014, 0.003), { p: [-0.12, y + 0.03, 0], cor: COR.marinho });
  m.add('inox', cilX(0.014, 0.17, 16, 0.012), { p: [0, y, 0], cor: COR.inoxClaro });
  m.add('inox', torno([[0.012, 0], [0.028, 0.022], [0.034, 0.04], [0.033, 0.042]], 28).rotateZ(-PI / 2), { p: [0.17, y, 0], cor: COR.inoxClaro });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * 2 * PI + PI / 4;
    m.add('inoxEscuro', caixa(0.014, 0.0006, 0.008), { p: [0.18, y + Math.cos(a) * 0.022, Math.sin(a) * 0.022], r: [-a, 0, -0.75 * Math.cos(a)] });
  }
  m.add('inox', caixa(0.002, 0.044, 0.01), { p: [0.2, y, 0], r: [0.4, 0, 0] });
  return m.finalizar('mixer', [-0.1, y, 0], [0.212, y, 0]);
};

const moedor: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', torno([[0, 0], [0.044, 0], [0.046, 0.005], [0.046, 0.11], [0.042, 0.115]], 32));
  m.add('inox', anel(0.043, 0.003, 32, 4), { p: [0, 0.115, 0] });
  m.add('vidro', torno([[0.044, 0.115], [0.044, 0.135], [0.03, 0.155], [0, 0.158]], 32));
  m.add('petroleo', caixaR(0.012, 0.02, 0.008, 0.003), { p: [0, 0.08, 0.047], cor: COR.marinho });
  return m.finalizar('moedor', [0.046, 0.06, 0], [0, 0.12, 0]);
};

const moedorCarne: Gerador = () => {
  const m = new Montador();
  const y = 0.12;
  m.add('inox', cilX(0.03, 0.14, 24), { p: [-0.06, y, 0], cor: COR.inoxClaro });
  m.add('inox', torno([[0.022, 0], [0.026, 0.03], [0.06, 0.07], [0.062, 0.075]], 28), { p: [-0.01, y + 0.02, 0], cor: COR.inoxClaro });
  m.add('inox', anel(0.061, 0.003, 32, 4), { p: [-0.01, y + 0.095, 0] });
  m.add('inox', cilX(0.036, 0.012, 24), { p: [0.08, y, 0] });
  for (const [a, b] of hexDentro(0.022, 0.008)) m.add('inoxEscuro', new THREE.CircleGeometry(0.0022, 6).rotateY(PI / 2), { p: [0.0925, y + a, b] });
  m.add('inox', cilX(0.006, 0.04, 10), { p: [-0.1, y, 0] });
  m.add('inox', caixaR(0.012, 0.12, 0.016, 0.004), { p: [-0.1, y - 0.05, 0.0], r: [0, 0, 0] });
  m.add('madeira', cilZ(0.01, 0.06, 12), { p: [-0.1, y - 0.1, 0.03], cor: COR.marinho });
  m.add('inox', caixaR(0.05, 0.08, 0.04, 0.006), { p: [-0.02, y - 0.06, 0] });
  m.add('inox', cilindro(0.005, 0.03, 10), { p: [-0.02, 0.0, 0] });
  m.add('petroleo', caixaR(0.05, 0.008, 0.012, 0.003), { p: [-0.02, 0.004, 0], cor: COR.marinho });
  return m.finalizar('moedor_carne', [-0.1, y - 0.1, 0.05], [0.093, y, 0]);
};

const macarico: Gerador = () => {
  const m = new Montador();
  m.add('cobalto', torno([[0, 0], [0.03, 0], [0.032, 0.006], [0.032, 0.12], [0.022, 0.135], [0.012, 0.138]], 28));
  m.add('silicone', cilindro(0.033, 0.012, 28), { cor: COR.marinho });
  m.add('inox', caixaR(0.05, 0.05, 0.03, 0.008), { p: [0.006, 0.16, 0] });
  m.add('inox', cilX(0.008, 0.09, 14, 0.0065), { p: [0.02, 0.172, 0], r: [0, 0, -0.35], cor: COR.inoxClaro });
  m.add('inoxEscuro', cilX(0.0068, 0.012, 12), { p: [0.1, 0.143, 0], r: [0, 0, -0.35], cor: COR.ferro });
  m.add('petroleo', caixaR(0.012, 0.03, 0.014, 0.004), { p: [-0.012, 0.15, 0], r: [0, 0, 0.3], cor: COR.marinho });
  m.add('petroleo', cilZ(0.008, 0.034, 12), { p: [0.006, 0.188, 0], cor: COR.marinho });
  return m.finalizar('macarico', [0, 0.08, 0], [0.115, 0.138, 0]);
};

/* ================================================================== */
/* Miudezas                                                            */
/* ================================================================== */

const boleador: Gerador = () => {
  const m = new Montador();
  const y = 0.013;
  m.add('inox', tornoX([[0.003, -0.06], [0.006, -0.05], [0.006, 0.05], [0.003, 0.06]], 10), { p: [0, y, 0], cor: COR.inoxClaro });
  m.add('petroleo', tornoX([[0.0065, -0.035], [0.0075, -0.03], [0.0075, 0.03], [0.0065, 0.035]], 10), { p: [0, y, 0], cor: COR.marinho });
  for (const [x, r] of [[0.072, 0.013], [-0.068, 0.009]] as [number, number][]) {
    m.add('inox', cuia(18, 7), { p: [x, y, 0], s: [r, r, r], cor: COR.inoxClaro });
    m.add('inox', anel(r, 0.0008, 20, 3), { p: [x, y, 0] });
  }
  return m.finalizar('boleador', [0, y, 0], [0.085, y, 0]);
};

const separador: Gerador = () => {
  const m = new Montador();
  const R = 0.04;
  const P = 0.018;
  m.add('cobalto', cuia(28, 8), { p: [0, P, 0], s: [R, P, R] });
  m.add('cobalto', anel(R, 0.0022, 36, 4), { p: [0, P, 0], cor: COR.cobaltoClaro });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * 2 * PI;
    m.add('ceramica', caixa(0.014, 0.0006, 0.0025), { p: [Math.cos(a) * R * 0.78, P * 0.42, Math.sin(a) * R * 0.78], r: [0, -a, Math.cos(a) * 0.5], cor: COR.creme });
  }
  m.add('cobalto', caixaR(0.08, 0.004, 0.022, 0.002), { p: [-R - 0.035, P, 0] });
  m.add('cobalto', caixaR(0.01, 0.012, 0.03, 0.002), { p: [R + 0.006, P - 0.005, 0], cor: COR.cobaltoClaro });
  return m.finalizar('separador', [-R - 0.05, P, 0], [0, 0.004, 0]);
};

const martelo: Gerador = () => {
  const m = new Montador();
  const hh = 0.04;
  m.add('inox', caixaR(0.05, hh, 0.05, 0.004), { p: [0.025, 0.006 + hh / 2, 0], cor: COR.inoxClaro });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    m.add('inox', new THREE.ConeGeometry(0.0055, 0.006, 4).rotateX(PI).rotateY(PI / 4), { p: [0.007 + i * 0.012, 0.003, -0.018 + j * 0.012] });
  }
  m.add('inox', caixaR(0.012, 0.016, 0.02, 0.003), { p: [-0.004, 0.026, 0] });
  cabo(m, { x0: -0.2, x1: -0.008, y: 0.026, alt: 0.024, larg: 0.024, mat: 'madeira', cor: COR.madeira, perfil: 'reto', furo: true });
  return m.finalizar('martelo', [-0.1, 0.026, 0], [0.025, 0, 0]);
};

const quebrador: Gerador = () => {
  const m = new Montador();
  const y = 0.008;
  for (const s of [-1, 1]) {
    m.add('inox', caixaR(0.17, 0.01, 0.012, 0.004), { p: [-0.07, y, s * 0.012], r: [0, -s * 0.1, 0], cor: COR.inoxClaro });
    for (let k = 0; k < 5; k++) m.add('inoxEscuro', caixa(0.003, 0.009, 0.003), { p: [0.0 + k * 0.006, y, s * 0.004], r: [0, PI / 4, 0] });
  }
  m.add('inox', cilindro(0.008, 0.014, 14), { p: [0.03, 0.001, 0] });
  m.add('inox', tubo([[0.03, y, -0.008], [0.045, y, 0], [0.03, y, 0.008]], 0.004, 8, 5));
  return m.finalizar('quebrador', [-0.12, y, 0], [0.012, y, 0]);
};

/* ================================================================== */
/* Mão (luva azul-clara com punho de manga)                            */
/* ================================================================== */

// Mão direita estilizada de luva de cozinha azul-clara, em tamanho real (cerca
// de 18 cm do punho à ponta do dedo médio). Fica deitada ao longo de X com os
// dedos para +X, as costas da mão para +Y e o polegar em -Z. A pega fica no
// punho, dentro da manga, e a ponta ativa na ponta do dedo que trabalha.

const COR_LUVA = 0xa9d5f3;
const COR_MANGA = COR.tecidoAzul;
const GRAU = PI / 180;

/**
 * Tubo varrido por uma curva com seção elíptica variável. `perfil(t)` devolve
 * [meia largura, meia espessura]; `lado` aponta a largura (as costas ficam em
 * lado × tangente). Raio zero nas pontas fecha o tubo.
 */
function varrer(pts: V3[], perfil: (t: number) => [number, number], lado: V3, nL = 16, nR = 10, dist = 1.5): THREE.BufferGeometry {
  const curva = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const L = new THREE.Vector3(lado[0], lado[1], lado[2]).normalize();
  const pos: number[] = [];
  const S = new THREE.Vector3();
  const U = new THREE.Vector3();
  for (let i = 0; i <= nL; i++) {
    const u = i / nL;
    // anéis mais juntos perto do fim (ponta arredondada)
    const t = 1 - Math.pow(1 - u, dist);
    const P = curva.getPointAt(t);
    const T = curva.getTangentAt(t);
    S.copy(L).addScaledVector(T, -L.dot(T)).normalize();
    U.crossVectors(S, T).normalize();
    const [rs, ru] = perfil(t);
    for (let j = 0; j < nR; j++) {
      const a = (j / nR) * PI * 2;
      const c = Math.cos(a) * Math.max(rs, 1e-4);
      const s = Math.sin(a) * Math.max(ru, 1e-4);
      pos.push(P.x + S.x * c + U.x * s, P.y + S.y * c + U.y * s, P.z + S.z * c + U.z * s);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nL; i++) {
    for (let j = 0; j < nR; j++) {
      const j2 = (j + 1) % nR;
      const a = i * nR + j;
      const b = i * nR + j2;
      const c = (i + 1) * nR + j;
      const d = (i + 1) * nR + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Fator de tampa redonda: 1 no meio, cai como um quarto de círculo no começo (c0) e no fim (c1). */
function tampaRedonda(t: number, c0: number, c1: number): number {
  let f = 1;
  if (c0 > 0 && t < c0) f *= Math.sqrt(Math.max(0, 1 - ((c0 - t) / c0) ** 2));
  if (c1 > 0 && t > 1 - c1) f *= Math.sqrt(Math.max(0, 1 - ((t - (1 - c1)) / c1) ** 2));
  return f;
}

interface DedoCfg {
  /** Junta da base (nó do dedo), em coordenadas da mão. */
  base: V3;
  /** Comprimento do dedo a partir do nó. */
  L: number;
  /** Abertura em Z (radianos, positivo para o lado do mindinho). */
  abre: number;
  /** Dobra acumulada de cada falange (graus, para baixo). */
  dobra: [number, number, number];
  /** Meia largura e meia espessura no nó. */
  r: [number, number];
}

/** Pontos do eixo do dedo: entra 1,6 cm na palma e segue pelas três falanges. */
function eixoDedo(c: DedoCfg): V3[] {
  const fr = [0.45, 0.32, 0.23];
  const [bx, by, bz] = c.base;
  const ca = Math.cos(c.abre);
  const sa = Math.sin(c.abre);
  const pts: V3[] = [[bx - 0.016 * ca, by + 0.002, bz - 0.016 * sa], [bx, by, bz]];
  let p: V3 = [bx, by, bz];
  for (let k = 0; k < 3; k++) {
    const a = c.dobra[k] * GRAU;
    const l = fr[k] * c.L;
    // a falange da ponta ganha um ponto no meio para a curva ficar macia
    const passos = k === 2 ? 2 : 1;
    for (let q = 0; q < passos; q++) {
      const lq = l / passos;
      p = [p[0] + Math.cos(a) * ca * lq, p[1] - Math.sin(a) * lq, p[2] + Math.cos(a) * sa * lq];
      pts.push(p);
    }
  }
  return pts;
}

/** Desenha um dedo e devolve o ponto da ponta. */
function dedo(m: Montador, c: DedoCfg): V3 {
  const pts = eixoDedo(c);
  // comprimento aproximado do eixo, para a tampa da ponta ser meia esfera
  let comp = 0;
  for (let i = 1; i < pts.length; i++) comp += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  const [rs0, ru0] = c.r;
  const cPonta = Math.min(0.45, (rs0 * 0.85) / comp);
  const perfil = (t: number): [number, number] => {
    // afina para a ponta, com leve inchaço nas juntas
    const afina = 1 - 0.13 * t;
    const junta = 1 + 0.05 * Math.exp(-(((t - 0.62) / 0.06) ** 2));
    const f = afina * junta * tampaRedonda(t, 0.12, cPonta);
    return [rs0 * f, ru0 * f];
  };
  const lado: V3 = [-Math.sin(c.abre), 0, Math.cos(c.abre)];
  m.add('silicone', varrer(pts, perfil, lado, 16, 10), { cor: COR_LUVA });
  return pts[pts.length - 1];
}

/** Palma, punho e manga, comuns às duas variantes. */
function palmaEManga(m: Montador): void {
  // palma: varrida do punho aos nós, larga em Z e achatada em Y
  const palma = varrer(
    [[-0.012, 0.034, 0.002], [0.03, 0.032, 0.001], [0.07, 0.029, 0], [0.104, 0.026, 0]],
    (t) => {
      const larg = 0.028 + 0.015 * sm(t / 0.55) - 0.004 * sm((t - 0.8) / 0.2);
      const esp = 0.0165 - 0.005 * sm((t - 0.4) / 0.6);
      const f = tampaRedonda(t, 0, 0.13);
      return [larg * f, esp * Math.max(f, 0.2 + 0.8 * f)];
    },
    [0, 0, 1],
    18,
    16,
    1.2,
  );
  m.add('silicone', palma, { cor: COR_LUVA });
  // punho da luva entrando na manga
  m.add('silicone', tornoX([[0.027, -0.03], [0.028, -0.012], [0.027, 0.004]], 16), { p: [0, 0.034, 0.002], s: [1, 0.64, 1], cor: COR_LUVA });
  // manga de tecido azul com a bainha dobrada
  m.add('madeira', tornoX([[0.0005, -0.075], [0.036, -0.074], [0.037, -0.03], [0.036, -0.012], [0.03, -0.011]], 18), {
    p: [0, 0.034, 0.002], s: [1, 0.72, 1], cor: COR_MANGA,
  });
  m.add('madeira', new THREE.TorusGeometry(0.0345, 0.0045, 6, 22).rotateY(PI / 2), {
    p: [-0.013, 0.034, 0.002], s: [1, 0.72, 1], cor: 0x4c7dba,
  });
}

/** Mão aberta, palma para baixo e dedos levemente curvados: sovar, achatar, esfregar, espalhar. */
const mao: Gerador = () => {
  const m = new Montador();
  palmaEManga(m);
  const dedos: DedoCfg[] = [
    { base: [0.099, 0.027, -0.0295], L: 0.072, abre: -0.1, dobra: [5, 15, 26], r: [0.0104, 0.0086] },
    { base: [0.103, 0.027, -0.009], L: 0.08, abre: -0.02, dobra: [5, 14, 25], r: [0.0106, 0.0088] },
    { base: [0.099, 0.027, 0.0105], L: 0.075, abre: 0.07, dobra: [6, 16, 27], r: [0.0102, 0.0084] },
    { base: [0.091, 0.026, 0.0295], L: 0.06, abre: 0.17, dobra: [7, 18, 29], r: [0.0092, 0.0076] },
  ];
  const pontas = dedos.map((d) => dedo(m, d));
  // polegar: nasce gordinho junto ao punho e se abre para o lado
  m.add('silicone', varrer(
    [[0.012, 0.027, -0.018], [0.04, 0.022, -0.04], [0.066, 0.017, -0.055], [0.08, 0.014, -0.064], [0.093, 0.012, -0.069]],
    (t) => {
      const f = tampaRedonda(t, 0.1, 0.13);
      const r = 0.0165 - 0.0062 * sm(t / 0.45);
      return [r * f, r * 0.82 * f];
    },
    [0.2, 0.75, 0.6], 18, 10,
  ), { cor: COR_LUVA });
  // ponta ativa na polpa do dedo médio (logo atrás da ponta, por baixo)
  const b = pontas[1];
  const ponta: V3 = [b[0] - 0.006, b[1] - 0.006, b[2]];
  return m.finalizar('mao', [-0.035, 0.034, 0.002], ponta, { palma: [0.06, 0.012, 0] });
};

/** Polegar e indicador em pinça, demais dedos dobrados: testar com o dedo, puxar o fio, separar. */
const maoPinca: Gerador = () => {
  const m = new Montador();
  palmaEManga(m);
  const indicador = dedo(m, { base: [0.099, 0.027, -0.0295], L: 0.072, abre: -0.12, dobra: [40, 75, 90], r: [0.0104, 0.0086] });
  const fechados: DedoCfg[] = [
    { base: [0.103, 0.027, -0.009], L: 0.074, abre: -0.02, dobra: [80, 160, 222], r: [0.0106, 0.0088] },
    { base: [0.099, 0.027, 0.0105], L: 0.07, abre: 0.05, dobra: [82, 162, 224], r: [0.0102, 0.0084] },
    { base: [0.091, 0.026, 0.0295], L: 0.056, abre: 0.12, dobra: [84, 165, 226], r: [0.0092, 0.0076] },
  ];
  for (const d of fechados) dedo(m, d);
  // polegar vem por baixo e encosta a ponta na do indicador
  const alvo: V3 = [indicador[0] - 0.004, indicador[1] + 0.004, indicador[2] - 0.0145];
  m.add('silicone', varrer(
    [[0.012, 0.027, -0.018], [0.045, 0.016, -0.045], [0.078, -0.002, -0.054], [alvo[0] - 0.016, alvo[1] + 0.004, alvo[2] - 0.006], alvo],
    (t) => {
      const f = tampaRedonda(t, 0.1, 0.1);
      const r = 0.0165 - 0.0062 * sm(t / 0.4);
      return [r * f, r * 0.82 * f];
    },
    [0.3, 0.9, 0.3], 18, 10,
  ), { cor: COR_LUVA });
  // ponta ativa no encontro das duas pontas
  const ponta: V3 = [(indicador[0] + alvo[0]) / 2, Math.min(indicador[1], alvo[1]) - 0.003, (indicador[2] + alvo[2]) / 2];
  return m.finalizar('mao_pinca', [-0.035, 0.034, 0.002], ponta);
};

/* ================================================================== */
/* Registro                                                            */
/* ================================================================== */

/** Todas as famílias com modelo, pelo id. */
export const GERADORES: Record<string, Gerador> = {
  // facas e lâminas
  faca_chef: facaChef,
  faca_legumes: facaLegumes,
  faca_desossar: facaDesossar,
  faca_file: facaFile,
  faca_pao: facaPao,
  cutelo,
  mezzaluna,
  faca_ostra: facaOstra,
  faca_canelle: facaCanelle,
  descascador,
  zester,
  escamador,
  descarocador,
  // tábuas
  tabua,
  tabua_giratoria: tabuaGiratoria,
  // tigelas e louça
  tigela,
  tigela_madeira: tigelaMadeira,
  ramequim,
  pote,
  copo,
  taca,
  garrafa,
  pilao,
  pesos_torta: pesosTorta,
  prato,
  pires,
  travessa,
  travessa_vidro: travessaVidro,
  // panelas
  panela: panelaMedia,
  cacarola,
  panela_funda: panelaFunda,
  panela_pesada: panelaPesada,
  panela_vapor: panelaVapor,
  panela_peixe: panelaPeixe,
  banho_maria: banhoMaria,
  chaleira,
  panela_fondue: panelaFondue,
  tagine,
  cuscuzeira,
  // frigideiras, wok e grelhas
  frigideira: frigideiraAnti,
  frigideira_ferro: frigideiraFerro,
  sauteuse,
  crepeira,
  omeleteira,
  wok,
  chapa,
  grelha,
  grade,
  suporte_peixe: suportePeixe,
  // assadeiras e fôrmas
  assadeira,
  forma_quadrada: formaQuadrada,
  forma_pao: formaPao,
  terrina,
  forma_bolo: formaBolo,
  timbale,
  charlotte,
  forminha,
  forma_brioche: formaBrioche,
  forminha_papel: forminhaPapel,
  aro,
  cortador,
  forma_desmontavel: formaDesmontavel,
  forma_torta: formaTorta,
  forma_furo: formaFuro,
  forma_muffin: formaMuffin,
  forma_pizza: formaPizza,
  forma_gelo: formaGelo,
  forma_ravioli: formaRavioli,
  forma_pastel: formaPastel,
  ninho,
  cone,
  funil,
  funil_torta: funilTorta,
  // peneiras e cestos
  peneira,
  chinois,
  escorredor,
  coador_pano: coadorPano,
  cesta_fritura: cestaFritura,
  centrifuga,
  cesta_bambu: cestaBambu,
  // utensílios de mão
  batedor,
  colher_pau: colherPau,
  colher,
  concha,
  escumadeira,
  colheres_medida: colheresMedida,
  espatula_reta: espatulaReta,
  espatula_angulada: espatulaAngulada,
  espatula_bolo: espatulaBolo,
  espatula_peixe: espatulaPeixe,
  espatula_silicone: espatulaSilicone,
  raspador,
  pinca,
  pegador,
  hashi,
  garfo_cozinha: garfoCozinha,
  garfo,
  garfo_fondue: garfoFondue,
  espeto_metal: espetoMetal,
  espeto_madeira: espetoMadeira,
  palito,
  vareta,
  agulha,
  barbante,
  // massa e confeitaria
  rolo,
  carretilha,
  saco_confeitar: sacoConfeitar,
  bico,
  pincel,
  // raladores e prensas
  ralador,
  ralador_plano: raladorPlano,
  mandolina,
  espremedor,
  reamer,
  amassador,
  espremedor_batata: espremedorBatata,
  mouli,
  // medição
  termometro_espeto: termometroEspeto,
  termometro_gordura: termometroGordura,
  termometro_acucar: termometroAcucar,
  balanca,
  jarra_medidora: jarraMedidora,
  // tesouras
  tesoura,
  tesoura_aves: tesouraAves,
  // folhas, panos e miudezas
  folha_manteiga: folhaManteiga,
  folha_aluminio: folhaAluminio,
  filme,
  papel_toalha: papelToalha,
  folha_papel_toalha: folhaPapelToalha,
  pano,
  folha_bananeira: folhaBananeira,
  saco_plastico: sacoPlastico,
  luva,
  mao,
  mao_pinca: maoPinca,
  cartao,
  caixa_ovos: caixaOvos,
  esteira,
  escova,
  regua,
  lapis,
  fita,
  clipe,
  peso,
  borrifador,
  boleador,
  separador,
  martelo,
  quebrador,
  // eletroportáteis
  processador,
  liquidificador,
  batedeira,
  maquina_massa: maquinaMassa,
  sorveteira,
  microondas,
  churrasqueira,
  mixer,
  moedor,
  moedor_carne: moedorCarne,
  macarico,
};
