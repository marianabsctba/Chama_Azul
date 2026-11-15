// Alimentos novos do grupo aves: aves amarradas, costuradas, espetadas e achatadas,
// escalopes, espetinhos, magret riscado, ballotine em todas as fases, rolinho fatiado,
// pacote de folha de bananeira, terrina em fatia, pato em chaudfroid e as guarnições
// clássicas do capítulo. As ferramentas do topo (barbante, laço, espetos, chapa, rodela)
// também servem às carnes.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, type Ctx, type Gerador } from '../pecas';
import { gAve } from '../fam_carnes';
import { gFolhoso } from '../fam_vegetais';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* ferramentas compartilhadas                                          */
/* ------------------------------------------------------------------ */

export const BARBANTE: RGB = rgb('#e8dcbc');
export const METAL: RGB = rgb('#b4b9bf');
export const MADEIRA: RGB = rgb('#d8bd88');
export const OSSO: RGB = [0.86, 0.8, 0.68];

/** Parte fracionária positiva. */
export const fr = (v: number) => v - Math.floor(v);

/**
 * Chapa com face de cima e de baixo em grade nx por nz, costurada na borda.
 * `pos(u, v, lado)`: u de 0 a 1, v de -1 a 1, lado 1 em cima e 0 embaixo.
 * A cor recebe u no lugar de t e v no lugar do ângulo.
 */
export function chapa(nx: number, nz: number, pos: (u: number, v: number, lado: number) => [number, number, number], cor: CorFn): THREE.BufferGeometry {
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

/** Leva (u, v) da grade para o disco unitário (a borda da grade vira o contorno). */
export function noDisco(u: number, v: number): [number, number] {
  const a = 2 * u - 1, b = v;
  return [a * Math.sqrt(Math.max(0, 1 - (b * b) / 2)), b * Math.sqrt(Math.max(0, 1 - (a * a) / 2))];
}

/**
 * Placa de contorno livre: a grade vira um disco (xd, zd), `contorno` leva o disco ao
 * contorno real e `alto` dá a altura de cima (a de baixo é `base`, padrão 0).
 */
export function placa(nx: number, nz: number, contorno: (xd: number, zd: number) => [number, number], alto: (xd: number, zd: number, r: number) => number, cor: CorFn, base: (xd: number, zd: number, r: number) => number = () => 0): THREE.BufferGeometry {
  return chapa(nx, nz, (u, v, lado) => {
    const [xd, zd] = noDisco(u, v);
    const r = Math.min(1, Math.hypot(xd, zd));
    const [x, z] = contorno(xd, zd);
    return [x, lado ? alto(xd, zd, r) : base(xd, zd, r), z];
  }, cor);
}

/** Barbante torcido ao longo de pontos (aberto ou fechado). */
export function fio(pts: THREE.Vector3[], r: number, o: { fechado?: boolean; n?: number; cor?: RGB } = {}): THREE.BufferGeometry {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
  if (o.fechado) len += pts[0].distanceTo(pts[pts.length - 1]);
  const voltas = len / (r * 3.2);
  const base = o.cor ?? BARBANTE;
  return tubo(pts, {
    raio: r, m: 5, fechado: o.fechado, n: o.n ?? Math.max(8, Math.min(64, Math.round(len / (r * 3)))),
    cor: (x, y, z, t, a) => mul(base, 0.72 + 0.28 * Math.abs(Math.sin(a + t * voltas * PI))),
  });
}

/** Nó de barbante com duas pontinhas soltas. */
export function no(p: THREE.Vector3, r: number, dir = V(1, 0, 0), cor: RGB = BARBANTE): THREE.BufferGeometry[] {
  const out = [tf(elipsoide(r * 2.2, r * 1.7, r * 2, (x, y, z) => mul(cor, 0.8 + 0.2 * ruido(x / r, y / r, z / r)), 4, 6), [p.x, p.y, p.z])];
  for (const sg of [-1, 1]) {
    const d = dir.clone().multiplyScalar(sg * r * 5);
    out.push(fio([p.clone(), p.clone().add(d.clone().multiplyScalar(0.5)).add(V(0, r * 0.6, sg * r)), p.clone().add(d).add(V(0, -r * 2.5, sg * r * 2))], r * 0.9, { n: 8, cor }));
  }
  return out;
}

/** Laço de barbante em volta de uma seção elíptica (plano YZ, em x). */
export function laco(x: number, cy: number, ry: number, rz: number, r: number, o: { cz?: number; incl?: number; no?: boolean; n?: number; cor?: RGB } = {}): THREE.BufferGeometry[] {
  const pts: THREE.Vector3[] = [];
  const N = 20, cz = o.cz ?? 0;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    const y = cy + (ry + r * 0.3) * Math.cos(th);
    pts.push(V(x + (o.incl ?? 0) * (y - cy), Math.max(r * 0.8, y), cz + (rz + r * 0.3) * Math.sin(th)));
  }
  const out = [fio(pts, r, { fechado: true, n: o.n ?? 30, cor: o.cor })];
  if (o.no !== false) out.push(...no(V(x, cy + ry + r * 1.4, cz), r, V(1, 0, 0), o.cor));
  return out;
}

/** Espeto de metal com argola em p0 e ponta em p1. */
export function espetoMetal(p0: THREE.Vector3, p1: THREE.Vector3, r: number): THREE.BufferGeometry[] {
  const dir = p1.clone().sub(p0).normalize();
  const cima = Math.abs(dir.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const lado = new THREE.Vector3().crossVectors(dir, cima).normalize();
  const cor: CorFn = (x, y, z, t, a) => mul(METAL, 0.8 + 0.25 * Math.abs(Math.cos(a)) + 0.05 * ruido(t * 40, 0, 0));
  const out = [tubo([p0, p0.clone().lerp(p1, 0.5), p1], { raio: (t) => r * (t > 0.93 ? lerp(1, 0.12, (t - 0.93) / 0.07) : 1), cima, m: 8, n: 18, cor })];
  const ra = r * 3.2;
  const c = p0.clone().addScaledVector(dir, -ra);
  const anel: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const th = (i / 12) * TAU;
    anel.push(c.clone().addScaledVector(dir, Math.cos(th) * ra).addScaledVector(lado, Math.sin(th) * ra));
  }
  out.push(tubo(anel, { raio: r * 0.75, m: 6, n: 18, fechado: true, cor }));
  return out;
}

/** Espeto de bambu ou palito de madeira: ponta fina em p1 (e em p0 se `duasPontas`). */
export function espetoMadeira(p0: THREE.Vector3, p1: THREE.Vector3, r: number, duasPontas = false, base: RGB = MADEIRA): THREE.BufferGeometry {
  const dir = p1.clone().sub(p0).normalize();
  const cima = Math.abs(dir.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const comp = p1.distanceTo(p0);
  const fp = Math.min(0.3, (r * 6) / comp);
  return tubo([p0, p0.clone().lerp(p1, 0.5), p1], {
    raio: (t) => r * (t > 1 - fp ? lerp(1, 0.1, (t - (1 - fp)) / fp) : duasPontas && t < fp ? lerp(0.1, 1, t / fp) : 1),
    cima, m: 6, n: 14,
    cor: (x, y, z, t, a) => mul(base, 0.84 + 0.12 * fbm(t * comp * 300, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 3) + 0.06 * Math.cos(a)),
  });
}

/** Pele crua de ave com poros. */
export function corPele(base: RGB, sombra: RGB, s: number, poro = 0.0025): CorFn {
  const f = 1 / poro;
  return (x, y, z) => {
    const p = 1 - suave(0.1, 0.22, celula(x * f, y * f, z * f, s));
    let c = mix(base, sombra, suave(0.3, 0.9, fbm(x * 22, y * 22, z * 22, s)) * 0.4);
    c = mul(c, 1 - p * 0.09 + 0.04 * fbm(x * 110, y * 110, z * 110, s + 1));
    return c;
  };
}

/** Superfície assada: dourado com manchas mais tostadas e bolhinhas claras de gordura. */
export function corAssada(claro: RGB, escuro: RGB, s: number, f = 50, tostado = 0.6): CorFn {
  return (x, y, z) => {
    const n = fbm(x * f, y * f, z * f, s);
    let c = mix(claro, escuro, suave(-0.35, 0.65, n) * tostado + 0.15);
    const b = 1 - suave(0.08, 0.3, celula(x * f * 5, y * f * 5, z * f * 5, s + 4));
    c = mul(c, 1 + 0.14 * b - 0.05 + 0.05 * ruido(x * f * 9, y * f * 9, z * f * 9, s));
    return c;
  };
}

/** Carne crua com fibras finas e variação de tom. */
export function corFibra(base: RGB, s: number, esc = 0.004, dir: [number, number, number] = [0, 0.4, 1]): CorFn {
  return (x, y, z) => {
    const w = fbm(x * 40, y * 40, z * 40, s) * 2;
    const fib = Math.abs(Math.sin((x * dir[0] + y * dir[1] + z * dir[2]) / esc + w)) ** 3;
    return mul(base, 0.9 + 0.14 * fbm(x * 30, y * 30, z * 30, s + 2) - 0.08 * fib);
  };
}

/**
 * Rodela em pé (eixo Y), raio R e espessura H, com quase todos os anéis na face de cima,
 * para pintar camadas e recheios. `l` achata em Z (oval).
 */
export function rodela(R: number, H: number, cor: CorFn, o: { n?: number; m?: number; l?: number; mod?: (t: number, a: number) => number; borda?: number; desloc?: (p: THREE.Vector3, t: number, a: number) => void } = {}): THREE.BufferGeometry {
  const b = Math.min(R * 0.2, H * (o.borda ?? 0.3));
  return torno({
    caminho: (s) => {
      if (s < 0.08) return [lerp(0, R - b, s / 0.08), 0];
      if (s < 0.22) {
        const q = (s - 0.08) / 0.14;
        const th = q * PI;
        return [R - b + b * Math.sin(th), H / 2 - (H / 2) * Math.cos(th)];
      }
      const q = (s - 0.22) / 0.78;
      return [lerp(R - b, 0, q ** 0.9), H];
    },
    n: o.n ?? 24, m: o.m ?? 28, cor, l: o.l, mod: o.mod, desloc: o.desloc,
  });
}

/** Contexto com outra variante e cores (para reaproveitar geradores das famílias). */
export function ctxCom(k: Ctx, mud: Partial<Ctx['v']>, extra: Partial<Ctx> = {}): Ctx {
  const v = { ...k.v, ...mud };
  const d = ' ' + (v.d ?? '') + ' ';
  return { ...k, v, A: v.a ?? k.A, L: v.l ?? k.L, T: v.t ?? k.T, tem: (w: string) => d.includes(' ' + w + ' '), ...extra };
}

/* ------------------------------------------------------------------ */
/* aves inteiras amarradas, costuradas e espetadas                      */
/* ------------------------------------------------------------------ */

type Fecho = 'barbante' | 'costura' | 'espetos';

function aveFechada(k: Ctx, modo: Fecho): Parte[] {
  const out = gAve(k);
  const T = k.T, Lb = T * 0.8, H = T * k.A, W = T * k.L;
  const x0 = -Lb / 2, x1 = Lb / 2;
  const r = 0.0011 * Math.sqrt(T / 0.2);
  const add = (gs: THREE.BufferGeometry[]) => gs.forEach((g) => out.push(parte(g, 'fosco')));
  if (modo === 'espetos') {
    const re = 0.0016 * Math.sqrt(T / 0.28);
    // um espeto atravessa asa, pele do pescoço e a outra asa; o outro, as coxas e o rabo
    add(espetoMetal(V(x1 - Lb * 0.2, H * 0.34, -W * 0.78), V(x1 - Lb * 0.2, H * 0.36, W * 0.74), re));
    add(espetoMetal(V(x0 + Lb * 0.22, H * 0.5, W * 0.84), V(x0 + Lb * 0.2, H * 0.48, -W * 0.8), re));
    return out;
  }
  // laço nos tornozelos, apertando as duas pontas das coxas
  add(laco(x0 - T * 0.05, H * 0.85, W * 0.08, W * 0.2, r, { no: true }));
  if (modo === 'barbante') {
    // do tornozelo o fio desce à sambiquira e corre pelos flancos, entre coxa e peito, até o pescoço
    add([fio([V(x0 - T * 0.05, H * 0.76, 0), V(x0 - T * 0.03, H * 0.5, 0), V(x0 + Lb * 0.02, H * 0.3, 0)], r)]);
    for (const sg of [-1, 1]) {
      add([fio([
        V(x0 - T * 0.04, H * 0.84, sg * W * 0.18), V(x0 + Lb * 0.12, H * 0.86, sg * W * 0.3), V(x0 + Lb * 0.36, H * 0.84, sg * W * 0.35),
        V(x0 + Lb * 0.6, H * 0.72, sg * W * 0.46), V(x1 - Lb * 0.25, H * 0.5, sg * W * 0.58), V(x1 - Lb * 0.06, H * 0.47, sg * W * 0.42),
        V(x1 + T * 0.025, H * 0.52, sg * W * 0.12),
      ], r, { n: 44 })]);
    }
    add([fio([V(x1 + T * 0.025, H * 0.52, -W * 0.12), V(x1 + T * 0.04, H * 0.58, 0), V(x1 + T * 0.025, H * 0.52, W * 0.12)], r)]);
    add(no(V(x1 + T * 0.04, H * 0.6, 0), r, V(0, 0, 1)));
    return out;
  }
  // costura: pontos que atravessam a junta da coxa e a asa, pontas amarradas asa com perna
  for (const sg of [-1, 1]) {
    add([fio([V(x0 + Lb * 0.31, H * 0.74, sg * W * 0.5), V(x0 + Lb * 0.35, H * 0.58, sg * W * 0.6), V(x0 + Lb * 0.39, H * 0.42, sg * W * 0.56)], r)]);
    add([fio([V(x1 - Lb * 0.34, H * 0.56, sg * W * 0.55), V(x1 - Lb * 0.3, H * 0.42, sg * W * 0.6), V(x1 - Lb * 0.27, H * 0.28, sg * W * 0.55)], r)]);
    // o fio que sobra da perna vai até a ponta da asa e é amarrado
    add([fio([V(x0 + Lb * 0.39, H * 0.42, sg * W * 0.57), V(x0 + Lb * 0.6, H * 0.32, sg * W * 0.62), V(x1 - Lb * 0.27, H * 0.28, sg * W * 0.57)], r, { n: 24 })]);
    add(no(V(x1 - Lb * 0.27, H * 0.28, sg * W * 0.6), r));
  }
  // pele do pescoço presa por cima com um ponto
  add([fio([V(x1 - Lb * 0.02, H * 0.6, -W * 0.14), V(x1 + T * 0.01, H * 0.66, 0), V(x1 - Lb * 0.02, H * 0.6, W * 0.14)], r)]);
  return out;
}

/* ------------------------------------------------------------------ */
/* ave achatada (spatchcock), inteira crua ou meia grelhada             */
/* ------------------------------------------------------------------ */

function aveAchatada(k: Ctx, grelhada: boolean): Parte[] {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const meia = grelhada;
  const crua = corPele(c1, c2, s, 0.002);
  const ouro = corAssada(rgb('#dca050'), rgb('#8a4a1c'), s, 45, 0.75);
  const carvao = rgb('#3a2010');
  const marca = (x: number, z: number) => {
    const d = fr((x * 0.82 - z * 0.57) / 0.024);
    return 1 - suave(0.07, 0.15, Math.min(d, 1 - d));
  };
  const pele: CorFn = (x, y, z, t, a) => {
    if (!grelhada) return crua(x, y, z, t, a);
    // marinada caramelizada, marcas da grelha no que fica em cima
    return mix(ouro(x, y, z, t, a), carvao, marca(x, z) * suave(H * 0.45, H * 0.8, y) * 0.7);
  };
  const morro = (x: number, z: number, cx: number, cz: number, rx: number, rz: number) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const cont = (xd: number, zd: number): [number, number] => {
    const ang = Math.atan2(zd, xd);
    const irr = 1 + 0.04 * fbm(Math.cos(ang) * 2, Math.sin(ang) * 2, 0, s);
    const larg = lerp(1, 0.6, suave(-0.6, 1, xd));
    const z = meia ? ((zd + 1) / 2) * (W / 2) * larg * irr : zd * (W / 2) * larg * irr;
    return [xd * L * 0.43 * irr, z];
  };
  // peito em dois lobos na frente, sobrecoxas largas atrás, tudo coberto pela pele
  const altura = (x: number, z: number, r: number) => {
    const peito = Math.max(morro(x, z, L * 0.1, W * 0.1, L * 0.24, W * 0.12), morro(x, z, L * 0.1, -W * 0.1, L * 0.24, W * 0.12));
    const quilha = morro(x, z, L * 0.12, 0, L * 0.25, W * 0.025) * 0.12;
    const coxa = Math.max(morro(x, z, -L * 0.2, W * 0.27, L * 0.15, W * 0.14), morro(x, z, -L * 0.2, -W * 0.27, L * 0.15, W * 0.14));
    const borda = Math.sqrt(Math.max(0, 1 - r ** 6));
    return H * (0.18 + 0.22 * borda + 0.6 * Math.max(peito - quilha, coxa * 0.85)) * borda ** 0.3 + H * 0.03 * fbm(x * 60, 0, z * 60, s);
  };
  const corCorpo: CorFn = (x, y, z, u, v) => {
    // a meia ave mostra a carne branca cozida no corte do meio
    if (meia && z < W * 0.012 && y > H * 0.05) return mul(ci, 0.95 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
    return pele(x, y, z, u, v);
  };
  out.push(parte(placa(meia ? 30 : 40, meia ? 22 : 40, cont, (xd, zd, r) => {
    const [x, z] = cont(xd, zd);
    return altura(x, z, meia ? Math.min(1, Math.hypot(xd, Math.max(0, zd))) : r);
  }, corCorpo, () => 0), k.ac, true));
  for (const sg of meia ? [1] : [-1, 1]) {
    // coxa (baqueta) colada à sobrecoxa, apontando para trás
    out.push(parte(tubo([V(-L * 0.24, H * 0.42, sg * W * 0.28), V(-L * 0.36, H * 0.36, sg * W * 0.27), V(-L * 0.5, H * 0.24, sg * W * 0.2)], {
      raio: (t) => W * (0.07 * (1 - suave(0.1, 0.8, t)) + 0.028 + 0.012 * suave(0.88, 1, t)), m: 12, n: 16,
      cor: (x, y, z, t, a) => mix(pele(x, y, z, t, a), grelhada ? mul(OSSO, 0.7) : OSSO, suave(0.86, 0.94, t)),
    }), k.ac));
    // asa dobrada ao lado do peito
    out.push(parte(tubo([V(L * 0.28, H * 0.4, sg * W * 0.22), V(L * 0.17, H * 0.32, sg * W * 0.34), V(L * 0.26, H * 0.22, sg * W * 0.38), V(L * 0.38, H * 0.18, sg * W * 0.3)], {
      raio: (t) => W * 0.05 * (t < 0.4 ? 1.15 : lerp(1.05, 0.5, (t - 0.4) / 0.6)), achata: 1.5, cima: V(0, 1, 0), m: 10, n: 18, cor: pele,
    }), k.ac));
  }
  // espetos que mantêm a ave aberta: de cada asa à coxa do outro lado
  const re = 0.0015;
  if (meia) {
    out.push(parte(espetoMadeira(V(L * 0.34, H * 0.32, W * 0.46), V(-L * 0.3, H * 0.36, W * 0.02), re), 'fosco'));
  } else {
    for (const sg of [-1, 1]) for (const g of espetoMetal(V(L * 0.32, H * 0.36 + sg * H * 0.04, sg * W * 0.5), V(-L * 0.28, H * 0.36 + sg * H * 0.04, -sg * W * 0.5), re)) out.push(parte(g, 'brilhante'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* escalope batido e schnitzel                                          */
/* ------------------------------------------------------------------ */

function contornoGota(L: number, W: number, s: number) {
  return (xd: number, zd: number): [number, number] => {
    const ang = Math.atan2(zd, xd);
    const irr = 1 + 0.06 * fbm(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6, 0, s);
    return [xd * (L / 2) * irr, zd * (W / 2) * irr * (1 - 0.22 * xd)];
  };
}

function escalope(k: Ctx, empanado: boolean): Parte[] {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const fib = corFibra(c1, s, 0.003, [0.7, 0, 0.7]);
  const corCru: CorFn = (x, y, z, t, a) => {
    // bordas mais translúcidas e rosadas, marcas leves do papel batido
    const r = Math.hypot(x / (L / 2), z / (W / 2));
    const c = mix(fib(x, y, z, t, a), c2, suave(0.75, 1, r) * 0.35);
    return mul(c, 1 - 0.04 * suave(0.3, 0.8, fbm(x * 70, 0, z * 70, s + 5)));
  };
  const losango = (x: number, z: number) => {
    const e = 0.03;
    const d1 = fr((x + z * 1.3) / e), d2 = fr((x - z * 1.3) / e);
    return 1 - suave(0.05, 0.12, Math.min(d1, 1 - d1, d2, 1 - d2));
  };
  const corEmp: CorFn = (x, y, z) => {
    // migalhas: grãos claros e escuros, fritura mais escura nas bordas
    const g = fbm(x * 220, y * 220, z * 220, s + 3);
    const r = Math.hypot(x / (L / 2), z / (W / 2));
    let c = mix(rgb('#e4ae58'), rgb('#a8601e'), suave(-0.3, 0.7, fbm(x * 40, y * 40, z * 40, s)) * 0.75 + suave(0.8, 1, r) * 0.3);
    c = mul(c, 0.9 + 0.2 * g);
    return mix(c, rgb('#7a3e14'), losango(x, z) * 0.6 * suave(H * 0.5, H, y));
  };
  const alto = (xd: number, zd: number, r: number) => {
    const borda = Math.sqrt(Math.max(0, 1 - r ** 6));
    let h = H * (0.35 + 0.65 * borda) * (1 + 0.12 * fbm(xd * 3, zd * 3, 0, s));
    if (empanado) {
      const [x, z] = [xd * L / 2, zd * W / 2];
      h += H * 0.1 * fbm(x * 160, 0, z * 160, s) - H * 0.16 * losango(x, z);
    }
    return h;
  };
  const g = placa(empanado ? 54 : 30, empanado ? 30 : 22, contornoGota(L, W, s), alto, empanado ? corEmp : corCru, (xd, zd, r) => H * 0.25 * (1 - Math.sqrt(Math.max(0, 1 - r ** 6))));
  return [parte(g, empanado ? 'fosco' : 'umido', true)];
}

/* ------------------------------------------------------------------ */
/* espetinho de coxa com legumes e saté                                 */
/* ------------------------------------------------------------------ */

/** Pedaço de pimentão: quadrado curvo atravessado pelo espeto (plano YZ). */
function pimentao(x: number, cy: number, lado: number, cor: RGB, s: number): THREE.BufferGeometry {
  const e = lado * 0.08;
  return chapa(6, 6, (u, v, l) => {
    const z = v * lado / 2, y = (u - 0.5) * lado;
    const curva = lado * 0.25 * ((y / (lado / 2)) ** 2 + (z / (lado / 2)) ** 2) * 0.5;
    return [x + curva + (l ? e : 0), cy + y, z];
  }, (xx, yy, zz, u, v) => mul(mix(cor, mul(cor, 1.25), suave(0.7, 1, Math.max(Math.abs(2 * u - 1), Math.abs(v)))), 1 + 0.06 * fbm(xx * 80, yy * 80, zz * 80, s)));
}

/** Gomo de cebola: camadas curvas em arco (plano YZ). */
function cebola(x: number, cy: number, R: number, s: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 3; c++) {
    const rr = R * (0.55 + c * 0.22);
    const esp = R * 0.08;
    out.push(chapa(8, 3, (u, v, l) => {
      const ang = lerp(-1.0, 1.0, u) + PI / 2;
      const r2 = rr + (l ? esp : 0);
      return [x + v * R * 0.45, cy - R * 0.4 + Math.sin(ang) * r2, Math.cos(ang) * r2];
    }, (xx, yy, zz, u) => mix(mul(rgb('#f2ecf2'), 1 + 0.05 * fbm(xx * 90, yy * 90, zz * 90, s + c)), rgb('#a85a8a'), c === 2 ? 0.5 + 0.2 * Math.sin(u * 7) : 0)));
  }
  return out;
}

function espetinhoFrango(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const cy = 0.022;
  const marinada: CorFn = (x, y, z) => {
    let c = mix(c1, c2, suave(0.0, 0.7, fbm(x * 60, y * 60, z * 60, s)) * 0.6);
    c = mix(c, rgb('#5a6a2a'), (1 - suave(0.1, 0.2, celula(x * 500, y * 500, z * 500, s + 2))) * 0.6);
    return mul(c, 0.94 + 0.08 * fbm(x * 150, y * 150, z * 150, s + 1));
  };
  const ordem = ['f', 'p', 'c', 'f', 'q', 'f', 'p', 'c', 'f'];
  const passo = (L * 0.72) / ordem.length;
  ordem.forEach((o, i) => {
    const x = -L * 0.36 + passo * (i + 0.5);
    if (o === 'f') {
      // pedaço de coxa dobrado ao meio: travesseiro irregular
      const g = elipsoide(passo * 0.85, cy * 0.92, cy * 1.15, marinada, 11, 14, (t, a) => 1 + 0.2 * fbm(t * 2.5, Math.cos(a) * 1.2, Math.sin(a) * 1.2, s + i) + 0.1 * Math.sin(a * 2 + i));
      tf(g, [x, cy, 0], [k.r.f(-0.3, 0.3), 0, k.r.f(-0.1, 0.1)]);
      out.push(parte(g, 'umido', true));
    } else if (o === 'p' || o === 'q') {
      out.push(parte(pimentao(x - passo * 0.15, cy, cy * 1.7, rgb(o === 'p' ? '#c41e14' : '#3a7a1e'), s + i), 'brilhante'));
    } else {
      for (const g of cebola(x, cy, cy * 0.95, s + i)) out.push(parte(g, 'acetinado'));
    }
  });
  for (const g of espetoMetal(V(-L / 2 + L * 0.06, cy, 0), V(L / 2, cy, 0), 0.0016)) out.push(parte(g, 'brilhante'));
  return out;
}

function sate(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const cy = 0.011;
  const x0 = -L * 0.2, x1 = L * 0.42;
  const pts: THREE.Vector3[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(V(lerp(x0, x1, t), cy + 0.0075 * Math.sin(t * PI * 7), 0.0015 * Math.sin(t * PI * 3)));
  }
  const base = rgb('#c8862a'), escuro = rgb('#7a3e14'), carvao = rgb('#3a1e0c');
  out.push(parte(tubo(pts, {
    raio: (t) => 0.0115 * (0.9 + 0.1 * Math.sin(t * 13)) * (1 - 0.5 * suave(0.96, 1, t)) * (1 - 0.5 * suave(0.04, 0, t)), achata: 0.3, cima: V(0, 0, 1), m: 14, n: 140,
    mod: (t, a) => 1 + 0.08 * fbm(t * 30, Math.cos(a), Math.sin(a), s),
    cor: (x, y, z) => {
      // açafrão e soja: amarelo-âmbar, tostado nas dobras de cima, pontas chamuscadas
      let c = mix(base, escuro, suave(-0.2, 0.7, fbm(x * 90, y * 90, z * 90, s)) * 0.7);
      c = mix(c, carvao, suave(cy + 0.009, cy + 0.0145, y) * 0.75 + (1 - suave(0.05, 0.14, celula(x * 260, y * 260, z * 260, s))) * 0.3);
      return mul(c, 1 + 0.06 * ruido(x * 600, y * 600, z * 600, s));
    },
  }), 'brilhante', true));
  out.push(parte(espetoMadeira(V(-L / 2, cy, 0), V(L / 2, cy, 0), 0.0016, false, rgb('#dcc89a')), 'fosco'));
  return out;
}

/* ------------------------------------------------------------------ */
/* peito de pato com a pele riscada                                     */
/* ------------------------------------------------------------------ */

function magretRiscado(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const Hm = H * 0.55, Hp = H * 0.45;
  const cont = contornoGota(L, W, s);
  const contorno = (xd: number, zd: number): [number, number] => {
    const [x, z] = cont(xd, zd);
    return [x, z * (1 + 0.18 * xd)];
  };
  const borda = (r: number) => Math.sqrt(Math.max(0, 1 - r ** 5));
  const e = 0.026;
  const risco = (x: number, z: number) => {
    const d1 = fr((x * 0.8 + z) / e), d2 = fr((x * 0.8 - z) / e);
    return 1 - suave(0.05, 0.12, Math.min(d1, 1 - d1, d2, 1 - d2));
  };
  // carne vermelho-escura embaixo
  const carne = placa(18, 10, contorno, (xd, zd, r) => Hm * (0.4 + 0.6 * borda(r)) + Hm * 0.3 * (1 - borda(r)), corFibra(c1, s, 0.0025, [1, 0, 0.4]), (xd, zd, r) => Hm * 0.3 * (1 - borda(r)));
  // capa de pele e gordura por cima, riscada em losangos sem chegar à carne
  const pele = placa(52, 26, (xd, zd) => {
    const [x, z] = contorno(xd, zd);
    return [x * 0.985, z * 0.985];
  }, (xd, zd, r) => {
    const [x, z] = contorno(xd, zd);
    const b = borda(r);
    return Hm * (0.4 + 0.6 * b) + Hp * (0.3 + 0.7 * b) * (1 + 0.05 * fbm(x * 30, 0, z * 30, s)) - Hp * 0.5 * risco(x, z) * b;
  }, (x, y, z) => {
    let c = mix(c2, rgb('#f6ead2'), suave(0, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.4);
    c = mul(c, 0.96 + 0.06 * fbm(x * 200, 0, z * 200, s + 3));
    const rr = risco(x, z);
    // o fundo do risco abre a gordura rosada, mais úmida
    c = mix(c, rgb('#d89a8a'), rr * 0.75);
    return mix(c, mul(c, 0.82), suave(Hm + Hp * 0.75, Hm, y) * 0.5);
  }, (xd, zd, r) => Hm * (0.4 + 0.6 * borda(r)) * 0.995);
  return [parte(carne, 'umido', true), parte(pele, 'acetinado', true)];
}

/* ------------------------------------------------------------------ */
/* fatias de pato em chaudfroid                                         */
/* ------------------------------------------------------------------ */

function patoChaudfroid(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const Lf = 0.085, Wf = 0.042, Hf = 0.009;
  const n = k.v.n ?? 5;
  const marfim = rgb('#efe6cf');
  for (let i = 0; i < n; i++) {
    const si = s + i * 7;
    const ang = (i - (n - 1) / 2) * 0.32;
    const cont = (xd: number, zd: number): [number, number] => [xd * Lf / 2, zd * Wf / 2 * (1 - 0.12 * xd)];
    // fatia de peito rosado: só a lateral aparece por baixo da capa
    const g = placa(16, 8, cont, (xd, zd, r) => Hf * (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - r ** 4))) + 0.0025 * Math.exp(-((xd - 0.1) ** 2 + zd ** 2) / 0.05), (x, y, z) => {
      const capa = suave(Hf * 0.35, Hf * 0.6, y);
      const lado = mix(mul(c1, 0.95 + 0.1 * fbm(x * 90, y * 90, z * 90, si)), rgb('#f0e0c8'), suave(Wf * 0.3, Wf * 0.45, z));
      return mix(lado, mul(marfim, 0.98 + 0.04 * fbm(x * 40, y * 40, z * 40, si)), capa);
    });
    tf(g, [Math.sin(ang) * 0.02 + i * 0.002, 0.0015 * i, -Math.cos(ang) * 0.004 + (i - (n - 1) / 2) * 0.026], [0, ang, 0]);
    out.push(parte(g, 'brilhante', true));
    // tirinhas de casca de laranja escaldada por cima
    for (let j = 0; j < 2; j++) {
      const p0 = V(-0.015 + j * 0.02, Hf + 0.0012, -0.008 + j * 0.006);
      const pts = [p0, p0.clone().add(V(0.006, 0.0008, 0.005)), p0.clone().add(V(0.012, 0, 0.004)), p0.clone().add(V(0.016, 0.0005, 0.009))];
      const tira = tubo(pts, { raio: 0.0011, achata: 0.45, cima: V(0, 1, 0), m: 6, n: 10, cor: (x, y, z) => mul(rgb('#e8740e'), 0.92 + 0.12 * ruido(x * 900, y * 900, z * 900, si)) });
      tf(tira, [0, 0, 0], [0, 0, 0]);
      tira.rotateY(ang);
      tira.translate(Math.sin(ang) * 0.02 + i * 0.002, 0.0015 * i, -Math.cos(ang) * 0.004 + (i - (n - 1) / 2) * 0.026);
      out.push(parte(tira, 'brilhante'));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* ballotine: ave desossada aberta, rolo amarrado e fatias              */
/* ------------------------------------------------------------------ */

function aveDesossada(k: Ctx): Parte[] {
  const { c1, c2, ci, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cont = (xd: number, zd: number): [number, number] => {
    const ang = Math.atan2(zd, xd);
    // contorno de ave aberta: mais larga atrás (pernas), cantos das asas na frente
    const irr = 1 + 0.06 * fbm(Math.cos(ang) * 2, Math.sin(ang) * 2, 0, s) + 0.035 * Math.cos(ang * 4) ** 2;
    return [xd * (L / 2) * irr, zd * (W / 2) * irr * (1 + 0.12 * -xd)];
  };
  const morro = (x: number, z: number, cx: number, cz: number, rx: number, rz: number) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const relevo = (x: number, z: number) => {
    const peito = Math.max(morro(x, z, L * 0.08, W * 0.12, L * 0.22, W * 0.1), morro(x, z, L * 0.08, -W * 0.12, L * 0.22, W * 0.1));
    const coxa = Math.max(morro(x, z, -L * 0.22, W * 0.28, L * 0.13, W * 0.12), morro(x, z, -L * 0.22, -W * 0.28, L * 0.13, W * 0.12));
    const asa = Math.max(morro(x, z, L * 0.3, W * 0.34, L * 0.06, W * 0.06), morro(x, z, L * 0.3, -W * 0.34, L * 0.06, W * 0.06));
    return { peito, coxa, asa };
  };
  const pele = corPele(c1, c2, s, 0.002);
  const g = placa(46, 44, cont, (xd, zd, r) => {
    const [x, z] = cont(xd, zd);
    const q = relevo(x, z);
    const borda = Math.sqrt(Math.max(0, 1 - r ** 8));
    return H * (0.25 + 0.2 * borda + 0.55 * Math.max(q.peito, q.coxa * 0.9, q.asa * 0.6)) + H * 0.06 * fbm(x * 40, 0, z * 40, s);
  }, (x, y, z, u, v) => {
    const [xd, zd] = noDisco(u, v);
    const r = Math.hypot(xd, zd);
    const q = relevo(x, z);
    // filés de peito rosados, sobrecoxas mais escuras, membrana e gordura amarelada nas bordas
    let c = mix(mul(ci, 0.98), rgb('#f0c8b8'), 0.3);
    c = mix(c, mul(c2, 0.92), q.coxa * 0.8);
    c = mix(c, rgb('#f4e2c8'), (1 - suave(0.0, 0.08, Math.abs(z) / W)) * 0.4);
    c = mul(c, 0.93 + 0.1 * fbm(x * 90, y * 90, z * 90, s) - 0.06 * Math.abs(Math.sin((x * 0.6 + z) * 400)) ** 4 * q.peito);
    // a pele dobra para cima na borda
    return mix(c, pele(x, y, z, 0, 0), suave(0.86, 0.97, r) + (y < H * 0.2 ? 1 : 0));
  });
  return [parte(g, 'umido', true)];
}

/** Rolo de ave recheada, pele por fora, costura embaixo e barbante em laços. */
function ballotineRolo(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ry = H / 2, rz = W / 2;
  const env = (t: number) => Math.sqrt(suave(0, 0.12, t)) * Math.sqrt(suave(1, 0.88, t)) * (1 + 0.03 * Math.sin(t * 9));
  const pele = corPele(c1, c2, s, 0.002);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 34, m: 30, cor: (x, y, z, t, a) => {
      // franzido da pele nas pontas e a costura
      const fz = suave(0.15, 0.02, Math.min(t, 1 - t)) * Math.abs(Math.sin(a * 9)) ** 3;
      return mul(pele(x, y, z, t, a), 1 - fz * 0.12);
    },
    perfil: (t) => ({ ry: ry * Math.max(0.12, env(t)), rz: rz * Math.max(0.12, env(t)), cy: ry }),
    mod: (t, a) => 1 + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), s) + 0.04 * suave(0.15, 0.02, Math.min(t, 1 - t)) * Math.sin(a * 9),
    desloc: (p) => { if (p.y < ry * 0.25) p.y = ry * 0.25 - (ry * 0.25 - p.y) * 0.4; },
  }), k.ac, true));
  const r = 0.0012;
  const nl = 7;
  for (let i = 0; i < nl; i++) {
    const t = 0.12 + (0.76 * i) / (nl - 1);
    const e = env(t);
    for (const g of laco(lerp(-L / 2, L / 2, t), ry, ry * e * 0.97, rz * e * 0.97, r, { no: true })) out.push(parte(g, 'fosco'));
  }
  // fio corrido no comprimento, por cima e em volta das pontas
  const pts: THREE.Vector3[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) { const t = 0.02 + 0.96 * (i / N); pts.push(V(lerp(-L / 2, L / 2, t), ry + ry * Math.max(0.12, env(t)) + r * 0.4, 0)); }
  for (let i = N; i >= 0; i--) { const t = 0.02 + 0.96 * (i / N); pts.push(V(lerp(-L / 2, L / 2, t), Math.max(r, ry - ry * Math.max(0.12, env(t)) * 0.75), 0)); }
  out.push(parte(fio(pts, r, { fechado: true, n: 90 }), 'fosco'));
  return out;
}

/** Fatias de ballotine em leque: pele, carne branca e o recheio com pistache no centro. */
function fatiasBallotine(k: Ctx): Parte[] {
  const { c1, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.24, H = 0.014;
  const n = k.v.n ?? 5;
  for (let i = 0; i < n; i++) {
    const si = s + i * 11;
    const ox = R * 0.06 * Math.sin(i * 1.7), oz = R * 0.05 * Math.cos(i * 2.3);
    const cor: CorFn = (x, y, z) => {
      const ang = Math.atan2(z, x);
      const rr = Math.hypot(x, z) / R / (1 + 0.04 * fbm(Math.cos(ang) * 2, Math.sin(ang) * 2, 0, si));
      if (y < H * 0.8 || rr > 0.95) return mul(c1, 0.95 + 0.08 * fbm(x * 150, y * 150, z * 150, si));
      const rc = Math.hypot(x - ox, z - oz) / R;
      // recheio de carne rosado com pistache e pimenta
      if (rc < 0.55 + 0.04 * fbm(ang * 2, 0, 0, si)) {
        let c = mul(rgb('#e4b4a0'), 0.92 + 0.12 * fbm(x * 300, 0, z * 300, si));
        c = mix(c, rgb('#6a9a3a'), 1 - suave(0.16, 0.24, celula(x * 170, 0, z * 170, si + 3)));
        return mix(c, rgb('#5a3a2a'), (1 - suave(0.04, 0.09, celula(x * 600, 0, z * 600, si + 5))) * 0.7);
      }
      // carne branca com manchas da coxa e a linha fina de gelatina antes da pele
      let c = mix(ci, rgb('#dcb8a4'), suave(0.2, 0.6, fbm(ang * 1.5, rr * 3, 0, si)) * 0.6);
      c = mul(c, 0.94 + 0.08 * fbm(x * 200, 0, z * 200, si));
      return mix(c, rgb('#e8d8a8'), suave(0.86, 0.92, rr) * 0.7);
    };
    const g = rodela(R, H, cor, { n: 22, m: 30, mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, si) });
    tf(g, [i * R * 0.75, R * Math.sin(0.32) + H * 0.2, i * R * 0.12], [0.05 * Math.sin(i), 0, 0.32]);
    out.push(parte(g, k.ac, true));
  }
  return out;
}

/** Rodelas em diagonal de rolinho de peito com queijo de cabra e espinafre. */
function rodelasRoulade(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.3, H = 0.013, l = 0.72;
  const n = k.v.n ?? 4;
  const queijo = rgb('#f6f2e6'), espinafre = rgb('#2e5a1e');
  for (let i = 0; i < n; i++) {
    const si = s + i * 5;
    const cor: CorFn = (x, y, z) => {
      if (y < H * 0.8) return mul(c1, 0.95 + 0.06 * fbm(x * 150, y * 150, z * 150, si));
      const zz = z / l;
      const rr = Math.hypot(x, zz) / R;
      const ang = Math.atan2(zz, x);
      // espiral: frango, queijo, espinafre, frango... com o filezinho no centro
      const q = fr(rr * 2.3 - ang / TAU + 0.05 * fbm(x * 80, 0, z * 80, si));
      if (rr < 0.16) return mul(c1, 0.97 + 0.05 * fbm(x * 200, 0, z * 200, si));
      let c: RGB;
      if (q < 0.58) c = mul(c1, 0.94 + 0.08 * fbm(x * 220, 0, z * 220, si) - 0.05 * Math.abs(Math.sin(x * 900)) ** 6);
      else if (q < 0.78) c = mul(queijo, 0.95 + 0.06 * ruido(x * 700, 0, z * 700, si));
      else c = mix(espinafre, rgb('#4a7a2a'), suave(0, 0.7, fbm(x * 300, 0, z * 300, si)) * 0.5);
      return c;
    };
    const g = rodela(R, H, cor, { n: 22, m: 30, l, mod: (t, a) => 1 + 0.035 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, si) });
    tf(g, [i * R * 1.25, R * l * Math.sin(0.28) + H * 0.25, -i * R * 0.25], [0.28, 0.35, 0]);
    out.push(parte(g, k.ac, true));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* pacote de folha de bananeira aberto com o peito no vapor              */
/* ------------------------------------------------------------------ */

function pacoteBananeira(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const S = k.T;
  const verde = rgb('#3e8a2a'), verdeClaro = rgb('#6aa83a');
  out.push(parte(chapa(26, 26, (u, v, l) => {
    const a = 2 * u - 1;
    const borda = Math.max(suave(0.55, 1, Math.abs(a)), suave(0.55, 1, Math.abs(v)));
    const y = S * 0.16 * borda ** 1.6 + S * 0.004 * fbm(u * 6, v * 6, 0, s);
    return [a * S / 2 * (1 - 0.12 * borda), y + (l ? 0.0012 : 0), v * S / 2 * (1 - 0.12 * borda)];
  }, (x, y, z) => {
    // nervuras paralelas finas da folha e brilho cozido no vapor
    const nerv = Math.abs(Math.sin(z * 900 + 0.4 * fbm(x * 20, 0, z * 20, s))) ** 10;
    const c = mix(verde, verdeClaro, suave(-0.4, 0.6, fbm(x * 15, y * 15, z * 15, s)) * 0.6);
    return mul(mix(c, mul(verdeClaro, 1.1), nerv * 0.5), 0.92 + 0.08 * ruido(x * 300, y * 300, z * 300, s));
  }), 'brilhante', true));
  // peito pincelado de hoisin e soja
  const Lp = S * 0.56, Wp = Lp * 0.48, Hp = Lp * 0.2;
  out.push(parte(corpo({
    x0: -Lp / 2, x1: Lp / 2, n: 24, m: 22, exp: 2.4,
    cor: (x, y, z) => mix(mix(c1, c2, suave(-0.3, 0.6, fbm(x * 50, y * 50, z * 50, s)) * 0.7), rgb('#e8d8c8'), suave(Hp * 0.25, 0, y) * 0.5),
    perfil: (t) => { const e = Math.sin(PI * clamp(t) ** 0.8) ** 0.7; return { ry: (Hp / 2) * e, rz: (Wp / 2) * e * lerp(0.75, 1, t), cy: (Hp / 2) * e + S * 0.003 }; },
    desloc: (p) => { if (p.y < S * 0.003) p.y = S * 0.003; },
  }), 'brilhante'));
  // erva-cidreira em rodelinhas e lâminas, gengibre em palitos
  for (let i = 0; i < 6; i++) {
    const x = -Lp * 0.3 + i * Lp * 0.12, z = Wp * 0.12 * Math.sin(i * 2.1);
    const y = Hp + S * 0.004;
    const ang = k.r.f(0, PI);
    const p0 = V(x - Math.cos(ang) * 0.012, y, z - Math.sin(ang) * 0.012), p1 = V(x + Math.cos(ang) * 0.012, y + 0.001, z + Math.sin(ang) * 0.012);
    const gengibre = i % 2 === 0;
    out.push(parte(tubo([p0, p0.clone().lerp(p1, 0.5).add(V(0, 0.0015, 0)), p1], {
      raio: gengibre ? 0.0013 : 0.0018, achata: gengibre ? 1 : 0.4, cima: V(0, 1, 0), m: 5, n: 6,
      cor: (xx, yy, zz) => mul(rgb(gengibre ? '#ecd88a' : '#c8d890'), 0.92 + 0.1 * ruido(xx * 900, yy * 900, zz * 900, s + i)),
    }), 'acetinado'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* fatia de terrina de coelho                                           */
/* ------------------------------------------------------------------ */

function fatiaTerrina(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const bacon = (d: number, si: number) => {
    // faixas de bacon: carne rosada e gordura, paralelas à borda
    const f = fr(d / 0.0028 + 0.3 * fbm(d * 400, si, 0, s));
    return mix(rgb('#c8606a'), rgb('#f4e6dc'), suave(0.45, 0.6, f));
  };
  const cor: CorFn = (x, y, z) => {
    const dx = L / 2 - Math.abs(x), dz = W / 2 - Math.abs(z);
    const d = Math.min(dx, dz);
    if (y < H * 0.75) return d < 0.008 ? bacon(d, 1) : mul(c1, 0.9);
    if (d < 0.008) return bacon(d, 2);
    if (d < 0.0092) return rgb('#e0b878');
    // camada do meio com pedaços de lombo de coelho
    const zn = z / (W / 2);
    const camada = Math.abs(zn) < 0.24 + 0.08 * fbm(x * 60, 0, 0, s);
    const pedaco = celula(x * 70, 0, z * 70, s + 8);
    if (camada) {
      const c = mix(c2, mul(c2, 0.88), suave(0.3, 0.8, pedaco) + 0.1 * fbm(x * 300, 0, z * 300, s));
      return mix(c, rgb('#e0b878'), suave(0.88, 0.97, pedaco) * 0.6);
    }
    // recheio moído com pistache e cranberry
    let c = mul(c1, 0.88 + 0.2 * fbm(x * 250, 0, z * 250, s));
    c = mix(c, mul(c1, 0.75), (1 - suave(0.1, 0.25, celula(x * 500, 0, z * 500, s + 2))) * 0.4);
    c = mix(c, rgb('#5e9a3a'), 1 - suave(0.16, 0.24, celula(x * 75, 0, z * 75, s + 3)));
    c = mix(c, rgb('#a01a2a'), 1 - suave(0.13, 0.21, celula(x * 70, 0, z * 70, s + 4)));
    return c;
  };
  const g = chapa(44, 32, (u, v, l) => {
    const x = (u - 0.5) * L, z = (v * W) / 2;
    return [x * (1 + 0.004 * ruido(z * 200, 0, 0, s)), l ? H * (1 + 0.04 * fbm(x * 60, 0, z * 60, s)) : 0, z];
  }, cor);
  return [parte(g, k.ac, true)];
}

/* ------------------------------------------------------------------ */
/* guarnições do capítulo                                               */
/* ------------------------------------------------------------------ */

function cogumeloTorneado(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = R * 1.15;
  const hc = H * 0.32;
  const sulco = (rr: number, ang: number) => {
    // sulcos curvos do centro à borda, como cata-vento
    const q = fr((ang + rr * 2.2) / (TAU / 12));
    return (1 - suave(0.06, 0.2, Math.min(q, 1 - q))) * suave(0.22, 0.4, rr);
  };
  const estrela = (rr: number, ang: number) => {
    const raio = 0.2 * (0.55 + 0.45 * Math.abs(Math.cos(ang * 2.5)));
    return 1 - suave(raio * 0.85, raio, rr);
  };
  out.push(parte(torno({
    caminho: (u) => {
      if (u < 0.12) return [lerp(R * 0.35, R * 0.92, u / 0.12), hc + (u / 0.12) * H * 0.04];
      const q = (u - 0.12) / 0.88;
      return [R * Math.cos(q * PI / 2) ** 0.9, hc + H * 0.04 + (H - hc - H * 0.04) * Math.sin(q * PI / 2)];
    },
    n: 26, m: 72,
    cor: (x, y, z) => {
      const rr = Math.hypot(x, z) / R, ang = Math.atan2(z, x);
      let c = mul(c1, 0.95 + 0.06 * fbm(x * 120, y * 120, z * 120, s));
      c = mix(c, c2, sulco(rr, ang) * 0.45 + estrela(rr, ang) * 0.35);
      return c;
    },
    desloc: (p) => {
      const rr = Math.hypot(p.x, p.z) / R, ang = Math.atan2(p.z, p.x);
      const d = -R * 0.05 * sulco(rr, ang) - R * 0.04 * estrela(rr, ang);
      if (rr > 1e-4) { const k2 = 1 + d / Math.max(R * 0.2, Math.hypot(p.x, p.z)) * 0.5; p.x *= k2; p.z *= k2; }
      p.y += d;
    },
  }), 'fosco', true));
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.3, 0], [R * 0.34, hc * 0.5], [R * 0.38, hc + H * 0.02], [0, hc + H * 0.02]], n: 10, m: 16, cor: (x, y, z) => mul(mix(c1, c2, 0.2), 0.95 + 0.05 * fbm(x * 200, y * 200, z * 200, s)) }), 'fosco'));
  return out;
}

function crouteCoracao(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const L = k.T, W = L * 1.05, H = 0.01;
  const salsa = rgb('#3a7a22');
  const cont = (xd: number, zd: number): [number, number] => {
    const ang = Math.atan2(zd, xd), r = Math.hypot(xd, zd);
    // coração: lobos em -X, ponta em +X
    const th = ang + PI / 2;
    const hx = 16 * Math.sin(th) ** 3;
    const hy = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th);
    return [(-hy / 34) * L * r + L * 0.04, (hx / 34) * W * r];
  };
  const g = placa(28, 28, cont, (xd, zd, r) => H * (0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - r ** 6))) + H * 0.08 * fbm(xd * 8, zd * 8, 0, s), (x, y, z) => {
    // torrada: casca dourada nas bordas, miolo tostado; a ponta coberta de salsa
    const poro = 1 - suave(0.1, 0.35, celula(x * 500, y * 500, z * 500, s));
    let c = mix(c1, c2, suave(-0.3, 0.6, fbm(x * 60, y * 60, z * 60, s)) * 0.6);
    c = mul(c, 1 - poro * 0.18);
    const ponta = suave(L * 0.12, L * 0.26, x) * suave(H * 0.6, H * 0.8, y);
    const fl = 0.75 + 0.35 * ruido(x * 1400, y * 1400, z * 1400, s + 2);
    return mix(c, mul(salsa, fl), ponta);
  });
  return [parte(g, 'fosco', true)];
}

function lequePicles(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = L * 0.13;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ang = (i - (n - 1) / 2) * 0.22;
    const zc = ((i - (n - 1) / 2) / n) * 2 * R;
    const meia = Math.sqrt(Math.max(0.2, 1 - (zc / R) ** 2)) * R;
    const esp = (2 * R) / n * 0.8;
    const g = chapa(26, 5, (u, v, l) => {
      const x = u * L;
      const env = Math.sin(PI * (0.04 + 0.92 * u)) ** 0.45;
      return [x, R - meia * env * 0.9 + (l ? esp : 0) + 0.002 * Math.sin(u * 30) * 0, v * meia * env];
    }, (x, y, z, u, v) => {
      // casca verde-escura com verrugas nas bordas, polpa clara e sementes no meio
      const casca = suave(0.8, 0.95, Math.abs(v)) + suave(0.1, 0.02, u);
      let c = mix(c2, mul(c2, 0.85), suave(0, 0.8, fbm(x * 80, 0, z * 80, s + i)) * 0.4);
      c = mix(c, rgb('#b8b878'), (1 - suave(0.1, 0.25, celula(x * 260, 0, v * 4, s + 2))) * suave(0.5, 0.15, Math.abs(v)) * 0.8);
      return mix(c, mul(c1, 0.9 + 0.15 * ruido(x * 400, y * 400, z * 400, s)), clamp(casca));
    });
    tf(g, [0, 0, 0], [0, ang, 0]);
    out.push(parte(g, 'brilhante', true));
  }
  return out;
}

function rosaTomate(k: Ctx): Parte[] {
  const { c1, ci, s } = k;
  const R = k.T / 2;
  const voltas = 3, hb = R * 0.75, esp = 0.0012;
  const g = chapa(90, 5, (u, v, l) => {
    const th = u * voltas * TAU;
    const r0 = lerp(R * 0.1, R * 0.62, u ** 0.8);
    const y = ((v + 1) / 2) * hb * lerp(1.0, 0.7, u) * (1 + 0.1 * Math.sin(u * 37));
    const r = r0 + y * lerp(0.1, 0.55, u) + (l ? esp : 0);
    return [Math.cos(th) * r, y, Math.sin(th) * r];
  }, (x, y, z, u, v) => {
    // por fora a casca vermelha brilhante (o lado de dentro é repintado abaixo)
    const c = mul(c1, 0.95 + 0.08 * fbm(x * 200, y * 200, z * 200, s) - 0.04 * u);
    return mix(c, mul(c1, 1.2), suave(0.8, 1, v) * 0.3);
  });
  // a cor do lado de dentro: refaz a cor dos vértices de baixo (lado 0) com a polpa
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  const meio = col.count / 2;
  for (let i = meio; i < col.count; i++) {
    const c = mul(ci, 0.9 + 0.1 * ruido(i * 0.37, 0, 0, s));
    col.setXYZ(i, clamp(c[0]), clamp(c[1]), clamp(c[2]));
  }
  return [parte(g, 'brilhante', true)];
}

function barquinhoEndivia(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * 0.36;
  const g = chapa(24, 10, (u, v, l) => {
    const env = Math.sin(PI * (0.08 + 0.9 * u) ** 0.9) ** 0.7;
    const w = (W / 2) * env;
    const z = v * w;
    const y = W * 0.35 * Math.abs(v) ** 1.7 * env + L * 0.06 * u * u + (l ? 0.0012 : 0);
    return [u * L - L / 2, y, z];
  }, (x, y, z, u, v) => {
    // branca na base, verde-amarelada na ponta, nervuras finas
    const nerv = Math.abs(Math.sin(v * 9 + u * 2)) ** 14 * 0.3;
    return mul(mix(mix(c1, c2, suave(0.6, 1, u)), rgb('#fffff4'), nerv), 0.95 + 0.06 * fbm(x * 100, y * 100, z * 100, s));
  });
  out.push(parte(g, 'acetinado', true));
  // concassée de tomate na base
  for (let i = 0; i < 9; i++) {
    const c = 0.0055;
    const x = -L * 0.28 + (i % 3) * c * 1.1 + k.r.f(-0.001, 0.001), z = (Math.floor(i / 3) - 1) * c * 1.05;
    const cubo = elipsoide(c * 0.6, c * 0.5, c * 0.6, (xx, yy, zz) => mix(rgb('#d82a1a'), rgb('#e8604a'), suave(0, 0.8, fbm(xx * 400, yy * 400, zz * 400, s + i)) * 0.5), 4, 6, (t, a) => 1 + 0.25 * Math.abs(Math.cos(a * 2)) ** 4);
    tf(cubo, [x, W * 0.08 + c * 0.4 + (i > 5 ? c * 0.5 : 0), z], [k.r.f(0, 1), k.r.f(0, 1), 0]);
    out.push(parte(cubo, 'brilhante'));
  }
  return out;
}

function florFrita(k: Ctx): Parte[] {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const Lp = L * 0.7;
  // cinco pétalas fechadas em botão torcido, bordas tostadas e franzidas
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * TAU;
    const g = folha(Lp, Lp * 0.42, c1, c2, {
      contorno: contornos.gota, concha: 0.9, curva: 0.05, n: 14, m: 8, ondula: 0.04,
      cor: (x, y, z) => mul(mix(c1, c2, suave(Lp * 0.55, Lp, x) * 0.8 + suave(0.2, 0.8, fbm(x * 90, y * 90, z * 90, s + i)) * 0.25), 0.94 + 0.1 * ruido(x * 500, y * 500, z * 500, s)),
    });
    tf(g, [-L * 0.2, 0, 0], [ang, 0, 0]);
    g.translate(0, Math.cos(ang) * L * 0.035, Math.sin(ang) * L * 0.035);
    g.rotateX(0.25 * i);
    out.push(parte(g, 'fosco', true));
  }
  // cálice verde e cabinho
  out.push(parte(tf(elipsoide(L * 0.07, L * 0.055, L * 0.055, (x, y, z) => mul(c3, 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, s)), 6, 10), [-L * 0.22, 0, 0]), 'acetinado'));
  out.push(parte(tubo([V(-L * 0.27, 0, 0), V(-L * 0.4, -L * 0.01, 0), V(-L * 0.5, 0, L * 0.02)], { raio: L * 0.018, m: 6, n: 8, cor: () => c3 }), 'acetinado'));
  return out;
}

function peraRecheada(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * 1.25;
  const hc = H * 0.62;
  const raio = (h: number) => {
    const q = h / H;
    return R * (Math.sin(PI * clamp(q / 0.55) * 0.5 + 0.0) ** 0.6 * (q < 0.55 ? 1 : lerp(1, 0.38, suave(0.55, 0.9, q))) * Math.sqrt(suave(1.0, 0.9, q)) * 0.98 + 0.002);
  };
  const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(-0.2, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.35), 0.94 + 0.08 * fbm(x * 150, y * 150, z * 150, s));
  const corCorte: CorFn = (x, y, z) => mix(mul(c1, 1.08), rgb('#f6ecc8'), 0.4 + 0.1 * ruido(x * 300, y * 300, z * 300, s));
  // corpo até o corte, com a cova do miolo cheia de geleia de groselha
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) { const h = (i / 16) * hc; pts.push([raio(h), h]); }
  pts.unshift([0, 0]);
  pts.push([R * 0.25, hc]);
  pts.push([0, hc + R * 0.05]);
  out.push(parte(torno({ caminho: pts, n: 26, m: 28, cor: (x, y, z) => (y > hc - 0.0008 ? (Math.hypot(x, z) < R * 0.3 ? mul(rgb('#b8101e'), 0.9 + 0.2 * ruido(x * 400, 0, z * 400, s)) : corCorte(x, y, z, 0, 0)) : cor(x, y, z, 0, 0)) }), 'brilhante', true));
  // tampa recolocada levemente torta, com o cabinho
  const tp: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 10; i++) { const h = hc + (i / 10) * (H - hc); tp.push([raio(h), h - hc]); }
  tp.push([0, H - hc + 0.001]);
  const tampa = torno({ caminho: tp, n: 16, m: 24, cor: (x, y, z) => (y < 0.0008 ? corCorte(x, y, z, 0, 0) : cor(x, y + hc, z, 0, 0)) });
  tf(tampa, [R * 0.04, hc + 0.0035, 0], [0.08, 0, -0.1]);
  out.push(parte(tampa, 'brilhante'));
  out.push(parte(tubo([V(R * 0.02, H + 0.002, 0), V(R * 0.08, H + R * 0.4, 0), V(R * 0.2, H + R * 0.6, 0)], { raio: R * 0.05, m: 6, n: 6, cor: () => rgb('#5a3a1a') }), 'fosco'));
  // a geleia aparece na fresta entre a pera e a tampa
  const ra = raio(hc) * 0.97;
  const anel: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; anel.push(V(Math.cos(a) * ra, hc + 0.0018 + 0.0008 * Math.sin(a * 3), Math.sin(a) * ra)); }
  out.push(parte(tubo(anel, { raio: 0.0024, m: 6, n: 36, fechado: true, cor: (x, y, z) => mul(rgb('#b0101e'), 0.9 + 0.2 * ruido(x * 500, y * 500, z * 500, s)) }), 'brilhante'));
  // e escorre um pouco pela fresta
  out.push(parte(tubo([V(-R * 0.4, hc + 0.0015, R * 0.3), V(-R * 0.5, hc + 0.001, R * 0.38), V(-R * 0.56, hc - 0.004, R * 0.42)], { raio: R * 0.06, m: 6, n: 6, cor: () => rgb('#a80e1c') }), 'brilhante'));
  return out;
}

/* ------------------------------------------------------------------ */
/* lote                                                                 */
/* ------------------------------------------------------------------ */

const FRANGO = { c1: '#e8c4a6', c2: '#e0a898', ci: '#ecc0b0', cc: '#d0904a' };

export const LOTE: Lote = {
  'frango-amarrado': {
    visual: { f: 'ave', v: 'frango-amarrado', t: 0.2, a: 0.48, l: 0.6, ...FRANGO, d: 'coxagrossa' },
    gerar: (k) => aveFechada(k, 'barbante'),
  },
  'peru-costurado': {
    visual: { f: 'ave', v: 'peru-costurado', t: 0.45, a: 0.52, l: 0.64, c1: '#e4c2a2', c2: '#d8a490', ci: '#e8c0b0', cc: '#b8742e', d: 'coxagrossa' },
    gerar: (k) => aveFechada(k, 'costura'),
  },
  'frango-com-espetos': {
    visual: { f: 'ave', v: 'frango-com-espetos', t: 0.28, a: 0.48, l: 0.62, c1: '#e2bc98', c2: '#d89c88', ci: '#e8b8a8', cc: '#c8823a' },
    gerar: (k) => aveFechada(k, 'espetos'),
  },
  'frango-borboleta': {
    visual: { f: 'ave', v: 'frango-borboleta', t: 0.24, a: 0.22, l: 0.85, ...FRANGO },
    gerar: (k) => aveAchatada(k, false),
  },
  'frango-grelhado-meia': {
    visual: { f: 'peca_ave', v: 'frango-grelhado-meia', t: 0.24, a: 0.22, l: 0.85, c1: '#d8994a', c2: '#8a4a1c', ci: '#f0dcc0', cc: '#c07a3a', ac: 'brilhante' },
    gerar: (k) => aveAchatada(k, true),
  },
  'escalope-de-frango': {
    visual: { f: 'peca_ave', v: 'escalope-de-frango', t: 0.17, a: 0.045, l: 0.7, c1: '#eebcb0', c2: '#f4d2c8', ci: '#eebcb0', cc: '#e0b070', ac: 'umido' },
    gerar: (k) => escalope(k, false),
  },
  'schnitzel-de-frango': {
    visual: { f: 'peca_ave', v: 'schnitzel-de-frango', t: 0.19, a: 0.07, l: 0.72, c1: '#d89a48', c2: '#a8601e', ci: '#f2e6d4', cc: '#c8843a', ac: 'fosco' },
    gerar: (k) => escalope(k, true),
  },
  'espetinho-de-frango': {
    visual: { f: 'peca_ave', v: 'espetinho-de-frango', t: 0.24, a: 0.2, l: 0.2, c1: '#eaa890', c2: '#d8784a', ci: '#f0c4b0', cc: '#c8783a', ac: 'umido' },
    gerar: espetinhoFrango,
  },
  'sate-de-frango': {
    visual: { f: 'peca_ave', v: 'sate-de-frango', t: 0.2, a: 0.12, l: 0.12, c1: '#c8862a', c2: '#7a3e14', ci: '#f2dcc0', cc: '#a8601e', ac: 'brilhante' },
    gerar: sate,
  },
  'peito-de-pato-riscado': {
    visual: { f: 'peca_ave', v: 'peito-de-pato-riscado', t: 0.2, a: 0.2, l: 0.48, c1: '#8a2228', c2: '#f2e2c6', ci: '#a8382e', cc: '#a8602a' },
    gerar: magretRiscado,
  },
  'pato-em-chaudfroid': {
    visual: { f: 'peca_ave', v: 'pato-em-chaudfroid', t: 0.16, a: 0.1, l: 0.9, c1: '#c8786a', c2: '#efe6cf', ci: '#c8786a', cc: '#c8786a', n: 5, ac: 'brilhante' },
    gerar: patoChaudfroid,
  },
  'frango-desossado-aberto': {
    visual: { f: 'ave', v: 'frango-desossado-aberto', t: 0.26, a: 0.1, l: 1.0, c1: '#ecd0b4', c2: '#d88c84', ci: '#eebcb0', cc: '#d0904a' },
    gerar: aveDesossada,
  },
  'ballotine-amarrada': {
    visual: { f: 'ave', v: 'ballotine-amarrada', t: 0.26, a: 0.33, l: 0.36, c1: '#ecccae', c2: '#e0a898', ci: '#ecc0b0', cc: '#d0904a' },
    gerar: ballotineRolo,
  },
  'fatias-de-ballotine': {
    visual: { f: 'peca_ave', v: 'fatias-de-ballotine', t: 0.18, a: 0.3, l: 0.55, c1: '#e8cf9e', c2: '#dcb8a4', ci: '#f4e8d6', cc: '#e0b880', n: 5 },
    gerar: fatiasBallotine,
  },
  'rodelas-de-roulade': {
    visual: { f: 'peca_ave', v: 'rodelas-de-roulade', t: 0.13, a: 0.3, l: 0.6, c1: '#f4e8d8', c2: '#f6f2e6', ci: '#f4e8d8', cc: '#e8d0a8', n: 4 },
    gerar: rodelasRoulade,
  },
  'peito-em-folha-de-bananeira': {
    visual: { f: 'peca_ave', v: 'peito-em-folha-de-bananeira', t: 0.24, a: 0.2, l: 1, c1: '#7a2a16', c2: '#a8502a', ci: '#f2e6d4', cc: '#7a2a16', ac: 'brilhante' },
    gerar: pacoteBananeira,
  },
  'fatia-de-terrina-de-coelho': {
    visual: { f: 'barra', v: 'fatia-de-terrina-de-coelho', t: 0.11, a: 0.15, l: 0.68, c1: '#d8a898', c2: '#ecd0c4', ci: '#d8a898', cc: '#d8a898' },
    gerar: fatiaTerrina,
  },
  'cogumelo-torneado': {
    visual: { f: 'cogumelo', v: 'cogumelo-torneado', t: 0.045, c1: '#f2ece0', c2: '#b8a890', ci: '#f4eee4', cc: '#c8a878', ac: 'fosco' },
    gerar: cogumeloTorneado,
  },
  'croute-de-pao-coracao': {
    visual: { f: 'pao', v: 'croute-de-pao-coracao', t: 0.06, a: 0.18, l: 1, c1: '#d8a050', c2: '#9a5a20', ci: '#f0dca8', cc: '#b87a34', ac: 'fosco' },
    gerar: crouteCoracao,
  },
  'pepino-em-conserva-leque': {
    visual: { f: 'fuso', v: 'pepino-em-conserva-leque', t: 0.08, a: 0.28, l: 0.6, c1: '#3e5a1e', c2: '#b8b86a', ci: '#c8c47a', cc: '#8a8a4a', ac: 'brilhante' },
    gerar: lequePicles,
  },
  'tomate-rosa-de-casca': {
    visual: { f: 'esferoide', v: 'tomate-rosa-de-casca', t: 0.055, a: 0.45, c1: '#d8281e', c2: '#c8401e', ci: '#f07a5a', cc: '#a8321e', ac: 'brilhante' },
    gerar: rosaTomate,
  },
  'endivia-barquinho': {
    visual: { f: 'folhoso', v: 'endivia-barquinho', t: 0.11, a: 0.2, l: 0.36, c1: '#f4f2e0', c2: '#d8e090', ci: '#f6f4e8', cc: '#d8c880' },
    gerar: barquinhoEndivia,
  },
  'endivia-roxa': {
    visual: { f: 'folhoso', v: 'endivia', t: 0.14, l: 0.3, c1: '#b8405e', c2: '#6e1030', ci: '#f4e6ea', cc: '#7a3a3a' },
    gerar: (k) => gFolhoso(k),
  },
  'abobrinha-flor-frita': {
    visual: { f: 'folhoso', v: 'abobrinha-flor-frita', t: 0.1, a: 0.3, l: 0.3, c1: '#f0a020', c2: '#b8601a', c3: '#4a7a2a', ci: '#f8d070', cc: '#c87a1e', ac: 'fosco' },
    gerar: florFrita,
  },
  'pera-recheada': {
    visual: { f: 'esferoide', v: 'pera-recheada', t: 0.075, a: 1.25, c1: '#f0dc9a', c2: '#e0b868', ci: '#f6ecc8', cc: '#e0c070', ac: 'brilhante' },
    gerar: peraRecheada,
  },
};

export type { Gerador };
