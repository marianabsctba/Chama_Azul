// Alimentos novos do grupo frutos do mar: lagosta cozida (inteira, aberta ao meio, medalhões),
// camarão descascado e camarão reto cozido, mexilhão aberto, gratinado e fora da concha,
// amêijoa e ostra na meia concha, vieira limpa com coral, búzio fora da concha, anéis e
// tentáculos de lula, lula recheada, carne de caranguejo separada e salicórnia.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { disco, type Ctx, type Gerador } from '../pecas';
import { gCrustaceo } from '../fam_mar';
import { lamina, cintila } from '../mar_pecas';
import { fracArco, espelharZ } from './peixes';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* Valva de bivalve: tigela fina com cor de fora e nácar por dentro      */
/* ------------------------------------------------------------------ */

interface OpcValva {
  L: number;
  W: number;
  /** Profundidade da tigela. */
  D: number;
  /** Espessura da concha. */
  e: number;
  /** Meia-largura relativa ao longo de u (0 no umbo, em -X; 1 na borda oposta). */
  largura: (u: number) => number;
  /** Curvatura lateral (mexilhão em banana). */
  curva?: number;
  fora: (x: number, y: number, z: number, u: number, rho: number) => RGB;
  dentro: (x: number, y: number, z: number, u: number, rho: number) => RGB;
  relevo?: (p: THREE.Vector3, u: number, rho: number, fora: boolean) => void;
  n?: number;
  m?: number;
}

/** Valva com a abertura para cima (+Y), umbo em -X, apoiada em y = 0. */
function valva(o: OpcValva): THREE.BufferGeometry {
  const R = o.L / 2, N = 10;
  const cam: [number, number][] = [];
  for (let i = 0; i <= N; i++) { const r = i / N; cam.push([R * r, o.D * r ** 1.8]); }
  cam.push([R * 0.985, o.D + o.e * 0.35]);
  for (let i = N; i >= 0; i--) { const r = i / N; cam.push([R * 0.97 * r, o.e + (o.D - o.e) * r ** 1.8]); }
  const tB = fracArco(cam, N);
  const uDe = (x: number) => clamp((x / R + 1) / 2);
  return torno({
    caminho: cam, n: o.n ?? 30, m: o.m ?? 48,
    cor: (x, y, z, t) => {
      const fora = t <= tB + 0.005;
      const rho = fora ? clamp(y / o.D) ** (1 / 1.8) : clamp((y - o.e) / (o.D - o.e)) ** (1 / 1.8);
      return fora ? o.fora(x, y, z, uDe(x), rho) : o.dentro(x, y, z, uDe(x), rho);
    },
    desloc: (p, t) => {
      const fora = t <= tB + 0.005;
      const rho = Math.hypot(p.x, p.z) / R;
      const u = uDe(p.x);
      p.z *= (o.W / o.L) * o.largura(u);
      p.z += (o.curva ?? 0) * o.W * (u - 0.5) ** 2;
      o.relevo?.(p, u, rho, fora);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mexilhão                                                              */
/* ------------------------------------------------------------------ */

const MEX = { L: 0.07, W: 0.036, D: 0.011, e: 0.0014 };
const largMex = (u: number) => 0.15 + 0.95 * Math.sin(PI * clamp(0.02 + 0.62 * u)) ** 0.8;

function valvaMexilhao(s: number): THREE.BufferGeometry {
  const preto = rgb('#141824'), azul = rgb('#2c3a5c'), marrom = rgb('#4a3a22');
  const nacar = rgb('#dfe2ea'), rosa = rgb('#eadcea'), cel = rgb('#d0e0ec'), margem = rgb('#262a46');
  return valva({
    ...MEX, largura: largMex, curva: 0.22, n: 26, m: 44,
    fora: (x, y, z, u, rho) => {
      const n1 = fbm(x * 300, y * 300, z * 300, s);
      let c = mix(preto, azul, suave(0.2, 0.9, rho) * 0.5 + 0.25 * n1);
      c = mix(c, mul(preto, 0.6), Math.abs(Math.sin(rho * 42 + n1 * 1.5)) ** 3 * 0.4);
      c = mix(c, rgb('#5a4060'), (1 - suave(0.05, 0.2, u)) * 0.5);
      c = mix(c, marrom, suave(0.85, 1, rho) * 0.35);
      return mul(c, 1 + 0.08 * cintila(x, y, z, 1500, s));
    },
    dentro: (x, y, z, u, rho) => {
      // nácar perolado com reflexos rosados e azulados e a margem escura
      const ir = Math.sin(rho * 18 + x * 250 + fbm(x * 200, y * 200, z * 200, s) * 3);
      let c = mix(nacar, ir > 0 ? rosa : cel, Math.abs(ir) * 0.6);
      c = mix(c, margem, suave(0.82, 0.93, rho));
      c = mix(c, rgb('#b0a8c8'), (1 - suave(0.0, 0.12, Math.hypot(u - 0.78, z / MEX.W - 0.05))) * 0.5);
      return c;
    },
  });
}

/** Carne alaranjada do mexilhão cozido, com a borda franjada do manto. */
function carneMexilhao(L: number, W: number, H: number, s: number, comAnel = true): THREE.BufferGeometry {
  const lar = rgb('#e8843a'), claro = rgb('#f2a660'), franja = rgb('#7a4a22');
  return elipsoide(L / 2, H / 2, W / 2, (x, y, z, _t, a) => {
    const d = Math.hypot(x / (L / 2), z / (W / 2));
    let c = mix(lar, claro, suave(0.0, 0.8, fbm(x * 300, y * 300, z * 300, s)) * 0.4);
    if (comAnel) c = mix(c, franja, suave(0.72, 0.9, d) * 0.8 * (0.7 + 0.3 * Math.abs(Math.sin(Math.atan2(z, x) * 15))));
    void a;
    return mul(c, 1 + 0.05 * cintila(x, y, z, 1200, s));
  }, 12, 18, (t, a) => 1 + 0.07 * Math.sin(t * 34) * (1 - Math.abs(Math.cos(a))) ** 2 + 0.04 * fbm(t * 5, Math.cos(a), Math.sin(a), s));
}

const gMexilhaoAberto: Gerador = (k) => {
  // mexilhão cozido aberto: as duas valvas presas na charneira, a carne laranja numa delas
  const A = valvaMexilhao(k.s);
  const B = espelharZ(A.clone());
  const zE = -MEX.W * 0.42;
  B.translate(0, 0, 2 * zE);
  B.translate(0, -MEX.D, -zE);
  B.rotateX(1.0);
  B.translate(0, MEX.D, zE);
  const carne = tf(carneMexilhao(MEX.L * 0.72, MEX.W * 0.62, MEX.D * 1.0, k.s), [MEX.L * 0.04, MEX.e + MEX.D * 0.42, 0.003]);
  return [parte(A, 'brilhante', true), parte(B, 'brilhante'), parte(carne, 'umido')];
};

const gMexilhaoGratinado: Gerador = (k) => {
  // meia concha com o mexilhão, pesto gratinado com farelo dourado e concassée de tomate
  const A = valvaMexilhao(k.s);
  const out: Parte[] = [parte(A, 'brilhante', true)];
  out.push(parte(tf(carneMexilhao(MEX.L * 0.72, MEX.W * 0.62, MEX.D * 1.0, k.s), [MEX.L * 0.04, MEX.e + MEX.D * 0.42, 0.003]), 'umido'));
  const pesto = rgb('#4e6e22'), dourado = rgb('#c8963c');
  out.push(parte(tf(elipsoide(MEX.L * 0.26, MEX.D * 0.32, MEX.W * 0.22, (x, y, z) => {
    const cr = 1 - suave(0.1, 0.4, celula(x * 900, y * 900, z * 900, k.s));
    return mul(mix(pesto, dourado, cr * 0.8 + suave(0.0, 0.6, fbm(x * 300, y * 300, z * 300, k.s)) * 0.3), 0.95 + 0.1 * ruido(x * 2000, y * 2000, z * 2000, k.s));
  }, 8, 14, (t, a) => 1 + 0.12 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, k.s)), [MEX.L * 0.06, MEX.e + MEX.D * 0.95, 0.003]), 'acetinado'));
  const tom = rgb('#c8281c');
  for (let i = 0; i < 3; i++) {
    const g = corpo({ x0: -0.002, x1: 0.002, n: 2, m: 8, exp: 6, tampa: true, aneisTampa: 2, cor: (x, y, z) => mix(tom, rgb('#e86048'), 0.3 + 0.3 * ruido(x * 3000, y * 3000, z * 3000, k.s + i)), perfil: () => ({ ry: 0.0018, rz: 0.002 }) });
    g.rotateY(i * 0.9);
    g.translate(MEX.L * (0.02 + 0.1 * i) - 0.003, MEX.e + MEX.D * 1.3, (i - 1) * 0.004 + 0.003);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

const gCarneMexilhao: Gerador = (k) => {
  // carne de mexilhão cozida fora da concha, já sem o anel escuro do manto: oval laranja com o pé claro
  const L = k.T, W = L * k.L, H = L * k.A;
  const out: Parte[] = [parte(tf(carneMexilhao(L, W, H, k.s, false), [0, H * 0.45, 0]), 'umido', true)];
  const pe = rgb('#e8c49a');
  out.push(parte(tf(elipsoide(L * 0.18, H * 0.25, W * 0.18, (x, y, z) => mul(pe, 0.95 + 0.08 * fbm(x * 600, y * 600, z * 600, k.s)), 6, 10), [-L * 0.22, H * 0.25, W * 0.3]), 'umido'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Amêijoa e ostra na meia concha                                        */
/* ------------------------------------------------------------------ */

const gAmeijoaMeia: Gerador = (k) => {
  const L = k.T, W = L * k.L, D = L * k.A * 0.75, e = L * 0.03;
  const creme = k.c1, risco = k.c2;
  const branco = rgb('#f2eee6'), roxo = rgb('#8a6a9a');
  const larg = (u: number) => Math.sin(PI * clamp(0.04 + 0.96 * u) ** 0.75) ** 0.5;
  const g = valva({
    L, W, D, e, largura: larg, n: 28, m: 48,
    fora: (x, y, z, u, rho) => {
      const ph = Math.atan2(z, x + L / 2);
      let c = mix(mul(creme, 1.05), mul(creme, 0.72), Math.abs(Math.sin(rho * 34)) ** 3 * 0.7);
      const zig = Math.abs(Math.sin(ph * 9 + Math.abs(Math.sin(rho * 20)) * 1.4)) ** 4;
      c = mix(c, mul(risco, 0.8), zig * suave(0.2, 0.5, rho) * 0.7);
      return mul(c, 1 + 0.05 * cintila(x, y, z, 1500, k.s));
    },
    dentro: (x, y, z, u, rho) => {
      let c = mix(branco, mul(branco, 0.92), fbm(x * 300, y * 300, z * 300, k.s) * 0.4);
      c = mix(c, roxo, (1 - suave(0.0, 0.3, u)) * 0.55 + suave(0.85, 1, rho) * 0.3);
      return c;
    },
    relevo: (p, _u, rho, fora) => { if (fora) p.y -= D * 0.04 * Math.abs(Math.sin(rho * 34)) ** 0.5 * suave(0.15, 0.4, rho); },
  });
  const out: Parte[] = [parte(g, 'brilhante', true)];
  // corpo da amêijoa: polpa rosada e o pé alaranjado, sifão escuro na ponta
  const polpa = k.ci, peC = rgb('#e8a070');
  out.push(parte(tf(elipsoide(L * 0.3, D * 0.45, W * 0.3, (x, y, z) => {
    let c = mix(polpa, peC, suave(0.0, L * 0.2, x) * 0.6);
    c = mix(c, mul(polpa, 0.9), suave(0.2, 0.8, fbm(x * 400, y * 400, z * 400, k.s)) * 0.3);
    return c;
  }, 10, 16, (t, a) => 1 + 0.05 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, k.s)), [L * 0.04, e + D * 0.5, 0]), 'umido'));
  out.push(parte(tf(elipsoide(L * 0.06, D * 0.18, L * 0.05, () => rgb('#8a6458'), 5, 8), [-L * 0.2, e + D * 0.62, -W * 0.06]), 'umido'));
  return out;
};

const gOstraMeia: Gerador = (k) => {
  // ostra aberta na concha funda de baixo: casca áspera em lâminas, nácar branco, corpo cinza-creme
  // franjado pelo manto escuro
  const L = k.T, W = L * k.L, D = L * 0.23, e = L * 0.04;
  const larg = (u: number) => (0.25 + 0.85 * Math.sin(PI * clamp(0.03 + 0.75 * u)) ** 0.7) * (1 + 0.07 * ruido(u * 6, 0.3, 0.7, k.s));
  const pardo = k.c1, verde = k.c2, giz = k.c3;
  const nacar = rgb('#e6e2dc'), margem = rgb('#5a4a5a'), cicatriz = rgb('#5a3a5a');
  const g = valva({
    L, W, D, e, largura: larg, n: 30, m: 52,
    fora: (x, y, z, _u, rho) => {
      const n1 = fbm(x * 90, y * 90, z * 90, k.s);
      let c = mix(pardo, verde, suave(-0.3, 0.5, n1));
      c = mix(c, giz, suave(0.2, 0.7, fbm(x * 220, y * 220, z * 220, k.s + 2)) * 0.5);
      c = mix(c, mul(c, 0.6), Math.abs(Math.sin(rho * 16 + n1 * 2)) ** 4 * 0.5);
      c = mix(c, rgb('#6a5a6a'), suave(0.7, 1, rho) * 0.25);
      return c;
    },
    dentro: (x, y, z, u, rho) => {
      let c = mix(nacar, rgb('#e2e2ea'), suave(0.0, 0.8, fbm(x * 200, y * 200, z * 200, k.s)) * 0.5);
      c = mix(c, margem, suave(0.72, 0.95, rho) * 0.75);
      c = mix(c, rgb('#b8b0bc'), suave(0.4, 0.75, rho) * 0.35);
      c = mix(c, cicatriz, (1 - suave(0.04, 0.09, Math.hypot(u - 0.62, z / W - 0.12) * 0.5)) * 0.8);
      return c;
    },
    relevo: (p, u, rho, fora) => {
      if (fora) {
        // lâminas de crescimento e caroços da casca
        p.y -= D * 0.18 * Math.abs(Math.sin(rho * 14 + fbm(p.x * 40, 0, p.z * 40, k.s) * 2)) ** 0.6 * suave(0.2, 0.6, rho);
        p.y -= D * 0.12 * fbm(p.x * 60, p.y * 60, p.z * 60, k.s + 4);
      }
      // borda recortada e ondulada
      p.y += D * 0.2 * ruido(Math.atan2(p.z, p.x) * 3, 0.5, 0.2, k.s + 8) * suave(0.8, 1, rho);
      const j = 1 + 0.05 * ruido(u * 20, rho * 3, 0.5, k.s + 6) * suave(0.85, 1, rho);
      p.x *= j;
      p.z *= j;
    },
  });
  const out: Parte[] = [parte(g, 'fosco', true)];
  const corpoC = k.ci, manto = rgb('#3a3632');
  out.push(parte(tf(elipsoide(L * 0.33, D * 0.3, W * 0.31, (x, y, z) => {
    const d = Math.hypot(x / (L * 0.33), z / (W * 0.31));
    let c = mix(corpoC, mul(corpoC, 0.85), suave(0.0, 0.7, fbm(x * 260, y * 260, z * 260, k.s)) * 0.5);
    c = mix(c, rgb('#8a8678'), Math.abs(Math.sin(x * 500 + z * 200)) ** 8 * 0.35 * suave(0.3, 0.6, d));
    return mix(c, manto, suave(0.55, 0.78, d) * 0.9 * (0.7 + 0.3 * Math.sin(Math.atan2(z, x) * 22)));
  }, 14, 24, (t, a) => 1 + 0.09 * Math.sin(t * 46 + a * 3) * (1 - Math.abs(Math.cos(a))) ** 2 + 0.06 * fbm(t * 5, Math.cos(a) * 2, Math.sin(a) * 2, k.s)), [L * 0.06, D * 0.48, W * 0.02]), 'umido'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Vieira, búzio e salicórnia                                            */
/* ------------------------------------------------------------------ */

const gVieiraLimpa: Gerador = (k) => {
  // músculo branco de vieira em cilindro baixo, fibras em pé, com o coral alaranjado preso ao lado
  const R = k.T * 0.36, H = R * 1.1;
  const branco = k.c1;
  const cor: CorFn = (x, y, z, _t, a) => {
    let c = mix(branco, k.ci, suave(-0.2, 0.7, fbm(x * 120, y * 120, z * 120, k.s)) * 0.35);
    c = mix(c, mul(branco, 0.88), Math.abs(Math.sin(a * 38 + fbm(x * 90, y * 90, z * 90, k.s) * 2)) ** 5 * 0.4 * suave(H * 0.9, H * 0.7, y));
    return mul(c, 1 + 0.03 * cintila(x, y, z, 1200, k.s));
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.9, 0], [R, H * 0.12], [R * 1.02, H * 0.5], [R, H * 0.88], [R * 0.9, H], [R * 0.4, H * 1.03], [0, H * 1.04]],
    n: 26, m: 48, cor,
    mod: (t, a) => 1 + 0.025 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, k.s) + 0.012 * Math.sin(a * 38),
  }), 'umido', true)];
  const laranja = k.c2, creme = k.c3;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10, ph = lerp(-1.1, 1.0, f);
    const rr = R + R * 0.25 + R * 0.2 * Math.sin(PI * f);
    pts.push(V(Math.cos(ph) * rr, R * 0.32 + R * 0.06 * Math.sin(PI * f), Math.sin(ph) * rr));
  }
  out.push(parte(tubo(pts, {
    raio: (t) => R * 0.32 * Math.sin(PI * clamp(0.04 + 0.92 * t)) ** 0.55 + R * 0.04, achata: 1.35, m: 14, n: 30, cima: V(0, 1, 0),
    cor: (x, y, z, t) => mul(mix(laranja, creme, suave(0.62, 0.8, t)), 0.95 + 0.08 * fbm(x * 300, y * 300, z * 300, k.s)),
  }), 'umido'));
  return out;
};

const gBuzioCozido: Gerador = (k) => {
  // búzio cozido tirado da concha: pé musculoso claro com o opérculo córneo por cima da ponta,
  // e a massa das vísceras enrolada em espiral, escura, saindo por trás
  const L = k.T * 0.78, Hp = L * 0.36, Wp = L * 0.5;
  const carne = k.c1, pinta = k.c2, visc = k.c3;
  const corPe: CorFn = (x, y, z) => {
    let c = mix(carne, pinta, suave(0.15, 0.75, fbm(x * 220, y * 220, z * 220, k.s)) * 0.45);
    c = mix(c, mul(carne, 1.08), suave(Hp * 0.3, 0, y) * 0.4);
    return mul(c, 1 + 0.05 * cintila(x, y, z, 1000, k.s));
  };
  const x0 = -k.T / 2;
  const out: Parte[] = [parte(corpo({
    x0, x1: x0 + L, n: 22, m: 24, cor: corPe,
    perfil: (t) => { const e = Math.sin(PI * clamp(0.05 + 0.9 * t)) ** 0.55; return { ry: (Hp / 2) * e, rz: (Wp / 2) * e * (1 - 0.2 * t), cy: (Hp / 2) * e, cz: L * 0.06 * Math.sin(PI * t) }; },
    mod: (t, a) => 1 + 0.06 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, k.s),
    desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
  }), 'umido', true)];
  // opérculo deitado sobre a frente do pé
  const op = elipsoide(L * 0.2, L * 0.03, L * 0.15, (x, y, z) => mix(rgb('#4a2e16'), rgb('#8a6436'), Math.abs(Math.sin(Math.hypot(x + L * 0.08, z) * 700)) ** 2 * 0.6), 6, 12);
  op.rotateZ(-0.25);
  out.push(parte(op.translate(x0 + L * 0.7, Hp * 0.92, L * 0.04), 'brilhante'));
  // espiral das vísceras: começa no dorso de trás e se enrola para cima e para fora
  const pts: THREE.Vector3[] = [];
  const N = 30, voltas = 1.7, Rs = L * 0.26;
  for (let i = 0; i <= N; i++) {
    const f = i / N, th = f * voltas * TAU;
    const rr = Rs * (1 - 0.72 * f);
    pts.push(V(x0 + L * 0.3 - Math.sin(th) * rr, Hp * 0.75 + Rs * 0.9 - Math.cos(th) * rr * 0.9 + f * L * 0.05, -L * 0.05 + f * L * 0.22));
  }
  out.push(parte(tubo(pts, {
    raio: (t) => L * 0.16 * (1 - 0.82 * t) + L * 0.02, m: 12, n: 70,
    cor: (x, y, z, t) => mul(mix(mix(carne, pinta, 0.4), visc, suave(0.05, 0.4, t)), 0.95 + 0.1 * fbm(x * 300, y * 300, z * 300, k.s + 1)),
  }), 'umido'));
  return out;
};

const gSalicornia: Gerador = (k) => {
  // raminhos de salicórnia escaldada: hastes suculentas em gomos, verde vivo e brilhante
  const L = k.T;
  const verde = k.c1, ponta = k.c2;
  const out: Parte[] = [];
  const haste = (pts: THREE.Vector3[], r: number, gomos: number, s: number): THREE.BufferGeometry => tubo(pts, {
    raio: (t) => r * (0.82 + 0.22 * Math.abs(Math.sin(t * PI * gomos)) ** 0.35) * (1 - 0.3 * t),
    m: 7, n: gomos * 5,
    cor: (x, y, z, t) => {
      const junta = (1 - Math.abs(Math.sin(t * PI * gomos))) ** 8;
      return mul(mix(mix(verde, ponta, suave(0.8, 1, t) * 0.6), mul(verde, 0.65), junta * 0.6), 0.95 + 0.08 * fbm(x * 500, y * 500, z * 500, s));
    },
  });
  for (let i = 0; i < 4; i++) {
    const ang = -0.5 + i * 0.33 + k.r.f(-0.1, 0.1);
    const d = V(Math.cos(ang), 0, Math.sin(ang));
    const p0 = V(-L * 0.45, 0.0025, (i - 1.5) * 0.004);
    const comp = L * k.r.f(0.75, 0.95);
    const pts = [p0, p0.clone().addScaledVector(d, comp * 0.35).add(V(0, 0.002, k.r.f(-0.004, 0.004))), p0.clone().addScaledVector(d, comp * 0.7).add(V(0, 0.0015, k.r.f(-0.006, 0.006))), p0.clone().addScaledVector(d, comp).add(V(0, 0.001, k.r.f(-0.006, 0.006)))];
    out.push(parte(haste(pts, 0.0024, 7, k.s + i), 'brilhante', i === 0));
    // um galhinho lateral
    const c = new THREE.CatmullRomCurve3(pts);
    const q0 = c.getPointAt(0.45);
    const sg = i % 2 ? 1 : -1;
    const dl = V(Math.cos(ang + sg * 0.7), 0, Math.sin(ang + sg * 0.7));
    out.push(parte(haste([q0, q0.clone().addScaledVector(dl, L * 0.15).add(V(0, 0.001, 0)), q0.clone().addScaledVector(dl, L * 0.3)], 0.0018, 4, k.s + 10 + i), 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Lula                                                                  */
/* ------------------------------------------------------------------ */

function corLulaLimpa(base: RGB, s: number): CorFn {
  return (x, y, z) => {
    let c = mix(base, rgb('#f6e8e6'), suave(0.0, 0.8, fbm(x * 160, y * 160, z * 160, s)) * 0.4);
    c = mix(c, rgb('#c8a0b0'), (1 - suave(0.04, 0.1, celula(x * 500, y * 500, z * 500, s))) * 0.25);
    return mul(c, 1 + 0.03 * cintila(x, y, z, 1400, s));
  };
}

const gAneisLula: Gerador = (k) => {
  // anéis da bolsa de lula limpa, crus e brancos, com um feixe de tentáculos ao lado
  const out: Parte[] = [];
  const cor = corLulaLimpa(k.c1, k.s);
  const corDentro = (x: number, y: number, z: number): RGB => mul(cor(x, y, z, 0, 0), 1.04);
  const aneis: [number, number, number, number][] = [[-0.03, -0.012, 1.0, 0], [-0.008, -0.02, 0.95, 0.1], [0.012, -0.006, 0.9, 0], [-0.022, 0.012, 0.85, 0.15], [0.0, 0.016, 0.8, 0]];
  aneis.forEach(([x, z, e, incl], i) => {
    const Ro = 0.0135 * e, Ri = Ro - 0.0024, h = 0.009 * e;
    const g = tornoAnel({
      caminho: [[Ro - 0.0005, 0], [Ro, 0.0006], [Ro, h - 0.0006], [Ro - 0.0005, h], [Ri + 0.0005, h], [Ri, h - 0.0006], [Ri, 0.0006], [Ri + 0.0005, 0]],
      n: 16, m: 26, l: 0.82,
      cor: (px, py, pz) => (Math.hypot(px, pz) < (Ro + Ri) / 2 * 0.95 ? corDentro(px, py, pz) : cor(px, py, pz, 0, 0)),
      mod: (_t, a) => 1 + 0.05 * Math.sin(a * 2 + i) + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, i, k.s),
    });
    g.rotateY(i * 0.8);
    if (incl) g.rotateX(incl);
    g.translate(x, incl ? 0.002 : 0, z);
    out.push(parte(g, 'umido', i === 0));
  });
  // tentáculos: toquinho da cabeça cortada, oito braços curtos e dois tentáculos longos com clava
  const pele = k.c2, pinta = k.c3;
  const corT: CorFn = (x, y, z, t, a) => {
    let c = mix(pele, pinta, (1 - suave(0.3, 0.6, celula(x * 700, y * 700, z * 700, k.s + 3))) * 0.7);
    const vent = (1 - suave(0.25, 0.45, Math.abs(Math.sin(t * PI * 22)))) * suave(-0.2, -0.7, Math.cos(a));
    c = mix(c, rgb('#f2e8e4'), vent * 0.8);
    return c;
  };
  const x0 = 0.03, z0 = 0.002;
  out.push(parte(corpo({ x0: x0 - 0.006, x1: x0 + 0.006, n: 8, m: 14, cor: corT, tampa: true, corTampa: () => rgb('#f0e4e0'), perfil: () => ({ ry: 0.0055, rz: 0.0065, cy: 0.0055 }) }), 'umido'));
  for (let i = 0; i < 10; i++) {
    const tent = i >= 8;
    const ang = tent ? (i === 8 ? -0.25 : 0.3) : -1.0 + (i / 7) * 2.0;
    const len = tent ? 0.06 : 0.03 + 0.008 * Math.sin(i * 1.7);
    const d = V(Math.cos(ang), 0, Math.sin(ang));
    const n = V(-d.z, 0, d.x);
    const p0 = V(x0 + 0.005, 0.004, z0 + Math.sin(ang) * 0.003);
    const cur = (i % 2 ? 1 : -1) * len * 0.15;
    const pts = [p0, p0.clone().addScaledVector(d, len * 0.35).addScaledVector(n, cur * 0.3).setY(0.0025), p0.clone().addScaledVector(d, len * 0.7).addScaledVector(n, cur).setY(0.0018), p0.clone().addScaledVector(d, len).addScaledVector(n, cur * 2.2).setY(0.0015)];
    out.push(parte(tubo(pts, {
      raio: (t) => tent ? 0.0016 * (1 - 0.4 * t) * (1 + 0.8 * suave(0.72, 0.85, t) * suave(1, 0.92, t)) : 0.0026 * (1 - 0.82 * t ** 0.9) + 0.0004,
      m: 6, n: tent ? 20 : 12, achata: 0.85, cima: V(0, 1, 0), cor: corT,
    }), 'umido'));
  }
  return out;
};

const gLulaRecheada: Gerador = (k) => {
  // bolsa de lula limpa, estufada pelo recheio, com a boca franzida presa por um palito
  const L = k.T, R = L * k.L * 0.5;
  const cor = corLulaLimpa(k.c1, k.s);
  const rech = k.c3;
  const g = corpo({
    x0: -L / 2, x1: L / 2 - L * 0.04, n: 40, m: 30,
    cor: (x, y, z, t, a) => mix(cor(x, y, z, t, a), mix(rech, mul(rech, 0.7), suave(0.3, 0.7, celula(x * 900, y * 900, z * 900, k.s))), suave(0.95, 0.99, t)),
    perfil: (t) => {
      const r = R * Math.sin(PI * clamp(0.04 + 0.95 * t) ** 0.6) ** 0.55 * (1 - 0.1 * t);
      return { ry: r * 0.85, rz: r, cy: R * 0.85 };
    },
    mod: (t, a) => 1 + 0.1 * fbm(t * 9, Math.cos(a) * 1.8, Math.sin(a) * 1.8, k.s) + 0.16 * Math.sin(a * 9) * suave(0.86, 0.99, t),
    desloc: (p) => { if (p.y < R * 0.2) p.y = R * 0.2 - (R * 0.2 - p.y) * 0.3; },
  });
  const out: Parte[] = [parte(g, 'umido', true)];
  const xp = L / 2 - L * 0.1;
  out.push(parte(tubo([V(xp, R * 0.95, -R * 0.75), V(xp + L * 0.01, R * 1.05, 0), V(xp + L * 0.02, R * 0.95, R * 0.75)], { raio: 0.0011, m: 6, n: 10, cor: (x, y, z) => mul(rgb('#d8b888'), 0.95 + 0.08 * ruido(x * 2000, y * 2000, z * 2000, k.s)) }), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Caranguejo                                                            */
/* ------------------------------------------------------------------ */

const gCarneCaranguejo: Gerador = (k) => {
  // carne branca em lascas fibrosas (com o rosado das garras) e a carne escura cremosa, em montes separados
  const out: Parte[] = [];
  const branca = k.c1, rosa = k.c2, escura = k.c3;
  for (let i = 0; i < 38; i++) {
    const a = i * 2.399, rr = 0.026 * Math.sqrt((i + 0.5) / 38);
    const alto = (1 - rr / 0.029) * 0.014;
    const L = k.r.f(0.014, 0.026);
    const tinge = k.r.n() < 0.3;
    const dir = k.r.f(0, TAU), curva = k.r.f(-0.004, 0.004);
    const d = V(Math.cos(dir), 0, Math.sin(dir)), nn = V(-d.z, 0, d.x);
    const c0 = V(-0.034 + Math.cos(a) * rr, 0.002 + alto, Math.sin(a) * rr);
    const pts = [c0.clone().addScaledVector(d, -L / 2).add(V(0, -0.0015, 0)), c0.clone().addScaledVector(nn, curva), c0.clone().addScaledVector(d, L / 2).add(V(0, -0.001, 0))];
    const w = k.r.f(0.0014, 0.0024);
    out.push(parte(tubo(pts, {
      raio: (t) => w * (0.6 + 0.4 * Math.sin(PI * t) ** 0.5), achata: 1.6, m: 5, n: 8, cima: V(0, 1, 0),
      cor: (x, y, z, t, ang) => {
        let c = mix(branca, mul(branca, 0.86), Math.abs(Math.sin(ang * 3 + t * 9)) ** 4 * 0.5);
        if (tinge) c = mix(c, rosa, suave(-0.2, 0.8, Math.cos(ang)) * 0.7);
        return mul(c, 0.96 + 0.06 * ruido(x * 2000, y * 2000, z * 2000, k.s + i));
      },
    }), 'acetinado', i === 0));
  }
  const Rb = 0.024, Hb = 0.011;
  out.push(parte(torno({
    caminho: [[0, 0], [Rb * 0.9, 0], [Rb, Hb * 0.2], [Rb * 0.8, Hb * 0.65], [Rb * 0.45, Hb * 0.95], [0, Hb]], n: 20, m: 32,
    cor: (x, y, z) => {
      let c = mix(escura, mul(escura, 0.7), suave(0.0, 0.7, fbm(x * 200, y * 200, z * 200, k.s)) * 0.6);
      c = mix(c, rgb('#d8c08a'), (1 - suave(0.1, 0.3, celula(x * 400, y * 400, z * 400, k.s + 1))) * 0.4);
      return c;
    },
    mod: (t, a) => 1 + 0.16 * fbm(Math.cos(a) * 2.5, Math.sin(a) * 2.5, t * 3, k.s + 2),
    desloc: (p) => { p.y = Math.max(0, p.y + 0.003 * fbm(p.x * 160, 0, p.z * 160, k.s + 3) * suave(0, 0.004, p.y)); },
  }).translate(0.03, 0, 0), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Lagosta cozida, aberta ao meio, e medalhões da cauda                  */
/* ------------------------------------------------------------------ */

const gLagostaCozida: Gerador = (k) => gCrustaceo(k);

const gLagostaMeia: Gerador = (k) => {
  // lagosta cozida cortada ao meio da cabeça à cauda: duas metades deitadas na casca vermelha,
  // carne branca da cauda à mostra, fígado verde e coral na cabeça; carne das garras inteira à frente
  const T = k.T;
  const R = T * 0.085 * (k.L / 0.17);
  const xa1 = -T / 2 + T * 0.42;
  const Yc = R;
  const branca = k.ci, coral = rgb('#b8301e'), figado = rgb('#7a8a3a'), creme = rgb('#e8dcc0'), veio = rgb('#e87058');
  const carne = (x: number, y: number, z: number): RGB => {
    if (x < xa1 + R * 0.1) {
      const rel = Math.abs((y - Yc * 0.85) / (R * 0.75));
      let c = mix(branca, mul(branca, 0.92), Math.abs(Math.sin(x * 900 + y * 400)) ** 6 * 0.4);
      return mix(c, veio, suave(0.8, 1.0, rel) * 0.6);
    }
    const n1 = fbm(x * 120, y * 120, z * 120, k.s);
    let c = mix(creme, figado, suave(-0.2, 0.4, n1));
    c = mix(c, coral, suave(0.35, 0.6, fbm(x * 90, y * 90, z * 90, k.s + 5)) * 0.8);
    return c;
  };
  const partes = gCrustaceo(k).filter((p) => {
    p.g.computeBoundingBox();
    const b = p.g.boundingBox!;
    return Math.max(Math.abs(b.min.z), Math.abs(b.max.z)) < R * 1.35;
  });
  for (const p of partes) {
    const pos = p.g.getAttribute('position') as THREE.BufferAttribute;
    const col = p.g.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z < 0) {
        const c = carne(pos.getX(i), pos.getY(i), z);
        pos.setZ(i, 0);
        col.setXYZ(i, clamp(c[0]), clamp(c[1]), clamp(c[2]));
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    p.g.computeVertexNormals();
  }
  const out: Parte[] = [];
  for (const p of partes) {
    const g2 = espelharZ(p.g.clone());
    p.g.rotateX(PI / 2);
    p.g.translate(0, 0, R * 0.12);
    g2.rotateX(-PI / 2);
    g2.translate(T * 0.03, 0, -R * 0.12);
    out.push(p, parte(g2, p.ac));
  }
  // carne das garras inteira, rosada por cima
  const garra = (L: number, s: number): THREE.BufferGeometry[] => {
    const cor: CorFn = (x, y, z) => mix(mix(branca, mul(branca, 0.9), fbm(x * 300, y * 300, z * 300, s) * 0.5), veio, suave(L * 0.05, L * 0.28, y) * 0.75);
    const corpoG = corpo({ x0: 0, x1: L * 0.62, n: 14, m: 14, cor, perfil: (t) => { const r = L * 0.2 * Math.sin(PI * clamp(0.1 + 0.85 * t)) ** 0.6; return { ry: r * 0.7, rz: r, cy: L * 0.14 }; } });
    const dedo = corpo({ x0: L * 0.5, x1: L, n: 10, m: 10, cor, perfil: (t) => { const r = L * 0.09 * (1 - t) ** 0.7 + L * 0.01; return { ry: r * 0.8, rz: r, cy: L * 0.11, cz: L * 0.05 + L * 0.04 * t }; } });
    return [corpoG, dedo];
  };
  const gs = [...garra(T * 0.2, k.s).map((g) => g.rotateY(0.3).translate(-T * 0.12, 0, R * 3.4)), ...garra(T * 0.16, k.s + 1).map((g) => g.rotateY(-0.2).translate(T * 0.14, 0, R * 3.3))];
  for (const g of gs) out.push(parte(g, 'umido'));
  return out;
};

const gMedalhoesLagosta: Gerador = (k) => {
  // carne da cauda cozida cortada em medalhões regulares, sobrepostos em fila: miolo branco em
  // espiral de fibras, bordinha vermelha da membrana
  const out: Parte[] = [];
  const branca = k.ci, verm = k.c1, laranja = k.c2;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const R = 0.017 - i * 0.0013, H = 0.009;
    const cor: CorFn = (x, y, z) => {
      const rr = Math.hypot(x, z) / R, ang = Math.atan2(z, x);
      const lado = Math.abs(y - H / 2) < H * 0.4 && rr > 0.86;
      const espiral = Math.abs(Math.sin(rr * 7 - ang + fbm(x * 200, 0, z * 200, k.s + i) * 1.2)) ** 6;
      let c = mix(branca, mul(branca, 0.9), espiral * 0.5);
      c = mix(c, mix(laranja, verm, 0.5), suave(0.8, 0.98, rr) * 0.75);
      if (lado) c = mix(verm, mix(laranja, branca, 0.5), suave(0.2, 0.7, fbm(x * 500, y * 500, z * 500, k.s + i)) * 0.5);
      return c;
    };
    const g = disco(R, H, cor, { n: 12, m: 36, mod: (_t, a) => 1 - 0.16 * Math.max(0, Math.cos(a)) ** 2 + 0.02 * Math.sin(a * 5 + i) });
    g.rotateZ(-0.32);
    g.translate(i * 0.019, 0.004 + i * 0.0004, 0);
    out.push(parte(g, 'umido', i === 2));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Camarão descascado (cru, curvo, sem tripa) e camarão reto cozido      */
/* ------------------------------------------------------------------ */

function camarao(k: Ctx, curvo: boolean, cozido: boolean): Parte[] {
  const Lb = 0.085, nseg = 6;
  const R0 = 0.0082;
  const raio = (t: number) => {
    const fs = (t * nseg) % 1;
    return R0 * lerp(1, 0.52, t ** 1.2) * (0.94 + 0.08 * suave(0.0, 0.85, fs) - 0.05 * suave(0.85, 1, fs));
  };
  const pts: THREE.Vector3[] = [];
  const Ra = Lb / (PI * 1.15);
  for (let i = 0; i <= 14; i++) {
    const s = i / 14;
    const ry = R0 * lerp(1, 0.52, s ** 1.2);
    if (curvo) {
      const ph = lerp(0.1 * PI, 1.25 * PI, s);
      pts.push(V(Ra * Math.cos(ph), ry, Ra * Math.sin(ph)));
    } else pts.push(V(lerp(-Lb / 2, Lb / 2, s), ry, -0.005 * Math.sin(PI * s)));
  }
  const cru = k.c1, cruV = k.c2;
  const branco = k.ci, verm = k.cc;
  const cor: CorFn = (x, y, z, t, a) => {
    const fs = (t * nseg) % 1;
    const dorso = cozido ? suave(0.92, 0.35, Math.sin(a)) : suave(0.75, -0.2, Math.sin(a));
    const n1 = fbm(x * 250, y * 250, z * 250, k.s);
    let c: RGB;
    if (cozido) {
      c = mix(branco, verm, dorso * (0.72 + 0.28 * suave(0.55, 0.05, fs)));
      c = mix(c, mul(verm, 0.8), suave(0.84, 0.98, fs) * dorso * 0.7);
      c = mix(c, rgb('#fbe8dc'), suave(0.3, 0.45, fs) * suave(0.62, 0.48, fs) * dorso * 0.35);
      c = mul(c, 1 + 0.05 * n1);
    } else {
      c = mix(cru, cruV, suave(-0.3, 0.6, n1) * 0.3 + dorso * suave(0.6, 0.1, fs) * 0.75);
      c = mix(c, rgb('#e8d4d0'), (1 - dorso) * 0.45);
      c = mix(c, mul(cruV, 0.7), suave(0.86, 0.98, fs) * 0.6);
      // corte raso do dorso onde saiu a tripa
      c = mix(c, rgb('#ead2c8'), suave(-0.86, -0.97, Math.sin(a)) * 0.8);
    }
    return mul(c, 1 + 0.04 * cintila(x, y, z, 1200, k.s));
  };
  const out: Parte[] = [parte(tubo(pts, {
    raio, achata: 1.28, m: 20, n: 60, cima: V(0, 1, 0), cor,
    mod: cozido ? undefined : (_t, a) => 1 - 0.16 * suave(-0.86, -0.98, Math.sin(a)),
  }), cozido ? 'acetinado' : 'umido', true)];
  // leque da cauda com a casca deixada
  const c = new THREE.CatmullRomCurve3(pts);
  const pf = c.getPointAt(1), tg = c.getTangentAt(1).setY(0).normalize();
  const up = V(0, 1, 0);
  const corLeque = cozido ? verm : mix(cru, rgb('#6a7c8a'), 0.4);
  const ponta = cozido ? mul(verm, 0.7) : rgb('#7a3a4a');
  const leque = (ang: number, L: number, W: number) => {
    const dir = tg.clone().applyAxisAngle(up, ang);
    const lat = new THREE.Vector3().crossVectors(dir, up).normalize();
    return lamina({
      ns: 6, nr: 6,
      P: (sR, r) => pf.clone().addScaledVector(dir, L * r).addScaledVector(lat, (sR - 0.5) * W * Math.sin(PI * clamp(0.1 + 0.85 * r)) ** 0.6).setY(pf.y * (1 - 0.6 * r) + 0.0006),
      N: () => up,
      esp: (_s, r) => 0.0016 * (1 - r) + 0.0005,
      cor: (sR, r) => mix(corLeque, ponta, suave(0.65, 1, r) * 0.8 + 0.1 * Math.abs(Math.sin(sR * 20))),
    });
  };
  out.push(parte(leque(0, 0.016, 0.006), 'brilhante'));
  for (const sg of [-1, 1]) { out.push(parte(leque(sg * 0.38, 0.015, 0.008), 'brilhante')); out.push(parte(leque(sg * 0.7, 0.013, 0.007), 'brilhante')); }
  return out;
}

const gCamaraoDescascado: Gerador = (k) => camarao(k, true, false);
const gCamaraoReto: Gerador = (k) => camarao(k, false, true);

/* ------------------------------------------------------------------ */
/* Lote                                                                  */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'lagosta-inteira-cozida': { visual: { f: 'crustaceo', v: 'lagosta', t: 0.35, l: 0.17, c1: '#c8361c', c2: '#e8783a', ci: '#f6f0e8', cc: '#c8361c' }, gerar: gLagostaCozida },
  'lagosta-meia-casca': { visual: { f: 'crustaceo', v: 'lagosta', t: 0.35, l: 0.17, c1: '#c8361c', c2: '#e8783a', ci: '#f6f0e8', cc: '#d8483a' }, gerar: gLagostaMeia },
  'medalhoes-lagosta': { visual: { f: 'crustaceo', v: 'medalhoes', t: 0.13, a: 0.12, l: 0.27, c1: '#c8361c', c2: '#e8783a', ci: '#f6f0e8', cc: '#f2e4dc' }, gerar: gMedalhoesLagosta },
  'camarao-descascado': { visual: { f: 'crustaceo', v: 'camarao-limpo', t: 0.055, a: 0.3, l: 1, c1: '#c4b6b0', c2: '#8e9aa8', ci: '#f6e6dc', cc: '#e8603a' }, gerar: gCamaraoDescascado },
  'camarao-reto-cozido': { visual: { f: 'crustaceo', v: 'camarao-reto', t: 0.1, a: 0.16, l: 0.25, c1: '#c4b6b0', c2: '#8e9aa8', ci: '#f6dcd0', cc: '#e04a22' }, gerar: gCamaraoReto },
  'mexilhao-aberto': { visual: { f: 'bivalve', v: 'mexilhao-aberto', t: 0.07, a: 0.5, l: 0.8, c1: '#141824', c2: '#2c3a5c', c3: '#e8843a', ci: '#e8843a', cc: '#1e2434', ac: 'brilhante' }, gerar: gMexilhaoAberto },
  'mexilhao-gratinado': { visual: { f: 'bivalve', v: 'mexilhao-gratinado', t: 0.07, a: 0.3, l: 0.5, c1: '#141824', c2: '#2c3a5c', c3: '#4e6e22', ci: '#e8843a', cc: '#1e2434', ac: 'brilhante' }, gerar: gMexilhaoGratinado },
  'carne-mexilhao': { visual: { f: 'bivalve', v: 'carne-mexilhao', t: 0.035, a: 0.3, l: 0.6, c1: '#e8843a', c2: '#f2a660', ci: '#e8843a', cc: '#e8843a', ac: 'umido' }, gerar: gCarneMexilhao },
  'ameijoa-meia-concha': { visual: { f: 'bivalve', v: 'ameijoa-meia', t: 0.05, a: 0.32, l: 0.9, c1: '#d8c4a0', c2: '#7a5a3a', ci: '#ecc8b0', cc: '#d8c4a0' }, gerar: gAmeijoaMeia },
  'ostra-meia-concha': { visual: { f: 'bivalve', v: 'ostra-meia', t: 0.095, a: 0.3, l: 0.68, c1: '#8a8070', c2: '#6a7058', c3: '#c8c4b8', ci: '#d8ccb0', cc: '#9a9080', ac: 'fosco' }, gerar: gOstraMeia },
  'vieira-limpa': { visual: { f: 'bivalve', v: 'vieira-limpa', t: 0.07, a: 0.5, l: 1, c1: '#f4ecdc', c2: '#f06a2a', c3: '#f0e0c0', ci: '#f0d8d0', cc: '#f2e6d4', ac: 'umido' }, gerar: gVieiraLimpa },
  'buzio-cozido': { visual: { f: 'concha_espiral', v: 'buzio-cozido', t: 0.045, a: 1, l: 1, c1: '#d6c09a', c2: '#7a6a52', c3: '#5a5a32', ci: '#d8c8a8', cc: '#d0bf9c', ac: 'umido' }, gerar: gBuzioCozido },
  salicornia: { visual: { f: 'erva', v: 'salicornia', t: 0.065, a: 0.1, l: 0.5, c1: '#4f9a2a', c2: '#8a9a3a', ci: '#6ab03a', cc: '#5aa02e', ac: 'brilhante' }, gerar: gSalicornia },
  'aneis-lula': { visual: { f: 'cefalopode', v: 'aneis', t: 0.1, a: 0.12, l: 0.7, c1: '#f4eee8', c2: '#e6cdd2', c3: '#8a4a6a', ci: '#f4eee8', cc: '#f6eee2', ac: 'umido' }, gerar: gAneisLula },
  'lula-recheada': { visual: { f: 'cefalopode', v: 'lula-recheada', t: 0.15, a: 0.3, l: 0.3, c1: '#f2ece6', c2: '#e6cdd2', c3: '#9a5a3a', ci: '#f4eee8', cc: '#f0e6da', ac: 'umido' }, gerar: gLulaRecheada },
  'carne-caranguejo': { visual: { f: 'crustaceo', v: 'carne-caranguejo', t: 0.11, a: 0.25, l: 0.6, c1: '#f6f0e6', c2: '#e88a6a', c3: '#9a7040', ci: '#f6f0e6', cc: '#f2e8da' }, gerar: gCarneCaranguejo },
};
