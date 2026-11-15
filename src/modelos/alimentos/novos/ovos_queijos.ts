// Alimentos novos do grupo ovos queijos: ovos prontos nas formas do livro (gema separada,
// cocotte, rancheros, fritos de vários jeitos, quente com caviar), omeletes (francesa, suflê,
// tamagoyaki), tortilla espanhola, suflê em quenelle e os queijos (Camembert, Brie cortado,
// Camembert empanado, queijo azul, queijo fresco de musselina, bolinhas cobertas e queijo
// marinado). Também traz as ferramentas de malha que o grupo de pães e massas reaproveita:
// `grade` (superfície em grade que se orienta sozinha), `laje` (chapa de duas faces) e
// `setor` (sólido de revolução cortado em fatia, com as faces do corte).
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, juntar, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, caule, type Gerador } from '../pecas';
import { gOvoQuente } from '../fam_extras';
import type { Lote } from './tipos';

export type P3 = [number, number, number];

/* ------------------------------------------------------------------ */
/* ferramentas de malha                                                  */
/* ------------------------------------------------------------------ */

/**
 * Superfície em grade (u de 0 a 1 em nu passos, v de 0 a 1 em nv passos). `fora` dá a direção
 * para fora em cada ponto: a grade vira as faces sozinha para ficarem de frente para ela.
 * A cor recebe u no lugar de t e v no lugar do ângulo.
 */
export function grade(nu: number, nv: number, pos: (u: number, v: number) => P3, cor: CorFn, fora: (x: number, y: number, z: number) => P3, fechaV = false): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const cv = fechaV ? nv : nv + 1;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j < cv; j++) {
      const u = i / nu, v = j / nv;
      const p = pos(u, v);
      P.push(p[0], p[1], p[2]);
      const c = cor(p[0], p[1], p[2], u, v);
      C.push(clamp(c[0]), clamp(c[1]), clamp(c[2]));
    }
  }
  const id = (i: number, j: number) => i * cv + (fechaV ? j % nv : j);
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), d = id(i + 1, j + 1);
      I.push(a, b, c, b, d, c);
    }
  }
  let soma = 0;
  for (let f = 0; f < I.length; f += 3) {
    const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
    const e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const o = fora((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3);
    soma += n[0] * o[0] + n[1] * o[1] + n[2] * o[2];
  }
  if (soma < 0) for (let f = 0; f < I.length; f += 3) { const t = I[f + 1]; I[f + 1] = I[f + 2]; I[f + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/**
 * Chapa com face de cima e de baixo em grade nx por nz, costurada na borda.
 * `pos(u, v, lado)` devolve o ponto (u de 0 a 1, v de -1 a 1, lado 1 em cima e 0 embaixo).
 */
export function laje(nx: number, nz: number, pos: (u: number, v: number, lado: number) => P3, cor: CorFn): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const por = nz + 1;
  const face = (nx + 1) * por;
  for (const lado of [1, 0]) {
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const u = i / nx, v = (j / nz) * 2 - 1;
        const p = pos(u, v, lado);
        P.push(p[0], p[1], p[2]);
        const c = cor(p[0], p[1], p[2], u, v);
        C.push(clamp(c[0]), clamp(c[1]), clamp(c[2]));
      }
    }
  }
  const T = (i: number, j: number) => i * por + j;
  const B = (i: number, j: number) => face + i * por + j;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      I.push(T(i, j), T(i, j + 1), T(i + 1, j), T(i, j + 1), T(i + 1, j + 1), T(i + 1, j));
      I.push(B(i, j), B(i + 1, j), B(i, j + 1), B(i, j + 1), B(i + 1, j), B(i + 1, j + 1));
    }
  }
  const laco: [number, number][] = [];
  for (let i = 0; i < nx; i++) laco.push([i, 0]);
  for (let j = 0; j < nz; j++) laco.push([nx, j]);
  for (let i = nx; i > 0; i--) laco.push([i, nz]);
  for (let j = nz; j > 0; j--) laco.push([0, j]);
  for (let q = 0; q < laco.length; q++) {
    const [ia, ja] = laco[q], [ib, jb] = laco[(q + 1) % laco.length];
    const tp = T(ia, ja), tq = T(ib, jb), bp = B(ia, ja), bq = B(ib, jb);
    I.push(tp, tq, bp, tq, bq, bp);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

export interface OpcSetor {
  /** Raio externo em função da altura h (de 0 a H). */
  R: (h: number) => number;
  H: number;
  /** Ângulos do setor (a0 menor que a1); a volta inteira dispensa as faces do corte. */
  a0: number;
  a1: number;
  na?: number;
  nh?: number;
  nr?: number;
  /** Resolução das faces do corte (padrão nr e nh). */
  nrc?: number;
  nhc?: number;
  cor: CorFn;
  corTopo?: CorFn;
  corBase?: CorFn;
  /** Cor das duas faces do corte (u = fração do raio, v = fração da altura). */
  corCorte?: CorFn;
  /** Deforma o ponto; face 0 lado, 1 topo, 2 base, 3 corte em a0, 4 corte em a1. */
  desloc?: (p: P3, face: number, u: number, v: number) => P3;
}

/** Sólido de revolução em fatia (queijo em roda, tortilla): lado, topo, base e as faces do corte. */
export function setor(o: OpcSetor): THREE.BufferGeometry {
  const na = o.na ?? 40, nh = o.nh ?? 10, nr = o.nr ?? 8;
  const cheio = o.a1 - o.a0 >= TAU - 1e-6;
  const ang = (v: number) => lerp(o.a0, o.a1, v);
  const D = (p: P3, f: number, u: number, v: number) => (o.desloc ? o.desloc(p, f, u, v) : p);
  const gs: THREE.BufferGeometry[] = [];
  gs.push(grade(nh, na, (u, v) => { const h = u * o.H, a = ang(v), r = o.R(h); return D([Math.cos(a) * r, h, Math.sin(a) * r], 0, u, v); }, o.cor, (x, _y, z) => [x, 0, z], cheio));
  gs.push(grade(nr, na, (u, v) => { const a = ang(v), r = u * o.R(o.H); return D([Math.cos(a) * r, o.H, Math.sin(a) * r], 1, u, v); }, o.corTopo ?? o.cor, () => [0, 1, 0], cheio));
  gs.push(grade(nr, na, (u, v) => { const a = ang(v), r = u * o.R(0); return D([Math.cos(a) * r, 0, Math.sin(a) * r], 2, u, v); }, o.corBase ?? o.cor, () => [0, -1, 0], cheio));
  if (!cheio) {
    const faces: [number, P3, number][] = [[o.a0, [Math.sin(o.a0), 0, -Math.cos(o.a0)], 3], [o.a1, [-Math.sin(o.a1), 0, Math.cos(o.a1)], 4]];
    for (const [a, n, f] of faces) {
      gs.push(grade(o.nrc ?? nr, o.nhc ?? nh, (u, v) => { const h = v * o.H, r = u * o.R(h); return D([Math.cos(a) * r, h, Math.sin(a) * r], f, u, v); }, o.corCorte ?? o.cor, () => n));
    }
  }
  return juntar(gs);
}

/** Raio de roda de queijo com as quinas arredondadas no raio b. */
export function raioRoda(R: number, H: number, b: number): (h: number) => number {
  return (h) => {
    const e = Math.max(0, Math.abs(h - H / 2) - (H / 2 - b)) / b;
    return R - b * (1 - Math.sqrt(Math.max(0, 1 - e * e)));
  };
}

/** Normal para fora de cada face do setor, para empurrar o relevo. */
export function normalSetor(p: P3, face: number, a0: number, a1: number): P3 {
  if (face === 0) { const r = Math.hypot(p[0], p[2]) || 1; return [p[0] / r, 0, p[2] / r]; }
  if (face === 1) return [0, 1, 0];
  if (face === 2) return [0, -1, 0];
  if (face === 3) return [Math.sin(a0), 0, -Math.cos(a0)];
  return [-Math.sin(a1), 0, Math.cos(a1)];
}

/** Some com o relevo perto da borda de cada face, para as costuras não abrirem. */
export const longeDaBorda = (u: number, v: number, f = 0.08) => suave(0, f, Math.min(u, 1 - u)) * suave(0, f, Math.min(v, 1 - v));

/** Tom com ruído suave. */
export const tom = (base: RGB, amp: number, f: number, s: number): CorFn => (x, y, z) => mul(base, 1 + amp * fbm(x * f, y * f, z * f, s));

/** Bolinha (pimenta em grão, caviar, gergelim) de baixa contagem. */
function bolinha(r: number, cor: CorFn, p: P3, n = 4, m = 6): THREE.BufferGeometry {
  return tf(elipsoide(r, r, r, cor, n, m), p);
}

/* ------------------------------------------------------------------ */
/* ovos                                                                 */
/* ------------------------------------------------------------------ */

/** Gema inteira separada da clara: domo laranja liso, um fio de clara e a calaza. */
const gOvoGema: Gerador = (k) => {
  const { c1, c3, s } = k;
  const R2 = k.T / 2, R = R2 * 0.74, Hy = R * 1.5;
  const corG: CorFn = (x, y, z) => {
    let c = mul(c3, 0.92 + 0.1 * fbm(x * 160, y * 160, z * 160, s));
    c = mix(c, mul(c3, 1.14), suave(Hy * 0.3, Hy, y) * 0.35);
    return mix(c, [1, 0.92, 0.66], suave(0.5, 0.9, fbm(x * 90, y * 90, z * 90, s + 3)) * 0.1);
  };
  const out: Parte[] = [];
  out.push(parte(torno({
    caminho: (u) => { const th = u * PI; return [R * Math.sin(th), (Hy / 2) * (1 - Math.cos(th))]; },
    n: 20, m: 30, cor: corG,
    mod: (t, a) => 1 + 0.02 * fbm(Math.cos(a) * 1.5, Math.sin(a) * 1.5, t * 2, s),
    desloc: (p) => { const y0 = Hy * 0.12; if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.4; p.y += 0.0009; },
  }), 'brilhante', true));
  // película de clara que sobra em volta, quase transparente
  const clara = mix(c1, c3, 0.14);
  out.push(parte(torno({
    caminho: [[0, 0], [R2 * 0.95, 0], [R2, 0.0005], [R2 * 0.9, 0.0011], [0, 0.0012]], n: 5, m: 30,
    cor: (x, y, z) => mul(clara, 0.97 + 0.05 * fbm(x * 120, 0, z * 120, s + 4)),
    mod: (_t, a) => 1 + 0.14 * fbm(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0, s + 5),
  }), 'brilhante'));
  // calaza: o fiozinho branco torcido grudado na gema
  out.push(parte(tubo([V(R * 0.85, 0.0012, R * 0.3), V(R * 1.0, 0.0015, R * 0.4), V(R * 1.12, 0.0012, R * 0.36)], {
    raio: (t) => 0.0011 * (1 - 0.4 * t), m: 6, n: 8, cor: () => mix(c1, [1, 1, 1], 0.4),
  }), 'acetinado'));
  return out;
};

/** Ovo assado no ramequim: clara firme, gema brilhante e creme com pimenta em volta. */
const gOvoCocotte: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = 0.012;
  const pimenta: RGB = [0.08, 0.06, 0.05];
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    let c = mul(c1, 0.96 + 0.06 * fbm(x * 80, y * 80, z * 80, s));
    // creme derramado por cima, mais grosso perto da parede do ramequim
    const creme = clamp(suave(0.15, 0.55, fbm(x * 35, 0, z * 35, s + 1) + 0.25) * 0.7 + suave(0.55, 0.95, r) * 0.6);
    c = mix(c, c2, creme * 0.85);
    // bordinha dourada do forno e pimenta moída
    c = mix(c, mul(c2, 0.82), suave(0.9, 1, r) * 0.4);
    c = mix(c, pimenta, (1 - suave(0.04, 0.09, celula(x * 420, 0, z * 420, s + 2))) * 0.85 * suave(H * 0.6, H, y));
    return c;
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.97, 0], [R, H * 0.6], [R * 0.99, H * 1.05], [R * 0.7, H * 1.0], [R * 0.3, H * 1.1], [0, H * 1.12]],
    n: 16, m: 48, cor,
    desloc: (p) => { if (p.y > H * 0.7) p.y += H * 0.08 * fbm(p.x * 40, 0, p.z * 40, s + 3); },
  }), 'acetinado', true)];
  // gema velada por uma película de clara cozida
  const gR = R * 0.38;
  out.push(parte(tf(elipsoide(gR, gR * 0.5, gR * 0.95, (x, y, z) => {
    const c = mul(c3, 0.94 + 0.08 * fbm(x * 150, y * 150, z * 150, s + 4));
    return mix(c, c1, suave(0.0, 0.7, fbm(x * 70, y * 70, z * 70, s + 5)) * 0.35);
  }, 12, 18), [R * 0.06, H * 1.02, -R * 0.04]), 'brilhante'));
  return out;
};

/** Huevos rancheros: cama de tiras de pimentão e cebola com o ovo assado por cima e salsa. */
const gOvoRancheros: Gerador = (k) => {
  const { c1, c3, s } = k;
  const out: Parte[] = [];
  const Rb = k.T / 2, Re = Rb * 0.66;
  const vermelho = rgb('#c3261a'), verde = rgb('#3d7424'), cebola = rgb('#eee3c4'), salsa = rgb('#3f7a24');
  // tiras de pimentão: fitas achatadas e curvas, assadas (pele com bolhas mais escuras)
  for (let i = 0; i < 30; i++) {
    const a = i * 2.399 + k.r.f(-0.3, 0.3);
    const rr = Rb * Math.sqrt((i + 0.5) / 30) * 0.7;
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const dir = k.r.f(0, TAU), comp = k.r.f(0.028, 0.045);
    const dx = Math.cos(dir) * comp / 2, dz = Math.sin(dir) * comp / 2;
    const y = 0.0022 + (i % 5) * 0.0011;
    const curva = k.r.f(-0.4, 0.4) * comp;
    const base = i % 3 === 2 ? verde : vermelho;
    out.push(parte(tubo([V(cx - dx, y, cz - dz), V(cx - dz * curva * 8, y + 0.0012, cz + dx * curva * 8), V(cx + dx, y, cz + dz)], {
      raio: 0.0016, achata: 2.8, cima: V(0, 1, 0), m: 5, n: 7,
      cor: (x, yy, z) => mul(mix(base, mul(base, 0.6), suave(0.3, 0.8, fbm(x * 200, yy * 200, z * 200, s + i)) * 0.5), 0.95 + 0.1 * ruido(x * 600, 0, z * 600, s)),
    }), 'brilhante', i === 0));
  }
  // meias-luas de cebola macia
  for (let i = 0; i < 9; i++) {
    const a = i * 1.7 + 0.4, rr = Rb * k.r.f(0.25, 0.6);
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, ra = k.r.f(0.012, 0.02), giro = k.r.f(0, TAU);
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 6; j++) { const t = giro + (j / 6) * PI; pts.push(V(cx + Math.cos(t) * ra, 0.004 + (i % 3) * 0.001, cz + Math.sin(t) * ra)); }
    out.push(parte(tubo(pts, { raio: 0.0011, achata: 2.2, cima: V(0, 1, 0), m: 5, n: 9, cor: (x, y, z) => mix(cebola, [0.8, 0.6, 0.3], suave(0.2, 0.9, fbm(x * 150, y * 150, z * 150, s + 30 + i)) * 0.35) }), 'brilhante'));
  }
  // ovo assado por cima: clara opaca, borda fininha que escorre entre as tiras
  const borda = (a: number) => Re * (0.86 + 0.16 * fbm(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0, s + 7));
  const y0 = 0.0115;
  out.push(parte(laje(13, 32, (u, v, lado) => {
    const a = v * PI, r = u * borda(a);
    const ondula = 0.0018 * fbm(Math.cos(a) * r * 90, 0, Math.sin(a) * r * 90, s + 8);
    const y = y0 + ondula - 0.004 * u ** 3 + (lado ? 0.003 * (1 - 0.7 * u * u) : 0);
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }, (x, y, z) => mix(mul(c1, 0.97 + 0.05 * fbm(x * 90, y * 90, z * 90, s + 9)), [0.86, 0.72, 0.5], suave(0.85, 1, Math.hypot(x, z) / Re) * 0.25)), 'acetinado', true));
  const gR = Re * 0.38;
  out.push(parte(tf(elipsoide(gR, gR * 0.55, gR * 0.95, (x, y, z) => mix(mul(c3, 0.95 + 0.08 * fbm(x * 150, y * 150, z * 150, s)), c1, suave(0.1, 0.8, fbm(x * 60, y * 60, z * 60, s + 2)) * 0.25), 12, 18), [Re * 0.08, y0 + 0.003, 0]), 'brilhante'));
  // salsa picada salpicada
  for (let i = 0; i < 22; i++) {
    const a = i * 2.399, rr = Re * 1.05 * Math.sqrt((i + 0.5) / 22);
    const tam = k.r.f(0.0015, 0.0028);
    const g = elipsoide(tam, tam * 0.25, tam * 0.7, (x, y, z) => mul(salsa, 0.85 + 0.3 * ruido(x * 900, y * 900, z * 900, s + i)), 3, 6);
    g.rotateY(k.r.f(0, TAU));
    out.push(parte(tf(g, [Math.cos(a) * rr, y0 + 0.004 * (1 - rr / Re) + 0.0035, Math.sin(a) * rr]), 'fosco'));
  }
  return out;
};

/** Ovo frito imerso em bastante óleo: clara estufada envolvendo a gema, saia rendada e dourada. */
const gOvoFritoImerso: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.4, H = R * 0.55;
  const marrom = mul(c2, 0.7);
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.96 + 0.06 * fbm(x * 80, y * 80, z * 80, s));
    // bolhas douradas da fritura, mais fortes nas laterais
    const bolha = 1 - suave(0.1, 0.4, celula(x * 160, y * 160, z * 160, s + 1));
    const lado = suave(H * 0.75, H * 0.2, y);
    c = mix(c, c2, clamp(bolha * 0.7 + lado * 0.9 + suave(0.0, 0.5, fbm(x * 30, y * 30, z * 30, s + 2)) * 0.6));
    c = mix(c, marrom, clamp(lado * bolha * 0.7));
    // a gema aparece amarelada por baixo da clara no alto
    c = mix(c, mix(c1, c3, 0.6), (1 - suave(R * 0.15, R * 0.42, Math.hypot(x, z))) * suave(H * 0.6, H * 1.1, y) * 0.55);
    return c;
  };
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.75, 0], [R * 0.98, H * 0.3], [R * 0.9, H * 0.72], [R * 0.55, H * 0.95], [R * 0.25, H * 1.18], [0, H * 1.22]],
    n: 22, m: 40, l: 0.78, cor,
    mod: (t, a) => 1 + 0.1 * fbm(Math.cos(a) * 1.6, Math.sin(a) * 1.6, t, s + 3) + 0.03 * Math.sin(a * 5 + t * 4),
    desloc: (p) => { p.y += H * 0.08 * fbm(p.x * 60, p.y * 60, p.z * 60, s + 4) * suave(0, H * 0.4, p.y); },
  }), 'acetinado', true));
  // saia de clara rendada que se espalhou no óleo: crocante, bem mais escura
  const borda = (a: number) => R * (1.15 + 0.22 * fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0, s + 5));
  out.push(parte(laje(8, 48, (u, v, lado) => {
    const a = v * PI, r = lerp(R * 0.65, borda(a), u);
    const y = 0.0012 + 0.0016 * fbm(Math.cos(a) * 4, Math.sin(a) * 4, u * 3, s + 6) + (lado ? 0.0012 * (1 - u) : 0);
    return [Math.cos(a) * r, Math.max(0.0001, y), Math.sin(a) * r * 0.85];
  }, (x, y, z) => {
    const furo = 1 - suave(0.15, 0.45, celula(x * 260, 0, z * 260, s + 7));
    return mix(mix(mul(c2, 0.9), marrom, 0.35 + 0.6 * suave(0.0, 0.8, fbm(x * 70, 0, z * 70, s + 8))), mul(marrom, 0.5), furo * 0.85);
  }), 'brilhante'));
  return out;
};

/** Ovo frito modelado no aro: disco perfeito de borda reta e gema bem no centro. */
const gOvoFritoModelado: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = 0.0055;
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    const c = mul(c1, 0.97 + 0.05 * fbm(x * 90, y * 90, z * 90, s));
    // filete dourado na base, onde o aro encostava na frigideira
    return mix(c, c2, clamp(suave(0.93, 1, r) * suave(H * 0.6, 0, y) * 1.2 + suave(0.97, 1.0, r) * 0.25));
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.99, 0], [R, H * 0.15], [R, H * 0.82], [R * 0.985, H], [R * 0.6, H * 1.04], [0, H * 1.06]],
    n: 18, m: 64, cor,
    desloc: (p) => { if (p.y > H * 0.9) p.y += 0.0005 * fbm(p.x * 70, 0, p.z * 70, s + 1); },
  }), 'acetinado', true)];
  const gR = R * 0.34;
  out.push(parte(tf(elipsoide(gR, gR * 0.6, gR, (x, y, z) => mix(mul(c3, 0.95 + 0.07 * fbm(x * 160, y * 160, z * 160, s + 2)), mul(c3, 1.15), suave(0, gR * 0.6, y) * 0.3), 12, 20), [0, H * 0.9, 0]), 'brilhante'));
  return out;
};

/** Ovo frito virado: a gema fica por baixo da clara, que mostra o lado dourado e a borda crocante. */
const gOvoFritoVirado: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = 0.0035;
  const borda = (a: number) => R * (0.82 + 0.18 * fbm(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0, s));
  const gx = -R * 0.05, gz = R * 0.04, gr = R * 0.36, gh = 0.0085;
  const bojo = (x: number, z: number) => { const d = Math.hypot(x - gx, z - gz) / gr; return d < 1 ? Math.sqrt(1 - d * d) : 0; };
  const cor: CorFn = (x, y, z) => {
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z) / borda(a);
    let c = mul(c1, 0.96 + 0.06 * fbm(x * 90, 0, z * 90, s + 1));
    // o lado que fritou está por cima: manchas douradas e a borda rendada escura
    c = mix(c, c2, clamp(suave(-0.15, 0.45, fbm(x * 45, 0, z * 45, s + 2)) * 0.85 + suave(0.7, 1, r) * 0.95));
    c = mix(c, mul(c2, 0.62), suave(0.9, 1, r) * (1 - suave(0.1, 0.4, celula(x * 220, 0, z * 220, s + 3))) * 0.8);
    // a gema amarela transparece no domo
    return mix(c, mix(c1, c3, 0.8), bojo(x, z) ** 0.7 * 0.5);
  };
  return [parte(laje(26, 44, (u, v, lado) => {
    const a = v * PI, r = u * borda(a);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const b = bojo(x, z);
    const y = lado ? H * (1 - 0.55 * u * u) + gh * b + 0.0008 * fbm(x * 80, 0, z * 80, s + 4) : 0.0006 * b;
    return [x, y, z];
  }, cor), 'acetinado', true)];
};

/** Ovo quente aberto no oveiro com caviar em montinho sobre a gema. */
const gOvoQuenteCaviar: Gerador = (k) => {
  const out = gOvoQuente(k);
  const L = k.T, R = L * 0.38;
  const corte = 0.03 + L * 0.62;
  const rc = R * Math.sqrt(Math.max(0, 1 - ((0.62 - 0.42) / 0.58) ** 2)) * 0.97;
  const topo = corte + rc * 0.2;
  const base: RGB = [0.05, 0.055, 0.05];
  const n = 46, rm = rc * 0.62, rp = 0.0015;
  for (let i = 0; i < n; i++) {
    const rr = rm * Math.sqrt((i + 0.5) / n), a = i * 2.39996;
    const h = rc * 0.32 * (1 - (rr / rm) ** 2);
    const tomP = 0.8 + 0.4 * k.r.n();
    out.push(parte(bolinha(rp * k.r.f(0.9, 1.1), (x, y, z) => mix(mul(base, tomP), [0.32, 0.3, 0.22], suave(0.3, 1, (y - (topo + h)) / rp) * 0.6), [Math.cos(a) * rr, topo + h, Math.sin(a) * rr]), 'brilhante'));
  }
  return out;
};

/** Meio tomate assado com a farofa de pão, salsa e cebola gratinada por cima. */
const gTomateGratinado: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = R * 0.82;
  const out: Parte[] = [];
  // a metade de baixo do tomate, pele lisa e brilhante com gomos suaves
  out.push(parte(torno({
    caminho: (u) => { const th = u * PI * 0.5; return [R * Math.sin(th) ** 0.9, H * (1 - Math.cos(th))]; },
    n: 16, m: 40,
    cor: (x, y, z) => {
      const pele = mul(mix(c1, mul(c1, 0.7), suave(0.2, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.3), 1 + 0.12 * suave(H * 0.3, H, y));
      // a polpa do corte aparece no anel em volta da farofa
      return mix(pele, mix(k.ci, mul(k.ci, 0.75), suave(0.2, 0.8, fbm(x * 150, 0, z * 150, s + 9))), suave(H * 0.97, H, y));
    },
    mod: (_t, a) => 1 + 0.035 * Math.cos(a * 5),
  }), 'brilhante', true));
  // tampa de miolo vermelho com a farofa dourada por cima
  const crosta = (x: number, y: number, z: number): RGB => {
    let c = mix(c2, mul(c2, 0.6), suave(0.2, 0.9, celula(x * 650, y * 650, z * 650, s + 1)));
    c = mix(c, mul(c2, 1.25), (1 - suave(0.05, 0.25, celula(x * 900, y * 900, z * 900, s + 2))) * 0.6);
    return mix(c, c3, (1 - suave(0.1, 0.2, celula(x * 230, y * 230, z * 230, s + 3))) * 0.9);
  };
  out.push(parte(torno({
    caminho: [[0, H - 0.001], [R * 0.86, H - 0.001], [R * 0.84, H + 0.002], [R * 0.68, H + 0.0035], [R * 0.35, H + 0.0045], [0, H + 0.0048]],
    n: 10, m: 40,
    cor: crosta,
    mod: (_t, a) => 1 + 0.035 * Math.cos(a * 5),
    desloc: (p) => { const b = 0.0022 * (1 - celula(p.x * 320, p.y * 320, p.z * 320, s + 4)); p.y += b * suave(H, H + 0.004, p.y); const r = Math.hypot(p.x, p.z) || 1; p.x += (p.x / r) * b * 0.5; p.z += (p.z / r) * b * 0.5; },
  }), 'fosco'));
  return out;
};

/* omeletes ----------------------------------------------------------- */

/** Omelete francesa: enrolada pela metade, um charuto liso e amarelo com pontas finas e a emenda. */
const gOmeleteFrancesa: Gerador = (k) => {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const as = 1.0; // ângulo da emenda (da vertical para +Z)
  const cor: CorFn = (x, y, z, t, a) => {
    let c = mul(c1, 0.95 + 0.07 * fbm(x * 70, y * 70, z * 70, s));
    // quase sem cor: só uma sombra dourada por baixo e alguns pontinhos de manteiga
    c = mix(c, c2, suave(H * 0.35, 0, y) * 0.5 + suave(0.3, 0.9, fbm(x * 40, y * 40, z * 40, s + 1)) * 0.12);
    const emenda = 1 - suave(0, 0.12, Math.abs(a - as));
    c = mul(c, 1 - emenda * 0.12);
    return mix(c, mul(c1, 1.1), (1 - suave(0.05, 0.14, celula(x * 300, y * 300, z * 300, s + 2))) * 0.25);
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 40, m: 36, cor,
    perfil: (t) => { const e = Math.sin(PI * t); return { ry: (H / 2) * e ** 0.62, rz: (W / 2) * e ** 0.72, cy: (H / 2) * e ** 0.62 }; },
    mod: (t, a) => {
      // degrau da aba enrolada e rugas leves de quem dobrou na frigideira
      const lado = suave(as - 0.05, as + 0.12, a) * suave(as + 1.6, as + 1.0, a);
      return 1 + 0.035 * lado - 0.03 * Math.exp(-((a - as) ** 2) / 0.006) + 0.012 * Math.sin(t * 38 + a * 2) * Math.sin(PI * t) + 0.01 * fbm(t * 6, Math.cos(a), Math.sin(a), s);
    },
    desloc: (p) => { const y0 = H * 0.18; if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.3; },
  }), k.ac, true)];
};

/** Omelete-suflê: meia-lua alta e aerada, dourada por fora, com rachaduras claras. */
const gOmeleteSufle: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const L = k.T, R = L / 2, H = L * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mix(c2, mul(c2, 0.78), suave(0.0, 0.7, fbm(x * 30, y * 30, z * 30, s)) * 0.6);
    c = mix(c, mul(c1, 1.05), suave(0.2, 0.9, fbm(x * 55, y * 55, z * 55, s + 1)) * 0.35);
    // rachaduras onde a espuma estufou, mostrando o miolo claro
    const r = Math.abs(fbm(x * 38, y * 38, z * 38, s + 2));
    c = mix(c, ci, (1 - suave(0.0, 0.05, r)) * suave(H * 0.4, H, y) * 0.9);
    return mul(c, 1 - 0.18 * suave(H * 0.25, 0, y));
  };
  return [parte(corpo({
    x0: -R, x1: R, n: 40, m: 36, cor,
    perfil: (t) => {
      const w = R * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
      const e = Math.sin(PI * t) ** 0.35;
      return { ry: (H / 2) * e, rz: Math.max(1e-4, w / 2), cy: (H / 2) * e, cz: w / 2 };
    },
    desloc: (p) => {
      // mais alta junto da dobra (z = 0) e baixando para a borda curva
      const w = Math.sqrt(Math.max(1e-8, R * R - p.x * p.x));
      const f = clamp(p.z / w);
      p.y *= lerp(1.12, 0.62, f) * (1 + 0.06 * fbm(p.x * 30, p.y * 30, p.z * 30, s + 3));
      const y0 = H * 0.12;
      if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.3;
    },
  }), k.ac, true)];
};

/** Cor do corte do tamagoyaki: a espiral das camadas enroladas, em (y, z) da seção. */
function espiralTamago(c1: RGB, c2: RGB, H: number, W: number, s: number): (y: number, z: number) => RGB {
  return (y, z) => {
    const yy = y / (H / 2), zz = z / (W / 2);
    const rho = (yy ** 4 + zz ** 4) ** 0.25;
    const th = Math.atan2(yy, zz);
    const fase = rho * 3.2 + th / TAU + 0.06 * fbm(y * 200, z * 200, 0, s);
    const f = fase - Math.floor(fase);
    // camada de ovo clara e a película dourada entre uma camada e outra
    const faixa = suave(0.55, 0.95, 0.5 + 0.5 * Math.cos(f * TAU));
    let c = mul(c1, 0.96 + 0.06 * fbm(y * 300, z * 300, 0, s + 1));
    c = mix(c, c2, faixa * 0.85);
    return mix(c, c2, suave(0.88, 1, rho) * 0.7);
  };
}

/** Tamagoyaki: o bloco enrolado em camadas e duas fatias deitadas mostrando a espiral. */
const gOmeleteJaponesa: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const W = 0.05, H = 0.034, Lb = 0.09, E = 4.2;
  const fora: CorFn = (x, y, z, _t, a) => {
    let c = mul(c1, 0.95 + 0.08 * fbm(x * 60, y * 60, z * 60, s));
    c = mix(c, c2, suave(0.0, 0.7, fbm(x * 22, y * 22, z * 22, s + 3)) * 0.6);
    // a aba da última camada marcando a lateral
    return mul(c, 1 - 0.18 * (1 - suave(0, 0.1, Math.abs(a - 1.9))));
  };
  const esp = espiralTamago(c1, c2, H, W, s);
  const e = 2 / E;
  // face do corte em grade fina, colada na tampa do bloco
  const face = (x: number, sinal: number) => grade(14, 40, (u, v) => {
    const a = v * TAU, ca = Math.cos(a), sa = Math.sin(a);
    return [x + sinal * 0.0003, H / 2 + (H / 2) * 0.985 * u * Math.sign(ca) * Math.abs(ca) ** e, (W / 2) * 0.985 * u * Math.sign(sa) * Math.abs(sa) ** e];
  }, (_x, y, z) => esp(y - H / 2, z), () => [sinal, 0, 0], true);
  const bloco = (x0: number, x1: number) => corpo({
    x0, x1, n: 6, m: 36, exp: E, tampa: true, linear: true, cor: fora, corTampa: fora,
    perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }),
    mod: (t, a) => 1 + 0.012 * fbm(t * 3, Math.cos(a), Math.sin(a), s + 4),
  });
  out.push(parte(bloco(-Lb / 2, Lb / 2), k.ac, true));
  out.push(parte(face(Lb / 2, 1), k.ac, true));
  // fatias deitadas em leque, o corte para cima
  const L = 0.018;
  for (let i = 0; i < 2; i++) {
    const g = juntar([bloco(-L / 2, L / 2), face(-L / 2, -1)]);
    g.translate(0, -H / 2, 0);
    g.rotateZ(-PI / 2 + 0.2);
    g.rotateY(0.15 * (i - 0.5));
    g.computeBoundingBox();
    g.translate(Lb / 2 + 0.012 + i * 0.03 - g.boundingBox!.min.x, -g.boundingBox!.min.y, (i - 0.5) * 0.006);
    out.push(parte(g, k.ac, true));
  }
  return out;
};

/** Tortilla espanhola: bolo grosso de borda redonda, dourado, com uma fatia puxada mostrando a batata. */
const gTortilla: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R0 = k.T * 0.45, H = R0 * 0.42;
  const Rh = raioRoda(R0, H, H * 0.48);
  const casca: CorFn = (x, y, z) => {
    let c = mix(c2, mul(c2, 0.72), suave(0.0, 0.7, fbm(x * 26, y * 26, z * 26, s)) * 0.7);
    c = mix(c, mul(c1, 0.95), suave(0.25, 0.85, fbm(x * 45, y * 45, z * 45, s + 1)) * 0.4);
    return mix(c, mul(c2, 0.5), (1 - suave(0.05, 0.16, celula(x * 90, y * 90, z * 90, s + 2))) * 0.35);
  };
  const batata = rgb('#f2e2b2');
  const corCorte: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z);
    const dist = Math.min(y, H - y, Rh(Math.min(H, Math.max(0, y))) - r);
    let c = mul(ci, 0.94 + 0.08 * fbm(x * 120, y * 120, z * 120, s + 3));
    // fatias finas de batata deitadas em camadas, cebola translúcida aqui e ali
    const b = celula(x * 140, y * 420, z * 140, s + 4);
    c = mix(c, batata, 1 - suave(0.35, 0.55, b));
    c = mix(c, mul(batata, 0.85), (1 - suave(0.02, 0.06, Math.abs(b - 0.45))) * 0.5);
    return mix(c, casca(x, y, z, 0, 0), 1 - suave(0.0015, 0.004, dist));
  };
  const domo = (p: P3): P3 => { const r = Math.hypot(p[0], p[2]); return [p[0], p[1] + 0.005 * Math.max(0, 1 - (r / R0) ** 2) * (p[1] / H), p[2]]; };
  const fenda = 0.9;
  out.push(parte(setor({ R: Rh, H, a0: fenda / 2, a1: TAU - fenda / 2, na: 52, nh: 12, nr: 9, nrc: 18, nhc: 16, cor: casca, corCorte, desloc: (p) => domo(p) }), k.ac, true));
  const g = setor({ R: Rh, H, a0: -fenda / 2, a1: fenda / 2, na: 10, nh: 12, nr: 9, nrc: 18, nhc: 16, cor: casca, corCorte, desloc: (p) => domo(p) });
  g.translate(0.03, 0, 0);
  out.push(parte(g, k.ac, true));
  return out;
};

/** Suflê de queijo moldado em quenelle: domo alongado, estufado e dourado, com parmesão. */
const gSufleQuenelle: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mix(c1, c2, suave(H * 0.3, H * 0.95, y) * 0.85 + 0.25 * fbm(x * 50, y * 50, z * 50, s));
    const r = Math.abs(fbm(x * 70, y * 70, z * 70, s + 1));
    c = mix(c, ci, (1 - suave(0, 0.06, r)) * 0.7);
    // parmesão ralado tostado por cima
    return mix(c, rgb('#f2deac'), (1 - suave(0.05, 0.12, celula(x * 380, y * 380, z * 380, s + 2))) * suave(H * 0.5, H, y) * 0.8);
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 32, cor,
    perfil: (t) => { const e = Math.sin(PI * t) ** 0.7 * (1 - 0.12 * t); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: (H / 2) * e }; },
    mod: (t, a) => 1 + 0.06 * Math.cos(2 * a) * Math.sin(PI * t) + 0.05 * fbm(t * 5, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s + 3),
    desloc: (p) => { const y0 = H * 0.22; if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.25; },
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* queijos                                                              */
/* ------------------------------------------------------------------ */

/** Casca branca aveludada de Brie e Camembert, com o tom de creme da maturação. */
function cascaFlorida(c1: RGB, c2: RGB, s: number): CorFn {
  const ferrugem = rgb('#c9a070');
  return (x, y, z) => {
    let c = mul(c1, 0.97 + 0.05 * ruido(x * 900, y * 900, z * 900, s) + 0.03 * fbm(x * 200, y * 200, z * 200, s + 1));
    c = mix(c, c2, suave(0.0, 0.7, fbm(x * 28, y * 28, z * 28, s + 2)) * 0.7);
    c = mix(c, ferrugem, suave(0.55, 0.85, fbm(x * 60, y * 60, z * 60, s + 3)) * 0.25);
    // covinhas da casca
    return mul(c, 1 - 0.05 * (1 - suave(0.1, 0.5, celula(x * 160, y * 160, z * 160, s + 4))));
  };
}

const gCamembert: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = R * k.A * 2;
  const casca = cascaFlorida(c1, c2, s);
  return [parte(setor({
    R: raioRoda(R, H, H * 0.22), H, a0: 0, a1: TAU, na: 56, nh: 12, nr: 10, cor: casca,
    desloc: (p, f, u) => {
      // topo levemente abaulado e irregular, como a casca que cresceu
      if (f === 1) return [p[0], p[1] + 0.0015 * (1 - u * u) + 0.0006 * fbm(p[0] * 60, 0, p[2] * 60, s + 5) * u * (1 - u) * 4, p[2]];
      return p;
    },
  }), k.ac, true)];
};

/** Brie aberto: roda com uma cunha puxada, massa cremosa cor de palha escorrendo no corte. */
const gBrieCortado: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.44, H = R * k.A * 2;
  const casca = cascaFlorida(c1, c2, s);
  const Rb = raioRoda(R, H, H * 0.25);
  const creme = mul(ci, 0.93);
  const corCorte: CorFn = (x, y, z, u, v) => {
    const dist = Math.min(v * H, (1 - v) * H, (1 - u) * Rb(v * H));
    let c = mul(ci, 0.96 + 0.06 * fbm(x * 90, y * 90, z * 90, s + 6));
    // logo abaixo da casca a massa é mais amarela e mole; olhinhos pequenos
    c = mix(c, creme, suave(0.006, 0.0015, dist) * 0.8);
    c = mix(c, mul(ci, 0.8), (1 - suave(0.04, 0.1, celula(x * 300, y * 300, z * 300, s + 7))) * 0.4);
    return mix(c, casca(x, y, z, 0, 0), 1 - suave(0.0008, 0.0018, dist));
  };
  const fenda = 0.7;
  const a0 = fenda / 2, a1 = TAU - fenda / 2;
  const bojo = (p: P3, f: number, u: number, v: number, b0: number, b1: number): P3 => {
    if (f < 3) return p;
    // a massa madura estufa para fora do corte
    const n = normalSetor(p, f, b0, b1);
    const b = 0.0028 * Math.sin(PI * v) * Math.sin(PI * u) ** 0.6;
    return [p[0] + n[0] * b, p[1] - b * 0.4 * v, p[2] + n[2] * b];
  };
  out.push(parte(setor({ R: raioRoda(R, H, H * 0.25), H, a0, a1, na: 44, nh: 10, nr: 8, cor: casca, corCorte, desloc: (p, f, u, v) => bojo(p, f, u, v, a0, a1) }), k.ac, true));
  const g = setor({ R: raioRoda(R, H, H * 0.25), H, a0: -fenda / 2, a1: fenda / 2, na: 8, nh: 10, nr: 8, cor: casca, corCorte, desloc: (p, f, u, v) => bojo(p, f, u, v, -fenda / 2, fenda / 2) });
  g.translate(0.035, 0, 0);
  out.push(parte(g, k.ac, true));
  return out;
};

/** Triângulo de Camembert empanado e frito: migalhas douradas por toda a volta. */
const gCamembertEmpanado: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T, H = R * k.A;
  const a0 = -0.5, a1 = 0.5;
  const cor: CorFn = (x, y, z) => {
    let c = mix(c1, c2, suave(0.35, 0.95, celula(x * 1300, y * 1300, z * 1300, s)) * 0.4);
    c = mix(c, c3, (1 - suave(0.08, 0.25, celula(x * 1500, y * 1500, z * 1500, s + 1))) * 0.35);
    return mul(c, 0.94 + 0.1 * fbm(x * 60, y * 60, z * 60, s + 2));
  };
  return [parte(setor({
    R: raioRoda(R, H, H * 0.3), H, a0, a1, na: 24, nh: 16, nr: 20, cor,
    desloc: (p, f, u, v) => {
      const n = normalSetor(p, f, a0, a1);
      const b = 0.0008 * (1 - celula(p[0] * 700, p[1] * 700, p[2] * 700, s + 3)) * longeDaBorda(u, v);
      return [p[0] + n[0] * b, p[1] + n[1] * b, p[2] + n[2] * b];
    },
  }), k.ac, true)];
};

/** Cunha de queijo azul: massa marfim com veios azul-esverdeados e casca rústica. */
const gQueijoAzul: Gerador = (k) => {
  const { c1, c2, ci, c3, s } = k;
  const R = k.T, H = R * k.A;
  const a0 = -0.42, a1 = 0.42;
  const casca: CorFn = (x, y, z) => {
    let c = mix(c1, c2, suave(0.1, 0.8, fbm(x * 50, y * 50, z * 50, s)) * 0.6);
    c = mix(c, [0.62, 0.64, 0.6], suave(0.45, 0.85, fbm(x * 90, y * 90, z * 90, s + 1)) * 0.35);
    return mul(c, 0.92 + 0.12 * ruido(x * 500, y * 500, z * 500, s + 2));
  };
  const corCorte: CorFn = (x, y, z, u, v) => {
    const r = Math.hypot(x, z);
    const dist = Math.min(v * H, (1 - v) * H, R - r);
    let c = mul(ci, 0.95 + 0.07 * fbm(x * 80, y * 80, z * 80, s + 3));
    // veios que seguem as fendas da agulha e cavidades mofadas mais escuras
    const veio = Math.abs(fbm(x * 55, y * 55, z * 55, s + 4));
    const cav = 1 - suave(0.1, 0.24, celula(x * 170, y * 170, z * 170, s + 5));
    const azul = mix(c3, mul(c3, 0.55), suave(0.3, 0.9, fbm(x * 200, y * 200, z * 200, s + 6)));
    c = mix(c, azul, clamp((1 - suave(0.03, 0.11, veio)) * 0.95 + cav * 0.85));
    c = mix(c, mix(ci, c3, 0.35), (1 - suave(0.0, 0.05, Math.abs(veio - 0.1))) * 0.2);
    return mix(c, casca(x, y, z, 0, 0), 1 - suave(0.002, 0.005, dist));
  };
  return [parte(setor({
    R: raioRoda(R, H, H * 0.1), H, a0, a1, na: 14, nh: 14, nr: 16, nrc: 30, nhc: 26, cor: casca, corCorte,
    desloc: (p, f, u, v) => {
      if (f > 2) return p;
      const n = normalSetor(p, f, a0, a1);
      const b = 0.0012 * fbm(p[0] * 120, p[1] * 120, p[2] * 120, s + 7) * longeDaBorda(u, v, 0.15);
      return [p[0] + n[0] * b, p[1] + n[1] * b, p[2] + n[2] * b];
    },
  }), k.ac, true)];
};

/** Queijo fresco caseiro tirado da musselina: domo branco com a trama do pano e as pregas do nó. */
const gQueijoFresco: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const cor: CorFn = (x, y, z, t, a) => {
    let c = mul(c1, 0.97 + 0.04 * fbm(x * 80, y * 80, z * 80, s));
    const trama = (0.5 + 0.5 * Math.sin(x * 2200 + 2 * Math.sin(z * 300))) * (0.5 + 0.5 * Math.sin(z * 2200 + y * 900));
    c = mul(c, 1 - 0.1 * trama);
    const prega = Math.abs(Math.sin(a * 5 + 1.2 * fbm(t * 3, Math.cos(a), Math.sin(a), s + 1))) ** 4 * suave(0.3, 0.9, t);
    c = mix(c, c2, prega * 0.8 + suave(H * 0.15, 0, y) * 0.3);
    return c;
  };
  return [parte(torno({
    caminho: [[0, 0], [R * 0.82, 0], [R * 0.98, H * 0.2], [R, H * 0.45], [R * 0.86, H * 0.74], [R * 0.55, H * 0.92], [R * 0.18, H * 1.0], [0, H * 1.03]],
    n: 26, m: 44, cor,
    mod: (t, a) => 1 - 0.16 * Math.abs(Math.sin(a * 5 + 1.2 * fbm(t * 3, Math.cos(a), Math.sin(a), s + 1))) ** 4 * suave(0.3, 0.9, t) + 0.025 * fbm(Math.cos(a) * 1.5, Math.sin(a) * 1.5, t * 2, s + 2),
  }), k.ac, true)];
};

/** Quatro bolinhas de queijo fresco roladas na páprica, no gergelim, na noz picada e nas ervas. */
const gBolinhasQueijo: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.22;
  const pap = rgb('#9a2a16'), ger = rgb('#efe0b4'), noz = rgb('#7a4a22'), erva = rgb('#3f6e22');
  const capas: ((x: number, y: number, z: number) => RGB)[] = [
    (x, y, z) => mix(mul(pap, 0.8 + 0.4 * ruido(x * 1500, y * 1500, z * 1500, s)), mul(pap, 0.55), (1 - suave(0.1, 0.35, celula(x * 700, y * 700, z * 700, s + 1))) * 0.6),
    (x, y, z) => { const g = celula(x * 330, y * 800, z * 330, s + 2); return mix(mul(ger, 0.95 + 0.1 * ruido(x * 700, y * 700, z * 700, s)), mul(ger, 0.45), suave(0.5, 0.8, g)); },
    (x, y, z) => { const g = celula(x * 220, y * 220, z * 220, s + 3); return mul(mix(mul(noz, 1.6), noz, suave(0.25, 0.75, g)), 0.85 + 0.3 * ruido(x * 900, y * 900, z * 900, s + 4)); },
    (x, y, z) => mix(c1, mul(erva, 0.75 + 0.5 * ruido(x * 800, y * 800, z * 800, s + 5)), 1 - suave(0.45, 0.7, celula(x * 420, y * 420, z * 420, s + 6))),
  ];
  const relevo = [0.0002, 0.0006, 0.0018, 0.0004];
  const fr = [900, 360, 220, 420];
  capas.forEach((cap, i) => {
    const cx = (i % 2 - 0.5) * R * 2.25, cz = (Math.floor(i / 2) - 0.5) * R * 2.25;
    const g = torno({
      caminho: (u) => { const th = u * PI; return [R * Math.sin(th), R * (1 - Math.cos(th)) * 0.94]; },
      n: 16, m: 24, cor: (x, y, z) => cap(x + cx * 13, y, z + cz * 13),
      desloc: (p) => {
        const c = V(0, R * 0.94, 0);
        const d = p.clone().sub(c).normalize();
        const b = relevo[i] * (1 - celula((p.x + cx * 13) * fr[i], p.y * fr[i], (p.z + cz * 13) * fr[i], s + 2 + i));
        p.addScaledVector(d, b);
        if (p.y < 0.0006) p.y = 0.0006 - (0.0006 - p.y) * 0.3;
      },
    });
    g.translate(cx, 0, cz);
    out.push(parte(g, k.ac, i === 0));
  });
  return out;
};

/** Queijo para marinar no azeite: crottin enrugado, cubos de feta, alecrim, louro, pimenta e grãos. */
const gQueijoMarinado: Gerador = (k) => {
  const { c1, c2, ci, c3, s } = k;
  const out: Parte[] = [];
  const Rc = 0.021, Hc = 0.022;
  // crottin: cilindrinho de casca branca enrugada como cérebro
  out.push(parte(torno({
    caminho: [[0, 0], [Rc * 0.92, 0], [Rc, Hc * 0.12], [Rc * 1.0, Hc * 0.8], [Rc * 0.85, Hc * 0.98], [0, Hc * 1.04]],
    n: 14, m: 36,
    cor: (x, y, z) => { const r = celula(x * 300, y * 300, z * 300, s); return mix(mul(c1, 1.02), c2, suave(0.5, 0.9, r) * 0.6 + suave(0.3, 0.8, fbm(x * 40, y * 40, z * 40, s + 1)) * 0.3); },
    mod: (_t, a) => 1 + 0.02 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, s + 2),
    desloc: (p) => { const b = 0.0006 * (1 - celula(p.x * 300, p.y * 300, p.z * 300, s)); const r = Math.hypot(p.x, p.z) || 1; p.x += (p.x / r) * b; p.z += (p.z / r) * b; if (p.y > Hc * 0.9) p.y += b; },
  }).translate(-0.026, 0, 0.004), k.ac, true));
  // cubos de feta, quebradiços
  const feta: CorFn = (x, y, z) => mul(ci, 0.95 + 0.06 * fbm(x * 200, y * 200, z * 200, s + 3) - 0.08 * (1 - suave(0.05, 0.15, celula(x * 500, y * 500, z * 500, s + 4))));
  const cubos: P3[] = [[0.006, 0, -0.012], [0.026, 0, 0.002], [0.008, 0, 0.014]];
  cubos.forEach((p, i) => {
    const l = 0.016 + 0.002 * i;
    const g = caixa(l, l * 0.92, l, feta, { n: 6, m: 20 });
    const pa = g.getAttribute('position');
    for (let j = 0; j < pa.count; j++) {
      const f = 1 + 0.06 * fbm(pa.getX(j) * 300, pa.getY(j) * 300, pa.getZ(j) * 300, s + 5 + i);
      pa.setXYZ(j, pa.getX(j) * f, pa.getY(j) * f, pa.getZ(j) * f);
    }
    g.computeVertexNormals();
    g.rotateY(0.4 * i + 0.2);
    out.push(parte(tf(g, [p[0], l * 0.46, p[2]]), k.ac));
  });
  // raminho de alecrim por cima
  const verde = c3, haste = rgb('#6a5a34');
  const h0 = V(-0.04, 0.026, -0.012), h1 = V(0.04, 0.02, 0.016);
  out.push(parte(caule([h0, h0.clone().lerp(h1, 0.5).add(V(0, 0.003, 0)), h1], 0.0011, 0.0007, () => haste, 5), 'fosco'));
  for (let i = 0; i < 14; i++) {
    const t = 0.08 + (i / 14) * 0.86;
    const p = h0.clone().lerp(h1, t).add(V(0, 0.003 * Math.sin(PI * t), 0));
    const lado = i % 2 ? 1 : -1;
    const g = elipsoide(0.006, 0.0006, 0.0011, (x, y, z) => mix(verde, [0.75, 0.8, 0.72], y < 0 ? 0.4 : 0.05 + 0.08 * ruido(x * 900, 0, z * 900, s)), 4, 6);
    g.translate(0.005, 0, 0);
    g.rotateY(-0.35 + lado * 1.1);
    out.push(parte(tf(g, [p.x, p.y, p.z]), 'acetinado'));
  }
  // folha de louro, pimenta dedo-de-moça e grãos de pimenta-do-reino
  const louro = folha(0.05, 0.018, rgb('#5a6e34'), rgb('#9aa36a'), { contorno: contornos.lanca, esp: 0.0005, curva: 0.05, concha: 0.08, n: 12, m: 8, s });
  out.push(parte(tf(louro, [-0.02, 0.0225, -0.006], [0, 2.4, 0]), 'acetinado'));
  const chili = rgb('#b8201a');
  out.push(parte(tf(corpo({
    x0: 0, x1: 0.038, n: 12, m: 10,
    perfil: (t) => { const r = 0.0035 * Math.sqrt(Math.max(0, Math.sin(PI * Math.min(1, t * 0.9 + 0.1)))) * (1 - 0.7 * t); return { ry: r, rz: r, cy: 0.0006 * Math.sin(t * 4) }; },
    cor: (x, y, z) => mul(chili, 0.85 + 0.25 * Math.max(0, y) / 0.004 + 0.05 * fbm(x * 200, y * 200, z * 200, s)),
  }), [0.004, 0.0035, 0.026], [0, 0.4, 0]), 'brilhante'));
  for (const [x, z] of [[0.03, -0.016], [0.034, 0.016], [-0.004, 0.025]]) {
    out.push(parte(bolinha(0.0021, (px, py, pz) => mul([0.09, 0.07, 0.05], 0.8 + 0.4 * ruido(px * 3000, py * 3000, pz * 3000, s)), [x, 0.0021, z], 5, 7), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* registro do lote                                                     */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'ovo-gema': { visual: { f: 'esferoide', v: 'ovo-gema', t: 0.042, c1: '#f4efd8', c3: '#f4a414', ci: '#f6b830', cc: '#f0a020', ac: 'brilhante' }, gerar: gOvoGema },
  'ovo-cocotte': { visual: { f: 'esferoide', v: 'ovo-cocotte', t: 0.08, c1: '#f8f5ec', c2: '#f2e3b8', c3: '#f2a81c', ci: '#f6c040', cc: '#e8c890' }, gerar: gOvoCocotte },
  'ovo-rancheros': { visual: { f: 'esferoide', v: 'ovo-rancheros', t: 0.13, c1: '#f8f5ec', c3: '#f2a81c', ci: '#f6c040', cc: '#e8c890' }, gerar: gOvoRancheros },
  'ovo-frito-imerso': { visual: { f: 'esferoide', v: 'ovo-frito-imerso', t: 0.1, c1: '#f8f4e6', c2: '#c27a2e', c3: '#f2a81c', ci: '#f6c040', cc: '#c88a3a' }, gerar: gOvoFritoImerso },
  'ovo-frito-modelado': { visual: { f: 'esferoide', v: 'ovo-frito-modelado', t: 0.09, c1: '#f8f6ee', c2: '#d4a050', c3: '#f6b020', ci: '#f6c040', cc: '#c89048' }, gerar: gOvoFritoModelado },
  'ovo-frito-virado': { visual: { f: 'esferoide', v: 'ovo-frito-virado', t: 0.11, c1: '#f8f4e8', c2: '#d29a48', c3: '#f6b020', ci: '#f6c040', cc: '#c89048' }, gerar: gOvoFritoVirado },
  'ovo-quente-caviar': { visual: { f: 'esferoide', v: 'ovo-quente-caviar', t: 0.058, c1: '#d2a47a', c2: '#f6f2e6', c3: '#f6c030', ci: '#f0e0c8', cc: '#f6a820' }, gerar: gOvoQuenteCaviar },
  'tomate-gratinado': { visual: { f: 'esferoide', v: 'tomate-gratinado', t: 0.07, c1: '#c8281c', c2: '#cf9440', c3: '#3f7a24', ci: '#e04a32', cc: '#b8401e', ac: 'brilhante' }, gerar: gTomateGratinado },
  'omelete-francesa': { visual: { f: 'pao_chato', v: 'omelete-francesa', t: 0.16, a: 0.27, l: 0.42, c1: '#f2cf58', c2: '#d8a440', ci: '#f6dc7a', cc: '#e0b048', ac: 'acetinado' }, gerar: gOmeleteFrancesa },
  'omelete-sufle': { visual: { f: 'pao_chato', v: 'omelete-sufle', t: 0.19, a: 0.2, c1: '#f2d27a', c2: '#c88a36', ci: '#f8e6a8', cc: '#c88a36', ac: 'fosco' }, gerar: gOmeleteSufle },
  'omelete-japonesa': { visual: { f: 'pao_chato', v: 'omelete-japonesa', t: 0.19, c1: '#f4d04a', c2: '#d6a032', ci: '#f6d860', cc: '#e0b040', ac: 'acetinado' }, gerar: gOmeleteJaponesa },
  'tortilla-espanhola': { visual: { f: 'pao_chato', v: 'tortilla-espanhola', t: 0.22, c1: '#e8b850', c2: '#b8782c', ci: '#f0c850', cc: '#b8782c', ac: 'acetinado' }, gerar: gTortilla },
  'sufle-quenelle': { visual: { f: 'choux', v: 'sufle-quenelle', t: 0.07, a: 0.48, l: 0.62, c1: '#f0d080', c2: '#b8782a', ci: '#f8e8b0', cc: '#c08434', ac: 'fosco' }, gerar: gSufleQuenelle },
  camembert: { visual: { f: 'queijo', v: 'camembert', t: 0.11, a: 0.31, c1: '#eeeadf', c2: '#d0b88a', ci: '#f2e2b2', cc: '#e0c888', ac: 'fosco' }, gerar: gCamembert },
  'brie-cortado': { visual: { f: 'queijo', v: 'brie-cortado', t: 0.22, a: 0.15, c1: '#efebe0', c2: '#d4bc8e', ci: '#ecd38a', cc: '#e0c888', ac: 'fosco' }, gerar: gBrieCortado },
  'camembert-empanado': { visual: { f: 'queijo', v: 'camembert-empanado', t: 0.055, a: 0.5, c1: '#d29a48', c2: '#a8682a', c3: '#efc884', ci: '#f2e2b2', cc: '#a86a28', ac: 'fosco' }, gerar: gCamembertEmpanado },
  'queijo-azul': { visual: { f: 'queijo', v: 'queijo-azul', t: 0.1, a: 0.7, c1: '#c8b48a', c2: '#9a8a66', c3: '#4a6868', ci: '#efe6c8', cc: '#d8c898', ac: 'fosco' }, gerar: gQueijoAzul },
  'queijo-fresco': { visual: { f: 'queijo', v: 'queijo-fresco', t: 0.1, a: 0.62, c1: '#f6f4ec', c2: '#d6ceb6', ci: '#f8f6ef', cc: '#e8dcc0', ac: 'acetinado' }, gerar: gQueijoFresco },
  'bolinhas-queijo': { visual: { f: 'queijo', v: 'bolinhas-queijo', t: 0.056, c1: '#f6f3ea', ci: '#f6f3ea', cc: '#e8dcc0', ac: 'fosco' }, gerar: gBolinhasQueijo },
  'queijo-marinado': { visual: { f: 'queijo', v: 'queijo-marinado', t: 0.085, c1: '#f2ecd8', c2: '#d8ccaa', c3: '#3f6a34', ci: '#f6f4ec', cc: '#e8dcc0', ac: 'acetinado' }, gerar: gQueijoMarinado },
};
