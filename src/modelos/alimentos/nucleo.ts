// Núcleo geométrico dos alimentos: ruído, cores e três construtores de malha
// (corpo ao longo de X, torno em volta de Y e tubo ao longo de curva), todos
// baseados em anéis com polos fechados e normais suaves. No fim, `finalizar`
// junta as partes por acabamento, apoia a peça em y=0 e mede a seção
// transversal fatiando a própria geometria, para a tampa do corte bater.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FormaAlimento, Secao } from '../../tipos';
import { materialAlimento, type Acabamento } from './material';

export type RGB = [number, number, number];
/** Cor por vértice: posição local, parâmetro ao longo (t) e ângulo (a). */
export type CorFn = (x: number, y: number, z: number, t: number, a: number) => RGB;

export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const suave = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Cores                                                               */
/* ------------------------------------------------------------------ */

const _cor = new THREE.Color();
const cacheCor = new Map<string, RGB>();
/** Converte '#rrggbb' para RGB linear (espaço de trabalho do three). */
export function rgb(hex: string): RGB {
  let c = cacheCor.get(hex);
  if (!c) {
    _cor.set(hex);
    c = [_cor.r, _cor.g, _cor.b];
    cacheCor.set(hex, c);
  }
  return c;
}
export const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
export const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
export const cte = (c: RGB): CorFn => () => c;

/* ------------------------------------------------------------------ */
/* Aleatório e ruído determinísticos                                   */
/* ------------------------------------------------------------------ */

export function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  /** Número em [0, 1). */
  n(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Número em [a, b). */
  f(a: number, b: number): number {
    return a + (b - a) * this.n();
  }
  /** Inteiro em [a, b]. */
  i(a: number, b: number): number {
    return Math.floor(this.f(a, b + 1));
  }
}

function h3(i: number, j: number, k: number, s: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruído de valor 3D suave em [-1, 1]. */
export function ruido(x: number, y: number, z: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = lerp(h3(xi, yi, zi, s), h3(xi + 1, yi, zi, s), u);
  const b = lerp(h3(xi, yi + 1, zi, s), h3(xi + 1, yi + 1, zi, s), u);
  const c = lerp(h3(xi, yi, zi + 1, s), h3(xi + 1, yi, zi + 1, s), u);
  const d = lerp(h3(xi, yi + 1, zi + 1, s), h3(xi + 1, yi + 1, zi + 1, s), u);
  return lerp(lerp(a, b, v), lerp(c, d, v), w) * 2 - 1;
}

/** Duas oitavas de ruído. */
export function fbm(x: number, y: number, z: number, s = 0): number {
  return ruido(x, y, z, s) * 0.66 + ruido(x * 2.13 + 5.1, y * 2.13, z * 2.13, s + 17) * 0.34;
}

/** Ruído celular: distância ao ponto mais próximo (0 no centro da célula, ~1 na borda). */
export function celula(x: number, y: number, z: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let d1 = 9, d2 = 9;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const cx = xi + i, cy = yi + j, cz = zi + k;
        const px = cx + h3(cx, cy, cz, s), py = cy + h3(cx, cy, cz, s + 1), pz = cz + h3(cx, cy, cz, s + 2);
        const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
  return clamp(Math.sqrt(d1) / Math.max(1e-6, (Math.sqrt(d1) + Math.sqrt(d2)) * 0.5));
}

/** Pele com variação sutil de tom. */
export function pele(base: RGB, amp = 0.06, f = 40, s = 0): CorFn {
  return (x, y, z) => mul(base, 1 + amp * fbm(x * f, y * f, z * f, s));
}

/** Manchas de uma segunda cor por ruído. */
export function manchas(base: RGB, mancha: RGB, f: number, limiar: number, s = 0, amp = 0.05): CorFn {
  return (x, y, z) => {
    const n = fbm(x * f, y * f, z * f, s + 3);
    const k = suave(limiar, limiar + 0.12, n);
    return mul(mix(base, mancha, k), 1 + amp * ruido(x * f * 3, y * f * 3, z * f * 3, s));
  };
}

/** Pintas redondas (células com centro escuro). */
export function pintas(base: RGB, pinta: RGB, f: number, tam = 0.35, s = 0): CorFn {
  return (x, y, z) => {
    const c = celula(x * f, y * f, z * f, s + 9);
    return mix(base, pinta, 1 - suave(tam * 0.7, tam, c));
  };
}

/* ------------------------------------------------------------------ */
/* Malha de anéis                                                      */
/* ------------------------------------------------------------------ */

export interface Anel {
  c: THREE.Vector3;
  /** Direção do raio "ry" (ângulo 0). */
  u: THREE.Vector3;
  /** Direção do raio "rz" (ângulo 90 graus). Deve valer w = T x u, com T o avanço dos anéis. */
  w: THREE.Vector3;
  ry: number;
  rz: number;
  t: number;
  tampa?: boolean;
}

export interface OpcMalha {
  m: number;
  /** Expoente de superelipse da seção (2 = elipse, 8 = quase retângulo). */
  exp?: number;
  /** Multiplicador do raio por (t, ângulo). */
  mod?: (t: number, a: number) => number;
  /** Deformação livre do ponto já posicionado. */
  desloc?: (p: THREE.Vector3, t: number, a: number) => void;
  cor: CorFn;
  corTampa?: CorFn;
  polos?: [THREE.Vector3?, THREE.Vector3?];
  /** Liga o último anel ao primeiro, sem polos (toro). */
  fechado?: boolean;
}

export function malhaAneis(an: Anel[], o: OpcMalha): THREE.BufferGeometry {
  const m = o.m;
  const e = 2 / (o.exp ?? 2);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const empurra = (t: number, a: number, tampa: boolean) => {
    if (o.desloc) o.desloc(p, t, a);
    const f = tampa && o.corTampa ? o.corTampa : o.cor;
    const c = f(p.x, p.y, p.z, t, a);
    pos.push(p.x, p.y, p.z);
    col.push(clamp(c[0]), clamp(c[1]), clamp(c[2]));
  };
  const fechado = !!o.fechado;
  if (!fechado) {
    p.copy(o.polos?.[0] ?? an[0].c);
    empurra(an[0].t, 0, !!an[0].tampa);
  }
  for (const r of an) {
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const sc = Math.sign(ca) * Math.abs(ca) ** e;
      const ss = Math.sign(sa) * Math.abs(sa) ** e;
      const k = o.mod ? o.mod(r.t, a) : 1;
      p.copy(r.c).addScaledVector(r.u, r.ry * sc * k).addScaledVector(r.w, r.rz * ss * k);
      empurra(r.t, a, !!r.tampa);
    }
  }
  const b0 = fechado ? 0 : 1;
  const base = (i: number) => b0 + i * m;
  const L = an.length;
  if (!fechado) for (let j = 0; j < m; j++) idx.push(0, base(0) + ((j + 1) % m), base(0) + j);
  const nq = fechado ? L : L - 1;
  for (let i = 0; i < nq; i++) {
    const i2 = (i + 1) % L;
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = base(i) + j, b = base(i) + j2, c = base(i2) + j, d = base(i2) + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (!fechado) {
    const ult = b0 + L * m;
    p.copy(o.polos?.[1] ?? an[L - 1].c);
    empurra(an[L - 1].t, 0, !!an[L - 1].tampa);
    for (let j = 0; j < m; j++) idx.push(base(L - 1) + j, base(L - 1) + ((j + 1) % m), ult);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Corpo ao longo de X                                                 */
/* ------------------------------------------------------------------ */

export interface Perfil {
  ry: number;
  rz: number;
  cy?: number;
  cz?: number;
  /** Deslocamento axial do anel. */
  dx?: number;
}

export interface OpcCorpo extends Omit<OpcMalha, 'polos'> {
  x0: number;
  x1: number;
  n?: number;
  perfil: (t: number) => Perfil;
  /** Pontas planas (fecha com discos subdivididos). */
  tampa?: boolean;
  /** Espaçamento uniforme dos anéis (senão concentra nas pontas). */
  linear?: boolean;
  /** Anéis em cada tampa plana (padrão 3); mais anéis deixam pintar desenhos na tampa. */
  aneisTampa?: number;
}

const UX = V(1, 0, 0), UY = V(0, 1, 0), UZ = V(0, 0, 1);

export function corpo(o: OpcCorpo): THREE.BufferGeometry {
  const n = o.n ?? 24;
  const an: Anel[] = [];
  const anel = (t: number, k = 1, tampa = false) => {
    const q = o.perfil(t);
    an.push({
      c: V(lerp(o.x0, o.x1, t) + (q.dx ?? 0), q.cy ?? 0, q.cz ?? 0),
      u: UY, w: UZ, ry: Math.max(1e-5, q.ry * k), rz: Math.max(1e-5, q.rz * k), t, tampa,
    });
  };
  const tt = (i: number) => {
    const s = i / n;
    if (o.linear) return s;
    return o.tampa ? 0.5 * s + 0.25 * (1 - Math.cos(PI * s)) : 0.5 * (1 - Math.cos(PI * s));
  };
  if (o.tampa) {
    const ks = o.aneisTampa ? Array.from({ length: o.aneisTampa }, (_, i) => (i + 1) / (o.aneisTampa! + 0.6)) : [0.3, 0.62, 0.88];
    for (const k of ks) anel(0, k, true);
    for (let i = 0; i <= n; i++) anel(tt(i));
    for (const k of [...ks].reverse()) anel(1, k, true);
  } else {
    for (let i = 1; i < n; i++) anel(tt(i));
  }
  const q0 = o.perfil(0), q1 = o.perfil(1);
  return malhaAneis(an, {
    ...o,
    polos: [V(o.x0 + (q0.dx ?? 0), q0.cy ?? 0, q0.cz ?? 0), V(o.x1 + (q1.dx ?? 0), q1.cy ?? 0, q1.cz ?? 0)],
  });
}

/* ------------------------------------------------------------------ */
/* Torno em volta de Y                                                 */
/* ------------------------------------------------------------------ */

export type Caminho = [number, number][];

/** Reamostra um caminho [raio, altura] por comprimento de arco. */
export function reamostrar(c: Caminho, n: number): Caminho {
  const acc = [0];
  for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const tot = acc[acc.length - 1] || 1;
  const out: Caminho = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * tot;
    while (k < c.length - 2 && acc[k + 1] < s) k++;
    const f = clamp((s - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]));
    out.push([lerp(c[k][0], c[k + 1][0], f), lerp(c[k][1], c[k + 1][1], f)]);
  }
  return out;
}

export interface OpcTorno extends Omit<OpcMalha, 'polos'> {
  /** Caminho de raio e altura, do polo de baixo (raio 0) ao polo de cima (raio 0). */
  caminho: Caminho | ((s: number) => [number, number]);
  n?: number;
  /** Achatamento em Z (rz = r * l). */
  l?: number;
}

/** Sólido de revolução em pé (eixo Y). t vai de 0 (polo de baixo) a 1 (polo de cima). */
export function torno(o: OpcTorno): THREE.BufferGeometry {
  const n = o.n ?? 24;
  let pts: Caminho;
  if (typeof o.caminho === 'function') {
    pts = [];
    for (let i = 0; i <= n; i++) pts.push(o.caminho(i / n));
  } else pts = reamostrar(o.caminho, n);
  const an: Anel[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    an.push({ c: V(0, pts[i][1], 0), u: UZ, w: UX, ry: Math.max(1e-5, pts[i][0] * (o.l ?? 1)), rz: Math.max(1e-5, pts[i][0]), t: i / (pts.length - 1) });
  }
  return malhaAneis(an, { ...o, polos: [V(0, pts[0][1], 0), V(0, pts[pts.length - 1][1], 0)] });
}

/**
 * Torno de perfil fechado que não toca o eixo (anel, tubo oco, rosca).
 * O laço deve subir pela parede de fora, voltar por cima, descer por dentro e fechar por baixo.
 */
export function tornoAnel(o: Omit<OpcTorno, 'caminho'> & { caminho: Caminho }): THREE.BufferGeometry {
  const n = o.n ?? 32;
  const laco = [...o.caminho, o.caminho[0]];
  const pts = reamostrar(laco, n).slice(0, n);
  const an: Anel[] = pts.map((p, i) => ({ c: V(0, p[1], 0), u: UZ, w: UX, ry: Math.max(1e-5, p[0] * (o.l ?? 1)), rz: Math.max(1e-5, p[0]), t: i / n }));
  return malhaAneis(an, { ...o, fechado: true });
}

/** Caminho de elipsoide em pé: raio R, meia altura H, centro em cy. */
export function caminhoEsfera(R: number, H: number, cy = H): (s: number) => [number, number] {
  return (s) => {
    const th = s * PI;
    return [R * Math.sin(th), cy - H * Math.cos(th)];
  };
}

/* ------------------------------------------------------------------ */
/* Tubo ao longo de curva                                              */
/* ------------------------------------------------------------------ */

export interface OpcTubo extends Omit<OpcMalha, 'polos'> {
  n?: number;
  raio: number | ((t: number) => number);
  /** Razão rz/ry (achata o tubo). */
  achata?: number;
  /** Vetor de referência para orientar a seção (senão usa quadros de Frenet). */
  cima?: THREE.Vector3;
  pontaRedonda?: boolean;
}

export function tubo(pts: THREE.Vector3[], o: OpcTubo): THREE.BufferGeometry {
  const n = o.n ?? Math.max(4, pts.length * 3);
  const fechado = !!o.fechado;
  const curva = new THREE.CatmullRomCurve3(pts, fechado, 'centripetal');
  const R = typeof o.raio === 'number' ? () => o.raio as number : o.raio;
  const an: Anel[] = [];
  const fr = o.cima ? null : curva.computeFrenetFrames(n, fechado);
  const cnt = fechado ? n : n + 1;
  for (let i = 0; i < cnt; i++) {
    const t = i / n;
    const c = curva.getPointAt(t);
    const T = curva.getTangentAt(t).normalize();
    let u: THREE.Vector3;
    if (o.cima) {
      u = o.cima.clone().addScaledVector(T, -o.cima.dot(T));
      if (u.lengthSq() < 1e-8) u = Math.abs(T.y) < 0.9 ? V(0, 1, 0).addScaledVector(T, -T.y) : V(1, 0, 0);
      u.normalize();
    } else u = fr!.normals[i].clone();
    const w = new THREE.Vector3().crossVectors(T, u).normalize();
    const r = Math.max(1e-5, R(t));
    an.push({ c, u, w, ry: r, rz: r * (o.achata ?? 1), t });
  }
  if (fechado) return malhaAneis(an, { ...o, fechado: true });
  const T0 = curva.getTangentAt(0), T1 = curva.getTangentAt(1);
  const k = o.pontaRedonda === false ? 0 : 0.6;
  return malhaAneis(an, {
    ...o,
    polos: [an[0].c.clone().addScaledVector(T0, -R(0) * k), an[an.length - 1].c.clone().addScaledVector(T1, R(1) * k)],
  });
}

/* ------------------------------------------------------------------ */
/* Primitivas                                                          */
/* ------------------------------------------------------------------ */

export function elipsoide(rx: number, ry: number, rz: number, cor: CorFn, n = 10, m = 14, mod?: OpcMalha['mod']): THREE.BufferGeometry {
  return corpo({
    x0: -rx, x1: rx, n, m, cor, mod,
    perfil: (t) => {
      const s = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
      return { ry: ry * s, rz: rz * s };
    },
  });
}

/** Caixa centrada na origem, cantos arredondados por superelipse. */
export function caixa(cx: number, cy: number, cz: number, cor: CorFn, o: Partial<OpcCorpo> = {}): THREE.BufferGeometry {
  const ch = o.exp ? 0 : Math.min(0.08, (Math.min(cy, cz) / cx) * 0.25);
  return corpo({
    x0: -cx / 2, x1: cx / 2, n: 12, m: 28, exp: 8, tampa: true, cor,
    perfil: (t) => {
      const k = ch > 0 ? 1 - 0.12 * (1 - suave(0, ch, Math.min(t, 1 - t))) : 1;
      return { ry: (cy / 2) * k, rz: (cz / 2) * k };
    },
    ...o,
  });
}

/** Cilindro em pé (eixo Y), base em y=0. */
export function cilindroY(r: number, h: number, cor: CorFn, o: Partial<OpcTorno> = {}): THREE.BufferGeometry {
  const b = Math.min(r, h) * 0.12;
  return torno({ caminho: [[0, 0], [r - b, 0], [r, b], [r, h - b], [r - b, h], [0, h]], n: 22, m: 24, cor, ...o });
}

/** Cilindro ao longo de X com pontas planas. */
export function cilindroX(r: number, comp: number, cor: CorFn, o: Partial<OpcCorpo> = {}): THREE.BufferGeometry {
  return corpo({ x0: -comp / 2, x1: comp / 2, n: 8, m: 20, tampa: true, cor, perfil: () => ({ ry: r, rz: r }), ...o });
}

/* ------------------------------------------------------------------ */
/* Transformações                                                      */
/* ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Escala, gira (Euler XYZ) e move uma geometria (no lugar). */
export function tf(g: THREE.BufferGeometry, p: [number, number, number] = [0, 0, 0], r: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1): THREE.BufferGeometry {
  const sv = typeof s === 'number' ? V(s, s, s) : V(...s);
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  _m.compose(V(...p), _q, sv);
  g.applyMatrix4(_m);
  return g;
}

/** Junta geometrias de mesma família de atributos. */
export function juntar(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (gs.length === 1) return gs[0];
  const r = mergeGeometries(gs, false);
  if (!r) throw new Error('falha ao juntar geometrias');
  return r;
}

/* ------------------------------------------------------------------ */
/* Finalização                                                         */
/* ------------------------------------------------------------------ */

export interface Parte {
  g: THREE.BufferGeometry;
  ac: Acabamento;
  /** Parte que conta para a seção do corte (corpo principal). */
  corpo?: boolean;
}

export const parte = (g: THREE.BufferGeometry, ac: Acabamento, corpoPrincipal = false): Parte => ({ g, ac, corpo: corpoPrincipal });

const AMOSTRAS = 48;

/** Mede a seção fatiando triângulos em planos x = constante. */
function medirSecoes(gs: THREE.BufferGeometry[], x0: number, x1: number) {
  const N = AMOSTRAS;
  const xs = new Float64Array(N);
  const yMin = new Float64Array(N).fill(Infinity), yMax = new Float64Array(N).fill(-Infinity);
  const zMin = new Float64Array(N).fill(Infinity), zMax = new Float64Array(N).fill(-Infinity);
  const eps = (x1 - x0) * 0.004;
  for (let k = 0; k < N; k++) xs[k] = lerp(x0 + eps, x1 - eps, k / (N - 1));
  const dx = (x1 - x0 - 2 * eps) / (N - 1);
  const P = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const g of gs) {
    const pa = g.getAttribute('position').array as ArrayLike<number>;
    const ix = g.getIndex()!.array as ArrayLike<number>;
    for (let f = 0; f < ix.length; f += 3) {
      for (let q = 0; q < 3; q++) {
        const v = ix[f + q] * 3;
        P[q * 3] = pa[v];
        P[q * 3 + 1] = pa[v + 1];
        P[q * 3 + 2] = pa[v + 2];
      }
      const mn = Math.min(P[0], P[3], P[6]), mx = Math.max(P[0], P[3], P[6]);
      const k0 = Math.max(0, Math.ceil((mn - xs[0]) / dx)), k1 = Math.min(N - 1, Math.floor((mx - xs[0]) / dx));
      for (let k = k0; k <= k1; k++) {
        const X = xs[k];
        for (let e = 0; e < 3; e++) {
          const a = e * 3, b = ((e + 1) % 3) * 3;
          const xa = P[a], xb = P[b];
          if ((xa - X) * (xb - X) > 0 || xa === xb) continue;
          const s = (X - xa) / (xb - xa);
          const y = P[a + 1] + (P[b + 1] - P[a + 1]) * s;
          const z = P[a + 2] + (P[b + 2] - P[a + 2]) * s;
          if (y < yMin[k]) yMin[k] = y;
          if (y > yMax[k]) yMax[k] = y;
          if (z < zMin[k]) zMin[k] = z;
          if (z > zMax[k]) zMax[k] = z;
        }
      }
    }
  }
  // Preenche amostras vazias com as vizinhas.
  const ok = (k: number) => yMax[k] >= yMin[k];
  for (let k = 0; k < N; k++) {
    if (ok(k)) continue;
    let a = k - 1, b = k + 1;
    while (a >= 0 && !ok(a)) a--;
    while (b < N && !ok(b)) b++;
    const src = a >= 0 ? a : b < N ? b : -1;
    if (src < 0) {
      yMin[k] = 0; yMax[k] = 0.002; zMin[k] = -0.001; zMax[k] = 0.001;
    } else {
      yMin[k] = yMin[src]; yMax[k] = yMax[src]; zMin[k] = zMin[src]; zMax[k] = zMax[src];
    }
  }
  const tab: Secao[] = [];
  for (let k = 0; k < N; k++) {
    tab.push({
      raioY: Math.max(5e-4, (yMax[k] - yMin[k]) / 2),
      raioZ: Math.max(5e-4, (zMax[k] - zMin[k]) / 2),
      centroY: (yMax[k] + yMin[k]) / 2,
    });
  }
  return { xs, tab, dx };
}

export interface OpcFinal {
  corInterna: string;
  corCozida: string;
}

/** Junta partes por acabamento, apoia em y=0, centra em x e z e mede a seção. */
export function finalizar(partes: Parte[], o: OpcFinal): FormaAlimento {
  const caixaTotal = new THREE.Box3();
  for (const p of partes) {
    p.g.computeBoundingBox();
    caixaTotal.union(p.g.boundingBox!);
  }
  const cx = (caixaTotal.min.x + caixaTotal.max.x) / 2;
  const cz = (caixaTotal.min.z + caixaTotal.max.z) / 2;
  const my = caixaTotal.min.y;
  for (const p of partes) p.g.translate(-cx, -my, -cz);
  const comprimento = caixaTotal.max.x - caixaTotal.min.x;

  const corpos = partes.filter((p) => p.corpo).map((p) => p.g);
  const fatiadas = corpos.length ? corpos : partes.map((p) => p.g);
  const cb = new THREE.Box3();
  for (const g of fatiadas) {
    g.computeBoundingBox();
    cb.union(g.boundingBox!);
  }
  const { xs, tab, dx } = medirSecoes(fatiadas, cb.min.x, cb.max.x);
  const fora: Secao = { raioY: 5e-4, raioZ: 5e-4, centroY: 5e-4 };
  const secao = (x: number): Secao => {
    if (x < cb.min.x || x > cb.max.x) return { ...fora, centroY: x < cb.min.x ? tab[0].centroY : tab[tab.length - 1].centroY };
    const f = clamp((x - xs[0]) / dx, 0, tab.length - 1);
    const k = Math.min(tab.length - 2, Math.floor(f));
    const s = f - k;
    const a = tab[k], b = tab[k + 1];
    return { raioY: lerp(a.raioY, b.raioY, s), raioZ: lerp(a.raioZ, b.raioZ, s), centroY: lerp(a.centroY, b.centroY, s) };
  };

  // Agrupa por acabamento, com o acabamento do corpo primeiro.
  const ordem: Acabamento[] = [];
  const pc = partes.find((p) => p.corpo);
  if (pc) ordem.push(pc.ac);
  for (const p of partes) if (!ordem.includes(p.ac)) ordem.push(p.ac);
  const malhas: THREE.Mesh[] = [];
  for (const ac of ordem) {
    const gs = partes.filter((p) => p.ac === ac).map((p) => p.g);
    const g = juntar(gs);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const malha = new THREE.Mesh(g, materialAlimento(ac));
    malha.castShadow = true;
    malha.receiveShadow = true;
    malhas.push(malha);
  }
  return { malhas, comprimento, secao, corInterna: o.corInterna, corCozida: o.corCozida };
}
