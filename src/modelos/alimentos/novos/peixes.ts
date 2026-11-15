// Alimentos novos do grupo peixes (com caldos e sopas): preparos prontos de peixe que o livro
// mostra no prato (filé pochê, dourado, empanado, goujons, bolinhos, quenelles, timbales,
// trouxinhas, almofadas, paupiettes, trança, forminhas, sashimi, papillote, peixe em folha de uva,
// fatia de terrina), enfeites cítricos de peixe e as guarnições de caldo e sopa.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import type { Ctx, Gerador } from '../pecas';
import { lamina, olhoPeixe, apontar, cintila } from '../mar_pecas';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* Peças de apoio (também usadas pelos frutos do mar)                   */
/* ------------------------------------------------------------------ */

/** Cor com lado: u de 0 a 1 ao longo de X, v de -1 a 1 em Z, lado 1 em cima e 0 embaixo. */
export type CorChapa = (x: number, y: number, z: number, u: number, v: number, lado: number) => RGB;

/**
 * Chapa em grade nx por nz com face de cima e de baixo costuradas na borda.
 * Serve para fatias com desenho no corte (terrina) e lâminas finas.
 */
export function chapa(nx: number, nz: number, pos: (u: number, v: number, lado: number) => [number, number, number], cor: CorChapa): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const por = nz + 1;
  const face = (nx + 1) * por;
  for (const lado of [1, 0]) {
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const u = i / nx, v = (j / nz) * 2 - 1;
        const p = pos(u, v, lado);
        P.push(p[0], p[1], p[2]);
        const c = cor(p[0], p[1], p[2], u, v, lado);
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

/** Fração do comprimento de arco de um caminho [raio, altura] até o vértice `ate`. */
export function fracArco(c: [number, number][], ate: number): number {
  let tot = 0, parc = 0;
  for (let i = 1; i < c.length; i++) {
    const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    tot += d;
    if (i <= ate) parc += d;
  }
  return parc / Math.max(1e-9, tot);
}

/** Espelha a geometria em Z mantendo as faces viradas para fora. */
export function espelharZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(1, 1, -1);
  const ix = g.getIndex()!;
  const a = ix.array as Uint16Array | Uint32Array;
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = t;
  }
  ix.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Laço fechado em volta de uma seção retangular arredondada no plano YZ (amarrilho). */
export function amarrilho(x: number, cy: number, ry: number, rz: number, r: number, cor: CorFn, exp = 6): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const e = 2 / exp;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    pts.push(V(x + 0.0008 * Math.sin(a * 3), cy + (ry + r * 0.6) * Math.sign(ca) * Math.abs(ca) ** e, (rz + r * 0.6) * Math.sign(sa) * Math.abs(sa) ** e));
  }
  return tubo(pts, { raio: r, m: 6, n: 56, cor, fechado: true });
}

/** Carne de salmão: laranja com as linhas brancas de gordura em arco. */
export function corSalmao(base: RGB, gordura: RGB, passo: number, s: number, ang = 0.6): CorFn {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return (x, y, z) => {
    const q = (x * ca + z * sa) / passo + 0.7 * fbm(x * 30, y * 30, z * 30, s) + 0.4 * Math.abs(z * ca - x * sa) / passo;
    const linha = Math.abs(Math.sin(q * PI)) ** 22;
    let c = mix(mul(base, 0.92), gordura, linha * 0.7);
    c = mix(c, mul(base, 0.85), suave(0.2, 0.8, fbm(x * 50, y * 50, z * 50, s + 3)) * 0.25);
    return mul(c, 1 + 0.04 * cintila(x, y, z, 900, s));
  };
}

/** Lascas de peixe branco cozido: arcos em "W" do músculo e linha lateral. */
function corLascas(base: RGB, sombra: RGB, passo: number, W: number, s: number): CorFn {
  return (x, y, z) => {
    const q = (x + 0.9 * Math.abs(z)) / passo + 0.3 * fbm(x * 30, y * 30, z * 30, s);
    const lasca = Math.abs(Math.sin(q * PI)) ** 10;
    let c = mix(base, sombra, lasca * 0.8);
    c = mix(c, mul(base, 0.93), suave(0.0, 0.8, fbm(x * 70, y * 70, z * 70, s + 5)) * 0.4);
    c = mix(c, sombra, (1 - suave(0, W * 0.05, Math.abs(z))) * 0.2);
    return mul(c, 1 + 0.035 * fbm(x * 200, y * 200, z * 200, s + 1));
  };
}

/** Corpo de filé deitado: rabo fino em -X, lado da cabeça largo e cego em +X, base achatada. */
function corpoFile(L: number, W: number, H: number, cor: CorFn, o: { n?: number; m?: number; mod?: (t: number, a: number) => number; desloc?: (p: THREE.Vector3) => void } = {}): THREE.BufferGeometry {
  return corpo({
    x0: -L / 2, x1: L / 2, n: o.n ?? 56, m: o.m ?? 36, cor, mod: o.mod,
    perfil: (t) => {
      const q = clamp(0.05 + 0.92 * t) ** 1.4;
      const w = Math.sin(PI * q) ** 0.5;
      const h = Math.sin(PI * q) ** 0.65;
      const ry = (H / 2) * h + 1e-4;
      return { ry, rz: (W / 2) * w + 1e-4, cy: ry * 0.9 };
    },
    desloc: (p) => {
      if (p.y < 0) p.y *= 0.12;
      o.desloc?.(p);
    },
  });
}

/** Ruído de grânulo de empanado: células claras e picos escuros. */
function corEmpanado(base: RGB, escuro: RGB, claro: RGB, f: number, s: number): CorFn {
  return (x, y, z) => {
    const cl = celula(x * f, y * f, z * f, s);
    let c = mix(mul(base, 1.08), escuro, suave(0.45, 0.95, cl) * 0.55);
    c = mix(c, claro, (1 - suave(0.05, 0.2, celula(x * f * 1.7, y * f * 1.7, z * f * 1.7, s + 4))) * 0.5);
    c = mix(c, escuro, suave(0.3, 0.9, fbm(x * f * 0.25, y * f * 0.25, z * f * 0.25, s + 7)) * 0.3);
    return mul(c, 1 + 0.06 * cintila(x, y, z, f * 3, s));
  };
}

const empanadoMod = (f: number, s: number, amp: number) => (t: number, a: number) =>
  1 + amp * (0.5 - suave(0.1, 0.8, celula(t * f, Math.cos(a) * f * 0.12, Math.sin(a) * f * 0.12, s)));

/* ------------------------------------------------------------------ */
/* Filés prontos                                                        */
/* ------------------------------------------------------------------ */

const gFilePoche: Gerador = (k) => {
  // filé pochê: branco opaco, lascas marcadas e úmido, bordas levemente encolhidas
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corLascas(k.c1, k.c2, L * 0.065, W, k.s);
  const g = corpoFile(L, W, H, (x, y, z, t, a) => {
    const c = cor(x, y, z, t, a);
    // embaixo, onde encostou na panela, um pouco mais translúcido
    return mix(c, k.ci, suave(H * 0.3, 0, y) * 0.4);
  }, {
    desloc: (p) => {
      const q = (p.x + 0.9 * Math.abs(p.z)) / (L * 0.065);
      if (p.y > H * 0.25) p.y -= H * 0.1 * Math.abs(Math.sin(q * PI)) ** 10;
    },
  });
  return [parte(g, 'umido', true)];
};

const gFileDourado: Gerador = (k) => {
  // filé frito em pouco óleo: face de cima dourada e crocante, bordas mais escuras, base clara
  const L = k.T, W = L * k.L, H = L * k.A;
  const lascas = corLascas(k.ci, mul(k.ci, 0.85), L * 0.065, W, k.s);
  const g = corpoFile(L, W, H, (x, y, z, t, a) => {
    const borda = suave(0.55, 1, Math.abs(z) / (W / 2));
    let c = mix(k.c1, k.c2, suave(0.1, 0.8, fbm(x * 60, y * 60, z * 60, k.s)) * 0.5 + borda * 0.35);
    c = mix(c, k.c3, (1 - suave(0.05, 0.22, celula(x * 160, y * 160, z * 160, k.s + 2))) * 0.35);
    c = mix(c, lascas(x, y, z, t, a), suave(H * 0.45, H * 0.1, y) * 0.75);
    return mul(c, 1 + 0.05 * cintila(x, y, z, 800, k.s));
  }, {
    desloc: (p) => {
      const q = (p.x + 0.9 * Math.abs(p.z)) / (L * 0.065);
      if (p.y > H * 0.25) p.y -= H * 0.04 * Math.abs(Math.sin(q * PI)) ** 14;
    },
  });
  return [parte(g, 'brilhante', true)];
};

const gFileEmpanadoCru: Gerador = (k) => {
  // filé passado na farinha temperada: véu pálido e granulado, pintinhas de páprica e ervas
  const L = k.T, W = L * k.L, H = L * k.A;
  const f = 1 / (L * 0.03);
  const g = corpoFile(L, W, H, (x, y, z) => {
    let c = mix(k.c1, k.ci, suave(0.2, 0.9, fbm(x * 50, y * 50, z * 50, k.s)) * 0.3);
    c = mix(c, mul(k.c1, 0.86), suave(0.4, 0.95, celula(x * f, y * f, z * f, k.s)) * 0.4);
    c = mix(c, k.ci, suave(0.2, 0.7, fbm(x * 35, y * 35, z * 35, k.s + 6)) * 0.35);
    c = mix(c, k.c2, suave(0.55, 0.8, cintila(x, y, z, 2000, k.s + 3)) * 0.9);
    c = mix(c, k.c3, suave(0.6, 0.85, cintila(x, y, z, 2000, k.s + 9)) * 0.8);
    return c;
  }, { mod: (t, a) => 1 + 0.03 * fbm(t * 30, Math.cos(a) * 3, Math.sin(a) * 3, k.s) });
  return [parte(g, 'fosco', true)];
};

const gPeixeMassaFrita: Gerador = (k) => {
  // posta passada na massa e frita imersa: casca estufada, irregular e dourada
  const L = k.T, W = L * k.L, H = L * k.A;
  const f = 1 / (L * 0.05);
  const cor = corEmpanado(k.c1, k.c2, k.c3, 1 / (L * 0.03), k.s);
  const g = corpoFile(L, W, H, cor, {
    n: 56, m: 36,
    mod: (t, a) => 1 + 0.1 * fbm(t * 9, Math.cos(a) * 2.2, Math.sin(a) * 2.2, k.s) + 0.05 * (0.5 - celula(t * 18, Math.cos(a) * 3, Math.sin(a) * 3, k.s + 1)),
    desloc: (p) => { p.y += H * 0.08 * Math.max(0, fbm(p.x * f, 0, p.z * f, k.s + 5)) * suave(0, H * 0.6, p.y); },
  });
  return [parte(g, 'brilhante', true)];
};

const gGoujon: Gerador = (k) => {
  // tira de linguado empanada e frita: bastão de seção arredondada com migalha dourada
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corEmpanado(k.c1, k.c2, k.c3, 1 / (L * 0.025), k.s);
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 22, exp: 3, cor,
    perfil: (t) => {
      const e = Math.sin(PI * clamp(0.02 + 0.96 * t)) ** 0.22 * (1 - 0.15 * t);
      return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2, cz: W * 0.25 * Math.sin(PI * t) };
    },
    mod: empanadoMod(40, k.s, 0.14),
    desloc: (p) => { if (p.y < H * 0.12) p.y = H * 0.12 - (H * 0.12 - p.y) * 0.4; },
  });
  return [parte(g, 'fosco', true)];
};

const gBolinhoPeixe: Gerador = (k) => {
  // bolinho achatado empanado em migalha e frito dos dois lados: faces mais escuras, lateral clara
  const R = k.T / 2, H = k.T * k.A;
  const base = corEmpanado(k.c1, k.c2, k.c3, 1 / (R * 0.09), k.s);
  const cor: CorFn = (x, y, z, t, a) => {
    const c = base(x, y, z, t, a);
    const face = suave(H * 0.35, H * 0.05, y) + suave(H * 0.7, H * 0.98, y);
    return mix(c, mul(k.c2, 0.9), face * 0.45);
  };
  const g = torno({
    caminho: [[0, 0], [R * 0.82, 0], [R * 0.96, H * 0.12], [R, H * 0.42], [R * 0.97, H * 0.72], [R * 0.84, H * 0.96], [R * 0.4, H * 1.02], [0, H * 1.03]],
    n: 30, m: 40, cor,
    mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a) * 1.8, Math.sin(a) * 1.8, t * 3, k.s) + 0.03 * (0.5 - celula(Math.cos(a) * 9, Math.sin(a) * 9, t * 12, k.s + 2)),
    desloc: (p) => { p.y = Math.max(0, p.y + H * 0.04 * fbm(p.x * 120, 0, p.z * 120, k.s + 4) * suave(0, H * 0.5, p.y)); },
  });
  return [parte(g, 'fosco', true)];
};

const gQuenelle: Gerador = (k) => {
  // quenelle de musse de peixe: oval liso e pontudo com três faces das colheres
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor: CorFn = (x, y, z, _t, a) => {
    let c = mix(k.c1, k.c2, suave(-0.3, 0.6, fbm(x * 70, y * 70, z * 70, k.s)) * 0.3);
    // riscos finos da colher ao longo do comprimento
    c = mix(c, mul(c, 0.94), Math.abs(Math.sin(a * 11 + x * 60)) ** 10 * 0.5);
    return mul(c, 1 + 0.02 * cintila(x, y, z, 900, k.s));
  };
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 30, cor,
    perfil: (t) => { const e = Math.sin(PI * t) ** 0.8; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
    mod: (_t, a) => 1 + 0.06 * Math.cos(3 * a),
    desloc: (p) => { if (p.y < H * 0.12) p.y = H * 0.12 - (H * 0.12 - p.y) * 0.3; },
  });
  return [parte(g, 'acetinado', true)];
};

const gTimbale: Gerador = (k) => {
  // timbale de musse desenformado: tronco de cone liso, topo plano (o fundo da forminha)
  const Rb = k.T / 2, H = k.T * k.A, Rt = Rb * 0.82;
  const cor: CorFn = (x, y, z) => {
    let c = mix(k.c1, k.c2, suave(-0.2, 0.7, fbm(x * 60, y * 60, z * 60, k.s)) * 0.25);
    // bolhinhas da musse na lateral
    c = mix(c, mul(c, 0.86), (1 - suave(0.05, 0.14, celula(x * 450, y * 450, z * 450, k.s))) * 0.6);
    c = mix(c, k.c3, suave(H * 0.85, H, y) * 0.2);
    return c;
  };
  const g = torno({
    caminho: [[0, 0], [Rb * 0.96, 0], [Rb, H * 0.04], [lerp(Rb, Rt, 0.5), H * 0.5], [Rt, H * 0.93], [Rt * 0.93, H], [Rt * 0.5, H * 1.005], [0, H]],
    n: 26, m: 40, cor,
    mod: (t, a) => 1 + 0.012 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 4, k.s),
  });
  return [parte(g, 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* Salmão: trouxinha, almofada e forminha                               */
/* ------------------------------------------------------------------ */

function cebolinhaCor(s: number): CorFn {
  const verde = rgb('#3d7a24'), claro = rgb('#6aa23a');
  return (x, y, z, t, a) => mul(mix(verde, claro, Math.abs(Math.sin(a * 2)) ** 6 * 0.5 + 0.15 * fbm(x * 300, y * 300, z * 300, s)), 1);
}

const gTrouxinha: Gerador = (k) => {
  // trouxinha quadrada de escalope de salmão, emenda para baixo, amarrada em cruz com cebolinha
  const R = k.T / 2, H = k.T * k.A;
  const p = 4;
  const quadra = (a: number) => 1 / (Math.abs(Math.cos(a)) ** p + Math.abs(Math.sin(a)) ** p) ** (1 / p);
  const carne = corSalmao(k.c1, k.c2, R * 0.42, k.s);
  const cor: CorFn = (x, y, z, t, a) => {
    let c = carne(x, y, z, t, a);
    // dobras das abas: vincos nas diagonais do topo
    const vinco = 1 - suave(0, R * 0.05, Math.abs(Math.abs(x) - Math.abs(z)) / Math.SQRT2);
    c = mix(c, mul(k.c1, 0.7), vinco * suave(H * 0.55, H * 0.95, y) * 0.5);
    return c;
  };
  const caminho: [number, number][] = [[0, 0], [R * 0.85, 0]];
  for (let i = 0; i <= 10; i++) {
    const th = (i / 10) * (PI / 2);
    caminho.push([R * Math.cos(th) ** (2 / 3), H * 0.04 + H * 0.96 * Math.sin(th) ** (2 / 3)]);
  }
  const g = torno({
    caminho, n: 36, m: 48, cor,
    mod: (t, a) => quadra(a) * (1 + 0.02 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t * 4, k.s)),
    desloc: (q) => {
      const vinco = 1 - suave(0, R * 0.05, Math.abs(Math.abs(q.x) - Math.abs(q.z)) / Math.SQRT2);
      q.y -= H * 0.05 * vinco * suave(H * 0.55, H * 0.95, q.y);
    },
  });
  const out: Parte[] = [parte(g, 'umido', true)];
  // cebolinha em cruz por cima, descendo pelas laterais até a base
  const rc = 0.0013;
  const alto = (r: number) => H * 0.04 + H * 0.96 * Math.max(0, 1 - Math.min(1, Math.abs(r) / R) ** 3) ** (1 / 3);
  const cc = cebolinhaCor(k.s);
  for (const eixo of [0, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const r = lerp(-R * 0.995, R * 0.995, i / 16);
      const y = alto(r) + rc * 0.8;
      pts.push(eixo ? V(0, y, r) : V(r, y, 0));
    }
    const ini = pts[0].clone(), fim = pts[pts.length - 1].clone();
    pts.unshift(eixo ? V(0, rc, ini.z * 1.02) : V(ini.x * 1.02, rc, 0));
    pts.push(eixo ? V(0, rc, fim.z * 1.02) : V(fim.x * 1.02, rc, 0));
    out.push(parte(tubo(pts, { raio: rc, m: 6, n: 40, cor: cc }), 'acetinado'));
  }
  // nó e duas pontinhas soltas no centro
  out.push(parte(tf(elipsoide(rc * 2.4, rc * 1.6, rc * 2.4, cc, 6, 8), [0, H + rc * 1.6, 0]), 'acetinado'));
  for (const sg of [-1, 1]) {
    out.push(parte(tubo([V(0, H + rc * 2, 0), V(sg * R * 0.25, H + rc * 3, R * 0.12), V(sg * R * 0.45, H * 0.9 + rc * 2, R * 0.28)], { raio: (t) => rc * (1 - 0.5 * t), m: 5, n: 10, cor: cc }), 'acetinado'));
  }
  return out;
};

const gAlmofada: Gerador = (k) => {
  // pedaço de filé grosso de 7,5 x 4 cm com bolso aberto na frente, recheio aparecendo, amarrado
  const L = k.T, W = L * k.L, H = L * k.A;
  const carne = corSalmao(k.c1, k.c2, L * 0.17, k.s, 1.2);
  const cor: CorFn = (x, y, z, t, a) => {
    let c = carne(x, y, z, t, a);
    // talho do bolso na face da frente
    const talho = (1 - suave(0, H * 0.04, Math.abs(y - H * 0.5))) * suave(W * 0.42, W * 0.5, z) * suave(L * 0.45, L * 0.36, Math.abs(x));
    c = mix(c, mul(k.c1, 0.55), talho * 0.8);
    return c;
  };
  const g = corpo({
    x0: -L / 2, x1: L / 2, n: 12, m: 36, exp: 5, tampa: true, cor, corTampa: carne,
    perfil: (t) => { const e = 1 - 0.1 * (1 - suave(0, 0.12, Math.min(t, 1 - t))); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
    mod: (t, a) => 1 + 0.025 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, k.s),
    desloc: (p) => {
      // o bolso estufa a frente
      if (p.z > 0) p.z += W * 0.06 * Math.sin(PI * clamp((p.x + L / 2) / L)) * Math.sin(PI * clamp(p.y / H));
      if (p.y < 0) p.y = 0;
    },
  });
  const out: Parte[] = [parte(g, 'umido', true)];
  // recheio de queijo de cabra saindo pelo talho
  const rech: CorFn = (x, y, z) => mul(k.c3, 0.96 + 0.06 * fbm(x * 300, y * 300, z * 300, k.s + 2));
  out.push(parte(tf(elipsoide(L * 0.28, H * 0.09, W * 0.06, rech, 10, 12), [0, H * 0.5, W * 0.53]), 'fosco'));
  const cc = cebolinhaCor(k.s);
  for (const xx of [-L * 0.22, L * 0.22]) out.push(parte(amarrilho(xx, H / 2, H / 2, W * 0.56, 0.0012, cc, 5), 'acetinado'));
  return out;
};

const gForminhaSalmao: Gerador = (k) => {
  // forminha desenformada: domo forrado de fatias de salmão defumado sobrepostas, taramasalata nas frestas da base
  const R = k.T / 2, H = k.T * k.A;
  const nf = 5;
  const carne = corSalmao(k.c1, k.c2, R * 0.36, k.s, 0.3);
  const faixa = (a: number, t: number) => {
    const f = (a / TAU) * nf + t * 0.7 + 10;
    return f - Math.floor(f);
  };
  const cor: CorFn = (x, y, z, t, a) => {
    let c = carne(x, y, z, t, a);
    const f = faixa(a, t);
    // borda de cada fatia mais clara e fina por cima da seguinte
    c = mix(c, mix(k.c1, k.c2, 0.4), suave(0.88, 0.99, f) * 0.6);
    c = mix(c, mul(k.c1, 0.72), suave(0.12, 0, f) * 0.45);
    // taramasalata rosada nas frestas da base
    c = mix(c, k.c3, suave(0.1, 0.0, f) * suave(H * 0.2, H * 0.02, y) * 0.9);
    return c;
  };
  const g = torno({
    caminho: [[0, 0], [R * 0.95, 0], [R, H * 0.08], [R * 0.97, H * 0.55], [R * 0.84, H * 0.88], [R * 0.5, H * 1.0], [0, H * 1.01]],
    n: 30, m: 56, cor,
    mod: (t, a) => 1 + 0.03 * faixa(a, t) * suave(0.05, 0.2, t) + 0.012 * Math.sin(a * 17 + t * 6),
  });
  return [parte(g, 'brilhante', true)];
};

/* ------------------------------------------------------------------ */
/* Paupiette e trança                                                    */
/* ------------------------------------------------------------------ */

const gPaupiette: Gerador = (k) => {
  // rolinho de filé de linguado em pé: espiral branca com a linha cinza da pele por dentro,
  // recheio de cogumelo no miolo e a ponta do rabo por fora
  const R = k.T / 2, H = k.T * k.A;
  const voltas = 3.2;
  const a0 = 0.6;
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z);
    const phi = Math.atan2(z, x);
    let c = mul(k.c1, 0.97 + 0.05 * fbm(x * 150, y * 150, z * 150, k.s));
    if (y > H * 0.9) {
      // topo: espiral da pele e camadas de filé
      const q = (r / R) * voltas - (phi + PI) / TAU;
      const fr = q - Math.floor(q);
      c = mix(c, k.c2, (1 - suave(0.04, 0.16, Math.min(fr, 1 - fr))) * 0.9);
      c = mix(c, mul(k.c1, 0.9), suave(0.2, 0.5, fr) * suave(0.8, 0.5, fr) * 0.2);
      // recheio de cogumelo picado
      const rech = 1 - suave(R * 0.2, R * 0.27, r);
      c = mix(c, mix(k.c3, mul(k.c3, 0.55), suave(0.3, 0.7, celula(x * 900, 0, z * 900, k.s))), rech);
    } else {
      // lateral: lascas finas e a emenda da ponta do filé
      c = mix(c, mul(k.c1, 0.9), Math.abs(Math.sin((y / (H * 0.12) + phi * 0.4) * PI)) ** 14 * 0.4);
      const emenda = 1 - suave(0, 0.06, Math.abs(((phi - a0 + PI * 3) % TAU) - PI));
      c = mix(c, k.c2, emenda * 0.5);
    }
    return c;
  };
  const g = torno({
    caminho: [[0, 0], [R * 0.94, 0], [R, H * 0.06], [R * 1.02, H * 0.5], [R, H * 0.94], [R * 0.95, H], [R * 0.45, H * 1.005], [R * 0.2, H * 1.02], [0, H * 1.05]],
    n: 74, m: 44, cor,
    mod: (_t, a) => {
      // ponta do rabo sobreposta por fora, afinando
      const phi = PI / 2 - a;
      const d = ((phi - a0 + PI * 3) % TAU) - PI;
      return 1 + 0.035 * suave(-0.05, 0.1, d) * suave(0.9, 0.2, d);
    },
  });
  return [parte(g, 'umido', true)];
};

const gTranca: Gerador = (k) => {
  // trança frouxa de três tiras de filé com a pele para cima: cavala, vermelho e linguado
  const L = k.T;
  const largura = L * 0.11, esp = L * 0.04;
  const A = L * 0.085, B = esp * 0.85;
  const om = (TAU * 2.6) / L;
  const peles: [RGB, RGB][] = [
    [rgb('#2f6b6b'), rgb('#c8d2d8')], // cavala: dorso verde-azulado listrado e flanco prateado
    [rgb('#c83a2e'), rgb('#f0a49a')], // vermelho: pele vermelha
    [rgb('#6a5a44'), rgb('#a89878')], // linguado: pele parda com pintas
  ];
  const out: Parte[] = [];
  for (let i = 0; i < 3; i++) {
    const fase = (TAU * i) / 3;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 30; j++) {
      const x = lerp(-L / 2, L / 2, j / 30);
      const th = om * x + fase;
      pts.push(V(x, esp * 1.1 + B * 0.5 * Math.sin(2 * th), A * Math.sin(th)));
    }
    const [p1, p2] = peles[i];
    const cor: CorFn = (x, y, z, t, a) => {
      const cima = suave(-0.1, 0.5, Math.cos(a));
      let pele: RGB;
      if (i === 0) pele = mix(p2, p1, Math.abs(Math.sin(x * 260 + Math.sin(z * 400) * 1.5)) ** 3 * 0.85);
      else if (i === 1) pele = mix(p1, p2, suave(0.2, 0.8, fbm(x * 80, y * 80, z * 80, k.s)) * 0.4);
      else pele = mix(p1, p2, (1 - suave(0.2, 0.45, celula(x * 220, y * 220, z * 220, k.s + i))) * 0.6);
      pele = mul(pele, 1 + 0.06 * cintila(x, y, z, 700, k.s + i));
      const carne = mul(k.ci, 0.96 + 0.05 * fbm(x * 200, y * 200, z * 200, k.s + i));
      return mix(carne, pele, cima);
    };
    out.push(parte(tubo(pts, {
      raio: (t) => (esp / 2) * (0.75 + 0.25 * suave(0, 0.06, Math.min(t, 1 - t))),
      achata: largura / esp, m: 10, n: 90, cima: V(0, 1, 0), cor,
    }), 'umido', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Sashimi                                                               */
/* ------------------------------------------------------------------ */

const gSashimi: Gerador = (k) => {
  // três fileiras de fatias tombadas como dominós: tainha, salmão e cavala, wasabi ao lado
  const out: Parte[] = [];
  const esp = 0.006, alt = 0.024, comp = 0.038;
  const tipos: { carne: RGB; pele: RGB; gord: RGB; borda: number }[] = [
    { carne: rgb('#f2d8cc'), pele: rgb('#9aa4ac'), gord: rgb('#fbeee6'), borda: 0.16 },
    { carne: rgb('#f07848'), pele: rgb('#f07848'), gord: rgb('#fbd8c4'), borda: 0 },
    { carne: rgb('#e6b0a0'), pele: rgb('#5a7a86'), gord: rgb('#c86a5a'), borda: 0.14 },
  ];
  for (let fil = 0; fil < 3; fil++) {
    const tp = tipos[fil];
    for (let i = 0; i < 5; i++) {
      const cor: CorFn = (x, y, z) => {
        // y local: altura da fatia; z local: comprimento
        const yy = y / (alt / 2);
        let c = tp.carne;
        if (fil === 1) c = mix(c, tp.gord, Math.abs(Math.sin((z * 0.6 + y) / 0.004 + fbm(x * 90, y * 90, z * 90, k.s) * 1.4)) ** 10 * 0.75);
        else if (fil === 0) c = mix(c, tp.gord, Math.abs(Math.sin((z + y * 0.4) / 0.005)) ** 12 * 0.4);
        else c = mix(c, mul(tp.gord, 1), suave(0.45, 0.85, yy) * 0.5);
        if (tp.borda) c = mix(c, tp.pele, suave(1 - tp.borda * 1.2, 1 - tp.borda * 0.6, yy) * (fil === 2 ? 0.9 : 0.8));
        return mul(c, 1 + 0.04 * fbm(x * 300, y * 300, z * 300, k.s + fil));
      };
      const g = corpo({
        x0: -esp / 2, x1: esp / 2, n: 3, m: 16, exp: 6, tampa: true, aneisTampa: 3, cor,
        perfil: () => ({ ry: alt / 2, rz: comp / 2 }),
      });
      g.rotateZ(1.05);
      g.translate(-0.03 + i * 0.012, alt * 0.45, (fil - 1) * 0.046);
      out.push(parte(g, 'umido', fil === 1 && i === 2));
    }
  }
  // montinho de wasabi
  const wa = rgb('#8ab84a');
  out.push(parte(torno({
    caminho: [[0, 0], [0.008, 0], [0.007, 0.004], [0.004, 0.008], [0, 0.0095]], n: 10, m: 18,
    cor: (x, y, z) => mul(wa, 0.92 + 0.12 * fbm(x * 500, y * 500, z * 500, k.s)),
    mod: (t, a) => 1 + 0.12 * Math.sin(a * 5 + t * 4) * t,
  }).translate(0.05, 0, 0.03), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Enfeites cítricos                                                     */
/* ------------------------------------------------------------------ */

function corCasca(casca: RGB, mesocarpo: RGB, s: number): (fora: number, x: number, y: number, z: number) => RGB {
  return (fora, x, y, z) => {
    const poro = 1 - suave(0.08, 0.22, celula(x * 1400, y * 1400, z * 1400, s));
    const c = mix(mul(casca, 1 + 0.06 * fbm(x * 200, y * 200, z * 200, s)), mul(casca, 0.8), poro * 0.4);
    return mix(mul(mesocarpo, 0.97 + 0.04 * fbm(x * 300, y * 300, z * 300, s + 1)), c, fora);
  };
}

const gLimaoMusselina: Gerador = (k) => {
  // gomo de limão dentro de um saquinho de musselina franzido e amarrado com barbante
  const R = k.T / 2, H = k.T * 1.0;
  const pano = k.c1, limao = k.c3;
  const hc = H * 0.62;
  const cor: CorFn = (x, y, z) => {
    const trama = (Math.abs(Math.sin(x * 2600)) ** 6 + Math.abs(Math.sin(z * 2600)) ** 6 + Math.abs(Math.sin(y * 2600)) ** 6) / 3;
    let c = mix(pano, mul(pano, 0.88), trama * 0.6 + 0.2 * fbm(x * 90, y * 90, z * 90, k.s));
    // o amarelo do limão transparece no corpo do saquinho
    c = mix(c, limao, suave(hc * 0.9, hc * 0.3, y) * suave(0, H * 0.1, y) * 0.32);
    return c;
  };
  const g = torno({
    caminho: [[0, 0], [R * 0.6, 0], [R * 0.95, H * 0.12], [R, H * 0.3], [R * 0.85, H * 0.48], [R * 0.4, hc * 0.95], [R * 0.13, hc], [R * 0.12, hc + H * 0.05], [R * 0.32, H * 0.82], [R * 0.48, H * 0.95], [R * 0.3, H * 0.99], [0, H * 0.92]],
    n: 44, m: 40, cor, l: 0.82,
    // pregas do franzido, mais fundas perto do nó e abertas no babado
    mod: (t, a) => 1 + (0.1 * suave(0.25, 0.55, t) + 0.12 * suave(0.7, 0.9, t)) * Math.sin(a * 13 + Math.sin(a * 3) * 0.6),
    desloc: (p) => { p.y += H * 0.03 * fbm(p.x * 80, 0, p.z * 80, k.s) * suave(H * 0.7, H, p.y); },
  });
  const out: Parte[] = [parte(g, 'fosco', true)];
  const barb = k.c2;
  const ptsB: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ptsB.push(V(Math.cos(a) * R * 0.17, hc + H * 0.025 + 0.001 * Math.sin(a * 2), Math.sin(a) * R * 0.17 * 0.82)); }
  out.push(parte(tubo(ptsB, { raio: 0.0011, m: 5, n: 32, fechado: true, cor: (x, y, z) => mul(barb, 0.95 + 0.1 * ruido(x * 3000, y * 3000, z * 3000, k.s)) }), 'fosco'));
  out.push(parte(tubo([V(R * 0.17, hc + H * 0.025, 0), V(R * 0.45, hc - H * 0.02, R * 0.1), V(R * 0.6, hc - H * 0.12, R * 0.05)], { raio: 0.001, m: 5, n: 10, cor: () => barb }), 'fosco'));
  return out;
};

/** Curva de nó simples (trevo aberto), em unidades. */
function noSimples(t: number): THREE.Vector3 {
  return V(Math.sin(t) + 2 * Math.sin(2 * t), -Math.sin(3 * t), Math.cos(t) - 2 * Math.cos(2 * t));
}

const gNozinhos: Gerador = (k) => {
  // tirinhas de casca escaldadas e atadas num nó: lima, limão e laranja lado a lado
  const out: Parte[] = [];
  const cores: [RGB, RGB][] = [[rgb('#5a9a2a'), rgb('#eef0c8')], [rgb('#e8d830'), rgb('#f6f2d8')], [rgb('#f08a1a'), rgb('#f8ecd0')]];
  const esc = 0.0021;
  for (let i = 0; i < 3; i++) {
    const [casca, meso] = cores[i];
    const cc = corCasca(casca, meso, k.s + i);
    const pts: THREE.Vector3[] = [];
    const t0 = 0.45, t1 = TAU - 0.45;
    const p0 = noSimples(t0), p1 = noSimples(t1);
    const d0 = noSimples(t0 - 0.01).sub(p0).normalize(), d1 = noSimples(t1 + 0.01).sub(p1).normalize();
    pts.push(p0.clone().addScaledVector(d0, 2.6), p0.clone().addScaledVector(d0, 1.3));
    for (let j = 0; j <= 40; j++) pts.push(noSimples(lerp(t0, t1, j / 40)));
    pts.push(p1.clone().addScaledVector(d1, 1.3), p1.clone().addScaledVector(d1, 2.6));
    const ang = i * 1.1;
    const pm = pts.map((p) => V((p.x * Math.cos(ang) - p.z * Math.sin(ang)) * esc + (i - 1) * 0.032, (p.y * 0.7 + 1.4) * esc, (p.x * Math.sin(ang) + p.z * Math.cos(ang)) * esc));
    for (const p of pm) p.y = Math.max(0.0012, p.y);
    out.push(parte(tubo(pm, {
      raio: 0.0008, achata: 2.6, m: 6, n: 100, cima: V(0, 1, 0),
      cor: (x, y, z, _t, a) => cc(suave(-0.3, 0.3, Math.cos(a)), x, y, z),
    }), 'brilhante', i === 1));
  }
  return out;
};

const gTacinhaKumquat: Gerador = (k) => {
  // metade de kumquat com a borda em zigue-zague, recheada de maionese com um raminho de endro
  const R = k.T / 2, Hc = R * 0.95, e = R * 0.18;
  const dentes = 8, A = R * 0.28;
  const cam: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { const th = (i / 10) * (PI / 2); cam.push([R * Math.sin(th), Hc * (1 - Math.cos(th))]); }
  cam.push([R * 0.93, Hc + e * 0.25]);
  for (let i = 10; i >= 0; i--) { const th = (i / 10) * (PI / 2); cam.push([(R - e) * Math.sin(th), e + (Hc - e) * (1 - Math.cos(th))]); }
  const tB = fracArco(cam, 10), tD = fracArco(cam, 11);
  const cc = corCasca(k.c1, k.c2, k.s);
  const cor: CorFn = (x, y, z, t) => {
    if (t <= tB) return cc(1, x, y, z);
    if (t <= tD + 0.02) return mul(k.c2, 0.98);
    // polpa em gomos por dentro
    const phi = Math.atan2(z, x);
    return mix(k.ci, mul(k.ci, 0.8), Math.abs(Math.sin(phi * 3)) ** 12 * 0.6);
  };
  const tri = (a: number) => { const f = (a / TAU) * dentes + 10; const fr = f - Math.floor(f); return 2 * Math.abs(2 * fr - 1) - 1; };
  const g = torno({
    caminho: cam, n: 40, m: 48, cor,
    desloc: (p, _t, a) => { p.y += A * tri(a) * suave(Hc * 0.5, Hc, p.y); },
  });
  const out: Parte[] = [parte(g, 'brilhante', true)];
  const maio = k.c3;
  out.push(parte(tf(elipsoide(R * 0.74, R * 0.26, R * 0.74, (x, y, z) => mul(maio, 0.95 + 0.07 * fbm(x * 400, y * 400, z * 400, k.s)), 10, 14, (t, a) => 1 + 0.08 * Math.sin(a * 4 + t * 9)), [0, Hc * 0.95, 0]), 'brilhante'));
  const endro = rgb('#4e8a2e');
  const ce: CorFn = (x, y, z) => mul(endro, 0.9 + 0.2 * ruido(x * 2000, y * 2000, z * 2000, k.s));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const p0 = V(0, Hc * 1.25, 0);
    out.push(parte(tubo([p0, V(Math.cos(a) * R * 0.3, Hc * 1.45, Math.sin(a) * R * 0.3), V(Math.cos(a) * R * 0.6, Hc * 1.5 + R * 0.08 * (i % 2), Math.sin(a) * R * 0.6)], { raio: (t) => 0.0006 * (1 - 0.5 * t), m: 4, n: 8, cor: ce }), 'acetinado'));
  }
  return out;
};

const gEspiralCasca: Gerador = (k) => {
  // tira de casca de laranja enrolada no espeto: espiral solta, casca por fora e albedo por dentro
  const L = k.T, Rh = L * 0.12;
  const voltas = 4.5;
  const pts: THREE.Vector3[] = [];
  const N = Math.round(voltas * 14);
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * voltas * TAU;
    const rr = Rh * (1 + 0.08 * Math.sin(i * 0.7));
    pts.push(V(lerp(-L / 2 + 0.004, L / 2 - 0.004, i / N), Rh + rr * Math.cos(th), rr * Math.sin(th)));
  }
  const cc = corCasca(k.c1, k.c2, k.s);
  return [parte(tubo(pts, {
    raio: (t) => 0.0007 * (0.7 + 0.3 * suave(0, 0.04, Math.min(t, 1 - t))), achata: 4.2, m: 6, n: 150,
    cor: (x, y, z, _t, a) => cc(suave(0.3, -0.3, Math.cos(a)), x, y, z),
  }), 'brilhante', true)];
};

const gRosaCasca: Gerador = (k) => {
  // casca de limão tirada em espiral com borda ondulada e enrolada como botão de rosa
  const D = k.T, H = D * 0.5;
  const voltas = 3.1;
  const r0 = D * 0.06, r1 = D * 0.46;
  const cc = corCasca(k.c1, k.c2, k.s);
  const g = lamina({
    ns: 90, nr: 6,
    P: (s, r) => {
      const th = s * voltas * TAU;
      const rho = lerp(r0, r1 * 0.85, s ** 0.8) + D * 0.22 * s * r * r * (1 + 0.5 * Math.sin(th * 2.5));
      const h = H * (0.6 + 0.4 * s) * (1 + 0.18 * Math.sin(th * 5 + 1) * r) * r;
      return V(rho * Math.cos(th), h + 0.0006, rho * Math.sin(th));
    },
    N: (s) => { const th = s * voltas * TAU; return V(Math.cos(th), 0, Math.sin(th)); },
    esp: () => 0.0014,
    cor: (_s, r, p, f) => mix(cc(f > 0 ? 1 : 0, p.x, p.y, p.z), mul(k.c1, 0.85), f > 0 ? suave(0.9, 1, r) * 0.4 : 0),
    fecharRaiz: true,
  });
  return [parte(g, 'brilhante', true)];
};

/* ------------------------------------------------------------------ */
/* Papillote e peixe na folha                                           */
/* ------------------------------------------------------------------ */

const gPapillote: Gerador = (k) => {
  // meio coração de papel-manteiga estufado no forno, borda torcida em pregas, manchas douradas
  const L = k.T, W = L * k.L, H = L * k.A;
  const larg = (t: number) => W * Math.sin(PI * clamp(t)) ** 0.75 * (1 - 0.25 * t);
  const papel = k.c1;
  const corP: CorFn = (x, y, z) => {
    let c = mix(papel, mul(papel, 0.92), suave(0.1, 0.8, fbm(x * 30, y * 30, z * 30, k.s)) * 0.5);
    // dourado onde o papel estufou mais e pegou calor
    c = mix(c, k.c2, suave(H * 0.6, H * 0.98, y) * suave(0.0, 0.7, fbm(x * 18, 0, z * 18, k.s + 3)) * 0.6);
    // o recheio transparece: sombra do peixe e da cenoura
    c = mix(c, mix(k.ci, k.c3, suave(0.3, 0.7, fbm(x * 60, 0, z * 60, k.s + 9)) * 0.5), suave(H * 0.35, H * 0.75, y) * 0.15);
    return mul(c, 1 + 0.04 * cintila(x, y, z, 400, k.s));
  };
  const out: Parte[] = [];
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 36, cor: corP,
    perfil: (t) => { const w = larg(t); const h = H * Math.sin(PI * clamp(t)) ** 0.55; return { ry: h / 2 + 1e-4, rz: w / 2 + 1e-4, cy: h / 2, cz: w / 2 }; },
    desloc: (p) => { if (p.y < 0.002) p.y = 0.002 - (0.002 - p.y) * 0.2; },
  }), 'acetinado', true));
  // borda: faixa de papel dobrada em pregas, rente à bancada, do lado curvo
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = lerp(-L / 2, L / 2, t);
    pts.push(V(x, 0.003, larg(t) + 0.009 * Math.sin(PI * t) ** 0.3));
  }
  out.push(parte(tubo(pts, {
    raio: 0.0016, achata: 7, m: 6, n: 240, cima: V(0, 1, 0), cor: (x, y, z, t) => mix(corP(x, y, z, t, 0), mul(k.c2, 0.9), Math.abs(Math.sin(t * PI * 46)) ** 4 * 0.35),
    desloc: (p, t) => { p.y += 0.0022 * Math.sin(t * PI * 46); },
  }), 'acetinado'));
  // dobra reta (o vinco do coração)
  out.push(parte(tubo([V(-L * 0.48, 0.0025, 0), V(0, 0.003, -0.001), V(L * 0.48, 0.0025, 0)], { raio: 0.0018, achata: 2, m: 6, n: 20, cima: V(0, 1, 0), cor: corP }), 'acetinado'));
  return out;
};

const gPeixeFolha: Gerador = (k) => {
  // peixe deitado embrulhado em folhas de uva assadas, cabeça e rabo de fora, atado com alho-poró
  const L = k.T;
  const Rz = L * 0.11, Ry = L * 0.065;
  const xe0 = -L * 0.3, xe1 = L * 0.27;
  const prata = k.c2, folhaC = k.c1;
  const perf = (t: number) => { const e = Math.sin(PI * clamp(0.04 + 0.96 * t) ** 1.25) ** 0.7; return e; };
  const xFolha = L * 0.11;
  const corF: CorFn = (x, y, z) => {
    const emb = suave(xe0 - 0.004, xe0 + 0.004, x) * suave(xe1 + 0.004, xe1 - 0.004, x);
    // pele do peixe: dorso oliva pintado e flanco prateado
    let c = mix(prata, k.c3, suave(-Ry * 0.2, Ry * 0.6, z) * 0.6);
    c = mix(c, mul(k.c3, 0.5), (1 - suave(0.1, 0.25, celula(x * 260, y * 260, z * 260, k.s))) * 0.6);
    c = mul(c, 1 + 0.06 * cintila(x, y, z, 900, k.s));
    // folhas sobrepostas com nervuras palmadas e bordas mais escuras
    const i = Math.floor((x - xe0) / xFolha + 0.25 * Math.sin(z * 60));
    const ox = xe0 + (i + 0.1) * xFolha;
    const dx = x - ox, ang = Math.atan2(z, dx);
    const nerv = Math.abs(Math.sin(ang * 3.5)) ** 30 + (1 - suave(0, 0.0015, Math.abs(z - dx * 0.1)));
    const fr = ((x - xe0) / xFolha + 0.25 * Math.sin(z * 60)) - i;
    let f = mix(folhaC, mul(folhaC, 1.35), nerv * 0.35);
    f = mix(f, mul(folhaC, 0.55), suave(0.85, 1, fr) * 0.7);
    f = mix(f, rgb('#5a4a22'), suave(0.3, 0.8, fbm(x * 40, y * 40, z * 40, k.s + 2)) * 0.35);
    return mix(c, f, emb);
  };
  const out: Parte[] = [];
  out.push(parte(corpo({
    x0: -L / 2 + L * 0.08, x1: L / 2, n: 60, m: 34, cor: corF,
    perfil: (t) => { const e = perf(t); return { ry: Ry * e + 1e-4, rz: Rz * e * (1 - 0.15 * t) + 1e-4, cy: Ry * e }; },
    mod: (t, a) => { const x = lerp(-L / 2 + L * 0.08, L / 2, t); const emb = suave(xe0 - 0.004, xe0 + 0.004, x) * suave(xe1 + 0.004, xe1 - 0.004, x); const fr = ((x - xe0) / xFolha + 0.25 * Math.sin(Math.sin(a) * 2)) % 1; return 1 + emb * (0.06 + 0.03 * fr) + 0.01 * fbm(t * 9, Math.cos(a), Math.sin(a), k.s); },
    desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
  }), 'acetinado', true));
  // rabo
  const xr = -L / 2 + L * 0.09;
  out.push(parte(lamina({
    ns: 8, nr: 6,
    P: (s, r) => V(xr + L * 0.03 - L * 0.12 * r, Ry * 0.3, (s - 0.5) * Rz * (0.35 + 1.5 * r) * (1 - 0.25 * Math.abs(Math.sin(PI * s)) * r)),
    N: () => V(0, 1, 0),
    esp: (_s, r) => 0.003 * (1 - r) + 0.0008,
    cor: (s, r, p) => mix(mix(prata, k.c3, 0.4), mul(k.c3, 0.6), r * 0.5 + 0.2 * Math.abs(Math.sin(s * 30))) as RGB,
  }), 'acetinado'));
  // olho virado para cima
  const xo = L / 2 - L * 0.07;
  const to = (xo - (-L / 2 + L * 0.08)) / (L - L * 0.08);
  const ry0 = Ry * perf(to);
  out.push(parte(apontar(olhoPeixe(L * 0.018, rgb('#c8b070'), rgb('#3a3a32')), V(0, 1, 0.1), V(xo, ry0 * 1.95, Rz * 0.05)), 'umido'));
  // amarrilhos de alho-poró escaldado
  const poro = rgb('#c8d890');
  const cp: CorFn = (x, y, z) => mix(poro, rgb('#9ab860'), Math.abs(Math.sin(y * 900 + z * 900)) ** 6 * 0.4);
  for (const xx of [-L * 0.13, L * 0.12]) {
    const t = (xx - (-L / 2 + L * 0.08)) / (L - L * 0.08);
    const e = perf(t);
    out.push(parte(amarrilho(xx, Ry * e, Ry * e * 1.06, Rz * e * (1 - 0.15 * t) * 1.08, 0.0022, cp, 2.4), 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Fatia de terrina de peixe                                             */
/* ------------------------------------------------------------------ */

const gTerrinaFatia: Gerador = (k) => {
  // fatia deitada: forro de espinafre, musse branca embaixo, três camarões enrolados em espinafre
  // no meio e musse verde de ervas por cima
  const L = k.T, Hz = L * 0.7, E = L * 0.14;
  const branco = k.c1, verdeM = k.c2, espin = k.c3, cam = k.ci;
  const cor: CorChapa = (x, y, z, u, v) => {
    const bx = Math.min(u, 1 - u) * L, bz = (1 - Math.abs(v)) * (Hz / 2);
    const borda = Math.min(bx, bz);
    const n1 = fbm(x * 120, y * 120, z * 120, k.s);
    if (borda < 0.0035 + 0.0008 * n1) return mul(mix(espin, mul(espin, 1.4), Math.abs(Math.sin(x * 900 + z * 300)) ** 8 * 0.4), 0.95 + 0.1 * n1);
    // camarões
    for (const uc of [0.24, 0.5, 0.76]) {
      const dx = (u - uc) * L, dz = (v - 0.06) * (Hz / 2);
      const d = Math.hypot(dx, dz * 1.15);
      if (d < 0.0105) {
        if (d > 0.0085) return mul(espin, 0.9 + 0.15 * n1);
        const ang = Math.atan2(dz, dx);
        let c = mix(cam, rgb('#f8ece4'), suave(0.004, 0.0, d) * 0.6);
        c = mix(c, rgb('#e8603a'), suave(0.006, 0.0082, d) * suave(0.2, 0.9, Math.sin(ang + 1)) * 0.8);
        return c;
      }
    }
    const lim = 0.06 + 0.06 * fbm(u * 6, 0, 0, k.s + 4);
    if (v > lim + 0.1) {
      let c = mix(verdeM, mul(verdeM, 0.75), (1 - suave(0.04, 0.12, celula(x * 700, 0, z * 700, k.s + 1))) * 0.7);
      return mul(c, 0.97 + 0.05 * n1);
    }
    let c = mix(branco, mul(branco, 0.92), (1 - suave(0.05, 0.12, celula(x * 800, 0, z * 800, k.s + 2))) * 0.4);
    return mul(c, 0.97 + 0.04 * n1);
  };
  const g = chapa(44, 30, (u, v, lado) => {
    const x = (u - 0.5) * L, z = v * (Hz / 2);
    const cant = suave(0, 0.04, Math.min(u, 1 - u)) * suave(0, 0.06, 1 - Math.abs(v));
    return [x, lado ? E * (0.88 + 0.12 * cant) : 0, z];
  }, cor);
  return [parte(g, 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* Caldos e sopas                                                        */
/* ------------------------------------------------------------------ */

const gCubosCaldo: Gerador = (k) => {
  // cubos de caldo reduzido congelados: âmbar escuro por dentro, cristais de gelo nas arestas
  const a = k.T * 0.42;
  const out: Parte[] = [];
  const pos: [number, number, number, number][] = [[-0.55, 0, -0.55, 0.1], [0.55, 0, -0.5, -0.15], [-0.5, 0, 0.55, 0.2], [0.6, 0, 0.6, 0.05], [0.0, 1, -0.1, 0.5], [0.1, 1, 0.55, -0.3]];
  pos.forEach(([px, py, pz, rot], i) => {
    const cor: CorFn = (x, y, z) => {
      const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) / (a / 2);
      const aresta = (Math.abs(x) > a * 0.38 ? 1 : 0) + (Math.abs(y) > a * 0.38 ? 1 : 0) + (Math.abs(z) > a * 0.38 ? 1 : 0);
      let c = mix(k.c2, k.c1, suave(0.6, 1, m) * 0.6 + 0.2 * fbm(x * 200, y * 200, z * 200, k.s + i));
      c = mix(c, k.c3, (aresta >= 2 ? 0.55 : 0) * (0.6 + 0.4 * ruido(x * 900, y * 900, z * 900, k.s)));
      c = mix(c, k.c3, (1 - suave(0.05, 0.15, celula(x * 600, y * 600, z * 600, k.s + i))) * 0.4);
      return c;
    };
    const g = corpo({ x0: -a / 2, x1: a / 2, n: 4, m: 16, exp: 7, tampa: true, aneisTampa: 3, cor, perfil: () => ({ ry: a / 2, rz: a / 2 }) });
    g.rotateY(rot);
    if (py) g.rotateZ(0.12 * (i % 2 ? 1 : -1));
    g.translate(px * a, a / 2 + py * a * 0.98, pz * a);
    out.push(parte(g, 'brilhante', i === 0));
  });
  return out;
};

function fiosDeOvo(k: Ctx, n: number, raio: number): Parte[] {
  const out: Parte[] = [];
  for (let i = 0; i < n; i++) {
    const ang0 = k.r.f(0, TAU);
    const r0 = raio * Math.sqrt(k.r.n()) * 0.85;
    let p = V(Math.cos(ang0) * r0, 0, Math.sin(ang0) * r0);
    let dir = k.r.f(0, TAU);
    const pts: THREE.Vector3[] = [];
    const passos = k.r.i(5, 8);
    for (let j = 0; j < passos; j++) {
      pts.push(V(p.x, 0.0012 + 0.0016 * k.r.n(), p.z));
      dir += k.r.f(-1.3, 1.3);
      const st = raio * k.r.f(0.07, 0.12);
      p = p.clone().add(V(Math.cos(dir) * st, 0, Math.sin(dir) * st));
    }
    const w = k.r.f(0.9, 1.5);
    out.push(parte(tubo(pts, {
      raio: (t) => 0.0006 * (0.5 + 0.5 * Math.sin(PI * t) ** 0.5), achata: 5.5 * w, m: 6, n: 18, cima: V(0, 1, 0),
      cor: (x, y, z) => mix(k.c1, k.c2, suave(-0.2, 0.6, fbm(x * 160, y * 160, z * 160, k.s + i)) * 0.6),
      mod: (t, a) => 1 + 0.35 * ruido(t * 11, Math.cos(a), Math.sin(a), k.s + i),
    }), 'acetinado', i === 0));
  }
  return out;
}

const gFiosOvo: Gerador = (k) => fiosDeOvo(k, 24, k.T / 2);

const gFiosOvoFrango: Gerador = (k) => {
  // fios de ovo boiando com tiras de peito de frango cozido e fatias de shiitake
  const R = k.T / 2;
  const out = fiosDeOvo(k, 16, R);
  const frango = rgb('#efe6d4');
  for (let i = 0; i < 6; i++) {
    const L = k.r.f(0.03, 0.042), w = 0.006;
    const cor: CorFn = (x, y, z) => mix(frango, mul(frango, 0.86), Math.abs(Math.sin(z * 2200 + fbm(x * 90, y * 90, z * 90, k.s) * 2)) ** 6 * 0.5);
    const g = corpo({ x0: -L / 2, x1: L / 2, n: 8, m: 10, exp: 3, cor, perfil: (t) => { const e = Math.sin(PI * clamp(0.03 + 0.94 * t)) ** 0.25; return { ry: w * 0.4 * e, rz: w * 0.5 * e, cy: w * 0.4 }; } });
    g.rotateY(k.r.f(0, TAU));
    const a = k.r.f(0, TAU), r = R * Math.sqrt(k.r.n()) * 0.7;
    g.translate(Math.cos(a) * r, 0.001, Math.sin(a) * r);
    out.push(parte(g, 'acetinado'));
  }
  const chap = rgb('#6a4628'), lam = rgb('#d8c4a4');
  for (let i = 0; i < 5; i++) {
    const L = 0.026, H = 0.012;
    const cor: CorFn = (x, y) => mix(lam, chap, suave(H * 0.55, H * 0.8, y + H * 0.5));
    const g = corpo({
      x0: -L / 2, x1: L / 2, n: 10, m: 8, cor,
      perfil: (t) => { const e = Math.sin(PI * clamp(t)) ** 0.5; return { ry: (H / 2) * e * (0.6 + 0.4 * Math.sin(PI * t)), rz: 0.0012 * e + 1e-4, cy: 0 }; },
    });
    // fatia deitada: o corte da lâmina para cima
    g.rotateX(PI / 2);
    g.rotateY(k.r.f(0, TAU));
    const a = k.r.f(0, TAU), r = R * Math.sqrt(k.r.n()) * 0.7;
    g.translate(Math.cos(a) * r, 0.0014, Math.sin(a) * r);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gFloresCenoura: Gerador = (k) => {
  // rodelas de cenoura cortadas em flor de cinco pétalas, com brotos de feijão ao lado
  const out: Parte[] = [];
  const Rf = k.T * 0.17, Hf = 0.004;
  const petala = (a: number) => 0.76 + 0.24 * Math.abs(Math.cos(a * 2.5)) ** 0.55;
  const pos: [number, number, number][] = [[-0.25, -0.2, 0], [0.05, -0.28, 0.6], [0.3, -0.05, 1.1], [-0.05, 0.08, 1.7], [-0.32, 0.18, 0.4]];
  pos.forEach(([px, pz, rot], i) => {
    const cor: CorFn = (x, y, z) => {
      const r = Math.hypot(x, z) / Rf;
      let c = mix(k.c2, k.c1, suave(0.36, 0.48, r));
      c = mix(c, mul(k.c1, 1.1), Math.abs(Math.sin(Math.atan2(z, x) * 14)) ** 10 * suave(0.5, 0.8, r) * 0.3);
      return mul(c, 0.96 + 0.06 * fbm(x * 300, y * 300, z * 300, k.s + i));
    };
    const b = Hf * 0.3;
    const g = torno({
      caminho: [[0, 0], [Rf * 0.5, 0], [Rf - b, 0], [Rf, b], [Rf, Hf - b], [Rf - b, Hf], [Rf * 0.5, Hf], [0, Hf]],
      n: 10, m: 50, cor, mod: (_t, a) => petala(a + rot),
    });
    g.rotateZ(0.06 * (i % 2 ? 1 : -1));
    g.translate(px * k.T, 0.0006 + (i === 3 ? Hf * 0.8 : 0), pz * k.T);
    out.push(parte(g, 'acetinado', i === 0));
  });
  // brotos de feijão: haste branca translúcida, cabecinha amarela e raizinha
  const haste = rgb('#f2f0e2'), cab = rgb('#e8dc78');
  for (let i = 0; i < 7; i++) {
    const a = k.r.f(-0.5, 0.5);
    const x0 = k.T * 0.1 + k.r.f(-0.01, 0.01), z0 = k.T * 0.25 + k.r.f(-0.012, 0.012);
    const L = k.r.f(0.045, 0.06);
    const d = V(Math.cos(a), 0, Math.sin(a));
    const p0 = V(x0, 0.0016, z0);
    const p1 = p0.clone().addScaledVector(d, L * 0.5).add(V(0, 0.001, k.r.f(-0.004, 0.004)));
    const p2 = p0.clone().addScaledVector(d, L).add(V(0, 0.0004, k.r.f(-0.006, 0.006)));
    out.push(parte(tubo([p0, p1, p2], { raio: (t) => 0.0014 * (1 - 0.55 * t), m: 5, n: 12, cor: (x, y, z) => mul(haste, 0.95 + 0.06 * ruido(x * 900, y * 900, z * 900, k.s + i)) }), 'brilhante'));
    out.push(parte(tf(elipsoide(0.0028, 0.0018, 0.002, () => cab, 5, 7), [p0.x - d.x * 0.002, p0.y + 0.0004, p0.z - d.z * 0.002]), 'acetinado'));
    const p3 = p2.clone().addScaledVector(d, 0.012).add(V(0, -0.0006, 0.003));
    out.push(parte(tubo([p2, p3], { raio: 0.0004, m: 4, n: 4, cor: () => mul(haste, 0.85) }), 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Lote                                                                  */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'file-peixe-poche': { visual: { f: 'file_peixe', v: 'file-poche', t: 0.2, a: 0.075, l: 0.32, c1: '#f6f1e8', c2: '#c4b4a0', ci: '#efe6d8', cc: '#f6f0e6' }, gerar: gFilePoche },
  'file-peixe-dourado': { visual: { f: 'file_peixe', v: 'file-dourado', t: 0.2, a: 0.08, l: 0.32, c1: '#b8762a', c2: '#74400f', c3: '#e0aa58', ci: '#f4eee4', cc: '#c88a3a' }, gerar: gFileDourado },
  'file-empanado-cru': { visual: { f: 'file_peixe', v: 'file-empanado', t: 0.2, a: 0.08, l: 0.32, c1: '#eee4d0', c2: '#b8502a', c3: '#5a7a2a', ci: '#f0e4dc', cc: '#c89048' }, gerar: gFileEmpanadoCru },
  'peixe-massa-frita': { visual: { f: 'file_peixe', v: 'massa-frita', t: 0.2, a: 0.14, l: 0.36, c1: '#d8a040', c2: '#9a5a1a', c3: '#f0d078', ci: '#f6f0e6', cc: '#d8a040' }, gerar: gPeixeMassaFrita },
  goujon: { visual: { f: 'file_peixe', v: 'goujon', t: 0.08, a: 0.14, l: 0.22, c1: '#c8862c', c2: '#7a4214', c3: '#ecc070', ci: '#f6f0e6', cc: '#c8862c' }, gerar: gGoujon },
  'bolinho-peixe': { visual: { f: 'massa_bola', v: 'bolinho-peixe', t: 0.06, a: 0.32, c1: '#b8742a', c2: '#6a3a12', c3: '#e0b060', ci: '#efe2c8', cc: '#b8742a' }, gerar: gBolinhoPeixe },
  'quenelle-peixe': { visual: { f: 'file_peixe', v: 'quenelle', t: 0.065, a: 0.38, l: 0.46, c1: '#f2e8da', c2: '#e8d2c6', ci: '#f2e8da', cc: '#f2e6d4' }, gerar: gQuenelle },
  'timbale-peixe': { visual: { f: 'file_peixe', v: 'timbale', t: 0.065, a: 0.62, l: 1, c1: '#f2e8d6', c2: '#e6d6c0', c3: '#e8d2a8', ci: '#f2e8d6', cc: '#f0e4cc' }, gerar: gTimbale },
  'trouxinha-salmao': { visual: { f: 'file_peixe', v: 'trouxinha', t: 0.065, a: 0.38, l: 1, c1: '#f07a4a', c2: '#fbd8c4', ci: '#f6a07a', cc: '#f2b898' }, gerar: gTrouxinha },
  'almofada-salmao': { visual: { f: 'file_peixe', v: 'almofada', t: 0.075, a: 0.38, l: 0.53, c1: '#f07a4a', c2: '#fbd8c4', c3: '#f4f0e4', ci: '#f6a07a', cc: '#f2b898' }, gerar: gAlmofada },
  'forminha-salmao': { visual: { f: 'file_peixe', v: 'forminha', t: 0.06, a: 0.62, l: 1, c1: '#ec7a4c', c2: '#f8c8b0', c3: '#ecb8b0', ci: '#f09070', cc: '#ec7a4c' }, gerar: gForminhaSalmao },
  'paupiette-linguado': { visual: { f: 'file_peixe', v: 'paupiette', t: 0.045, a: 0.78, l: 1, c1: '#f6f1e8', c2: '#7a7468', c3: '#6a4a2a', ci: '#f2ece2', cc: '#f6f0e6' }, gerar: gPaupiette },
  'tranca-tres-peixes': { visual: { f: 'file_peixe', v: 'tranca', t: 0.18, a: 0.1, l: 0.3, c1: '#2f6b6b', c2: '#c83a2e', c3: '#6a5a44', ci: '#f6efe6', cc: '#f2eadc' }, gerar: gTranca },
  'sashimi-tres-peixes': { visual: { f: 'file_peixe', v: 'sashimi', t: 0.11, a: 0.25, l: 1, c1: '#f07848', c2: '#f2d8cc', c3: '#e6b0a0', ci: '#f07848', cc: '#f0a080' }, gerar: gSashimi },
  'limao-musselina': { visual: { f: 'citrico', v: 'musselina', t: 0.045, a: 1, l: 0.82, c1: '#f2efe4', c2: '#d8c8a0', c3: '#e8d830', ci: '#f4ecb0', cc: '#f2efe4' }, gerar: gLimaoMusselina },
  'nozinhos-citricos': { visual: { f: 'citrico', v: 'nozinhos', t: 0.085, a: 0.12, l: 0.3, c1: '#f08a1a', c2: '#f8ecd0', ci: '#f8ecd0', cc: '#f08a1a' }, gerar: gNozinhos },
  'tacinha-kumquat': { visual: { f: 'citrico', v: 'tacinha', t: 0.03, a: 1, l: 1, c1: '#f08a1a', c2: '#f8e6c0', c3: '#f6e8b4', ci: '#f6a83a', cc: '#f08a1a' }, gerar: gTacinhaKumquat },
  'espiral-casca-laranja': { visual: { f: 'citrico', v: 'espiral', t: 0.055, a: 0.25, l: 0.25, c1: '#f08a1a', c2: '#f8ecd0', ci: '#f8ecd0', cc: '#f08a1a' }, gerar: gEspiralCasca },
  'rosa-casca-limao': { visual: { f: 'citrico', v: 'rosa', t: 0.045, a: 0.5, l: 1, c1: '#e8d830', c2: '#f6f2d8', ci: '#f6f2d8', cc: '#e8d830' }, gerar: gRosaCasca },
  papillote: { visual: { f: 'file_peixe', v: 'papillote', t: 0.3, a: 0.2, l: 0.5, c1: '#efe6d0', c2: '#c89a5a', c3: '#e8802a', ci: '#f4efe8', cc: '#e2cfa8' }, gerar: gPapillote },
  'peixe-folha-uva': { visual: { f: 'peixe', v: 'peixe-folha', t: 0.3, a: 0.13, l: 0.22, c1: '#5a6e2a', c2: '#c8ccc8', c3: '#6a6a3a', ci: '#f4efe8', cc: '#5a6e2a' }, gerar: gPeixeFolha },
  'terrina-peixe-fatia': { visual: { f: 'barra', v: 'terrina-peixe', t: 0.1, a: 0.14, l: 0.7, c1: '#f2ebdc', c2: '#a8c070', c3: '#2f5a1e', ci: '#f0a088', cc: '#f0e8d6' }, gerar: gTerrinaFatia },
  'cubos-de-caldo': { visual: { f: 'barra', v: 'cubos-caldo', t: 0.065, a: 0.8, l: 1, c1: '#b07a3a', c2: '#6a3e16', c3: '#f0ece6', ci: '#8a5424', cc: '#a87436' }, gerar: gCubosCaldo },
  'fios-de-ovo': { visual: { f: 'placa', v: 'fios-ovo', t: 0.11, a: 0.04, l: 1, c1: '#f2da80', c2: '#fbf6e0', ci: '#f4e6a0', cc: '#f2e09a' }, gerar: gFiosOvo },
  'fios-de-ovo-frango': { visual: { f: 'placa', v: 'fios-ovo-frango', t: 0.11, a: 0.06, l: 1, c1: '#f2da80', c2: '#fbf6e0', ci: '#f4e6a0', cc: '#efe2b4' }, gerar: gFiosOvoFrango },
  'cenoura-flor-broto': { visual: { f: 'fuso', v: 'flores-cenoura', t: 0.11, a: 0.08, l: 1, c1: '#e8701a', c2: '#f4a43a', ci: '#f4a43a', cc: '#e8781e' }, gerar: gFloresCenoura },
};
