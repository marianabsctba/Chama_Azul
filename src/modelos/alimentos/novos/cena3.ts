// Alimentos novos pedidos pela ficha de cena (cena3): formas intermediárias e preparos prontos que
// faltavam nas técnicas de legumes, grãos, castanhas, massas, pães, assados e frituras. Bulbo de
// erva-doce aparado, alcachofra recheada em cone invertido e alla giudea, cenoura sem rama (inteira,
// em toco, em corte girado e em fitas), couve-rábano sem talos, shiitake seco e reidratado, grãos
// debulhados (ervilha, fava, milho), cebola descascada (anéis, rodelas, metade), alho-poró aparado,
// rodelas de lótus com furos, melão amargo, loofah, abacate com caroço, pimentão recheado com tampa,
// chiles recheados, empanado e gratinado, espinafre cozido, feijões, arroz solto e de sushi, risoto
// moldado, triângulos de polenta, cuscuz, bulgur, castanhas peladas, massa fresca (bola, disco,
// folha, ninho, cilindro de nhoque, espaguete cozido, disco chinês, folha de rolinho, canelone
// gratinado), escargot sem concha, massas de pão cruas, focaccia com covinhas, alho e beterraba
// assados, batata assada riscada, gratin dauphinois, batata frita, alga crespa e osso com tutano.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, parte, juntar, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { contornos, type Gerador } from '../pecas';
import { vis, grade, bloco, petala, emAnel, orientar, type K } from './frutas_enfeites';
import type { Lote } from './tipos';

type G = THREE.BufferGeometry;

/* ------------------------------------------------------------------ */
/* utilidades                                                           */
/* ------------------------------------------------------------------ */

const cl = (c: RGB): RGB => [clamp(c[0]), clamp(c[1]), clamp(c[2])];

function geo(P: number[], C: number[], I: number[]): G {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** Move cada vértice e recalcula as normais. */
function deformar(g: G, f: (p: THREE.Vector3) => void): G {
  const pos = g.getAttribute('position');
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    f(p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Vira cada triângulo para a direção dada pelo centro dele. */
function orientarPor(g: G, dir: (c: THREE.Vector3) => THREE.Vector3): G {
  const p = g.getAttribute('position');
  const ix = g.getIndex()!;
  const arr = ix.array as Uint16Array | Uint32Array;
  const a = V(), b = V(), c = V(), n = V(), m = V();
  for (let f = 0; f < arr.length; f += 3) {
    a.fromBufferAttribute(p, arr[f]);
    b.fromBufferAttribute(p, arr[f + 1]);
    c.fromBufferAttribute(p, arr[f + 2]);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3);
    if (n.dot(dir(m)) < 0) {
      const t = arr[f + 1];
      arr[f + 1] = arr[f + 2];
      arr[f + 2] = t;
    }
  }
  ix.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Gira e apoia a peça em y (o ponto mais baixo encosta em y) na posição x, z. */
function pousar(g: G, x: number, z: number, ry = 0, rx = 0, rz = 0, y = 0): G {
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.computeBoundingBox();
  g.translate(x, y - g.boundingBox!.min.y, z);
  return g;
}

/** Altura de um monte de encosta macia em função do raio. */
const altMonte = (R: number, H: number) => (r: number) => H * Math.max(0, 1 - clamp(r / R) ** 1.6) ** 1.1;

/** Monte em pé (y para cima), raio R e altura H; `l` achata em Z. */
function monte(R: number, H: number, cor: CorFn, o: { n?: number; m?: number; rug?: number; s?: number; l?: number } = {}): G {
  const alt = altMonte(R, H), s = o.s ?? 0;
  return torno({
    caminho: (u) => {
      if (u < 0.15) return [R * (u / 0.15), 0];
      const r = R * (1 - (u - 0.15) / 0.85);
      return [r, alt(r)];
    },
    n: o.n ?? 12, m: o.m ?? 28, cor, l: o.l,
    mod: (t, a) => 1 + (o.rug ?? 0.05) * fbm(Math.cos(a) * 2.5, Math.sin(a) * 2.5, t * 3, s) * suave(0.15, 0.3, t),
  });
}

/** Espalha grãos sobre um monte (raio R, altura H), cada um apoiado na encosta. */
function semear(k: K, n: number, R: number, H: number, peca: (i: number) => G, o: { deitado?: boolean; afunda?: number; l?: number; borda?: number } = {}): G[] {
  const alt = altMonte(R, H);
  const out: G[] = [];
  for (let i = 0; i < n; i++) {
    const rr = R * Math.sqrt((i + 0.5) / n) * (o.borda ?? 0.96);
    const a = i * 2.39996 + k.r.f(-0.25, 0.25);
    const g = peca(i);
    if (o.deitado) {
      g.rotateZ(k.r.f(-0.4, 0.4));
      g.rotateX(k.r.f(-0.4, 0.4));
    } else {
      g.rotateX(k.r.f(-PI, PI));
      g.rotateZ(k.r.f(-PI, PI));
    }
    g.rotateY(k.r.f(0, TAU));
    g.computeBoundingBox();
    const h0 = -g.boundingBox!.min.y;
    g.translate(Math.cos(a) * rr, alt(rr) + h0 * (1 - (o.afunda ?? 0.5)), Math.sin(a) * rr * (o.l ?? 1));
    out.push(g);
  }
  return out;
}

/** Disco em pé (y para cima) de raio R e espessura H, com as faces bem divididas para pintar. */
function disco(R: number, H: number, cor: CorFn, o: { n?: number; m?: number; mod?: (t: number, a: number) => number; desloc?: (p: THREE.Vector3) => void; centro?: number } = {}): G {
  const hc = o.centro ?? 1;
  return torno({
    caminho: (u) => {
      if (u < 0.44) return [R * (u / 0.44), 0];
      if (u < 0.56) return [R, H * ((u - 0.44) / 0.12)];
      const r = R * (1 - (u - 0.56) / 0.44);
      return [r, H * lerp(1, hc, 1 - r / R)];
    },
    n: o.n ?? 14, m: o.m ?? 32, cor, mod: o.mod, desloc: o.desloc ? (p) => o.desloc!(p) : undefined,
  });
}

/** Mapa do quadrado [-1, 1]² para o superelipse de expoente e (cantos arredondados). */
function quadrado(u: number, v: number, e = 6): [number, number] {
  const m = Math.max(Math.abs(u), Math.abs(v));
  if (m < 1e-9) return [0, 0];
  const n = (Math.abs(u) ** e + Math.abs(v) ** e) ** (1 / e);
  return [(u * m) / n, (v * m) / n];
}
/** Ponto da borda do superelipse no ângulo a. */
const bordaQ = (a: number, e = 6): [number, number] => {
  const c = Math.cos(a), s = Math.sin(a);
  return [Math.sign(c) * Math.abs(c) ** (2 / e), Math.sign(s) * Math.abs(s) ** (2 / e)];
};

/** Laje de cantos arredondados (meio comprimento A em X, meia largura B em Z), topo com relevo. */
function laje(A: number, B: number, alt: (x: number, z: number) => number, hBorda: number, corTopo: CorFn, corLado: CorFn, nu = 40, nv = 28, e = 6): G[] {
  const topo = grade(nu, nv, (u, v) => {
    const [a, b] = quadrado(u * 2 - 1, v * 2 - 1, e);
    return [a * A, alt(a * A, b * B), b * B];
  }, corTopo);
  const lado = grade(Math.max(48, (nu + nv) * 2), 3, (u, v) => {
    const [a, b] = bordaQ(u * TAU, e);
    return [a * A, v * hBorda, b * B];
  }, corLado);
  const fundo = grade(8, 6, (u, v) => {
    const [a, b] = quadrado(u * 2 - 1, v * 2 - 1, e);
    return [a * A, 0, b * B];
  }, (x, y, z) => mul(corLado(x, y, z, 0, 0), 0.9));
  orientarPor(topo, () => V(0, 1, 0));
  orientarPor(fundo, () => V(0, -1, 0));
  orientarPor(lado, (c) => V(c.x / A, 0, c.z / B));
  return [topo, lado, fundo];
}

/**
 * Placa redonda furada (rodela de lótus): grade quadrada recortada pelo disco e pelos furos, com os
 * vértices de fora puxados para a borda mais próxima; paredes da borda e dos furos.
 */
function placaFurada(R: number, H: number, furos: [number, number, number][], corFace: (x: number, z: number) => RGB, corBorda: CorFn, corFuro: CorFn, N = 20): G[] {
  const out: G[] = [];
  const proj = (x: number, z: number): [number, number, boolean] => {
    const d = Math.hypot(x, z);
    if (d > R) return [(x * R) / d, (z * R) / d, true];
    for (const [cx, cz, r] of furos) {
      const e = Math.hypot(x - cx, z - cz);
      if (e < r) return e < 1e-9 ? [cx + r, cz, true] : [cx + ((x - cx) * r) / e, cz + ((z - cz) * r) / e, true];
    }
    return [x, z, false];
  };
  const dentro = (x: number, z: number) => {
    if (Math.hypot(x, z) > R * 1.0001) return false;
    for (const [cx, cz, r] of furos) if (Math.hypot(x - cx, z - cz) < r * 0.999) return false;
    return true;
  };
  for (const cima of [true, false]) {
    const P: number[] = [], C: number[] = [], I: number[] = [];
    const y = cima ? H : 0;
    const q: [number, number, boolean][] = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = proj(-R + (2 * R * i) / N, -R + (2 * R * j) / N);
        q.push(p);
        P.push(p[0], y, p[1]);
        const c = cl(mul(corFace(p[0], p[1]), cima ? 1 : 0.94));
        C.push(c[0], c[1], c[2]);
      }
    }
    const id = (i: number, j: number) => i * (N + 1) + j;
    const tri = (a: number, b: number, c: number) => {
      const A = q[a], B = q[b], Cc = q[c];
      if (A[2] && B[2] && Cc[2]) return;
      if (!dentro((A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3)) return;
      const ar = (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]);
      if (Math.abs(ar) < 1e-11) return;
      if ((-ar > 0) === cima) I.push(a, b, c);
      else I.push(a, c, b);
    };
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        tri(id(i, j), id(i + 1, j), id(i + 1, j + 1));
        tri(id(i, j), id(i + 1, j + 1), id(i, j + 1));
      }
    }
    out.push(geo(P, C, I));
  }
  out.push(orientar(grade(48, 1, (u, v) => [R * Math.cos(u * TAU), v * H, R * Math.sin(u * TAU)], corBorda), V(0, H / 2, 0)));
  for (const [cx, cz, r] of furos) {
    out.push(orientar(grade(16, 1, (u, v) => [cx + r * Math.cos(u * TAU), v * H, cz + r * Math.sin(u * TAU)], corFuro), V(cx, H / 2, cz), true));
  }
  return out;
}

/** Pedaço cilíndrico com as duas pontas cortadas em 45 graus, em planos que giram (corte girado). */
function pedacoInclinado(r0: number, r1: number, Lp: number, f0: number, f1: number, cor: CorFn, corT: CorFn, m = 16): G {
  return corpo({
    x0: -Lp / 2, x1: Lp / 2, n: 4, m, tampa: true, aneisTampa: 3, cor, corTampa: corT,
    perfil: (t) => {
      const r = lerp(r0, r1, t);
      return { ry: r, rz: r };
    },
    desloc: (p, t) => {
      const d0 = Math.cos(f0) * p.y + Math.sin(f0) * p.z;
      const d1 = Math.cos(f1) * p.y + Math.sin(f1) * p.z;
      p.x += lerp(d0, d1, t) * 0.85;
    },
  });
}

/** Tom com ruído. */
const tom = (c: RGB, amp: number, f: number, s = 0): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));

/* ------------------------------------------------------------------ */
/* legumes aparados                                                     */
/* ------------------------------------------------------------------ */

const gErvaDoceAparada: Gerador = (k) => {
  // bulbo deitado: raiz cortada reta, camadas brancas em gomos, ombros afinando para três talos cortados
  const { c1, c2, ci, c3, s } = k;
  const L = k.T * 0.8, R = k.T * 0.33;
  const cy = R * 0.8;
  const out: Parte[] = [];
  const pele = (i: number): CorFn => (x, y, z, t, a) => {
    let c = mix(c1, c2, suave(0.45, 1, t) * 0.8);
    c = mul(c, 0.93 + 0.07 * Math.abs(Math.sin(a * 4 + 0.4 * Math.sin(t * 5 + i))) + 0.04 * fbm(x * 260, y * 260, z * 260, s + i));
    // bordas das capas que se sobrepõem
    c = mix(c, mul(c2, 0.85), (1 - suave(0, 0.07, Math.abs(Math.sin(a * 1.5 + 0.8 + i)))) * 0.45 * suave(0.1, 0.4, t));
    return c;
  };
  const corte = (R0: number, cy0: number, raiz: boolean): CorFn => (x, y, z) => {
    const r = clamp(Math.hypot(y - cy0, z) / R0);
    if (raiz && x < 0) return mix(mul(rgb('#c8bc90'), 0.95 + 0.1 * fbm(y * 900, z * 900, 0, s)), rgb('#9a8a60'), (1 - suave(0, 0.12, Math.abs(r - 0.55))) * 0.5);
    return mix(mul(ci, 1.02), mix(ci, c3, 0.55), Math.abs(Math.sin(r * 15)) ** 6 * 0.6 + (1 - suave(0.0, 0.15, r)) * 0.3);
  };
  const perfil = (t: number) => {
    const b = Math.sin(PI * clamp(0.1 + t * 0.9)) ** 0.55;
    const r = R * Math.max(0.3, b * (1 - 0.55 * suave(0.55, 1, t)));
    return { ry: r * 0.8, rz: r, cy };
  };
  out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 26, m: 24, tampa: true, aneisTampa: 5, cor: pele(0), corTampa: corte(R * 0.32, cy, true), perfil }), 'acetinado', true));
  // talos laterais cortados rentes
  for (const lado of [-1, 1]) {
    const r = R * 0.22;
    const g = corpo({
      x0: 0, x1: L * 0.24, n: 6, m: 14, tampa: true, cor: (x, y, z, t, a) => mul(mix(c2, c3, 0.25 + t * 0.3), 0.95 + 0.06 * Math.abs(Math.sin(a * 5))),
      corTampa: (x, y, z) => (x < 0.001 ? c2 : corte(r, 0, false)(x, y, z, 0, 0)), perfil: () => ({ ry: r, rz: r * 1.1 }),
    });
    g.rotateZ(0.25);
    g.rotateY(-lado * 0.5);
    g.translate(L * 0.22, cy + R * 0.1, lado * R * 0.25);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gCouveRabanoAparada: Gerador = (k) => {
  // bulbo verde-claro sem os talos: cicatrizes redondas onde saíam, raiz e topo cortados retos
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, H = R * 1.55;
  const cic: [number, number][] = [];
  for (let i = 0; i < 8; i++) cic.push([0.42 + 0.4 * ((i * 0.37) % 1), i * 2.39996 + 0.4]);
  const marca = (t: number, a: number) => {
    let m = 0;
    for (const [tc, ac] of cic) {
      const da = Math.atan2(Math.sin(a - ac), Math.cos(a - ac)) * 0.9;
      const d = Math.hypot((t - tc) * 3.2, da);
      m = Math.max(m, 1 - suave(0.05, 0.16, d));
    }
    return m;
  };
  const corp = torno({
    caminho: [[0, 0], [R * 0.3, 0], [R * 0.72, H * 0.12], [R * 0.97, H * 0.4], [R * 0.94, H * 0.66], [R * 0.68, H * 0.88], [R * 0.24, H * 0.98], [0, H * 0.985]],
    n: 24, m: 34,
    mod: (t, a) => 1 + 0.025 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s) + 0.05 * marca(t, a),
    cor: (x, y, z, t, a) => {
      let c = mix(c1, c2, suave(0.3, 0.9, fbm(x * 60, y * 60, z * 60, s)) * 0.4);
      c = mul(c, 0.96 + 0.05 * fbm(x * 400, y * 400, z * 400, s));
      const m = marca(t, a);
      c = mix(c, mul(c2, 0.75), suave(0.2, 0.5, m) * 0.7);
      c = mix(c, mix(ci, c2, 0.3), suave(0.75, 0.95, m));
      if (t < 0.06) c = mix(ci, rgb('#b8b088'), 0.35);
      if (t > 0.94) c = mix(ci, c1, 0.3);
      return c;
    },
  });
  return [parte(corp, 'acetinado', true)];
};

const gAlhoPoroAparado: Gerador = (k) => {
  // talo branco a verde-claro sem as folhas escuras, ponta verde cortada mostrando os anéis
  const { c1, c2, ci, s } = k;
  const L = k.T, R = L * 0.05;
  const raio = (t: number) => R * (1 + 0.1 * suave(0.12, 0, t) + 0.12 * suave(0.75, 1, t));
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 20, tampa: true, aneisTampa: 6,
    perfil: (t) => ({ ry: raio(t), rz: raio(t) * 1.05, cy: R * 1.1 }),
    cor: (x, y, z, t, a) => {
      let c = mix(c1, c2, suave(0.5, 0.95, t));
      c = mul(c, 0.95 + 0.05 * Math.abs(Math.sin(a * 22 + x * 8)) ** 8 + 0.04 * fbm(x * 90, y * 500, z * 500, s));
      c = mix(c, mul(c2, 0.8), (1 - suave(0, 0.05, Math.abs(Math.sin(a * 0.5 + 0.6 + t * 1.5)))) * 0.4 * suave(0.55, 0.8, t));
      return c;
    },
    corTampa: (x, y, z) => {
      const r = clamp(Math.hypot(y - R * 1.1, z) / (R * 1.1));
      if (x < 0) return mix(rgb('#d8c8a0'), rgb('#a08a5a'), suave(0.5, 0.9, fbm(y * 1200, z * 1200, 0, s)) * 0.6 + (1 - suave(0.2, 0.3, r)) * 0.2);
      return mix(ci, mix(c2, rgb('#7aa050'), 0.5), Math.abs(Math.sin(r * 16)) ** 4 * (0.4 + 0.5 * r));
    },
  });
  return [parte(g, 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* alcachofras                                                          */
/* ------------------------------------------------------------------ */

const gAlcachofraRecheada: Gerador = (k) => {
  // sem talo e com a ponta cortada: brácteas de pontas retas e, no centro, o cone de folhas virado
  // de boca para cima cheio de recheio de farinha de rosca e ervas
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.45, H = R * 1.6, hTopo = H * 0.84;
  const out: Parte[] = [];
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.36, 0], [R * 0.7, H * 0.16], [R * 0.86, H * 0.45], [R * 0.78, H * 0.72], [R * 0.55, hTopo], [0, hTopo]],
    n: 14, m: 26, cor: tom(mix(c1, ci, 0.3), 0.08, 300, s),
  }), 'acetinado', true));
  const verde = tom(c1, 0.1, 220, s), roxo = mix(c1, c2, 0.55);
  for (let j = 0; j < 3; j++) {
    const nb = 11 - j * 2;
    for (let i = 0; i < nb; i++) {
      const Lb = H * (0.56 + j * 0.06), W = R * (0.95 - j * 0.12);
      const g = petala(Lb, W, {
        // contorno de ponta reta: a ponta foi cortada
        contorno: (t) => Math.sin(PI * clamp(0.08 + t * 0.62)) ** 0.6,
        curva: 0.16, concha: 0.3, esp: R * 0.06, n: 8, m: 6,
        cima: (x, y, z, t) => mix(mix(ci, c1, 0.35), ci, suave(0.85, 1, t) * 0.6),
        baixo: (x, y, z, t) => {
          let c = mix(verde(x, y, z, 0, 0), roxo, suave(0.4, 0.9, t) * 0.5);
          c = mix(c, mix(ci, c1, 0.3), suave(0.93, 1, t) * 0.8);
          return mul(c, 0.92 + 0.08 * Math.abs(Math.sin(z * 2000)));
        },
      });
      emAnel(g, R * (0.58 - j * 0.08), H * (0.04 + j * 0.16), ((i + j * 0.5) / nb) * TAU + k.r.f(-0.08, 0.08), 1.2 - j * 0.12);
      out.push(parte(g, 'acetinado'));
    }
  }
  // cone central de cabeça para baixo: folhas finas, claras e de ponta roxa, abertas como taça
  for (let i = 0; i < 9; i++) {
    const g = petala(H * 0.3, R * 0.42, {
      contorno: contornos.lanca, curva: -0.1, concha: 0.25, esp: R * 0.03, n: 7, m: 5,
      cima: (x, y, z, t) => mix(mix(ci, rgb('#e8e4c0'), 0.4), rgb('#9a6a8a'), suave(0.6, 1, t) * 0.7),
      baixo: (x, y, z, t) => mix(ci, rgb('#8a5a7a'), suave(0.5, 1, t) * 0.7),
    });
    emAnel(g, R * 0.12, hTopo - H * 0.02, (i / 9) * TAU, 0.75);
    out.push(parte(g, 'acetinado'));
  }
  // recheio dentro da taça
  const rech = monte(R * 0.34, H * 0.16, (x, y, z) => {
    let c = mul(rgb('#c89a58'), 0.85 + 0.25 * fbm(x * 700, y * 700, z * 700, s + 3));
    c = mix(c, rgb('#4a7a2a'), suave(0.55, 0.75, ruido(x * 1400, y * 1400, z * 1400, s + 5)) * 0.8);
    return c;
  }, { s, rug: 0.18, n: 10, m: 22 });
  rech.translate(0, hTopo + H * 0.02, 0);
  out.push(parte(rech, 'fosco'));
  return out;
};

const gAlcachofraGiudea: Gerador = (k) => {
  // broto achatado e frito em azeite: brácteas abertas como flor, douradas e de pontas crocantes
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.42, H = R * 0.9;
  const out: Parte[] = [];
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.4, 0.001], [R * 0.45, H * 0.4], [R * 0.25, H * 0.75], [0, H * 0.8]], n: 10, m: 22, cor: tom(ci, 0.08, 300, s) }), 'acetinado', true));
  const voltas = 4;
  for (let j = 0; j < voltas; j++) {
    const nb = 12 - j * 2;
    for (let i = 0; i < nb; i++) {
      const g = petala(R * (0.95 - j * 0.12), R * (0.62 - j * 0.07), {
        contorno: contornos.oval, curva: -0.3 + j * 0.08, concha: 0.25, esp: R * 0.05, n: 8, m: 6,
        cima: (x, y, z, t) => mul(mix(ci, c1, 0.3 + 0.5 * t), 0.9 + 0.2 * fbm(x * 500, y * 500, z * 500, s + i)),
        baixo: (x, y, z, t) => mix(mul(c1, 0.9 + 0.2 * fbm(x * 400, y * 400, z * 400, s)), c2, suave(0.55, 1, t) * 0.85),
      });
      emAnel(g, R * (0.32 - j * 0.05), H * (0.08 + j * 0.15), ((i + j * 0.5) / nb) * TAU + k.r.f(-0.1, 0.1), 0.35 + j * 0.28);
      out.push(parte(g, 'brilhante'));
    }
  }
  // cabinho curto frito
  out.push(parte(tubo([V(-R * 0.1, H * 0.15, 0), V(-R * 0.9, H * 0.12, R * 0.1), V(-R * 1.4, H * 0.18, R * 0.12)], { raio: (t) => R * (0.16 - 0.04 * t), m: 8, n: 10, pontaRedonda: false, cor: tom(mix(c1, c2, 0.4), 0.1, 300, s) }), 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* cenouras                                                             */
/* ------------------------------------------------------------------ */

const corCenoura = (c1: RGB, c2: RGB, s: number, descascada: boolean): CorFn => (x, y, z, t, a) => {
  let c = mul(c1, 0.95 + 0.08 * fbm(x * 120, y * 300, z * 300, s));
  if (descascada) c = mix(c, mul(c1, 1.12), 0.35 * Math.abs(Math.sin(a * 6 + x * 40)) ** 3);
  else {
    const anel = Math.abs(Math.sin(x * 620 + 2 * fbm(x * 40, a, 0, s))) ** 30;
    c = mix(c, c2, anel * 0.6);
    c = mix(c, mul(c2, 0.8), suave(0.75, 0.95, fbm(x * 200, y * 600, z * 600, s + 3)) * 0.4);
  }
  return c;
};
const corCorteCenoura = (ci: RGB, c1: RGB, R: number, cy: number): CorFn => (x, y, z) => {
  const r = clamp(Math.hypot(y - cy, z) / R);
  let c = mix(mul(ci, 1.03), c1, suave(0.45, 0.6, r));
  c = mix(c, mul(c1, 0.85), (1 - suave(0, 0.05, Math.abs(r - 0.52))) * 0.4);
  return mul(c, 1 + 0.04 * Math.cos(Math.atan2(z, y - cy) * 14) * (1 - r));
};

/** Cenoura deitada da ponta (x0) à coroa cortada (x1), sem rama. */
function cenouraSemRama(k: K, L: number, R: number, pontaR: number, potencia: number, descascada: boolean): G {
  const { c1, c2, ci, s } = k;
  const raio = (t: number) => R * (pontaR + (1 - pontaR) * t ** potencia) * (1 - 0.05 * suave(0.96, 1, t));
  const r0 = raio(0), r1 = raio(1);
  return corpo({
    x0: -L / 2, x1: L / 2, n: 28, m: 18, tampa: true, aneisTampa: 4,
    perfil: (t) => ({ ry: raio(t), rz: raio(t), cy: raio(t) * 0.98 }),
    cor: corCenoura(c1, c2, s, descascada),
    corTampa: (x, y, z, t, a) => (x > 0 ? corCorteCenoura(ci, c1, r1, r1 * 0.98)(x, y, z, t, a) : corCorteCenoura(ci, c1, r0, r0 * 0.98)(x, y, z, t, a)),
  });
}

const gCenouraAparada: Gerador = (k) => [parte(cenouraSemRama(k, k.T, k.T * 0.085, 0.07, 0.55, false), 'acetinado', true)];

const gCenouraToco: Gerador = (k) => [parte(cenouraSemRama(k, k.T, k.T * 0.25, 0.9, 1, true), 'acetinado', true)];

const gCenouraGirada: Gerador = (k) => {
  // pedaços do corte girado: faces de 45 graus em planos que giram 90 graus a cada corte
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const n = 7;
  const pos: [number, number][] = [[-0.035, -0.012], [-0.012, 0.016], [0.012, -0.014], [0.034, 0.012], [-0.03, 0.03], [0.02, 0.036], [0.0, -0.036]];
  for (let i = 0; i < n; i++) {
    const r0 = 0.0125 - i * 0.0008, r1 = r0 - 0.0008;
    const Lp = 0.03 - i * 0.0006;
    const f0 = (i * PI) / 2, f1 = f0 + PI / 2;
    const g = pedacoInclinado(r0, r1, Lp, f0, f1, corCenoura(c1, c2, s + i, true), corCorteCenoura(ci, c1, (r0 + r1) / 2, 0), 16);
    pousar(g, pos[i][0], pos[i][1], k.r.f(0, TAU), k.r.f(0, TAU));
    out.push(parte(g, 'acetinado', i === 0));
  }
  return out;
};

const gCenouraFitas: Gerador = (k) => {
  // fitas longas e finas tiradas com o descascador, onduladas e amontoadas, miolo mais claro no meio
  const { c1, ci, s } = k;
  const out: Parte[] = [];
  const nf = 8;
  for (let i = 0; i < nf; i++) {
    const Lf = k.T * k.r.f(0.8, 1), W = k.r.f(0.014, 0.02);
    const z0 = k.r.f(-0.025, 0.025), fase = k.r.f(0, TAU), y0 = 0.0012 + i * 0.0016;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 9; j++) {
      const u = j / 9;
      pts.push(V((u - 0.5) * Lf, y0 + 0.006 * Math.abs(Math.sin(u * PI * 2.2 + fase)) * (0.4 + 0.6 * Math.sin(PI * u)), z0 + 0.012 * Math.sin(u * PI * 1.6 + fase)));
    }
    const g = tubo(pts, {
      raio: (t) => (W / 2) * (0.7 + 0.3 * Math.sin(PI * t)) * Math.min(1, Math.sin(PI * clamp(t)) * 6 + 0.15),
      achata: 0.0009 / W, cima: V(0, 0.15, 1), m: 8, n: 40, pontaRedonda: false,
      cor: (x, y, z, t, a) => {
        const miolo = 1 - suave(0.2, 0.55, Math.abs(Math.cos(a)));
        return mul(mix(c1, mul(ci, 1.05), miolo * 0.55), 0.95 + 0.07 * fbm(x * 200, y * 200, z * 200, s + i));
      },
    });
    g.rotateY(k.r.f(-0.35, 0.35));
    out.push(parte(g, 'brilhante', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* cogumelos                                                            */
/* ------------------------------------------------------------------ */

function chapeuShiitake(k: K, R: number, H: number, seco: boolean, i: number): G[] {
  const { c1, c2, ci, s } = k;
  const cap = torno({
    caminho: (u) => {
      if (u < 0.36) {
        const q = u / 0.36;
        return [R * 0.9 * q, H * (0.28 - 0.12 * q)];
      }
      if (u < 0.46) {
        const q = (u - 0.36) / 0.1;
        return [R * (0.9 + 0.1 * Math.sin((q * PI) / 2)), H * (0.16 + 0.19 * q)];
      }
      const q = (u - 0.46) / 0.54;
      return [R * Math.cos((q * PI) / 2), H * (0.35 + 0.65 * Math.sin((q * PI) / 2) ** 0.8)];
    },
    n: 18, m: 34,
    mod: (t, a) => 1 + (seco ? 0.06 : 0.025) * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 4, s + i) + (t > 0.3 && t < 0.5 ? 0.035 * Math.sin(a * 7 + i) : 0),
    cor: (x, y, z, t, a) => {
      if (t < 0.36) {
        const lam = Math.abs(Math.sin(a * 46)) ** 4;
        return mul(mix(ci, mul(ci, 0.72), lam * 0.6), 0.94 + 0.08 * fbm(x * 500, y * 500, z * 500, s + i));
      }
      let c = mul(c1, 0.88 + 0.18 * fbm(x * 180, y * 180, z * 180, s + i));
      c = mix(c, mul(c1, 0.72), suave(0.75, 1, t) * 0.4);
      c = mix(c, c2, suave(0.955, 0.995, celula(x * 300, y * 300, z * 300, s + i)) * (seco ? 0.9 : 0.35));
      c = mix(c, c2, (1 - suave(0.36, 0.52, t)) * 0.45);
      return c;
    },
  });
  const pe = tubo([V(0, H * 0.3, 0), V(R * 0.04, H * 0.12, 0), V(R * 0.08, -H * 0.02, 0)], {
    raio: (t) => R * (0.2 - 0.04 * t), m: 10, n: 6, pontaRedonda: false,
    cor: (x, y, z) => mul(mix(ci, c2, 0.4), 0.9 + 0.12 * Math.abs(Math.sin((x + z) * 3000))),
  });
  return [cap, pe];
}

const gShiitake: Gerador = (k) => {
  // três chapéus: um de pé, um de lamelas para cima e um inclinado; o seco é rachado e enrugado
  const seco = k.v.v === 'seco';
  const R = k.T * 0.24, H = R * (seco ? 0.62 : 0.78);
  const out: Parte[] = [];
  const lugares: [number, number, number, number][] = [[-R * 1.15, 0, 0, 0], [R * 1.15, -R * 0.35, PI, 0], [0, R * 1.25, 0.35, 0.6]];
  lugares.forEach(([x, z, rx, ry], i) => {
    const [cap, pe] = chapeuShiitake(k, R * (1 - i * 0.08), H * (1 - i * 0.08), seco, i);
    const grupo = juntar([cap, pe]);
    pousar(grupo, x, z, ry, rx, 0);
    out.push(parte(grupo, seco ? 'fosco' : 'umido', i === 0));
  });
  return out;
};

/* ------------------------------------------------------------------ */
/* grãos debulhados e cozidos                                            */
/* ------------------------------------------------------------------ */

const gErvilhas: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = R * 0.42;
  const base = monte(R * 0.9, H * 0.8, (x, y, z) => mul(mix(c1, c2, 0.3), 0.65 + 0.1 * fbm(x * 200, y * 200, z * 200, s)), { s, rug: 0.08 });
  const graos = semear(k, 80, R, H, (i) => {
    const r = 0.0045 * k.r.f(0.85, 1.12);
    const tomG = mix(c1, c2, k.r.f(0, 0.55));
    return elipsoide(r, r * 0.95, r * k.r.f(0.9, 1), (x, y, z) => {
      let c = mul(mix(tomG, mul(c2, 1.12), suave(0.2, 1, y / r) * 0.3), 1 + 0.06 * fbm(x * 900, y * 900, z * 900, s + i));
      c = mix(c, mix(c2, rgb('#e8e8b0'), 0.4), (1 - suave(0.0, 0.3, Math.hypot(x / r - 0.9, z / r))) * 0.7);
      return c;
    }, 5, 7);
  });
  return [parte(base, 'acetinado', true), parte(juntar(graos), 'brilhante')];
};

const gFavas: Gerador = (k) => {
  // grãos achatados de fava: com a pele cinza-esverdeada ou pelados, verde vivo e brilhantes
  const { c1, c2, s } = k;
  const pelada = k.v.v === 'peladas';
  const R = k.T * 0.5, H = R * 0.32;
  const base = monte(R * 0.85, H * 0.7, (x, y, z) => mul(c1, 0.6 + 0.1 * fbm(x * 200, y * 200, z * 200, s)), { s, rug: 0.1 });
  const graos = semear(k, 46, R, H, (i) => {
    const rx = 0.0095 * k.r.f(0.85, 1.1), ry = rx * 0.48, rz = rx * 0.7;
    const tomG = mix(c1, c2, k.r.f(0, 0.5));
    const g = elipsoide(rx, ry, rz, (x, y, z) => {
      let c = mul(tomG, 0.95 + 0.08 * fbm(x * 700, y * 700, z * 700, s + i));
      if (pelada) c = mix(c, mul(c2, 1.1), suave(0, 1, y / ry) * 0.3);
      else c = mix(c, mul(c1, 0.75), (1 - suave(0, 0.18, Math.abs(x / rx - 0.92))) * 0.9);
      // risca do meio que separa os cotilédones
      if (pelada) c = mix(c, mul(c1, 0.7), (1 - suave(0, 0.08, Math.abs(z / rz))) * suave(0, 0.5, Math.abs(y / ry)) * 0.5);
      return c;
    }, 5, 8);
    return deformar(g, (p) => { p.z -= 0.18 * (p.x * p.x) / rx; });
  }, { deitado: true, afunda: 0.3 });
  return [parte(base, 'acetinado', true), parte(juntar(graos), pelada ? 'brilhante' : 'acetinado')];
};

const gMilhoDebulhado: Gerador = (k) => {
  // grãos soltos e alguns ainda grudados em fileira, base clara do corte e topo amarelo
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, H = R * 0.22;
  const base = monte(R * 0.82, H * 0.6, (x, y, z) => mul(c2, 0.75 + 0.1 * fbm(x * 300, y * 300, z * 300, s)), { s, rug: 0.12 });
  const graos = semear(k, 105, R, H, (i) => {
    const rx = 0.0043 * k.r.f(0.9, 1.1), ry = rx * 0.8, rz = rx * 1.05;
    const tomG = mix(c1, c2, k.r.f(0, 0.45));
    return elipsoide(rx, ry, rz, (x, y, z) => {
      let c = mul(tomG, 0.95 + 0.08 * fbm(x * 900, y * 900, z * 900, s + i));
      c = mix(c, ci, suave(0.2, 0.9, -x / rx) * 0.75);
      return c;
    }, 4, 6, (t, a) => 1 + 0.12 * Math.abs(Math.cos(a * 2)) * (1 - t));
  }, { deitado: false, afunda: 0.35 });
  return [parte(base, 'fosco', true), parte(juntar(graos), 'brilhante')];
};

const gFeijoes: Gerador = (k) => {
  // grãos de vários feijões: preto, vermelho, branco, aduki, mungo e grão-de-bico
  const { s } = k;
  const demolhado = k.v.v === 'demolhados';
  const R = k.T * 0.5, H = R * 0.4;
  const tipos: { c: RGB; rx: number; ry: number; rz: number; bico?: boolean; manchinha?: RGB }[] = [
    { c: rgb('#221c1e'), rx: 0.0062, ry: 0.0034, rz: 0.004, manchinha: rgb('#e8e0d0') },
    { c: rgb('#7a2a26'), rx: 0.0075, ry: 0.0038, rz: 0.0045 },
    { c: rgb('#ece4d0'), rx: 0.0068, ry: 0.0034, rz: 0.0042 },
    { c: rgb('#6a1e1a'), rx: 0.0042, ry: 0.0028, rz: 0.003, manchinha: rgb('#e8e0d0') },
    { c: rgb('#5a7a2a'), rx: 0.0032, ry: 0.0024, rz: 0.0026 },
    { c: rgb('#d8b878'), rx: 0.0048, ry: 0.0044, rz: 0.0046, bico: true },
  ];
  const fator = demolhado ? 1.12 : 1.22;
  const base = monte(R * 0.88, H * 0.8, (x, y, z) => mul(rgb('#5a3a2a'), 0.6 + 0.2 * fbm(x * 200, y * 200, z * 200, s)), { s, rug: 0.1 });
  const graos = semear(k, 74, R, H, (i) => {
    const tp = tipos[k.r.i(0, tipos.length - 1)];
    const rx = tp.rx * fator, ry = tp.ry * fator, rz = tp.rz * fator;
    const base = demolhado ? mul(tp.c, 1.05) : mix(tp.c, rgb('#b89a7a'), 0.15);
    const g = elipsoide(rx, ry, rz, (x, y, z) => {
      let c = mul(base, 0.92 + 0.1 * fbm(x * 800, y * 800, z * 800, s + i));
      if (tp.manchinha) c = mix(c, tp.manchinha, (1 - suave(0.0, 0.35, Math.hypot(x / rx, (z / rz) - 0.9))) * 0.9);
      if (!demolhado && !tp.bico) c = mix(c, mix(base, rgb('#f0e8d8'), 0.6), suave(0.78, 0.9, ruido(x * 900, y * 900, z * 900, s + i)) * 0.5);
      return c;
    }, 5, 8, tp.bico ? (t, a) => 1 + 0.12 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s + i) + 0.25 * suave(0.85, 1, t) : undefined);
    return tp.bico ? g : deformar(g, (p) => { p.z -= 0.22 * (p.x * p.x) / rx; });
  }, { deitado: true, afunda: 0.3 });
  return [parte(base, 'acetinado', true), parte(juntar(graos), demolhado ? 'umido' : 'acetinado')];
};

/* ------------------------------------------------------------------ */
/* arroz, cuscuz e bulgur                                               */
/* ------------------------------------------------------------------ */

const gArroz: Gerador = (k) => {
  // monte de grãos cozidos e soltos (agulha branco) ou o arroz de sushi brilhante e mais compacto
  const { c1, c2, s } = k;
  const sushi = k.v.v === 'sushi';
  const R = k.T * 0.5, H = R * (sushi ? 0.66 : 0.62), l = sushi ? 0.8 : 1;
  const corBase: CorFn = (x, y, z) => {
    const c = mul(c1, 0.9 + 0.08 * fbm(x * 500, y * 500, z * 500, s));
    return mix(c, mul(c2, 0.85), suave(0.7, 0.95, celula(x * 900, y * 2200, z * 900, s)) * 0.5);
  };
  const base = monte(R * 0.92, H * 0.92, corBase, { s, rug: sushi ? 0.04 : 0.1, l, m: 30 });
  const graos = semear(k, sushi ? 170 : 180, R, H, (i) => {
    const rx = (sushi ? 0.0022 : 0.0034) * k.r.f(0.9, 1.1), ry = sushi ? 0.0012 : 0.00085, rz = sushi ? 0.0014 : 0.00095;
    return elipsoide(rx, ry, rz, (x, y, z) => mul(mix(c1, c2, k.r.f(0, 0.4)), 0.96 + 0.06 * fbm(x * 2000, y * 2000, z * 2000, s + i)), 4, 5);
  }, { l, afunda: 0.55, deitado: true });
  return [parte(base, sushi ? 'brilhante' : 'acetinado', true), parte(juntar(graos), sushi ? 'brilhante' : 'acetinado')];
};

const gRisotoMoldado: Gerador = (k) => {
  // risoto desenformado em cilindro baixo, cremoso e com os grãos aparentes, lascas de parmesão
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, H = R * 0.85;
  const cremoso: CorFn = (x, y, z) => {
    let c = mul(c1, 0.92 + 0.08 * fbm(x * 400, y * 400, z * 400, s));
    c = mix(c, mul(c2, 0.9), suave(0.7, 0.95, celula(x * 700, y * 1500, z * 700, s)) * 0.5);
    return mix(c, ci, suave(0.72, 0.8, ruido(x * 900, y * 900, z * 900, s + 4)) * 0.6);
  };
  const corp = torno({
    caminho: [[0, 0], [R * 0.9, 0], [R * 1.02, H * 0.08], [R, H * 0.6], [R * 0.95, H * 0.92], [R * 0.75, H], [0, H * 1.04]],
    n: 20, m: 34, cor: cremoso,
    mod: (t, a) => 1 + 0.03 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 5, s) + 0.02 * suave(0.1, 0, t),
  });
  const graos: G[] = [];
  for (let i = 0; i < 70; i++) {
    const g = elipsoide(0.0029, 0.0014, 0.0016, (x, y, z) => mul(c1, 1.02 + 0.05 * fbm(x * 2000, y * 2000, z * 2000, s + i)), 4, 5);
    g.rotateY(k.r.f(0, TAU));
    if (i < 46) {
      const rr = R * 0.85 * Math.sqrt((i + 0.5) / 46), a = i * 2.39996;
      g.translate(Math.cos(a) * rr, H * (1.03 - 0.06 * (rr / R) ** 2), Math.sin(a) * rr);
    } else {
      const a = k.r.f(0, TAU), y = k.r.f(0.12, 0.85) * H;
      g.rotateZ(PI / 2);
      g.translate(Math.cos(a) * R * 1.005, y, Math.sin(a) * R * 1.005);
    }
    graos.push(g);
  }
  return [parte(corp, 'acetinado', true), parte(juntar(graos), 'brilhante')];
};

const gGraoMiudo: Gerador = (k) => {
  // monte fofo de grãos miúdos: cuscuz amarelo-claro ou bulgur dourado em pedacinhos angulosos
  const { c1, c2, s } = k;
  const bulgur = k.v.v === 'bulgur';
  const R = k.T * 0.5, H = R * 0.48;
  const base = monte(R * 0.95, H, (x, y, z) => {
    const c = mul(c1, 0.88 + 0.12 * fbm(x * 1500, y * 1500, z * 1500, s));
    return mix(c, c2, suave(0.6, 0.9, celula(x * 1600, y * 1600, z * 1600, s)) * 0.6);
  }, { s, rug: 0.1, n: 14, m: 34 });
  const graos = semear(k, 220, R * 0.98, H, (i) => {
    const cor = mix(c1, c2, k.r.f(0, 0.7));
    if (bulgur) return bloco(0.0018 * k.r.f(0.8, 1.2), 0.0012, 0.0015 * k.r.f(0.8, 1.2), (x, y, z) => mul(cor, 0.95 + 0.1 * ruido(x * 3000, y * 3000, z * 3000, s + i)));
    return elipsoide(0.0011, 0.0009, 0.001, () => cor, 3, 4);
  }, { afunda: 0.3 });
  return [parte(base, 'fosco', true), parte(juntar(graos), 'acetinado')];
};

/* ------------------------------------------------------------------ */
/* polenta                                                              */
/* ------------------------------------------------------------------ */

const gPolentaTriangulo: Gerador = (k) => {
  // triângulo de polenta firme (2 cm), com listras escuras de grelha canelada quando grelhado
  const { c1, c2, cc, s } = k;
  const grelhado = k.v.v === 'grelhado';
  const Lx = k.T, H = 0.02;
  const A: [number, number] = [-Lx / 2, -Lx * 0.33], B: [number, number] = [Lx / 2, -Lx * 0.33], C: [number, number] = [-Lx / 2, Lx * 0.38];
  const corF: CorFn = (x, y, z) => {
    let c = mul(c1, 0.94 + 0.08 * fbm(x * 600, y * 600, z * 600, s));
    c = mix(c, c2, suave(0.8, 0.95, celula(x * 900, y * 900, z * 900, s)) * 0.35);
    if (grelhado && (y > H * 0.98 || y < H * 0.02)) {
      c = mix(c, mul(cc, 1.1), 0.4 + 0.2 * fbm(x * 90, z * 90, 0, s));
      const fx = (x * 0.707 + z * 0.707) / 0.016;
      const lista = 1 - suave(0.08, 0.26, Math.abs(fx - Math.round(fx)));
      c = mix(c, rgb('#4a2a10'), lista * (0.75 + 0.2 * fbm(x * 300, z * 300, 0, s)));
    }
    return c;
  };
  const pt = (u: number, v: number, y: number): [number, number, number] => {
    const x = A[0] + u * (B[0] - A[0]) + u * v * (C[0] - B[0]);
    const z = A[1] + u * (B[1] - A[1]) + u * v * (C[1] - B[1]);
    return [x, y, z];
  };
  const cx = (A[0] + B[0] + C[0]) / 3, cz = (A[1] + B[1] + C[1]) / 3;
  const pecas: G[] = [grade(34, 34, (u, v) => pt(u, v, H), corF), grade(34, 34, (u, v) => pt(u, v, 0), corF)];
  for (const [P0, P1] of [[A, B], [B, C], [C, A]] as [number, number][][]) {
    pecas.push(grade(16, 2, (u, v) => [lerp(P0[0], P1[0], u), v * H, lerp(P0[1], P1[1], u)], (x, y, z) => mul(corF(x, H * 0.5, z, 0, 0), grelhado ? 0.95 : 1)));
  }
  return pecas.map((g, i) => parte(orientar(g, V(cx, H / 2, cz)), 'acetinado', i < 2));
};

/* ------------------------------------------------------------------ */
/* castanhas peladas                                                    */
/* ------------------------------------------------------------------ */

const gAmendoaPelada: Gerador = (k) => {
  // amêndoa sem pele: gota achatada cor de marfim com sulcos finos no comprimento
  const { c1, c2, s } = k;
  const L = k.T;
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 14, m: 16,
    perfil: (t) => {
      const w = Math.sin(PI * clamp(t)) ** 0.75 * (1 - 0.35 * t);
      return { ry: L * 0.19 * w, rz: L * 0.3 * w, cy: L * 0.19 };
    },
    mod: (t, a) => 1 + 0.03 * Math.cos(a * 2) * Math.sin(PI * t),
    cor: (x, y, z, t, a) => {
      let c = mul(c1, 0.95 + 0.06 * fbm(x * 900, y * 900, z * 900, s));
      c = mix(c, c2, Math.abs(Math.sin(a * 9 + x * 300)) ** 10 * 0.35);
      return mix(c, mul(c2, 0.95), suave(0.8, 1, t) * 0.4);
    },
  });
  return [parte(g, 'acetinado', true)];
};

const gAvelaPelada: Gerador = (k) => {
  // avelã tostada esfregada no pano: dourada, com restos da pele marrom presos nas dobras
  const { c1, c2, s } = k;
  const r = k.T * 0.5;
  const g = elipsoide(r, r * 0.95, r * 0.97, (x, y, z) => {
    let c = mul(c1, 0.92 + 0.12 * fbm(x * 600, y * 600, z * 600, s));
    c = mix(c, c2, suave(0.35, 0.6, fbm(x * 260, y * 260, z * 260, s + 2)) * 0.85);
    return mix(c, mul(c1, 1.15), suave(0.85, 1, y / r) * 0.3);
  }, 10, 14, (t, a) => 1 + 0.12 * suave(0.82, 1, t) * 0.5 + 0.04 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 4, s));
  return [parte(g, 'acetinado', true)];
};

const gCastanhaPelada: Gerador = (k) => {
  // castanha portuguesa sem casca nem pele: miolo creme de dobras fundas e uma face mais plana
  const { c1, c2, s } = k;
  const L = k.T;
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 14, m: 20,
    perfil: (t) => {
      const w = Math.sin(PI * clamp(t)) ** 0.6;
      return { ry: L * 0.32 * w, rz: L * 0.4 * w, cy: L * 0.3 };
    },
    mod: (t, a) => 1 - 0.14 * Math.abs(Math.sin(a * 1.5 + t * 3 + s)) ** 5 - 0.18 * suave(0.3, 1, -Math.cos(a)) + 0.04 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 5, s),
    cor: (x, y, z, t, a) => {
      let c = mul(c1, 0.94 + 0.08 * fbm(x * 500, y * 500, z * 500, s));
      c = mix(c, c2, Math.abs(Math.sin(a * 1.5 + t * 3 + s)) ** 5 * 0.7);
      return c;
    },
  });
  return [parte(g, 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* cebolas                                                              */
/* ------------------------------------------------------------------ */

const gCebolaAneis: Gerador = (k) => {
  // anéis de cebola descascada, brancos e soltos em dois grupos concêntricos e alguns avulsos
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const h = 0.005, w = 0.0026;
  const anel = (R: number, i: number) => tornoAnel({
    caminho: [[R + w / 2, 0], [R + w / 2, h], [R - w / 2, h], [R - w / 2, 0]], n: 8, m: 34,
    mod: (t, a) => 1 + 0.03 * Math.sin(a * 2 + i) + 0.015 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, i, s),
    cor: (x, y, z) => {
      const face = y < h * 0.05 || y > h * 0.95;
      let c = face ? mix(ci, c2, 0.25) : mix(c1, ci, 0.4);
      c = mul(c, 0.96 + 0.05 * fbm(x * 600, y * 600, z * 600, s + i));
      return face ? c : mix(c, c2, Math.abs(Math.sin(Math.atan2(z, x) * 30)) ** 12 * 0.25);
    },
  });
  const grupos: [number, number, number[]][] = [[-0.035, -0.005, [0.033, 0.026, 0.019, 0.012]], [0.035, 0.008, [0.03, 0.023, 0.016]]];
  let i = 0;
  for (const [cx, cz, rs] of grupos) for (const R of rs) out.push(parte(anel(R, i++).translate(cx, 0, cz), 'brilhante', i === 1));
  const g = anel(0.024, i++);
  g.rotateX(0.15);
  g.translate(0.005, 0.003, 0.04);
  out.push(parte(g, 'brilhante'));
  return out;
};

const gCebolaRodelas: Gerador = (k) => {
  // rodelas de cebola descascada em leque, com as camadas concêntricas no corte
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R = 0.034, H = 0.005;
  for (let i = 0; i < 6; i++) {
    const g = disco(R * (1 - i * 0.03), H, (x, y, z) => {
      const r = Math.hypot(x, z) / R;
      const onda = Math.abs(((r * 6.5 + 0.5) % 1) - 0.5) * 2;
      let c = mix(ci, mul(c2, 1.05), (1 - suave(0, 0.12, onda)) * 0.5);
      c = mix(c, rgb('#d8e0b0'), (1 - suave(0, 0.18, r)) * 0.4);
      if (r > 0.97) c = mix(c1, ci, 0.4);
      return mul(c, 0.97 + 0.04 * fbm(x * 500, y * 500, z * 500, s + i));
    }, { n: 12, m: 30, mod: (t, a) => 1 + 0.025 * Math.sin(a * 2 + i) });
    g.rotateZ(-0.14);
    g.translate(-0.05 + i * 0.019, 0.004 + i * 0.0035, (i % 2) * 0.004);
    out.push(parte(g, 'brilhante', i === 0));
  }
  return out;
};

const gCebolaMetade: Gerador = (k) => {
  // meia cebola sem casca, deitada com o corte para baixo e a raiz inteira na ponta
  const { c1, c2, ci, s } = k;
  const L = k.T, R = L * 0.47;
  const raio = (u: number) => R * Math.sin(PI * (0.05 + 0.9 * u)) ** 0.65 * (1 - 0.15 * suave(0.6, 1, u));
  const domo = grade(26, 16, (u, v) => {
    const th = v * PI, r = raio(u);
    return [(u - 0.5) * L, r * Math.sin(th) * 0.95, r * Math.cos(th)];
  }, (x, y, z, u, v) => {
    let c = mix(c1, ci, 0.35 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
    c = mix(c, c2, Math.abs(Math.sin(v * PI * 9)) ** 20 * 0.35);
    if (u < 0.06) c = mix(c, rgb('#b8a070'), suave(0.06, 0.0, u) * 0.9);
    return c;
  });
  const fundo = grade(26, 10, (u, v) => {
    const r = raio(u);
    return [(u - 0.5) * L, 0, r * (1 - 2 * v)];
  }, (x, y, z) => {
    const q = Math.hypot((x + L * 0.45) / L, z / R);
    const onda = Math.abs(((q * 7) % 1) - 0.5) * 2;
    return mix(ci, mul(c2, 1.05), (1 - suave(0, 0.15, onda)) * 0.45);
  });
  orientar(domo, V(0, -R, 0));
  orientar(fundo, V(0, R, 0));
  const raiz = elipsoide(R * 0.12, R * 0.22, R * 0.3, tom(rgb('#a89060'), 0.15, 900, s), 5, 10);
  raiz.translate(-L * 0.5, R * 0.2, 0);
  return [parte(domo, 'brilhante', true), parte(fundo, 'brilhante'), parte(raiz, 'fosco')];
};

/* ------------------------------------------------------------------ */
/* legumes asiáticos e frutos                                            */
/* ------------------------------------------------------------------ */

const gLotusRodelas: Gerador = (k) => {
  // rodelas de raiz de lótus descascada, cada uma com o furo do meio e o anel de furos em volta
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.25, H = 0.006;
  for (let i = 0; i < 4; i++) {
    const furos: [number, number, number][] = [[k.r.f(-0.0006, 0.0006), k.r.f(-0.0006, 0.0006), R * 0.14]];
    const nf = 7;
    for (let j = 0; j < nf; j++) {
      const a = (j / nf) * TAU + i * 0.4 + k.r.f(-0.08, 0.08);
      const rr = R * k.r.f(0.53, 0.58);
      furos.push([Math.cos(a) * rr, Math.sin(a) * rr, R * k.r.f(0.14, 0.17)]);
    }
    const face = (x: number, z: number): RGB => {
      let c = mul(ci, 0.95 + 0.06 * fbm(x * 700, z * 700, i, s));
      let perto = 0;
      for (const [cx, cz, r] of furos) perto = Math.max(perto, 1 - suave(0, r * 0.6, Math.hypot(x - cx, z - cz) - r));
      c = mix(c, mix(ci, c2, 0.45), perto * 0.5);
      return mix(c, mul(c1, 1.05), suave(0.9, 1, Math.hypot(x, z) / R) * 0.6);
    };
    const pecas = placaFurada(R, H, furos, face, tom(c1, 0.08, 500, s), tom(mix(ci, c2, 0.3), 0.06, 600, s), 20);
    const g = juntar(pecas);
    g.rotateZ(-0.08);
    g.rotateY(i * 0.5);
    g.translate(-0.06 + i * 0.04, i * 0.003, (i % 2 ? 1 : -1) * 0.006);
    out.push(parte(g, 'acetinado', i === 0));
  }
  return out;
};

const gMelaoAmargoFatias: Gerador = (k) => {
  // anéis de melão amargo sem miolo: casca verde de cristas e verrugas, polpa clara salteada
  const { c1, c2, ci, cc, s } = k;
  const out: Parte[] = [];
  const Ro = 0.021, Ri = 0.0105, H = 0.006;
  for (let i = 0; i < 6; i++) {
    const ri = Ri * k.r.f(0.9, 1.1);
    const g = tornoAnel({
      caminho: [[Ro, 0], [Ro, H], [ri, H], [ri, 0]], n: 10, m: 48,
      desloc: (p) => {
        const r = Math.hypot(p.x, p.z);
        if (r > (ri + Ro) / 2) {
          const a = Math.atan2(p.z, p.x);
          const f = 1 + 0.07 * Math.cos(a * 9 + i) + 0.05 * ruido(Math.cos(a) * 9, p.y * 500, Math.sin(a) * 9, s + i);
          p.x *= f;
          p.z *= f;
        }
      },
      cor: (x, y, z) => {
        const r = Math.hypot(x, z), a = Math.atan2(z, x);
        const face = y < H * 0.05 || y > H * 0.95;
        if (!face) {
          const sulco = 0.5 + 0.5 * Math.cos(a * 9 + i);
          return mul(mix(mul(c1, 0.7), mix(c1, c2, 0.4), sulco), 0.92 + 0.1 * fbm(x * 900, y * 900, z * 900, s + i));
        }
        let c = r > Ro * 0.86 ? mix(c1, c2, 0.3) : mix(ci, mix(ci, c2, 0.35), suave(ri * 1.15, ri, r) * 0.5 + suave(Ro * 0.7, Ro * 0.86, r) * 0.4);
        c = mix(c, cc, suave(0.45, 0.8, fbm(x * 300, z * 300, y * 100 + i, s)) * 0.35);
        return c;
      },
    });
    g.rotateZ(-0.1);
    g.translate(-0.055 + i * 0.022, i * 0.0025, (i % 2) * 0.008 - 0.004);
    out.push(parte(g, 'brilhante', i === 0));
  }
  return out;
};

const gLoofahPedacos: Gerador = (k) => {
  // pedaços de loofah descascada: verde-claro com listras onde ficavam as cristas, miolo esponjoso
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const pos: [number, number][] = [[-0.04, -0.01], [-0.005, 0.022], [0.03, -0.012], [0.05, 0.03], [-0.03, 0.045]];
  pos.forEach(([x, z], i) => {
    const r = 0.017 * k.r.f(0.9, 1.05), Lp = 0.04 * k.r.f(0.9, 1.1);
    const cor: CorFn = (px, py, pz, t, a) => {
      let c = mul(c1, 0.95 + 0.07 * fbm(px * 400, py * 400, pz * 400, s + i));
      return mix(c, c2, Math.abs(Math.sin(a * 5)) ** 30 * 0.6);
    };
    const corT: CorFn = (px, py, pz) => {
      const rr = Math.hypot(py, pz) / r, a = Math.atan2(pz, py);
      let c = mix(ci, mul(ci, 0.93), suave(0.7, 0.95, celula(py * 1500, pz * 1500, px * 1500, s + i)));
      const semente = (1 - suave(0.0, 0.12, Math.abs(rr - 0.45))) * Math.abs(Math.cos(a * 1.5)) ** 2;
      c = mix(c, rgb('#d8d0a8'), semente * 0.6);
      return mix(c, mix(c1, ci, 0.5), suave(0.85, 1, rr));
    };
    const g = pedacoInclinado(r, r * 0.98, Lp, i * 1.3, i * 1.3 + PI / 2, cor, corT, 18);
    pousar(g, x, z, k.r.f(0, TAU), k.r.f(0, TAU));
    out.push(parte(g, 'acetinado', i === 0));
  });
  return out;
};

const gAbacateCaroco: Gerador = (k) => {
  // as duas metades com a casca para baixo: uma com o caroço marrom no lugar, a outra com a cova
  const { c1, c2, ci, cc, s } = k;
  const L = k.T * 0.92, R = L * 0.29;
  const raio = (u: number) => R * Math.sin(PI * clamp(u)) ** 0.55 * (1 - 0.34 * suave(0.35, 1, u));
  const uP = 0.36, xp = (uP - 0.5) * L, rp = R * 0.56;
  const out: Parte[] = [];
  const meia = (comCaroco: boolean, giro: number, dz: number) => {
    const casca = grade(24, 12, (u, v) => {
      const r = raio(u), f = PI + v * PI;
      return [(u - 0.5) * L, R + r * Math.sin(f) * 0.95, r * Math.cos(f)];
    }, (x, y, z) => {
      const c = mul(c1, 0.85 + 0.2 * fbm(x * 300, y * 300, z * 300, s));
      return mix(c, mul(c2, 0.9), suave(0.7, 0.95, celula(x * 700, y * 700, z * 700, s)) * 0.5);
    });
    const face = grade(24, 10, (u, v) => {
      const r = raio(u), x = (u - 0.5) * L, z = r * (1 - 2 * v);
      const d = Math.hypot(x - xp, z);
      return [x, R - rp * 0.62 * Math.sqrt(Math.max(0, 1 - (d / rp) ** 2)), z];
    }, (x, y, z, u, v) => {
      const borda = Math.min(v, 1 - v) * 2;
      let c = mix(mix(cc, c2, 0.4), ci, suave(0.0, 0.5, borda));
      c = mix(c, mul(ci, 1.06), (1 - suave(rp, rp * 1.4, Math.hypot(x - xp, z))) * 0.4);
      return mul(c, 0.97 + 0.04 * fbm(x * 400, z * 400, 0, s));
    });
    orientar(casca, V(0, R * 2, 0));
    orientar(face, V(0, -R, 0));
    const pecas = [casca, face];
    if (comCaroco) {
      const p = elipsoide(rp * 0.98, rp * 0.92, rp * 0.9, (x, y, z) => {
        const c = mul(rgb('#7a4a2a'), 0.85 + 0.25 * fbm(x * 300, y * 300, z * 300, s + 9));
        return mix(c, rgb('#b88a5a'), suave(0.5, 0.8, fbm(x * 120, y * 120, z * 120, s + 4)) * 0.5);
      }, 10, 14);
      p.translate(xp, R - rp * 0.62 + rp * 0.9, 0);
      pecas.push(p);
    }
    return pecas.map((g) => {
      g.rotateY(giro);
      g.translate(0, 0, dz);
      return g;
    });
  };
  const [ca, fa, pa] = meia(true, 0.12, -R * 1.05);
  const [cb, fb] = meia(false, -0.2, R * 1.05);
  out.push(parte(juntar([ca, cb]), 'acetinado', true), parte(juntar([fa, fb]), 'umido'), parte(pa, 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* pimentas recheadas                                                   */
/* ------------------------------------------------------------------ */

const gPimentaoRecheado: Gerador = (k) => {
  // pimentão vermelho de pé, sem o quarto de cima, cheio de carne moída temperada; a tampa com o
  // cabo encostada ao lado
  const { c1, c2, ci, c3, s } = k;
  const R = 0.04, H = 0.072;
  const lobo = (t: number, a: number) => 1 + 0.07 * Math.cos(4 * a + 0.3) * suave(0.05, 0.3, t) + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s);
  const corPele: CorFn = (x, y, z, t, a) => {
    let c = mix(mul(c1, 0.75), c1, 0.5 + 0.5 * Math.cos(4 * a + 0.3));
    c = mul(c, 0.94 + 0.08 * fbm(x * 200, y * 200, z * 200, s));
    return mix(c, mul(c2, 0.9), suave(0.6, 0.9, fbm(x * 60, y * 60, z * 60, s + 2)) * 0.3);
  };
  const corpoP = torno({
    caminho: [[0, 0.004], [R * 0.45, 0], [R * 0.85, H * 0.1], [R, H * 0.4], [R * 0.96, H * 0.82], [R * 0.9, H * 0.99], [R * 0.83, H], [R * 0.7, H * 0.94], [0, H * 0.9]],
    n: 22, m: 32, mod: lobo,
    cor: (x, y, z, t, a) => (y > H * 0.985 ? mix(ci, c1, 0.3) : y > H * 0.93 && Math.hypot(x, z) < R * 0.86 ? mix(ci, rgb('#f4e4c8'), 0.3) : corPele(x, y, z, t, a)),
  });
  const carne: CorFn = (x, y, z) => {
    let c = mul(rgb('#9a4a3a'), 0.85 + 0.25 * fbm(x * 800, y * 800, z * 800, s + 1));
    c = mix(c, rgb('#e8c8b0'), suave(0.7, 0.85, ruido(x * 1500, y * 1500, z * 1500, s + 2)) * 0.6);
    return mix(c, rgb('#3a6a2a'), suave(0.78, 0.9, ruido(x * 1800, y * 1800, z * 1800, s + 3)) * 0.8);
  };
  const recheio = monte(R * 0.86, H * 0.32, carne, { s, rug: 0.22, n: 12, m: 30 });
  recheio.translate(0, H * 0.92, 0);
  // tampa: o quarto de cima com o cabo verde
  const tampa = torno({
    caminho: [[0, H * 0.06], [R * 0.6, 0.002], [R * 0.86, 0], [R * 0.88, 0.004], [R * 0.72, H * 0.2], [R * 0.32, H * 0.3], [R * 0.12, H * 0.27], [0, H * 0.26]],
    n: 14, m: 32, mod: (t, a) => lobo(t + 0.3, a),
    cor: (x, y, z, t, a) => (t < 0.32 ? mix(ci, mul(c1, 0.9), 0.35) : corPele(x, y, z, t, a)),
  });
  const cabo = tubo([V(0, H * 0.24, 0), V(0.002, H * 0.34, 0.001), V(0.006, H * 0.44, 0.002)], { raio: (t) => 0.0042 - 0.0012 * t, m: 8, n: 8, pontaRedonda: false, cor: tom(c3, 0.12, 600, s) });
  const tp = juntar([tampa, cabo]);
  tp.rotateZ(0.35);
  tp.translate(R * 2.15, 0.004, R * 0.3);
  return [parte(corpoP, 'brilhante', true), parte(recheio, 'acetinado'), parte(tp, 'brilhante')];
};

interface OpcPimenta { L: number; R: number; achata: number; potencia: number }

const perfilPimenta = (o: OpcPimenta) => (t: number) => {
  const r = o.R * Math.sin((PI / 2) * clamp(t) ** o.potencia) * (1 - 0.55 * suave(0.9, 1, t));
  const ry = Math.max(1e-4, r * o.achata);
  return { ry, rz: Math.max(1e-4, r), cy: o.R * o.achata + o.L * 0.06 * (1 - t) ** 3 };
};
const dobraPimenta = (t: number, a: number) => 1 + 0.05 * Math.cos(3 * a + 0.5) * suave(0.4, 0.9, t);

/** Corpo deitado de pimenta (ponta em x0, ombro do cabo em x1) e o cabo. */
function pimenta(k: K, o: OpcPimenta, cor: CorFn, corCabo: RGB, mod = dobraPimenta): G[] {
  const perf = perfilPimenta(o);
  const g = corpo({ x0: -o.L / 2, x1: o.L / 2, n: 26, m: 20, cor, mod, perfil: perf });
  const q = perf(0.98);
  const cabo = tubo([V(o.L * 0.46, q.cy + q.ry * 0.2, 0), V(o.L * 0.53, q.cy + o.R * 0.3, 0), V(o.L * 0.58, q.cy + o.R * 0.2, o.R * 0.15)], {
    raio: (t) => o.R * (0.2 - 0.1 * t), m: 8, n: 8, pontaRedonda: false, cor: tom(corCabo, 0.15, 600, k.s),
  });
  return [g, cabo];
}

/** Ponto da superfície da pimenta (sem as dobras), com folga `f` para fora. */
function superficiePimenta(o: OpcPimenta, t: number, a: number, f: number): [number, number, number] {
  const q = perfilPimenta(o)(t), m = dobraPimenta(t, a) + f;
  return [lerp(-o.L / 2, o.L / 2, t), q.cy + q.ry * Math.cos(a) * m, q.rz * Math.sin(a) * m];
}

const corFrita = (c1: RGB, c2: RGB, s: number, bolhas = 0.6): CorFn => (x, y, z, t, a) => {
  let c = mul(c1, 0.9 + 0.15 * fbm(x * 200, y * 200, z * 200, s));
  c = mix(c, mul(c1, 1.6), Math.abs(Math.cos(3 * a + 0.5)) ** 8 * 0.2);
  return mix(c, c2, suave(0.75, 0.92, celula(x * 260, y * 260, z * 260, s)) * bolhas);
};

const gPimentaRecheada: Gerador = (k) => {
  // chile frito, de pele empolada, aberto em cima com o recheio saindo pela fenda: queijo derretido
  // no poblano, caranguejo desfiado com coentro no Anaheim amarelo
  const { c1, c2, c3, s } = k;
  const caranguejo = k.v.v === 'caranguejo';
  const o: OpcPimenta = caranguejo ? { L: k.T, R: k.T * 0.13, achata: 0.75, potencia: 0.55 } : { L: k.T, R: k.T * 0.27, achata: 0.55, potencia: 0.8 };
  const [g, cabo] = pimenta(k, o, corFrita(c1, c2, s), c3);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = lerp(0.2, 0.86, i / 10);
    const [x, y, z] = superficiePimenta(o, t, 0, -0.15);
    pts.push(V(x, y, z + o.R * 0.04 * Math.sin(i * 1.3)));
  }
  const corRech: CorFn = caranguejo
    ? (x, y, z) => {
      let c = mul(rgb('#f2eadc'), 0.92 + 0.1 * fbm(x * 900, y * 900, z * 900, s));
      c = mix(c, rgb('#e8905e'), suave(0.6, 0.85, fbm(x * 500, y * 300, z * 500, s + 2)) * 0.7);
      return mix(c, rgb('#3a7a2a'), suave(0.8, 0.9, ruido(x * 1600, y * 1600, z * 1600, s + 3)) * 0.9);
    }
    : (x, y, z) => mix(mul(rgb('#f2d888'), 0.95 + 0.08 * fbm(x * 400, y * 400, z * 400, s)), rgb('#d8a040'), suave(0.6, 0.85, fbm(x * 200, y * 200, z * 200, s + 2)) * 0.5);
  const rech = tubo(pts, {
    raio: (t) => o.R * (caranguejo ? 0.42 : 0.3) * (0.4 + 0.6 * Math.sin(PI * t) ** 0.5) * (1 + 0.12 * fbm(t * 9, 0, 0, s)),
    achata: 1.3, cima: V(0, 1, 0), m: 12, n: 24, cor: corRech, mod: (t, a) => 1 + (caranguejo ? 0.18 : 0.08) * fbm(t * 12, Math.cos(a) * 2, Math.sin(a) * 2, s),
  });
  return [parte(g, 'brilhante', true), parte(cabo, 'acetinado'), parte(rech, caranguejo ? 'acetinado' : 'brilhante')];
};

const gPoblanoEmpanado: Gerador = (k) => {
  // poblano mergulhado na massa fina e frito: crosta dourada e irregular, cabo de fora
  const { c1, c2, c3, ci, s } = k;
  const o: OpcPimenta = { L: k.T, R: k.T * 0.27, achata: 0.55, potencia: 0.8 };
  const [g, cabo] = pimenta(k, o, (x, y, z) => {
    let c = mul(c1, 0.88 + 0.2 * fbm(x * 300, y * 300, z * 300, s));
    c = mix(c, c2, suave(0.55, 0.8, fbm(x * 180, y * 180, z * 180, s + 3)) * 0.7);
    return mix(c, ci, suave(0.72, 0.85, fbm(x * 90, y * 90, z * 90, s + 6)) * 0.6);
  }, c3, (t, a) => 1.12 + 0.08 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 9, s) + 0.05 * Math.cos(3 * a) * suave(0.4, 0.9, t));
  return [parte(g, 'acetinado', true), parte(cabo, 'acetinado')];
};

const gPoblanoGratinado: Gerador = (k) => {
  // poblano recheado, assado com a pele chamuscada, e o queijo derretido e gratinado por cima
  const { c1, c2, c3, s } = k;
  const o: OpcPimenta = { L: k.T, R: k.T * 0.27, achata: 0.55, potencia: 0.8 };
  const [g, cabo] = pimenta(k, o, corFrita(c1, c2, s, 0.85), c3);
  const queijo = grade(30, 14, (u, v) => {
    const t = lerp(0.1, 0.93, u);
    const lim = (1.05 + 0.5 * fbm(u * 7, 0.3, 0, s)) * Math.sin(PI * u) ** 0.35;
    return superficiePimenta(o, t, (v * 2 - 1) * lim, 0.06 + 0.03 * fbm(u * 20, v * 9, 0, s));
  }, (x, y, z) => {
    let c = mul(rgb('#f0c864'), 0.95 + 0.08 * fbm(x * 500, y * 500, z * 500, s));
    c = mix(c, rgb('#b8722a'), suave(0.55, 0.85, fbm(x * 260, y * 260, z * 260, s + 4)) * 0.8);
    return mix(c, rgb('#7a4a1a'), suave(0.88, 0.97, celula(x * 300, y * 300, z * 300, s + 5)) * 0.7);
  });
  orientarPor(queijo, (c) => V(0, c.y - o.R * o.achata, c.z));
  return [parte(g, 'brilhante', true), parte(cabo, 'acetinado'), parte(queijo, 'brilhante')];
};

/* ------------------------------------------------------------------ */
/* folhas cozidas e frituras                                            */
/* ------------------------------------------------------------------ */

const gEspinafreCozido: Gerador = (k) => {
  // monte de folhas murchas, verde-escuras e brilhantes, com alguns talinhos
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = R * 0.55;
  const base = monte(R * 0.85, H * 0.85, tom(mul(c1, 0.75), 0.15, 200, s), { s, rug: 0.18 });
  const folhas = semear(k, 22, R, H, (i) => {
    const Lf = k.r.f(0.045, 0.065), W = Lf * k.r.f(0.45, 0.6);
    const g = petala(Lf, W, {
      contorno: contornos.oval, curva: k.r.f(-0.3, 0.3), concha: k.r.f(-0.2, 0.2), ondula: 0.12, esp: 0.0008, n: 9, m: 6,
      cima: (x, y, z) => mix(mul(c1, 0.9 + 0.15 * fbm(x * 300, y * 300, z * 300, s + i)), c2, Math.abs(Math.sin(z * 900)) ** 14 * 0.3),
      baixo: (x, y, z) => mul(c2, 0.8 + 0.1 * fbm(x * 300, y * 300, z * 300, s + i)),
    });
    return g.translate(-Lf / 2, 0, 0);
  }, { deitado: true, afunda: 0.6 });
  const talos: G[] = [];
  for (let i = 0; i < 5; i++) {
    const a = k.r.f(0, TAU), r0 = R * k.r.f(0.2, 0.7);
    const p0 = V(Math.cos(a) * r0, altMonte(R, H)(r0) + 0.002, Math.sin(a) * r0);
    talos.push(tubo([p0, p0.clone().add(V(0.012, 0.002, 0.006)), p0.clone().add(V(0.024, -0.002, 0.004))], { raio: 0.0012, m: 5, n: 8, cor: tom(mix(c2, rgb('#c8d8a0'), 0.4), 0.1, 300, s) }));
  }
  return [parte(base, 'umido', true), parte(juntar(folhas), 'umido'), parte(juntar(talos), 'umido')];
};

const gAlgaCrespa: Gerador = (k) => {
  // repolho em fios finíssimos fritos até crocantes: monte de fios verde-escuros com açúcar e sal
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = R * 0.5;
  const alt = altMonte(R, H);
  const base = monte(R * 0.8, H * 0.75, tom(mul(c1, 0.6), 0.2, 300, s), { s, rug: 0.2 });
  const fios: G[] = [];
  for (let i = 0; i < 40; i++) {
    const pts: THREE.Vector3[] = [];
    let a = k.r.f(0, TAU), r = R * Math.sqrt(k.r.f(0.02, 0.9));
    for (let j = 0; j < 6; j++) {
      a += k.r.f(-0.6, 0.6);
      r = clamp(r + k.r.f(-0.012, 0.012), 0, R * 0.95);
      pts.push(V(Math.cos(a) * r, alt(r) + k.r.f(0.0, 0.004), Math.sin(a) * r));
    }
    fios.push(tubo(pts, { raio: 0.0008, m: 3, n: 18, cor: (x, y, z, t) => mix(mul(c1, 0.85 + 0.25 * fbm(x * 600, y * 600, z * 600, s + i)), c2, suave(0.7, 1, Math.abs(2 * t - 1)) * 0.6) }));
  }
  const graos: G[] = [];
  for (let i = 0; i < 30; i++) {
    const rr = R * Math.sqrt(k.r.f(0, 0.8)), a = k.r.f(0, TAU);
    graos.push(bloco(0.0012, 0.0012, 0.0012, () => rgb('#f4f2ea')).translate(Math.cos(a) * rr, alt(rr) + 0.004, Math.sin(a) * rr));
  }
  return [parte(base, 'acetinado', true), parte(juntar(fios), 'brilhante'), parte(juntar(graos), 'fosco')];
};

const gBatataFrita: Gerador = (k) => {
  // palitos de batata fritos duas vezes, dourados com pontas mais escuras, empilhados e salgados
  const { c1, c2, s } = k;
  const palitos: G[] = [];
  for (let i = 0; i < 28; i++) {
    const L = k.r.f(0.055, 0.075), e = 0.0095;
    const g = bloco(L, e, e, (x, y, z) => {
      let c = mul(c1, 0.92 + 0.14 * fbm(x * 400, y * 400, z * 400, s + i));
      c = mix(c, c2, suave(L * 0.3, L * 0.5, Math.abs(x)) * 0.6);
      return mix(c, c2, suave(0.004, 0.0048, Math.max(Math.abs(y), Math.abs(z))) * 0.3);
    }, [5, 1, 1]);
    const camada = Math.floor(i / 7);
    g.rotateY(camada * 1.1 + k.r.f(-0.5, 0.5));
    g.rotateZ(k.r.f(-0.12, 0.12));
    g.translate(k.r.f(-0.025, 0.025), e / 2 + camada * e * 0.92, k.r.f(-0.025, 0.025));
    palitos.push(g);
  }
  const sal: G[] = [];
  for (let i = 0; i < 26; i++) sal.push(bloco(0.0011, 0.0011, 0.0011, () => rgb('#f6f6f2')).translate(k.r.f(-0.03, 0.03), 0.0095 * k.r.f(1, 4), k.r.f(-0.03, 0.03)));
  return [parte(juntar(palitos), 'acetinado', true), parte(juntar(sal), 'brilhante')];
};

/* ------------------------------------------------------------------ */
/* massas frescas                                                       */
/* ------------------------------------------------------------------ */

const farinha = (c: RGB, s: number, quanto = 0.35): CorFn => (x, y, z) => {
  const b = mul(c, 0.95 + 0.06 * fbm(x * 300, y * 300, z * 300, s));
  return mix(b, rgb('#f8f4ea'), suave(0.55, 0.85, fbm(x * 160, y * 160, z * 160, s + 7)) * quanto);
};

const gMassaBola: Gerador = (k) => {
  // bola lisa de massa de ovos sovada, um pouco achatada, com a dobra de baixo e farinha
  const { c1, s } = k;
  const R = k.T * 0.5, H = R * 1.05;
  const g = torno({
    caminho: (u) => {
      const th = u * PI;
      const r = R * Math.sin(th) ** 0.85;
      return [r, (H / 2) * (1 - Math.cos(th)) * (th < PI / 2 ? 0.8 + 0.2 * (th / (PI / 2)) : 1)];
    },
    n: 18, m: 30, mod: (t, a) => 1 + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s) - 0.04 * (1 - suave(0, 0.05, Math.abs(Math.sin(a * 0.5 + 0.4)))) * suave(0.5, 0.2, t),
    cor: (x, y, z, t, a) => mix(farinha(c1, s, 0.3)(x, y, z, t, a), mul(c1, 0.85), (1 - suave(0, 0.04, Math.abs(Math.sin(a * 0.5 + 0.4)))) * suave(0.5, 0.2, t) * 0.6),
  });
  return [parte(g, 'acetinado', true)];
};

const gMassaDisco: Gerador = (k) => {
  // folha redonda fina aberta no rolo, de borda irregular, translúcida na borda e enfarinhada
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = 0.0018;
  const g = disco(R, H, (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    return mix(farinha(c1, s, 0.3)(x, y, z, 0, 0), mul(c2, 1.05), suave(0.85, 1, r) * 0.4);
  }, {
    n: 18, m: 48, mod: (t, a) => 1 + 0.03 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s),
    desloc: (p) => { p.y += 0.0012 * fbm(p.x * 14, 0, p.z * 14, s) + 0.0012; },
  });
  return [parte(g, 'acetinado', true)];
};

const gMassaFolha: Gerador = (k) => {
  // folha longa e lisa de 15 x 50 cm saída da máquina, levemente ondulada
  const { c1, c2, s } = k;
  const L = k.T, W = 0.15;
  const g = bloco(L, 0.0012, W, (x, y, z) => mix(farinha(c1, s, 0.2)(x, y, z, 0, 0), c2, Math.abs(Math.sin(z * 160 + fbm(x * 8, 0, 0, s))) ** 20 * 0.25), [50, 1, 14]);
  deformar(g, (p) => {
    p.y += 0.0006 + 0.0025 * (0.5 + 0.5 * Math.sin(p.x * 11 + 0.6)) * (0.6 + 0.4 * Math.cos(p.z * 18));
    p.z *= 1 + 0.02 * ruido(p.x * 12, 0, 0, s);
  });
  return [parte(g, 'acetinado', true)];
};

const gNinhoTagliatelle: Gerador = (k) => {
  // fitas de tagliatelle enroladas em ninho frouxo, oco no meio, com farinha
  const { c1, c2, s } = k;
  const R = k.T * 0.38, W = 0.009;
  const fitas: G[] = [];
  for (let i = 0; i < 6; i++) {
    const pts: THREE.Vector3[] = [];
    const a0 = (i / 6) * TAU, voltas = 2.3;
    for (let j = 0; j <= 28; j++) {
      const q = j / 28, a = a0 + q * voltas * TAU;
      const r = R * (0.75 + 0.25 * Math.sin(a * 1.3 + i)) * (0.85 + 0.15 * Math.sin(q * PI));
      pts.push(V(Math.cos(a) * r, 0.004 + 0.013 * (0.5 + 0.5 * Math.sin(a * 0.8 + i * 1.7)) * Math.sin(PI * q) ** 0.4, Math.sin(a) * r));
    }
    fitas.push(tubo(pts, { raio: W / 2, achata: 0.13, cima: V(0, 1, 0), m: 6, n: 64, pontaRedonda: false, cor: (x, y, z, t, a) => mix(farinha(c1, s + i, 0.3)(x, y, z, t, a), c2, Math.abs(Math.sin(a)) ** 12 * 0.3) }));
  }
  return [parte(juntar(fitas), 'acetinado', true)];
};

const gNhoqueCilindro: Gerador = (k) => {
  // uma tira única de massa crua rolada na bancada: roliça, lisa, de espessura uniforme, pontas
  // arredondadas e um leve pó de farinha (serve à massa de pão das roscas e à de nhoque)
  const { c1, s } = k;
  const L = k.T, R = 0.014;
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 16,
    perfil: (t) => {
      const d = Math.abs(2 * t - 1);
      const ponta = d < 0.9 ? 1 : Math.sqrt(Math.max(0, 1 - ((d - 0.9) / 0.1) ** 2));
      const r = R * (1 + 0.025 * Math.sin(t * 13 + s)) * Math.max(0.15, ponta);
      return { ry: r * 0.94, rz: r, cy: R * 0.94, cz: 0.006 * Math.sin(t * PI * 1.3 + 0.4) };
    },
    cor: farinha(c1, s, 0.1),
    desloc: (p) => { if (p.y < R * 0.12) p.y = R * 0.12 - (R * 0.12 - p.y) * 0.3; },
  });
  return [parte(g, 'acetinado', true)];
};

const gEspagueteCozido: Gerador = (k) => {
  // fios cozidos emaranhados num monte, brilhantes de manteiga
  const { c1, c2, s } = k;
  const R = k.T * 0.5, H = R * 0.42;
  const alt = altMonte(R, H);
  const base = monte(R * 0.82, H * 0.8, tom(mul(c1, 0.85), 0.08, 300, s), { s, rug: 0.08 });
  const fios: G[] = [];
  for (let i = 0; i < 12; i++) {
    const pts: THREE.Vector3[] = [];
    let a = (i / 12) * TAU;
    for (let j = 0; j < 15; j++) {
      a += 0.55 + k.r.f(-0.25, 0.25);
      const r = R * (0.15 + 0.8 * Math.abs(Math.sin(j * 0.45 + i * 0.7)));
      pts.push(V(Math.cos(a) * r, alt(r) + 0.0012 + k.r.f(0, 0.0025), Math.sin(a) * r));
    }
    fios.push(tubo(pts, { raio: 0.0011, m: 4, n: 56, cor: (x, y, z) => mul(mix(c1, c2, 0.2 + 0.3 * fbm(x * 200, y * 200, z * 200, s + i)), 1) }));
  }
  return [parte(base, 'brilhante', true), parte(juntar(fios), 'brilhante')];
};

const gDiscoMassaChinesa: Gerador = (k) => {
  // disco de massa de farinha e água aberto no rolo: branco, mais grosso no meio, bordas finas
  const { c1, s } = k;
  const R = k.T * 0.5;
  const g = disco(R, 0.0012, farinha(c1, s, 0.4), { n: 14, m: 36, centro: 2, mod: (t, a) => 1 + 0.025 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s) });
  return [parte(g, 'acetinado', true)];
};

const gFolhaRolinho: Gerador = (k) => {
  // folha quadrada, fina e clara de rolinho primavera, posta em losango
  const { c1, c2, s } = k;
  const Lq = k.T / Math.SQRT2;
  const g = bloco(Lq, 0.0006, Lq, (x, y, z) => mix(mul(c1, 0.97 + 0.04 * fbm(x * 200, y * 200, z * 200, s)), c2, suave(0.6, 0.85, fbm(x * 90, z * 90, 0, s + 3)) * 0.25), [16, 1, 16]);
  deformar(g, (p) => { p.y += 0.0003 + 0.0008 * (0.5 + 0.5 * fbm(p.x * 25, 0, p.z * 25, s)); });
  g.rotateY(PI / 4);
  return [parte(g, 'acetinado', true)];
};

const gCaneloneGratinado: Gerador = (k) => {
  // três canelones lado a lado cobertos de molho de tomate e parmesão gratinado; nas pontas, o
  // recheio verde de espinafre
  const { c1, c2, s } = k;
  const L = 0.1, R = 0.014;
  const zs = [-R * 2.05, 0, R * 2.05];
  const tubos = zs.map((zc, i) => corpo({
    x0: -L / 2, x1: L / 2, n: 10, m: 16, tampa: true, aneisTampa: 3,
    perfil: () => ({ ry: R * 0.92, rz: R, cy: R * 0.92, cz: zc }),
    cor: tom(c1, 0.06, 300, s + i),
    corTampa: (x, y, z) => {
      const r = Math.hypot(y - R * 0.92, z - zc) / R;
      return r > 0.84 ? c1 : mix(rgb('#4a6a2a'), rgb('#e8e0c8'), suave(0.5, 0.8, fbm(y * 900, z * 900, x, s)) * 0.6);
    },
  }));
  const Ax = L * 0.56, Bz = R * 3.7;
  const alt = (x: number, z: number) => {
    let h = 0.002;
    const fx = suave(L / 2 + 0.002, L / 2 - 0.008, Math.abs(x));
    for (const zc of zs) {
      const d = Math.abs(z - zc);
      if (d < R * 1.2) h = Math.max(h, (R * 0.92 + Math.sqrt(Math.max(0, (R * 1.2) ** 2 - d * d)) * 0.82) * fx + 0.002 * (1 - fx));
    }
    return h + 0.0015 * fbm(x * 60, 0, z * 60, s);
  };
  const molho = grade(40, 28, (u, v) => {
    const [a, b] = quadrado(u * 2 - 1, v * 2 - 1, 3);
    const x = a * Ax, z = b * Bz;
    return [x, alt(x, z), z];
  }, (x, y, z) => {
    let c = mul(c2, 0.9 + 0.15 * fbm(x * 200, y * 200, z * 200, s));
    const gr = suave(0.012, 0.026, y) * suave(0.35, 0.6, fbm(x * 120, y * 120, z * 120, s + 3));
    c = mix(c, rgb('#d8a048'), gr * 0.85);
    return mix(c, rgb('#7a4418'), suave(0.88, 0.97, celula(x * 260, y * 260, z * 260, s + 4)) * gr * 0.8);
  });
  orientarPor(molho, () => V(0, 1, 0));
  return [...tubos.map((g, i) => parte(g, 'acetinado', i === 1)), parte(molho, 'brilhante')];
};

const gEscargotSemConcha: Gerador = (k) => {
  // escargot fora da concha: corpo escuro em vírgula enrolada, pé mais claro, cubinhos de chalota
  const { c1, c2, ci, s } = k;
  const S = k.T;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const q = i / 12, a = q * 1.35 * TAU, r = S * (0.38 - 0.27 * q);
    pts.push(V(Math.cos(a) * r, S * 0.12 + q * S * 0.12, Math.sin(a) * r));
  }
  const corpoE = tubo(pts, {
    raio: (t) => S * (0.2 - 0.14 * t) * Math.min(1, 0.6 + t * 6), achata: 0.8, cima: V(0, 1, 0), m: 12, n: 40,
    mod: (t, a) => 1 + 0.08 * ruido(t * 40, Math.cos(a) * 3, Math.sin(a) * 3, s),
    cor: (x, y, z, t, a) => {
      let c = mix(c1, c2, 0.4 + 0.4 * fbm(x * 800, y * 800, z * 800, s));
      c = mix(c, ci, suave(0.2, -0.6, Math.cos(a)) * 0.7);
      return mul(c, 0.85 + 0.2 * Math.abs(ruido(x * 2500, y * 2500, z * 2500, s)));
    },
  });
  const pedacos: G[] = [];
  for (let i = 0; i < 9; i++) {
    const a = k.r.f(0, TAU), r = S * k.r.f(0.2, 0.55);
    const g = bloco(0.0032, 0.0022, 0.003, (x, y, z) => mix(rgb('#eee0e8'), rgb('#b87a9a'), suave(0.4, 0.9, fbm(x * 900, y * 900, z * 900, s + i)) * 0.5));
    g.rotateY(k.r.f(0, TAU));
    g.translate(Math.cos(a) * r, k.r.f(0.0012, S * 0.3), Math.sin(a) * r);
    pedacos.push(g);
  }
  return [parte(corpoE, 'umido', true), parte(juntar(pedacos), 'brilhante')];
};

/* ------------------------------------------------------------------ */
/* massas de pão e focaccia                                             */
/* ------------------------------------------------------------------ */

const gMassaPao: Gerador = (k) => {
  // massa de pão crua: pão redondo liso (emenda para baixo), bolinha de porção, ou a bola com as
  // bordas puxadas e franzidas em cima
  const { c1, c2, s } = k;
  const franzida = k.v.v === 'franzida';
  const R = k.T * 0.5, H = R * (franzida ? 0.82 : k.v.v === 'bolinha' ? 0.78 : 0.68);
  const prega = (t: number, a: number) => (franzida ? suave(0.55, 0.95, t) * (1 - Math.abs(Math.sin(a * 3.5 + 0.3 * Math.sin(t * 9))) ** 0.4) : 0);
  const g = torno({
    caminho: (u) => {
      if (u < 0.22) return [R * 0.92 * (u / 0.22), 0];
      const q = (u - 0.22) / 0.78, th = (q * PI) / 2;
      return [R * (0.92 + 0.08 * Math.sin(th * 2)) * Math.cos(th) ** 0.85, H * Math.sin(th) ** 0.9];
    },
    n: 20, m: 36,
    mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s) - 0.12 * prega(t, a),
    cor: (x, y, z, t, a) => {
      let c = farinha(c1, s, 0.25)(x, y, z, t, a);
      if (franzida) c = mix(c, mul(c1, 0.82), suave(0.2, 0.7, prega(t, a)) * 0.7);
      return mix(c, c2, suave(0.0, 0.3, t) * 0.08);
    },
  });
  return [parte(g, 'fosco', true)];
};

const gDiscosTourelle: Gerador = (k) => {
  // três discos de massa de pão, do maior ao menor, cortados e prontos para empilhar
  const { c1, s } = k;
  const out: Parte[] = [];
  const dados: [number, number, number][] = [[0.045, -0.035, 0], [0.034, 0.05, -0.016], [0.024, 0.042, 0.048]];
  dados.forEach(([R, x, z], i) => {
    const g = disco(R, 0.012, farinha(c1, s + i, 0.3), { n: 12, m: 30, mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t, s + i) });
    out.push(parte(g.translate(x, 0, z), 'fosco', i === 0));
  });
  return out;
};

const gFocaccia: Gerador = (k) => {
  // focaccia retangular dourada, com covinhas fundas de dedo, azeite nas covas, alecrim e sal grosso
  const { c1, c2, ci, cc, c3, s } = k;
  const A = k.T * 0.5, B = A * 0.68, H = 0.032;
  const centros: [number, number][] = [];
  for (let i = -4; i <= 4; i++) for (let j = -3; j <= 3; j++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * 0.026 + 0.004 * ruido(i, j, 0, s), z = j * 0.022 + 0.004 * ruido(i, j, 1, s);
    if (Math.abs(x) < A * 0.86 && Math.abs(z) < B * 0.84) centros.push([x, z]);
  }
  const cova = (x: number, z: number) => {
    let d = 9;
    for (const [cx, cz] of centros) d = Math.min(d, Math.hypot(x - cx, z - cz));
    return 1 - suave(0.0025, 0.0075, d);
  };
  const borda = (x: number, z: number) => ((Math.abs(x / A) ** 6 + Math.abs(z / B) ** 6) ** (1 / 6));
  const alt = (x: number, z: number) => H - H * 0.45 * suave(0.82, 1, borda(x, z)) - 0.0065 * cova(x, z) + 0.0018 * fbm(x * 40, 0, z * 40, s);
  const [topo, lado, fundo] = laje(A, B, alt, H * 0.55, (x, y, z) => {
    let c = mix(c1, c2, suave(0.3, 0.8, fbm(x * 60, 0, z * 60, s)) * 0.5);
    c = mix(c, cc, suave(0.85, 1, borda(x, z)) * 0.6);
    c = mix(c, ci, cova(x, z) * 0.55);
    return mul(c, 0.95 + 0.07 * fbm(x * 400, y * 400, z * 400, s + 2));
  }, (x, y, z) => mix(mul(cc, 0.95), c2, suave(0, H * 0.5, y) * 0.5), 46, 32);
  const extras: G[] = [];
  for (let i = 0; i < 30; i++) {
    const x = k.r.f(-A * 0.8, A * 0.8), z = k.r.f(-B * 0.8, B * 0.8);
    const g = bloco(0.012, 0.0012, 0.0016, (px, py, pz) => mul(c3, 0.85 + 0.25 * fbm(px * 800, py * 800, pz * 800, s + i)), [2, 1, 1]);
    g.rotateY(k.r.f(0, TAU));
    g.translate(x, alt(x, z) + 0.0007, z);
    extras.push(g);
  }
  const sal: G[] = [];
  for (let i = 0; i < 40; i++) {
    const x = k.r.f(-A * 0.85, A * 0.85), z = k.r.f(-B * 0.85, B * 0.85);
    const e = k.r.f(0.0015, 0.0024);
    const g = bloco(e, e * 0.7, e, () => rgb('#f6f6f0'));
    g.rotateY(k.r.f(0, TAU));
    g.translate(x, alt(x, z) + e * 0.25, z);
    sal.push(g);
  }
  return [parte(topo, 'acetinado', true), parte(juntar([lado, fundo]), 'fosco'), parte(juntar(extras), 'brilhante'), parte(juntar(sal), 'fosco')];
};

/* ------------------------------------------------------------------ */
/* assados                                                              */
/* ------------------------------------------------------------------ */

const gAlhoAssado: Gerador = (k) => {
  // cabeça de alho assada com o topo cortado: os dentes em corte, caramelizados, e a pele dourada
  const { c1, c2, ci, cc, s } = k;
  const R = k.T * 0.5, Hc = R * 1.3, thMax = PI * 0.7;
  const nd = 7;
  const lobo = (a: number) => 1 + 0.07 * Math.cos(nd * a);
  const rTopo = R * Math.sin(thMax);
  const g = torno({
    caminho: (u) => {
      if (u < 0.5) {
        const th = (u / 0.5) * thMax;
        return [R * Math.sin(th) * (th < 0.35 ? 0.55 + 0.45 * (th / 0.35) : 1), (Hc * (1 - Math.cos(th))) / (1 - Math.cos(thMax))];
      }
      const q = (u - 0.5) / 0.5;
      return [rTopo * (1 - q), Hc];
    },
    n: 32, m: 56,
    mod: (t, a) => (t < 0.5 ? lobo(a) : lerp(lobo(a), 1, (t - 0.5) / 0.5)) + 0.02 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 4, s),
    cor: (x, y, z, t, a) => {
      if (t < 0.5) {
        let c = mix(c1, c2, suave(0.3, 0.8, fbm(x * 150, y * 150, z * 150, s)) * 0.6);
        c = mix(c, mul(c2, 0.8), Math.abs(Math.sin(a * 30 + y * 200)) ** 16 * 0.4);
        c = mix(c, mul(c2, 0.75), (1 - suave(0, 0.25, Math.abs(Math.sin((nd * a) / 2)))) * 0.5);
        return mix(c, mul(c2, 0.7), suave(0.1, 0.0, t) * 0.6);
      }
      const r = Math.hypot(x, z) / rTopo, aa = Math.atan2(z, x);
      const setor = (((aa / TAU) * nd) % 1 + 1) % 1;
      const ds = Math.abs(setor - 0.5);
      const dente = (1 - suave(0.36, 0.46, ds)) * suave(0.3, 0.4, r) * (1 - suave(0.86, 0.95, r));
      const meio = 1 - suave(0.18, 0.24, Math.hypot(x / rTopo - 0.05, z / rTopo));
      const d = Math.max(dente, meio);
      let c = mix(rgb('#4a2c12'), mul(c1, 0.85), suave(0.9, 1, r) * 0.7);
      const miolo = mix(ci, cc, 0.45 + 0.5 * fbm(x * 500, z * 500, 0, s) + 0.4 * suave(0.2, 0.46, ds));
      c = mix(c, miolo, d);
      return c;
    },
  });
  return [parte(g, 'acetinado', true)];
};

const gBeterrabaAssada: Gerador = (k) => {
  // beterraba assada sem a casca: magenta escura e brilhante, topo aparado com anéis, raiz fina
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.46, H = R * 1.85;
  const g = torno({
    caminho: [[0, 0], [R * 0.25, H * 0.03], [R * 0.75, H * 0.2], [R * 0.98, H * 0.48], [R * 0.9, H * 0.76], [R * 0.55, H * 0.92], [R * 0.4, H * 0.93], [0, H * 0.935]],
    n: 22, m: 30, mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s),
    cor: (x, y, z, t) => {
      if (t > 0.86) {
        const r = Math.hypot(x, z) / (R * 0.55);
        return mix(ci, mul(c1, 0.85), Math.abs(Math.sin(r * 18)) ** 3 * 0.6);
      }
      let c = mul(c1, 0.9 + 0.15 * fbm(x * 200, y * 200, z * 200, s));
      return mix(c, c2, Math.abs(Math.sin(y * 600 + fbm(x * 30, z * 30, 0, s) * 3)) ** 16 * 0.4);
    },
  });
  const raiz = tubo([V(0, H * 0.04, 0), V(R * 0.1, -H * 0.06, R * 0.05), V(R * 0.5, -H * 0.12, R * 0.08)], { raio: (t) => R * (0.08 - 0.06 * t), m: 6, n: 10, cor: tom(c2, 0.1, 400, s) });
  return [parte(g, 'brilhante', true), parte(raiz, 'brilhante')];
};

const gBatataAssada: Gerador = (k) => {
  // pedaço de batata descascada, riscado com o garfo e assado no óleo até dourar e ficar crocante
  const { c1, c2, cc, s } = k;
  const rx = k.T * 0.5, ry = rx * 0.72, rz = rx * 0.82;
  const risco = (p: THREE.Vector3) => {
    const q = (p.y * 0.8 + p.z * 0.6) / 0.0028;
    return Math.abs(Math.sin(q * PI)) ** 10 * suave(-ry * 0.2, ry * 0.6, p.y);
  };
  const g = elipsoide(rx, ry, rz, () => c1, 16, 24, (t, a) => 1 + 0.06 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s));
  deformar(g, (p) => {
    if (p.x > rx * 0.62) p.x = rx * 0.62 + (p.x - rx * 0.62) * 0.25;
    const f = 1 - 0.035 * risco(p);
    p.y *= f;
    p.z *= f;
  });
  const pos = g.getAttribute('position');
  const C: number[] = [];
  const p = V();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    let c = mix(c1, cc, 0.5 + 0.4 * fbm(p.x * 160, p.y * 160, p.z * 160, s));
    c = mix(c, c2, risco(p) * 0.55);
    c = mix(c, mul(cc, 0.65), suave(0.7, 0.9, fbm(p.x * 90, p.y * 90, p.z * 90, s + 2)) * 0.45);
    const q = cl(c);
    C.push(q[0], q[1], q[2]);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return [parte(g, 'acetinado', true)];
};

const gGratinDauphinois: Gerador = (k) => {
  // gratin inteiro: fatias de batata sobrepostas em escamas, Gruyère dourado e bolhas tostadas; nos
  // lados, as camadas finas de batata e creme
  const { c1, c2, ci, cc, s } = k;
  const A = k.T * 0.5, B = A * 0.68, H = 0.04;
  const escama = (x: number, z: number) => {
    const linha = Math.floor(z / 0.018 + 50);
    const fx = ((x + (linha % 2) * 0.007) / 0.014 + 100) % 1;
    const fz = ((z / 0.018) % 1 + 1) % 1;
    return fx ** 2 * (0.6 + 0.4 * Math.sin(PI * fz));
  };
  const borda = (x: number, z: number) => (Math.abs(x / A) ** 6 + Math.abs(z / B) ** 6) ** (1 / 6);
  const alt = (x: number, z: number) => H - H * 0.2 * suave(0.88, 1, borda(x, z)) + 0.0028 * escama(x, z) + 0.001 * fbm(x * 80, 0, z * 80, s);
  const [topo, lado, fundo] = laje(A, B, alt, H * 0.8, (x, y, z) => {
    const e = escama(x, z);
    let c = mix(c1, cc, 0.25 + 0.3 * fbm(x * 70, 0, z * 70, s));
    c = mix(c, c2, suave(0.55, 0.95, e) * 0.7);
    c = mix(c, rgb('#6a3a14'), suave(0.88, 0.97, celula(x * 160, y * 160, z * 160, s)) * 0.65);
    return mul(c, 0.95 + 0.06 * fbm(x * 500, y * 500, z * 500, s + 1));
  }, (x, y, z) => {
    const camada = Math.abs(Math.sin((y / 0.0042) * PI + fbm(x * 30, z * 30, 0, s)));
    let c = mix(ci, mul(c1, 1.02), camada ** 3 * 0.6);
    return mix(c, mul(cc, 0.9), suave(H * 0.1, 0, y) * 0.5 + suave(H * 0.6, H * 0.8, y) * 0.4);
  }, 40, 28);
  return [parte(topo, 'acetinado', true), parte(juntar([lado, fundo]), 'acetinado')];
};

const gOssoTutano: Gerador = (k) => {
  // rodela de osso de canela com o tutano no meio, branqueada: osso marfim e tutano rosado
  const { c1, c2, ci, cc, s } = k;
  const Ro = k.T * 0.5, Ri = Ro * 0.5, H = Ro * 0.95;
  const osso = tornoAnel({
    caminho: [[Ro, 0], [Ro, H], [Ri, H], [Ri, 0]], n: 12, m: 30,
    mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t, s) + 0.04 * Math.cos(a * 2),
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      const face = y < H * 0.03 || y > H * 0.97;
      if (face) return mix(mul(c1, 0.95), c2, suave(0.6, 0.9, celula(x * 900, z * 900, y, s)) * 0.5);
      if (r < (Ri + Ro) / 2) return mix(ci, c2, 0.4);
      let c = mul(c1, 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, s));
      return mix(c, rgb('#c08a6a'), suave(0.6, 0.85, fbm(x * 120, y * 120, z * 120, s + 2)) * 0.5);
    },
  });
  const miolo = torno({
    caminho: [[0, H * 0.02], [Ri * 1.0, H * 0.02], [Ri * 1.0, H * 0.98], [Ri * 0.8, H * 1.05], [0, H * 1.07]],
    n: 12, m: 22,
    cor: (x, y, z) => {
      const c = mix(ci, cc, suave(0.4, 0.8, fbm(x * 400, y * 400, z * 400, s)) * 0.5);
      return mix(c, rgb('#a83a3a'), suave(0.8, 0.92, ruido(x * 1200, y * 1200, z * 1200, s + 3)) * 0.5);
    },
  });
  return [parte(osso, 'acetinado', true), parte(miolo, 'umido')];
};

/* ------------------------------------------------------------------ */
/* registro                                                             */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'c3-erva-doce-aparada': { visual: vis('bulbo', 'erva_doce', 0.1, 'eef2dc c8d8a0 f4f6e6 d8d090 7aa048', { ac: 'acetinado' }), gerar: gErvaDoceAparada },
  'c3-couve-rabano-aparada': { visual: vis('bulbo', 'couve_rabano', 0.08, 'b8d890 9ab870 f0f4e0 c8c890', { ac: 'acetinado' }), gerar: gCouveRabanoAparada },
  'c3-alho-poro-aparado': { visual: vis('talo', 'poro', 0.26, 'f2f2e4 b8d090 f4f4ea d8c890'), gerar: gAlhoPoroAparado },
  'c3-alcachofra-recheada': { visual: vis('folhoso', 'alcachofra', 0.1, '7a8a4a 7a5a6a d8d8a8 8a7a4a'), gerar: gAlcachofraRecheada },
  'c3-alcachofra-giudea': { visual: vis('folhoso', 'alcachofra', 0.085, 'b07a2a 4a2a10 e0b860 a8702a'), gerar: gAlcachofraGiudea },
  'c3-cenoura-aparada': { visual: vis('cone', 'longa', 0.17, 'e8741e c85a12 f08a2a d86a1a'), gerar: gCenouraAparada },
  'c3-cenoura-toco': { visual: vis('cone', 'toco', 0.05, 'f08a2a d0681a f6a040 d86a1a'), gerar: gCenouraToco },
  'c3-cenoura-girada': { visual: vis('cone', 'girada', 0.1, 'f08a2a d0681a f6a040 d86a1a'), gerar: gCenouraGirada },
  'c3-cenoura-fitas': { visual: vis('cone', 'fitas', 0.17, 'f08a2a d0681a f6aa50 d86a1a'), gerar: gCenouraFitas },
  'c3-shiitake-seco': { visual: vis('cogumelo', 'seco', 0.1, '5a3a24 c8a880 e0d0b0 4a2e1a'), gerar: gShiitake },
  'c3-shiitake-hidratado': { visual: vis('cogumelo', 'hidratado', 0.1, '4a2c1a a07a58 d8c4a0 3a2414'), gerar: gShiitake },
  'c3-ervilhas-debulhadas': { visual: vis('vagem', 'graos', 0.09, '5aa03a 86c45a 7ab04a 4a7a2a'), gerar: gErvilhas },
  'c3-favas-graos': { visual: vis('vagem', 'graos', 0.11, 'b8c098 a0aa7a dce4b8 8a9a5a'), gerar: gFavas },
  'c3-favas-peladas': { visual: vis('vagem', 'peladas', 0.1, '6ab43a 94d064 c8e8a0 5a8a2a'), gerar: gFavas },
  'c3-milho-debulhado': { visual: vis('espiga', 'graos', 0.1, 'f2c438 e0a828 f8e8b8 d8a030'), gerar: gMilhoDebulhado },
  'c3-feijoes-cozidos': { visual: vis('vagem', 'cozidos', 0.1, '5a3a2a 3a2418 d8c8a0 6a4a30'), gerar: gFeijoes },
  'c3-feijoes-demolhados': { visual: vis('vagem', 'demolhados', 0.1, '5a3a2a 3a2418 d8c8a0 6a4a30'), gerar: gFeijoes },
  'c3-arroz-solto': { visual: vis('massa', 'solto', 0.1, 'f6f3ea e6e0d0 f8f6ee f0ead8'), gerar: gArroz },
  'c3-arroz-sushi': { visual: vis('massa', 'sushi', 0.09, 'f8f6f0 e8e6de f8f8f4 f0eee6'), gerar: gArroz },
  'c3-risoto-moldado': { visual: vis('massa', 'risoto', 0.075, 'efe2b8 d8c890 f6f0dc e0c890'), gerar: gRisotoMoldado },
  'c3-cuscuz-solto': { visual: vis('massa', 'cuscuz', 0.11, 'f0d890 d8bc6a f0d890 d8b860'), gerar: gGraoMiudo },
  'c3-bulgur-hidratado': { visual: vis('massa', 'bulgur', 0.11, 'c89a52 8a6a30 c89a52 9a7a3a'), gerar: gGraoMiudo },
  'c3-polenta-triangulo': { visual: vis('barra', 'cru', 0.09, 'e8c050 c89a30 eec860 c88a30'), gerar: gPolentaTriangulo },
  'c3-polenta-triangulo-grelhada': { visual: vis('barra', 'grelhado', 0.09, 'e8bc4a c89a30 eec860 c8862a'), gerar: gPolentaTriangulo },
  'c3-amendoa-pelada': { visual: vis('castanha', 'pelada', 0.024, 'f2e8d0 d8c8a4 f6efe0 e0c890'), gerar: gAmendoaPelada },
  'c3-avela-pelada': { visual: vis('castanha', 'pelada', 0.017, 'c8904a 7a4a24 f0dcb0 b07a3a'), gerar: gAvelaPelada },
  'c3-castanha-pelada': { visual: vis('castanha', 'pelada', 0.03, 'e8d098 b89050 f2e0b0 d8a868'), gerar: gCastanhaPelada },
  'c3-cebola-aneis': { visual: vis('bulbo', 'aneis', 0.13, 'f4f0e2 d8dcb8 f8f6ee e8d8a0'), gerar: gCebolaAneis },
  'c3-cebola-rodelas': { visual: vis('bulbo', 'rodelas', 0.16, 'f4f0e2 d8dcb8 f8f6ee e8d8a0'), gerar: gCebolaRodelas },
  'c3-cebola-metade': { visual: vis('bulbo', 'metade', 0.085, 'f2ecd8 d0d4a8 f8f4e8 e8d8a0'), gerar: gCebolaMetade },
  'c3-lotus-rodelas': { visual: vis('rizoma', 'lotus', 0.2, 'dcc8a8 c8a8a0 f2ebdf d8c8a8'), gerar: gLotusRodelas },
  'c3-melao-amargo-fatias': { visual: vis('fuso', 'melao_amargo', 0.16, '5a9a3a 9ac86a eaf0d4 c89a4a'), gerar: gMelaoAmargoFatias },
  'c3-loofah-pedacos': { visual: vis('fuso', 'loofah', 0.13, 'dfe8c4 8aa860 f2f0dc c8d0a0'), gerar: gLoofahPedacos },
  'c3-abacate-caroco': { visual: vis('tropical', 'abacate', 0.14, '2a3a1e 4a5a2a e2e090 7ab040'), gerar: gAbacateCaroco },
  'c3-pimentao-recheado': { visual: vis('pimenta', 'pimentao', 0.17, 'd8201a 9a140c f0a080 a8402a 3a6a2a', { ac: 'brilhante' }), gerar: gPimentaoRecheado },
  'c3-poblano-recheado-queijo': { visual: vis('pimenta', 'queijo', 0.12, '1e4a1e 3a2a14 c8d8a0 3a4a2a 5a6a2a'), gerar: gPimentaRecheada },
  'c3-anaheim-recheado-caranguejo': { visual: vis('pimenta', 'caranguejo', 0.15, 'e0b828 7a5a18 f0e0a0 c89a2a 5a6a2a'), gerar: gPimentaRecheada },
  'c3-poblano-empanado': { visual: vis('pimenta', 'empanado', 0.13, 'd8a040 9a5a1e 4a6a2a b07a2a 5a6a2a'), gerar: gPoblanoEmpanado },
  'c3-poblano-gratinado': { visual: vis('pimenta', 'gratinado', 0.12, '2a4a1e 1a1a10 c8d8a0 3a4a2a 5a6a2a'), gerar: gPoblanoGratinado },
  'c3-espinafre-cozido': { visual: vis('folhoso', 'cozido', 0.1, '2a4a1e 3e6a2a 3a5a26 2a4a1e'), gerar: gEspinafreCozido },
  'c3-alga-crespa': { visual: vis('folhoso', 'alga', 0.09, '1e3a1a 2e2a12 2a4a1e 1e3018'), gerar: gAlgaCrespa },
  'c3-batata-frita': { visual: vis('esferoide', 'palito', 0.1, 'e0a840 a8661e f2dca0 c88a30'), gerar: gBatataFrita },
  'c3-massa-bola': { visual: vis('massa_bola', 'bola', 0.1, 'eed088 e0c070 eed088 e0c070'), gerar: gMassaBola },
  'c3-massa-disco': { visual: vis('placa', 'disco', 0.36, 'eed088 f6e2a8 eed088 e0c070'), gerar: gMassaDisco },
  'c3-massa-folha': { visual: vis('placa', 'folha', 0.5, 'eed088 e0c070 eed088 e0c070'), gerar: gMassaFolha },
  'c3-ninho-tagliatelle': { visual: vis('massa', 'ninho', 0.075, 'f0d880 d8b860 f0d880 e8c870'), gerar: gNinhoTagliatelle },
  'c3-nhoque-cilindro': { visual: vis('massa', 'cilindro', 0.25, 'ecdcb0 d8c490 f0e4c0 e0c890'), gerar: gNhoqueCilindro },
  'c3-espaguete-cozido': { visual: vis('massa', 'cozido', 0.1, 'f2d890 e0bc60 f2d890 e8c870'), gerar: gEspagueteCozido },
  'c3-massa-chinesa-disco': { visual: vis('placa', 'disco', 0.1, 'f2eadc e4dac4 f2eadc e8d8b0'), gerar: gDiscoMassaChinesa },
  'c3-folha-rolinho-quadrada': { visual: vis('placa', 'quadrada', 0.28, 'f2ead8 e0d4b8 f2ead8 e0c890'), gerar: gFolhaRolinho },
  'c3-canelone-gratinado': { visual: vis('massa', 'gratinado', 0.12, 'f2e0a0 b83a22 f2e0a0 d8a048'), gerar: gCaneloneGratinado },
  'c3-escargot-sem-concha': { visual: vis('miudo', 'escargot', 0.03, '4a3a2a 6a5038 9a8060 5a4030'), gerar: gEscargotSemConcha },
  'c3-pao-redondo-cru': { visual: vis('massa_bola', 'redondo', 0.17, 'ecd8b0 d8c098 f4ecd8 c8883a'), gerar: gMassaPao },
  'c3-massa-pao-franzida': { visual: vis('massa_bola', 'franzida', 0.16, 'ecd8b0 d8c098 f4ecd8 c8883a'), gerar: gMassaPao },
  'c3-massa-pao-bolinha': { visual: vis('massa_bola', 'bolinha', 0.055, 'ecd8b0 d8c098 f4ecd8 c8883a'), gerar: gMassaPao },
  'c3-massa-pao-discos': { visual: vis('massa_bola', 'discos', 0.16, 'ecd8b0 d8c098 f4ecd8 c8883a'), gerar: gDiscosTourelle },
  'c3-focaccia-covinhas': { visual: vis('pao_chato', 'covinhas', 0.25, 'd8a050 e8c070 f0d898 a86a28 3a5a2a'), gerar: gFocaccia },
  'c3-alho-assado': { visual: vis('bulbo', 'assado', 0.065, 'd8c090 a8804a e8b860 b8742a'), gerar: gAlhoAssado },
  'c3-beterraba-assada': { visual: vis('esferoide', 'raiz', 0.075, '7a1838 4a0a20 a8305a 6a1a2a'), gerar: gBeterrabaAssada },
  'c3-batata-assada': { visual: vis('esferoide', 'assada', 0.06, 'e8c070 8a5418 f2e2b0 c88a38'), gerar: gBatataAssada },
  'c3-batata-gratinada': { visual: vis('torta', 'gratin', 0.22, 'e8c070 a86a28 f0e0b0 c88a38'), gerar: gGratinDauphinois },
  'c3-osso-tutano': { visual: vis('carne_osso', 'osso_tutano', 0.045, 'dccaa8 b89878 d49a84 b06a50'), gerar: gOssoTutano },
};
