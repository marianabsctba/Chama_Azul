// Tipos da tabela visual e peças reaproveitadas por várias famílias:
// folhas, caules, sépalas, olhos, grãos e ossos.
import * as THREE from 'three';
import {
  corpo, tubo, torno, elipsoide, tf, mix, mul, rgb, fbm, ruido, suave, clamp, PI, TAU, V, Rng,
  type RGB, type CorFn, type Parte,
} from './nucleo';
import type { Acabamento } from './material';

export type Familia =
  | 'esferoide' | 'citrico' | 'caroco' | 'baga' | 'tropical' | 'abobora' | 'cone' | 'fuso'
  | 'folhoso' | 'bulbo' | 'talo' | 'cacho' | 'erva' | 'vagem' | 'espiga' | 'cogumelo' | 'pimenta'
  | 'alga' | 'peixe' | 'peixe_chato' | 'file_peixe' | 'crustaceo' | 'bivalve' | 'concha_espiral'
  | 'cefalopode' | 'ave' | 'peca_ave' | 'carne' | 'carne_osso' | 'carne_moida' | 'miudo'
  | 'linguica' | 'massa_bola' | 'pao' | 'pao_chato' | 'queijo' | 'barra' | 'placa' | 'monte'
  | 'castanha' | 'massa' | 'recipiente' | 'pasta' | 'bolo' | 'torta' | 'confeito' | 'choux'
  | 'folhado' | 'merengue' | 'rizoma';

/** Linha da tabela visual de um alimento. */
export interface Visual {
  f: Familia;
  /** Variante dentro da família. */
  v: string;
  /** Tamanho principal em metros (comprimento ao longo de X). */
  t: number;
  /** Altura relativa ao tamanho principal. */
  a?: number;
  /** Largura (eixo Z) relativa ao tamanho principal. */
  l?: number;
  /** Cor da casca, pele ou superfície. */
  c1: string;
  /** Segunda cor: manchas, listras, pintas, gordura. */
  c2?: string;
  /** Terceira cor: cabo, folhas, detalhe. */
  c3?: string;
  /** Cor interna (polpa, carne, miolo). */
  ci: string;
  /** Cor cozida ou dourada. */
  cc: string;
  /** Contagem (gomos, ossos, dentes, peças). */
  n?: number;
  /** Detalhes extras em palavras (ex.: 'pintas listras'). */
  d?: string;
  /** Acabamento do corpo principal. */
  ac?: Acabamento;
}

export interface Ctx {
  id: string;
  v: Visual;
  r: Rng;
  s: number;
  T: number;
  A: number;
  L: number;
  c1: RGB;
  c2: RGB;
  c3: RGB;
  ci: RGB;
  cc: RGB;
  ac: Acabamento;
  /** Tem a palavra de detalhe. */
  tem: (w: string) => boolean;
}

export type Gerador = (k: Ctx) => Parte[];

export function criarCtx(id: string, v: Visual, seed: number, aPadrao = 1, lPadrao = 1, acPadrao: Acabamento = 'acetinado'): Ctx {
  const c1 = rgb(v.c1);
  const d = ' ' + (v.d ?? '') + ' ';
  return {
    id, v, r: new Rng(seed), s: seed % 1000, T: v.t, A: v.a ?? aPadrao, L: v.l ?? lPadrao,
    c1, c2: v.c2 ? rgb(v.c2) : mul(c1, 0.6), c3: v.c3 ? rgb(v.c3) : rgb('#4e7a2c'),
    ci: rgb(v.ci), cc: rgb(v.cc), ac: v.ac ?? acPadrao,
    tem: (w) => d.includes(' ' + w + ' '),
  };
}

/* ------------------------------------------------------------------ */
/* Contornos de folha (largura relativa em função de t de 0 a 1)       */
/* ------------------------------------------------------------------ */

export const contornos = {
  oval: (t: number) => Math.sin(PI * clamp(t)) ** 0.8,
  lanca: (t: number) => Math.sin(PI * clamp(t) ** 0.65) ** 0.9,
  gota: (t: number) => Math.sin(PI * clamp(t) ** 1.4) ** 0.7,
  fita: (t: number) => Math.min(1, Math.sin(PI * clamp(t)) * 3) ** 0.6,
  redonda: (t: number) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)),
  serrilhada: (t: number) => Math.sin(PI * clamp(t)) ** 0.8 * (1 - 0.1 * Math.abs(Math.sin(t * 46))),
  recortada: (t: number) => Math.sin(PI * clamp(t)) ** 0.7 * (0.55 + 0.45 * Math.abs(Math.cos(t * PI * 3.5))),
  palmada: (t: number) => Math.sin(PI * clamp(t)) ** 0.6 * (0.6 + 0.4 * Math.abs(Math.cos(t * PI * 2.5))),
};

/** Cor de folha com nervura central e nervuras laterais. */
export function corFolha(base: RGB, nerv: RGB, L: number, W: number, s = 0): CorFn {
  return (x, y, z) => {
    const az = Math.abs(z);
    const meio = 1 - suave(0, W * 0.05 + 0.0006, az);
    const lat = Math.abs(Math.sin(((x - az * 1.3) / L) * TAU * 5)) ** 18 * (1 - suave(W * 0.2, W * 0.5, az));
    const c = mix(base, nerv, Math.max(meio, lat * 0.55));
    return mul(c, 1 + 0.08 * fbm(x * 80, y * 80, z * 80, s));
  };
}

export interface OpcFolha {
  contorno?: (t: number) => number;
  /** Curvatura ao longo do comprimento (positivo dobra a ponta para cima). */
  curva?: number;
  /** Concavidade lateral (bordas sobem). */
  concha?: number;
  esp?: number;
  ondula?: number;
  cor?: CorFn;
  n?: number;
  m?: number;
  s?: number;
}

/** Folha deitada ao longo de +X (de 0 a L), largura em Z, espessura em Y. */
export function folha(L: number, W: number, base: RGB, nerv: RGB, o: OpcFolha = {}): THREE.BufferGeometry {
  const ct = o.contorno ?? contornos.oval;
  const esp = o.esp ?? Math.max(0.0006, W * 0.03);
  const cv = o.curva ?? 0, cc = o.concha ?? 0, on = o.ondula ?? 0;
  return corpo({
    x0: 0, x1: L, n: o.n ?? 12, m: o.m ?? 8, linear: true,
    cor: o.cor ?? corFolha(base, nerv, L, W, o.s ?? 0),
    perfil: (t) => {
      const w = ct(t);
      return { ry: esp * (0.35 + 0.65 * w), rz: Math.max(1e-4, (W / 2) * w), cy: cv * L * t * t };
    },
    desloc: (p) => {
      const az = Math.abs(p.z) / Math.max(1e-6, W / 2);
      p.y += cc * W * az * az;
      if (on) p.y += on * W * Math.sin(p.x * 70 / L + p.z * 160) * az;
    },
  });
}

/** Caule ou cabo como tubo afinando. */
export function caule(pts: THREE.Vector3[], r0: number, r1: number, cor: CorFn, m = 6): THREE.BufferGeometry {
  return tubo(pts, { raio: (t) => r0 + (r1 - r0) * t, m, n: Math.max(4, pts.length * 3), cor });
}

/** Estrela de sépalas em volta de um ponto, deitadas e levemente erguidas. */
export function sepalas(n: number, L: number, W: number, cor: RGB, centro: THREE.Vector3, erguer = 0.3, r?: Rng): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + (r ? r.f(-0.2, 0.2) : 0);
    const g = folha(L * (r ? r.f(0.85, 1.1) : 1), W, cor, mul(cor, 1.15), { contorno: contornos.lanca, curva: -0.25, n: 6, m: 6 });
    tf(g, [centro.x, centro.y, centro.z], [0, -ang, erguer]);
    out.push(g);
  }
  return out;
}

/** Olho de peixe ou de ave: bola escura com anel claro. */
export function olho(r: number, iris: RGB, pupila: RGB): THREE.BufferGeometry {
  return elipsoide(r, r, r * 0.7, (x, y, z) => {
    const d = Math.hypot(x, y) / r;
    return z > 0 ? mix(pupila, iris, suave(0.45, 0.6, d)) : iris;
  }, 6, 10);
}

/** Grão pequeno de baixa contagem (feijão, arroz, ervilha, uva pequena). */
export function grao(rx: number, ry: number, rz: number, cor: CorFn, n = 5, m = 7): THREE.BufferGeometry {
  return elipsoide(rx, ry, rz, cor, n, m);
}

/** Osso: haste com cabeças arredondadas nas pontas. */
export function osso(pts: THREE.Vector3[], r: number, cor: RGB, cabeca = 1.5): THREE.BufferGeometry {
  return tubo(pts, {
    raio: (t) => r * (1 + (cabeca - 1) * (suave(0.12, 0, t) + suave(0.88, 1, t))),
    m: 8, n: Math.max(8, pts.length * 4),
    cor: (x, y, z) => mul(cor, 1 + 0.06 * ruido(x * 200, y * 200, z * 200)),
  });
}

/** Tom com ruído suave, comum a quase tudo. */
export function tom(base: RGB, amp: number, f: number, s: number): CorFn {
  return (x, y, z) => mul(base, 1 + amp * fbm(x * f, y * f, z * f, s));
}

/** Disco ou bolacha em pé (y para cima), raio R, espessura H. */
export function disco(R: number, H: number, cor: CorFn, o: { borda?: number; m?: number; n?: number; mod?: (t: number, a: number) => number; corTampa?: CorFn; l?: number } = {}): THREE.BufferGeometry {
  const b = Math.min(R * 0.3, H * (o.borda ?? 0.45));
  return torno({
    caminho: [[0, 0], [R * 0.55, 0], [R - b, 0], [R, b * 0.9], [R, H - b * 0.9], [R - b, H], [R * 0.55, H], [0, H]],
    n: o.n ?? 20, m: o.m ?? 28, cor, mod: o.mod, l: o.l,
  });
}

/** Folha de rama plumosa (cenoura, endro, erva-doce): haste com fios. */
export function plumosa(L: number, cor: RGB, r: Rng, fios = 7): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const cf: CorFn = (x, y, z) => mul(cor, 1 + 0.12 * ruido(x * 300, y * 300, z * 300));
  out.push(caule([V(0, 0, 0), V(L * 0.5, L * 0.08, 0), V(L, L * 0.05, 0)], L * 0.012, L * 0.006, cf, 5));
  for (let i = 0; i < fios; i++) {
    const t = 0.3 + (0.7 * i) / fios;
    const x = L * t, y = L * 0.07 * Math.sin(t * PI);
    for (const sg of [-1, 1]) {
      const l = L * 0.22 * (1.1 - t * 0.6) * r.f(0.8, 1.2);
      const ang = sg * r.f(0.5, 0.9);
      out.push(caule([V(x, y, 0), V(x + l * 0.5 * Math.cos(ang), y + l * 0.1, l * 0.5 * Math.sin(ang)), V(x + l * Math.cos(ang), y + l * 0.05, l * Math.sin(ang))], L * 0.005, L * 0.002, cf, 4));
    }
  }
  return out;
}

export { mix, mul, rgb, fbm, ruido, suave, clamp, PI, TAU, V };
