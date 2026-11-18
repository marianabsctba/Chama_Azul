// Alimentos novos pedidos pela ficha de cena (cena4): as formas intermediárias e os pratos prontos que
// faltavam nas frutas (maçã descascada e vazada, casca em espiral, pera em leque, meias-luas, ruibarbo
// sem folhas, abacaxi em cilindro, descascado, em quarto e caramelado, cereja descaroçada, morango sem
// cálice e ao meio, fatias de manga, laranja à vif, julienne e raspas de lima, metades de uva, groselhas
// soltas, maracujá, papaia, pitaia e kiwano ao meio, sapotilha, nêspera, mangostão, figo-da-índia e
// lichia descascados, frutas secas cozidas), nas sobremesas (conchas com ganache, suflês, gelatinas
// com frutas, custard, brûlée, charlotte, chocolate picado, semifreddo, limão givré, ninho de caramelo)
// e na pastelaria e nos bolos (pâte sucrée, barquinha recheada, massa aberta, folhas e trança de massa,
// cone e pétalas, bomba redonda, baklava, strudel, bouchée, pão-de-ló fino, rocambole, operetta, trufa,
// biscoito com passas, rolo de massa, tuile curva e Sachertorte escrita).
// As peças de desenho de base (grade, chapa, bloco, pétala) vêm de frutas_enfeites.ts.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { contornos, caule, folha, type Gerador } from '../pecas';
import { cabinho } from '../fam_vegetais';
import { vis, grade, chapa, bloco, petala, orientar, apontar, discoPolar, type K } from './frutas_enfeites';
import type { Lote } from './tipos';

type P2 = [number, number];
type P3 = [number, number, number];

/* ------------------------------------------------------------------ */
/* utilidades                                                           */
/* ------------------------------------------------------------------ */

const cl = (c: RGB): RGB => [clamp(c[0]), clamp(c[1]), clamp(c[2])];
const frac = (v: number) => v - Math.floor(v);
/** Número fixo de 0 a 1 por índice (não depende da ordem dos sorteios). */
const hash = (i: number, s = 0) => frac(Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453);
/** Distância (0 a 0,5) ao inteiro mais próximo: 0 em cima da linha. */
const linha = (v: number) => { const f = frac(v); return Math.min(f, 1 - f); };
const tomR = (c: RGB, amp: number, f: number, s: number): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));
/** Pinta (0 a 1) nas células de um ruído celular: 1 no centro da pinta. */
const pinta = (x: number, y: number, z: number, f: number, tam: number, s: number) => 1 - suave(tam * 0.6, tam, celula(x * f, y * f, z * f, s));

function geo(P: number[], C: number[], I: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** Fração do comprimento de arco de um caminho até o vértice `ate`. */
function arco(c: P2[], ate: number): number {
  let tot = 0, parc = 0;
  for (let i = 1; i < c.length; i++) {
    const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    tot += d;
    if (i <= ate) parc += d;
  }
  return parc / Math.max(1e-9, tot);
}

/**
 * Polígono (y, z) puxado ao longo de X, com as laterais divididas em `nx` faixas e as tampas em `nr`
 * anéis (a tampa recebe em t a fração do raio, de 0 no centro a 1 na borda). O polígono precisa ser
 * estrelado em volta do centroide; o sentido é acertado sozinho.
 */
function extrusao(poly0: P2[], x0: number, x1: number, cor: CorFn, o: { tampa?: CorFn; nx?: number; nr?: number; nr0?: number; sub?: number } = {}): THREE.BufferGeometry {
  const sub = o.sub ?? 1;
  let poly: P2[] = [];
  for (let k = 0; k < poly0.length; k++) {
    const [ya, za] = poly0[k], [yb, zb] = poly0[(k + 1) % poly0.length];
    for (let q = 0; q < sub; q++) poly.push([lerp(ya, yb, q / sub), lerp(za, zb, q / sub)]);
  }
  let area = 0;
  for (let k = 0; k < poly.length; k++) {
    const [ya, za] = poly[k], [yb, zb] = poly[(k + 1) % poly.length];
    area += ya * zb - yb * za;
  }
  if (area < 0) poly = poly.reverse();
  const N = poly.length, nx = o.nx ?? 1;
  let cy = 0, cz = 0;
  for (const [y, z] of poly) { cy += y; cz += z; }
  cy /= N; cz /= N;
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const add = (x: number, y: number, z: number, f: CorFn, t: number, a: number) => {
    P.push(x, y, z);
    const c = cl(f(x, y, z, t, a));
    C.push(c[0], c[1], c[2]);
    return P.length / 3 - 1;
  };
  for (let i = 0; i <= nx; i++) {
    const x = lerp(x0, x1, i / nx);
    for (let j = 0; j < N; j++) add(x, poly[j][0], poly[j][1], cor, i / nx, j / N);
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j, b = i * N + ((j + 1) % N), c = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
      I.push(a, b, c, b, d, c);
    }
  }
  const ft = o.tampa ?? cor;
  const tampa = (x: number, nr: number, cima: boolean) => {
    const c0 = add(x, cy, cz, ft, 0, 0);
    const an: number[][] = [];
    for (let q = 1; q <= nr; q++) {
      const f = q / nr;
      an.push(poly.map(([y, z], j) => add(x, cy + (y - cy) * f, cz + (z - cz) * f, ft, f, j / N)));
    }
    const tri = (a: number, b: number, c: number) => (cima ? I.push(a, b, c) : I.push(a, c, b));
    for (let j = 0; j < N; j++) tri(c0, an[0][j], an[0][(j + 1) % N]);
    for (let q = 0; q < nr - 1; q++) {
      for (let j = 0; j < N; j++) {
        const j2 = (j + 1) % N;
        tri(an[q][j], an[q + 1][j], an[q + 1][j2]);
        tri(an[q][j], an[q + 1][j2], an[q][j2]);
      }
    }
  };
  tampa(x1, o.nr ?? 1, true);
  tampa(x0, o.nr0 ?? o.nr ?? 1, false);
  return geo(P, C, I);
}

/** Inclina as pontas de uma peça ao longo de X (corte na diagonal). */
function cisalhar(g: THREE.BufferGeometry, kx: number): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + kx * p.getZ(i));
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Meia peça deitada com o corte para cima: casca por baixo e face (com cavidade opcional) em cima. */
interface OpcMeia {
  L: number;
  nt: number;
  nv: number;
  /** Resolução da face de corte, quando precisa de mais detalhe que a casca. */
  nf?: [number, number];
  raio: (t: number) => { ry: number; rz: number };
  pele: CorFn;
  face: CorFn;
  cava?: (x: number, z: number) => number;
}
function meia(o: OpcMeia): { casca: THREE.BufferGeometry; face: THREE.BufferGeometry; yc: number } {
  let yc = 0;
  for (let i = 0; i <= 24; i++) yc = Math.max(yc, o.raio(i / 24).ry);
  const casca = grade(o.nt, o.nv, (u, v) => {
    const { ry, rz } = o.raio(u);
    const f = PI + v * PI;
    return [(u - 0.5) * o.L, yc + ry * Math.sin(f), rz * Math.cos(f)];
  }, o.pele);
  const [ft, fv] = o.nf ?? [o.nt, o.nv];
  const face = grade(ft, fv, (u, v) => {
    const { rz } = o.raio(u);
    const x = (u - 0.5) * o.L, z = -rz + 2 * rz * v;
    return [x, yc - (o.cava ? o.cava(x, z) : 0), z];
  }, o.face, true);
  return { casca, face, yc };
}
/** Ponto e normal na casca da meia peça (u ao longo, f de PI a 2PI em volta). */
function naCasca(o: OpcMeia, yc: number, u: number, f: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const { ry, rz } = o.raio(u);
  return {
    p: V((u - 0.5) * o.L, yc + ry * Math.sin(f), rz * Math.cos(f)),
    n: V(0, Math.sin(f) / Math.max(1e-6, ry), Math.cos(f) / Math.max(1e-6, rz)).normalize(),
  };
}

/** Monte de peças soltas, giradas ao acaso e mais altas no meio. */
function monte(k: K, n: number, R: number, H: number, peca: (i: number) => THREE.BufferGeometry, deitar = 0.6): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, rr = Math.sqrt(f) * R, a = i * 2.39996 + k.r.f(-0.3, 0.3);
    const g = peca(i);
    g.rotateX(k.r.f(-deitar, deitar));
    g.rotateY(k.r.f(0, TAU));
    g.rotateZ(k.r.f(-deitar, deitar));
    g.translate(Math.cos(a) * rr, H * (1 - f) * k.r.f(0.7, 1.1), Math.sin(a) * rr);
    out.push(g);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* maçã e pera                                                          */
/* ------------------------------------------------------------------ */

const RM = 0.037, HM = 0.068;
/** Perfil [raio, altura] da maçã, de s = 0 (olho, embaixo) a 1 (cabo). */
function perfilMaca(s: number): P2 {
  const th = s * PI;
  const r = RM * Math.sin(th) * (1 + 0.1 * Math.sin(th * 0.9 - 0.4));
  let h = (HM / 2) * (1 - Math.cos(th));
  const sn = Math.sin(th);
  if (s > 0.5) h -= 0.09 * HM * Math.exp(-((sn / 0.3) ** 2));
  else h += 0.06 * HM * Math.exp(-((sn / 0.3) ** 2));
  return [r, h];
}
function corPeleMaca(c1: RGB, c2: RGB, s: number): CorFn {
  return (x, y, z) => {
    let c = mix(c1, c2, suave(0.15, 0.85, fbm(x * 40, y * 90, z * 40, s)) * 0.45);
    c = mul(c, 1 + 0.04 * Math.sin(Math.atan2(z, x) * 26 + fbm(x * 60, y * 60, z * 60, s) * 4));
    return mix(c, mul(c2, 1.1), pinta(x, y, z, 520, 0.16, s) * 0.5);
  };
}
function polpaMaca(ci: RGB, s: number): CorFn {
  return (x, y, z) => mul(mix(ci, rgb('#efe0ae'), suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.35), 0.96 + 0.06 * fbm(x * 400, y * 400, z * 400, s + 1));
}
/** Faixa do descascador em espiral (0 a 1): a borda de cada faixa fica marcada. */
const faixaMaca = (y: number, a: number) => frac((y / HM) * 4.5 + a / TAU);

/** Maçã com o canal do miolo vazado de ponta a ponta, com casca ou descascada. */
function macaVazada(k: K, comCasca: boolean): THREE.BufferGeometry {
  const { c1, c2, ci, s } = k;
  const rh = 0.0085;
  const pele = corPeleMaca(c1, c2, s), polpa = polpaMaca(ci, s);
  const fora: P2[] = [];
  for (let i = 0; i <= 32; i++) {
    const p = perfilMaca(i / 32);
    if (p[0] > rh * 1.3) fora.push(p);
  }
  const hb = fora[0][1], ht = fora[fora.length - 1][1];
  return tornoAnel({
    caminho: [[rh, hb - 0.0015], ...fora, [rh, ht - 0.002]], n: 60, m: 40,
    desloc: comCasca ? undefined : (p) => {
      const r = Math.hypot(p.x, p.z);
      if (r < rh * 1.2) return;
      const f = faixaMaca(p.y, Math.atan2(p.x, p.z));
      const e = 1 - 0.012 * suave(0.82, 1, f) - 0.005 * Math.sin(f * PI);
      p.x *= e;
      p.z *= e;
    },
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      if (r < rh * 1.12) {
        // parede do canal: polpa úmida com riscos do miolo que saiu
        const c = mul(ci, 0.9 + 0.05 * fbm(x * 600, y * 200, z * 600, s));
        return mix(c, rgb('#d6be86'), 0.35 * suave(0.55, 0.8, fbm(Math.atan2(x, z) * 3, y * 300, 0, s + 4)));
      }
      if (comCasca) return mix(polpa(x, y, z, 0, 0), pele(x, y, z, 0, 0), suave(rh * 1.2, rh * 1.5, r));
      const f = faixaMaca(y, Math.atan2(x, z));
      const c = mul(polpa(x, y, z, 0, 0), 1 - 0.06 * suave(0.8, 1, f));
      // restinhos de casca rentes ao cabo e ao olho
      const polo = Math.max(suave(ht - 0.004, ht, y), suave(hb + 0.004, hb, y)) * suave(rh * 2.4, rh * 1.4, r);
      return mix(c, mul(c1, 0.9), polo * suave(0.45, 0.6, fbm(x * 700, y * 700, z * 700, s + 2)));
    },
  });
}

const gMacaDescascada: Gerador = (k) => [parte(macaVazada(k, false), 'acetinado', true)];
const gMacaSemMiolo: Gerador = (k) => [parte(macaVazada(k, true), 'brilhante', true)];

const gMacaEspiralCasca: Gerador = (k) => {
  // maçã inteira descascada numa tira só, e a tira contínua enrolada como mola ao lado
  const { c1, c2, c3, ci, s } = k;
  const pele = corPeleMaca(c1, c2, s), polpa = polpaMaca(ci, s);
  const out: Parte[] = [];
  const corpoM = torno({
    caminho: perfilMaca, n: 28, m: 36,
    desloc: (p) => {
      const f = faixaMaca(p.y, Math.atan2(p.x, p.z));
      const e = 1 - 0.01 * suave(0.82, 1, f);
      p.x *= e;
      p.z *= e;
    },
    cor: (x, y, z) => {
      const c = mul(polpa(x, y, z, 0, 0), 1 - 0.06 * suave(0.8, 1, faixaMaca(y, Math.atan2(x, z))));
      return Math.hypot(x, z) < RM * 0.14 ? mix(c, mul(c3, 0.8), 0.45) : c;
    },
  });
  corpoM.translate(-0.042, 0, 0);
  out.push(parte(corpoM, 'acetinado', true));
  out.push(parte(cabinho(-0.042, HM * 0.88, 0, HM * 0.22, RM * 0.06, c3, 0.3), 'fosco'));
  const voltas = 4.2, len = 0.085, x0 = 0.002;
  out.push(parte(chapa(130, 3, (u, v, lado) => {
    const th = u * voltas * TAU;
    const Rh = lerp(0.026, 0.017, u);
    const rr = Rh + (lado ? 0.0005 : -0.0005);
    const w = 0.0115 * Math.sqrt(suave(0, 0.04, u) * suave(1, 0.96, u)) * (1 + 0.08 * Math.sin(th * 2));
    return [x0 + u * len + v * w * 0.5, 0.026 + rr * Math.cos(th), rr * Math.sin(th)];
  }, (x, y, z, _u, _v, lado) => (lado ? pele(x, y, z, 0, 0) : polpa(x, y, z, 0, 0))), 'brilhante'));
  return out;
};

const gPeraLeque: Gerador = (k) => {
  // meia pera descascada, virada para baixo e fatiada no comprido; as fatias abertas em leque
  // continuam presas no pescoço junto do cabo
  const { ci, c3, s } = k;
  const L = 0.105, Rb = 0.034, xp = L * 0.84;
  const raio = (t: number) => Rb * Math.sin(PI * clamp(t) ** 0.75) ** 0.6 * (1 - 0.48 * suave(0.35, 0.9, t)) + 1e-4;
  const polpa: CorFn = (x, y, z) => {
    const c = mul(ci, 0.95 + 0.07 * fbm(x * 260, y * 260, z * 260, s));
    return mix(c, rgb('#e4daaa'), 0.25 * pinta(x, y, z, 900, 0.2, s));
  };
  const out: Parte[] = [];
  const nf = 7, w = (1.9 * Rb) / nf;
  for (let i = 0; i < nf; i++) {
    const zc = (i - (nf - 1) / 2) * w;
    let ta = 0.01;
    while (ta < 0.6 && raio(ta) < Math.abs(zc) + w * 0.4) ta += 0.01;
    const x0 = ta * L, x1 = xp + 0.006;
    const g = corpo({
      x0, x1, n: 18, m: 10, exp: 5, linear: true,
      perfil: (t) => {
        const r = raio(lerp(x0, x1, t) / L);
        const h = 0.88 * Math.sqrt(Math.max(0, r * r - zc * zc));
        const hh = Math.max(0.002, h) * (0.35 + 0.65 * suave(0, 0.15, t));
        return { ry: hh / 2, rz: w * 0.43, cy: hh / 2 };
      },
      cor: (x, y, z) => mix(polpa(x, y, z, 0, 0), rgb('#e0d696'), 0.25 * suave(0.6, 1, y / (Rb * 0.88))),
    });
    g.translate(-xp, 0, -zc);
    g.rotateY((i - (nf - 1) / 2) * 0.15);
    g.translate(xp, 0, zc * 0.55);
    out.push(parte(g, 'umido', true));
  }
  // pescoço inteiro, onde as fatias continuam unidas
  const xn = xp - 0.012;
  out.push(parte(corpo({
    x0: xn, x1: L, n: 12, m: 16, linear: true,
    perfil: (t) => {
      const r = raio(lerp(xn, L, t) / L) * (t > 0.85 ? Math.sqrt(Math.max(0.05, 1 - ((t - 0.85) / 0.15) ** 2)) : 1) + 0.0008;
      return { ry: r * 0.44, rz: r, cy: r * 0.44 };
    },
    cor: polpa,
  }), 'umido'));
  out.push(parte(caule([V(L - 0.002, 0.003, 0), V(L + 0.008, 0.006, 0.001), V(L + 0.016, 0.011, 0.003)], 0.0014, 0.001, tomR(c3, 0.1, 500, s), 5), 'fosco'));
  return out;
};

const gMeiasLuasMaca: Gerador = (k) => {
  // meias-luas de maçã sem casca e sem miolo, deitadas em leque, uma apoiada na outra
  const { ci, s } = k;
  const R = 0.034, rc = 0.0085, e = 0.0055;
  const poly: P2[] = [];
  for (let i = 0; i <= 16; i++) { const th = (i / 16) * PI; poly.push([R * 0.93 * Math.sin(th), R * Math.cos(th)]); }
  poly.push([0, -R * 0.55]);
  for (let i = 8; i >= 0; i--) { const f = (i / 8) * PI; poly.push([rc * Math.sin(f), rc * Math.cos(f)]); }
  poly.push([0, R * 0.55]);
  const lado: CorFn = (x, y, z) => {
    const r = Math.hypot(y, z);
    const c = mul(ci, 0.95 + 0.06 * fbm(x * 500, y * 300, z * 300, s));
    if (r > R * 0.86) return mix(c, rgb('#ebdea6'), 0.4);
    if (r < rc * 1.25) return mix(c, rgb('#d6c28a'), 0.35);
    return c;
  };
  const face: CorFn = (x, y, z) => {
    const r = Math.hypot(y, z) / R, a = Math.atan2(y, z);
    const c = mul(ci, 0.96 + 0.05 * fbm(y * 400, z * 400, x * 100, s + 3));
    return mix(c, rgb('#e2d89e'), (1 - suave(0, 0.06, Math.abs(r - 0.55 - 0.03 * Math.cos(5 * a)))) * 0.5);
  };
  const out: Parte[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const g = extrusao(poly, -e / 2, e / 2, lado, { tampa: face, nr: 4 });
    g.rotateZ(PI / 2);
    g.rotateX(0.12);
    const ang = -0.9 + (i / (n - 1)) * 1.8;
    g.rotateY(ang);
    g.translate(-Math.cos(ang) * 0.012, i * 0.0016, Math.sin(ang) * 0.012);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* ruibarbo                                                             */
/* ------------------------------------------------------------------ */

const gRuibarboPedacos: Gerador = (k) => {
  // talos aparados, sem folha, cortados na diagonal: casca rosada e verde, corte claro com a borda rosa
  const { c1, c3, ci, s } = k;
  const W = 0.021, H = 0.015;
  const poly: P2[] = [];
  for (let i = 0; i <= 18; i++) { const th = (i / 18) * PI; poly.push([H * 0.3 + H * 0.7 * Math.sin(th) * (1 + 0.035 * Math.cos(th * 11)), (W / 2) * Math.cos(th)]); }
  poly.push([H * 0.02, -W * 0.48]);
  for (let i = 1; i < 8; i++) { const zz = -W / 2 + (i / 8) * W; poly.push([H * 0.26 * (1 - (2 * zz / W) ** 2), zz]); }
  poly.push([H * 0.02, W * 0.48]);
  const pele: CorFn = (x, y, z) => {
    const st = fbm(x * 25, y * 420, z * 420, s);
    const verde = suave(0.15, 0.75, (1 - y / H) * 0.6 + st * 0.5);
    const c = mix(mul(c1, 1.02), mix(c3, rgb('#a8b860'), 0.5), verde * 0.7);
    return mul(c, 1 + 0.05 * Math.sin(z * 2200 + st * 3));
  };
  const corte: CorFn = (x, y, z, t) => mix(mul(ci, 0.96 + 0.06 * fbm(y * 900, z * 900, x, s)), mix(c1, rgb('#e89aa0'), 0.4), suave(0.72, 1, t));
  const out: Parte[] = [];
  for (let i = 0; i < 9; i++) {
    const Lp = 0.026 * k.r.f(0.9, 1.1);
    const g = cisalhar(extrusao(poly, -Lp / 2, Lp / 2, pele, { tampa: corte, nr: 3, nx: 2 }), 0.55);
    g.rotateX(k.r.f(-0.25, 0.25) + (i % 4 === 3 ? PI / 2 : 0));
    g.rotateY(k.r.f(0, TAU));
    const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / 9) * 0.04;
    g.translate(Math.cos(a) * rr, i < 3 ? 0.012 : 0, Math.sin(a) * rr);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* abacaxi                                                              */
/* ------------------------------------------------------------------ */

function escamaAb(eixo: number, a: number, comp: number): number {
  const ns = 8;
  const u = (a / TAU) * ns + (eixo / comp) * 6, w = (a / TAU) * ns - (eixo / comp) * 6;
  return Math.min(Math.abs(frac(u) - 0.5), Math.abs(frac(w) - 0.5)) * 2;
}
function cascaAb(c1: RGB, c2: RGB, s: number, comp: number): (x: number, y: number, z: number, eixo: number, a: number) => RGB {
  return (x, y, z, eixo, a) => {
    const e = escamaAb(eixo, a, comp);
    const c = mix(c2, c1, suave(0.05, 0.5, e));
    return mul(mix(c, mul(c2, 0.55), suave(0.82, 1, e)), 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
  };
}
function polpaAb(ci: RGB, s: number): CorFn {
  return (x, y, z) => mul(mix(ci, rgb('#f6d24a'), suave(0.2, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.5), 0.95 + 0.06 * fbm(x * 500, y * 500, z * 500, s + 2));
}
function coroaAb(k: K, n: number, L: number, cor: RGB, abre = 0.25, so?: (ang: number) => boolean): THREE.BufferGeometry[] {
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
      cima: () => mul(tom, 1.05), baixo: (x) => mix(mul(tom, 0.9), rgb('#8a9a7a'), 0.25 * (1 - x / Lf)),
    });
    g.rotateZ(PI / 2 - lerp(abre + 0.55, 0.12, f));
    g.rotateY(ang);
    out.push(g);
  }
  return out;
}
/** Tampa da ponta do abacaxi descascado: fibras em raio e o miolo claro. */
function tampaAbacaxi(ci: RGB, s: number, R: number): CorFn {
  const polpa = polpaAb(ci, s);
  return (x, y, z) => {
    const r = Math.hypot(y, z) / R, a = Math.atan2(z, y);
    let c = mix(polpa(x, y, z, 0, 0), mul(ci, 1.06), 0.3);
    c = mul(c, 1 - 0.09 * Math.abs(Math.sin(a * 36)) ** 5 * suave(0.3, 0.6, r));
    return mix(c, rgb('#f4e8b0'), suave(0.32, 0.22, r) * 0.7);
  };
}

const gAbacaxiCilindro: Gerador = (k) => {
  // cilindro de polpa puxado de dentro da casca, sem casca nem olhos, pronto para fatiar
  const { ci, s } = k;
  const Rc = 0.042, Lc = 0.13;
  const polpa = polpaAb(ci, s);
  const marca = (t: number, a: number) => Math.exp(-((linha((a / TAU) * 8 + t * 3) / 0.05) ** 2));
  return [parte(corpo({
    x0: -Lc / 2, x1: Lc / 2, n: 12, m: 40, tampa: true, aneisTampa: 6, linear: true,
    perfil: () => ({ ry: Rc, rz: Rc }),
    mod: (t, a) => 1 + 0.01 * fbm(t * 5, Math.cos(a) * 2, Math.sin(a) * 2, s) - 0.01 * marca(t, a),
    cor: (x, y, z, t, a) => mul(polpa(x, y, z, t, a), 1 - 0.1 * marca(t, a)),
    corTampa: tampaAbacaxi(ci, s, Rc),
  }), 'umido', true)];
};

const gAbacaxiDescascado: Gerador = (k) => {
  // abacaxi deitado, sem coroa nem base, descascado e com os olhos tirados em sulcos diagonais
  const { ci, s } = k;
  const L = 0.18, Rmx = 0.05, R0 = 0.04;
  const polpa = polpaAb(ci, s);
  const sulco = (t: number, a: number) => Math.exp(-((linha((a / TAU) * 8 + t * 2.4) / 0.06) ** 2));
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 22, m: 44, tampa: true, aneisTampa: 6, linear: true,
    perfil: (t) => { const r = R0 + (Rmx - R0) * Math.sin(PI * t) ** 0.7; return { ry: r, rz: r }; },
    mod: (t, a) => 1 - 0.06 * sulco(t, a) - 0.01 * Math.abs(Math.sin(a * 5)),
    cor: (x, y, z, t, a) => {
      const g = sulco(t, a);
      const c = mix(polpa(x, y, z, t, a), rgb('#c89a30'), g * 0.55);
      const olho = g > 0.3 ? pinta(x, y, z, 160, 0.3, s) : 0;
      return mix(c, rgb('#6a4a1e'), olho * 0.6);
    },
    corTampa: tampaAbacaxi(ci, s, R0),
  }), 'umido', true)];
};

const gAbacaxiQuarto: Gerador = (k) => {
  // quarto de abacaxi cortado no comprido, com a coroa e a casca, o miolo duro já tirado
  const { c1, c2, c3, ci, s } = k;
  const Lf = 0.2, Rm = 0.052, ya = Rm, rc = 0.009, ab = PI / 4;
  const Rx = (x: number) => Rm * Math.max(0.04, 1 - Math.abs(x / (Lf / 2)) ** 3) ** 0.5;
  const casca = cascaAb(c1, c2, s, Lf), polpa = polpaAb(ci, s);
  const P = (x: number, r: number, f: number): P3 => [x, ya - r * Math.cos(f), r * Math.sin(f)];
  const Rf = (x: number, f: number) => Rx(x) * (1 + 0.04 * escamaAb(x, f, Lf));
  const ref = V(0, ya - Rm * 0.45, 0);
  const out: Parte[] = [];
  const pol = (x: number, y: number, z: number, r: number, R: number) => mix(polpa(x, y, z, 0, 0), mul(c1, 0.9), suave(R - 0.004, R, r));
  out.push(parte(orientar(grade(40, 14, (u, v) => { const x = (u - 0.5) * Lf, f = -ab + v * 2 * ab; return P(x, Rf(x, f), f); }, (x, y, z, u, v) => casca(x, y, z, x, -ab + v * 2 * ab + PI)), ref), 'fosco', true));
  for (const lado of [-1, 1]) {
    out.push(parte(orientar(grade(40, 5, (u, w) => { const x = (u - 0.5) * Lf; return P(x, lerp(rc, Rf(x, lado * ab), w), lado * ab); }, (x, y, z, u, w) => { const xx = (u - 0.5) * Lf; return pol(x, y, z, lerp(rc, Rf(xx, lado * ab), w), Rf(xx, lado * ab)); }), ref), 'umido', true));
  }
  out.push(parte(orientar(grade(40, 6, (u, v) => P((u - 0.5) * Lf, rc, -ab + v * 2 * ab), (x, y, z) => mul(mix(ci, rgb('#f4e8b0'), 0.55), 0.95 + 0.07 * fbm(x * 300, y * 300, z * 300, s))), ref), 'umido'));
  for (const xe of [-Lf / 2, Lf / 2]) {
    out.push(parte(orientar(grade(3, 6, (u, v) => P(xe, lerp(rc, Rx(xe), u), -ab + v * 2 * ab), polpa), ref), 'umido'));
  }
  const coroa = coroaAb(k, 22, 0.12, c3, 0.3, (ang) => Math.cos(ang) > -0.2);
  for (const g of coroa) {
    g.rotateZ(-PI / 2);
    g.translate(Lf / 2 - 0.004, ya - Rm * 0.35, 0);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gAbacaxiCaramelado: Gerador = (k) => {
  // pedaços de polpa cortados das rodelas, dourados e brilhantes de calda caramelada
  const { s } = k;
  const Ro = 0.045, Ri = 0.014, ang = 0.62, esp = 0.013;
  const poly: P2[] = [];
  for (let i = 0; i <= 6; i++) { const f = -ang / 2 + (ang * i) / 6; poly.push([Ro * Math.cos(f), Ro * Math.sin(f)]); }
  for (let i = 3; i >= 0; i--) { const f = -ang / 2 + (ang * i) / 3; poly.push([Ri * Math.cos(f), Ri * Math.sin(f)]); }
  const lado: CorFn = (x, y, z) => mix(rgb('#e8ae3a'), rgb('#94520e'), suave(0.1, 0.85, fbm(x * 300, y * 300, z * 300, s)) * 0.7);
  const face: CorFn = (x, y, z) => {
    const r = Math.hypot(y, z), a = Math.atan2(z, y);
    let c = mix(rgb('#f0c040'), rgb('#c8801e'), suave(0.2, 0.8, fbm(y * 200, z * 200, x * 50, s + 1)));
    c = mul(c, 1 - 0.1 * Math.abs(Math.sin(a * 60)) ** 4);
    return mix(c, rgb('#8a4a10'), suave(Ro * 0.9, Ro, r) * 0.6);
  };
  return monte(k, 14, 0.04, 0.02, () => {
    const g = extrusao(poly, -esp / 2, esp / 2, lado, { tampa: face, nr: 2, sub: 1 });
    g.translate(0, -Ro * 0.6, 0);
    return g.rotateZ(PI / 2);
  }, 0.5).map((g, i) => parte(g, 'brilhante', i === 0));
};

/* ------------------------------------------------------------------ */
/* cereja, morango, manga, laranja, lima, uva e groselha               */
/* ------------------------------------------------------------------ */

const gCerejaSemCabo: Gerador = (k) => {
  // cereja sem cabo e descaroçada: o furo do caroço aberto no lugar do cabo
  const { c1, c2, s } = k;
  const R = 0.0115, rh = 0.0034;
  const cam: P2[] = [];
  for (let i = 0; i <= 18; i++) { const th = (i / 18) * PI * 0.86; cam.push([R * Math.sin(th) * (1 + 0.05 * Math.sin(th)), R * 0.96 * (1 - Math.cos(th))]); }
  const hr = cam[cam.length - 1][1];
  const tFuro = arco([...cam, [rh, hr - 0.0008], [rh * 0.85, hr - 0.004], [rh * 0.55, hr - 0.0075], [0, hr - 0.0085]], 18);
  cam.push([rh, hr - 0.0008], [rh * 0.85, hr - 0.004], [rh * 0.55, hr - 0.0075], [0, hr - 0.0085]);
  return [parte(torno({
    caminho: cam, n: 30, m: 22,
    cor: (x, y, z, t) => {
      if (t > tFuro + 0.01) return mix(rgb('#560510'), rgb('#9a1a2a'), suave(0.4, 0.8, fbm(x * 900, y * 900, z * 900, s)));
      const c = mix(c1, mul(c2, 0.9), suave(0.3, 0.8, fbm(x * 160, y * 160, z * 160, s)) * 0.6);
      return mix(c, mul(c1, 1.5), pinta(x, y, z, 1400, 0.12, s) * 0.4);
    },
  }), 'brilhante', true)];
};

function perfilMorango(t: number, Rm: number): number {
  const sub = Math.sin((PI / 2) * Math.min(1, t / 0.75)) ** 0.85;
  const om = t > 0.75 ? 1 - 0.42 * ((t - 0.75) / 0.25) ** 2 : 1;
  return Math.max(1e-4, Rm * sub * om);
}

const gMorangoSemCalice: Gerador = (k) => {
  // morango deitado com o cálice e o centro duro tirados: a cova clara aberta no ombro
  const { c1, c2, s } = k;
  const L = 0.034, Rm = 0.0135, R1 = perfilMorango(1, Rm);
  const sem = (t: number, a: number) => {
    const r = perfilMorango(t, Rm);
    return pinta(t * L, r * Math.cos(a), r * Math.sin(a), 700, 0.3, s);
  };
  return [parte(corpo({
    x0: 0, x1: L, n: 22, m: 24, tampa: true, aneisTampa: 4,
    perfil: (t) => { const r = perfilMorango(t, Rm); return { ry: r, rz: r * 0.95 }; },
    mod: (t, a) => (t > 0 && t < 1 ? 1 - 0.04 * sem(t, a) : 1),
    desloc: (p, t) => {
      if (t < 1) return;
      const rr = Math.hypot(p.y, p.z);
      if (rr < R1 * 0.7) p.x -= 0.0045 * (1 - (rr / (R1 * 0.7)) ** 2);
    },
    cor: (x, y, z, t, a) => {
      const c = mix(c1, rgb('#e86a52'), suave(0.82, 1, t) * 0.45);
      const e = t > 0 && t < 1 ? sem(t, a) : 0;
      return mix(mul(c, 1 - 0.15 * e), c2, suave(0.55, 0.9, e));
    },
    corTampa: (x, y, z) => {
      const r = Math.hypot(y, z) / R1;
      return mix(mix(rgb('#f6e2dc'), rgb('#f09a9a'), suave(0.2, 0.6, r)), c1, suave(0.75, 1, r));
    },
  }), 'brilhante', true)];
};

/** Metade de morango cortada no comprido, atravessando o cálice, com a face de corte para cima. */
function morangoMeia(s: number, L: number, Rm: number, vermelho: RGB, semente: RGB, verde: RGB) {
  const o: OpcMeia = {
    L, nt: 24, nv: 14,
    raio: (t) => { const r = perfilMorango(t, Rm) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.93) / 0.07) ** 2)); return { ry: r, rz: r * 0.95 }; },
    pele: (x, y, z) => mix(vermelho, semente, pinta(x, y, z, 700 * (0.034 / L), 0.28, s) * 0.8),
    face: (x, y, z, u, v) => {
      const rel = Math.abs(2 * v - 1);
      let c = mix(rgb('#e8404a'), rgb('#f8d8d0'), (1 - suave(0.08, 0.35 + 0.1 * u, rel)) * (0.4 + 0.6 * u));
      c = mix(c, rgb('#f6c8c0'), 0.35 * Math.abs(Math.sin(Math.atan2(z, (x + L / 2) * 0.6) * 9)) ** 8 * suave(0.2, 0.7, rel));
      return mix(c, vermelho, suave(0.84, 0.95, rel));
    },
  };
  const { casca, face, yc } = meia(o);
  const sep: THREE.BufferGeometry[] = [];
  for (const ang of [-0.9, 0, 0.9]) {
    const g = folha(L * 0.38, L * 0.13, verde, mul(verde, 1.2), { contorno: contornos.lanca, curva: 0.15, n: 6, m: 5 });
    g.rotateY(ang);
    g.translate(L / 2 - L * 0.06, yc + 0.0004, 0);
    sep.push(g);
  }
  return { casca, face, sep, yc };
}

const gMorangoMetade: Gerador = (k) => {
  const { casca, face, sep } = morangoMeia(k.s, 0.036, 0.0135, k.c1, k.c2, k.c3);
  return [parte(casca, 'brilhante', true), parte(face, 'umido', true), ...sep.map((g) => parte(g, 'acetinado'))];
};

const gMangaFatias: Gerador = (k) => {
  // fatias verticais compridas de manga descascada, tiradas em volta do caroço e abertas em leque
  const { ci, s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 6; i++) {
    const Lf = 0.1 * k.r.f(0.92, 1.05);
    const g = corpo({
      x0: 0, x1: Lf, n: 18, m: 12, linear: true, exp: 2.6,
      perfil: (t) => { const sn = Math.sin(PI * t); return { ry: 0.0055 * sn ** 0.5 + 1e-4, rz: 0.013 * sn ** 0.6 + 1e-4, cy: 0.006 * sn }; },
      cor: (x, y, z) => mix(mul(ci, 0.94 + 0.08 * fbm(x * 60, y * 500, z * 500, s + i)), rgb('#e88a18'), suave(0.004, -0.002, y) * 0.4),
    });
    g.rotateY(-0.55 + i * 0.22);
    g.translate(0, i * 0.0012, 0);
    out.push(parte(g, 'umido', true));
  }
  return out;
};

const gLaranjaAVif: Gerador = (k) => {
  // laranja descascada à vif: sem casca nem branco, os gomos marcados pelas membranas, topo e base planos
  const { ci, s } = k;
  const R = 0.033, th0 = 0.45;
  const rb = R * Math.sin(th0), Ht = 2 * R * Math.cos(th0);
  const cam: P2[] = [[0, 0], [rb * 0.5, 0], [rb, 0]];
  for (let i = 1; i < 14; i++) { const th = th0 + ((PI - 2 * th0) * i) / 14; cam.push([R * Math.sin(th), R * (Math.cos(th0) - Math.cos(th))]); }
  cam.push([rb, Ht], [rb * 0.5, Ht], [0, Ht]);
  const tA = arco(cam, 2), tB = arco(cam, cam.length - 3);
  const membrana = (a: number) => Math.exp(-((linha(((a + 0.1 * Math.sin(3 * a + s)) * 11) / TAU) / 0.05) ** 2));
  return [parte(torno({
    caminho: cam, n: 34, m: 44,
    mod: (t, a) => 1 - 0.035 * membrana(a) * suave(tA, tA + 0.03, t) * suave(tB, tB - 0.03, t),
    cor: (x, y, z, t, a) => {
      let c = mul(ci, 0.93 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
      c = mix(c, mul(ci, 1.2), pinta(x, y * 0.6, z, 500, 0.3, s) * 0.3);
      const lado = t > tA + 0.005 && t < tB - 0.005;
      if (lado) {
        c = mix(c, rgb('#f8d8a8'), membrana(a) * 0.75);
        return mix(c, rgb('#f8f0dc'), suave(0.62, 0.75, fbm(x * 120, y * 120, z * 120, s + 5)) * 0.6);
      }
      const r = Math.hypot(x, z) / rb;
      c = mix(c, rgb('#f8dcaa'), membrana(Math.atan2(x, z)) * suave(0.1, 0.25, r) * 0.8);
      return mix(c, rgb('#f6ecd0'), suave(0.16, 0.08, r));
    },
  }), 'umido', true)];
};

/** Tiras de casca cítrica amontoadas: tubos achatados, verdes por cima e claros por baixo. */
function tirasCasca(k: K, n: number, o: { comp: number; larg: number; esp: number; R: number; enrola: number; cima: CorFn; baixo: CorFn }): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const L = o.comp * k.r.f(0.75, 1.2);
    const ph = k.r.f(0, TAU), amp = L * k.r.f(0.05, 0.16) * o.enrola;
    const pts: THREE.Vector3[] = [];
    for (let q = 0; q <= 6; q++) { const u = q / 6; pts.push(V((u - 0.5) * L, amp * 0.6 * (1 + Math.sin(u * 5 + ph)), amp * Math.sin(u * 4.2 + ph * 1.3))); }
    const g = tubo(pts, {
      raio: o.esp / 2, achata: o.larg / o.esp, cima: V(0, 1, 0), m: 6, n: 14, pontaRedonda: false,
      cor: (x, y, z, t, a) => mix(o.baixo(x, y, z, t, a), o.cima(x, y, z, t, a), suave(-0.5, 0.5, Math.cos(a))),
    });
    if (k.r.n() < 0.3) g.rotateX(PI);
    g.rotateY(k.r.f(0, TAU));
    const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / n) * o.R;
    g.translate(Math.cos(a) * rr, (1 - (i + 0.5) / n) * o.R * 0.45 + amp, Math.sin(a) * rr);
    out.push(g);
  }
  return out;
}

const gLimaJulienne: Gerador = (k) => {
  // tiras finíssimas de casca de lima, sem o branco, soltas num montinho
  const { c1, s } = k;
  return tirasCasca(k, 28, {
    comp: 0.045, larg: 0.0018, esp: 0.0006, R: 0.025, enrola: 1,
    cima: (x, y, z) => mix(mul(c1, 1.05), rgb('#2e6a1a'), pinta(x, y, z, 2500, 0.3, s) * 0.5),
    baixo: () => rgb('#dce6bc'),
  }).map((g, i) => parte(g, 'acetinado', i === 0));
};

const gRaspasLima: Gerador = (k) => {
  // tiras de casca de lima cozidas na calda e passadas no açúcar: verde escuro vitrificado e cristais
  const { s } = k;
  const acucar = (x: number, y: number, z: number) => pinta(x, y, z, 1600, 0.3, s + 7);
  return tirasCasca(k, 24, {
    comp: 0.04, larg: 0.0026, esp: 0.0011, R: 0.026, enrola: 1.4,
    cima: (x, y, z) => mix(mix(rgb('#5a7a16'), rgb('#8a9a2a'), suave(0.3, 0.8, fbm(x * 300, y * 300, z * 300, s))), rgb('#f6f4ea'), acucar(x, y, z) * 0.85),
    baixo: (x, y, z) => mix(rgb('#b8bc78'), rgb('#f6f4ea'), acucar(x, y, z) * 0.8),
  }).map((g, i) => parte(g, 'acetinado', i === 0));
};

/** Meia uva com a face de corte para cima e as sementes à mostra. */
function meiaUva(R: number, pele: RGB, s: number): THREE.BufferGeometry[] {
  const H = R * 0.88;
  const cam: P2[] = [];
  for (let i = 0; i <= 10; i++) { const th = (i / 10) * (PI / 2); cam.push([R * Math.sin(th), H * (1 - Math.cos(th))]); }
  cam.push([R * 0.5, H], [0, H]);
  const g = torno({
    caminho: cam, n: 18, m: 18, l: 0.82,
    cor: (x, y, z) => {
      if (y < H - 0.0002) return mix(pele, rgb('#c8d890'), suave(0.5, 0.8, fbm(x * 400, y * 400, z * 400, s)) * 0.3);
      const rr = Math.hypot(x / R, z / (R * 0.82));
      return mix(mix(rgb('#eef0b8'), rgb('#c8d888'), suave(0.2, 0.9, rr)), pele, suave(0.9, 1, rr));
    },
  });
  const out = [g];
  for (const sx of [-1, 1]) {
    const sm = elipsoide(0.0026, 0.0011, 0.0016, (x) => mix(rgb('#8a5a2a'), rgb('#b8884a'), suave(-0.002, 0.002, x)), 4, 6);
    sm.rotateY(sx * 0.3);
    sm.translate(sx * 0.0017, H - 0.0002, 0);
    out.push(sm);
  }
  return out;
}

const gUvaMetades: Gerador = (k) => {
  // uvas soltas do cacho, cortadas ao meio, com as sementes à mostra para tirar
  const out: Parte[] = [];
  const pele = rgb('#9ab84a');
  for (let i = 0; i < 6; i++) {
    const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / 6) * 0.022;
    const gs = meiaUva(0.0095 * k.r.f(0.92, 1.06), pele, k.s + i);
    const giro = k.r.f(0, TAU);
    gs.forEach((g, j) => {
      g.rotateY(giro);
      g.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      out.push(parte(g, j === 0 ? 'umido' : 'acetinado', j === 0));
    });
  }
  return out;
};

const gGroselhas: Gerador = (k) => {
  // groselhas vermelhas soltas do cabinho: bolinhas translúcidas com o restinho seco da flor
  const { c1, s } = k;
  return monte(k, 24, 0.024, 0.008, (i) => {
    const r = 0.0044 * k.r.f(0.88, 1.1);
    return elipsoide(r, r * 0.95, r, (x, y, z) => {
      let c = mix(c1, rgb('#f04a5a'), 0.3 * suave(0.2, 0.8, fbm(x * 600, y * 600, z * 600, s + i)));
      c = mix(c, rgb('#f88090'), 0.25 * Math.abs(Math.cos(Math.atan2(z, y) * 5)) ** 20);
      return mix(c, rgb('#3a2010'), suave(r * 0.82, r * 0.95, x));
    }, 7, 9);
  }, 1.2).map((g, i) => parte(g, 'brilhante', i === 0));
};

/* ------------------------------------------------------------------ */
/* frutas tropicais abertas e descascadas                               */
/* ------------------------------------------------------------------ */

const gMaracujaMetade: Gerador = (k) => {
  // meio maracujá cortado na transversal: casca roxa enrugada, anel branco e polpa com sementes
  const { c1, c2, s } = k;
  const R = 0.034, H = R * 0.96;
  const cam: P2[] = [];
  for (let i = 0; i <= 14; i++) { const th = (i / 14) * (PI / 2); cam.push([R * Math.sin(th), H * (1 - Math.cos(th))]); }
  cam.push([R * 0.9, H], [R * 0.84, H - 0.0025], [R * 0.5, H - 0.004], [0, H - 0.0045]);
  const tBorda = arco(cam, 14);
  const out: Parte[] = [parte(torno({
    caminho: cam, n: 28, m: 36,
    mod: (t, a) => (t < tBorda ? 1 + 0.015 * fbm(t * 8, Math.cos(a) * 3, Math.sin(a) * 3, s) : 1),
    cor: (x, y, z, t) => {
      const r = Math.hypot(x, z) / R;
      if (t < tBorda - 0.005) {
        const c = mix(c1, c2, suave(0.3, 0.8, fbm(x * 120, y * 120, z * 120, s)));
        return mix(c, rgb('#a88898'), pinta(x, y, z, 900, 0.1, s) * 0.6);
      }
      if (r > 0.88) return rgb('#f4eedc');
      return mix(rgb('#f0b020'), rgb('#c88a10'), suave(0.4, 0.8, fbm(x * 400, y * 400, z * 400, s + 2)) * 0.5);
    },
  }), 'acetinado', true)];
  for (let i = 0; i < 34; i++) {
    const f = (i + 0.5) / 34, rr = Math.sqrt(f) * R * 0.76, a = i * 2.39996;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = H - 0.0045 + 0.0006;
    const giro = k.r.f(0, TAU);
    const aril = elipsoide(0.0036, 0.0022, 0.0032, (xx, yy, zz) => mix(rgb('#f2b020'), rgb('#e88a10'), suave(0.3, 0.8, fbm(xx * 900, yy * 900, zz * 900, s + i))), 5, 7);
    aril.rotateY(giro);
    aril.translate(x, y, z);
    out.push(parte(aril, 'umido'));
    const sm = elipsoide(0.0021, 0.0013, 0.0016, (xx) => mix(rgb('#141010'), rgb('#3a3028'), suave(-0.002, 0.002, xx)), 4, 6);
    sm.rotateY(giro);
    sm.translate(x, y + 0.0013, z);
    out.push(parte(sm, 'brilhante'));
  }
  return out;
};

function gPapaia(sementes: boolean): Gerador {
  return (k) => {
    // papaia descascada e cortada ao meio no comprido, a cavidade das sementes para cima
    const { s } = k;
    const L = 0.16, Rm = 0.046;
    const xc = L * 0.08, ax = L * 0.3, az = Rm * 0.42, dep = 0.017;
    const cava = (x: number, z: number) => dep * Math.sqrt(Math.max(0, 1 - ((x - xc) / ax) ** 2 - (z / az) ** 2));
    const o: OpcMeia = {
      L, nt: 30, nv: 16, nf: [36, 20],
      raio: (t) => { const r = Rm * Math.sin(PI * t) ** 0.62 * (0.82 + 0.3 * t); return { ry: r * 0.9, rz: r }; },
      cava,
      pele: (x, y, z, u, v) => mul(mix(rgb('#f39a52'), rgb('#f6b070'), suave(0.3, 0.8, fbm(x * 90, y * 90, z * 90, s))), 1 - 0.07 * Math.exp(-((linha(v * 9) / 0.06) ** 2))),
      face: (x, y, z, u, v) => {
        const rel = Math.abs(2 * v - 1), d = cava(x, z) / dep;
        let c = mix(rgb('#f27848'), rgb('#f6a85a'), suave(0.72, 0.95, rel));
        c = mul(c, 0.96 + 0.06 * fbm(x * 300, y * 300, z * 300, s + 1));
        if (d > 0) c = mix(mix(c, rgb('#d8582e'), suave(0, 0.15, d) * 0.6), rgb('#f2c4a4'), suave(0.15, 0.4, d) * 0.85);
        return c;
      },
    };
    const { casca, face, yc } = meia(o);
    const out: Parte[] = [parte(casca, 'acetinado', true), parte(face, 'umido', true)];
    if (sementes) {
      for (let i = 0; i < 48; i++) {
        const f = (i + 0.5) / 48, rr = Math.sqrt(f) * 0.86, a = i * 2.39996;
        const x = xc + Math.cos(a) * rr * ax, z = Math.sin(a) * rr * az;
        const g = elipsoide(0.0027, 0.0026, 0.0027, (xx, yy) => mix(rgb('#161412'), rgb('#4a4640'), suave(0.001, 0.0026, yy)), 5, 7);
        g.translate(x, yc - cava(x, z) + 0.0024 + (1 - f) * 0.004 * k.r.n(), z);
        out.push(parte(g, 'brilhante'));
      }
    }
    return out;
  };
}

const gPitaiaMetade: Gerador = (k) => {
  // pitaia cortada ao meio no comprido: casca magenta com brácteas de ponta verde, polpa branca
  // salpicada de sementinhas pretas
  const { c1, s } = k;
  const L = 0.11, Rm = 0.04;
  const o: OpcMeia = {
    L, nt: 28, nv: 14, nf: [32, 18],
    raio: (t) => { const r = Rm * Math.sin(PI * t) ** 0.7 + 1e-4; return { ry: r * 0.93, rz: r }; },
    pele: (x, y, z) => mul(c1, 0.92 + 0.12 * fbm(x * 90, y * 90, z * 90, s)),
    face: (x, y, z, u, v) => {
      const rel = Math.abs(2 * v - 1);
      const c = mul(rgb('#f6f2ee'), 0.97 + 0.04 * fbm(x * 400, 0, z * 400, s));
      return mix(mix(c, rgb('#f0b8cc'), suave(0.84, 0.92, rel)), c1, suave(0.92, 0.97, rel));
    },
  };
  const { casca, face, yc } = meia(o);
  const out: Parte[] = [parte(casca, 'acetinado', true), parte(face, 'umido', true)];
  for (let i = 0; i < 60; i++) {
    const u = 0.1 + 0.8 * hash(i, 1), v = 0.15 + 0.7 * hash(i, 2);
    const { rz } = o.raio(u);
    const g = elipsoide(0.0011, 0.0006, 0.0008, () => rgb('#141214'), 3, 4);
    g.rotateY(hash(i, 3) * TAU);
    g.translate((u - 0.5) * L, yc + 0.0001, (2 * v - 1) * rz * 0.8);
    out.push(parte(g, 'brilhante'));
  }
  for (let i = 0; i < 12; i++) {
    const u = 0.12 + 0.76 * hash(i, 4), f = i % 2 ? PI + 0.55 + 0.45 * hash(i, 5) : TAU - 0.55 - 0.45 * hash(i, 6);
    const { p, n } = naCasca(o, yc, u, f);
    const Lb = 0.024 * (0.6 + 0.4 * Math.sin(PI * u));
    const g = petala(Lb, Lb * 0.45, {
      contorno: contornos.lanca, curva: 0.35, esp: 0.0012, n: 8, m: 6,
      cima: (x) => mix(rgb('#e02a70'), rgb('#a8c040'), suave(Lb * 0.45, Lb, x)),
      baixo: (x) => mix(rgb('#c02060'), rgb('#90a838'), suave(Lb * 0.5, Lb, x)),
    });
    g.translate(-Lb * 0.25, 0, 0);
    if (i % 3 === 0) g.rotateY(PI);
    g.rotateX(Math.atan2(n.z, n.y));
    g.translate(p.x + n.x * 0.0005, p.y + n.y * 0.0005, p.z + n.z * 0.0005);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gKiwanoMetade: Gerador = (k) => {
  // kiwano cortado ao meio: casca laranja com chifres, miolo verde gelatinoso com sementes claras
  const { c1, c2, s } = k;
  const L = 0.12, Rm = 0.037;
  const o: OpcMeia = {
    L, nt: 28, nv: 14, nf: [30, 16],
    raio: (t) => { const r = Rm * Math.sin(PI * t) ** 0.65 + 1e-4; return { ry: r * 0.95, rz: r }; },
    pele: (x, y, z) => mix(c1, c2, suave(0.35, 0.8, fbm(x * 70, y * 70, z * 70, s)) * 0.6),
    face: (x, y, z, u, v) => {
      const rel = Math.abs(2 * v - 1);
      const c = mix(rgb('#78b838'), rgb('#a8d058'), suave(0.3, 0.8, fbm(x * 260, 0, z * 260, s + 1)) * 0.5);
      return mix(mix(c, rgb('#c8d878'), suave(0.8, 0.86, rel)), c1, suave(0.92, 0.97, rel));
    },
  };
  const { casca, face, yc } = meia(o);
  const out: Parte[] = [parte(casca, 'acetinado', true), parte(face, 'umido', true)];
  for (let fila = -1; fila <= 1; fila++) {
    for (let i = 0; i < 12; i++) {
      const u = 0.14 + (0.72 * (i + 0.5)) / 12, { rz } = o.raio(u);
      const g = elipsoide(0.0042, 0.0009, 0.0024, () => rgb('#e8ecc8'), 4, 6);
      g.rotateY(fila * 0.4 + (hash(i + fila * 20, 2) - 0.5) * 0.5);
      g.translate((u - 0.5) * L, yc + 0.0003, fila * rz * 0.42);
      out.push(parte(g, 'umido'));
    }
  }
  for (let i = 0; i < 16; i++) {
    const u = 0.1 + 0.8 * hash(i, 7), f = PI + 0.2 + (PI - 0.4) * hash(i, 8);
    const { p, n } = naCasca(o, yc, u, f);
    const g = torno({ caminho: [[0, 0], [0.0034, 0], [0.0026, 0.003], [0.0008, 0.007], [0, 0.0085]], n: 6, m: 8, cor: (x, y) => mix(c1, rgb('#f6e0a0'), suave(0.003, 0.008, y)) });
    out.push(parte(apontar(g, n, p.addScaledVector(n, -0.0008)), 'acetinado'));
  }
  return out;
};

/** Gomo de fruta redonda (eixo em X) entre os ângulos ph0 e ph1, com a cavidade do miolo vazada. */
function gomo(Rx: number, R: number, ph0: number, ph1: number, rcav: number, fora: CorFn, face: CorFn, cav: CorFn): THREE.BufferGeometry[] {
  const S = (th: number, ph: number, rr: number): P3 => [-Rx * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph)];
  const phm = (ph0 + ph1) / 2;
  const ref = V(0, R * 0.55 * Math.cos(phm), R * 0.55 * Math.sin(phm));
  const gs = [
    grade(12, 10, (u, v) => S(u * PI, lerp(ph0, ph1, v), R * Math.sin(u * PI)), fora),
    ...[ph0, ph1].map((ph) => grade(12, 4, (u, w) => { const th = u * PI, ro = R * Math.sin(th); return S(th, ph, lerp(Math.min(rcav, ro), ro, w)); }, face)),
    grade(12, 3, (u, v) => S(u * PI, lerp(ph0, ph1, v), Math.min(rcav, R * Math.sin(u * PI))), cav),
  ];
  return gs.map((g) => orientar(g, ref));
}

const gSapotilhaPedacos: Gerador = (k) => {
  // sapotilha descascada em gomos, sem as sementes: polpa parda e granulosa, cavidade escura no meio
  const { ci, s } = k;
  const fora: CorFn = (x, y, z) => mul(mix(ci, rgb('#a87040'), suave(0.3, 0.8, fbm(x * 150, y * 150, z * 150, s)) * 0.5), 1 - 0.08 * pinta(x, y, z, 900, 0.3, s));
  const face: CorFn = (x, y, z) => mul(mix(mul(ci, 1.06), rgb('#d8a878'), suave(0.4, 0.8, fbm(x * 300, y * 300, z * 300, s + 1)) * 0.5), 1 - 0.06 * pinta(x, y, z, 1200, 0.3, s + 2));
  const cav: CorFn = () => rgb('#7a4a2a');
  const out: Parte[] = [];
  for (let i = 0; i < 6; i++) {
    const gs = gomo(0.034, 0.03, 0, PI / 3, 0.008, fora, face, cav);
    const giro = (i / 6) * TAU + k.r.f(-0.15, 0.15);
    gs.forEach((g, j) => {
      g.rotateX(-PI / 2);
      g.translate(0.004, 0, 0.006);
      g.rotateY(giro);
      out.push(parte(g, j === 0 ? 'acetinado' : 'umido', true));
    });
  }
  return out;
};

const gNesperaDescascada: Gerador = (k) => {
  // nêspera sem a pele fina: polpa laranja brilhante de suco, o restinho escuro da flor na ponta
  const { ci, c1, s } = k;
  const rx = 0.024;
  return [parte(elipsoide(rx, 0.019, 0.02, (x, y, z) => {
    let c = mix(mix(c1, ci, 0.35), rgb('#e88a28'), suave(0.3, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.4);
    const rp = Math.hypot(y, z);
    if (x > rx * 0.86) c = mix(c, rgb('#4a2a14'), (1 - suave(0.002, 0.005, rp * (1 + 0.4 * Math.cos(5 * Math.atan2(z, y))))) * 0.9);
    if (x < -rx * 0.9) c = mix(c, rgb('#b88a4a'), (1 - suave(0.0015, 0.003, rp)) * 0.8);
    return c;
  }, 14, 18, (t, a) => 1 + 0.025 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, s)), 'umido', true)];
};

const gMangostaoAberto: Gerador = (k) => {
  // mangostão com a tampa da casca tirada: copo de casca roxa grossa com os gomos brancos dentro,
  // e a tampa com o cálice verde virada ao lado
  const { c1, c2, c3, s } = k;
  const R = 0.033, Hc = 0.028, ri = 0.025, yf = 0.007;
  const cascaFora: CorFn = (x, y, z) => mix(mix(c1, c2, suave(0.3, 0.8, fbm(x * 90, y * 90, z * 90, s))), rgb('#7a5a6a'), pinta(x, y, z, 600, 0.1, s) * 0.4);
  const cam: P2[] = [[0, 0], [R * 0.5, 0.0005], [R * 0.85, 0.005], [R * 0.98, 0.014], [R, 0.022], [R * 0.99, Hc], [ri, Hc], [ri * 0.98, 0.02], [ri * 0.85, 0.011], [ri * 0.5, yf + 0.001], [0, yf]];
  const t1 = arco(cam, 5), t2 = arco(cam, 6);
  const out: Parte[] = [parte(torno({
    caminho: cam, n: 30, m: 36,
    cor: (x, y, z, t) => (t < t1 + 0.004 ? cascaFora(x, y, z, t, 0) : t < t2 + 0.004 ? rgb('#a8204a') : mix(rgb('#c84a70'), rgb('#e88aa0'), suave(0.4, 0.8, fbm(x * 300, y * 300, z * 300, s)))),
  }), 'acetinado', true)];
  const Rs = 0.0235, Hs = 0.034;
  out.push(parte(torno({
    caminho: (u) => { const th = u * PI; return [Rs * Math.sin(th), yf - 0.001 + (Hs * (1 - Math.cos(th))) / 2]; },
    n: 20, m: 36,
    mod: (t, a) => 1 - 0.07 * Math.exp(-((linha(((a + 0.03 * Math.sin(a * 2)) * 6) / TAU) / 0.035) ** 2)) * Math.sin(PI * t),
    cor: (x, y, z, t, a) => mix(mul(rgb('#f6f4ee'), 0.97 + 0.04 * fbm(x * 300, y * 300, z * 300, s)), rgb('#d8d0c0'), Math.exp(-((linha((a * 6) / TAU) / 0.04) ** 2))),
  }), 'umido'));
  // tampa apoiada na borda, com o cálice e o cabinho por cima
  const tampa: THREE.BufferGeometry[] = [torno({
    caminho: [[0, 0.016], [ri * 0.5, 0.0145], [ri * 0.85, 0.009], [ri, 0.0006], [R * 0.99, 0], [R, 0.007], [R * 0.9, 0.016], [R * 0.55, 0.022], [0, 0.024]],
    n: 24, m: 32,
    cor: (x, y, z) => (Math.hypot(x, z) < ri * 0.98 && y < 0.017 ? rgb('#c84a70') : y < 0.0012 ? rgb('#a8204a') : cascaFora(x, y, z, 0, 0)),
  })];
  for (let i = 0; i < 4; i++) {
    const g = petala(0.015, 0.012, { contorno: contornos.redonda, curva: -0.4, concha: 0.2, esp: 0.0018, n: 7, m: 6, cima: () => mul(c3, 0.95), baixo: () => mul(c3, 0.75) });
    g.rotateZ(-0.25);
    g.rotateY((i / 4) * TAU + 0.4);
    g.translate(0, 0.0235, 0);
    tampa.push(g);
  }
  tampa.push(caule([V(0, 0.023, 0), V(0.001, 0.03, 0.001), V(0.003, 0.036, 0.002)], 0.0016, 0.0012, tomR(rgb('#5a4a2a'), 0.1, 400, s), 5));
  tampa.forEach((g, i) => {
    g.rotateZ(0.35);
    g.translate(0.058, 0.003, 0.012);
    out.push(parte(g, i === 0 ? 'acetinado' : 'fosco'));
  });
  return out;
};

const gFigoDaIndiaDescascado: Gerador = (k) => {
  // figo-da-índia sem a casca de espinhos: polpa laranja brilhante com as sementes aparecendo por baixo
  const { ci, s } = k;
  const L = 0.07, R = 0.025;
  const polpa: CorFn = (x, y, z) => mix(mix(ci, rgb('#d8602a'), suave(0.3, 0.8, fbm(x * 100, y * 100, z * 100, s)) * 0.5), rgb('#7a4a22'), pinta(x, y, z, 520, 0.22, s) * 0.45);
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 20, m: 26, tampa: true, aneisTampa: 4,
    perfil: (t) => { const r = R * (0.68 + 0.32 * Math.sin(PI * t) ** 0.8); return { ry: r, rz: r }; },
    mod: (t, a) => 1 - 0.015 * Math.abs(Math.sin(a * 4 + 0.3)) ** 6,
    cor: polpa,
    corTampa: (x, y, z) => mix(polpa(x, y, z, 0, 0), rgb('#5a3418'), pinta(x, y, z, 900, 0.25, s + 3) * 0.5),
  }), 'umido', true)];
};

const gLichiaDescascada: Gerador = (k) => {
  // lichia sem a casca: polpa branca perolada e translúcida, um pouco irregular
  const { s } = k;
  return [parte(elipsoide(0.0155, 0.0145, 0.0145, (x, y, z) => {
    let c = mix(rgb('#f4f0e8'), rgb('#d2cec8'), suave(0.4, 0.75, fbm(x * 160, y * 160, z * 160, s)) * 0.7);
    c = mix(c, rgb('#e4dcd4'), 0.3 * Math.abs(Math.sin(Math.atan2(z, y) * 7 + x * 300)) ** 30);
    return x < -0.0135 ? mix(c, rgb('#b8907a'), 0.6) : c;
  }, 14, 18, (t, a) => 1 + 0.04 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, s)), 'umido', true)];
};

const gFrutasSecasCozidas: Gerador = (k) => {
  // ameixas, damascos e figos secos inchados de cozinhar, soltos e brilhantes de calda
  const { s } = k;
  const out: Parte[] = [];
  const pecas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    pecas.push(elipsoide(0.015, 0.0085, 0.011, (x, y, z) => mix(rgb('#2a1410'), rgb('#5a2418'), suave(0.5, 0.85, fbm(x * 200, y * 200, z * 200, s + i))), 12, 16, (t, a) => 1 + 0.07 * (fbm(t * 7, Math.cos(a) * 3, Math.sin(a) * 3, s + i) - 0.2)));
    pecas.push(torno({
      caminho: [[0, 0], [0.014, 0.0005], [0.018, 0.004], [0.016, 0.008], [0.008, 0.0095], [0, 0.009]], n: 12, m: 20, l: 0.85,
      mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 4, s + 10 + i),
      cor: (x, y, z) => mix(rgb('#e08030'), rgb('#a8501a'), suave(0.45, 0.8, fbm(x * 220, y * 220, z * 220, s + 20 + i)) + 0.5 * Math.exp(-((x / 0.0015) ** 2)) * suave(0.006, 0.009, y)),
    }));
  }
  for (let i = 0; i < 2; i++) {
    pecas.push(torno({
      caminho: [[0, 0], [0.012, 0.0008], [0.017, 0.006], [0.014, 0.013], [0.006, 0.019], [0.002, 0.022], [0, 0.023]], n: 14, m: 18, l: 0.8,
      mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 5, s + 30 + i),
      cor: (x, y, z) => mix(mix(rgb('#5a3828'), rgb('#3a2018'), suave(0.4, 0.8, fbm(x * 180, y * 180, z * 180, s + 40 + i))), rgb('#9a7a60'), suave(0.6, 0.8, fbm(x * 400, y * 400, z * 400, s + 50)) * 0.4),
    }));
  }
  pecas.forEach((g, i) => {
    const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / pecas.length) * 0.04;
    g.rotateX(k.r.f(-0.5, 0.5));
    g.rotateY(k.r.f(0, TAU));
    g.translate(Math.cos(a) * rr, (1 - rr / 0.04) * 0.012, Math.sin(a) * rr);
    out.push(parte(g, 'brilhante', true));
  });
  return out;
};

/* ------------------------------------------------------------------ */
/* sobremesas                                                            */
/* ------------------------------------------------------------------ */

const gConchasMerengue: Gerador = (k) => {
  // duas conchas de merengue unidas por uma camada grossa de ganache, com cacau e açúcar por cima
  const { s } = k;
  const R = 0.034, l = 0.62, Hs = 0.024, hg = 0.008;
  const cam: P2[] = [[0, 0], [R * 0.8, 0], [R * 0.97, 0.003], [R, 0.007], [R * 0.88, Hs * 0.55], [R * 0.6, Hs * 0.85], [R * 0.25, Hs], [0, Hs * 1.02]];
  const meri = (cacau: boolean): CorFn => (x, y, z) => {
    let c = mix(rgb('#f8f2e2'), rgb('#ecd6a4'), suave(0.5, 0.85, fbm(x * 90, y * 90, z * 90, s)) * 0.6);
    if (cacau) {
      c = mix(c, rgb('#6a4028'), suave(0.55, 0.75, fbm(x * 260, y * 260, z * 260, s + 1)) * suave(Hs + hg + 0.012, Hs * 2 + hg, y) * 0.8);
      c = mix(c, rgb('#fdfcf8'), pinta(x, y, z, 900, 0.2, s + 2) * 0.7);
    }
    return c;
  };
  const concha = (cacau: boolean) => torno({ caminho: cam, n: 20, m: 36, l, mod: (t, a) => 1 + 0.025 * Math.abs(Math.cos(a * 9)) * suave(0.1, 0.3, t), cor: meri(cacau) });
  const baixo = concha(false);
  baixo.rotateX(PI);
  baixo.translate(0, Hs * 1.02, 0);
  const cima = concha(true);
  cima.translate(0, Hs * 1.02 + hg, 0);
  const gan = torno({
    caminho: [[0, 0], [R * 0.9, 0], [R * 0.99, hg * 0.5], [R * 0.9, hg], [0, hg]], n: 10, m: 36, l,
    mod: (t, a) => 1 + 0.03 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, s),
    cor: (x, y, z) => mix(rgb('#3a1c10'), rgb('#5a3020'), suave(0.5, 0.8, fbm(x * 200, y * 200, z * 200, s + 3)) * 0.5),
  });
  gan.translate(0, Hs * 1.02, 0);
  return [parte(baixo, 'fosco', true), parte(cima, 'fosco', true), parte(gan, 'brilhante')];
};

function framboesa(r: number, s: number): THREE.BufferGeometry {
  const g = elipsoide(r * 1.1, r, r, (x, y, z) => mix(rgb('#b0102a'), rgb('#d8304a'), suave(0.3, 0.8, fbm(x * 900, y * 900, z * 900, s)) * 0.5), 8, 10, (t, a) => 1 + 0.08 * Math.cos(t * PI * 9) * Math.cos(a * 7));
  return g.rotateZ(PI / 2);
}

const gSufleFrio: Gerador = (k) => {
  // suflê frio de frutas sem o colarinho: cilindro rosado liso que sobe acima da borda do ramequim,
  // topo decorado com framboesas e hortelã
  const { c1, s } = k;
  const R = 0.031, H = 0.075;
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.003], [R, H - 0.004], [R * 0.97, H - 0.0005], [R * 0.6, H], [0, H + 0.0008]], n: 26, m: 40,
    cor: (x, y, z) => {
      let c = mul(c1, 0.96 + 0.06 * fbm(x * 200, y * 200, z * 200, s));
      c = mix(c, mul(c1, 1.15), pinta(x, y, z, 1100, 0.15, s) * 0.3);
      c = mul(c, 1 - 0.04 * Math.abs(Math.sin(Math.atan2(x, z) * 9 + y * 40)) ** 6);
      return mix(c, mul(c1, 0.86), Math.exp(-(((y - 0.036) / 0.0008) ** 2)) * 0.5);
    },
  }), 'acetinado', true)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const g = framboesa(0.006, s + i);
    g.translate(Math.cos(a) * 0.017, H + 0.0055, Math.sin(a) * 0.017);
    out.push(parte(g, 'brilhante'));
  }
  const h = folha(0.022, 0.012, rgb('#3a8a2a'), rgb('#5aa83a'), { contorno: contornos.oval, curva: 0.2, concha: 0.2, n: 8, m: 6 });
  h.translate(-0.011, H + 0.0012, 0);
  h.rotateY(0.6);
  out.push(parte(h, 'acetinado'));
  return out;
};

/** Frutas vistas através da gelatina num ponto (u, w) da superfície: cor da fruta e quanto aparece. */
function frutaNaGelatina(u: number, w: number, s: number, vale: (cu: number, cw: number) => boolean): [RGB, number] {
  const tam = 0.016;
  const gu = Math.floor(u / tam), gw = Math.floor(w / tam);
  let melhor = 9, tipo = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cu = gu + i, cw = gw + j;
      const h1 = hash(cu * 7.1 + cw * 13.7, s), h2 = hash(cu * 3.3 - cw * 5.9, s + 1), h3 = hash(cu * 1.7 + cw * 2.9, s + 2);
      const pu = (cu + 0.2 + 0.6 * h1) * tam, pw = (cw + 0.2 + 0.6 * h2) * tam;
      if (!vale(pu, pw)) continue;
      const d = Math.hypot(u - pu, w - pw) / (tam * (0.3 + 0.2 * h3));
      if (d < melhor) { melhor = d; tipo = Math.floor(h3 * 4); }
    }
  }
  const cores = [mix(rgb('#c8142a'), rgb('#f8c8c0'), 1 - suave(0, 0.55, melhor)), rgb('#c8d870'), rgb('#a01838'), rgb('#2a2a5a')];
  return [cores[tipo], (1 - suave(0.8, 1, melhor)) * 0.6];
}

function gGelatina(camadas: boolean): Gerador {
  return (k) => {
    // gelatina desenformada, rubi e translúcida: as frutas aparecem através dela, em camadas
    // separadas por gelatina clara ou soltas ao acaso
    const { c1, s } = k;
    const R = 0.072, H = 0.062;
    const vale = (y: number) => (pu: number, pw: number) => !camadas || frac(((y > H - 0.001 ? H * 0.95 : pw) / H) * 3) < 0.6;
    return [parte(torno({
      caminho: [[0, 0], [R * 0.96, 0], [R, 0.004], [R * 0.97, H * 0.6], [R * 0.92, H - 0.005], [R * 0.88, H], [R * 0.4, H], [0, H]], n: 28, m: 64,
      cor: (x, y, z) => {
        const topo = y > H - 0.0008;
        const a = Math.atan2(x, z);
        const [u, w] = topo ? [x, z] : [a * R, y];
        let c = mix(mul(c1, 1.12), mul(c1, 0.78), topo ? 0.1 : 1 - y / H);
        c = mix(c, rgb('#f8a0a8'), Math.abs(Math.sin(a * 2 + 0.5)) ** 12 * 0.2);
        if (camadas && !topo) c = mix(c, mul(c1, 1.3), suave(0.62, 0.7, frac((y / H) * 3)) * suave(0.98, 0.9, frac((y / H) * 3)) * 0.35);
        const [fc, kf] = frutaNaGelatina(u, w, s, vale(y));
        return mix(c, mix(fc, c, 0.35), kf);
      },
    }), 'umido', true)];
  };
}

const gPeleCustard: Gerador = (k) => {
  // superfície do custard assado: pele dourada, manchas tostadas e noz-moscada ralada salpicada
  const { s } = k;
  const R = 0.044, h = 0.0035;
  const borda = (x: number, z: number) => 1 + 0.04 * fbm(x * 2, z * 2, 0, s);
  const base = torno({ caminho: [[0, 0], [R * 0.95, 0], [R, h * 0.5], [R * 0.97, h], [0, h]], n: 8, m: 56, mod: (t, a) => borda(Math.sin(a), Math.cos(a)), cor: () => rgb('#e8c870') });
  const topo = discoPolar(R * 0.97, h + 0.0002, 18, 64, (x, z, r) => {
    let c = mix(rgb('#ecc868'), rgb('#b8803a'), suave(0.5, 0.8, fbm(x * 60, 0, z * 60, s)) * 0.8);
    c = mix(c, rgb('#a8702a'), suave(0.75, 1, r) * 0.5);
    return mix(c, rgb('#5a3418'), pinta(x, 0, z, 700, 0.14, s + 3) * 0.85);
  }, (a) => borda(Math.cos(a), Math.sin(a)));
  return [parte(base, 'acetinado', true), parte(topo, 'acetinado')];
};

const gCrostaBrulee: Gerador = (k) => {
  // crosta de açúcar caramelizado do brûlée: âmbar brilhante, manchas queimadas e trincas finas
  const { s } = k;
  const R = 0.031, h = 0.003;
  const borda = (x: number, z: number) => 1 + 0.05 * fbm(x * 2.5, z * 2.5, 0, s);
  const base = torno({ caminho: [[0, 0], [R * 0.95, 0], [R, h * 0.5], [R * 0.97, h], [0, h]], n: 8, m: 48, mod: (t, a) => borda(Math.sin(a), Math.cos(a)), cor: () => rgb('#c88a2a') });
  const topo = discoPolar(R * 0.97, h + 0.0002, 16, 56, (x, z, r) => {
    let c = mix(rgb('#d89a38'), rgb('#b0681a'), suave(0.3, 0.8, fbm(x * 70, 0, z * 70, s)));
    c = mix(c, rgb('#5a2a0c'), suave(0.62, 0.85, fbm(x * 110, 0, z * 110, s + 1)) * 0.85);
    c = mix(c, rgb('#3a1806'), (1 - suave(0, 0.05, Math.abs(ruido(x * 140, 0, z * 140, s + 2)))) * 0.7);
    return mix(c, rgb('#e8b450'), suave(0.85, 1, r) * 0.5);
  }, (a) => borda(Math.cos(a), Math.sin(a)));
  return [parte(base, 'brilhante', true), parte(topo, 'brilhante')];
};

const gSufleBaunilha: Gerador = (k) => {
  // suflê assado crescido bem acima da borda, laterais douradas, a coroa trincada em volta do topo
  // e açúcar de confeiteiro polvilhado
  const { s } = k;
  const R = 0.031;
  return [parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.003], [R, 0.052], [R, 0.058], [R * 0.97, 0.062], [R * 0.86, 0.064], [R * 0.8, 0.0625], [R * 0.72, 0.066], [R * 0.4, 0.071], [0, 0.072]],
    n: 44, m: 52,
    mod: (t, a) => 1 + 0.012 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 6, s),
    cor: (x, y, z) => {
      const r = Math.hypot(x, z) / R;
      if (y < 0.034) return rgb('#f2dca0');
      let c = mix(rgb('#dca452'), rgb('#b0702e'), suave(0.034, 0.062, y) * 0.8 + 0.2 * fbm(x * 200, y * 200, z * 200, s));
      if (y > 0.061) {
        c = mix(rgb('#c8883a'), rgb('#e0a858'), suave(0.7, 0.2, r));
        c = mix(c, rgb('#f0d898'), Math.exp(-(((r - 0.8) / 0.03) ** 2)) * 0.8);
        c = mix(c, rgb('#fbfaf6'), pinta(x, y, z, 800, 0.3, s + 1) * suave(0.95, 0.4, r) * 0.85);
      }
      return c;
    },
  }), 'fosco', true)];
};

const gCharlotteMaca: Gerador = (k) => {
  // charlotte desenformada: cilindro forrado de fatias de pão douradas e sobrepostas, topo em
  // triângulos, tudo brilhando de geleia de abricó
  const { s } = k;
  const Rb = 0.074, Rt = 0.066, H = 0.085, nS = 13;
  const fatia = (a: number) => frac(((a + PI) / TAU) * nS);
  return [parte(torno({
    caminho: [[0, 0], [Rb * 0.97, 0], [Rb, 0.004], [lerp(Rb, Rt, 0.5), H * 0.5], [Rt, H - 0.006], [Rt * 0.94, H], [Rt * 0.5, H + 0.002], [0, H + 0.003]],
    n: 30, m: 64,
    mod: (t, a) => 1 + 0.018 * fatia(a) * suave(0.05, 0.12, t) * suave(0.75, 0.68, t),
    cor: (x, y, z) => {
      const a = Math.atan2(x, z);
      let c: RGB;
      if (y > H - 0.004) {
        const tri = linha(((a + PI) / TAU) * 8);
        const r = Math.hypot(x, z) / Rt;
        c = mix(rgb('#d8a050'), rgb('#9a6020'), Math.exp(-((tri / 0.03) ** 2)) * 0.8 + suave(0.2, 0.1, r) * 0.6);
      } else {
        const f = fatia(a);
        c = mix(rgb('#e0a858'), rgb('#b07028'), suave(0.15, 0.02, Math.min(f, 1 - f)) * 0.7 + suave(H * 0.2, 0, y) * 0.3);
        c = mix(c, rgb('#7a4818'), suave(0.05, 0.0, Math.min(f, 1 - f)) * 0.6);
      }
      c = mul(c, 0.94 + 0.1 * fbm(x * 260, y * 260, z * 260, s));
      return mix(c, rgb('#e09030'), 0.25 * suave(0.4, 0.8, fbm(x * 40, y * 40, z * 40, s + 3)));
    },
  }), 'brilhante', true)];
};

const gChocolatePicado: Gerador = (k) => {
  // chocolate picado à faca: lascas e cacos irregulares de tamanhos diferentes e farelinho
  const { s } = k;
  const out: Parte[] = [];
  const caco = (r0: number, esp: number, i: number) => {
    const nv = 5 + (i % 3), poly: P2[] = [];
    for (let q = 0; q < nv; q++) { const a = (q / nv) * TAU + hash(i * 7 + q, 1) * 0.6; poly.push([Math.cos(a) * r0 * (0.55 + 0.6 * hash(i * 11 + q, 2)), Math.sin(a) * r0 * (0.55 + 0.6 * hash(i * 13 + q, 3))]); }
    const g = extrusao(poly, -esp / 2, esp / 2, (x, y, z) => mix(rgb('#3a2216'), rgb('#5c3a28'), suave(0.4, 0.8, fbm(x * 500, y * 500, z * 500, s + i))), { tampa: (x, y, z) => mul(rgb('#3e2418'), 0.95 + 0.1 * fbm(x * 400, y * 400, z * 400, s)) });
    return g.rotateZ(PI / 2);
  };
  monte(k, 36, 0.04, 0.016, (i) => caco(0.008 * k.r.f(0.6, 1.4), 0.004 * k.r.f(0.6, 1.3), i), 0.9).forEach((g, i) => out.push(parte(g, 'acetinado', i < 3)));
  monte(k, 30, 0.048, 0.004, (i) => caco(0.0025, 0.0018, i + 50), 1.2).forEach((g) => out.push(parte(g, 'acetinado')));
  return out;
};

const gSemifreddoFatias: Gerador = (k) => {
  // fatias retangulares grossas de semifreddo: creme rosado de framboesa marmorizado, pedaços de
  // merengue e bolhinhas à mostra
  const { s } = k;
  const out: Parte[] = [];
  const sx = 0.07, sy = 0.022, sz = 0.06;
  const cor: CorFn = (x, y, z) => {
    let c = mix(rgb('#f2a8b6'), rgb('#c83a5a'), suave(0.55, 0.75, fbm(x * 80 + y * 30, y * 80, z * 80, s)) * 0.7);
    c = mix(c, rgb('#fbf8f0'), pinta(x, y, z, 160, 0.3, s + 1) * 0.9);
    return mix(c, mul(c, 1.12), pinta(x, y, z, 1200, 0.2, s + 2) * 0.4);
  };
  const pos: [number, number, number, number][] = [[0, sy / 2, 0, 0], [0.04, sy * 1.35, 0.008, 0.28], [-0.045, sy / 2 + 0.002, -0.006, -0.1]];
  pos.forEach(([x, y, z, rz], i) => {
    const g = bloco(sx, sy, sz, (xx, yy, zz) => cor(xx + i * 0.3, yy, zz, 0, 0), [14, 3, 12]);
    g.rotateZ(rz);
    g.rotateY(i * 0.15);
    g.translate(x, y, z);
    out.push(parte(g, 'acetinado', true));
  });
  return out;
};

const gLimaoGivre: Gerador = (k) => {
  // limão givré: casca oca de limão congelada, coberta de geada, recheada de sorbet acima da borda
  // e com a tampa cortada inclinada por cima
  const { c1, s } = k;
  const geada = (x: number, y: number, z: number, c: RGB) => mix(mix(c, mul(c1, 0.85), pinta(x, y, z, 700, 0.18, s) * 0.5), rgb('#f4f6ee'), suave(0.5, 0.75, fbm(x * 120, y * 120, z * 120, s + 1)) * 0.45);
  const cam: P2[] = [[0, 0], [0.011, 0], [0.017, 0.004], [0.024, 0.013], [0.0285, 0.026], [0.0285, 0.038], [0.026, 0.05], [0.0255, 0.053], [0.0225, 0.0535], [0.022, 0.058], [0.02, 0.07], [0.015, 0.082], [0.008, 0.089], [0, 0.091]];
  const out: Parte[] = [parte(torno({
    caminho: cam, n: 34, m: 36,
    desloc: (p) => {
      if (p.y < 0.054) return;
      const e = 1 + 0.06 * fbm(p.x * 160, p.y * 160, p.z * 160, s + 2);
      p.x *= e;
      p.z *= e;
    },
    cor: (x, y, z) => {
      const r = Math.hypot(x, z);
      if (y < 0.0528 && r > 0.02) return geada(x, y, z, c1);
      if (y < 0.0542 && r > 0.0218) return rgb('#f4f0dc');
      return mix(rgb('#f6f2d0'), rgb('#fbfbf4'), pinta(x, y, z, 900, 0.3, s + 3) * 0.6);
    },
  }), 'acetinado', true)];
  const tampa = torno({
    caminho: [[0, 0], [0.022, 0], [0.022, 0.004], [0.017, 0.012], [0.009, 0.019], [0.004, 0.022], [0.0025, 0.026], [0, 0.027]], n: 18, m: 28,
    cor: (x, y, z) => (y < 0.0006 ? mix(rgb('#f4ecc0'), rgb('#f8f0d0'), Math.abs(Math.sin(Math.atan2(x, z) * 5)) ** 4) : geada(x, y, z, c1)),
  });
  tampa.rotateZ(-0.45);
  tampa.translate(0.01, 0.074, 0);
  out.push(parte(tampa, 'acetinado'));
  return out;
};

const gNinhoCaramelo: Gerador = (k) => {
  // ninho de fios finos de caramelo dourado, puxados com a colher em voltas sobre o papel
  const { s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 28; i++) {
    const pts: THREE.Vector3[] = [];
    const ph = i * 2.39996;
    for (let q = 0; q < 14; q++) {
      const a = ph + q * 0.55;
      const rr = 0.018 + 0.02 * hash(i * 31 + q, 1);
      const y = 0.002 + 0.026 * suave(0.016, 0.038, rr) + 0.004 * hash(i * 17 + q, 2);
      pts.push(V(Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    out.push(parte(tubo(pts, {
      raio: (t) => 0.00055 + 0.00035 * Math.sin(t * PI * 3 + i) ** 2, m: 3, n: 30,
      cor: (x, y, z) => mix(rgb('#e0a838'), rgb('#a8601a'), suave(0.3, 0.8, fbm(x * 200, y * 200, z * 200, s + i))),
    }), 'brilhante', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* massas doces e pastelaria                                            */
/* ------------------------------------------------------------------ */

const massaCor = (base: RGB, s: number): CorFn => (x, y, z) => mix(mul(base, 0.96 + 0.06 * fbm(x * 200, y * 200, z * 200, s)), rgb('#faf6ec'), suave(0.6, 0.85, fbm(x * 90, y * 90, z * 90, s + 4)) * 0.35);

const gPateSucree: Gerador = (k) => {
  // disco grosso de pâte sucrée embrulhado para descansar: massa lisa, mais amarela que a brisée
  const { c1, s } = k;
  const R = 0.06, H = 0.026;
  return [parte(torno({
    caminho: [[0, 0], [R * 0.85, 0], [R * 0.98, 0.004], [R, 0.012], [R * 0.96, 0.02], [R * 0.82, H], [R * 0.4, H * 1.03], [0, H * 1.04]], n: 22, m: 48,
    mod: (t, a) => 1 - 0.03 * suave(0.62, 0.85, fbm(Math.cos(a) * 6, Math.sin(a) * 6, t * 3, s)) * Math.sin(PI * t),
    cor: massaCor(c1, s),
  }), 'acetinado', true)];
};

const gBarquinhaRecheada: Gerador = (k) => {
  // barquinha de massa dourada recheada de creme confeiteiro, com metades de morango glaçadas
  const { c1, s } = k;
  const L = 0.085, W = 0.036, Hc = 0.016;
  const rzA = (t: number) => (W / 2) * Math.sin(PI * t) ** 0.75 + 1e-4;
  const out: Parte[] = [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 24, m: 28,
    perfil: (t) => ({ ry: Hc * Math.sin(PI * t) ** 0.5 + 1e-4, rz: rzA(t) }),
    desloc: (p, t) => {
      if (p.y <= 0) return;
      const rel = Math.min(1, Math.abs(p.z) / rzA(t));
      p.y = 0.0055 * Math.sin(PI * t) ** 0.6 * (1 - rel * rel) + (rel > 0.86 ? 0.0012 : 0);
    },
    cor: (x, y, z, t) => {
      const rel = Math.min(1, Math.abs(z) / rzA(t));
      if (y > 0.0002 && rel < 0.84) return mix(rgb('#f2d070'), rgb('#f8e098'), suave(0.4, 0.8, fbm(x * 200, y * 200, z * 200, s)) * 0.5);
      return mul(mix(c1, rgb('#b07028'), suave(0, -Hc, y) * 0.6), 0.94 + 0.1 * fbm(x * 300, y * 300, z * 300, s + 1));
    },
  }), 'acetinado', true)];
  [-0.022, 0, 0.022].forEach((x, i) => {
    const m = morangoMeia(s + i, 0.024, 0.0095, rgb('#c8141e'), rgb('#e8d070'), rgb('#3a7a2a'));
    for (const g of [m.casca, m.face]) {
      g.rotateY(PI / 2 + (i - 1) * 0.3);
      g.translate(x, 0.0045, (i - 1) * 0.002);
      out.push(parte(g, 'brilhante'));
    }
  });
  return out;
};

const gMassaAberta: Gerador = (k) => {
  // massa podre aberta com o rolo num disco fino de borda irregular, polvilhada de farinha
  const { c1, s } = k;
  const R = 0.13, h = 0.004;
  const borda = (x: number, z: number) => 1 + 0.06 * fbm(x * 2, z * 2, 0, s) - 0.03;
  const corM = massaCor(c1, s);
  return [
    parte(torno({ caminho: [[0, 0], [R * 0.97, 0], [R, h * 0.5], [R * 0.97, h], [0, h]], n: 8, m: 56, mod: (t, a) => borda(Math.sin(a), Math.cos(a)), cor: corM }), 'fosco', true),
    parte(discoPolar(R * 0.97, h + 0.0002, 14, 56, (x, z) => mul(corM(x, h, z, 0, 0), 1 + 0.025 * Math.sin(x * 300 + fbm(x * 20, 0, z * 20, s) * 3)), (a) => borda(Math.cos(a), Math.sin(a))), 'fosco'),
  ];
};

const gFolhasMassa: Gerador = (k) => {
  // folhas recortadas da massa aberta, com os veios riscados na ponta da faca
  const { c1, s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 8; i++) {
    const Lf = 0.05 * k.r.f(0.9, 1.1), Wf = Lf * 0.44;
    const g = folha(Lf, Wf, c1, mul(c1, 0.8), {
      contorno: contornos.oval, esp: 0.0028, curva: 0.04, n: 14, m: 8,
      cor: (x, y, z) => {
        const az = Math.abs(z);
        const veio = Math.max(1 - suave(0, 0.0011, az), Math.abs(Math.sin(((x - az * 1.3) / Lf) * TAU * 4)) ** 16 * (1 - suave(Wf * 0.15, Wf * 0.42, az)));
        return mix(massaCor(c1, s)(x, y, z, 0, 0), mul(c1, 0.72), veio * 0.7);
      },
    });
    g.rotateY((i % 2 ? 0.5 : -0.5) + k.r.f(-0.15, 0.15));
    g.translate(-0.09 + i * 0.024, i * 0.0006, (i % 2 ? 1 : -1) * 0.006);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

const gTrancaMassa: Gerador = (k) => {
  // três tiras de massa trançadas para a borda da torta
  const { c1, s } = k;
  const L = 0.2, A = 0.0075, B = 0.0032;
  const out: Parte[] = [];
  for (let i = 0; i < 3; i++) {
    const pts: THREE.Vector3[] = [];
    for (let q = 0; q <= 40; q++) {
      const u = q / 40, th = u * TAU * 4.5 + (i * TAU) / 3;
      pts.push(V((u - 0.5) * L, 0.0045 + B * Math.sin(2 * th), A * Math.sin(th)));
    }
    out.push(parte(tubo(pts, { raio: 0.0028, achata: 1.6, cima: V(0, 1, 0), m: 8, n: 60, cor: massaCor(c1, s + i) }), 'acetinado', true));
  }
  return out;
};

function cone(c1: RGB, s: number): THREE.BufferGeometry {
  return torno({ caminho: [[0, 0], [0.0075, 0], [0.0072, 0.002], [0.0045, 0.012], [0.0015, 0.019], [0, 0.02]], n: 14, m: 18, cor: massaCor(c1, s) });
}
const gConeMassa: Gerador = (k) => [parte(cone(k.c1, k.s), 'acetinado', true)];
const gConePetalas: Gerador = (k) => {
  // cone de 2 cm e as cinco pétalas cortadas, cada uma com uma parte achatada mais fina
  const { c1, s } = k;
  const out: Parte[] = [parte(cone(c1, s).translate(-0.03, 0, 0), 'acetinado', true)];
  for (let i = 0; i < 5; i++) {
    const g = torno({
      caminho: [[0, 0], [0.014, 0], [0.015, 0.0012], [0.014, 0.0025], [0, 0.0025]], n: 8, m: 24,
      desloc: (p) => { p.y *= 1 - 0.55 * suave(-0.2, 1, p.x / 0.015); },
      cor: massaCor(c1, s + i),
    });
    const a = -0.9 + i * 0.45;
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.04 - 0.01, 0, Math.sin(a) * 0.04);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

const gBombaRedonda: Gerador = (k) => {
  // bombinha redonda de choux com o topo mergulhado em caramelo e coberto de amêndoas laminadas
  const { c1, s } = k;
  const R = 0.022;
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.85, 0], [R, 0.006], [R * 0.98, 0.013], [R * 0.82, 0.02], [R * 0.5, 0.025], [0, 0.026]], n: 18, m: 32,
    mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a) * 4, Math.sin(a) * 4, t * 5, s),
    cor: (x, y, z) => mix(mul(c1, 0.95 + 0.1 * fbm(x * 200, y * 200, z * 200, s)), rgb('#e8c080'), suave(0.6, 0.75, fbm(x * 150, y * 150, z * 150, s + 1)) * 0.6),
  }), 'fosco', true)];
  const yb = 0.0165, yt = 0.0285, Rc = R * 0.96;
  out.push(parte(torno({
    caminho: [[0, 0.012], [R * 0.93, 0.012], [Rc, yb], [R * 0.84, 0.022], [R * 0.52, 0.0268], [0, yt]], n: 14, m: 32,
    cor: (x, y, z) => mix(rgb('#b06a18'), rgb('#d08a28'), suave(0.4, 0.8, fbm(x * 200, y * 200, z * 200, s + 2)) * 0.5),
  }), 'brilhante'));
  for (let i = 0; i < 8; i++) {
    const rr = (i === 0 ? 0 : 0.35 + 0.45 * hash(i, 1)) * Rc, a = i * 2.39996;
    const y = yt - (yt - yb) * (rr / Rc) ** 2;
    const dy = (2 * (yt - yb) * rr) / (Rc * Rc);
    const n = V(Math.cos(a) * dy, 1, Math.sin(a) * dy).normalize();
    const g = petala(0.012, 0.008, { contorno: contornos.oval, esp: 0.0009, n: 6, m: 6, cima: () => rgb('#ecd8a8'), baixo: () => rgb('#c8a070') });
    g.translate(-0.006, 0, 0);
    out.push(parte(apontar(g, n, V(Math.cos(a) * rr, y + 0.0004, Math.sin(a) * rr), hash(i, 2) * TAU), 'acetinado'));
  }
  return out;
};

const gBaklavaLosangos: Gerador = (k) => {
  // losangos de baklava assados e regados de mel, como saem da travessa: o losango é comprido (o
  // dobro do comprimento na largura), baixo, com as folhas de filo em lâminas finas na lateral, a
  // faixa de nozes moídas no meio, o topo dourado e vincado brilhando de calda e um pouco de calda
  // escorrida em volta. Cinco peças com uma fresta entre elas: três de ponta a ponta atrás e duas
  // encaixadas na frente, para cada contorno de losango aparecer inteiro.
  const { s } = k;
  const a = 0.066, b = 0.033, hB = 0.022, g0 = 0.0035;
  const poly: P2[] = [[a / 2, 0], [0, b / 2], [-a / 2, 0], [0, -b / 2]];
  // na lateral (antes de girar, x é a altura): lâminas de filo e a faixa de nozes no meio
  const lado: CorFn = (x, y, z) => {
    if (x > 0.008 && x < 0.0125) {
      const noz = pinta(y, x, z, 1100, 0.45, s);
      return mix(mix(rgb('#5a3a1e'), rgb('#7a5430'), fbm(y * 400, x * 400, z * 400, s) * 0.5 + 0.5), rgb('#a07848'), noz * 0.6);
    }
    const fol = Math.abs(Math.sin((x / 0.0011) * PI)) ** 4;
    const c = mix(rgb('#f2d79a'), rgb('#c88a38'), fol * 0.8);
    // filo mais tostada perto do topo e calda escurecendo a base
    return mix(mix(c, rgb('#b06e24'), suave(0.016, hB, x) * 0.7), rgb('#9a5a18'), suave(0.003, 0, x) * 0.6);
  };
  const tampa: CorFn = (x, y, z) => {
    if (x < hB / 2) return rgb('#9a5a18');
    // topo assado com as folhas amassadas e a calda acumulada nos vincos
    const vinco = Math.abs(Math.sin(y * 420 + 3 * fbm(y * 60, z * 60, 0, s))) ** 6;
    const c = mix(rgb('#d89a3c'), rgb('#efc070'), suave(0.3, 0.8, fbm(y * 220, z * 220, 0, s)) * 0.7);
    return mix(c, rgb('#a8641c'), vinco * 0.55);
  };
  const out: Parte[] = [];
  const pos: P2[] = [[-a - g0, -b / 4], [0, -b / 4], [a + g0, -b / 4], [-a / 2 - g0 / 2, b / 4 + b / 2 + g0], [a / 2 + g0 / 2, b / 4 + b / 2 + g0]];
  pos.forEach(([x, z]) => {
    const g = extrusao(poly, 0, hB, lado, { tampa, nx: 20, nr: 3, sub: 3 });
    g.rotateZ(PI / 2);
    g.translate(x, 0.0012, z);
    out.push(parte(g, 'brilhante', true));
  });
  // calda de mel escorrida em volta de cada peça: losango âmbar um pouco maior, bem fino
  const poca: P2[] = [[a / 2 + 0.004, 0], [0, b / 2 + 0.0025], [-a / 2 - 0.004, 0], [0, -b / 2 - 0.0025]];
  pos.forEach(([x, z], i) => {
    const g = extrusao(poca, 0, 0.0009, (xx, y, zz) => mix(rgb('#7a420e'), rgb('#a8661c'), suave(0.3, 0.8, fbm(y * 90, zz * 90, i, s + 3)) * 0.6), { nx: 1, nr: 1, sub: 2 });
    g.rotateZ(PI / 2);
    g.translate(x, 0, z);
    out.push(parte(g, 'brilhante'));
  });
  // nozes picadas por cima, no centro de cada losango
  for (let i = 0; i < 20; i++) {
    const [px, pz] = pos[i % 5];
    const g = elipsoide(0.0021, 0.0012, 0.0016, (x, y, z) => mix(rgb('#6a4422'), rgb('#9a6a3a'), suave(0.3, 0.8, fbm(x * 900, y * 900, z * 900, s + i))), 4, 5);
    g.rotateY(hash(i, 4) * TAU);
    g.translate(px + (hash(i, 5) - 0.5) * 0.016, hB + 0.0018, pz + (hash(i, 6) - 0.5) * 0.007);
    out.push(parte(g, 'acetinado'));
  }
  // as pontas compridas apontam para quem olha: de frente, cada peça é um losango nítido
  for (const p of out) p.g.rotateY(PI / 2);
  return out;
};

const gStrudelFatias: Gerador = (k) => {
  // fatias grossas de strudel com a espiral de massa fina e o recheio de maçã, passas e nozes à mostra
  // A fatia fica deitada com o corte para cima: a massa esticada é fina como papel, então o corte
  // mostra uma espiral de linhas claras de massa (duas voltas e meia) separando o recheio âmbar de
  // maçã cozida, com pedaços de maçã mais claros, passas escuras e migalhas de noz; por fora, a
  // crosta dourada e lascada, polvilhada de açúcar.
  const { s } = k;
  const Ws = 0.072, Hs = 0.05, e = 0.024;
  const poly: P2[] = [];
  for (let j = 0; j < 36; j++) { const th = (j / 36) * TAU; poly.push([Hs / 2 + (Hs / 2) * Math.sin(th) * (Math.sin(th) < 0 ? 0.72 : 1), (Ws / 2) * Math.cos(th) * (1 + 0.04 * Math.sin(th * 3))]); }
  const crosta: CorFn = (x, y, z) => {
    let c = mix(rgb('#d8a050'), rgb('#a86a24'), suave(0.3, 0.8, fbm(x * 200, y * 200, z * 200, s)));
    // folhas de massa lascadas em camadas finas
    c = mul(c, 1 - 0.12 * Math.abs(Math.sin(x * 1400 + fbm(x * 50, y * 50, z * 50, s) * 4)) ** 6);
    return mix(c, rgb('#fbf8f0'), pinta(x, y, z, 700, 0.35, s + 1) * suave(Hs * 0.55, Hs, y) * 0.85);
  };
  const corte: CorFn = (x, y, z) => {
    const u = (y - Hs / 2) / (Hs / 2), w = z / (Ws / 2);
    const r = Math.hypot(u, w), a = Math.atan2(u, w);
    // crosta da última volta
    if (r > 0.9) return mix(rgb('#c08032'), rgb('#e8c070'), Math.abs(Math.sin(r * 90)) * 0.4);
    // lâmina de massa em espiral (clara, quase branca de tão fina)
    const f = frac(r * 2.6 - a / TAU + 0.1);
    if (r > 0.08 && f < 0.17) return mix(rgb('#f4e2b4'), rgb('#e2c27a'), suave(0.1, 0.17, f));
    // recheio de maçã cozida com canela
    let c = mix(rgb('#b87a34'), rgb('#946028'), suave(0.4, 0.8, fbm(y * 260, z * 260, 0, s + 2)) * 0.7);
    // pedaços de maçã mais claros e translúcidos
    c = mix(c, rgb('#e2c070'), pinta(y, z, 0, 140, 0.42, s + 5) * 0.75);
    // passas e migalhas de noz
    const cel = Math.floor(y * 320) + Math.floor(z * 320) * 7;
    c = mix(c, rgb('#2e140e'), pinta(y, z, 0, 320, 0.3, s + 3) * (hash(cel, 3) > 0.62 ? 0.9 : 0));
    return c;
  };
  const out: Parte[] = [];
  for (let i = 0; i < 3; i++) {
    const g = extrusao(poly, 0, e, crosta, { tampa: corte, nx: 3, nr: 20, nr0: 1 });
    g.rotateZ(PI / 2);
    g.rotateY((i - 1) * 0.35 + 0.1);
    g.translate((i - 1) * 0.066 + Hs / 2, 0, (i === 1 ? 0.012 : -0.006));
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

const gBoucheeAberta: Gerador = (k) => {
  // bouchée redonda, crescida em camadas, topo dourado brilhante e o centro aberto, com a tampinha
  // apoiada na borda
  const { s } = k;
  const R = 0.035, H = 0.04, Ri = 0.017;
  const lado: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z);
    if (y > H - 0.0006 && r > Ri * 1.05) return mix(rgb('#b8742a'), rgb('#d89a48'), suave(0.3, 0.8, fbm(x * 200, 0, z * 200, s)) * 0.5);
    if (r < Ri * 1.02) return mix(rgb('#f0dca8'), rgb('#e8c888'), Math.abs(Math.sin(y * 700)) * 0.6);
    return mix(rgb('#d89a40'), rgb('#f0d898'), Math.abs(Math.sin(y * 650 + fbm(x * 60, y * 60, z * 60, s) * 3)) ** 2 * 0.7);
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.95, 0], [R, 0.004], [R * 1.03, H * 0.5], [R, H - 0.002], [R * 0.95, H], [Ri * 1.08, H], [Ri, H - 0.002], [Ri * 0.95, 0.01], [0, 0.008]], n: 34, m: 40,
    mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 4, Math.sin(a) * 4, t * 10, s),
    cor: lado,
  }), 'acetinado', true)];
  const tampa = torno({ caminho: [[0, 0], [Ri * 0.95, 0], [Ri, 0.005], [Ri * 0.92, 0.011], [0, 0.012]], n: 10, m: 24, cor: (x, y, z) => (y > 0.0105 ? rgb('#b8742a') : mix(rgb('#d89a40'), rgb('#f0d898'), Math.abs(Math.sin(y * 650)) * 0.6)) });
  tampa.rotateZ(0.5);
  tampa.translate(R * 0.55, H - 0.002, 0.006);
  out.push(parte(tampa, 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* bolos e biscoitos                                                     */
/* ------------------------------------------------------------------ */

const gPaoDeLoFino: Gerador = (k) => {
  // pão-de-ló fino assado na fôrma de rocambole: folha retangular baixa sobre o papel açucarado
  const { s } = k;
  const Lx = 0.3, Lz = 0.22, h = 0.011;
  const esponja = bloco(Lx, h, Lz, (x, y, z) => {
    if (y > h / 2 - 1e-4) return mix(rgb('#d8a048'), rgb('#e8c070'), suave(0.3, 0.8, fbm(x * 40, 0, z * 40, s)) * 0.7);
    return mix(rgb('#f4dc98'), rgb('#e8c878'), pinta(x, y, z, 900, 0.3, s) * 0.5);
  }, [16, 2, 12]);
  esponja.translate(0, h / 2 + 0.0006, 0);
  const papel = bloco(Lx + 0.025, 0.0006, Lz + 0.02, (x, y, z) => mix(rgb('#f2eee4'), rgb('#fdfcf8'), suave(0.4, 0.8, fbm(x * 80, 0, z * 80, s + 1))), [10, 1, 8]);
  papel.translate(0, 0.0003, 0);
  return [parte(esponja, 'fosco', true), parte(papel, 'fosco')];
};

/**
 * Corte do rocambole (u, w de -1 a 1 na seção): três voltas de pão-de-ló amarelo-claro, cada uma
 * fechada pela pele dourada fininha, com a faixa de recheio branco entre elas; no centro, a
 * pontinha enrolada de recheio.
 */
export function corteRocambole(u: number, w: number, s: number): RGB {
  const r = Math.hypot(u, w), a = Math.atan2(u, w);
  if (r > 0.95) return rgb('#a8682e');
  if (r < 0.07) return rgb('#fdf8ec');
  const f = frac(r * 3 - a / TAU + 0.2);
  if (f < 0.56) return mul(mix(rgb('#f4d68e'), rgb('#e8c070'), pinta(u, w, 0, 30, 0.35, s) * 0.5), 0.97 + 0.05 * fbm(u * 20, w * 20, 0, s));
  if (f < 0.63) return mix(rgb('#b8783a'), rgb('#d09a52'), (f - 0.56) / 0.07);
  if (f < 0.95) return mul(rgb('#fdf8ec'), 0.97 + 0.03 * fbm(u * 30, w * 30, 0, s + 1));
  return rgb('#e8c890');
}

/**
 * Tora de rocambole deitada ao longo de X, apoiada em y = 0: casca dourada polvilhada de açúcar e a
 * espiral nas pontas. Com `diagonal`, a ponta de +X sai aparada em diagonal, virada para a frente
 * (+Z), para a espiral aparecer de frente.
 */
export function toraRocambole(L: number, R: number, s: number, diagonal = 0): THREE.BufferGeometry {
  const ry = R * 0.95;
  return corpo({
    x0: -L / 2, x1: L / 2, n: 12, m: 36, tampa: true, aneisTampa: 14, linear: true,
    perfil: () => ({ ry, rz: R, cy: ry }),
    mod: (t, a) => 1 + 0.012 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s),
    desloc: (p) => {
      if (p.y < ry * 0.12) p.y = ry * 0.12 - (ry * 0.12 - p.y) * 0.3;
      if (diagonal) p.x -= diagonal * p.z * clamp((p.x + L / 2) / L);
    },
    cor: (x, y, z) => {
      const c = mix(rgb('#c88a40'), rgb('#a86a2a'), suave(0.3, 0.8, fbm(x * 60, y * 60, z * 60, s)) * 0.6);
      // açúcar polvilhado só por cima
      return mix(c, rgb('#fbf9f2'), pinta(x, y, z, 650, 0.38, s + 1) * suave(ry * 1.2, ry * 1.9, y) * 0.95);
    },
    corTampa: (x, y, z) => corteRocambole((y - ry) / ry, z / R, s),
  });
}

/** Fatia de rocambole deitada, com o corte para cima. */
export function fatiaRocambole(R: number, e: number, s: number): THREE.BufferGeometry[] {
  const lado = torno({
    caminho: [[0, 0], [R * 0.9, 0], [R, e * 0.15], [R, e * 0.85], [R * 0.9, e], [0, e]], n: 6, m: 40,
    cor: (x, y, z) => (y > e * 0.9 ? corteRocambole(x / R, z / R, s) : mix(rgb('#c08440'), rgb('#a86a2a'), suave(0.3, 0.8, fbm(x * 60, y * 60, z * 60, s)) * 0.6)),
  });
  // a face de cima, mais fina, para a espiral ficar nítida
  const face = discoPolar(R * 0.995, e + 0.0002, 16, 40, (x, z) => corteRocambole(x / R, z / R, s));
  return [lado, face];
}

const gRocamboleEspiral: Gerador = (k) => {
  // rocambole enrolado, crosta dourada polvilhada de açúcar e a espiral de pão-de-ló e recheio branco
  // nas pontas; a ponta da direita aparada em diagonal, virada para a frente, mostra a espiral
  return [parte(toraRocambole(0.22, 0.036, k.s, 0.75), 'fosco', true)];
};

const gOperetta: Gerador = (k) => {
  // quadradinho de operetta: camadas finas de pão-de-ló, ganache e glacê de manteiga, fondant de
  // chocolate brilhante por cima e um pedacinho de folha dourada
  const { s } = k;
  const S = 0.04, H = 0.028;
  const camadas: [number, RGB][] = [[0.005, rgb('#e8c478')], [0.007, rgb('#3a1e12')], [0.0095, rgb('#e8d4b0')], [0.0145, rgb('#e8c478')], [0.0165, rgb('#3a1e12')], [0.019, rgb('#e8d4b0')], [0.024, rgb('#e8c478')], [0.03, rgb('#3a1e12')]];
  const corpoO = bloco(S, H, S, (x, y, z) => {
    const yy = y + H / 2;
    const c = (camadas.find(([lim]) => yy <= lim) ?? camadas[camadas.length - 1])[1];
    return mul(c, 0.95 + 0.08 * fbm(x * 400, y * 400, z * 400, s));
  }, [2, 28, 2]);
  corpoO.translate(0, H / 2, 0);
  const fondant = bloco(S * 1.004, 0.002, S * 1.004, () => rgb('#2a160c'));
  fondant.translate(0, H + 0.001, 0);
  const poly: P2[] = [];
  for (let q = 0; q < 7; q++) { const a = (q / 7) * TAU; poly.push([Math.cos(a) * 0.006 * (0.6 + 0.6 * hash(q, 1)), Math.sin(a) * 0.006 * (0.6 + 0.6 * hash(q, 2))]); }
  const ouro = extrusao(poly, 0, 0.0003, (x, y, z) => mix(rgb('#e0b840'), rgb('#f8e070'), suave(0.3, 0.8, fbm(x * 900, y * 900, z * 900, s))));
  ouro.rotateZ(PI / 2);
  ouro.translate(0.004, H + 0.002, -0.003);
  return [parte(corpoO, 'acetinado', true), parte(fondant, 'brilhante'), parte(ouro, 'brilhante')];
};

const gTrufaGanache: Gerador = (k) => {
  // trufa rolada na ganache sobre a grade: cobertura escura de textura irregular, com pontinhas
  const { s } = k;
  const rug = (t: number, a: number) => Math.max(0, ruido(t * 14, Math.cos(a) * 6, Math.sin(a) * 6, s));
  return [parte(elipsoide(0.0125, 0.012, 0.0125, (x, y, z, t, a) => mix(rgb('#2e1810'), rgb('#5a3424'), rug(t, a) * 0.8), 16, 20, (t, a) => 1 + 0.06 * fbm(t * 9, Math.cos(a) * 4, Math.sin(a) * 4, s) + 0.08 * rug(t, a)), 'acetinado', true)];
};

const gBiscoitoPassas: Gerador = (k) => {
  // biscoito redondo assado, centro claro e borda dourada, com passas aparecendo na superfície
  const { s } = k;
  const R = 0.03, H = 0.0065;
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.9, 0], [R, H * 0.4], [R * 0.97, H * 0.85], [R * 0.85, H], [R * 0.5, H * 1.02], [0, H * 1.03]], n: 16, m: 40,
    mod: (t, a) => 1 + 0.02 * fbm(Math.cos(a) * 4, Math.sin(a) * 4, 0, s),
    cor: (x, y, z) => mix(mix(rgb('#e8c070'), rgb('#b87a30'), suave(R * 0.55, R, Math.hypot(x, z)) * 0.8 + suave(H * 0.5, 0, y) * 0.3), rgb('#f6e0a8'), pinta(x, y, z, 500, 0.2, s) * 0.3),
  }), 'fosco', true)];
  for (let i = 0; i < 7; i++) {
    const rr = Math.sqrt((i + 0.5) / 7) * R * 0.72, a = i * 2.39996 + 0.4;
    const g = elipsoide(0.0042, 0.0022, 0.0032, (x, y, z) => mix(rgb('#2a120c'), rgb('#5a2a1a'), suave(0.4, 0.8, fbm(x * 900, y * 900, z * 900, s + i))), 6, 8, (t, a2) => 1 + 0.1 * fbm(t * 5, Math.cos(a2) * 2, Math.sin(a2) * 2, s + i));
    g.rotateY(hash(i, 3) * TAU);
    g.translate(Math.cos(a) * rr, H * 1.01, Math.sin(a) * rr);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

const gRoloMassaBiscoito: Gerador = (k) => {
  // massa de biscoito enrolada num cilindro firme sobre o papel, pronta para gelar e fatiar
  const { c1, s } = k;
  const L = 0.2, R = 0.022;
  const rolo = corpo({ x0: -L / 2, x1: L / 2, n: 10, m: 28, tampa: true, linear: true, perfil: () => ({ ry: R, rz: R }), mod: (t, a) => 1 + 0.015 * fbm(t * 8, Math.cos(a) * 2, Math.sin(a) * 2, s), cor: massaCor(c1, s) });
  rolo.translate(0, R + 0.0006, 0);
  const papel = bloco(L + 0.05, 0.0006, 0.12, (x, y, z) => mix(rgb('#f2eee4'), rgb('#fdfcf8'), suave(0.4, 0.8, fbm(x * 80, 0, z * 80, s + 1))), [8, 1, 4]);
  papel.translate(0, 0.0003, 0);
  return [parte(rolo, 'acetinado', true), parte(papel, 'fosco')];
};

/**
 * Disco fino (raio R, borda um pouco irregular) dobrado sobre um rolo de raio Rb com o eixo em Z:
 * o arco corre ao longo de X e as pontas descem até a bancada. `cor` recebe também r, a distância
 * ao centro do disco (0 a 1).
 */
export function telhaCurva(R: number, Rb: number, s: number, cor: (x: number, y: number, z: number, r: number) => RGB, borda = 0.03, res: [number, number] = [28, 18]): THREE.BufferGeometry {
  const ang = R / Rb;
  return chapa(res[0], res[1], (u, v, lado) => {
    const xu = 2 * u - 1;
    const meia = Math.sqrt(Math.max(0, 1 - xu * xu)) * (1 + borda * Math.sin(u * 23 + s) + borda * 0.6 * Math.sin(v * 9 + s));
    const xd = R * xu, zd = v * R * meia;
    const th = xd / Rb, rr = Rb + (lado ? 0.0004 : -0.0004);
    return [rr * Math.sin(th), rr * Math.cos(th) - Rb * Math.cos(ang) + 0.0006, zd];
  }, (x, y, z, u, v) => {
    const xu = 2 * u - 1;
    return cor(x, y, z, Math.hypot(xu, v * Math.sqrt(Math.max(0, 1 - xu * xu))));
  });
}

const gTuileCurva: Gerador = (k) => {
  // tuile fina curvada sobre o rolo ainda quente: telha dourada na borda e clara no meio
  // a curva corre ao longo de X (o rolo fica atravessado em Z): de frente, a telha mostra o arco
  return [parte(telhaCurva(0.04, 0.03, k.s, (x, y, z, r) => mul(mix(rgb('#ecc878'), rgb('#a86a24'), suave(0.6, 1, r)), 0.95 + 0.08 * fbm(x * 300, y * 300, z * 300, k.s))), 'acetinado', true)];
};

/** Letras de "Sacher" em traço cursivo, numa caixa de altura 1 (x para a direita, y para cima). */
const LETRAS: [number, P2[]][] = [
  [0.62, [[0.55, 0.95], [0.3, 1.0], [0.08, 0.85], [0.12, 0.62], [0.42, 0.45], [0.55, 0.22], [0.4, 0.02], [0.12, 0.02], [0.0, 0.12]]],
  [0.66, [[0.5, 0.42], [0.28, 0.5], [0.06, 0.32], [0.1, 0.05], [0.32, 0.04], [0.5, 0.3], [0.5, 0.48], [0.48, 0.15], [0.52, 0.0], [0.65, 0.06]]],
  [0.54, [[0.45, 0.42], [0.25, 0.5], [0.05, 0.3], [0.12, 0.04], [0.35, 0.0], [0.5, 0.08]]],
  [0.64, [[0.02, 0.0], [0.12, 0.6], [0.22, 0.98], [0.12, 1.0], [0.08, 0.7], [0.06, 0.0], [0.15, 0.35], [0.35, 0.5], [0.5, 0.38], [0.48, 0.08], [0.6, 0.0]]],
  [0.56, [[0.05, 0.22], [0.4, 0.32], [0.42, 0.48], [0.22, 0.5], [0.05, 0.3], [0.1, 0.06], [0.3, 0.0], [0.52, 0.08]]],
  [0.5, [[0.02, 0.0], [0.05, 0.45], [0.12, 0.5], [0.15, 0.35], [0.28, 0.5], [0.45, 0.46]]],
];

const gSachertorteEscrita: Gerador = (k) => {
  // Sachertorte coberta de chocolate brilhante, com o nome Sacher escrito por cima com o saco de papel
  const { s } = k;
  const R = 0.1, H = 0.055;
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 1.02, 0], [R * 1.04, 0.0025], [R, 0.006], [R, H - 0.006], [R * 0.97, H - 0.0005], [R * 0.5, H], [0, H]], n: 22, m: 64,
    cor: (x, y, z) => mix(rgb('#2a1409'), rgb('#3e2214'), suave(0.4, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.5),
  }), 'brilhante', true)];
  const hs = 0.028;
  const total = LETRAS.reduce((a, [w]) => a + w, 0) * hs;
  let x0 = -total / 2;
  for (const [w, pts] of LETRAS) {
    const p3 = pts.map(([x, y]) => V(x0 + x * hs, H + 0.0011, -(y - 0.45) * hs));
    out.push(parte(tubo(p3, { raio: 0.0011, m: 5, n: pts.length * 6, cor: () => rgb('#4a2a18') }), 'acetinado'));
    x0 += w * hs;
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* registro                                                             */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  // frutas
  'c4-maca-descascada': { visual: vis('esferoide', 'c4-maca-descascada', 0.075, 'c8201e e0b040 f2e6c0 c8903a 5a4024'), gerar: gMacaDescascada },
  'c4-maca-sem-miolo': { visual: vis('esferoide', 'c4-maca-sem-miolo', 0.075, 'c8201e e0b040 f2e6c0 c8903a 5a4024', { ac: 'brilhante' }), gerar: gMacaSemMiolo },
  'c4-maca-espiral-casca': { visual: vis('esferoide', 'c4-maca-espiral-casca', 0.17, 'c8201e e0b040 f2e6c0 c8903a 5a4024'), gerar: gMacaEspiralCasca },
  'c4-pera-leque': { visual: vis('esferoide', 'c4-pera-leque', 0.12, 'e8e0b8 c8b880 f4f0d8 c8a050 5a4024'), gerar: gPeraLeque },
  'c4-meias-luas-maca': { visual: vis('esferoide', 'c4-meias-luas-maca', 0.1, 'f2e6c0 e0d090 f2e6c0 c8903a'), gerar: gMeiasLuasMaca },
  'c4-ruibarbo-pedacos': { visual: vis('talo', 'c4-ruibarbo-pedacos', 0.1, 'c83a4a a8303a e8ecc8 b05a50 6a8a3a'), gerar: gRuibarboPedacos },
  'c4-abacaxi-cilindro': { visual: vis('tropical', 'c4-abacaxi-cilindro', 0.13, 'f0c440 d8a030 f0c440 d8a030'), gerar: gAbacaxiCilindro },
  'c4-abacaxi-descascado': { visual: vis('tropical', 'c4-abacaxi-descascado', 0.18, 'f0c440 d8a030 f0c440 d8a030'), gerar: gAbacaxiDescascado },
  'c4-abacaxi-quarto': { visual: vis('tropical', 'c4-abacaxi-quarto', 0.3, 'c8902a 6a5020 f0c440 d8a030 4a6a3a'), gerar: gAbacaxiQuarto },
  'c4-abacaxi-caramelado': { visual: vis('tropical', 'c4-abacaxi-caramelado', 0.12, 'd8a030 9a5a14 f0c040 b87020'), gerar: gAbacaxiCaramelado },
  'c4-cereja-sem-cabo': { visual: vis('caroco', 'c4-cereja-sem-cabo', 0.024, '7a0a16 4a0610 a01a28 6a1018'), gerar: gCerejaSemCabo },
  'c4-morango-sem-calice': { visual: vis('baga', 'c4-morango-sem-calice', 0.034, 'c8141e e8d070 f0c0c0 a8181e'), gerar: gMorangoSemCalice },
  'c4-morango-metade': { visual: vis('baga', 'c4-morango-metade', 0.042, 'c8141e e8d070 f0c0c0 a8181e 3a7a2a'), gerar: gMorangoMetade },
  'c4-manga-fatias': { visual: vis('tropical', 'c4-manga-fatias', 0.11, 'f6a623 e8801e f6a623 d88a20'), gerar: gMangaFatias },
  'c4-laranja-a-vif': { visual: vis('citrico', 'c4-laranja-a-vif', 0.068, 'f08a1a f8a030 f08a1a d8701a'), gerar: gLaranjaAVif },
  'c4-lima-julienne': { visual: vis('citrico', 'c4-lima-julienne', 0.06, '4a8a2a 2e6a1a dce6bc 6a8a2a'), gerar: gLimaJulienne },
  'c4-raspas-lima-carameladas': { visual: vis('confeito', 'c4-raspas-lima-carameladas', 0.06, '6a8a1e f6f4ea b8bc78 5a7a16'), gerar: gRaspasLima },
  'c4-uva-metades': { visual: vis('baga', 'c4-uva-metades', 0.06, '9ab84a 6a8a2a e8ecb0 8a8a3a'), gerar: gUvaMetades },
  'c4-groselhas-soltas': { visual: vis('baga', 'c4-groselhas-soltas', 0.055, 'd81830 a8102a e84050 8a1020'), gerar: gGroselhas },
  'c4-maracuja-metade': { visual: vis('tropical', 'c4-maracuja-metade', 0.07, '4a1a3a 6a3a52 f0b020 c89020'), gerar: gMaracujaMetade },
  'c4-papaia-metade': { visual: vis('tropical', 'c4-papaia-metade', 0.16, 'f39a52 f6b070 f27848 d86a2a'), gerar: gPapaia(false) },
  'c4-papaia-metade-sementes': { visual: vis('tropical', 'c4-papaia-metade-sementes', 0.16, 'f39a52 f6b070 f27848 d86a2a'), gerar: gPapaia(true) },
  'c4-pitaia-metade': { visual: vis('tropical', 'c4-pitaia-metade', 0.11, 'd8206a a8c040 f6f2ee d8c8c0'), gerar: gPitaiaMetade },
  'c4-kiwano-metade': { visual: vis('tropical', 'c4-kiwano-metade', 0.12, 'e8901a f0c040 78b838 6a9a30'), gerar: gKiwanoMetade },
  'c4-sapotilha-pedacos': { visual: vis('tropical', 'c4-sapotilha-pedacos', 0.12, 'c08a5a a87040 c08a5a a86a30'), gerar: gSapotilhaPedacos },
  'c4-nespera-descascada': { visual: vis('caroco', 'c4-nespera-descascada', 0.048, 'f0a030 e8802a f8c870 d8902a'), gerar: gNesperaDescascada },
  'c4-mangostao-aberto': { visual: vis('tropical', 'c4-mangostao-aberto', 0.1, '3a1028 5a1a32 f6f4ee d8c8b0 5a6a2a'), gerar: gMangostaoAberto },
  'c4-figo-da-india-descascado': { visual: vis('tropical', 'c4-figo-da-india-descascado', 0.07, 'e8903a d8602a e8903a c87030'), gerar: gFigoDaIndiaDescascado },
  'c4-lichia-descascada': { visual: vis('tropical', 'c4-lichia-descascada', 0.031, 'f4f0e8 d2cec8 f4f0e8 e8dcc8'), gerar: gLichiaDescascada },
  'c4-frutas-secas-cozidas': { visual: vis('monte', 'c4-frutas-secas-cozidas', 0.11, '5a2418 e08030 c87a3a 7a4a2a 5a3828'), gerar: gFrutasSecasCozidas },
  // sobremesas
  'c4-conchas-merengue-ganache': { visual: vis('merengue', 'c4-conchas-merengue-ganache', 0.07, 'f8f2e2 ecd6a4 f8f2e2 e8c890 3a1c10'), gerar: gConchasMerengue },
  'c4-sufle-frio-frutas': { visual: vis('confeito', 'c4-sufle-frio-frutas', 0.064, 'ec8a9e d86a80 ec8a9e c86a7a'), gerar: gSufleFrio },
  'c4-gelatina-camadas': { visual: vis('bolo', 'c4-gelatina-camadas', 0.15, 'd8384a a82a3a d8384a c03a3a'), gerar: gGelatina(true) },
  'c4-gelatina-frutas-soltas': { visual: vis('bolo', 'c4-gelatina-frutas-soltas', 0.15, 'd8384a a82a3a d8384a c03a3a'), gerar: gGelatina(false) },
  'c4-pele-custard': { visual: vis('confeito', 'c4-pele-custard', 0.09, 'e8c868 b8803a f0d58a b8803a'), gerar: gPeleCustard },
  'c4-crosta-brulee': { visual: vis('confeito', 'c4-crosta-brulee', 0.064, 'c88a2a 5a2a0c f2dca0 b0681a'), gerar: gCrostaBrulee },
  'c4-sufle-baunilha': { visual: vis('bolo', 'c4-sufle-baunilha', 0.064, 'c8883a b0702e f2dca0 b0702e'), gerar: gSufleBaunilha },
  'c4-charlotte-maca': { visual: vis('bolo', 'c4-charlotte-maca', 0.15, 'd8a050 9a6020 f0d890 9a5a20'), gerar: gCharlotteMaca },
  'c4-chocolate-picado': { visual: vis('confeito', 'c4-chocolate-picado', 0.1, '3a2216 5c3a28 3a2216 3a2010'), gerar: gChocolatePicado },
  'c4-semifreddo-fatias': { visual: vis('bolo', 'c4-semifreddo-fatias', 0.16, 'f2a8b6 c83a5a f2a8b6 e8a0b0'), gerar: gSemifreddoFatias },
  'c4-limao-givre': { visual: vis('citrico', 'c4-limao-givre', 0.065, 'e8d830 d8c820 f6f2d0 c8b830'), gerar: gLimaoGivre },
  'c4-ninho-fios-caramelo': { visual: vis('confeito', 'c4-ninho-fios-caramelo', 0.08, 'e0a838 a8601a e0a838 a8601a'), gerar: gNinhoCaramelo },
  // pastelaria
  'c4-pate-sucree': { visual: vis('massa_bola', 'c4-pate-sucree', 0.12, 'f2d898 e8c880 f2d898 d8a050'), gerar: gPateSucree },
  'c4-barquinha-recheada': { visual: vis('torta', 'c4-barquinha-recheada', 0.085, 'd8a050 b07028 f2d070 b87a30'), gerar: gBarquinhaRecheada },
  'c4-massa-aberta': { visual: vis('placa', 'c4-massa-aberta', 0.26, 'f2e2b8 e8d4a0 f2e2b8 d8a050'), gerar: gMassaAberta },
  'c4-folhas-massa': { visual: vis('placa', 'c4-folhas-massa', 0.22, 'f0dcaa d8c088 f0dcaa d8a050'), gerar: gFolhasMassa },
  'c4-tranca-massa': { visual: vis('massa_bola', 'c4-tranca-massa', 0.2, 'f0dcaa d8c088 f0dcaa d8a050'), gerar: gTrancaMassa },
  'c4-cone-massa': { visual: vis('massa_bola', 'c4-cone-massa', 0.015, 'f2e2b8 e8d4a0 f2e2b8 d8a050'), gerar: gConeMassa },
  'c4-cone-petalas-massa': { visual: vis('massa_bola', 'c4-cone-petalas-massa', 0.08, 'f2e2b8 e8d4a0 f2e2b8 d8a050'), gerar: gConePetalas },
  'c4-bomba-redonda-caramelo': { visual: vis('choux', 'c4-bomba-redonda-caramelo', 0.045, 'c88a3a e8c080 f6eedc b06a18'), gerar: gBombaRedonda },
  'c4-baklava-losangos': { visual: vis('folhado', 'c4-baklava-losangos', 0.13, 'd8a048 b8782a f0d090 b8782a'), gerar: gBaklavaLosangos },
  'c4-strudel-fatias': { visual: vis('folhado', 'c4-strudel-fatias', 0.15, 'd89a48 b07028 e8c878 b07028'), gerar: gStrudelFatias },
  'c4-bouchee-aberta': { visual: vis('folhado', 'c4-bouchee-aberta', 0.075, 'd89a40 b8742a f0d898 b8742a'), gerar: gBoucheeAberta },
  // bolos
  'c4-pao-de-lo-fino': { visual: vis('bolo', 'c4-pao-de-lo-fino', 0.32, 'd8a048 e8c070 f4dc98 b87a30'), gerar: gPaoDeLoFino },
  'c4-rocambole-espiral': { visual: vis('bolo', 'c4-rocambole-espiral', 0.24, 'c88a40 a86a2a f4d88a b87a30'), gerar: gRocamboleEspiral },
  'c4-operetta': { visual: vis('bolo', 'c4-operetta', 0.04, '2a160c 3a1e12 e8c478 2a160c'), gerar: gOperetta },
  'c4-trufa-ganache': { visual: vis('confeito', 'c4-trufa-ganache', 0.025, '2e1810 5a3424 2e1810 2e1810'), gerar: gTrufaGanache },
  'c4-biscoito-passas': { visual: vis('confeito', 'c4-biscoito-passas', 0.06, 'e8c070 b87a30 f0d8a0 a86a20'), gerar: gBiscoitoPassas },
  'c4-rolo-massa-biscoito': { visual: vis('massa_bola', 'c4-rolo-massa-biscoito', 0.25, 'f0d8a0 e0c088 f0d8a0 d8a050'), gerar: gRoloMassaBiscoito },
  'c4-tuile-curva': { visual: vis('confeito', 'c4-tuile-curva', 0.08, 'ecc878 a86a24 ecc878 a86a24'), gerar: gTuileCurva },
  'c4-sachertorte-escrita': { visual: vis('bolo', 'c4-sachertorte-escrita', 0.21, '2a1409 3e2214 4a2a18 2a1409'), gerar: gSachertorteEscrita },
};
