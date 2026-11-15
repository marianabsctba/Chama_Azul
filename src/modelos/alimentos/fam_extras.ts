// Alimentos que as técnicas pedem e não tinham forma própria: rizomas
// (gengibre, galanga, raiz de wasabi) e variantes novas encaixadas nas
// famílias que já existem (bacon em carne, patê e polenta em barra, omelete e
// frittata em pão chato, falafel em massa em bola, foie gras em miúdo, pudim
// Yorkshire em choux, cranberry em baga, baunilha em vagem, gergelim em monte).
// `comVariantes` liga essas variantes ao gerador original sem mexer nele.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, contornos, caule, type Gerador } from './pecas';
import { fruto } from './fam_vegetais';

/** Usa o gerador extra quando a variante for dele; senão, o gerador original da família. */
export function comVariantes(base: Gerador, extras: Record<string, Gerador>): Gerador {
  return (k) => (extras[k.v.v] ?? base)(k);
}

/* ------------------------------------------------------------------ */
/* Laje: chapa fina em grade (fatias de bacon)                          */
/* ------------------------------------------------------------------ */

/**
 * Chapa com face de cima e de baixo em grade nx por nz, costurada na borda.
 * `pos(u, v, lado)` devolve o ponto (u de 0 a 1 ao longo de X, v de -1 a 1 em Z,
 * lado 1 em cima e 0 embaixo). A cor recebe u no lugar de t e v no lugar do ângulo.
 */
function laje(nx: number, nz: number, pos: (u: number, v: number, lado: number) => [number, number, number], cor: CorFn): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const por = (nz + 1);
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
  // contorno no sentido que deixa a borda virada para fora
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

/** Fração do comprimento de arco de um caminho até o vértice `ate`. */
function fracArco(c: [number, number][], ate: number): number {
  let tot = 0, parc = 0;
  for (let i = 1; i < c.length; i++) {
    const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    tot += d;
    if (i <= ate) parc += d;
  }
  return parc / Math.max(1e-9, tot);
}

/* ------------------------------------------------------------------ */
/* rizomas: gengibre, galanga e raiz de wasabi                          */
/* ------------------------------------------------------------------ */

interface Dedo {
  /** Posição ao longo do eixo principal (0 a 1). */
  u: number;
  /** Ângulo no plano XZ a partir de +X. */
  ang: number;
  /** Comprimento relativo a L. */
  c: number;
  /** Raio relativo ao do eixo principal. */
  r: number;
  /** Quanto a ponta sobe (relativo ao comprimento). */
  sobe: number;
}

export const gRizoma: Gerador = (k) => {
  if (k.v.v === 'wasabi') return wasabiRaiz(k);
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const galanga = k.v.v === 'galanga';
  const L = k.T, H = L * k.A;
  const passo = L * (galanga ? 0.06 : 0.085);
  const achata = galanga ? 1.15 : 1.4;
  const rm = H / 2;
  // anel de nó: fino e escuro, com leve estrangulamento na malha
  const dAnel = (t: number, a: number, comp: number, si: number) => (t * comp) / passo + 0.18 * Math.sin(a + si * 1.7) + si * 0.37;
  const anel = (d: number) => Math.abs(Math.cos(PI * d)) ** (galanga ? 9 : 24);
  const corSeg = (comp: number, ponta: boolean, si: number): CorFn => (x, y, z, t, a) => {
    const d = dAnel(t, a, comp, si);
    let c = mul(c1, 0.9 + 0.16 * fbm(x * 90, y * 90, z * 90, s + si));
    // estrias finas no sentido do rizoma e manchas de casca mais seca
    c = mul(c, 1 - 0.08 * Math.abs(Math.sin(a * 11 + 3 * fbm(t * 4, x * 30, z * 30, s))) ** 3);
    c = mix(c, mul(c2, 1.25), suave(0.35, 0.9, fbm(x * 45, y * 45, z * 45, s + 7)) * (galanga ? 0.18 : 0.28));
    // no gengibre os anéis são finos e somem aqui e ali
    const falha = galanga ? 1 : suave(-0.3, 0.2, fbm(d * 1.7, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s + si));
    c = mix(c, c2, anel(d) * (galanga ? 1 : 0.8) * falha);
    // escamas claras logo atrás de cada anel (galanga tem bem marcado)
    if (galanga) c = mix(c, mul(c1, 1.12), suave(0.55, 0.95, ((d % 1) + 1) % 1) * 0.35);
    if (ponta) c = mix(c, c3, suave(1 - fPonta * 0.7, 1, t) * 0.6);
    return c;
  };
  let fPonta = 0.2;
  /** Fecha a ponta em meia esfera ao longo da fração f final (ou inicial) do segmento. */
  const calota = (t: number, f: number) => (f > 0 ? Math.sqrt(Math.max(0.03, 1 - (Math.max(0, t - (1 - f)) / f) ** 2)) : 1);
  const seg = (pts: THREE.Vector3[], r0: number, r1: number, ponta: boolean, si: number, inicioRedondo = false) => {
    const comp = new THREE.CatmullRomCurve3(pts).getLength();
    const n = Math.max(16, Math.min(52, Math.round(comp / (passo / 6))));
    const fF = Math.min(0.45, (r1 * 1.1) / comp), fI = inicioRedondo ? Math.min(0.45, (r0 * 1.1) / comp) : 0;
    fPonta = fF;
    return tubo(pts, {
      // gomo estufado no meio e ponta arredondada, como dedo de gengibre
      raio: (t) => lerp(r0, r1, t) * (1 + 0.14 * Math.sin(PI * t)) * calota(t, fF) * calota(1 - t, fI),
      achata, cima: V(0, 1, 0), m: 16, n,
      mod: (t, a) => 1 + 0.08 * fbm(t * comp / passo * 0.5, Math.cos(a) * 1.3, Math.sin(a) * 1.3, s + si) - (galanga ? 0.018 : 0.02) * anel(dAnel(t, a, comp, si)),
      cor: corSeg(comp, ponta, si),
    });
  };
  // eixo principal levemente curvo
  const x0 = -L / 2 + rm * 0.8, x1 = L / 2 - rm * 1.2;
  const eixo = [V(x0, rm, 0), V(lerp(x0, x1, 0.35), rm * 1.05, L * 0.03), V(lerp(x0, x1, 0.7), rm * 0.98, -L * 0.02), V(x1, rm * 0.95, L * 0.01)];
  const curva = new THREE.CatmullRomCurve3(eixo);
  out.push(parte(seg(eixo, rm, rm * 0.9, true, 0, true), k.ac, true));
  const dedos: Dedo[] = galanga
    ? [
      { u: 0.3, ang: 1.05, c: 0.32, r: 0.85, sobe: 0.05 },
      { u: 0.62, ang: -0.85, c: 0.3, r: 0.8, sobe: 0.08 },
      { u: 0.9, ang: 0.6, c: 0.22, r: 0.75, sobe: 0.15 },
    ]
    : [
      { u: 0.16, ang: 1.25, c: 0.36, r: 0.66, sobe: 0.0 },
      { u: 0.4, ang: -1.1, c: 0.42, r: 0.7, sobe: 0.04 },
      { u: 0.58, ang: 0.9, c: 0.32, r: 0.62, sobe: 0.3 },
      { u: 0.82, ang: -0.6, c: 0.3, r: 0.6, sobe: 0.1 },
      { u: 0.97, ang: 0.4, c: 0.22, r: 0.58, sobe: 0.2 },
    ];
  dedos.forEach((d, i) => {
    const p0 = curva.getPointAt(d.u);
    const len = L * d.c * k.r.f(0.9, 1.1);
    const ang = d.ang + k.r.f(-0.12, 0.12);
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const rf = rm * d.r;
    const pm = p0.clone().addScaledVector(dir, len * 0.5);
    const pf = p0.clone().addScaledVector(dir, len);
    pm.y = lerp(p0.y, rf, 0.6) + len * d.sobe * 0.35;
    pf.y = rf + len * d.sobe;
    // curva leve para o dedo não sair reto
    pm.addScaledVector(V(-dir.z, 0, dir.x), len * 0.08 * (i % 2 ? 1 : -1));
    out.push(parte(seg([p0.clone().addScaledVector(dir, -rm * 0.2), pm, pf], rf * 1.05, rf * 0.92, true, i + 1), k.ac, true));
  });
  return out;
};

/** Raiz de wasabi: bastão verde coberto de nós, mais grosso no topo, com talos cortados. */
function wasabiRaiz(k: Parameters<Gerador>[0]): Parte[] {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = (L * k.L) / 2;
  const xb = L * 0.36; // fim do corpo, depois vêm os talos
  const comp = xb + L / 2;
  const Nt = comp / (R * 0.55), Na = 2.1;
  const raio = (t: number) => R * lerp(0.5, 1, t ** 0.75) * Math.sqrt(suave(0, 0.07, t)) * (0.35 + 0.65 * Math.sqrt(suave(1.0, 0.93, t)));
  const no = (t: number, a: number) => celula(t * Nt, Math.cos(a) * Na, Math.sin(a) * Na, s);
  const cor: CorFn = (x, y, z, t, a) => {
    const c0 = no(t, a);
    let c = mix(mul(c1, 1.12), mul(c1, 0.82), suave(0.2, 0.75, c0));
    // cicatrizes das folhas nas bordas dos nós e ponta da raiz mais amarronzada
    c = mix(c, c2, suave(0.78, 0.97, c0) * 0.85);
    c = mix(c, [0.36, 0.3, 0.16], suave(0.35, 0.0, t) * 0.55);
    return mul(c, 1 + 0.06 * fbm(x * 200, y * 200, z * 200, s));
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: xb, n: 48, m: 30, cor,
    perfil: (t) => { const r = raio(t); return { ry: r, rz: r * 0.96, cy: r, cz: R * 0.06 * Math.sin(PI * t * 1.3) }; },
    mod: (t, a) => 1 + 0.12 * (1 - suave(0.1, 0.75, no(t, a))) * suave(0.03, 0.15, t) + 0.03 * fbm(t * 8, Math.cos(a), Math.sin(a), s),
  }), 'acetinado', true));
  // talos cortados saindo da coroa
  const nt = 6;
  for (let i = 0; i < nt; i++) {
    const ang = (i / nt) * TAU + k.r.f(-0.25, 0.25);
    const rr = R * 0.45 * k.r.f(0.5, 1);
    const base = V(xb - R * 0.25, R + Math.cos(ang) * rr * 0.9, Math.sin(ang) * rr);
    const dir = V(1, Math.cos(ang) * 0.45 + 0.1, Math.sin(ang) * 0.45).normalize();
    const lt = (L / 2 - xb) * k.r.f(0.75, 1.05) + R * 0.2;
    const rt = R * k.r.f(0.16, 0.22);
    out.push(parte(tubo([base, base.clone().addScaledVector(dir, lt * 0.5), base.clone().addScaledVector(dir, lt)], {
      raio: (t) => rt * (1 + 0.25 * (1 - t)), m: 9, n: 6, pontaRedonda: false,
      cor: (x, y, z, t) => (t > 0.96 ? mix(ci, mul(ci, 0.85), ruido(x * 900, y * 900, z * 900, s)) : mul(mix(c3, c1, suave(0.4, 0, t) * 0.6), 1 + 0.08 * Math.sin(Math.atan2(z, y) * 9))),
    }), 'acetinado'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* bacon (família carne)                                                */
/* ------------------------------------------------------------------ */

/** Quanto de gordura há na posição transversal v (de -1 a 1), com a borda de gordura em +1. */
function bandasBacon(v: number): number {
  const faixas: [number, number][] = [[-0.62, -0.54], [-0.04, 0.06], [0.52, 1.2]];
  let g = 0;
  for (const [a, b] of faixas) g = Math.max(g, suave(a - 0.05, a + 0.05, v) * suave(b + 0.05, b - 0.05, v));
  return g;
}

export const gBacon: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, Hs = Math.max(0.0015, L * k.A);
  const nf = k.v.n ?? 3;
  const lam = L / 3.4;
  for (let f = 0; f < nf; f++) {
    const sf = s + f * 13;
    const zc = (f - (nf - 1) / 2) * W * 0.82;
    const y0 = f * Hs * 1.35;
    const meia = (u: number) => (W / 2) * (1 + 0.05 * fbm(u * 6, f * 3.1, 0, sf));
    const onda = (x: number, v: number) => Hs * 1.6 * (0.5 + 0.5 * Math.sin((x / lam) * TAU + 0.6)) + Hs * 0.9 * Math.sin((x / lam) * TAU * 2.3 + f) * v * v * (v > 0 ? 1 : 0.4);
    const pos = (u: number, v: number, lado: number): [number, number, number] => {
      const x = lerp(-L / 2, L / 2, u) + L * 0.012 * fbm(v * 2, f, 0, sf + 3) * (u < 0.05 || u > 0.95 ? 1 : 0.2);
      const h = Hs * (0.7 + 0.3 * (1 - v ** 4));
      const z = zc + v * meia(u);
      return [x, y0 + onda(x, v) + lado * h, z];
    };
    const cor: CorFn = (x, y, z, u, v) => {
      const vv = v + 0.1 * fbm(x * 14, f * 2.3, 0, sf) + 0.05 * fbm(x * 60, f, 0, sf + 1);
      const gord = bandasBacon(vv);
      // carne com fibra e tons de defumado; gordura com veios rosados
      let carne = mul(c1, 0.86 + 0.18 * fbm(x * 70, z * 70, f, sf));
      carne = mix(carne, mul(c1, 0.72), Math.abs(Math.sin(x * 260 + vv * 6)) ** 6 * 0.4);
      const gor = mix(c2, mix(c2, c1, 0.35), suave(0.2, 0.9, fbm(x * 50, z * 50, f, sf + 5)) * 0.35);
      let c = mix(carne, gor, gord);
      // couro defumado na borda de gordura e pontas um pouco mais escuras
      c = mix(c, c3, suave(0.9, 1.0, v) * 0.75);
      c = mul(c, 1 - 0.1 * suave(0.04, 0, Math.min(u, 1 - u)));
      return c;
    };
    out.push(parte(laje(36, 12, pos, cor), k.ac, true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* foie gras (família miúdo)                                            */
/* ------------------------------------------------------------------ */

export const gFoieGras: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mix(c1, c3, suave(0.0, 0.8, fbm(x * 18, y * 18, z * 18, s)) * 0.45);
    // veias rosadas finas e manchinhas de sangue bem discretas
    const n = fbm(x * 30 + 2, y * 30, z * 30, s + 4);
    c = mix(c, mul(c2, 0.9), (1 - suave(0.0, 0.035, Math.abs(n))) * 0.6);
    c = mix(c, c2, suave(0.45, 0.8, fbm(x * 60, y * 60, z * 60, s + 9)) * 0.3);
    return mul(c, 1 + 0.03 * fbm(x * 150, y * 150, z * 150, s));
  };
  const lobo = (x0: number, x1: number, rz: number, ry: number, cz: number, giro: number, si: number) => {
    const g = corpo({
      x0, x1, n: 30, m: 30, cor,
      perfil: (t) => {
        // gota arredondada: larga perto de x0, afinando para x1
        // lobo cheio e arredondado, afinando pouco: ponta rombuda
        const e = Math.sin(PI * clamp(t) ** 0.85) ** 0.45;
        const af = lerp(1, 0.8, suave(0.3, 1, t));
        return { ry: ry * e * af, rz: rz * e * lerp(1, 0.72, suave(0.2, 1, t)), cy: ry * e * af * 0.8, cz: rz * 0.22 * Math.sin(PI * t) };
      },
      mod: (t, a) => 1 + 0.03 * fbm(t * 3, Math.cos(a) * 1.2, Math.sin(a) * 1.2, s + si),
      desloc: (p) => { if (p.y < 0) p.y *= 0.15; },
    });
    g.translate(-x0, 0, 0);
    g.rotateY(giro);
    g.translate(x0, 0, cz);
    return g;
  };
  out.push(parte(lobo(-L / 2, L / 2, W * 0.5, H * 0.55, -W * 0.14, 0.06, 0), 'umido', true));
  out.push(parte(lobo(-L / 2 + L * 0.03, -L / 2 + L * 0.74, W * 0.36, H * 0.45, W * 0.3, -0.22, 3), 'umido', true));
  return out;
};

/* ------------------------------------------------------------------ */
/* patê em terrina e polenta firme (família barra)                      */
/* ------------------------------------------------------------------ */

export const gTerrina: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const Hb = Math.max(0.003, H * 0.07);
  const Hp = H - Hb * 0.7;
  const fp = 1 / Math.max(0.002, L * 0.012);
  const pate = (base: RGB): CorFn => (x, y, z) => {
    let c = mul(base, 0.92 + 0.12 * fbm(x * 40, y * 40, z * 40, s));
    // pontinhos de gordura clara e de pimenta, bem finos
    c = mix(c, mix(base, [0.95, 0.88, 0.78], 0.6), (1 - suave(0.08, 0.16, celula(x * fp, y * fp, z * fp, s))) * 0.6);
    c = mix(c, mul(base, 0.45), (1 - suave(0.05, 0.1, celula(x * fp * 0.7, y * fp * 0.7, z * fp * 0.7, s + 3))) * 0.6);
    // a parte de cima, sob a manteiga, escurece um pouco
    return mul(c, 1 - 0.12 * suave(Hp * 0.75, Hp, y));
  };
  const perfil = (hy: number, cy: number, enc: number) => (t: number) => {
    const ch = 1 - enc * (1 - suave(0, 0.05, Math.min(t, 1 - t)));
    return { ry: (hy / 2) * ch, rz: (W / 2) * ch, cy };
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 22, m: 40, exp: 7, tampa: true, aneisTampa: 5, cor: pate(c1), corTampa: pate(ci),
    perfil: perfil(Hp, Hp / 2, 0.06),
    mod: (t, a) => 1 + 0.01 * fbm(t * 6, Math.cos(a), Math.sin(a), s),
  }), k.ac, true));
  // camada de manteiga clarificada por cima, com bordinha de menisco
  const mant: CorFn = (x, y, z) => mix(mul(c2, 1.04), mul(c2, 0.86), suave(0.2, 0.9, fbm(x * 25, 0, z * 25, s + 2)) * 0.6);
  out.push(parte(corpo({
    x0: -L / 2 + 0.0015, x1: L / 2 - 0.0015, n: 18, m: 36, exp: 6, tampa: true, cor: mant,
    perfil: (t) => { const q = perfil(Hb, Hp + Hb / 2 - Hb * 0.3, 0.04)(t); return { ...q, rz: q.rz * 0.985 }; },
    desloc: (p) => { if (p.y > Hp + Hb * 0.2) p.y += Hb * 0.25 * fbm(p.x * 30, 0, p.z * 30, s + 5); },
  }), 'brilhante', true));
  // folha de louro e grãos de pimenta presos na manteiga
  const lf = Math.min(L * 0.45, 0.075);
  const fl = folha(lf, lf * 0.33, c3, mix(c3, [0.8, 0.85, 0.55], 0.5), { contorno: contornos.lanca, esp: 0.0006, curva: 0.03, concha: 0.05, n: 14, m: 8, s });
  tf(fl, [-lf * 0.55, H + 0.0004, -W * 0.06], [0, 0.35, 0]);
  out.push(parte(fl, 'acetinado'));
  const pims: [number, number, RGB][] = [[L * 0.12, W * 0.12, [0.55, 0.12, 0.12]], [L * 0.2, -W * 0.08, [0.12, 0.08, 0.06]], [-L * 0.2, W * 0.2, [0.6, 0.15, 0.14]]];
  for (const [x, z, c] of pims) {
    const r = Math.min(0.0028, L * 0.02);
    out.push(parte(tf(elipsoide(r, r, r, (px, py, pz) => mul(c, 0.85 + 0.3 * ruido(px * 2000, py * 2000, pz * 2000, s)), 5, 8, (t, a) => 1 + 0.08 * Math.sin(a * 5) * Math.sin(t * PI)), [x, H - r * 0.3, z]), 'fosco'));
  }
  return out;
};

export const gPolenta: Gerador = (k) => {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const fg = 1 / Math.max(0.0015, L * 0.02);
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.9 + 0.2 * fbm(x * 30, y * 30, z * 30, s) + 0.12 * ruido(x * 250, y * 250, z * 250, s + 1));
    // grãos de fubá visíveis, uns mais escuros e outros mais claros
    c = mix(c, c2, (1 - suave(0.12, 0.3, celula(x * fg, y * fg, z * fg, s))) * 0.75);
    c = mix(c, mul(c1, 1.15), (1 - suave(0.1, 0.25, celula(x * fg * 1.4, y * fg * 1.4, z * fg * 1.4, s + 2))) * 0.6);
    // marcas suaves da espátula ao alisar
    c = mul(c, 1 - 0.05 * Math.abs(Math.sin(x * 90 + 3 * fbm(x * 8, 0, z * 8, s))) ** 4 * (y > H * 0.9 ? 1 : 0));
    return c;
  };
  // grade densa para os grãos aparecerem; borda chanfrada e arredondada
  const bev = H * 0.18;
  const pos = (u: number, v: number, lado: number): [number, number, number] => {
    const dE = Math.min(Math.min(u, 1 - u) * L, (1 - Math.abs(v)) * (W / 2));
    const borda = 1 - suave(0, bev * 2.2, dE);
    const ent = bev * 0.6 * borda;
    const x = lerp(-L / 2, L / 2, u) + (u < 0.5 ? ent : -ent) * (Math.min(u, 1 - u) * L <= dE + 1e-9 ? 1 : 0);
    const z = v * (W / 2) - Math.sign(v) * ent * ((1 - Math.abs(v)) * (W / 2) <= dE + 1e-9 ? 1 : 0);
    const y = lado ? H - bev * borda ** 1.5 + H * 0.025 * fbm(x * 25, 0, z * 25, s + 4) * (1 - borda) : bev * 0.3 * borda;
    return [x, y, z];
  };
  return [parte(laje(40, Math.max(12, Math.round(40 * k.L)), pos, cor), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* omelete fina e frittata (família pão chato)                          */
/* ------------------------------------------------------------------ */

export const gOmelete: Gerador = (k) => {
  const { c1, c2, s } = k;
  const L = k.T, R = L / 2, H = Math.max(0.003, L * k.A);
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    let c = mul(c1, 0.96 + 0.08 * fbm(x * 60, 0, z * 60, s));
    // manchas douradas de frigideira, mais na borda e na face de baixo
    const dour = suave(-0.1, 0.5, fbm(x * 26, 0, z * 26, s + 2)) * 0.7 + suave(0.8, 1, r) * 0.45 + (y < H * 0.4 ? 0.4 : 0);
    c = mix(c, c2, clamp(dour) * 0.85);
    // bolhinhas claras
    c = mix(c, mul(c1, 1.12), (1 - suave(0.05, 0.14, celula(x * 260, 0, z * 260, s))) * 0.5);
    return c;
  };
  return [parte(torno({
    caminho: [[0, 0], [R * 0.85, 0], [R * 0.97, H * 0.25], [R, H * 0.55], [R * 0.96, H * 0.95], [R * 0.6, H * 1.05], [0, H * 1.1]],
    n: 44, m: 60, cor,
    mod: (t, a) => 1 + 0.03 * fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0, s) + 0.01 * Math.sin(a * 9),
    desloc: (p) => { const r = Math.hypot(p.x, p.z) / R; p.y += H * 0.9 * fbm(p.x * 12, 0, p.z * 12, s + 3) * r + H * 0.6 * r * r; },
  }), k.ac, true)];
};

export const gFrittata: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = L / 2, H = L * k.A;
  const topo = (r: number) => H * (1.08 - 0.07 * clamp(r / (R * 0.8)) ** 2);
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    let c = mul(c1, 0.95 + 0.1 * fbm(x * 50, y * 50, z * 50, s));
    // topo gratinado em manchas, lateral e fundo bem dourados
    const lado = suave(H * 0.95, H * 0.6, y) * 0.9;
    c = mix(c, c2, clamp(suave(0.0, 0.6, fbm(x * 18, 0, z * 18, s + 1)) * 0.75 + lado + suave(0.88, 1, r) * 0.5) * 0.85);
    // ervas picadas
    c = mix(c, c3, (1 - suave(0.05, 0.12, celula(x * 180, y * 180, z * 180, s + 4))) * (y > H * 0.8 ? 0.9 : 0.3));
    return mul(c, 1 - 0.12 * (1 - suave(0.1, 0.25, celula(x * 70, 0, z * 70, s + 6))) * (y > H * 0.8 ? 1 : 0));
  };
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.86, 0], [R * 0.91, H * 0.12], [R * 0.97, H * 0.6], [R, H * 0.88], [R * 0.95, H * 1.01], [R * 0.8, topo(R * 0.8)], [R * 0.4, topo(R * 0.4)], [0, topo(0)]],
    n: 30, m: 56, cor,
    mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 2, s),
    desloc: (p) => { if (p.y > H * 0.85) p.y += H * 0.06 * fbm(p.x * 25, 0, p.z * 25, s + 8); },
  }), k.ac, true));
  // legumes aparecendo na superfície
  const vegs: RGB[] = [rgb('#c8321e'), rgb('#4e8a2e'), rgb('#e8dcb0'), rgb('#d84a1e'), rgb('#2e6a2a'), rgb('#e8c870')];
  const nv = 20;
  for (let i = 0; i < nv; i++) {
    const rr = R * 0.78 * Math.sqrt((i + 0.5) / nv);
    const a = i * 2.399 + k.r.f(-0.3, 0.3);
    const c = vegs[i % vegs.length];
    const tam = R * k.r.f(0.06, 0.1);
    const corV: CorFn = (x, y, z) => mul(c, 0.85 + 0.25 * fbm(x * 300, y * 300, z * 300, s + i));
    let g: THREE.BufferGeometry;
    if (i % vegs.length === 5) g = caixa(tam, tam * 0.8, tam, corV, { n: 4, m: 12 });
    else if (i % vegs.length === 2) g = elipsoide(tam * 0.9, tam * 0.22, tam * 0.35, corV, 5, 8);
    else g = elipsoide(tam, tam * 0.3, tam * (i % 2 ? 0.45 : 0.7), corV, 5, 8);
    g.rotateY(k.r.f(0, TAU));
    g.translate(Math.cos(a) * rr, topo(rr) - tam * 0.12, Math.sin(a) * rr);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* falafel (família massa em bola)                                      */
/* ------------------------------------------------------------------ */

export const gFalafel: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const f1 = 1 / (R * 0.35), f2 = 1 / (R * 0.16);
  const cor: CorFn = (x, y, z) => {
    const cr = celula(x * f2, y * f2, z * f2, s);
    let c = mix(mul(c1, 1.12), c2, suave(0.35, 0.95, cr));
    c = mix(c, c2, suave(0.2, 0.8, fbm(x * f1, y * f1, z * f1, s + 1)) * 0.4);
    // gergelim e farelo claro aqui e ali
    c = mix(c, c3, (1 - suave(0.04, 0.09, celula(x * f2 * 0.8, y * f2 * 0.8, z * f2 * 0.8, s + 5))) * 0.8);
    return mul(c, 1 - 0.15 * suave(H * 0.25, 0, y));
  };
  return [parte(torno({
    caminho: (u) => {
      const th = u * PI;
      let h = (H * (1 - Math.cos(th))) / 2;
      if (u < 0.5) h *= 0.8;
      return [R * Math.sin(th) ** 0.9, h];
    },
    n: 34, m: 40, cor,
    desloc: (p) => {
      const k1 = 1 + 0.05 * fbm(p.x * f1, p.y * f1, p.z * f1, s) - 0.05 * suave(0.4, 1, celula(p.x * f2, p.y * f2, p.z * f2, s));
      p.x *= k1;
      p.z *= k1;
      p.y = Math.max(0, p.y * (1 + (k1 - 1) * 0.7));
    },
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* pudim Yorkshire (família choux)                                      */
/* ------------------------------------------------------------------ */

export const gYorkshire: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const L = k.T, Rt = L / 2, H = L * k.A, Rb = Rt * 0.68;
  const cam: [number, number][] = [
    [0, 0], [Rb * 0.9, 0], [Rb, H * 0.06], [Rb * 1.08, H * 0.32], [Rt * 0.95, H * 0.66], [Rt, H * 0.86],
    [Rt * 0.9, H], [Rt * 0.74, H * 0.98], [Rt * 0.62, H * 0.82], [Rt * 0.46, H * 0.5], [Rt * 0.24, H * 0.34], [0, H * 0.31],
  ];
  const tBorda = fracArco(cam, 6);
  const tFora = fracArco(cam, 8);
  const alto = (a: number) => 0.2 * fbm(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0, s) + 0.08 * Math.sin(a * 3 + 1);
  const cor: CorFn = (x, y, z, t) => {
    const dentro = suave(tBorda, tFora + 0.05, t);
    // casca dourada que escurece nas cristas; dentro, miolo macio e claro
    let c = mix(c1, c2, suave(0.1, 0.8, fbm(x * 70, y * 70, z * 70, s)) * 0.45 + suave(H * 0.7, H * 1.05, y) * 0.55 * (1 - dentro));
    c = mix(c, mul(c1, 1.15), suave(H * 0.2, 0, y) * 0.3);
    c = mix(c, mix(c3, c1, suave(0.3, 0.9, fbm(x * 50, y * 50, z * 50, s + 3)) * 0.5), dentro * suave(H * 0.9, H * 0.55, y));
    return mul(c, 1 + 0.06 * fbm(x * 160, y * 160, z * 160, s + 1));
  };
  return [parte(torno({
    caminho: cam, n: 40, m: 44, cor,
    mod: (t, a) => 1 + (0.07 * fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, t * 5, s) + 0.04 * Math.sin(a * 5 + t * 6)) * suave(0.05, 0.3, t),
    desloc: (p, t, a) => {
      // borda irregular: um lado sobe mais que o outro, com ondulações
      const k1 = suave(H * 0.35, H * 0.95, p.y);
      p.y += H * alto(a) * k1;
      p.y += H * 0.03 * ruido(p.x * 300, p.y * 300, p.z * 300, s) * k1;
    },
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* cranberry (família baga)                                             */
/* ------------------------------------------------------------------ */

export const gCranberry: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.9 + 0.15 * fbm(x * 220, y * 220, z * 220, s));
    // rubor mais claro em parte da fruta e lenticelas miúdas
    c = mix(c, c2, suave(0.0, 0.7, fbm(x * 380 + 3, y * 380, z * 380, s + 2)) * 0.7);
    c = mix(c, mul(c1, 0.6), suave(0.1, 0.8, fbm(x * 250, y * 250, z * 250, s + 6)) * 0.5);
    c = mix(c, mix(c2, [1, 0.85, 0.8], 0.5), (1 - suave(0.05, 0.14, celula(x * 1100, y * 1100, z * 1100, s))) * 0.6);
    return c;
  };
  // deitada de lado, levemente oval ao longo de X
  const g = fruto({ R: H / 2, H: 2 * R, covaTopo: 0.03, covaBase: 0.02, largCova: 0.15, cor, s, m: 26, n: 20, l: 0.95, lobos: 3, ampLobo: 0.015 });
  g.rotateZ(-PI / 2);
  g.translate(-R, H / 2, 0);
  out.push(parte(g, 'acetinado', true));
  // restinho do cálice numa ponta e pontinho na outra
  const calice = torno({ caminho: [[0, 0], [R * 0.1, 0], [R * 0.13, R * 0.04], [0, R * 0.05]], n: 4, m: 10, cor: () => c3, mod: (t, a) => 1 + 0.3 * Math.cos(a * 4) });
  calice.rotateZ(-PI / 2);
  calice.translate(R * 0.94, H / 2, 0);
  out.push(parte(calice, 'fosco'));
  out.push(parte(tf(elipsoide(R * 0.02, R * 0.05, R * 0.05, () => mul(c3, 0.8), 3, 6), [-R * 0.97, H / 2, 0]), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* fava de baunilha (família vagem)                                     */
/* ------------------------------------------------------------------ */

export const gBaunilha: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, Hh = Math.max(0.002, L * k.A);
  const curvaZ = (t: number) => L * 0.06 * Math.sin(PI * t) + L * 0.012 * Math.sin(t * TAU * 2.2);
  const cor: CorFn = (x, y, z, t, a) => {
    // rugas longas com brilho oleoso nas cristas
    const r = fbm(t * 26, Math.cos(a) * 3, Math.sin(a) * 3, s);
    let c = mix(c1, c2, suave(0.05, 0.7, r) * 0.6);
    c = mul(c, 0.85 + 0.25 * Math.abs(Math.sin(a * 5 + t * 30 + r * 2)) ** 2);
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 64, m: 14, exp: 2.4, cor, corTampa: () => ci,
    perfil: (t) => {
      const env = Math.sqrt(suave(0, 0.05, t)) * suave(1.02, 0.82, t) ** 0.6;
      return {
        ry: (Hh / 2) * Math.max(0.25, env) * (1 + 0.12 * fbm(t * 20, 0, 0, s)),
        rz: (W / 2) * Math.max(0.2, env) * (1 + 0.1 * fbm(t * 12, 1, 0, s)),
        cy: Hh / 2 + Hh * 0.5 * Math.sin(t * PI * 3) ** 2,
        cz: curvaZ(t),
      };
    },
    mod: (t, a) => 1 + 0.09 * ruido(t * 70, Math.cos(a) * 2.5, Math.sin(a) * 2.5, s) - 0.06 * Math.abs(Math.sin(a * 3 + t * 9)) ** 6,
  }), 'brilhante', true));
  // cabinho seco e curvo na ponta -X
  const p0 = V(-L / 2 + 0.002, Hh * 0.55, curvaZ(0));
  out.push(parte(caule([p0, V(p0.x - L * 0.025, Hh * 0.8, p0.z + L * 0.01), V(p0.x - L * 0.04, Hh * 0.6, p0.z + L * 0.025)], Hh * 0.35, Hh * 0.25, (x, y, z) => mul(c3, 0.9 + 0.2 * ruido(x * 800, y * 800, z * 800, s)), 6), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* gergelim (família monte)                                             */
/* ------------------------------------------------------------------ */

export const gGergelim: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const gl = 0.0032;
  const alt = (r: number) => H * (1 - clamp(r / R) ** 1.6) ** 0.9;
  // textura de sementes deitadas: células alongadas em várias direções
  const fq = 1 / (gl * 0.55);
  const corMonte: CorFn = (x, y, z) => {
    const c0 = celula(x * fq, y * fq * 1.6, z * fq * 0.6, s);
    const c1b = celula(x * fq * 0.6, y * fq * 1.6, z * fq, s + 4);
    const cc = Math.min(c0, c1b);
    let c = mix(mul(c1, 0.98), mul(c2, 0.75), suave(0.6, 0.95, cc) * 0.8);
    c = mix(c, mul(c2, 0.9), suave(0.3, 0.9, fbm(x * 60, y * 60, z * 60, s)) * 0.3);
    return c;
  };
  out.push(parte(torno({
    caminho: (u) => {
      if (u < 0.3) return [R * (u / 0.3), 0];
      const r = R * (1 - (u - 0.3) / 0.7);
      return [r, alt(r)];
    },
    n: 22, m: 28, cor: corMonte,
    mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 2, s) * suave(0.25, 0.4, t),
  }), k.ac, true));
  // sementes em forma de gota achatada cobrindo a encosta, e algumas soltas em volta
  const ng = Math.min(240, k.v.n ?? 220);
  const soltas = Math.round(ng * 0.07);
  for (let i = 0; i < ng; i++) {
    const rr = i < soltas ? R * k.r.f(1.0, 1.28) : R * Math.sqrt((i - soltas + 0.5) / (ng - soltas)) * 0.98;
    const a = i < soltas ? k.r.f(0, TAU) : i * 2.39996 + k.r.f(-0.2, 0.2);
    const tom = k.r.f(0.85, 1.1);
    const cg: CorFn = (x) => mul(mix(c1, c2, suave(-gl * 0.5, gl * 0.5, x) * 0.5), tom);
    const g = corpo({
      x0: -gl / 2, x1: gl / 2, n: 3, m: 5, cor: cg,
      perfil: (t) => { const e = Math.sin(PI * clamp(t)) ** 0.6 * lerp(1, 0.35, t); return { ry: gl * 0.12 * e, rz: gl * 0.33 * e }; },
    });
    const incl = Math.atan(Math.max(0, (alt(Math.max(0, rr - 0.001)) - alt(Math.min(R, rr + 0.001))) / 0.002));
    g.rotateY(k.r.f(0, TAU));
    g.rotateX(k.r.f(-0.25, 0.25));
    // inclina a semente acompanhando a encosta
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const eixo = V(-radial.z, 0, radial.x);
    g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(eixo, -incl));
    g.translate(radial.x * rr, Math.max(0, alt(Math.min(R, rr))) + gl * 0.05, radial.z * rr);
    out.push(parte(g, k.ac));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* sálvia (família erva)                                                */
/* ------------------------------------------------------------------ */

export const gSalvia: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  // haste quadrada e felpuda, levemente curva
  const caminho = [V(-L / 2, L * 0.012, 0), V(-L / 6, L * 0.02, L * 0.015), V(L / 6, L * 0.024, -L * 0.008), V(L * 0.42, L * 0.022, 0)];
  const curva = new THREE.CatmullRomCurve3(caminho);
  out.push(parte(caule(caminho, L * 0.011, L * 0.007, (x, y, z) => mul(mix(c3, c2, 0.25), 0.9 + 0.2 * ruido(x * 600, y * 600, z * 600, s)), 6), 'fosco', true));
  // folha alongada de ponta arredondada, borda finamente crenada
  const contorno = (t: number) => Math.sin(PI * clamp(t) ** 0.85) ** 0.7 * (1 - 0.035 * Math.abs(Math.sin(t * 70)));
  const folhaSalvia = (lf: number, si: number) => {
    const wf = lf * 0.42;
    const fr = 1 / Math.max(0.0012, wf * 0.07);
    const cor: CorFn = (x, y, z) => {
      const az = Math.abs(z) / (wf / 2);
      // nervura central clara, rede de nervuras afundadas e penugem esbranquiçada
      let c = mul(c1, 0.92 + 0.12 * fbm(x * 120, 0, z * 120, s + si));
      const rede = suave(0.62, 0.92, celula(x * fr, 0, z * fr * 1.3, s + si));
      c = mix(c, c2, rede * 0.32);
      c = mix(c, c2, (1 - suave(0.03, 0.09, az)) * 0.85);
      c = mix(c, mix(c2, [0.9, 0.92, 0.86], 0.4), suave(0.8, 1, az) * 0.25);
      return c;
    };
    const g = folha(lf, wf, c1, c2, { contorno, cor, concha: 0.16, curva: -0.06, esp: Math.max(0.0007, wf * 0.03), n: 18, m: 12, s: s + si });
    // superfície enrugada: covinhas entre as nervuras
    const pa = g.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const bolha = 1 - celula(x * fr, 0, z * fr * 1.3, s + si);
      const bz = 1 - suave(0.6, 1, Math.abs(z) / (wf / 2));
      pa.setY(i, pa.getY(i) + wf * 0.035 * bolha * bz * Math.sin(PI * clamp(x / lf)));
    }
    g.computeVertexNormals();
    return g;
  };
  const pares: [number, number][] = [[0.12, 0.36], [0.4, 0.42], [0.68, 0.37]];
  pares.forEach(([t, rel], i) => {
    const p = curva.getPointAt(t);
    for (const lado of [-1, 1]) {
      const lf = L * rel * k.r.f(0.92, 1.06);
      const peciolo = L * 0.04;
      const ang = lado * (1.05 - i * 0.12 + k.r.f(-0.1, 0.1));
      const dir = V(Math.cos(ang), 0, -Math.sin(ang));
      const pb = p.clone().addScaledVector(dir, peciolo);
      out.push(parte(caule([p, p.clone().addScaledVector(dir, peciolo * 0.5).add(V(0, L * 0.003, 0)), pb], L * 0.006, L * 0.004, () => mix(c3, c2, 0.3), 5), 'fosco'));
      const g = folhaSalvia(lf, i * 2 + (lado > 0 ? 1 : 0));
      tf(g, [pb.x, pb.y, pb.z], [lado * 0.12, ang, -0.04]);
      out.push(parte(g, k.ac));
    }
  });
  // broto da ponta: duas folhas pequenas quase fechadas
  const pt = curva.getPointAt(1);
  for (const lado of [-1, 1]) {
    const g = folhaSalvia(L * 0.2, 10 + lado);
    tf(g, [pt.x - L * 0.01, pt.y + L * 0.004, pt.z], [lado * 0.35, lado * 0.28, 0.02]);
    out.push(parte(g, k.ac));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* crêpes nas dobras do livro e panqueca americana (família pão chato)   */
/* ------------------------------------------------------------------ */

/** Cor de crêpe: massa clara com a renda dourada da frigideira. */
function corCrepe(k: Parameters<Gerador>[0], escala: number): CorFn {
  const { c1, c2, s } = k;
  return (x, y, z) => {
    let c = mul(c1, 0.95 + 0.08 * fbm(x * 70, y * 70, z * 70, s));
    // renda: anéis dourados das bolhas que estouram na frigideira, mais escuros no centro de cada uma
    const cel = celula(x * escala * 0.45, y * escala * 0.45, z * escala * 0.45, s + 1);
    const renda = 1 - suave(0.1, 0.4, cel);
    const manchas = suave(-0.05, 0.45, fbm(x * 22, y * 22, z * 22, s + 2));
    c = mix(c, c2, clamp(renda * 0.95 + manchas * 0.55));
    c = mix(c, mul(c2, 0.7), renda * manchas * 0.6);
    return c;
  };
}

export const gCrepe: Gerador = (k) => {
  const L = k.T, R = L / 2, H = 0.0018;
  // disco fino com a borda levemente ondulada
  return [parte(laje(30, 44, (u, v, lado) => {
    const a = v * Math.PI;
    const r = u * R * (1 + 0.02 * Math.sin(a * 7));
    return [Math.cos(a) * r, lado * H + 0.0006 * Math.sin(r * 300) * (r / R), Math.sin(a) * r];
  }, corCrepe(k, 220)), k.ac, true)];
};

export const gCrepeEnrolada: Gerador = (k) => {
  // como o livro manda: recheio no centro, dois lados opostos dobrados para dentro e enrolada de
  // uma ponta à outra. Um rolinho fechado e gordinho (tipo burrito), pontas arredondadas e dobradas,
  // a emenda da última volta por baixo, o recheio escondido.
  const L = k.T, R = L * 0.16;
  const base = corCrepe(k, 200);
  const cor: CorFn = (x, y, z, t, a) => {
    let c = base(x, y, z, t, a);
    // emenda da última volta, quase embaixo, e vincos das abas dobradas nas pontas
    const emenda = 1 - suave(0.0, 0.08, Math.abs(Math.sin((a - 0.55 * Math.PI) / 2)));
    const ponta = suave(0.86, 0.97, Math.abs(t * 2 - 1));
    c = mul(c, 1 - emenda * 0.22 - ponta * 0.15 * (0.5 + 0.5 * Math.sin(a * 3)));
    return c;
  };
  const out: Parte[] = [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 40, m: 36,
    perfil: (t) => {
      const e = Math.abs(t * 2 - 1);
      const f = e < 0.8 ? 1 : Math.sqrt(Math.max(0.02, 1 - ((e - 0.8) / 0.2) ** 2)) * 0.75 + 0.25 * (1 - (e - 0.8) / 0.2);
      return { ry: R * 0.82 * f, rz: R * f, cy: R * 0.82 };
    },
    mod: (t, a) => 1 + 0.025 * Math.sin(a * 2 + t * 9) + 0.015 * fbm(t * 6, Math.cos(a), Math.sin(a), k.s),
    cor,
  }), k.ac, true)];
  // a aba da última volta, colada na lateral: dá para ver que é massa enrolada
  out.push(parte(laje(24, 6, (u, v, lado) => {
    const x = (u - 0.5) * L * 0.84;
    const a = -0.35 + (v + 1) * 0.32;
    const rr = R * (1.02 + 0.03 * lado) * (1 - 0.08 * (v + 1));
    return [x, R * 0.82 + Math.sin(a) * rr * 0.82, Math.cos(a) * rr];
  }, base), k.ac, true));
  return out;
};

export const gCrepeQuadrada: Gerador = (k) => {
  // pannequet: os quatro lados dobrados para dentro, um pacotinho quadrado e estufado
  const S = k.T, H = S * 0.13;
  const base = corCrepe(k, 200);
  const cor: CorFn = (x, y, z, t, a) => {
    let c = base(x, y, z, t, a);
    // vincos das dobras: cruz no meio e borda mais dourada
    const vinco = Math.max(1 - suave(0.0, S * 0.03, Math.abs(x)), 1 - suave(0.0, S * 0.03, Math.abs(z)));
    c = mul(c, 1 - vinco * 0.18 * (y > H * 0.5 ? 1 : 0));
    return c;
  };
  return [parte(laje(32, 32, (u, v, lado) => {
    const x = (u - 0.5) * S, z = v * S * 0.5;
    const e = Math.max(Math.abs(x) / (S / 2), Math.abs(z) / (S / 2));
    const topo = H * (1 - e ** 6) * (0.9 + 0.1 * Math.cos(x * 60) * Math.cos(z * 60));
    return [x * (1 - 0.06 * lado * e ** 4), lado ? Math.max(0.0016, topo) : 0, z * (1 - 0.06 * lado * e ** 4)];
  }, cor), k.ac, true)];
};

export const gCrepeLeque: Gerador = (k) => {
  // leque: dobrada ao meio e de novo, um quarto de círculo em camadas, a ponta no centro
  const R = k.T, H = 0.0075;
  return [parte(laje(30, 30, (u, v, lado) => {
    const phi = ((v + 1) / 2) * (Math.PI / 2);
    const r = u * R;
    const onda = r > R * 0.9 ? 0.0015 * Math.sin(phi * 14) : 0;
    const y = lado ? H * (1 - 0.45 * u) + onda : 0.0004;
    return [Math.cos(phi) * r - R * 0.38, y, Math.sin(phi) * r - R * 0.38];
  }, corCrepe(k, 200)), k.ac, true)];
};

export const gPanqueca: Gerador = (k) => {
  // panqueca americana: disco grosso e fofo, topo dourado com furinhos, lateral clara
  const { c1, c2, s } = k;
  const L = k.T, R = L / 2, H = L * k.A;
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    let c = mul(c1, 0.96 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
    const face = y > H * 0.85 || y < H * 0.12 ? 1 : 0;
    c = mix(c, c2, face * (0.75 + 0.2 * fbm(x * 30, 0, z * 30, s + 1)) * (1 - suave(0.85, 1, r) * 0.5));
    c = mul(c, 1 - face * 0.25 * (1 - suave(0.05, 0.12, celula(x * 160, 0, z * 160, s + 3))));
    return c;
  };
  return [parte(torno({
    caminho: [[0, 0], [R * 0.9, 0], [R * 0.98, H * 0.2], [R, H * 0.55], [R * 0.97, H * 0.9], [R * 0.85, H], [0, H * 1.04]],
    n: 30, m: 56, cor,
    mod: (t, a) => 1 + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s),
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* ovos prontos: frito, pochê, mexido, cozido em metades e quente       */
/* ------------------------------------------------------------------ */

export const gOvoFrito: Gerador = (k) => {
  // clara espalhada de borda irregular (rendada e dourada na borda), gema em domo no meio
  const { c1, c2, c3, s } = k;
  const R = k.T / 2, H = 0.004;
  const borda = (a: number) => R * (0.82 + 0.18 * fbm(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0, s));
  const corClara: CorFn = (x, y, z) => {
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z) / borda(a);
    const c = mul(c1, 0.97 + 0.05 * fbm(x * 90, 0, z * 90, s + 1));
    return mix(c, c2, suave(0.78, 1, r) * 0.85 * (0.6 + 0.4 * fbm(x * 60, 0, z * 60, s + 2)));
  };
  const out: Parte[] = [parte(laje(24, 40, (u, v, lado) => {
    const a = v * Math.PI;
    const r = u * borda(a);
    const y = lado ? H * (1 - 0.6 * u ** 2) + 0.0012 * fbm(Math.cos(a) * r * 80, 0, Math.sin(a) * r * 80, s + 3) : 0;
    return [Math.cos(a) * r - R * 0.08, y, Math.sin(a) * r];
  }, corClara), 'acetinado', true)];
  const gema = c3 ?? rgb('#f6b020');
  const corGema: CorFn = (x, y, z) => mul(gema, 0.95 + 0.08 * fbm(x * 120, y * 120, z * 120, s + 4));
  out.push(parte(tf(elipsoide(R * 0.32, R * 0.2, R * 0.32, corGema, 12, 18), [R * 0.05, H * 0.8, R * 0.04]), 'brilhante'));
  return out;
};

export const gOvoPoche: Gerador = (k) => {
  // oval macio: a clara envolve a gema, que só se insinua amarela por baixo do véu
  const { c1, c2, c3, s } = k;
  const R = k.T / 2;
  const cor: CorFn = (x, y, z) => {
    const c = mul(c1, 0.96 + 0.06 * fbm(x * 70, y * 70, z * 70, s));
    const topo = 1 - suave(0, R * 0.55, Math.hypot(x, z));
    return mix(c, c3 ?? c2, topo * suave(R * 0.3, R * 0.6, y) * 0.35);
  };
  return [parte(tf(elipsoide(R, R * 0.48, R * 0.78, cor, 18, 24, (t, a) => 1 + 0.06 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, s + 1)), [0, R * 0.44, 0]), 'acetinado', true)];
};

export const gOvosMexidos: Gerador = (k) => {
  // montinho de coalhos macios e cremosos
  const { c1, c2, s } = k;
  const R = k.T / 2;
  const out: Parte[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399;
    const rr = R * 0.8 * Math.sqrt((i + 0.5) / n);
    const tam = R * k.r.f(0.22, 0.34);
    const alto = (1 - rr / R) * R * 0.45;
    const cor: CorFn = (x, y, z) => mix(mul(c1, 0.95 + 0.08 * fbm(x * 200, y * 200, z * 200, s + i)), c2, 0.25 * fbm(x * 90, y * 90, z * 90, s + i + 9));
    const g = elipsoide(tam, tam * 0.55, tam * 0.75, cor, 6, 10);
    g.rotateY(k.r.f(0, TAU));
    g.translate(Math.cos(a) * rr, tam * 0.4 + alto, Math.sin(a) * rr);
    out.push(parte(g, 'brilhante', i === 0));
  }
  return out;
};

export const gOvoMetade: Gerador = (k) => {
  // ovo cozido cortado ao meio no comprido, deitado com o corte para cima: clara e gema firmes
  const { c1, c3, s } = k;
  const L = k.T, R = L * 0.38;
  const clara: CorFn = (x, y, z) => mul(c1, 0.97 + 0.04 * fbm(x * 100, y * 100, z * 100, s));
  const metade = corpo({
    x0: -L / 2, x1: L / 2, n: 20, m: 24, cor: clara,
    perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (1 - 0.12 * (t - 0.5)); return { ry: R * e, rz: R * e, cy: 0 }; },
    desloc: (p) => { if (p.y > 0) p.y = 0; },
  });
  metade.translate(0, R, 0);
  const gema: CorFn = (x, y, z) => mul(c3 ?? rgb('#f2b62a'), 0.92 + 0.1 * fbm(x * 150, 0, z * 150, s + 2));
  return [parte(metade, 'acetinado', true), parte(tf(elipsoide(R * 0.62, R * 0.12, R * 0.55, gema, 10, 16), [-L * 0.03, R + 0.0005, 0]), 'fosco')];
};

export const gOvoQuente: Gerador = (k) => {
  // ovo quente no oveiro, com a tampa cortada e a gema mole aparecendo
  const { c1, c2, c3, s } = k;
  const L = k.T, R = L * 0.38;
  const porcelana: CorFn = () => rgb('#f6f4ee');
  const out: Parte[] = [parte(torno({ caminho: [[0, 0], [R * 0.9, 0], [R * 0.95, 0.004], [R * 0.45, 0.012], [R * 0.42, 0.02], [R * 1.05, 0.03], [R * 1.12, 0.045], [R * 1.05, 0.046], [R * 0.9, 0.034], [0, 0.03]], n: 12, m: 40, cor: porcelana }), 'brilhante', true)];
  const casca: CorFn = (x, y, z) => mul(c1, 0.95 + 0.07 * fbm(x * 90, y * 90, z * 90, s));
  const corte = 0.03 + L * 0.62;
  out.push(parte(torno({
    caminho: (u) => { const y = 0.028 + u * (corte - 0.028); const t = (y - 0.028) / L; const r = R * Math.sqrt(Math.max(0, 1 - ((t - 0.42) / 0.58) ** 2)); return [Math.max(0.002, r), y]; },
    n: 18, m: 32, cor: casca,
  }), 'acetinado'));
  const rc = R * Math.sqrt(Math.max(0, 1 - ((0.62 - 0.42) / 0.58) ** 2)) * 0.97;
  out.push(parte(tf(torno({ caminho: [[0, 0], [rc, 0], [rc * 0.9, 0.0008], [0, 0.001]], n: 3, m: 28, cor: () => c2 }), [0, corte - 0.001, 0]), 'acetinado'));
  out.push(parte(tf(elipsoide(rc * 0.62, rc * 0.25, rc * 0.62, () => c3 ?? rgb('#f6a820'), 8, 14), [0, corte, 0]), 'brilhante'));
  return out;
};
