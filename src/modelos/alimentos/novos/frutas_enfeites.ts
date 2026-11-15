// Alimentos novos do grupo frutas enfeites: os enfeites de legumes do livro (rosas de tomate e de
// rabanete, flores de cenoura e de chili, coroas de pepino, fogos de abobrinha, espiral de mooli,
// barquinhas e nabos recheados, baby legumes, purê confeitado, forminhas e timbales) e as frutas
// preparadas (maçã em espiral, boleada e em anel; abacaxi em tigela, anão, anel e ziguezague; manga
// ouriço; laranja remontada e suprêmes; taça e salada de melão, sorbet; kiwi, flor de figo, romã,
// pera no vinho; espetos, papelotes, tempura, coco tostado, coulis decorados e quenelle com caviar).
// No começo ficam as peças de desenho reaproveitadas também por ervas_legumes.ts.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, tf, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { contornos, caule, type Familia, type Gerador, type Visual } from '../pecas';
import { cabinho } from '../fam_vegetais';
import type { Lote } from './tipos';

export type K = Parameters<Gerador>[0];

/* ------------------------------------------------------------------ */
/* peças de desenho                                                     */
/* ------------------------------------------------------------------ */

/** Linha visual em texto curto: cores na ordem "casca segunda interna cozida terceira". */
export function vis(f: Familia, v: string, t: number, cores: string, x: Partial<Visual> = {}): Visual {
  const [c1, c2, ci, cc, c3] = cores.split(' ').map((h) => (h === '-' || h === undefined ? undefined : '#' + h));
  return { f, v, t, c1: c1!, c2, ci: ci!, cc: cc!, c3, ...x };
}

/** Cor com variação suave de tom. */
export const tomR = (c: RGB, amp: number, f: number, s = 0): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));
export const fixa = (c: RGB): CorFn => () => c;
const cl3 = (c: RGB): RGB => [clamp(c[0]), clamp(c[1]), clamp(c[2])];

function geometria(P: number[], C: number[], I: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/**
 * Superfície aberta em grade: `pos(u, v)` com u e v de 0 a 1. A face fica virada para ∂u × ∂v
 * (`inv` vira). A cor recebe u no lugar de t e v no lugar do ângulo.
 */
export function grade(nu: number, nv: number, pos: (u: number, v: number) => [number, number, number], cor: CorFn, inv = false): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv;
      const p = pos(u, v);
      P.push(p[0], p[1], p[2]);
      const c = cl3(cor(p[0], p[1], p[2], u, v));
      C.push(c[0], c[1], c[2]);
    }
  }
  const L = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * L + j, b = a + L;
      if (inv) I.push(a, a + 1, b, b, a + 1, b + 1);
      else I.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return geometria(P, C, I);
}

/** Vira cada triângulo para longe (ou na direção) de um ponto. Serve para peças convexas. */
export function orientar(g: THREE.BufferGeometry, ref: THREE.Vector3, paraRef = false): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  const ix = g.getIndex()!;
  const arr = ix.array as Uint16Array | Uint32Array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let f = 0; f < arr.length; f += 3) {
    a.fromBufferAttribute(p, arr[f]);
    b.fromBufferAttribute(p, arr[f + 1]);
    c.fromBufferAttribute(p, arr[f + 2]);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3).sub(ref);
    const d = n.dot(m);
    if (paraRef ? d > 0 : d < 0) {
      const t = arr[f + 1];
      arr[f + 1] = arr[f + 2];
      arr[f + 2] = t;
    }
  }
  ix.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export type CorLado = (x: number, y: number, z: number, u: number, v: number, lado: number) => RGB;

/**
 * Chapa fina de duas faces costuradas na borda. `pos(u, v, lado)` com u de 0 a 1, v de -1 a 1 e
 * lado 1 numa face e 0 na outra; as faces se viram sozinhas para fora (de uma para a outra).
 */
export function chapa(nx: number, nz: number, pos: (u: number, v: number, lado: number) => [number, number, number], cor: CorLado): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const por = nz + 1;
  const face = (nx + 1) * por;
  for (const lado of [1, 0]) {
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const u = i / nx, v = (j / nz) * 2 - 1;
        const p = pos(u, v, lado);
        P.push(p[0], p[1], p[2]);
        const c = cl3(cor(p[0], p[1], p[2], u, v, lado));
        C.push(c[0], c[1], c[2]);
      }
    }
  }
  const vx = (k: number) => V(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
  const tri = (a: number, b: number, c: number, dir: THREE.Vector3) => {
    const A = vx(a), n = vx(b).sub(A).cross(vx(c).sub(A));
    if (n.dot(dir) < 0) I.push(a, c, b);
    else I.push(a, b, c);
  };
  const T = (i: number, j: number) => i * por + j;
  const B = (i: number, j: number) => face + i * por + j;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const d = vx(T(i, j)).sub(vx(B(i, j)));
      if (d.lengthSq() < 1e-16) d.copy(vx(T(i + 1, j + 1)).sub(vx(B(i + 1, j + 1))));
      tri(T(i, j), T(i + 1, j), T(i, j + 1), d);
      tri(T(i, j + 1), T(i + 1, j), T(i + 1, j + 1), d);
      const e = d.clone().negate();
      tri(B(i, j), B(i + 1, j), B(i, j + 1), e);
      tri(B(i, j + 1), B(i + 1, j), B(i + 1, j + 1), e);
    }
  }
  // borda: cada quadradinho virado para longe do vizinho de dentro
  const laco: [number, number, number, number][] = [];
  for (let i = 0; i < nx; i++) laco.push([i, 0, 0, 1]);
  for (let j = 0; j < nz; j++) laco.push([nx, j, -1, 0]);
  for (let i = nx; i > 0; i--) laco.push([i, nz, 0, -1]);
  for (let j = nz; j > 0; j--) laco.push([0, j, 1, 0]);
  for (let q = 0; q < laco.length; q++) {
    const [ia, ja, di, dj] = laco[q], [ib, jb] = laco[(q + 1) % laco.length];
    const meio = vx(T(ia, ja)).add(vx(T(ib, jb)));
    const dentro = vx(T(clamp(ia + di, 0, nx), clamp(ja + dj, 0, nz))).add(vx(T(clamp(ib + di, 0, nx), clamp(jb + dj, 0, nz))));
    const fora = meio.sub(dentro);
    tri(T(ia, ja), T(ib, jb), B(ia, ja), fora);
    tri(T(ib, jb), B(ib, jb), B(ia, ja), fora);
  }
  return geometria(P, C, I);
}

/** Bloco de faces retas (cubinhos, palitos, tiras de grelha), centrado na origem. */
export function bloco(sx: number, sy: number, sz: number, cor: CorFn, seg: [number, number, number] = [1, 1, 1]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz, seg[0], seg[1], seg[2]);
  g.deleteAttribute('uv');
  g.clearGroups();
  const p = g.getAttribute('position');
  const C: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const c = cl3(cor(p.getX(i), p.getY(i), p.getZ(i), 0, 0));
    C.push(c[0], c[1], c[2]);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

/** Prisma: polígono (y, z) estrelado em volta do centroide, puxado ao longo de X, quinas vivas. */
export function prisma(poly: [number, number][], x0: number, x1: number, cor: CorFn, corTampa?: CorFn): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  let cy = 0, cz = 0;
  for (const [y, z] of poly) { cy += y; cz += z; }
  cy /= poly.length; cz /= poly.length;
  const add = (x: number, y: number, z: number, f: CorFn) => {
    P.push(x, y, z);
    const c = cl3(f(x, y, z, 0, 0));
    C.push(c[0], c[1], c[2]);
    return P.length / 3 - 1;
  };
  const N = poly.length;
  for (let k = 0; k < N; k++) {
    const [ya, za] = poly[k], [yb, zb] = poly[(k + 1) % N];
    const a = add(x0, ya, za, cor), b = add(x0, yb, zb, cor), c = add(x1, ya, za, cor), d = add(x1, yb, zb, cor);
    I.push(a, b, c, b, d, c);
  }
  const ft = corTampa ?? cor;
  for (const x of [x0, x1]) {
    const c0 = add(x, cy, cz, ft);
    const ids = poly.map(([y, z]) => add(x, y, z, ft));
    for (let k = 0; k < N; k++) I.push(c0, ids[k], ids[(k + 1) % N]);
  }
  const g = geometria(P, C, I);
  return orientar(g, V((x0 + x1) / 2, cy, cz));
}

/** Gira +Y da peça para a direção `n` e põe em `p`. */
export function apontar(g: THREE.BufferGeometry, n: THREE.Vector3, p: THREE.Vector3, giro = 0): THREE.BufferGeometry {
  if (giro) g.rotateY(giro);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
  g.translate(p.x, p.y, p.z);
  return g;
}

/** Põe uma peça feita ao longo de +X num anel (raio r0, altura y0, ângulo phi), erguida pelo ângulo `ergue`. */
export function emAnel(g: THREE.BufferGeometry, r0: number, y0: number, phi: number, ergue: number): THREE.BufferGeometry {
  g.rotateZ(ergue);
  g.rotateY(phi);
  return g.translate(r0 * Math.cos(phi), y0, -r0 * Math.sin(phi));
}

export interface OpcPetala {
  contorno?: (t: number) => number;
  /** Curvatura ao longo (positivo dobra a ponta para a face de cima). */
  curva?: number;
  /** Concavidade lateral (bordas sobem para a face de cima). */
  concha?: number;
  esp?: number;
  ondula?: number;
  /** Face de cima (+Y local) e face de baixo. */
  cima: CorFn;
  baixo: CorFn;
  n?: number;
  m?: number;
}

/** Pétala, lâmina ou tira deitada ao longo de +X com cor própria em cada face. */
export function petala(L: number, W: number, o: OpcPetala): THREE.BufferGeometry {
  const ct = o.contorno ?? contornos.oval;
  const esp = o.esp ?? Math.max(0.0005, W * 0.05);
  const cv = o.curva ?? 0, cc = o.concha ?? 0, on = o.ondula ?? 0;
  return corpo({
    x0: 0, x1: L, n: o.n ?? 12, m: o.m ?? 8, linear: true,
    cor: (x, y, z, t, a) => {
      const k = Math.cos(a);
      const c1 = o.cima(x, y, z, t, a), c2 = o.baixo(x, y, z, t, a);
      return mix(c2, c1, suave(-0.35, 0.35, k));
    },
    perfil: (t) => {
      const w = ct(t);
      return { ry: (esp / 2) * (0.4 + 0.6 * w), rz: Math.max(1e-4, (W / 2) * w), cy: cv * L * t * t };
    },
    desloc: (p) => {
      const az = Math.min(1, Math.abs(p.z) / Math.max(1e-6, W / 2));
      p.y += cc * W * az * az;
      if (on) p.y += on * W * Math.sin(p.x * 60 / L + p.z * 140) * az;
    },
  });
}

/** Contorno de pétala larga na ponta (flor de cenoura, fundo de pétala de rosa). */
export const contornoLargo = (t: number) => clamp(t) ** 0.55 * Math.sqrt(Math.max(0, 1 - clamp(t) ** 5));

/**
 * Roseta confeitada com bico pitanga: cone de estrias torcidas com o sulco da espiral do saco,
 * em pé (eixo Y), base em y = 0. A cor recebe em `a` o ângulo e em `t` a altura relativa.
 */
export function roseta(R: number, H: number, cor: (x: number, y: number, z: number, u: number, estria: number) => RGB, o: { pontas?: number; voltas?: number; n?: number; m?: number; torce?: number } = {}): THREE.BufferGeometry {
  const p = o.pontas ?? 8, vt = o.voltas ?? 2.6, tw = o.torce ?? 2.4;
  const b = 0.1;
  const estria = (u: number, a: number) => Math.abs(Math.cos((p * (a + u * tw)) / 2));
  return torno({
    caminho: (s) => {
      if (s < b) return [R * 0.96 * (s / b), 0];
      const u = (s - b) / (1 - b);
      const r = R * (1 - u) ** 0.8 * (1 + 0.1 * Math.sin(u * PI));
      return [Math.max(0, r), H * u ** 0.85];
    },
    n: o.n ?? 30, m: o.m ?? p * 5,
    mod: (t, a) => {
      const u = clamp((t - b) / (1 - b));
      const e = 0.8 + 0.2 * estria(u, a) ** 0.7;
      const espiral = 1 + 0.1 * Math.sin(TAU * vt * u - a) * (1 - u * 0.6);
      return lerp(1, e * espiral, suave(0, 0.06, u));
    },
    cor: (x, y, z, t, a) => {
      const u = clamp((t - b) / (1 - b));
      return cor(x, y, z, u, estria(u, a));
    },
  });
}

/** Disco plano (face de corte) em y, raio R, virado para cima; a cor recebe (raio relativo, ângulo). */
export function discoPolar(R: number, y: number, nr: number, na: number, cor: (x: number, z: number, r: number, a: number) => RGB, raio?: (a: number) => number): THREE.BufferGeometry {
  return grade(nr, na, (u, v) => {
    const a = v * TAU, rr = u * R * (raio ? raio(a) : 1);
    return [Math.cos(a) * rr, y, Math.sin(a) * rr];
  }, (x, _y, z, u, v) => cor(x, z, u, v * TAU), true);
}

/** Onda triangular de 0 (vale) a 1 (ponta), com n pontas na volta. */
const ziguezague = (a: number, n: number) => {
  const f = ((a / TAU) * n) % 1;
  return 1 - Math.abs(f - 0.5) * 2;
};

/** Meia peça deitada com o corte para cima: casca por baixo e face de corte (com cavidade) em cima. */
interface OpcMeia {
  L: number;
  nt: number;
  nv: number;
  raio: (t: number) => { ry: number; rz: number };
  pele: CorFn;
  face: CorFn;
  cava?: (x: number, z: number, t: number, v: number) => number;
}
function meiaPeca(o: OpcMeia): THREE.BufferGeometry[] {
  // eixo na altura do maior raio, para a casca encostar na mesa
  let yc = 0;
  for (let i = 0; i <= 20; i++) yc = Math.max(yc, o.raio(i / 20).ry);
  const casca = grade(o.nt, o.nv, (u, v) => {
    const { ry, rz } = o.raio(u);
    const f = PI + v * PI;
    return [(u - 0.5) * o.L, yc + ry * Math.sin(f), rz * Math.cos(f)];
  }, o.pele);
  const face = grade(o.nt, o.nv, (u, v) => {
    const { rz } = o.raio(u);
    const x = (u - 0.5) * o.L, z = -rz + 2 * rz * v;
    return [x, yc - (o.cava ? o.cava(x, z, u, v) : 0), z];
  }, o.face, true);
  return [casca, face];
}

/** Cubinhos de polpa amontoados num disco (concassée, salada de frutas). */
function amontoar(k: K, n: number, R: number, H: number, y0: number, peca: (i: number) => THREE.BufferGeometry, cx = 0, cz = 0, rz = R): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const rr = Math.sqrt(f) * 0.92;
    const a = i * 2.39996 + k.r.f(-0.3, 0.3);
    const g = peca(i);
    g.rotateX(k.r.f(-0.6, 0.6));
    g.rotateY(k.r.f(0, TAU));
    g.rotateZ(k.r.f(-0.6, 0.6));
    g.translate(cx + Math.cos(a) * rr * R, y0 + H * (1 - rr * rr) * k.r.f(0.75, 1.05), cz + Math.sin(a) * rr * rz);
    out.push(g);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* rosas, flores e coroas de legume                                     */
/* ------------------------------------------------------------------ */

const gRosaTomate: Gerador = (k) => {
  // tira contínua de casca enrolada em espiral, cada volta mais aberta, sobre o disquinho da base
  const { c1, c2, ci, s } = k;
  const R1 = k.T * 0.27, R0 = k.T * 0.03, voltas = 3.2;
  const esp = 0.0007;
  const pele: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.2, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.35), 1 + 0.05 * fbm(x * 400, y * 400, z * 400, s));
  const carne: CorFn = (x, y, z) => mul(mix(ci, c1, 0.25 + 0.2 * fbm(x * 160, y * 160, z * 160, s + 2)), 1);
  const out: Parte[] = [];
  out.push(parte(chapa(120, 5, (u, v, lado) => {
    const th = u * voltas * TAU;
    const r = lerp(R0, R1, u ** 0.85);
    const h = (v + 1) / 2;
    const w = lerp(k.T * 0.46, k.T * 0.3, u) * (1 + 0.1 * Math.sin(th * 2.5)) * Math.sqrt(suave(0, 0.05, u)) * (0.5 + 0.5 * Math.sqrt(suave(1, 0.96, u)));
    const beta = lerp(0.02, 1.05, u ** 1.8);
    const onda = 0.0012 * Math.sin(th * 3 + h * 2) * h;
    const rr = r + h * w * Math.sin(beta) + onda + (lado ? esp * Math.cos(beta) : 0);
    const y = 0.0015 + h * w * Math.cos(beta) - (lado ? esp * Math.sin(beta) : 0);
    return [Math.cos(th) * rr, y, Math.sin(th) * rr];
  }, (x, y, z, _u, v, lado) => {
    const c = lado ? pele(x, y, z, 0, 0) : carne(x, y, z, 0, 0);
    return mix(c, mul(c1, 0.8), suave(0.85, 1, v) * 0.3);
  }), 'brilhante', true));
  // disco de casca da base, onde a rosa se apoia
  out.push(parte(torno({ caminho: [[0, 0], [R1 * 0.75, 0], [R1 * 0.78, 0.0012], [0, 0.0016]], n: 5, m: 28, cor: pele }), 'brilhante'));
  return out;
};

const gRosaRabanete: Gerador = (k) => {
  // rabanete de topo cortado, tirinhas de casca abertas na água gelada como pétalas
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.42, H = R * 1.65;
  const out: Parte[] = [];
  const pele: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.1, 0.8, fbm(x * 220, y * 220, z * 220, s)) * 0.45), 1 + 0.06 * fbm(x * 600, y * 600, z * 600, s));
  const branco: CorFn = (x, y, z) => mul(mix(ci, mix(ci, c1, 0.3), suave(0.55, 0.9, fbm(x * 300, y * 300, z * 300, s + 3)) * 0.4), 1);
  // miolo branco, topo reto riscado em grade
  const hTopo = H * 0.74;
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.32, 0.0005], [R * 0.66, H * 0.14], [R * 0.74, H * 0.42], [R * 0.68, H * 0.66], [R * 0.6, hTopo], [R * 0.3, hTopo], [0, hTopo]],
    n: 20, m: 28,
    cor: (x, y, z) => {
      if (y < H * 0.1) return pele(x, y, z, 0, 0);
      let c = branco(x, y, z, 0, 0);
      if (y > hTopo - 0.0003) {
        const g = Math.min(Math.abs(Math.sin(x * PI / 0.0042)), Math.abs(Math.sin(z * PI / 0.0042)));
        c = mix(mul(c, 0.82), c, suave(0.0, 0.25, g));
      }
      return c;
    },
  }), 'acetinado', true));
  out.push(parte(tf(elipsoide(R * 0.16, R * 0.12, R * 0.16, pele, 4, 8), [0, R * 0.04, 0]), 'brilhante'));
  // pétalas de fora: casca vermelha por fora, carne branca com borda rosada por dentro
  const nf = 8;
  for (let i = 0; i < nf; i++) {
    const W = R * 1.08;
    const g = petala(H * 0.72, W, {
      contorno: (t) => Math.sin(PI * clamp(t) ** 0.8) ** 0.55,
      curva: -0.18, concha: 0.2, esp: R * 0.1, n: 12, m: 10,
      cima: (x, y, z) => mix(branco(x, y, z, 0, 0), mul(c1, 1.1), suave(0.62, 0.95, Math.abs(z) / (W / 2)) * 0.8),
      baixo: pele,
    });
    emAnel(g, R * 0.6, H * 0.06, (i / nf) * TAU + k.r.f(-0.1, 0.1), 1.25 - k.r.f(0, 0.12));
    out.push(parte(g, 'brilhante'));
  }
  // pétalas de dentro, cortadas na carne
  for (let i = 0; i < 6; i++) {
    const g = petala(H * 0.58, R * 0.85, {
      contorno: (t) => Math.sin(PI * clamp(t) ** 0.8) ** 0.6, curva: -0.2, concha: 0.12, esp: R * 0.08, n: 10, m: 8,
      cima: branco, baixo: (x, y, z) => mix(branco(x, y, z, 0, 0), mul(c1, 1.15), 0.25),
    });
    emAnel(g, R * 0.44, H * 0.2, ((i + 0.5) / 6) * TAU, 1.3);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gFlorCenoura: Gerador = (k) => {
  // flor de cenoura: ponta afinada, quatro pétalas cortadas em ângulo e soltas, miolo em cone
  const { c1, c2, ci, s } = k;
  const S = k.T;
  const out: Parte[] = [];
  const anel = (x: number, y: number, z: number) => {
    const r = Math.hypot(x, z);
    return mix(mul(c1, 1.05), ci, (1 - suave(0.002, 0.0045, r)) * 0.7);
  };
  const casca: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 300, y * 300, z * 300, s)) * 0.3), 1 + 0.03 * Math.sin(y * 2600));
  out.push(parte(torno({
    caminho: [[0, 0], [S * 0.1, 0.0004], [S * 0.18, S * 0.12], [S * 0.22, S * 0.26], [S * 0.16, S * 0.34], [S * 0.1, S * 0.5], [0, S * 0.66]],
    n: 18, m: 24, cor: (x, y, z) => mix(casca(x, y, z, 0, 0), anel(x, y, z), suave(S * 0.2, S * 0.4, y)),
  }), 'acetinado', true));
  for (let i = 0; i < 4; i++) {
    const L = S * 0.62, W = S * 0.42;
    const g = petala(L, W, {
      contorno: contornoLargo, curva: -0.12, concha: 0.38, esp: S * 0.05, n: 14, m: 10,
      cima: (x, y, z) => mul(mix(mul(c1, 1.12), ci, 0.25 * Math.abs(Math.sin(x * 900))), 1 + 0.04 * fbm(x * 200, y * 200, z * 200, s)),
      baixo: casca,
    });
    emAnel(g, S * 0.12, S * 0.08, (i / 4) * TAU + PI / 4, 1.05);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gFlorChili: Gerador = (k) => {
  // chili cortado da haste à ponta e aberto na água gelada: tiras curvadas para fora e o miolo de sementes
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * k.L * 0.5;
  const out: Parte[] = [];
  const x0 = -L / 2 + L * 0.2;
  const pele: CorFn = (x, y, z) => mul(c1, 0.95 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
  out.push(parte(corpo({
    x0: -L / 2, x1: x0 + R * 0.5, n: 12, m: 18, cor: pele,
    perfil: (t) => { const r = R * Math.sqrt(suave(0, 0.35, t)); return { ry: r, rz: r, cy: R }; },
  }), 'brilhante', true));
  // cálice e cabinho
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.9, -R * 0.1], [R * 1.05, R * 0.25], [R * 0.4, R * 0.35], [0, R * 0.4]], n: 8, m: 14, cor: tomR(c3, 0.1, 300, s), mod: (t, a) => 1 + 0.12 * Math.cos(a * 5) * t }).rotateZ(PI / 2).translate(-L / 2 + R * 0.25, R, 0), 'fosco'));
  out.push(parte(caule([V(-L / 2 - R * 0.1, R, 0), V(-L / 2 - L * 0.12, R * 1.2, R * 0.3), V(-L / 2 - L * 0.2, R * 1.8, R * 0.4)], R * 0.24, R * 0.18, tomR(mul(c3, 0.85), 0.1, 300, s), 6), 'fosco'));
  // miolo com sementes
  out.push(parte(tf(elipsoide(L * 0.16, R * 0.32, R * 0.32, tomR(ci, 0.08, 300, s), 6, 8), [x0 + L * 0.13, R, 0]), 'acetinado'));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, x = x0 + L * (0.04 + 0.025 * i);
    out.push(parte(tf(elipsoide(R * 0.2, R * 0.05, R * 0.17, fixa(mix(ci, rgb('#f2e4b0'), 0.5)), 3, 6), [x, R + Math.cos(a) * R * 0.32, Math.sin(a) * R * 0.32], [a, 0, 0]), 'acetinado'));
  }
  // tiras
  const nt = 7;
  for (let i = 0; i < nt; i++) {
    const phi = (i / nt) * TAU + 0.2;
    const radial = V(0, Math.cos(phi), Math.sin(phi));
    const tang = V(0, -Math.sin(phi), Math.cos(phi));
    const Ls = L * 0.66 * k.r.f(0.9, 1.08);
    const curl = k.r.f(2.0, 2.7);
    const pts: THREE.Vector3[] = [];
    let px = x0, pr = R * 0.82, th = 0.15;
    for (let q = 0; q <= 6; q++) {
      pts.push(V(px, R, 0).addScaledVector(radial, pr));
      th += curl / 6;
      px += (Ls / 6) * Math.cos(th);
      pr += (Ls / 6) * Math.sin(th);
    }
    const g = tubo(pts, {
      raio: (t) => R * 0.95 * (1 - 0.5 * t), achata: 0.12, cima: tang, m: 8, n: 16,
      cor: (x, y, z, t, a) => {
        const dentro = Math.sin(a);
        const c = mix(pele(x, y, z, 0, 0), mul(mix(c1, c2, 0.6), 1.15 + 0.1 * Math.sin(t * 40)), suave(-0.3, 0.3, dentro));
        return c;
      },
    });
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

const gCoroaPepino: Gerador = (k) => {
  // meio cilindro de pepino com a borda em ziguezague (à van dyke): casca escura, polpa e sementes
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.42, h0 = k.T * 0.5, A = k.T * 0.22, n = 8;
  const pele: CorFn = (x, y, z) => {
    const a = Math.atan2(z, x);
    return mul(mix(c1, c2, suave(0.3, 0.8, Math.sin(a * 7 + fbm(x * 90, y * 90, z * 90, s) * 2)) * 0.35), 1 + 0.08 * fbm(x * 400, y * 400, z * 400, s));
  };
  const polpa = (x: number, z: number) => {
    const r = Math.hypot(x, z) / R;
    const a = Math.atan2(z, x);
    let c = mix(mix(ci, rgb('#cfe0a0'), 0.4), ci, suave(0.5, 0.85, r));
    // miolo de sementes em três lóculos
    const lob = 0.42 + 0.06 * Math.cos(3 * a);
    const sem = r < lob ? 1 : 0;
    c = mix(c, mix(ci, rgb('#e8ecc8'), 0.6), sem * 0.6);
    const pontinho = 1 - suave(0.15, 0.3, celula(x * 900, 0, z * 900, s));
    if (r < lob && r > 0.12) c = mix(c, rgb('#f4f2dc'), pontinho * 0.8);
    c = mix(c, mul(c1, 1.2), suave(0.9, 0.97, r));
    return c;
  };
  return [parte(torno({
    caminho: [[0, 0], [R, 0], [R, h0], [0, h0]], n: 26, m: n * 8,
    desloc: (p) => {
      if (p.y <= 1e-6) return;
      const r = Math.hypot(p.x, p.z) / R;
      const a = Math.atan2(p.z, p.x) + PI;
      const topo = h0 + A * ziguezague(a, n) * Math.min(1, r * 1.05) - A * 0.15 * (1 - r);
      p.y = (p.y / h0) * topo;
    },
    cor: (x, y, z) => {
      const r = Math.hypot(x, z) / R;
      if (r > 0.995 && y > 0.0004) return pele(x, y, z, 0, 0);
      return polpa(x, z);
    },
  }), 'acetinado', true)];
};

const gFogosAbobrinha: Gerador = (k) => {
  // tira de abobrinha franjada, enrolada e aberta na água gelada como fogos de artifício
  const { c1, c2, ci, s } = k;
  const Rr = k.T * 0.28, hr = k.T * 0.3;
  const out: Parte[] = [];
  const pele: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.4, 0.9, fbm(x * 500, y * 500, z * 500, s)) * 0.45), 1);
  out.push(parte(torno({
    caminho: [[0, 0], [Rr, 0], [Rr, hr], [0, hr]], n: 10, m: 30,
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      if (r > Rr * 0.985) return mix(pele(x, y, z, 0, 0), ci, suave(hr * 0.75, hr, y) * 0.4 + suave(hr * 0.2, 0, y) * 0.4);
      const espiral = ((r / (Rr / 3) - Math.atan2(z, x) / TAU) % 1 + 1) % 1;
      return espiral < 0.18 ? mul(c1, 1.1) : mix(ci, c2, 0.15);
    },
  }), 'acetinado', true));
  const nf = 36;
  for (let i = 0; i < nf; i++) {
    const f = i / (nf - 1);
    const r = Rr * (0.12 + 0.82 * f);
    const al = f * 3 * TAU + k.r.f(-0.15, 0.15);
    const radial = V(Math.cos(al), 0, Math.sin(al));
    const tang = V(-Math.sin(al), 0, Math.cos(al));
    const g0 = lerp(0.12, 1.15, f) + k.r.f(-0.1, 0.1);
    const Lf = k.T * 0.55 * (1 - 0.25 * f) * k.r.f(0.9, 1.1);
    const p0 = V(radial.x * r, hr * 0.92, radial.z * r);
    const d1 = radial.clone().multiplyScalar(Math.sin(g0)).add(V(0, Math.cos(g0), 0));
    const g1 = g0 + 0.45;
    const d2 = radial.clone().multiplyScalar(Math.sin(g1)).add(V(0, Math.cos(g1), 0));
    const p1 = p0.clone().addScaledVector(d1, Lf * 0.5);
    const p2 = p1.clone().addScaledVector(d2, Lf * 0.5);
    out.push(parte(tubo([p0, p1, p2], {
      raio: (t) => k.T * 0.055 * (1 - 0.35 * t), achata: 0.3, cima: tang, m: 6, n: 8,
      cor: (x, y, z, t, a) => mix(pele(x, y, z, 0, 0), mul(mix(ci, c2, 0.2), 1 - 0.1 * t), suave(-0.2, 0.2, Math.sin(a))),
    }), 'acetinado'));
  }
  return out;
};

const gEspiralMooli: Gerador = (k) => {
  // espiral contínua cortada girando o nabo no espeto, esticada como mola
  const { c1, c2, ci, s } = k;
  const L = k.T * 0.85, Rin = 0.0035, Rout = k.T * k.L * 0.5, voltas = 9, esp = 0.0013;
  return [parte(chapa(voltas * 28, 4, (u, v, lado) => {
    const th = u * voltas * TAU;
    const fim = Math.sqrt(suave(0, 0.05, u) * suave(1, 0.95, u));
    const ro = Rin + (Rout - Rin) * (0.35 + 0.65 * fim);
    const r = lerp(Rin, ro, (v + 1) / 2) * (1 + 0.03 * Math.sin(th * 3) * (v + 1) / 2);
    const x = -L / 2 + u * L + (lado - 0.5) * esp - (r - Rin) * 0.06;
    return [x, Rout + r * Math.cos(th), r * Math.sin(th)];
  }, (x, y, z, _u, v) => {
    const c = mul(mix(ci, c1, 0.3), 0.97 + 0.06 * fbm(x * 300, y * 300, z * 300, s));
    return mix(c, mix(c1, c2, 0.3), suave(0.75, 1, v) * 0.5);
  }), 'umido', true)];
};

/* ------------------------------------------------------------------ */
/* legumes recheados, baby legumes e enfeites de purê e de arroz          */
/* ------------------------------------------------------------------ */

const gBarquinhaAbobrinha: Gerador = (k) => {
  // meia abobrinha escaldada, polpa escavada e recheada com concassée de tomate
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * k.L * 0.5;
  const raio = (t: number) => { const u = 2 * t - 1; const r = R * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 3.2)) * (1 + 0.05 * u); return { ry: r * 0.95, rz: r }; };
  const pele: CorFn = (x, y, z) => {
    const a = Math.atan2(z, y - R);
    return mul(mix(c1, c2, suave(0.3, 0.75, Math.sin(a * 9 + fbm(x * 40, 0, z * 40, s) * 1.5)) * 0.3 + suave(0.55, 0.9, fbm(x * 500, y * 500, z * 500, s)) * 0.35), 1);
  };
  const cava = (x: number, _z: number, t: number, v: number) => {
    const w = suave(0.1, 0.22, t) * suave(0.9, 0.78, t);
    return R * 0.58 * w * Math.max(0, 1 - ((2 * v - 1) / 0.7) ** 2) ** 0.7;
  };
  const face: CorFn = (x, y, z, t, v) => {
    const borda = Math.abs(2 * v - 1);
    let c = mul(ci, 0.96 + 0.06 * fbm(x * 300, 0, z * 300, s));
    c = mix(c, mix(ci, c2, 0.5), suave(0.45, 0.8, 1 - cava(x, z, t, v) / (R * 0.58)) * 0);
    c = mix(c, mul(ci, 0.85), suave(0.75, 0.6, borda) * 0.5);
    c = mix(c, c1, suave(0.95, 0.99, borda));
    return c;
  };
  const [casca, corte] = meiaPeca({ L, nt: 36, nv: 18, raio, pele, face, cava });
  const out: Parte[] = [parte(casca, 'brilhante', true), parte(corte, 'acetinado', true)];
  out.push(parte(caule([V(L / 2 - 0.002, R * 0.9, 0), V(L / 2 + L * 0.06, R * 0.95, 0.001)], R * 0.22, R * 0.18, tomR(mul(c3, 0.8), 0.1, 300, s), 6), 'fosco'));
  // concassée
  const tom = rgb('#d6301e'), tomC = rgb('#ee6a4a');
  out.push(...amontoar(k, 22, L * 0.3, R * 0.22, R * 0.75, (i) => {
    const q = 0.006 * k.r.f(0.8, 1.15);
    return bloco(q, q * 0.9, q, (x, y, z) => mix(tom, tomC, suave(-q * 0.5, q * 0.5, y + x * 0.3) * 0.6 + 0.1 * fbm(x * 600, y * 600, z * 600, s + i)));
  }, 0, 0, R * 0.42).map((g) => parte(g, 'umido')));
  out.push(...amontoar(k, 7, L * 0.25, R * 0.3, R * 0.9, () => bloco(0.003, 0.0006, 0.0018, fixa(rgb('#3a7a2a'))), 0, 0, R * 0.35).map((g) => parte(g, 'acetinado')));
  return out;
};

const gNaboRecheado: Gerador = (k) => {
  // nabo escaldado com tampa cortada, escavado e com purê de brócolis confeitado em roseta
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, H = R * 1.7, hc = H * 0.8;
  const out: Parte[] = [];
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.25, H * 0.03], [R * 0.75, H * 0.16], [R, H * 0.42], [R * 0.97, H * 0.62], [R * 0.84, hc], [R * 0.62, hc], [R * 0.56, hc - H * 0.12], [0, hc - H * 0.2]],
    n: 22, m: 28,
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      if (y > hc - 0.0003 && r < R * 0.85) return mul(ci, 0.97 + 0.05 * fbm(x * 400, 0, z * 400, s));
      const roxo = suave(H * 0.35, H * 0.72, y + fbm(x * 60, y * 60, z * 60, s) * H * 0.1);
      return mul(mix(mix(ci, c2, 0.2), c1, roxo * 0.85), 1 + 0.04 * fbm(x * 300, y * 300, z * 300, s));
    },
  }), 'acetinado', true));
  const verde = rgb('#4e8a34'), escuro = rgb('#2e5a22');
  out.push(parte(tf(roseta(R * 0.62, H * 0.62, (x, y, z, u, e) => mul(mix(escuro, verde, 0.45 + 0.4 * e), 1 + 0.12 * fbm(x * 700, y * 700, z * 700, s) - 0.15 * (1 - suave(0.1, 0.3, celula(x * 900, y * 900, z * 900, s)))), { pontas: 8, voltas: 2.2 }), [0, hc - H * 0.12, 0]), 'acetinado'));
  return out;
};

const gCenouraBaby: Gerador = (k) => {
  // cenoura nova escaldada inteira, com um toco de talos verdes
  const { c1, c2, c3, s } = k;
  const L = k.T, R = L * k.L * 0.5;
  const out: Parte[] = [];
  const cor: CorFn = (x, y, z, t) => {
    let c = mul(mix(c1, c2, suave(0.4, 0.9, fbm(x * 200, y * 200, z * 200, s)) * 0.3), 1 + 0.03 * fbm(x * 600, y * 600, z * 600, s));
    c = mul(c, 1 - 0.12 * Math.abs(Math.sin(x * 1300 + fbm(x * 50, y * 50, z * 50, s) * 3)) ** 16);
    c = mix(c, mix(c1, c3, 0.4), suave(0.06, 0, t) * 0.7);
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 18, cor,
    perfil: (t) => { const r = R * Math.sqrt(suave(0, 0.07, t)) * (1 - t * 0.9) ** 0.75; return { ry: r, rz: r, cy: R }; },
    mod: (t, a) => 1 + 0.03 * fbm(t * 12, Math.cos(a), Math.sin(a), s),
  }), 'brilhante', true));
  const verde = tomR(c3, 0.1, 400, s);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const p0 = V(-L / 2 + R * 0.15, R + Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    const l = L * k.r.f(0.16, 0.24);
    out.push(parte(caule([p0, p0.clone().add(V(-l * 0.5, Math.cos(a) * l * 0.15 + l * 0.1, Math.sin(a) * l * 0.2)), p0.clone().add(V(-l, Math.cos(a) * l * 0.3 + l * 0.18, Math.sin(a) * l * 0.35))], R * 0.14, R * 0.11, verde, 5), 'acetinado'));
  }
  return out;
};

const gNaboBaby: Gerador = (k) => {
  // nabo novo redondinho, ombro roxo, raiz fina e toco de talos verdes
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * 0.36;
  const out: Parte[] = [];
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 20,
    cor: (x, y, z, t) => mul(mix(mix(ci, c2, 0.15), c1, suave(0.42, 0.12, t + fbm(x * 80, y * 80, z * 80, s) * 0.06) * 0.85), 1 + 0.04 * fbm(x * 400, y * 400, z * 400, s)),
    perfil: (t) => {
      const b = R * Math.sqrt(Math.max(0, 1 - ((t - 0.36) / 0.37) ** 2));
      const cauda = R * 0.14 * (1 - t) ** 0.8;
      const r = Math.max(b, cauda) * Math.sqrt(suave(0, 0.04, t));
      return { ry: r, rz: r, cy: R };
    },
  }), 'acetinado', true));
  const verde = tomR(c3, 0.1, 400, s);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5;
    const p0 = V(-L / 2 + R * 0.12, R + Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
    const l = L * k.r.f(0.28, 0.4);
    out.push(parte(caule([p0, p0.clone().add(V(-l * 0.5, Math.cos(a) * l * 0.12 + l * 0.12, Math.sin(a) * l * 0.2)), p0.clone().add(V(-l, Math.cos(a) * l * 0.25 + l * 0.22, Math.sin(a) * l * 0.35))], R * 0.12, R * 0.09, verde, 5), 'acetinado'));
  }
  return out;
};

const gPureConfeitado: Gerador = (k) => {
  // roseta de purê com gema confeitada no bico pitanga e assada: estrias douradas, vales claros
  const { c1, c2, cc, s } = k;
  const R = k.T * 0.48, H = k.T * 0.78;
  return [parte(roseta(R, H, (x, y, z, u, e) => {
    let c = mul(c1, 0.95 + 0.08 * fbm(x * 500, y * 500, z * 500, s));
    c = mix(c, c2, clamp(e ** 1.5 * 0.95 + suave(0.5, 1, u) * 0.7) * (0.7 + 0.3 * fbm(x * 300, y * 300, z * 300, s + 1)));
    c = mix(c, cc, suave(0.82, 1, u) * 0.55);
    return c;
  }, { pontas: 8, voltas: 2.8 }), 'acetinado', true)];
};

const gForminhaArroz: Gerador = (k) => {
  // arroz moldado na forminha e desenformado: cúpula de grãos com legumes e ervas picados
  const { c1, c2, s } = k;
  const R = k.T * 0.5, Rt = R * 0.8, H = R * 1.05;
  const out: Parte[] = [];
  const raioEm = (y: number) => lerp(R, Rt, y / H);
  const grao: CorFn = (x, y, z) => {
    const c0 = celula(x * 700, y * 1400, z * 700, s);
    return mul(mix(c1, c2, suave(0.55, 0.95, c0) * 0.6), 1);
  };
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, H * 0.06], [Rt * 1.01, H * 0.92], [Rt * 0.9, H], [0, H * 1.01]], n: 24, m: 40, cor: grao,
    mod: (t, a) => 1 + 0.02 * ruido(Math.cos(a) * 9, t * 30, Math.sin(a) * 9, s),
  }), 'acetinado', true));
  const pontos = (n: number, cb: (p: THREE.Vector3, nrm: THREE.Vector3, i: number) => void) => {
    for (let i = 0; i < n; i++) {
      const topo = k.r.n() < 0.32;
      const a = k.r.f(0, TAU);
      if (topo) {
        const rr = Math.sqrt(k.r.n()) * Rt * 0.85;
        cb(V(Math.cos(a) * rr, H * 1.005, Math.sin(a) * rr), V(0, 1, 0), i);
      } else {
        const y = k.r.f(0.08, 0.92) * H;
        const r = raioEm(y);
        cb(V(Math.cos(a) * r, y, Math.sin(a) * r), V(Math.cos(a), (R - Rt) / H, Math.sin(a)).normalize(), i);
      }
    }
  };
  pontos(100, (p, n) => {
    const g = elipsoide(0.0032, 0.0011, 0.0012, grao, 3, 5);
    g.rotateX(k.r.f(-0.4, 0.4));
    out.push(parte(apontar(g, n, p, k.r.f(0, TAU)), 'acetinado'));
  });
  const leg = ['#e2701e', '#e2701e', '#5a9a3a', '#3a7a2a', '#d23a24', '#6aa04a'].map(rgb);
  pontos(26, (p, n, i) => {
    const c = leg[i % leg.length];
    const q = i % 3 === 2 ? 0.0028 : 0.0035;
    const g = i % 3 === 2 ? bloco(q * 1.4, 0.0005, q, fixa(c)) : bloco(q, q * 0.6, q, tomR(c, 0.08, 500, s + i));
    out.push(parte(apontar(g, n, p, k.r.f(0, TAU)), 'acetinado'));
  });
  return out;
};

const gTimbaleEspinafre: Gerador = (k) => {
  // creme de espinafre assado em forminha e desenformado: dariole lisa, verde fechado, com fiapos de folha
  const { c1, c2, s } = k;
  const R = k.T * 0.5, Rt = R * 0.78, H = R * 1.3;
  return [parte(torno({
    caminho: [[0, 0], [R * 0.97, 0], [R, H * 0.05], [Rt * 1.02, H * 0.9], [Rt * 0.92, H * 0.99], [Rt * 0.5, H * 1.02], [0, H * 1.03]], n: 26, m: 40,
    cor: (x, y, z) => {
      let c = mul(c1, 0.92 + 0.12 * fbm(x * 220, y * 220, z * 220, s));
      c = mix(c, c2, suave(0.35, 0.75, fbm(x * 900, y * 900, z * 900, s + 4)) * 0.6);
      c = mix(c, mul(c1, 0.6), (1 - suave(0.08, 0.2, celula(x * 600, y * 600, z * 600, s + 2))) * 0.4);
      return c;
    },
    mod: (t, a) => 1 + 0.008 * fbm(Math.cos(a) * 3, t * 8, Math.sin(a) * 3, s),
  }), 'brilhante', true)];
};

/* ------------------------------------------------------------------ */
/* maçã                                                                 */
/* ------------------------------------------------------------------ */

function corPeleMaca(c1: RGB, c2: RGB, s: number): CorFn {
  return (x, y, z) => {
    let c = mix(c1, c2, suave(0.15, 0.85, fbm(x * 40, y * 90, z * 40, s)) * 0.45);
    c = mul(c, 1 + 0.08 * Math.sin(Math.atan2(z, x) * 26 + fbm(x * 60, y * 60, z * 60, s) * 4) * 0.5);
    c = mix(c, mul(c2, 1.1), (1 - suave(0.08, 0.16, celula(x * 520, y * 520, z * 520, s))) * 0.5);
    return c;
  };
}

const gMacaEspiral: Gerador = (k) => {
  // maçã descascada em espiral decorativa (listras de casca) e a tira fina de casca enrolada ao lado
  const { c1, c2, c3, ci, s } = k;
  const R = 0.037, H = 0.068;
  const out: Parte[] = [];
  const pele = corPeleMaca(c1, c2, s);
  const polpa: CorFn = (x, y, z) => mul(ci, 0.96 + 0.06 * fbm(x * 300, y * 300, z * 300, s + 1));
  const listra = (y: number, a: number) => ((y / H) * 3.2 + a / TAU) % 1;
  const corpoM = torno({
    caminho: (u) => {
      const th = u * PI;
      let r = R * Math.sin(th) * (1 + 0.1 * Math.sin(th * 0.9 - 0.4));
      let h = (H / 2) * (1 - Math.cos(th));
      const sn = Math.sin(th);
      if (u > 0.5) h -= 0.09 * H * Math.exp(-((sn / 0.3) ** 2));
      else h += 0.06 * H * Math.exp(-((sn / 0.3) ** 2));
      r *= 1;
      return [r, h];
    },
    n: 26, m: 36,
    mod: (t, a) => {
      const y = t * H;
      const l = ((listra(y, a + PI) % 1) + 1) % 1;
      return l < 0.42 ? 1 : 0.985 + 0.006 * Math.cos(a * 18);
    },
    cor: (x, y, z) => {
      const a = Math.atan2(z, x) + PI;
      const l = ((listra(y, a) % 1) + 1) % 1;
      const c = l < 0.42 ? pele(x, y, z, 0, 0) : polpa(x, y, z, 0, 0);
      return Math.hypot(x, z) < R * 0.18 ? mix(c, mul(c3, 0.8), 0.5) : c;
    },
  });
  corpoM.translate(-0.035, 0, 0);
  out.push(parte(corpoM, 'brilhante', true));
  out.push(parte(cabinho(-0.035, H * 0.9, 0, H * 0.22, R * 0.06, c3, 0.3), 'fosco'));
  // tira de casca enrolada como mola, deitada
  const voltas = 2.6, Rh = 0.02, W = 0.011, len = 0.042, x0 = 0.012;
  out.push(parte(chapa(80, 3, (u, v, lado) => {
    const th = u * voltas * TAU;
    const rr = Rh * (1 - 0.22 * u) + (lado ? 0.0005 : -0.0005);
    const w = W * Math.sqrt(suave(0, 0.06, u) * suave(1, 0.94, u)) * (1 + 0.08 * Math.sin(th * 2));
    return [x0 + u * len + v * w * 0.5, Rh + rr * Math.cos(th), rr * Math.sin(th)];
  }, (x, y, z, _u, _v, lado) => (lado ? pele(x, y, z, 0, 0) : polpa(x, y, z, 0, 0))), 'brilhante'));
  return out;
};

const gMacaBoleada: Gerador = (k) => {
  // metade de maçã deitada com a cavidade redonda do boleador no lugar do miolo
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * 0.5;
  const raio = (t: number) => { const u = 2 * t - 1; const r = R * Math.max(0, 1 - Math.abs(u) ** 2.2) ** 0.55 * (1 + 0.08 * u) * (1 - 0.1 * Math.exp(-(((1 - Math.abs(u)) / 0.12) ** 2))); return { ry: r * 0.92, rz: r }; };
  const xc = L * 0.04, rc = R * 0.4;
  const cava = (x: number, z: number) => Math.sqrt(Math.max(0, rc * rc - (x - xc) ** 2 - z * z)) * 0.85;
  const face: CorFn = (x, y, z, t, v) => {
    const borda = Math.abs(2 * v - 1);
    let c = mul(ci, 0.97 + 0.05 * fbm(x * 400, 0, z * 400, s));
    const d = Math.hypot((x - xc) / (R * 0.62), z / (R * 0.55));
    c = mix(c, mix(ci, rgb('#d8d8a0'), 0.5), (1 - suave(0.0, 0.05, Math.abs(d - 1))) * 0.5);
    const fundo = cava(x, z) / (rc * 0.85);
    c = mix(c, mul(ci, 0.88), suave(0, 0.3, fundo) * 0.7);
    c = mix(c, c1, suave(0.965, 0.99, borda));
    if (t < 0.04) c = mix(c, mul(c3, 0.5), 0.6);
    return c;
  };
  const [casca, corte] = meiaPeca({ L, nt: 36, nv: 22, raio, pele: corPeleMaca(c1, c2, s), face, cava: (x, z) => cava(x, z) });
  return [
    parte(casca, 'brilhante', true), parte(corte, 'acetinado', true),
    parte(caule([V(L / 2 - 0.004, raio(0.5).ry + 0.0005, 0), V(L / 2 + 0.008, raio(0.5).ry + 0.001, 0.001), V(L / 2 + 0.016, raio(0.5).ry + 0.0025, 0.003)], 0.0012, 0.0009, tomR(c3, 0.1, 500, s), 5), 'fosco'),
  ];
};

const gAnelMaca: Gerador = (k) => {
  // anel de maçã descascada e sem miolo, cortado com a fruta deitada
  const { ci, c2, s } = k;
  const Ro = k.T * 0.5, Ri = Ro * 0.3, h = 0.009;
  return [parte(tornoAnel({
    caminho: [[Ro * 0.99, 0.0004], [Ro, h * 0.5], [Ro * 0.99, h - 0.0004], [Ro * 0.97, h], [Ri * 1.04, h], [Ri, h * 0.9], [Ri, h * 0.1], [Ri * 1.04, 0], [Ro * 0.97, 0]],
    n: 40, m: 48,
    desloc: (p) => {
      const r = Math.hypot(p.x, p.z);
      if (r > Ro * 0.95) { const a = Math.atan2(p.z, p.x); const k2 = 1 + 0.012 * Math.cos(a * 14); p.x *= k2; p.z *= k2; }
    },
    cor: (x, y, z) => {
      const r = Math.hypot(x, z) / Ro;
      const a = Math.atan2(z, x);
      let c = mul(ci, 0.97 + 0.05 * fbm(x * 400, y * 400, z * 400, s));
      const linha = 1 - suave(0, 0.03, Math.abs(r - 0.6 - 0.03 * Math.cos(5 * a)));
      c = mix(c, mix(ci, rgb('#d8d49a'), 0.6), linha * 0.6);
      const estrela = r < 0.45 ? suave(0.5, 1, Math.cos(5 * a)) * suave(0.45, 0.33, r) : 0;
      c = mix(c, mix(ci, c2, 0.4), estrela * 0.4);
      if (r > 0.96) c = mix(c, mul(ci, 0.92), 0.6);
      return c;
    },
  }), 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* abacaxi                                                              */
/* ------------------------------------------------------------------ */

/** Escamas de abacaxi: 0 na borda da escama, 1 no centro (olho). `eixo` ao longo e ângulo em volta. */
function escama(eixo: number, a: number, comp: number): number {
  const ns = 8;
  const u = (a / TAU) * ns + (eixo / comp) * 6, w = (a / TAU) * ns - (eixo / comp) * 6;
  const fu = u - Math.floor(u), fw = w - Math.floor(w);
  return Math.min(Math.abs(fu - 0.5), Math.abs(fw - 0.5)) * 2;
}
function corCascaAbacaxi(c1: RGB, c2: RGB, s: number, comp: number): (x: number, y: number, z: number, eixo: number, a: number) => RGB {
  return (x, y, z, eixo, a) => {
    const e = escama(eixo, a, comp);
    const c = mix(c2, c1, suave(0.05, 0.5, e));
    return mul(mix(c, mul(c2, 0.55), suave(0.82, 1, e)), 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
  };
}
function polpaAbacaxi(ci: RGB, s: number): CorFn {
  return (x, y, z) => {
    const a = Math.atan2(z, x);
    return mul(mix(ci, rgb('#f6d24a'), suave(0.2, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.5), 1 - 0.07 * Math.abs(Math.sin(a * 40)) ** 6);
  };
}

/** Coroa de folhas de abacaxi em pé (base em y = 0), folhas espiraladas abrindo para fora. */
function coroaAbacaxi(k: K, n: number, L: number, cor: RGB, abre = 0.25, so?: (ang: number) => boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const ouro = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const ang = -i * ouro;
    if (so && !so(((ang % TAU) + TAU) % TAU)) continue;
    const Lf = L * lerp(1, 0.45, f) * k.r.f(0.85, 1.1);
    const tom = mix(cor, rgb('#6a7a5a'), k.r.f(0, 0.35));
    const g = petala(Lf, Lf * 0.13, {
      contorno: contornos.lanca, concha: 0.5, curva: -0.35, esp: Lf * 0.014, n: 10, m: 6,
      cima: (x, y, z) => mul(tom, 1.05 + 0.05 * Math.sin(z * 4000)), baixo: (x) => mix(mul(tom, 0.9), rgb('#8a9a7a'), 0.25 * (1 - x / Lf)),
    });
    g.rotateZ(PI / 2 - lerp(abre + 0.55, 0.12, f));
    g.rotateY(ang);
    out.push(g);
  }
  return out;
}

/** Toco do topo cortado com a coroa: disco curto de casca, a face de baixo em polpa. */
function tocoCoroa(k: K, Rt: number, ht: number): THREE.BufferGeometry {
  const casca = corCascaAbacaxi(k.c1, k.c2, k.s, 0.15);
  const polpa = polpaAbacaxi(k.ci, k.s);
  return torno({
    caminho: [[0, 0], [Rt, 0], [Rt * 0.98, ht * 0.5], [Rt * 0.7, ht], [0, ht]], n: 10, m: 28,
    cor: (x, y, z) => (y < 0.0006 ? polpa(x, y, z, 0, 0) : casca(x, y, z, y + 0.12, Math.atan2(x, z) + PI)),
  });
}

/** Casca oca de abacaxi em pé, com parede e fundo firmes (tigela). */
function cascaOca(k: K, R: number, H: number, w: number, yf: number): THREE.BufferGeometry {
  const casca = corCascaAbacaxi(k.c1, k.c2, k.s, H * 1.2);
  const polpa = polpaAbacaxi(k.ci, k.s);
  const Ri = R * 0.86 - w;
  const caminho: [number, number][] = [[0, 0], [R * 0.62, 0], [R * 0.93, H * 0.12], [R, H * 0.4], [R * 0.96, H * 0.75], [R * 0.86, H], [Ri + w * 0.1, H], [Ri, H * 0.95], [Ri * 1.04, H * 0.6], [Ri * 0.96, H * 0.3], [Ri * 0.7, yf + 0.006], [Ri * 0.3, yf], [0, yf]];
  let tot = 0;
  const acc = [0];
  for (let i = 1; i < caminho.length; i++) { tot += Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]); acc.push(tot); }
  const tBorda = acc[5] / tot, tDentro = acc[6] / tot;
  return torno({
    caminho, n: 32, m: 44,
    desloc: (p, t) => {
      if (t > tBorda) return;
      const a = Math.atan2(p.x, p.z) + PI;
      const e = escama(p.y, a, H * 1.2);
      const k2 = 1 + 0.045 * e * Math.sin(PI * clamp(p.y / H)) ;
      p.x *= k2; p.z *= k2;
    },
    cor: (x, y, z, t) => {
      if (t <= tBorda + 0.004) return casca(x, y, z, y, Math.atan2(x, z) + PI);
      if (t <= tDentro + 0.004) return mix(polpa(x, y, z, 0, 0), mul(k.c1, 0.9), suave(Ri + w * 0.7, Ri + w, Math.hypot(x, z)));
      return mul(mix(k.ci, rgb('#f2e6a8'), 0.45), 0.95 + 0.08 * Math.abs(Math.sin(y * 900 + Math.atan2(z, x) * 3)));
    },
  });
}

const gAbacaxiTigela: Gerador = (k) => {
  // casca oca servindo de tigela, cubos de polpa devolvidos dentro e a coroa deitada ao lado
  const { c3, s } = k;
  const R = 0.055, H = 0.15, w = 0.007, yf = 0.014;
  const out: Parte[] = [parte(cascaOca(k, R, H, w, yf), 'fosco', true)];
  const polpa = polpaAbacaxi(k.ci, s);
  const q = 0.016;
  const Ri = R * 0.86 - w;
  for (let i = 0; i < 22; i++) {
    const f = (i + 0.5) / 22;
    const rr = Math.sqrt(f) * (Ri - q * 0.6);
    const a = i * 2.39996;
    const y = H - q * 0.6 + (1 - f) * q * 1.4 + k.r.f(-0.002, 0.003);
    const g = bloco(q * k.r.f(0.9, 1.1), q * k.r.f(0.85, 1), q * k.r.f(0.9, 1.1), (x, yy, z) => mul(polpa(x + i, yy, z, 0, 0), 1 + 0.08 * Math.sign(yy)), [2, 2, 2]);
    g.rotateX(k.r.f(-0.5, 0.5)); g.rotateY(k.r.f(0, TAU)); g.rotateZ(k.r.f(-0.5, 0.5));
    g.translate(Math.cos(a) * rr, y, Math.sin(a) * rr);
    out.push(parte(g, 'umido'));
  }
  // coroa deitada ao lado, apontando para +X
  const coroa = [tocoCoroa(k, R * 0.5, 0.014), ...coroaAbacaxi(k, 18, 0.13, c3, 0.3).map((g) => g.translate(0, 0.012, 0))];
  for (const g of coroa) {
    g.rotateZ(-PI / 2 + 0.06);
    g.translate(R + 0.012, R * 0.52, -0.01);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gAbacaxiAnao: Gerador = (k) => {
  // abacaxi-anão aberto como tigela, bola de sorvete dentro e a coroa com o topo como tampa inclinada
  const { c3, s } = k;
  const R = 0.04, H = 0.085, w = 0.006, yf = 0.012;
  const out: Parte[] = [parte(cascaOca(k, R, H, w, yf), 'fosco', true)];
  const creme = rgb('#f3e7c6');
  const Rs = 0.029;
  out.push(parte(tf(elipsoide(Rs, Rs * 0.92, Rs, (x, y, z) => mul(creme, 0.94 + 0.08 * fbm(x * 260, y * 260, z * 260, s) - 0.05 * (1 - suave(0.1, 0.25, celula(x * 500, y * 500, z * 500, s)))), 12, 16, (t, a) => 1 + 0.05 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s)), [0, H + Rs * 0.35, 0]), 'acetinado'));
  const tampa = [tocoCoroa(k, R * 0.82, 0.013), ...coroaAbacaxi(k, 15, 0.085, c3, 0.25).map((g) => g.translate(0, 0.011, 0))];
  for (const g of tampa) {
    g.rotateZ(-0.62);
    g.translate(R * 0.95, H + 0.008, 0.004);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gAnelAbacaxi: Gerador = (k) => {
  // rodela de abacaxi descascada com o miolo duro tirado: anel dourado com marcas dos olhos na borda
  const { ci, c2, s } = k;
  const Ro = k.T * 0.5, Ri = Ro * 0.27, h = 0.012;
  const polpa = polpaAbacaxi(ci, s);
  return [parte(tornoAnel({
    caminho: [[Ro * 0.99, 0.0005], [Ro, h * 0.5], [Ro * 0.99, h - 0.0005], [Ro * 0.96, h], [Ri * 1.05, h], [Ri, h * 0.85], [Ri, h * 0.15], [Ri * 1.05, 0], [Ro * 0.96, 0]],
    n: 40, m: 56,
    cor: (x, y, z) => {
      const r = Math.hypot(x, z) / Ro;
      const a = Math.atan2(z, x);
      let c = mix(polpa(x, y, z, 0, 0), mul(ci, 1.08), suave(0.55, 0.3, r) * 0.5);
      c = mul(c, 1 - 0.08 * Math.abs(Math.sin(a * 46)) ** 4 * suave(0.3, 0.6, r));
      const olho = r > 0.86 ? (1 - suave(0.1, 0.32, celula(Math.cos(a) * 14, y * 120, Math.sin(a) * 14, s))) : 0;
      c = mix(c, mul(c2, 0.9), olho * 0.85);
      if (r < 0.3) c = mix(c, rgb('#f4eac0'), 0.5);
      return c;
    },
  }), 'umido', true)];
};

const gAbacaxiZiguezague: Gerador = (k) => {
  // quarto de abacaxi deitado na casca, com coroa; polpa solta da casca e fatiada, fatias empurradas
  // alternando os lados
  const { c1, c2, c3, ci, s } = k;
  const Lf = 0.2, Rm = 0.052, sk = 0.006, ya = Rm;
  const Rx = (x: number) => Rm * Math.max(0.04, 1 - Math.abs(x / (Lf / 2)) ** 3) ** 0.5;
  const casca = corCascaAbacaxi(c1, c2, s, Lf);
  const polpa = polpaAbacaxi(ci, s);
  const out: Parte[] = [];
  const P = (x: number, r: number, f: number): [number, number, number] => [x, ya - r * Math.cos(f), r * Math.sin(f)];
  const ab = PI / 4;
  out.push(parte(grade(40, 12, (u, v) => { const x = (u - 0.5) * Lf; return P(x, Rx(x) * (1 + 0.04 * escama(x, -ab + v * 2 * ab, Lf)), -ab + v * 2 * ab); }, (x, y, z, u, v) => casca(x, y, z, x, (-ab + v * 2 * ab) * 1.0 + PI)), 'fosco', true));
  out.push(parte(grade(40, 8, (u, v) => { const x = (u - 0.5) * Lf; return P(x, Math.max(0.001, Rx(x) - sk), -ab + v * 2 * ab); }, (x, y, z) => mul(mix(ci, rgb('#f2e6a8'), 0.4), 0.97 + 0.05 * fbm(x * 300, y * 300, z * 300, s)), true), 'acetinado', true));
  for (const lado of [-1, 1]) {
    out.push(parte(grade(40, 2, (u, w) => { const x = (u - 0.5) * Lf; const r = Rx(x); return P(x, lerp(Math.max(0.001, r - sk), r, w), lado * ab); }, (x, y, z, u, w) => mix(polpa(x, y, z, 0, 0), mul(c1, 0.9), suave(0.6, 1, w)), lado > 0), 'acetinado'));
  }
  // fatias em ziguezague
  const nf = 8, dx = 0.0175;
  for (let i = 0; i < nf; i++) {
    const xm = -0.075 + i * (dx + 0.002);
    const ro = Math.max(0.012, Rx(xm) - sk) * 0.99;
    const rc = 0.011;
    const poly: [number, number][] = [];
    for (let q = 0; q <= 6; q++) { const f = -ab + (q / 6) * 2 * ab; poly.push([ya - ro * Math.cos(f), ro * Math.sin(f)]); }
    for (let q = 3; q >= 0; q--) { const f = -ab + (q / 3) * 2 * ab; poly.push([ya - rc * Math.cos(f), rc * Math.sin(f)]); }
    const g = prisma(poly, xm - dx / 2, xm + dx / 2, (x, y, z) => mul(polpa(x, y, z, 0, 0), 1.05), (x, y, z) => mix(polpa(x, y, z, 0, 0), rgb('#f8e890'), 0.2));
    g.translate(0, 0.004, (i % 2 ? 1 : -1) * 0.013);
    out.push(parte(g, 'umido'));
  }
  // coroa (um quarto dela) na ponta +X
  const coroa = coroaAbacaxi(k, 22, 0.12, c3, 0.3, (ang) => Math.cos(ang) > -0.2);
  for (const g of coroa) {
    g.rotateZ(-PI / 2);
    g.translate(Lf / 2 - 0.004, ya - Rm * 0.35, 0);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* manga, cítricos, melão, kiwi, figo, romã e pera                      */
/* ------------------------------------------------------------------ */

const gMangaOurico: Gerador = (k) => {
  // bochecha de manga riscada em grade com a casca virada: cubos saltados em leque (ouriço)
  const { c1, c2, ci, s } = k;
  const a = k.T * 0.45, b = a * 0.72, y0 = 0.011, Hd = 0.02, cs = 0.0105, sp = 0.012;
  const out: Parte[] = [];
  const h = (x: number, z: number) => Hd * Math.max(0, 1 - (x / a) ** 2 - (z / b) ** 2);
  const base = elipsoide(a * 1.04, y0 + Hd * 0.6, b * 1.06, (x, y, z) => {
    if (y > y0 * 0.6) return mul(ci, 0.95);
    return mul(mix(c1, c2, suave(-0.3, 0.6, x / a + fbm(x * 40, y * 40, z * 40, s) * 0.5)), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s));
  }, 14, 20);
  const pa = base.getAttribute('position');
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    pa.setY(i, y > 0 ? y0 * 0.6 + h(x, z) * 0.7 : y * 0.7);
  }
  base.computeVertexNormals();
  base.translate(0, y0 * 0.75, 0);
  out.push(parte(base, 'acetinado', true));
  const corC = (i: number): CorFn => { const tom = k.r.f(0.92, 1.06); return (x, y, z) => mul(mix(ci, rgb('#f8c040'), suave(-cs * 0.5, cs * 0.5, y) * 0.5), tom * (1 + 0.04 * fbm(x * 600 + i, y * 600, z * 600, s))); };
  for (let ix = -4; ix <= 4; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const x = ix * sp, z = iz * sp;
      if ((x / a) ** 2 + (z / b) ** 2 > 0.92) continue;
      const nrm = V().set(2 * Hd * x / (a * a) * 1.6, 1, 2 * Hd * z / (b * b) * 1.6).normalize();
      const p = V(x, y0 * 0.75 + y0 * 0.6 + h(x, z) * 0.7, z).addScaledVector(nrm, cs * 0.45);
      const g = bloco(cs * k.r.f(0.92, 1.02), cs * 1.05, cs * k.r.f(0.92, 1.02), corC(ix * 10 + iz), [1, 2, 1]);
      out.push(parte(apontar(g, nrm, p, k.r.f(-0.05, 0.05)), 'umido'));
    }
  }
  return out;
};

const gLaranjaRemontada: Gerador = (k) => {
  // laranja descascada à vif, fatiada na horizontal e refeita empilhada, presa por um palito
  const { c1, ci, s } = k;
  const R = k.T * 0.44, nf = 7, gap = 0.0011;
  const out: Parte[] = [];
  const nseg = 10;
  const lado: CorFn = (x, y, z) => {
    const a = Math.atan2(z, x);
    const memb = 1 - suave(0.0, 0.08, Math.abs(Math.sin((a * nseg) / 2)));
    let c = mul(c1, 0.92 + 0.12 * fbm(x * 500, y * 500, z * 500, s));
    c = mix(c, mul(ci, 1.15), memb * 0.55);
    return c;
  };
  const face = (x: number, z: number) => {
    const r = Math.hypot(x, z) / R, a = Math.atan2(z, x);
    let c = mul(c1, 0.95 + 0.1 * fbm(x * 600, 0, z * 600, s));
    c = mix(c, mul(c1, 1.2), (1 - suave(0.1, 0.35, celula(r * 14, a * 6, 0, s))) * 0.25);
    const memb = 1 - suave(0.0, 0.06, Math.abs(Math.sin((a * nseg) / 2)) * r);
    c = mix(c, mul(ci, 1.1), memb * 0.7);
    c = mix(c, mul(ci, 1.15), suave(0.16, 0.08, r));
    return c;
  };
  let yb = 0;
  for (let i = 0; i < nf; i++) {
    const y0 = -R + (2 * R * i) / nf, y1 = -R + (2 * R * (i + 1)) / nf;
    const rr = (y: number) => Math.sqrt(Math.max(0, R * R - y * y));
    const cam: [number, number][] = [[0, 0]];
    cam.push([Math.max(0.0008, rr(y0 + 1e-5)), 0]);
    for (let q = 1; q < 4; q++) { const y = lerp(y0, y1, q / 4); cam.push([rr(y), y - y0]); }
    cam.push([Math.max(0.0008, rr(y1 - 1e-5)), y1 - y0]);
    cam.push([0, y1 - y0]);
    const hh = y1 - y0;
    const g = torno({
      caminho: cam, n: 9, m: 36,
      cor: (x, y, z) => (y < 1e-5 || y > hh - 1e-5 ? face(x, z) : lado(x, y, z, 0, 0)),
    });
    g.rotateY(k.r.f(-0.08, 0.08) + i * 0.15);
    g.translate(k.r.f(-0.0006, 0.0006), yb, k.r.f(-0.0006, 0.0006));
    out.push(parte(g, 'umido', true));
    yb += hh + gap;
  }
  out.push(parte(tubo([V(0, R * 0.4, 0), V(0, yb * 0.6, 0), V(0, yb + 0.016, 0)], { raio: (t) => 0.0011 * (1 - suave(0.85, 1, t) * 0.8), m: 6, n: 8, cor: tomR(rgb('#d8b884'), 0.06, 800, s) }), 'fosco'));
  return out;
};

const gSupremes: Gerador = (k) => {
  // gomos de laranja tirados entre as membranas (suprêmes), em leque
  const { c1, ci, s } = k;
  const out: Parte[] = [];
  const Lg = k.T * 0.58, Wg = 0.016, Tg = 0.011;
  const polpa: CorFn = (x, y, z) => {
    const c0 = celula(x * 260, y * 500, z * 500, s);
    return mul(mix(c1, mul(c1, 1.25), (1 - suave(0.15, 0.6, c0)) * 0.5), 0.94 + 0.08 * fbm(x * 300, y * 300, z * 300, s));
  };
  const gomo = (): THREE.BufferGeometry[] => {
    const zin = (u: number) => 0.0018 * Math.sin(PI * u);
    const zout = (u: number) => zin(u) + Wg * Math.sin(PI * u) ** 0.65;
    const th = (u: number) => Tg * Math.sin(PI * u) ** 0.6;
    const x = (u: number) => (u - 0.5) * Lg;
    return [
      grade(24, 6, (u, v) => [x(u), 0, lerp(zin(u), zout(u), v)], polpa),
      grade(24, 6, (u, v) => [x(u), v * th(u), lerp(zin(u), zout(u), v)], polpa, true),
      grade(24, 5, (u, w) => [x(u), (1 - w) * th(u), zout(u) + Tg * 0.35 * Math.sin(PI * w) * Math.sin(PI * u) ** 0.5], (x2, y, z) => mix(polpa(x2, y, z, 0, 0), mul(ci, 1.1), 0.12), true),
    ];
  };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = (i - (n - 1) / 2) * 0.36;
    for (const g of gomo()) {
      g.translate(Lg * 0.62, 0.0015 * (i % 2), 0);
      g.rotateY(ang - PI / 2);
      out.push(parte(g, 'umido', i === 3));
    }
  }
  return out;
};

function corRendaMelao(c1: RGB, c2: RGB, s: number): CorFn {
  return (x, y, z) => {
    const r = celula(x * 160, y * 160, z * 160, s);
    return mul(mix(c1, c2, suave(0.72, 0.9, r) * 0.85), 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
  };
}

const gMelaoTaca: Gerador = (k) => {
  // metade de cantalupo com a borda em ziguezague, sem sementes, cheia de bolinhas de polpa
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, Ri = R - 0.019, A = 0.017, n = 10;
  const yb = R - 0.022;
  const renda = corRendaMelao(c1, c2, s);
  const out: Parte[] = [];
  const cam: [number, number][] = [];
  for (let q = 0; q <= 10; q++) { const th = (q / 10) * (PI / 2); cam.push([R * Math.sin(th), R - R * Math.cos(th)]); }
  cam.push([Ri, R]);
  for (let q = 10; q >= 0; q--) { const th = (q / 10) * (PI / 2); cam.push([Ri * Math.sin(th), R - Ri * Math.cos(th)]); }
  out.push(parte(torno({
    caminho: cam, n: 34, m: n * 6,
    desloc: (p) => {
      if (p.y <= yb) return;
      const a = Math.atan2(p.z, p.x) + PI;
      const topo = R + A * ziguezague(a, n);
      p.y = yb + (p.y - yb) * ((topo - yb) / (R - yb));
    },
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      const rf = Math.hypot(r, R - y);
      if (rf > R - 0.0015) return renda(x, y, z, 0, 0);
      let c = mul(ci, 0.95 + 0.08 * fbm(x * 300, y * 300, z * 300, s));
      c = mix(c, rgb('#d8dca0'), suave(R - 0.006, R - 0.002, rf) * 0.8);
      if (rf < Ri + 0.001) c = mix(c, mul(ci, 0.85), 0.5);
      return c;
    },
  }), 'acetinado', true));
  for (let i = 0; i < 11; i++) {
    const rb = 0.0115;
    const f = (i + 0.5) / 11, rr = Math.sqrt(f) * (Ri - rb * 1.1), a = i * 2.39996;
    const y = R - Math.sqrt(Math.max(0, Ri * Ri - rr * rr)) * 0.55 + rb * 0.9 + (1 - f) * 0.008;
    out.push(parte(tf(elipsoide(rb, rb, rb, (x, yy, z) => mul(ci, 0.95 + 0.1 * fbm(x * 500, yy * 500, z * 500, s + i) + 0.1 * suave(0, rb, yy)), 8, 10), [Math.cos(a) * rr, y, Math.sin(a) * rr]), 'umido'));
  }
  return out;
};

const gSaladaMelao: Gerador = (k) => {
  // bolinhas de melão com cubos de manga, abacaxi e kiwi do mesmo tamanho
  const { ci, s } = k;
  const out: Parte[] = [];
  const manga = rgb('#f2a020'), abac = rgb('#f2d860'), kiwi = rgb('#7ab030'), semente = rgb('#1e1a10'), centro = rgb('#e8ecc0');
  const pecas: ((i: number) => THREE.BufferGeometry)[] = [
    (i) => elipsoide(0.0085, 0.0085, 0.0085, (x, y, z) => mul(ci, 0.95 + 0.1 * fbm(x * 600, y * 600, z * 600, s + i)), 7, 9),
    (i) => bloco(0.012, 0.012, 0.012, (x, y, z) => mul(manga, 0.95 + 0.08 * fbm(x * 600 + i, y * 600, z * 600, s)), [1, 1, 1]),
    (i) => elipsoide(0.0085, 0.0085, 0.0085, (x, y, z) => mul(ci, 0.95 + 0.1 * fbm(x * 600, y * 600, z * 600, s + i)), 7, 9),
    (i) => bloco(0.012, 0.012, 0.012, (x, y, z) => mul(abac, 0.95 + 0.06 * Math.abs(Math.sin(x * 800 + i))), [1, 1, 1]),
    () => bloco(0.011, 0.011, 0.011, (x, y, z) => { const r = Math.hypot(x, z); return r < 0.0025 ? centro : (Math.abs(r - 0.004) < 0.0012 ? mix(kiwi, semente, 0.7) : kiwi); }, [2, 1, 2]),
  ];
  out.push(...amontoar(k, 22, 0.03, 0.016, 0.008, (i) => pecas[i % pecas.length](i)).map((g, i) => parte(g, 'umido', i === 0)));
  return out;
};

const gSorbetMelao: Gerador = (k) => {
  // bola de sorbet de cantalupo: granulado de gelo, laranja-claro, com o rebordo da colher
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = R * 1.75;
  return [parte(torno({
    caminho: (u) => {
      const th = u * PI;
      let r = R * Math.sin(th);
      if (u < 0.32) r *= 0.9 + 0.1 * (u / 0.32);
      if (u > 0.2 && u < 0.34) r *= 1 + 0.06 * Math.sin(((u - 0.2) / 0.14) * PI);
      return [r, (H / 2) * (1 - Math.cos(th))];
    },
    n: 22, m: 30,
    mod: (t, a) => 1 + 0.035 * fbm(Math.cos(a) * 4, t * 7, Math.sin(a) * 4, s) + 0.02 * ruido(Math.cos(a) * 20, t * 30, Math.sin(a) * 20, s),
    cor: (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 400, y * 400, z * 400, s)) * 0.5), 1 + 0.12 * (1 - suave(0.05, 0.2, celula(x * 700, y * 700, z * 700, s)))),
  }), 'acetinado', true)];
};

const gKiwiTopo: Gerador = (k) => {
  // kiwi em pé com o topo cortado como ovo quente: miolo branco, anel de sementes, e a tampa ao lado
  const { c1, c2, ci, s } = k;
  const R = 0.024, H = 0.064, hc = H * 0.78;
  const rc = R * Math.sqrt(1 - ((hc - H / 2) / (H / 2)) ** 2);
  const out: Parte[] = [];
  const pele: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.12 * fbm(x * 150, y * 150, z * 150, s)), c2, suave(0.2, 0.7, ruido(x * 900, y * 900, z * 900, s)) * 0.5);
  const face = (x: number, z: number, r: number, a: number): RGB => {
    let c = mul(ci, 0.92 + 0.1 * Math.abs(Math.sin(a * 30 + fbm(x * 200, 0, z * 200, s))) * suave(0.25, 0.5, r));
    c = mix(c, mul(ci, 1.25), suave(0.75, 0.4, r) * 0.25);
    const sem = Math.abs(Math.sin(a * 17)) ** 3 * (1 - suave(0.0, 0.05, Math.abs(r - 0.36)));
    c = mix(c, rgb('#1a1208'), sem * 0.95);
    c = mix(c, rgb('#f2f0d8'), suave(0.22, 0.14, r));
    c = mix(c, mul(c1, 0.8), suave(0.95, 1, r));
    return c;
  };
  out.push(parte(torno({
    caminho: (u) => {
      const ym = hc;
      const lim = Math.acos(clamp(1 - (2 * ym) / H));
      if (u < 0.9) { const th = (u / 0.9) * lim; return [R * Math.sin(th), (H / 2) * (1 - Math.cos(th))]; }
      return [rc * (1 - (u - 0.9) / 0.1), hc - 0.003 * ((u - 0.9) / 0.1)];
    },
    n: 24, m: 30, cor: pele,
  }), 'fosco', true));
  out.push(parte(discoPolar(rc, hc, 12, 40, face), 'umido', true));
  // tampa virada com o corte para cima, ao lado
  const hcap = H - hc;
  const tampa = torno({
    caminho: (u) => { const th = u * Math.acos(clamp(1 - (2 * hcap) / H)); return [R * Math.sin(th), hcap - (H / 2) * (1 - Math.cos(th))]; },
    n: 10, m: 24, cor: pele,
  });
  tampa.translate(0, -hcap, 0);
  tampa.rotateX(PI);
  const disco = discoPolar(rc * 0.98, 0.0002, 8, 32, (x, z, r, a) => face(x, z, r, a));
  for (const g of [tampa, disco]) { g.rotateZ(0.25); g.translate(0.042, 0.0035, 0.006); }
  out.push(parte(tampa, 'fosco'), parte(disco, 'umido'));
  return out;
};

const gFlorFigo: Gerador = (k) => {
  // figo cortado em cruz a partir do topo e aberto em quatro pétalas: polpa rosada cheia de sementinhas
  const { c1, c2, c3, ci, s } = k;
  const R = k.T * 0.47, Hb = R * 2.1;
  const sh = 0.36;
  const perfil = (sx: number): [number, number] => {
    const th = sx * PI;
    let r = R * Math.sin(th);
    let y = (Hb / 2) * (1 - Math.cos(th));
    const kk = suave(1 - 0.38 * 1.6, 1, sx);
    r *= lerp(1, 0.22, kk);
    y += kk * Hb * 0.38 * 0.6;
    return [r, y];
  };
  const pele: CorFn = (x, y, z) => mul(mix(c1, c2, suave(Hb * 0.6, Hb * 1.1, y) * 0.6 + suave(0.3, 0.9, fbm(x * 120, y * 120, z * 120, s)) * 0.2), 1 + 0.05 * (1 - suave(0.05, 0.15, celula(x * 600, y * 600, z * 600, s))));
  const miolo = (x: number, y: number, z: number, w: number, topo: number): RGB => {
    let c = mix(mul(ci, 0.82), ci, suave(0.2, 0.6, w));
    c = mix(c, rgb('#f2e0c4'), suave(0.62, 0.78, w));
    c = mix(c, c1, suave(0.92, 0.98, w));
    c = mix(c, rgb('#f2e0c4'), suave(0.7, 0.95, topo) * 0.6);
    const sem = 1 - suave(0.1, 0.3, celula(x * 1400, y * 1400, z * 1400, s));
    if (w < 0.7) c = mix(c, rgb('#f0d890'), sem * 0.7);
    return c;
  };
  const out: Parte[] = [];
  // base inteira com o centro rosado
  const [rh, yh] = perfil(sh);
  const cam: [number, number][] = [];
  for (let q = 0; q <= 8; q++) cam.push(perfil((q / 8) * sh));
  cam.push([rh * 0.5, yh + 0.002]);
  cam.push([0, yh + 0.0028]);
  out.push(parte(torno({ caminho: cam, n: 14, m: 28, cor: (x, y, z) => (y > yh - 0.0004 ? miolo(x, y, z, Math.hypot(x, z) / rh, 0) : pele(x, y, z, 0, 0)) }), 'acetinado', true));
  const alfa = 0.6;
  for (let i = 0; i < 4; i++) {
    const s0 = (u: number) => lerp(sh, 1, u);
    const pecas: THREE.BufferGeometry[] = [];
    pecas.push(grade(14, 6, (u, v) => { const [r, y] = perfil(s0(u)); const f = (v - 0.5) * (PI / 2); return [r * Math.cos(f), y, r * Math.sin(f)]; }, pele));
    for (const sg of [-1, 1]) {
      const f = sg * PI / 4;
      pecas.push(grade(14, 6, (u, w) => { const [r, y] = perfil(s0(u)); return [w * r * Math.cos(f), y, w * r * Math.sin(f)]; }, (x, y, z, u, w) => miolo(x, y, z, w, u), sg > 0));
    }
    for (const g of pecas) {
      g.translate(-rh * 0.3, -yh, 0);
      g.rotateZ(-alfa);
      g.translate(rh * 0.3, yh, 0);
      g.rotateY(i * (PI / 2) + PI / 4);
      out.push(parte(g, 'acetinado'));
    }
  }
  return out;
};

const gSementesRoma: Gerador = (k) => {
  // metade de romã com o corte para cima e um montinho de sementes soltas sobre o suco espremido
  const { c1, c2, ci, s } = k;
  const R = 0.04, h = R * 0.9;
  const out: Parte[] = [];
  const casca: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.0, 0.8, fbm(x * 40, y * 40, z * 40, s + 2)) * 0.4), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s));
  const cx = -0.045;
  const corpoR = torno({
    caminho: (u) => {
      if (u < 0.86) { const th = (u / 0.86) * (PI / 2) * 1.02; return [R * Math.sin(th) * (1 + 0.04 * Math.sin(th * 3)), h - R * Math.cos(th) * 0.98 + 0.002]; }
      return [R * 1.0 * (1 - (u - 0.86) / 0.14), h - 0.003 * ((u - 0.86) / 0.14)];
    },
    n: 18, m: 32, cor: casca, mod: (t, a) => 1 + 0.02 * Math.cos(a * 6) * t,
  });
  corpoR.translate(cx, 0, 0);
  out.push(parte(corpoR, 'brilhante', true));
  const disco = discoPolar(R, h + 0.0012, 10, 36, (x, z, r, a) => {
    let c = mix(rgb('#f0e0a8'), rgb('#f6eccc'), suave(0.85, 0.95, r));
    c = mix(c, c1, suave(0.97, 1, r));
    const memb = 1 - suave(0.0, 0.08, Math.abs(Math.sin(a * 3)) * r);
    return mix(c, rgb('#f2e4b0'), memb * 0.4);
  });
  disco.translate(cx, 0, 0);
  out.push(parte(disco, 'acetinado'));
  const aril = (i: number) => {
    const tom = k.r.f(0.85, 1.1);
    return elipsoide(0.0032, 0.0026, 0.0024, (x, y, z) => mul(mix(ci, mul(ci, 1.6), suave(-0.001, 0.0025, y) * 0.5), tom), 4, 6, (t, a) => 1 + 0.08 * Math.cos(a * 3 + i));
  };
  // arilos encaixados na face, separados pelas membranas
  for (let i = 0; i < 40; i++) {
    const f = (i + 0.5) / 40, rr = Math.sqrt(f) * R * 0.82, a = i * 2.39996;
    if (Math.abs(Math.sin(a * 3)) * rr < 0.0018) continue;
    const g = aril(i);
    g.rotateY(a); g.rotateX(k.r.f(-0.3, 0.3));
    g.translate(cx + Math.cos(a) * rr, h + 0.0022, Math.sin(a) * rr);
    out.push(parte(g, 'brilhante'));
  }
  // suco espremido e sementes soltas
  out.push(parte(torno({ caminho: [[0, 0], [0.026, 0], [0.027, 0.0008], [0, 0.0012]], n: 4, m: 30, cor: tomR(mul(ci, 0.7), 0.1, 200, s), mod: (t, a) => 1 + 0.12 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s) }).translate(0.03, 0, 0), 'umido'));
  out.push(...amontoar(k, 34, 0.021, 0.012, 0.004, aril, 0.03, 0).map((g) => parte(g, 'brilhante')));
  return out;
};

const gPeraVinho: Gerador = (k) => {
  // pera descascada, pochê no vinho tinto (polpa roxa por fora, rosada por dentro), fatiada em leque
  // a partir do pescoço, que fica inteiro com o cabinho
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * 0.34;
  const raio = (t: number) => {
    const b = Math.sqrt(Math.max(0, 1 - ((t - 0.32) / 0.34) ** 2));
    const p = 0.58 * Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2));
    return R * Math.max(b, p) * Math.sqrt(suave(0, 0.05, t)) ;
  };
  const vinho: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.2, 0.9, fbm(x * 70, y * 70, z * 70, s)) * 0.45), 1 + 0.06 * fbm(x * 300, y * 300, z * 300, s));
  const dentro = (x: number, y: number, z: number, prof: number): RGB => mix(vinho(x, y, z, 0, 0), mix(ci, mul(ci, 0.9), suave(0.6, 0.9, prof)), suave(0.03, 0.4, prof));
  const fr = [-1, -0.6, -0.2, 0.2, 0.6, 1];
  const out: Parte[] = [];
  const xp = L * 0.3;
  for (let j = 0; j < 5; j++) {
    const fa = fr[j], fb = fr[j + 1];
    const X = (u: number) => (u - 0.5) * L;
    const H = (u: number) => raio(u) * 0.95;
    const gs: THREE.BufferGeometry[] = [];
    gs.push(grade(26, 4, (u, v) => { const f = lerp(fa, fb, v); return [X(u), H(u) * Math.sqrt(Math.max(0, 1 - f * f)), raio(u) * f]; }, vinho, true));
    gs.push(grade(26, 2, (u, v) => [X(u), 0, raio(u) * lerp(fa, fb, v)], vinho));
    for (const [f, inv] of [[fa, false], [fb, true]] as [number, boolean][]) {
      gs.push(grade(26, 4, (u, w) => [X(u), w * H(u) * Math.sqrt(Math.max(0, 1 - f * f)), raio(u) * f], (x, y, z, u, w) => {
        const rho = Math.hypot(w * Math.sqrt(Math.max(0, 1 - f * f)), f);
        return dentro(x, y, z, 1 - rho);
      }, inv));
    }
    const ang = (j - 2) * 0.17;
    for (const g of gs) {
      g.translate(-xp, 0, 0);
      g.rotateY(ang);
      g.translate(xp, 0, 0);
      out.push(parte(g, 'brilhante', j === 2));
    }
  }
  out.push(parte(caule([V(L / 2 - 0.004, raio(0.97) * 0.9 + 0.002, 0), V(L / 2 + 0.008, raio(0.97) + 0.004, 0.001), V(L / 2 + 0.018, raio(0.97) + 0.009, 0.003)], 0.0016, 0.0011, tomR(c3, 0.1, 500, s), 5), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* frutas grelhadas, em papelote, em tempura e coco tostado              */
/* ------------------------------------------------------------------ */

const gEspetoFrutas: Gerador = (k) => {
  // espeto de abacaxi, manga, banana e papaia com listras de grelha
  const { s } = k;
  const L = k.T;
  const out: Parte[] = [];
  out.push(parte(tubo([V(-L / 2, 0, 0), V(0, 0, 0), V(L / 2, 0, 0)], { raio: (t) => 0.0017 * (1 - suave(0.93, 1, t) * 0.9), m: 6, n: 10, cor: tomR(rgb('#d8bc8a'), 0.08, 600, s) }), 'fosco'));
  const tipos = [
    { c: rgb('#f0cc40'), q: 0.021 }, { c: rgb('#f09a20'), q: 0.019 }, { c: rgb('#f2e6bc'), q: 0.0 }, { c: rgb('#f07a4a'), q: 0.02 },
  ];
  const caramelo = rgb('#a8641e'), listra = rgb('#3a2010');
  const n = 8;
  for (let i = 0; i < n; i++) {
    const tp = tipos[i % 4];
    const x = -L / 2 + L * 0.16 + i * (L * 0.72 / (n - 1));
    const cor: CorFn = (xx, y, z) => mix(mul(tp.c, 0.95 + 0.08 * fbm(xx * 500, y * 500, z * 500, s + i)), caramelo, suave(0.4, 1, fbm(xx * 120, y * 120, z * 120, s + i)) * 0.4);
    if (tp.q === 0) {
      const g = torno({ caminho: [[0, -0.007], [0.0125, -0.007], [0.0135, 0], [0.0125, 0.007], [0, 0.007]], n: 8, m: 20, cor: (xx, y, z) => { const r = Math.hypot(xx, z); return r < 0.003 ? mix(tp.c, rgb('#8a6a3a'), 0.4) : mix(cor(xx, y, z, 0, 0), caramelo, suave(0.009, 0.0135, r) * 0.6); } });
      g.rotateZ(PI / 2);
      g.translate(x, 0, 0);
      out.push(parte(g, 'acetinado', i === 2));
      continue;
    }
    const q = tp.q;
    const g = bloco(q, q * 0.92, q, cor, [2, 2, 2]);
    g.rotateX(k.r.f(-0.15, 0.15)); g.rotateY(k.r.f(-0.15, 0.15));
    g.translate(x, 0, 0);
    out.push(parte(g, 'umido', i === 3));
    for (const o of [-0.22, 0.22]) {
      const m = bloco(q * 0.8, 0.0007, 0.0023, fixa(mix(listra, caramelo, 0.25)));
      m.rotateY(PI / 4);
      m.translate(x - o * q * Math.SQRT1_2, q * 0.46 + 0.0003, o * q * Math.SQRT1_2);
      out.push(parte(m, 'fosco'));
    }
  }
  return out;
};

/** Papelote aberto: folha amassada em canoa, de alumínio ou de papel-manteiga com as pontas torcidas e amarradas. */
const gPapillote: Gerador = (k) => {
  const { c1, c2, s } = k;
  const aluminio = k.v.v === 'aluminio';
  const L = k.T, W = L * 0.62;
  const out: Parte[] = [];
  const Hs = L * (aluminio ? 0.11 : 0.15);
  const aperta = (u: number) => (aluminio ? lerp(0.55, 1, suave(0, 0.25, u) * suave(1, 0.75, u)) : lerp(0.08, 1, suave(0.04, 0.24, u) * suave(0.96, 0.76, u)));
  out.push(parte(chapa(44, 20, (u, v, lado) => {
    const ap = aperta(u);
    const amassa = 0.0035 * fbm(u * 9, v * 6, 0, s) + 0.0018 * Math.abs(ruido(u * 28, v * 22, 1, s + 3));
    const x = (u - 0.5) * L * (1 - 0.06 * Math.abs(v));
    const z = v * (W / 2) * ap * (aluminio ? 1 - 0.15 * Math.abs(v) ** 3 : 1);
    let y = Hs * Math.abs(v) ** 1.7 * (aluminio ? 1 : 0.9) + amassa + 0.0006;
    if (!aluminio) y += Hs * 0.5 * (1 - suave(0.0, 0.22, u) * suave(1, 0.78, u)) * (1 - Math.abs(v) * 0.4);
    if (aluminio) y += Hs * 0.6 * (1 - suave(0.02, 0.22, u) * suave(0.98, 0.78, u)) * (0.5 + 0.5 * Math.abs(v));
    return [x, y + (lado ? 0.00035 : 0), z];
  }, (x, y, z, u, v) => {
    const vinco = Math.abs(ruido(u * 28, v * 22, 1, s + 3));
    if (aluminio) return mul(c1, 0.72 + 0.35 * vinco + 0.1 * fbm(u * 30, v * 30, 0, s));
    return mul(mix(c1, c2, suave(0.75, 1, Math.max(Math.abs(v), Math.abs(2 * u - 1))) * 0.5), 0.92 + 0.1 * vinco);
  }), aluminio ? 'brilhante' : 'fosco', true));
  if (aluminio) {
    // banana inteira de casca escurecida na grelha
    const Lb = L * 0.78, Rb = Lb * 0.11;
    const casca: CorFn = (x, y, z, t, a) => mul(mix(rgb('#5a3a18'), rgb('#c8a040'), suave(0.55, 0.85, fbm(x * 60, y * 60, z * 60, s)) * 0.5), 0.9 + 0.12 * Math.abs(Math.cos(a * 2.5)));
    out.push(parte(corpo({
      x0: -Lb / 2, x1: Lb / 2, n: 30, m: 15, cor: casca,
      perfil: (t) => { const u = 2 * t - 1; const r = Rb * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.6)); return { ry: r, rz: r, cy: Rb + 0.004 + Lb * 0.06 * u * u, cz: 0 }; },
      mod: (t, a) => 1 - 0.06 * (1 - Math.abs(Math.cos(a * 2.5))),
    }), 'acetinado'));
    out.push(parte(caule([V(Lb / 2 - 0.004, Rb + 0.004 + Lb * 0.06, 0), V(Lb / 2 + 0.012, Rb + 0.008 + Lb * 0.07, 0)], Rb * 0.35, Rb * 0.3, fixa(rgb('#3a2a14')), 6), 'fosco'));
    return out;
  }
  // amarras de barbante nas pontas torcidas
  for (const u of [0.1, 0.9]) {
    const x = (u - 0.5) * L;
    const r = (W / 2) * aperta(u) * 1.05 + 0.002;
    const yc = Hs * 0.5 * (1 - suave(0.0, 0.22, u) * suave(1, 0.78, u)) + 0.002;
    const pts: THREE.Vector3[] = [];
    for (let q = 0; q < 16; q++) { const a = (q / 16) * TAU; pts.push(V(x, yc + Math.cos(a) * r * 0.8, Math.sin(a) * r)); }
    out.push(parte(tubo(pts, { fechado: true, raio: 0.0011, m: 5, n: 28, cor: tomR(rgb('#e8dcc0'), 0.08, 900, s) }), 'fosco'));
  }
  // frutas no suco: cubos de abacaxi, rodelas de banana e metades de morango
  out.push(parte(torno({ caminho: [[0, 0], [0.036, 0], [0.037, 0.001], [0, 0.0014]], n: 4, m: 28, cor: tomR(rgb('#e0a040'), 0.1, 200, s), l: 0.62 }).translate(0, 0.004, 0), 'umido'));
  const abac = rgb('#f0cc48'), ban = rgb('#f2e4b8'), mor = rgb('#c81c24');
  out.push(...amontoar(k, 14, 0.032, 0.012, 0.012, (i) => {
    if (i % 3 === 0) return bloco(0.013, 0.012, 0.013, tomR(abac, 0.08, 600, s + i), [1, 1, 1]);
    if (i % 3 === 1) return torno({ caminho: [[0, 0], [0.011, 0], [0.0115, 0.004], [0.011, 0.008], [0, 0.008]], n: 6, m: 16, cor: (x, y, z) => (Math.hypot(x, z) < 0.003 ? mix(ban, rgb('#9a7a4a'), 0.3) : ban) });
    return elipsoide(0.01, 0.006, 0.008, (x, y, z) => (y > 0.004 ? mix(rgb('#f2a0a0'), rgb('#fff0e8'), suave(0.004, 0, Math.abs(z)) * 0.6) : mor), 6, 10);
  }, 0, 0, 0.02).map((g) => parte(g, 'umido')));
  return out;
};

const gTempuraFrutas: Gerador = (k) => {
  // pedaços de fruta na massa de tempura frita: casca rendada, dourada clara, com gotinhas crocantes
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const formas: { rx: number; ry: number; rz: number; p: [number, number, number]; r: number; fruta: RGB }[] = [
    { rx: 0.032, ry: 0.009, rz: 0.012, p: [-0.02, 0, -0.012], r: 0.4, fruta: rgb('#f2ecc8') },
    { rx: 0.016, ry: 0.012, rz: 0.015, p: [0.026, 0, 0.012], r: -0.3, fruta: rgb('#f2d050') },
    { rx: 0.028, ry: 0.007, rz: 0.016, p: [0.008, 0.002, -0.006], r: 1.6, fruta: rgb('#f0a028') },
    { rx: 0.017, ry: 0.007, rz: 0.017, p: [-0.03, 0, 0.022], r: 0, fruta: rgb('#8ab038') },
  ];
  formas.forEach((f, i) => {
    const g = elipsoide(f.rx, f.ry, f.rz, (x, y, z) => {
      const b = Math.abs(ruido(x * 260, y * 260, z * 260, s + i));
      let c = mix(c1, c2, clamp(b * 1.1 + 0.2 * fbm(x * 90, y * 90, z * 90, s)));
      c = mix(c, f.fruta, (1 - suave(0.0, 0.18, b)) * 0.18);
      return c;
    }, 14, 18, (t, a) => 1 + 0.12 * Math.abs(ruido(t * 9, Math.cos(a) * 3, Math.sin(a) * 3, s + i)) + 0.05 * fbm(t * 5, Math.cos(a), Math.sin(a), s));
    g.rotateY(f.r);
    g.translate(f.p[0], f.ry * 0.95 + f.p[1], f.p[2]);
    out.push(parte(g, 'acetinado', i === 0));
  });
  for (let i = 0; i < 10; i++) {
    const r = k.r.f(0.0015, 0.003);
    out.push(parte(tf(elipsoide(r, r * 0.6, r, tomR(c2, 0.1, 400, s + i), 3, 6), [k.r.f(-0.05, 0.05), r * 0.5, k.r.f(-0.03, 0.035)]), 'acetinado'));
  }
  return out;
};

const gCocoTostado: Gerador = (k) => {
  // lascas finas de coco enroladas, brancas no meio e tostadas nas bordas
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, rr = Math.sqrt(f) * k.T * 0.4, a = i * 2.39996;
    const c = V(Math.cos(a) * rr, 0.002 + (1 - f) * k.T * 0.22, Math.sin(a) * rr);
    const len = k.r.f(0.016, 0.026), curl = k.r.f(1.2, 2.6), dir = k.r.f(0, TAU);
    const d = V(Math.cos(dir), 0, Math.sin(dir));
    const pts: THREE.Vector3[] = [];
    for (let q = 0; q <= 4; q++) {
      const th = (q / 4 - 0.5) * curl;
      pts.push(c.clone().addScaledVector(d, (Math.sin(th) / curl) * len).add(V(0, ((1 - Math.cos(th)) / curl) * len * 0.8, 0)));
    }
    out.push(parte(tubo(pts, {
      raio: (t) => 0.0024 * (0.7 + 0.3 * Math.sin(PI * t)), achata: 0.16, cima: V(-d.z, 0, d.x), m: 6, n: 10,
      cor: (x, y, z, t, ang) => mix(mul(c1, 0.97 + 0.05 * fbm(x * 800, y * 800, z * 800, s + i)), c2, clamp(suave(0.25, 0.0, Math.min(t, 1 - t)) * 0.9 + Math.abs(Math.cos(ang)) ** 6 * 0.8)),
    }), 'acetinado', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* coulis decorados e quenelle com caviar                               */
/* ------------------------------------------------------------------ */

const gCouliPenas: Gerador = (k) => {
  // espelho de couli com duas fileiras de gotas de creme riscadas pela faca em forma de pena
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.48, h = 0.0024;
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.985, 0], [R, h * 0.45], [R * 0.97, h], [R * 0.5, h * 1.04], [0, h * 1.05]], n: 8, m: 56,
    mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, s),
    cor: (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 30, 0, z * 30, s)) * 0.35), 1 + 0.06 * fbm(x * 90, y * 90, z * 90, s)),
  }), 'umido', true)];
  const n = 7;
  for (const lado of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = (lado > 0 ? 0 : PI) + (i - (n - 1) / 2) * 0.26;
      const rr = R * 0.66;
      const W = 0.0085, Lg = 0.017;
      const g = petala(Lg, W, {
        contorno: (t) => Math.sin(PI * clamp(t) ** 0.55) ** 0.8, esp: 0.0011, n: 10, m: 10,
        cima: (x, y, z) => mix(ci, mul(c1, 1.05), 1 - suave(0.0004, 0.0011, Math.abs(z))), baixo: fixa(ci),
      });
      g.translate(-Lg * 0.55, 0, 0);
      // fileira tangente ao círculo, a faca arrastou no sentido da volta
      g.rotateY(-a + (lado > 0 ? -PI / 2 : PI / 2));
      g.translate(Math.cos(a) * rr, h + 0.0004, Math.sin(a) * rr);
      out.push(parte(g, 'acetinado'));
    }
  }
  return out;
};

const gCouliYinYang: Gerador = (k) => {
  // duas gotas de couli de cores diferentes encaixadas em yin-yang
  const { c1, c3, s } = k;
  const R = k.T * 0.46, h = 0.0026, gap = 0.0008;
  const sCurva = (x: number) => (x < 0 ? Math.sqrt(Math.max(0, (R / 2) ** 2 - (x + R / 2) ** 2)) : -Math.sqrt(Math.max(0, (R / 2) ** 2 - (x - R / 2) ** 2)));
  const borda = (x: number) => Math.sqrt(Math.max(0, R * R - x * x));
  const out: Parte[] = [];
  for (const lado of [-1, 1]) {
    const base = lado < 0 ? c1 : c3;
    out.push(parte(chapa(56, 10, (u, v, top) => {
      const x = (u - 0.5) * 2 * R;
      const z0 = lado < 0 ? -borda(x) : sCurva(x) + gap;
      const z1 = lado < 0 ? sCurva(x) - gap : borda(x);
      const z = lerp(z0, Math.max(z0, z1), (v + 1) / 2);
      const esp = h * Math.sqrt(Math.max(0, 1 - v * v)) ** 0.5 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) ** 0.4;
      return [x, top ? esp + 0.0002 : 0, z];
    }, (x, y, z) => mul(base, 0.96 + 0.08 * fbm(x * 60, y * 60, z * 60, s + lado))), 'umido', lado < 0));
  }
  return out;
};

const gQuenelleCaviar: Gerador = (k) => {
  // quenelle de queijo de cabra de três faces, com uma colherada de caviar por cima e grãos em volta
  const { c1, c2, s } = k;
  const L = k.T, ry = L * 0.24, rz = L * 0.3;
  const out: Parte[] = [];
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 30,
    perfil: (t) => { const u = 2 * t - 1; const e = Math.max(0, 1 - Math.abs(u) ** 2) ** 0.62 * (1 + 0.06 * u); return { ry: ry * e, rz: rz * e, cy: ry }; },
    mod: (t, a) => 0.88 + 0.12 * Math.abs(Math.cos(1.5 * a)) ** 3,
    desloc: (p) => { if (p.y < ry * 0.12) p.y = ry * 0.12; },
    cor: (x, y, z) => mul(mix(c1, c2, suave(0.4, 0.9, fbm(x * 300, y * 300, z * 300, s)) * 0.4), 1),
  }), 'fosco', true));
  const ova = (r: number): THREE.BufferGeometry => elipsoide(r, r, r, (x, y) => mix(rgb('#141618'), rgb('#4a5058'), suave(0, r, y) * 0.6), 3, 5);
  for (let i = 0; i < 26; i++) {
    const f = (i + 0.5) / 26, rr = Math.sqrt(f) * L * 0.16, a = i * 2.39996;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.8;
    out.push(parte(ova(0.0017).translate(x, ry * 2 - 0.001 + (1 - f) * 0.004, z), 'brilhante'));
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    out.push(parte(ova(0.0016).translate(Math.cos(a) * L * 0.54, 0.0016, Math.sin(a) * L * 0.36), 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* registro                                                             */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'rosa-tomate': { visual: vis('esferoide', 'rosa-tomate', 0.05, 'd8281e c02018 e8604a c8401e', { a: 0.5 }), gerar: gRosaTomate },
  'rosa-rabanete': { visual: vis('esferoide', 'rosa-rabanete', 0.034, 'd0203a a81a30 f8f4f0 e8c8c0'), gerar: gRosaRabanete },
  'flor-cenoura': { visual: vis('cone', 'flor-cenoura', 0.042, 'e8741e c85a12 f6a040 d86a1a'), gerar: gFlorCenoura },
  'flor-chili': { visual: vis('pimenta', 'flor-chili', 0.075, 'd8201a b8180e f2e8c0 a83020 4a7a2a', { l: 0.19 }), gerar: gFlorChili },
  'coroa-pepino': { visual: vis('fuso', 'coroa-pepino', 0.045, '24501f 5a8a3a d6e6a8 8a9a5a'), gerar: gCoroaPepino },
  'fogos-abobrinha': { visual: vis('fuso', 'fogos-abobrinha', 0.04, '2e5a22 a8c87a e8ecc8 a8a060'), gerar: gFogosAbobrinha },
  'espiral-mooli': { visual: vis('fuso', 'espiral-mooli', 0.12, 'f2efe6 c8d8a0 f8f6f0 e8dcc0', { l: 0.34 }), gerar: gEspiralMooli },
  'barquinha-abobrinha': { visual: vis('fuso', 'barquinha-abobrinha', 0.11, '3e7a2a 9ac070 e8ecc0 a8a060 4a6a2a', { l: 0.3 }), gerar: gBarquinhaAbobrinha },
  'nabo-recheado': { visual: vis('esferoide', 'nabo-recheado', 0.05, '9a6a92 e8e0d0 f4f0e4 e8d8b0'), gerar: gNaboRecheado },
  'cenoura-baby': { visual: vis('cone', 'cenoura-baby', 0.08, 'f0801e d86a12 f6a040 f0801e 5a9a34', { l: 0.2 }), gerar: gCenouraBaby },
  'nabo-baby': { visual: vis('esferoide', 'nabo-baby', 0.048, '9a5a92 e8e0d8 f6f2ea e8d8b0 5a9a34'), gerar: gNaboBaby },
  'pure-confeitado': { visual: vis('massa_bola', 'pure-confeitado', 0.035, 'f2dc9a c88a3a f6e8c0 c8903e'), gerar: gPureConfeitado },
  'forminha-arroz': { visual: vis('massa_bola', 'forminha-arroz', 0.065, 'f6f2e8 dcd4c0 f6f4ec f0e8d0'), gerar: gForminhaArroz },
  'timbale-espinafre': { visual: vis('bolo', 'timbale-espinafre', 0.055, '3e6a2a 26461a 4e7a32 3e6a2a'), gerar: gTimbaleEspinafre },
  'maca-espiral': { visual: vis('esferoide', 'maca-espiral', 0.12, 'c8201e e0b040 f2e4bc c8903a 5a4024'), gerar: gMacaEspiral },
  'maca-metade-boleada': { visual: vis('esferoide', 'maca-metade-boleada', 0.085, 'c8201e e0b040 f2e4bc c8903a 5a4024'), gerar: gMacaBoleada },
  'anel-maca': { visual: vis('esferoide', 'anel-maca', 0.075, 'f2e8c0 c8b070 f0deac d8a050'), gerar: gAnelMaca },
  'abacaxi-tigela': { visual: vis('tropical', 'abacaxi-tigela', 0.24, 'c8902a 6a5020 f0c440 d8a030 4a6a3a'), gerar: gAbacaxiTigela },
  'abacaxi-anao-recheado': { visual: vis('tropical', 'abacaxi-anao-recheado', 0.14, 'c8902a 6a5020 f0c440 d8a030 4a6a3a'), gerar: gAbacaxiAnao },
  'anel-abacaxi': { visual: vis('tropical', 'anel-abacaxi', 0.09, 'f0c838 8a6a2a f0c03a d8a030'), gerar: gAnelAbacaxi },
  'abacaxi-ziguezague': { visual: vis('tropical', 'abacaxi-ziguezague', 0.3, 'c8902a 6a5020 f0c440 d8a030 4a6a3a'), gerar: gAbacaxiZiguezague },
  'manga-ourico': { visual: vis('tropical', 'manga-ourico', 0.11, '6a9a3a d8601e f6a623 e0901e'), gerar: gMangaOurico },
  'laranja-remontada': { visual: vis('citrico', 'laranja-remontada', 0.08, 'f0821a f8a030 f8e8c8 d8701a'), gerar: gLaranjaRemontada },
  'supremes-laranja': { visual: vis('citrico', 'supremes-laranja', 0.1, 'f07a14 f8a030 f8dca8 d8701a'), gerar: gSupremes },
  'melao-taca': { visual: vis('esferoide', 'melao-taca', 0.15, '8a8c5c d8d0a8 ea8a34 d8803a'), gerar: gMelaoTaca },
  'salada-melao': { visual: vis('esferoide', 'salada-melao', 0.07, 'ea8a34 f2c070 ea8a34 d8803a'), gerar: gSaladaMelao },
  'sorbet-melao': { visual: vis('esferoide', 'sorbet-melao', 0.055, 'f2a060 e88a4a f6b880 f2a060'), gerar: gSorbetMelao },
  'kiwi-topo': { visual: vis('tropical', 'kiwi-topo', 0.075, '8a6a3a 6a4a28 8ab030 7a8a2a'), gerar: gKiwiTopo },
  'flor-figo': { visual: vis('tropical', 'flor-figo', 0.05, '5a2a4a 6a6a3a d8485a 7a3a3a 6a6a3a'), gerar: gFlorFigo },
  'sementes-roma': { visual: vis('baga', 'sementes-roma', 0.13, 'b8201e d8603a b0102a 8a1018'), gerar: gSementesRoma },
  'pera-vinho': { visual: vis('esferoide', 'pera-vinho', 0.095, '5c1430 7a2040 f0c8c0 5a1a2e 5a4024'), gerar: gPeraVinho },
  'espeto-frutas': { visual: vis('tropical', 'espeto-frutas', 0.22, 'f0cc40 f09a20 f0cc40 c08030'), gerar: gEspetoFrutas },
  'papillote-banana': { visual: vis('placa', 'aluminio', 0.2, 'c8ccd0 9a9ea4 f6eccc a8a8a8'), gerar: gPapillote },
  'papillote-frutas': { visual: vis('placa', 'papel', 0.2, 'f0e6cc c8a878 f0cc48 d8b070'), gerar: gPapillote },
  'tempura-frutas': { visual: vis('massa_bola', 'tempura-frutas', 0.1, 'e2b868 b07028 f2ecc8 d8a850'), gerar: gTempuraFrutas },
  'coco-tostado': { visual: vis('castanha', 'coco-tostado', 0.05, 'f6f2e6 b8823e f6f4ee b8823e'), gerar: gCocoTostado },
  'couli-penas': { visual: vis('placa', 'couli-penas', 0.17, 'b01e30 c8283a f6efe0 8a1420'), gerar: gCouliPenas },
  'couli-yin-yang': { visual: vis('placa', 'couli-yin-yang', 0.16, 'b8203a c8283a f2a02a 8a1420 f2a02a'), gerar: gCouliYinYang },
  'quenelle-queijo-caviar': { visual: vis('queijo', 'quenelle-caviar', 0.05, 'f6f2e8 e8e0cc f6f2e8 e8d8b0'), gerar: gQuenelleCaviar },
};
