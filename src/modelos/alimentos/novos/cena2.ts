// Alimentos novos pedidos pela ficha de cena (cena2): formas intermediárias e pratos prontos das
// técnicas de frutos do mar, aves, carnes, decoração e legumes. Concassée, gomos de limão e de maçã,
// ostras na cama de gelo, aves trinchadas, bardeadas, laqueadas e em porções, leques de fatias
// (magret, alcatra, cordeiro, fígado, peru), cortes com osso aparente (costela, carré, coroa, guarda
// de honra, sela, costeleta, pernil, costelinha, ossobuco, rabada), filé mignon cru, dourado, com
// cordão e amarrado, mantas recheadas, filé em massa, embalagens, guarnições de pimentão e pepino,
// feixe de vagem, buquês de brócolis e couve-flor, quartos de repolho e espinafre refogado.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, tf, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, osso, type Ctx, type Familia, type Visual } from '../pecas';
import { gAve, pecaCostelas, placaCostelas } from '../fam_carnes';
import { OSSO, BARBANTE, MADEIRA, fr, chapa, placa, noDisco, fio, laco, no, corAssada, corFibra, rodela, ctxCom, espetoMadeira } from './aves';
import { grade, orientar, bloco, prisma, chapa as chapaL } from './frutas_enfeites';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* ferramentas                                                          */
/* ------------------------------------------------------------------ */

/** Linha visual curta: cores na ordem "casca segunda interna cozida terceira". */
function vis(f: Familia, v: string, t: number, cores: string, x: Partial<Visual> = {}): Visual {
  const [c1, c2, ci, cc, c3] = cores.split(' ').map((h) => (h === '-' || h === undefined ? undefined : '#' + h));
  return { f, v, t, c1: c1!, c2, ci: ci!, cc: cc!, c3, ...x };
}

const tn = (c: RGB, amp: number, f: number, s = 0): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));
const C = (h: string) => rgb(h);
type Face = (xd: number, zd: number, r: number, x: number, y: number, z: number) => RGB;

/**
 * Fatia ou placa deitada de contorno oval (superelipse `exp`), comprimento L em X, largura W em Z
 * e espessura e. A cor recebe as coordenadas do disco (xd, zd), o raio relativo r e a posição.
 */
function fatia(L: number, W: number, e: number, face: Face, o: { exp?: number; nx?: number; nz?: number; irreg?: number; s?: number; alto?: (xd: number, zd: number, r: number) => number } = {}): THREE.BufferGeometry {
  const ex = o.exp ?? 2.6, irr = o.irreg ?? 0.05, s = o.s ?? 0;
  return placa(o.nx ?? 10, o.nz ?? 8, (xd, zd) => {
    const a = Math.atan2(zd, xd), r = Math.hypot(xd, zd);
    const ca = Math.cos(a), sa = Math.sin(a);
    const k = (Math.abs(ca) ** ex + Math.abs(sa) ** ex) ** (-1 / ex);
    const q = r * Math.min(1.25, k) * (1 + irr * fbm(Math.cos(a) * 2, Math.sin(a) * 2, s, s));
    return [ca * q * L / 2, sa * q * W / 2];
  }, o.alto ?? ((xd, zd, r) => e * (1 - 0.35 * r ** 6)), (x, y, z, u, v) => {
    const [xd, zd] = noDisco(u, v);
    return face(xd, zd, Math.min(1, Math.hypot(xd, zd)), x, y, z);
  }, (xd, zd, r) => e * 0.12 * r ** 6);
}

/** Gomo: setor de elipsoide ao longo de X (semi-eixos rx, ry, rz), abertura `ab` em volta de X, casca para baixo. */
function gomo(rx: number, ry: number, rz: number, ab: number, casca: CorFn, face: (x: number, y: number, z: number, rho: number, th: number) => RGB, o: { nu?: number; nv?: number; ponta?: number; sulco?: (th: number, rho: number) => number } = {}): THREE.BufferGeometry[] {
  const nu = o.nu ?? 14, nv = o.nv ?? 6, pe = o.ponta ?? 1;
  const S = (th: number) => Math.sin(th) ** pe;
  const out = grade(nu, nv, (u, v) => {
    const th = u * PI, ph = (v - 0.5) * ab;
    return [-rx * Math.cos(th), -ry * S(th) * Math.cos(ph), rz * S(th) * Math.sin(ph)];
  }, casca);
  const faces: THREE.BufferGeometry[] = [out];
  for (const sg of [-1, 1]) {
    const ph = sg * ab / 2;
    const n = V(0, Math.sin(ph) * sg, Math.cos(ph) * sg);
    faces.push(grade(nu, 5, (u, v) => {
      const th = u * PI, rho = v;
      const p = V(-rx * Math.cos(th), -ry * S(th) * Math.cos(ph) * rho, rz * S(th) * Math.sin(ph) * rho);
      if (o.sulco) p.addScaledVector(n, -o.sulco(u, rho));
      return [p.x, p.y, p.z];
    }, (x, y, z, u, v) => face(x, y, z, v, u)));
  }
  const ref = V(0, -ry * 0.45, 0);
  return faces.map((g) => orientar(g, ref));
}

/** Leque: n cópias de uma fatia, cada uma girada e afastada, levemente sobrepostas. */
function leque(n: number, fazer: (i: number) => THREE.BufferGeometry, o: { passo: number; giro: number; ergue: number; inclina?: number; raio?: number }): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const g = fazer(i);
    const q = i - (n - 1) / 2;
    tf(g, [0, 0, 0], [0, 0, -(o.inclina ?? 0.1)]);
    if (o.raio) {
      tf(g, [o.raio, 0, 0]);
      tf(g, [0, i * o.ergue, 0], [0, q * o.giro, 0]);
      tf(g, [-o.raio, 0, 0]);
    } else tf(g, [q * o.passo, i * o.ergue, 0], [0, q * o.giro, 0]);
    out.push(g);
  }
  return out;
}

/** Faixa achatada ao longo de pontos (tira de bacon, de pimentão, de casca), com a largura no eixo `cima`. */
function faixa(pts: THREE.Vector3[], larg: number, esp: number, cor: CorFn, cima = V(0, 1, 0), n?: number): THREE.BufferGeometry {
  return tubo(pts, { raio: larg / 2, achata: esp / larg, cima, m: 8, n: n ?? Math.max(8, pts.length * 4), cor, pontaRedonda: false });
}

/** Superfície de carne crua com fibras e película aqui e ali. */
function carneCrua(base: RGB, s: number, membrana = 0.2, esc = 0.004): CorFn {
  const fib = corFibra(base, s, esc, [0, 0.4, 1]);
  return (x, y, z, t, a) => mix(fib(x, y, z, t, a), C('#e2ddd6'), suave(0.45, 0.85, fbm(x * 18, y * 50, z * 50, s + 7)) * membrana);
}

/** Gordura branca cremosa com leve variação. */
const gordura = (s: number, base = '#f2e8d6'): CorFn => (x, y, z) => mul(mix(C(base), C('#e8d4b4'), 0.3 + 0.3 * fbm(x * 60, y * 60, z * 60, s)), 1 + 0.04 * ruido(x * 300, y * 300, z * 300, s));

/** Marcas de grelha: listras diagonais escuras sobre uma cor. */
function grelha(base: CorFn, passo: number, ang: number, escuro: RGB, larg = 0.22): CorFn {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return (x, y, z, t, a) => {
    const f = fr((x * ca + z * sa) / passo);
    const m = 1 - suave(larg * 0.5, larg, Math.abs(f - 0.5) * 2 - (1 - larg * 2));
    const q = Math.abs(f - 0.5) * 2;
    const linha = suave(1 - larg, 1 - larg * 0.4, q);
    void m;
    return mix(base(x, y, z, t, a), mul(escuro, 0.85 + 0.3 * ruido(x * 400, y * 400, z * 400, 3)), linha * 0.9);
  };
}

/** Raminho de tomilho: caule fino com folhinhas. */
function tomilho(p: THREE.Vector3, L: number, ang: number, r: { f: (a: number, b: number) => number }): THREE.BufferGeometry[] {
  const verde = C('#4a6a2a');
  const out: THREE.BufferGeometry[] = [];
  const d = V(Math.cos(ang), 0, Math.sin(ang));
  const q = p.clone().addScaledVector(d, L);
  out.push(tubo([p, p.clone().addScaledVector(d, L / 2).add(V(0, L * 0.05, 0)), q], { raio: L * 0.012, m: 4, n: 6, cor: () => C('#6a5a3a') }));
  for (let i = 0; i < 6; i++) {
    const c = p.clone().addScaledVector(d, L * (0.25 + 0.12 * i));
    out.push(tf(elipsoide(L * 0.05, L * 0.018, L * 0.028, () => mul(verde, r.f(0.85, 1.15)), 3, 5), [c.x, c.y + L * 0.03, c.z + (i % 2 ? 1 : -1) * L * 0.035], [0, -ang + (i % 2 ? 0.6 : -0.6), 0]));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* concassée, gomos, ostras na cama de gelo                             */
/* ------------------------------------------------------------------ */

/** Concassée de tomate: montinho de cubinhos de polpa sem pele e sem semente. */
function gConcassee(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const polpa = (x: number, y: number, z: number): RGB => {
    const veio = suave(0.6, 0.95, Math.abs(fbm(x * 260, y * 260, z * 260, k.s)));
    return mul(mix(k.c1, k.c2, veio * 0.5), 0.9 + 0.16 * fbm(x * 500, y * 500, z * 500, k.s + 3));
  };
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.95, 0], [R * 0.85, H * 0.25], [R * 0.5, H * 0.62], [0, H * 0.7]], n: 12, m: 18, cor: (x, y, z) => mul(polpa(x, y, z), 0.8), mod: (t, a) => 1 + 0.08 * ruido(Math.cos(a) * 3, t * 4, Math.sin(a) * 3, k.s) }), 'brilhante', true));
  const n = 46;
  for (let i = 0; i < n; i++) {
    const a = k.r.f(0, TAU), rr = R * 0.9 * Math.sqrt(k.r.n());
    const topo = H * 0.7 * (1 - (rr / R) ** 2);
    const lado = k.T * k.r.f(0.09, 0.13);
    const g = bloco(lado, lado * k.r.f(0.75, 1), lado * k.r.f(0.85, 1.1), (x, y, z) => polpa(x + i * 0.01, y, z + i * 0.007));
    tf(g, [Math.cos(a) * rr, Math.max(lado * 0.45, topo * k.r.f(0.55, 1.05)), Math.sin(a) * rr], [k.r.f(-0.6, 0.6), k.r.f(0, TAU), k.r.f(-0.6, 0.6)]);
    out.push(parte(g, 'brilhante'));
  }
  return out;
}

/** Casca de cítrico com poros. */
function cascaCitrico(base: RGB, s: number, f = 900): CorFn {
  return (x, y, z) => {
    const poro = 1 - suave(0.12, 0.3, celula(x * f, y * f, z * f, s));
    return mul(mix(base, mul(base, 0.85), suave(0.2, 0.9, fbm(x * 60, y * 60, z * 60, s))), 1 - 0.12 * poro);
  };
}

/** Gomo de limão: um sexto do fruto, casca para baixo, polpa com os gomos e o albedo à mostra. */
function gomoLimao(k: Ctx, rx: number, ry: number): THREE.BufferGeometry[] {
  const casca = cascaCitrico(k.c1, k.s);
  return gomo(rx, ry, ry, PI / 3, casca, (x, y, z, rho) => {
    if (rho > 0.9) return mul(k.c1, 0.98);
    if (rho > 0.8) return mul(C('#f6f0d4'), 0.98 + 0.03 * ruido(x * 800, y * 800, z * 800, k.s));
    // vesículas de suco alongadas e as membranas entre os gomos
    const ves = 0.88 + 0.2 * Math.abs(Math.sin(x * 900 + fbm(y * 300, z * 300, x * 50, k.s) * 4));
    const membr = suave(0.86, 0.96, Math.abs(fr(rho * 2.3 + 0.2 * fbm(x * 80, 0, 0, k.s)) - 0.5) * 2);
    const meio = 1 - suave(0.05, 0.12, rho);
    return mix(mix(mul(k.ci, ves), C('#f4f0dc'), membr * 0.6), C('#f8f4e4'), meio);
  }, { nu: 14, nv: 6, ponta: 0.8 });
}

const gLimaoGomo = (k: Ctx): Parte[] => gomoLimao(k, k.T / 2, k.T * 0.37).map((g, i) => parte(tf(g, [0, 0, 0], [PI / 2 - PI / 6, 0, 0]), i ? 'umido' : 'acetinado', i === 0));

/** Meia concha de ostra com a carne, para a cama de gelo. */
function ostraNaConcha(k: Ctx, L: number, s: number): Parte[] {
  const out: Parte[] = [];
  const W = L * 0.7;
  const fora = C('#8a8070'), nacar = C('#e4e0d6');
  const cup = (r: number) => 0.012 * (L / 0.09) * r * r;
  out.push(parte(fatia(L, W, 0.003, (xd, zd, r, x, y, z) => {
    const anel = Math.abs(Math.sin(r * 30 + fbm(x * 90, z * 90, 0, s) * 3));
    const dentro = 1 - suave(0.72, 0.92, r);
    const c = mix(mul(fora, 0.8 + 0.3 * anel), mix(nacar, C('#c8c4d0'), 0.3 * fbm(x * 200, y * 200, z * 200, s)), dentro);
    return mul(c, 1 + 0.08 * ruido(x * 600, y * 600, z * 600, s));
  }, { exp: 2, irreg: 0.18, s, nx: 12, nz: 10, alto: (xd, zd, r) => cup(r) + 0.0015 + 0.0025 * suave(0.85, 1, r) * fbm(xd * 6, zd * 6, s, s) }), 'acetinado'));
  // carne: corpo bege acinzentado com o manto escuro franjado na borda
  const carne = elipsoide(L * 0.36, 0.0055, W * 0.32, (x, y, z) => {
    const r = Math.hypot(x / (L * 0.36), z / (W * 0.32));
    const franja = suave(0.72, 0.9, r) * (0.6 + 0.4 * Math.abs(Math.sin(Math.atan2(z, x) * 22)));
    return mix(mix(C('#d8ccb0'), C('#c0b49a'), fbm(x * 200, y * 200, z * 200, s) * 0.5 + 0.3), C('#4a463e'), franja * 0.75);
  }, 8, 12, (t, a) => 1 + 0.06 * Math.sin(a * 9 + t * 7));
  tf(carne, [L * 0.04, 0.006, 0]);
  out.push(parte(carne, 'umido'));
  return out;
}

/** Ostras na meia concha sobre cama de gelo picado, com gomos de limão. */
function gOstrasGelo(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = 0.018;
  const gelo: CorFn = (x, y, z) => {
    const c = celula(x * 180, y * 180, z * 180, k.s);
    return mix(C('#f4f8fa'), C('#c4d6e0'), suave(0.2, 0.9, c) * 0.7 + 0.1 * ruido(x * 500, y * 500, z * 500, k.s));
  };
  out.push(parte(fatia(L, W, H, (xd, zd, r, x, y, z) => gelo(x, y, z, 0, 0), {
    exp: 2.2, irreg: 0.1, nx: 18, nz: 14, s: k.s,
    alto: (xd, zd, r) => H * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - r * r))) + 0.004 * (1 - celula(xd * 9, zd * 9, 0, k.s)),
  }), 'brilhante', true));
  for (let i = 0; i < 34; i++) {
    const a = k.r.f(0, TAU), rr = k.r.f(0.1, 0.95);
    const x = Math.cos(a) * rr * L * 0.46, z = Math.sin(a) * rr * W * 0.46;
    const lado = k.r.f(0.005, 0.011);
    const g = bloco(lado, lado * k.r.f(0.6, 1), lado * k.r.f(0.7, 1.2), gelo);
    tf(g, [x, H * (0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - rr * rr))) + lado * 0.2, z], [k.r.f(0, 3), k.r.f(0, 3), k.r.f(0, 3)]);
    out.push(parte(g, 'brilhante'));
  }
  const Lo = L * 0.36;
  const lugares: [number, number, number][] = [[-L * 0.2, -W * 0.18, 0.4], [L * 0.2, -W * 0.16, -0.5], [0, W * 0.2, 1.6]];
  lugares.forEach(([x, z, rot], i) => {
    for (const p of ostraNaConcha(k, Lo * (0.95 + 0.08 * i), k.s + i * 13)) {
      tf(p.g, [x, H * 0.95, z], [0.05 * (i - 1), rot, 0]);
      out.push(p);
    }
  });
  const kl = ctxCom(k, { c1: '#e8d830', ci: '#f4ecb0' }, { c1: C('#e8d830'), ci: C('#f4ecb0') });
  for (const [x, z, rot] of [[-L * 0.3, W * 0.22, 0.8], [L * 0.31, W * 0.16, -0.7]] as [number, number, number][]) {
    gomoLimao(kl, 0.03, 0.022).forEach((g, i) => {
      tf(g, [x, H * 0.75 + 0.022, z], [0, rot, 0]);
      out.push(parte(g, i ? 'umido' : 'acetinado'));
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* aves: trinchadas, bardeadas, laqueadas, em porções e em fatias       */
/* ------------------------------------------------------------------ */

const DOURADO = C('#c08038'), TOSTADO = C('#7a4218');

/** Coxa e sobrecoxa assadas: bojo da sobrecoxa e baqueta afinando até a junta. */
function pernaAssada(L: number, pele: CorFn, s: number, osso_ = true): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  out.push(tf(elipsoide(L * 0.3, L * 0.17, L * 0.24, pele, 10, 14, (t, a) => 1 + 0.06 * fbm(t * 4, Math.cos(a), Math.sin(a), s)), [-L * 0.2, L * 0.16, 0]));
  out.push(tubo([V(-L * 0.05, L * 0.16, 0), V(L * 0.2, L * 0.13, L * 0.02), V(L * 0.42, L * 0.08, 0.01 * L)], {
    raio: (t) => L * (0.14 * (1 - suave(0.1, 0.85, t)) + 0.04), m: 12, n: 14, cor: pele,
  }));
  if (osso_) out.push(tf(elipsoide(L * 0.05, L * 0.035, L * 0.04, tn(OSSO, 0.06, 300, s), 5, 7), [L * 0.47, L * 0.075, 0.01 * L]));
  return out;
}

/** Asa assada dobrada (braço e antebraço). */
function asaAssada(L: number, pele: CorFn): THREE.BufferGeometry {
  return tubo([V(0, L * 0.05, 0), V(L * 0.45, L * 0.06, L * 0.08), V(L * 0.75, L * 0.04, -L * 0.05), V(L, L * 0.03, -L * 0.12)], {
    raio: (t) => L * (t < 0.45 ? 0.11 : lerp(0.1, 0.05, (t - 0.45) / 0.55)), achata: 0.65, cima: V(0, 1, 0), m: 10, n: 18, cor: pele,
  });
}

/** Fatia de peito de ave assada: carne clara com a borda de pele dourada num dos lados. */
function fatiaPeito(L: number, W: number, e: number, carne: RGB, pele: RGB, s: number, peleLarg = 0.2): THREE.BufferGeometry {
  return fatia(L, W, e, (xd, zd, r, x, y, z) => {
    const fib = 0.92 + 0.1 * Math.abs(Math.sin((x * 0.4 + z) * 700 + fbm(x * 90, z * 90, 0, s) * 3));
    const c = mul(carne, fib + 0.05 * fbm(x * 70, y * 70, z * 70, s));
    const borda = suave(1 - peleLarg, 1 - peleLarg * 0.4, zd + 0.15 * (1 - Math.abs(xd)));
    return mix(c, mul(pele, 0.9 + 0.2 * fbm(x * 150, y * 150, z * 150, s)), borda * suave(0.6, 0.85, r + zd * 0.3));
  }, { exp: 2.2, irreg: 0.08, s, nx: 9, nz: 7 });
}

/** Peru trinchado servido: fatias regulares de peito sobre as coxas. */
function gPeruFatiado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const pele = corAssada(DOURADO, TOSTADO, k.s, 40, 0.55);
  const L = k.T;
  for (const sg of [-1, 1]) {
    for (const g of pernaAssada(L * 0.55, pele, k.s)) {
      tf(g, [0, 0, 0], [0, sg > 0 ? PI * 0.12 : PI * 0.88, 0]);
      tf(g, [sg * L * 0.06, 0, sg * L * 0.13]);
      out.push(parte(g, 'brilhante', true));
    }
  }
  const fatias = leque(8, (i) => fatiaPeito(L * 0.36, L * 0.17, 0.006, C('#f0e2c8'), DOURADO, k.s + i), { passo: L * 0.075, giro: 0.06, ergue: 0.0035, inclina: 0.12 });
  for (const g of fatias) {
    tf(g, [0, L * 0.12, 0], [0, 0.15, 0]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/** Pato trinchado na travessa: pernas, asas e o peito em fatias com a pele. */
function gPatoTrinchado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T;
  const pele = corAssada(C('#b8702c'), C('#6a3412'), k.s, 45, 0.6);
  [[-L * 0.32, -L * 0.15, PI * 0.95], [-L * 0.32, L * 0.15, PI * 1.05]].forEach(([x, z, r], i) => {
    for (const g of pernaAssada(L * 0.42, pele, k.s + i)) {
      tf(g, [x, 0, z], [0, r, 0]);
      out.push(parte(g, 'brilhante', true));
    }
  });
  [[L * 0.3, -L * 0.16, -0.5], [L * 0.3, L * 0.16, 0.5]].forEach(([x, z, r]) => {
    const g = asaAssada(L * 0.28, pele);
    tf(g, [x, 0, z], [0, r, 0]);
    out.push(parte(g, 'brilhante'));
  });
  const carne = C('#a8705e');
  const fatias = leque(7, (i) => fatia(L * 0.26, L * 0.1, 0.007, (xd, zd, r, x, y, z) => {
    const c = mul(mix(carne, C('#c08070'), suave(0.6, 0.1, r) * 0.4), 0.92 + 0.1 * fbm(x * 120, y * 120, z * 120, k.s + i));
    const gord = suave(0.62, 0.7, zd) * (1 - suave(0.78, 0.84, zd));
    const pl = suave(0.8, 0.88, zd);
    return mix(mix(c, C('#f0e4c8'), gord), mul(C('#8a4818'), 0.9 + 0.2 * fbm(x * 200, 0, z * 200, k.s)), pl);
  }, { exp: 2.4, s: k.s + i }), { passo: L * 0.05, giro: 0.12, ergue: 0.003, inclina: 0.1 });
  for (const g of fatias) out.push(parte(g, 'acetinado'));
  return out;
}

/* superfície aproximada do corpo de `gAve`, para cobrir com bacon e barbante */
function corpoAve(k: Ctx) {
  const T = k.T, Lb = T * 0.8, H = T * k.A, W = T * k.L, x0 = -Lb / 2;
  const altura = (t: number) => Math.sin(PI * (0.04 + 0.92 * t)) ** 0.45 * lerp(0.84, 1, suave(0.05, 0.5, t)) * lerp(1, 0.78, suave(0.72, 1, t));
  const largura = (t: number) => Math.sin(PI * (0.03 + 0.94 * t)) ** 0.38 * lerp(1, 0.86, suave(0.55, 1, t));
  const sec = (x: number) => {
    const t = clamp((x - x0) / Lb);
    return { ry: (H / 2) * altura(t), rz: (W / 2) * largura(t), cy: H / 2 };
  };
  return { Lb, H, W, sec };
}

/** Bacon fino: listras de carne e gordura ao longo da fatia (pela largura, ângulo a). */
function corBacon(cru: boolean, s: number): CorFn {
  const carne = cru ? C('#b8424a') : C('#8a2e18'), gord = cru ? C('#f4e6d8') : C('#d8a060');
  return (x, y, z, t, a) => {
    const w = Math.cos(a);
    const f = fr(w * 1.6 + 0.3 * fbm(t * 6, x * 40, z * 40, s));
    const c = mix(carne, gord, suave(0.35, 0.45, f) * (1 - suave(0.7, 0.8, f)));
    return mul(c, 0.9 + 0.15 * fbm(x * 200, y * 200, z * 200, s));
  };
}

/** Ave de caça bardeada: fatias finas de bacon sobre peito e coxas, presas com barbante. */
function gAveBardeada(k: Ctx): Parte[] {
  const assado = k.tem('assado');
  const kk = assado ? ctxCom(k, {}, { c1: C('#c88a44'), c2: C('#9a5a24'), ac: 'brilhante' }) : k;
  const out = gAve(kk);
  const { Lb, sec } = corpoAve(k);
  const cor = corBacon(!assado, k.s);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = lerp(-Lb * 0.36, Lb * 0.3, i / (n - 1));
    const q = sec(x);
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 10; j++) {
      const th = lerp(-1.45, 1.45, j / 10);
      const dx = 0.004 * Math.sin(j * 1.3 + i);
      pts.push(V(x + dx, q.cy + q.ry * 1.06 * Math.cos(th), q.rz * 1.12 * Math.sin(th)));
    }
    out.push(parte(faixa(pts, k.T * 0.1, 0.0028, cor, V(1, 0, 0), 22), 'acetinado'));
  }
  for (const f of [-0.2, 0.18]) {
    const x = Lb * f, q = sec(x);
    for (const g of laco(x, q.cy, q.ry * 1.1, q.rz * 1.16, 0.0012, { n: 26, cor: assado ? C('#a8865a') : BARBANTE })) out.push(parte(g, 'fosco'));
  }
  return out;
}

/** Faisão assado cortado em duas porções: cada metade com a face do corte e a coxa. */
function gFaisaoPorcoes(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, H = L * 0.42, W = L * 0.32;
  const pele = corAssada(C('#c08038'), C('#7a3e16'), k.s, 55, 0.55);
  const corte: CorFn = (x, y, z) => {
    const costela = 1 - suave(0.08, 0.18, Math.abs(fr(x / 0.011) - 0.5) * 2 - 0.75) ;
    const c = mul(C('#e2c8a8'), 0.92 + 0.1 * fbm(x * 150, y * 150, 0, k.s));
    return mix(c, C('#c8a878'), costela * suave(H * 0.2, H * 0.5, y) * 0.6);
  };
  for (const sg of [-1, 1]) {
    const g = corpo({
      x0: -L * 0.42, x1: L * 0.42, n: 22, m: 22, exp: 2.3,
      cor: (x, y, z, t, a) => (z < 0.0015 ? corte(x, y, z, t, a) : pele(x, y, z, t, a)),
      perfil: (t) => ({ ry: (H / 2) * Math.sin(PI * (0.05 + 0.9 * t)) ** 0.5, rz: (W / 2) * Math.sin(PI * (0.05 + 0.9 * t)) ** 0.45, cy: H / 2 }),
      desloc: (p) => { if (p.z < 0) p.z = 0; if (p.y < H * 0.12) p.y = H * 0.12 - (H * 0.12 - p.y) * 0.3; },
    });
    const perna = pernaAssada(L * 0.5, pele, k.s, true);
    for (const pg of perna) tf(pg, [-L * 0.28, H * 0.02, W * 0.42], [0, PI * 0.85, 0]);
    for (const pg of [g, ...perna]) {
      if (sg < 0) tf(pg, [0, 0, 0], [0, PI, 0]);
      tf(pg, [sg * L * 0.03, 0, sg * W * 0.12]);
    }
    out.push(parte(g, 'brilhante', true));
    for (const pg of perna) out.push(parte(pg, 'brilhante'));
  }
  return out;
}

/** Pato à oriental: escaldado (pele lisa, clara e esticada) ou laqueado com maltose. */
function gPatoOriental(k: Ctx): Parte[] {
  const laq = k.tem('laqueado');
  const kk = laq ? ctxCom(k, {}, { c1: C('#8c3216'), c2: C('#5a1a0a'), ac: 'brilhante' }) : k;
  const out = gAve(kk);
  const { Lb, sec } = corpoAve(k);
  const x = Lb * 0.47, q = sec(Lb * 0.42);
  // barbante preso na gordura do pescoço, com a alça para pendurar
  const r = 0.0013;
  for (const g of laco(x, q.cy * 0.95, q.ry * 0.35, q.rz * 0.32, r, { n: 20, cor: laq ? C('#a8865a') : BARBANTE })) out.push(parte(g, 'fosco'));
  const alca: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const th = (i / 10) * PI;
    alca.push(V(x + 0.006, q.cy * 0.95 + q.ry * 0.36 + Math.sin(th) * 0.07, Math.cos(th) * 0.03));
  }
  out.push(parte(fio(alca, r, { n: 20, cor: laq ? C('#a8865a') : BARBANTE }), 'fosco'));
  if (laq) out.push(parte(espetoMadeira(V(-Lb * 0.47, q.cy * 0.5, -k.T * k.L * 0.18), V(-Lb * 0.5, q.cy * 0.55, k.T * k.L * 0.18), 0.0015, true), 'fosco'));
  return out;
}

/** Leque de fatias enviesadas de magret (pele dourada riscada, gordura e carne rosada) ou fileira napada de chaudfroid. */
function gMagretFatias(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const chaud = k.tem('chaudfroid');
  const L = k.T;
  const n = chaud ? 6 : 7;
  const face = (i: number): Face => (xd, zd, r, x, y, z) => {
    let c = mul(mix(C('#b84850'), C('#8a5048'), suave(0.55, 0.95, r) * 0.8), 0.92 + 0.12 * fbm(x * 160, y * 160, z * 160, k.s + i));
    c = mix(c, C('#f0e2c8'), suave(0.6, 0.66, zd) * (1 - suave(0.76, 0.8, zd)));
    const riscado = Math.abs(Math.sin((x + z * 0.6) * 500)) ** 8;
    c = mix(c, mul(C('#8a4a1a'), 0.85 + 0.25 * riscado), suave(0.78, 0.82, zd));
    if (chaud) c = mix(mix(C('#f2ead6'), C('#e8d8bc'), 0.3 * fbm(x * 90, y * 90, z * 90, k.s)), c, 0.12);
    return c;
  };
  const W = L * 0.17, Lf = L * 0.42;
  if (chaud) {
    for (let i = 0; i < n; i++) {
      const g = fatia(Lf * 0.9, W * 1.1, 0.008, face(i), { exp: 2.3, s: k.s + i, nx: 10, nz: 8 });
      tf(g, [0, 0, 0], [0, PI / 2, 0]);
      tf(g, [(i - (n - 1) / 2) * L * 0.16, 0, 0], [0, 0, 0]);
      out.push(parte(g, 'brilhante', i === 0));
      // tira de casca de laranja escaldada e uma pitada de patê confeitado sobre cada fatia
      const zs = (i % 2 ? 1 : -1) * 0.004;
      const pts = [0, 1, 2, 3, 4].map((j) => V((i - (n - 1) / 2) * L * 0.16 + (j - 2) * 0.004, 0.0085, zs + (j - 2) * 0.008 + 0.002 * Math.sin(j * 2)));
      out.push(parte(faixa(pts, 0.003, 0.0012, tn(C('#e8781e'), 0.1, 300, k.s), V(0, 1, 0), 14), 'brilhante'));
      const ros = torno({ caminho: (s2) => [0.006 * Math.sin(Math.min(1, s2 * 1.1) * PI / 2) * (1 - s2) ** 0.6, 0.008 * s2], n: 8, m: 10, cor: tn(C('#9a6a4a'), 0.1, 400, k.s), mod: (t, a) => 1 + 0.18 * Math.cos(a * 6 + t * 8) });
      tf(ros, [(i - (n - 1) / 2) * L * 0.16, 0.007, -W * 0.3]);
      out.push(parte(ros, 'acetinado'));
    }
    return out;
  }
  const fs = leque(n, (i) => fatia(L * 0.45, W * 1.15, 0.008, face(i), { exp: 2.3, s: k.s + i }), { passo: L * 0.07, giro: 0.1, ergue: 0.003, inclina: 0.12 });
  fs.forEach((g, i) => out.push(parte(g, 'acetinado', i === 0)));
  return out;
}

/** Peito de frango recheado em bolso, frito e dourado, com o queijo aparecendo na abertura. */
function gPeitoRecheado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, ry = L * k.A / 2, rz = L * k.L / 2;
  const dour = corAssada(C('#d89a48'), C('#8a4a18'), k.s, 60, 0.5);
  const fenda = (x: number, y: number, z: number) => (1 - suave(0.08, 0.2, Math.abs(y - ry * 0.95) / ry)) * suave(rz * 0.6, rz * 0.85, z) * suave(-L * 0.3, -L * 0.15, x) * suave(L * 0.3, L * 0.15, x);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 24, m: 22, exp: 2.4,
    perfil: (t) => ({ ry: ry * Math.sin(PI * (0.05 + 0.9 * t)) ** 0.6 * lerp(1.1, 0.75, t), rz: rz * Math.sin(PI * (0.04 + 0.92 * t)) ** 0.5, cy: ry }),
    cor: (x, y, z, t, a) => mix(dour(x, y, z, t, a), mul(C('#f4ecda'), 0.95 + 0.08 * ruido(x * 600, y * 600, z * 600, k.s)), fenda(x, y, z)),
    desloc: (p) => { if (p.y < ry * 0.3) p.y = ry * 0.3 - (ry * 0.3 - p.y) * 0.3; },
  }), 'brilhante', true));
  // queijo de cabra amolecido saindo um pouco do bolso
  for (let i = 0; i < 3; i++) {
    const g = elipsoide(L * 0.05, ry * 0.18, rz * 0.12, tn(C('#f6f0e0'), 0.06, 400, k.s + i), 6, 8);
    tf(g, [lerp(-L * 0.15, L * 0.15, i / 2), ry * 0.95, rz * 0.86]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/** Escalope de frango grelhado na chapa sulcada, com fio de balsâmico reduzido por cima. */
function gEscalopeChapa(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, e = 0.008;
  const base = (x: number, y: number, z: number, t: number, a: number) => corAssada(C('#e4c08a'), C('#b07a3a'), k.s, 70, 0.4)(x, y, z, t, a);
  const cor = grelha(base, 0.017, 0.6, C('#4a2610'), 0.24);
  out.push(parte(fatia(L, W, e, (xd, zd, r, x, y, z) => cor(x, y, z, 0, 0), { exp: 2.1, irreg: 0.14, s: k.s, nx: 16, nz: 12, alto: (xd, zd, r) => e * (1 - 0.4 * r ** 4) }), 'acetinado', true));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(V(lerp(-L * 0.36, L * 0.36, t), e + 0.0012, W * 0.28 * Math.sin(t * PI * 4.5)));
  }
  out.push(parte(faixa(pts, 0.004, 0.0015, tn(C('#2a0c0a'), 0.15, 300, k.s), V(0, 1, 0), 60), 'brilhante'));
  return out;
}

/** Coxa de frango grelhada na brasa (marcas de grelha, osso da junta) ou pedaços salteados dourados. */
function gFrangoDourado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T;
  const base = corAssada(C('#c88a3e'), C('#7a3e14'), k.s, 55, 0.6);
  if (!k.tem('pedacos')) {
    const cor = grelha(base, 0.022, 0.2, C('#2e1608'), 0.2);
    pernaAssada(L, cor, k.s).forEach((g, i) => out.push(parte(g, 'brilhante', i === 0)));
    return out;
  }
  // salteado: duas coxas, duas sobrecoxas e um pedaço de peito, dourados por igual
  const pecas: [number, number, number, number][] = [[-L * 0.22, -L * 0.18, 0.3, 0], [L * 0.2, -L * 0.2, 2.6, 0], [-L * 0.2, L * 0.17, -0.4, 1], [L * 0.22, L * 0.15, 3.4, 1], [0, 0, 1.2, 2]];
  pecas.forEach(([x, z, rot, tipo], i) => {
    let gs: THREE.BufferGeometry[];
    if (tipo === 0) gs = pernaAssada(L * 0.55, base, k.s + i).slice(1);
    else if (tipo === 1) gs = [elipsoide(L * 0.16, L * 0.08, L * 0.13, base, 10, 14, (t, a) => 1 + 0.1 * fbm(t * 3, Math.cos(a), Math.sin(a), k.s + i))];
    else gs = [elipsoide(L * 0.2, L * 0.08, L * 0.11, base, 10, 14, (t, a) => 1 + 0.08 * fbm(t * 3, Math.cos(a), Math.sin(a), k.s + 9))];
    for (const g of gs) {
      g.computeBoundingBox();
      tf(g, [0, -g.boundingBox!.min.y, 0]);
      tf(g, [x, 0, z], [0, rot, 0]);
      out.push(parte(g, 'brilhante', i === 4));
    }
  });
  return out;
}

/** Patê de fígado alisado e selado com uma camada de manteiga clarificada, louro e pimenta rosa. */
function gPateSelado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.92, 0], [R, H * 0.08], [R, H * 0.86], [0, H * 0.86]], n: 12, m: 26, cor: (x, y, z) => mul(k.c1, 0.9 + 0.15 * fbm(x * 300, y * 300, z * 300, k.s) - 0.08 * (1 - suave(0.1, 0.25, celula(x * 700, y * 700, z * 700, k.s)))) }), 'acetinado', true));
  out.push(parte(torno({ caminho: [[0, H * 0.84], [R * 1.0, H * 0.84], [R * 1.005, H * 0.97], [R * 0.9, H], [0, H * 0.985]], n: 10, m: 26, cor: (x, y, z) => mix(k.c2, C('#f4dc78'), 0.3 + 0.3 * fbm(x * 120, y * 120, z * 120, k.s)) }), 'brilhante'));
  const louro = folha(R * 0.9, R * 0.38, C('#5a6a34'), C('#8a9a5a'), { contorno: contornos.lanca, curva: 0.05, n: 10, m: 6 });
  tf(louro, [-R * 0.4, H + 0.0006, -R * 0.1], [0, 0.5, 0]);
  out.push(parte(louro, 'acetinado'));
  for (let i = 0; i < 4; i++) out.push(parte(tf(elipsoide(0.0022, 0.0018, 0.0022, tn(C('#b83a3a'), 0.1, 900, i), 5, 6), [R * 0.25 + i * 0.006, H + 0.0012, R * (0.2 - i * 0.08)]), 'brilhante'));
  return out;
}

/* ------------------------------------------------------------------ */
/* bovina: embalagens, capa de gordura, filé mignon, bife batido...     */
/* ------------------------------------------------------------------ */

/** Bloco de carne ao longo de X com capa de gordura em cima (a face de corte das pontas mostra a capa). */
function blocoCarne(k: Ctx, capa: number, o: { L?: number; ry?: number; rz?: number; exp?: number; dour?: boolean } = {}): THREE.BufferGeometry {
  const L = o.L ?? k.T, ry = o.ry ?? (k.T * k.A) / 2, rz = o.rz ?? (k.T * k.L) / 2;
  const crua = carneCrua(k.c1, k.s, 0.15);
  const gord = gordura(k.s);
  const topo = ry * 2;
  const cor: CorFn = (x, y, z, t, a) => {
    const lim = topo - capa * (1 + 0.25 * fbm(x * 30, 0, z * 30, k.s));
    const c = y > lim ? gord(x, y, z, t, a) : crua(x, y, z, t, a);
    return o.dour ? mix(c, corAssada(C('#8a4a24'), C('#4a2410'), k.s)(x, y, z, t, a), 0.85) : c;
  };
  const corte: CorFn = (x, y, z, t, a) => {
    const lim = topo - capa * (1 + 0.25 * fbm(x * 30, 0, z * 30, k.s));
    if (y > lim) return gord(x, y, z, t, a);
    const veio = 1 - suave(0, 0.08, Math.abs(fbm(y * 90, z * 90, x, k.s + 4)));
    return mix(mul(k.ci, 0.9 + 0.12 * fbm(y * 200, z * 200, 0, k.s)), C('#f0e2d0'), veio * 0.35);
  };
  return corpo({
    x0: -L / 2, x1: L / 2, n: 18, m: 26, exp: o.exp ?? 3.2, tampa: true, aneisTampa: 5, cor, corTampa: corte,
    perfil: (t) => {
      const b = 1 - 0.08 * (1 - suave(0, 0.06, Math.min(t, 1 - t)));
      return { ry: ry * b * (1 + 0.04 * Math.sin(t * 9 + k.s)), rz: rz * b, cy: ry };
    },
    mod: (t, a) => 1 + 0.03 * fbm(t * 5, Math.cos(a) * 1.5, Math.sin(a) * 1.5, k.s),
    desloc: (p) => { if (p.y < ry * 0.2) p.y = ry * 0.2 - (ry * 0.2 - p.y) * 0.3; },
  });
}

/** Acém com a capa grossa de gordura (antes de limpar) ou aparado com a capa fina. */
const gAcemCapa = (k: Ctx): Parte[] => [parte(blocoCarne(k, k.tem('grossa') ? k.T * k.A * 0.3 : k.T * k.A * 0.07), 'acetinado', true)];

/** Carne do açougue na bandeja de isopor, coberta por filme plástico e com etiqueta. */
function gCarneBandeja(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * 0.72, Hb = 0.016;
  const branco = tn(C('#f4f4f0'), 0.03, 200, k.s);
  out.push(parte(bloco(L, 0.004, W, branco, [2, 1, 2]), 'fosco', true));
  for (const [x, z, sx, sz] of [[0, W / 2 - 0.004, L, 0.008], [0, -W / 2 + 0.004, L, 0.008], [L / 2 - 0.004, 0, 0.008, W], [-L / 2 + 0.004, 0, 0.008, W]] as [number, number, number, number][]) {
    out.push(parte(tf(bloco(sx, Hb, sz, branco), [x, Hb / 2, z]), 'fosco'));
  }
  const bife = blocoCarne(ctxCom(k, {}, { c1: C('#8a2428'), ci: C('#9a2c2e') }), 0.004, { L: L * 0.72, ry: 0.012, rz: W * 0.34, exp: 2.6 });
  tf(bife, [0, 0.002, 0], [0, 0.12, 0]);
  out.push(parte(bife, 'umido'));
  // filme esticado por cima: brilho claro, deixando ver a carne
  const filme = chapa(10, 8, (u, v, lado) => [(u - 0.5) * L * 0.99, Hb + 0.009 * Math.sin(u * PI) * (1 - v * v) + lado * 0.0004, v * W * 0.495], (x, y, z) => {
    const naCarne = Math.abs(x) < L * 0.34 && Math.abs(z) < W * 0.33;
    return mix(naCarne ? C('#8a2a2c') : C('#f4f4f0'), C('#ffffff'), naCarne ? 0.12 : 0.25);
  });
  out.push(parte(filme, 'brilhante'));
  const etiq = bloco(L * 0.28, 0.0006, W * 0.26, (x, y, z) => (Math.abs(z + W * 0.06) < W * 0.025 ? C('#c83a2a') : C('#fbfaf4')));
  tf(etiq, [L * 0.27, Hb + 0.006, W * 0.24], [0.05, 0.2, 0]);
  out.push(parte(etiq, 'fosco'));
  return out;
}

/** Porções de carne embrulhadas em papel de freezer, com dobras e fita. */
function gCarneEmbrulhada(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T;
  const papel = (s: number): CorFn => (x, y, z) => {
    const dobra = Math.abs(Math.sin(x * 140 + z * 90 + fbm(x * 40, y * 40, z * 40, s) * 2)) ** 30;
    return mul(C('#f2eee4'), 0.94 + 0.06 * fbm(x * 120, y * 120, z * 120, s) - 0.08 * dobra);
  };
  const pacote = (lx: number, ly: number, lz: number, s: number) => corpo({
    x0: -lx / 2, x1: lx / 2, n: 10, m: 24, exp: 4, tampa: true, cor: papel(s),
    perfil: (t) => ({ ry: (ly / 2) * (1 - 0.15 * (1 - suave(0, 0.12, Math.min(t, 1 - t)))), rz: (lz / 2) * (1 - 0.12 * (1 - suave(0, 0.1, Math.min(t, 1 - t)))), cy: ly / 2 }),
    mod: (t, a) => 1 + 0.025 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s),
  });
  const p = [[-L * 0.22, 0, -0.03, 0.2], [L * 0.24, 0, 0.02, -0.15], [0.01, 0.032, 0.0, 0.5]];
  p.forEach(([x, y, z, r], i) => {
    const g = pacote(L * 0.42, 0.03, L * 0.3, k.s + i);
    tf(g, [x, y, z], [0, r, 0]);
    out.push(parte(g, 'fosco', i === 0));
    const fita = bloco(0.012, 0.031, L * 0.31, () => C('#e8d8a8'));
    tf(fita, [x, y + 0.0155, z], [0, r, 0]);
    out.push(parte(fita, 'acetinado'));
  });
  return out;
}

/** Filé mignon inteiro: cru, dourado, com o cordão lateral ou amarrado com barbante fino a cada 3 cm. */
function gFileMignon(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, H = L * k.A, W = L * k.L;
  const dour = k.tem('dourado');
  const prof = (t: number) => Math.sin(PI * (0.03 + 0.94 * t)) ** 0.5 * lerp(0.62, 1, suave(0, 0.75, t)) * lerp(1, 0.85, suave(0.85, 1, t));
  const crua = carneCrua(k.c1, k.s, 0.12, 0.0035);
  const tost = corAssada(C('#7a4022'), C('#3e1e0e'), k.s, 45, 0.7);
  // a membrana prateada (nervo) corre por cima do filé cru, numa faixa irregular e brilhante
  const prata: CorFn = (x, y, z, t, a) => {
    const c = crua(x, y, z, t, a);
    if (k.tem('amarrado')) return c;
    const faixa = suave(0.55, 0.25, Math.abs(Math.sin(a) + 0.15 * fbm(t * 9, 0, 0, k.s + 3))) * suave(0.05, 0.35, Math.cos(a)) * suave(0.08, 0.25, t) * suave(0.95, 0.75, t);
    const fio = 0.75 + 0.25 * Math.abs(Math.sin(x * 700 + 3 * fbm(x * 40, z * 90, 0, k.s)));
    return mix(c, mul(C('#d4d6da'), fio), faixa * 0.85);
  };
  const cor: CorFn = dour ? (x, y, z, t, a) => mix(tost(x, y, z, t, a), mul(k.c1, 0.8), 0.08) : prata;
  const sec = (t: number) => ({ ry: (H / 2) * prof(t), rz: (W / 2) * prof(t) });
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 24, m: 22, exp: 2.2, cor,
    perfil: (t) => ({ ...sec(t), cy: (H / 2) * prof(t) }),
    mod: (t, a) => 1 + 0.05 * fbm(t * 7, Math.cos(a) * 1.4, Math.sin(a) * 1.4, k.s),
    desloc: (p) => { if (p.y < H * 0.06) p.y = H * 0.06 - (H * 0.06 - p.y) * 0.3; },
  }), dour ? 'brilhante' : 'umido', true));
  if (k.tem('cordao')) {
    // cordão: tira irregular de carne e gordura colada ao lado do filé
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = lerp(0.12, 0.9, i / 10);
      const q = sec(t);
      pts.push(V(lerp(-L / 2, L / 2, t), q.ry * 0.7, q.rz * 1.05 + 0.004 * Math.sin(i * 1.7)));
    }
    out.push(parte(tubo(pts, {
      raio: (t) => H * 0.17 * (0.7 + 0.5 * Math.sin(t * PI)) , m: 10, n: 30, achata: 0.8,
      cor: (x, y, z) => mix(mul(k.c1, 0.95), C('#f0e0c8'), suave(0.1, 0.5, fbm(x * 70, y * 70, z * 70, k.s + 5)) * 0.6),
      mod: (t, a) => 1 + 0.25 * fbm(t * 14, Math.cos(a), Math.sin(a), k.s + 2),
    }), 'umido'));
  }
  if (k.tem('amarrado')) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = 0.07 + (0.86 * i) / (n - 1);
      const q = sec(t);
      const x = lerp(-L / 2, L / 2, t);
      for (const g of laco(x, q.ry, q.ry * 0.94, q.rz * 0.94, 0.0009, { n: 18, no: false, cor: dour ? C('#9a7448') : BARBANTE })) out.push(parte(g, 'fosco'));
      out.push(parte(tf(elipsoide(0.0022, 0.0016, 0.002, () => (dour ? C('#9a7448') : BARBANTE), 3, 5), [x, q.ry * 2 + 0.0008, 0]), 'fosco'));
    }
  }
  return out;
}

/** Bife batido: fino e largo, com as marcas do cutelo e a borda de gordura. */
function gBifeBatido(k: Ctx): Parte[] {
  const L = k.T, W = L * k.L, e = L * k.A;
  const crua = carneCrua(k.c1, k.s, 0.12, 0.003);
  const gord = gordura(k.s);
  return [parte(fatia(L, W, e, (xd, zd, r, x, y, z) => {
    const marca = 1 - suave(0.15, 0.5, celula(x * 55, z * 55, 0, k.s));
    const c = mul(crua(x, y, z, 0, 0), 1 - 0.1 * marca);
    return mix(c, gord(x, y, z, 0, 0), suave(0.8, 0.88, r) * suave(0.1, 0.5, zd));
  }, { exp: 2.2, irreg: 0.2, s: k.s, nx: 18, nz: 14, alto: (xd, zd, r) => e * (1 - 0.3 * r ** 4) * (1 - 0.18 * (1 - suave(0.15, 0.5, celula(xd * L * 27, zd * W * 27, 0, k.s)))) }), 'umido', true)];
}

/** Carne moída saindo do moedor: montinho de fios sinuosos. */
function gMoidaFios(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const cor: CorFn = (x, y, z) => {
    const gord = 1 - suave(0.08, 0.22, celula(x * 500, y * 500, z * 500, k.s));
    return mix(mul(k.c1, 0.85 + 0.25 * fbm(x * 300, y * 300, z * 300, k.s)), k.c2, gord * 0.6);
  };
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.9, 0], [R * 0.75, H * 0.3], [R * 0.4, H * 0.75], [0, H * 0.85]], n: 10, m: 18, cor: (x, y, z) => mul(cor(x, y, z, 0, 0), 0.75) }), 'acetinado', true));
  for (let i = 0; i < 44; i++) {
    const a0 = k.r.f(0, TAU), r0 = R * k.r.f(0.05, 0.8);
    const comp = k.r.f(0.035, 0.07);
    const pts: THREE.Vector3[] = [];
    let a = a0;
    for (let j = 0; j <= 5; j++) {
      const rr = r0 + (j / 5) * comp * 0.3;
      a += (comp / Math.max(0.02, rr)) * 0.2 * (i % 2 ? 1 : -1);
      const y = H * 0.85 * (1 - (rr / R) ** 2) + 0.002 + 0.003 * Math.sin(j * 2 + i);
      pts.push(V(Math.cos(a) * rr, Math.max(0.003, y), Math.sin(a) * rr));
    }
    out.push(parte(tubo(pts, { raio: 0.0028, m: 5, n: 12, cor: (x, y, z) => cor(x + i * 0.013, y, z, 0, 0), mod: (t, ang) => 1 + 0.15 * Math.sin(t * 40 + ang) }), 'acetinado'));
  }
  return out;
}

/** Peça com costelas aparentes (costela bovina, lombo de porco com espinha, peito de vitela). */
function gPecaCostela(k: Ctx): Parte[] {
  if (!k.tem('chata')) return gCostelasEmArco(k);
  const out: Parte[] = [];
  const L = k.T, n = k.v.n ?? 3;
  const assado = k.tem('assado'), vitela = k.tem('chata');
  const ry = (L * k.A) / 2, rz = (L * k.L) / 2;
  const yb = vitela ? 0 : 0.006;
  const capa = vitela ? 0.002 : ry * 0.3;
  const crua = carneCrua(k.c1, k.s, 0.2);
  const gord = gordura(k.s);
  const tost = corAssada(C('#8a4a24'), C('#40200e'), k.s, 40, 0.7);
  const topo = yb + ry * 2;
  const fora: CorFn = (x, y, z, t, a) => {
    const c = y > topo - capa * (1 + 0.2 * fbm(x * 30, 0, z * 30, k.s)) ? gord(x, y, z, t, a) : crua(x, y, z, t, a);
    return assado ? mix(c, tost(x, y, z, t, a), 0.88) : c;
  };
  const corte: CorFn = (x, y, z, t, a) => {
    if (y > topo - capa) return assado ? mix(gord(x, y, z, t, a), C('#b07a40'), 0.4) : gord(x, y, z, t, a);
    const borda = suave(0.75, 1, Math.hypot((y - yb - ry) / ry, z / rz));
    const veio = 1 - suave(0, 0.08, Math.abs(fbm(y * 90, z * 90, x, k.s + 4)));
    let c = mix(mul(k.ci, 0.92 + 0.1 * fbm(y * 200, z * 200, 0, k.s)), C('#f0e2d0'), veio * 0.35);
    if (assado) c = mix(mix(c, C('#c8606a'), 0.3), C('#8a5a44'), borda);
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 18, m: 26, exp: vitela ? 4 : 2.8, tampa: true, aneisTampa: 5, cor: fora, corTampa: corte,
    perfil: (t) => ({ ry: ry * (1 - 0.06 * (1 - suave(0, 0.06, Math.min(t, 1 - t)))), rz, cy: yb + ry }),
    mod: (t, a) => 1 + 0.035 * fbm(t * 5, Math.cos(a) * 1.4, Math.sin(a) * 1.4, k.s),
  }), assado ? 'brilhante' : 'umido', true));
  const corOsso: CorFn = (x, y, z) => mul(assado ? mix(OSSO, C('#a87a4a'), 0.5) : OSSO, 0.88 + 0.12 * fbm(x * 200, y * 200, z * 200, k.s));
  for (let i = 0; i < n; i++) {
    const x = lerp(-L / 2, L / 2, (i + 0.5) / n);
    const r = vitela ? 0.0075 : 0.0095;
    const y0 = vitela ? ry * 1.85 : yb + r * 0.55;
    const pts = vitela
      ? [V(x, y0, -rz * 0.85), V(x + 0.004, y0 + 0.002, 0), V(x, y0, rz * 0.8)]
      : [V(x, y0 + 0.01, -rz * 0.55), V(x, y0, rz * 0.4), V(x + 0.003, y0 + 0.004, rz + 0.03), V(x + 0.004, y0 + 0.012, rz + 0.045)];
    out.push(parte(tubo(pts, { raio: (t) => r * (1 + 0.25 * suave(0.85, 1, t)), achata: vitela ? 0.7 : 0.75, cima: V(0, 1, 0), m: 10, n: 16, cor: corOsso }), 'acetinado'));
  }
  if (k.tem('espinha')) {
    // espinha: vértebras em fila embaixo de um dos lados
    for (let i = 0; i < n + 1; i++) {
      const x = lerp(-L / 2 + 0.02, L / 2 - 0.02, i / n);
      out.push(parte(tf(elipsoide(L / (n + 1) * 0.42, 0.018, 0.016, corOsso, 6, 8), [x, 0.018, -rz * 0.95]), 'acetinado'));
    }
  }
  if (vitela) {
    // cartilagem do osso do peito numa das bordas
    out.push(parte(tubo([V(-L * 0.46, ry * 1.6, -rz * 0.86), V(0, ry * 1.7, -rz * 0.9), V(L * 0.46, ry * 1.6, -rz * 0.86)], { raio: 0.007, achata: 0.6, cima: V(0, 1, 0), m: 8, n: 14, cor: tn(C('#ece6dc'), 0.06, 200, k.s) }), 'brilhante'));
  }
  return out;
}

/**
 * Costela bovina e lombo de porco com os ossos: o olho de carne deitado na tábua, a capa de gordura
 * (no porco, a pele) por cima, e a parede de costelas saindo por trás em arcos curtos e paralelos,
 * com a carne entre eles e a ponta do osso aparente. Assada: crosta dourada e ossos tostados.
 */
function gCostelasEmArco(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, n = k.v.n ?? 3;
  const assado = k.tem('assado'), porco = k.tem('espinha');
  const H = L * k.A, W = L * k.L * 0.62;
  const crua = carneCrua(k.c1, k.s, 0.15);
  const gord = gordura(k.s, porco ? '#f4ece2' : '#f0e2c8');
  const tost = corAssada(C('#8a4a24'), C('#40200e'), k.s, 40, 0.7);
  const doura = (c: RGB, x: number, y: number, z: number, t: number, a: number) => (assado ? mix(c, tost(x, y, z, t, a), 0.85) : c);
  const capa = (x: number, y: number, z: number) => suave(H * 0.8, H * 0.95, y + H * 0.06 * fbm(x * 25, 0, z * 25, k.s));
  const fora: CorFn = (x, y, z, t, a) => {
    let c = mix(crua(x, y, z, t, a), gord(x, y, z, t, a), capa(x, y, z) * 0.9);
    // no porco, a pele fina e lisa por cima da gordura
    if (porco) c = mix(c, mul(k.c3 ?? C('#ecd6c0'), 0.96 + 0.06 * fbm(x * 120, y * 120, z * 120, k.s)), suave(H * 0.9, H * 0.98, y) * 0.8);
    return doura(c, x, y, z, t, a);
  };
  const zc = W * (porco ? 0.6 : 0.5) * 0.4;
  const corte: CorFn = (x, y, z, t, a) => {
    // o olho com marmoreio fino, a capa de gordura em cima e a película entre os músculos
    const veio = 1 - suave(0, 0.07, Math.abs(fbm(y * 90, z * 90, x, k.s + 4)));
    let c = mix(mul(k.ci, 0.9 + 0.12 * fbm(y * 200, z * 200, 0, k.s)), C('#f0e2d0'), veio * (porco ? 0.15 : 0.35));
    c = mix(c, gord(x, y, z, t, a), suave(H * 0.7, H * 0.8, y));
    if (assado) c = mix(mix(c, C('#c8606a'), 0.3), C('#8a5a44'), suave(0.78, 1, Math.hypot((y - H / 2) / (H / 2), (z - zc) / (W / 2))));
    return c;
  };
  const aba: CorFn = (x, y, z, t, a) => doura(mix(mul(crua(x, y, z, t, a), 0.92), gord(x, y, z, t, a), 0.1 + 0.25 * suave(0.1, 0.6, fbm(x * 60, y * 60, z * 60, k.s + 2))), x, y, z, t, a);
  const osso: CorFn = (x, y, z) => mul(assado ? mix(OSSO, C('#a87a4a'), 0.5) : OSSO, 0.88 + 0.12 * fbm(x * 200, y * 200, z * 200, k.s));
  const { carne, ossos } = pecaCostelas({
    L, H, W, n, aba: W * (porco ? 0.6 : 0.5), sobe: H * (porco ? 0.3 : 0.45), limpo: porco ? 0.16 : 0.2,
    rOsso: Math.min((L / n) * 0.18, porco ? 0.009 : 0.015), esp: porco ? 0.018 : 0.026,
    fora, corte, aba2: aba, osso, s: k.s,
  });
  carne.forEach((g, i) => out.push(parte(g, assado ? 'brilhante' : 'umido', i === 0)));
  for (const g of ossos) out.push(parte(g, 'acetinado'));
  return out;
}

/** Manta de carne aberta com recheio espalhado (bovina com espinafre, cordeiro com ervas) ou dois filés de porco abertos em volta do recheio. */
function gManta(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, e = 0.016;
  const crua = carneCrua(k.c1, k.s, 0.15, 0.003);
  if (k.tem('dois')) {
    for (const sg of [-1, 1]) {
      const g = fatia(L, W * 0.42, e * 0.8, (xd, zd, r, x, y, z) => crua(x, y, z, 0, 0), { exp: 2.4, irreg: 0.12, s: k.s + sg, nx: 14, nz: 8 });
      tf(g, [0, 0, sg * W * 0.24]);
      out.push(parte(g, 'umido', sg < 0));
    }
    const dux: CorFn = (x, y, z) => mul(mix(C('#5a3a24'), C('#8a6a4a'), suave(0.2, 0.8, celula(x * 500, y * 500, z * 500, k.s))), 0.9 + 0.15 * fbm(x * 300, y * 300, z * 300, k.s));
    out.push(parte(corpo({ x0: -L * 0.42, x1: L * 0.42, n: 14, m: 14, cor: dux, perfil: (t) => ({ ry: 0.013 * Math.sin(PI * (0.06 + 0.88 * t)) ** 0.3, rz: 0.017 * Math.sin(PI * (0.06 + 0.88 * t)) ** 0.3, cy: e * 0.8 + 0.01 }), mod: (t, a) => 1 + 0.12 * fbm(t * 9, Math.cos(a) * 2, Math.sin(a) * 2, k.s) }), 'acetinado'));
    return out;
  }
  out.push(parte(fatia(L, W, e, (xd, zd, r, x, y, z) => crua(x, y, z, 0, 0), { exp: 2.6, irreg: 0.14, s: k.s, nx: 14, nz: 12 }), 'umido', true));
  const ervas = k.tem('ervas');
  const rech: Face = ervas
    ? (xd, zd, r, x, y, z) => mix(mul(C('#d8c49a'), 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, k.s)), C('#3e6a28'), suave(0.55, 0.75, fbm(x * 400, z * 400, y, k.s + 3)))
    : (xd, zd, r, x, y, z) => mix(C('#1e3a16'), C('#4a7a2a'), suave(-0.3, 0.6, fbm(x * 160, z * 160, y * 160, k.s + 3)));
  const g = fatia(L * 0.82, W * 0.78, 0.007, rech, { exp: 2.6, irreg: 0.18, s: k.s + 4, nx: 12, nz: 10, alto: (xd, zd, r) => 0.007 * (1 - 0.6 * r ** 3) * (0.8 + 0.4 * fbm(xd * 4, zd * 4, 0, k.s)) });
  tf(g, [L * 0.03, e * 0.85, 0]);
  out.push(parte(g, ervas ? 'acetinado' : 'brilhante'));
  return out;
}

/** Filé envolto em massa folhada inteiro, com as tiras decorativas: cru (massa pálida) ou assado e pincelado de gema. */
function gFileEmMassa(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, ry = (L * k.A) / 2, rz = (L * k.L) / 2;
  const assado = k.tem('assado');
  const base = assado ? C('#c8802c') : C('#e6c48a');
  const escuro = assado ? C('#8a4a16') : C('#c89a5a');
  const tira = (x: number, z: number) => {
    const a = Math.abs(fr((x + z * 0.9) / 0.045) - 0.5) * 2, b = Math.abs(fr((x - z * 0.9) / 0.045) - 0.5) * 2;
    return Math.max(suave(0.86, 0.94, a), suave(0.86, 0.94, b));
  };
  const cor: CorFn = (x, y, z) => {
    let c = mix(base, escuro, suave(0.1, 0.9, fbm(x * 40, y * 40, z * 40, k.s)) * (assado ? 0.5 : 0.2));
    const tr = tira(x, z) * suave(ry * 0.9, ry * 1.4, y);
    c = mix(c, assado ? mul(base, 1.15) : mul(C('#f4e0b4'), 1), tr);
    c = mix(c, mul(escuro, 0.8), (suave(0.8, 0.86, Math.max(Math.abs(fr((x + z * 0.9) / 0.045) - 0.5) * 2, Math.abs(fr((x - z * 0.9) / 0.045) - 0.5) * 2)) - tr) * 0.6 * suave(ry * 0.9, ry * 1.4, y));
    if (assado) c = mul(c, 1 + 0.1 * Math.abs(Math.sin(y * 800 + fbm(x * 60, z * 60, 0, k.s) * 3)) * (1 - suave(ry * 0.3, ry * 1.2, y)));
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 28, exp: 2.4, cor,
    perfil: (t) => {
      const p = Math.sin(PI * (0.03 + 0.94 * t)) ** 0.35;
      return { ry: ry * p, rz: rz * p, cy: ry * p };
    },
    mod: (t, a) => 1 + 0.025 * tira(lerp(-L / 2, L / 2, t), Math.sin(a) * rz) * Math.max(0, Math.cos(a)) + (assado ? 0.03 * Math.max(0, Math.cos(a)) * Math.sin(PI * t) : 0),
    desloc: (p) => { if (p.y < ry * 0.25) p.y = ry * 0.25 - (ry * 0.25 - p.y) * 0.25; },
  }), assado ? 'brilhante' : 'acetinado', true));
  // folhinhas de massa na emenda de cima
  for (let i = 0; i < 3; i++) {
    const g = folha(L * 0.14, L * 0.06, mul(base, 1.05), mul(escuro, 1), { contorno: contornos.oval, curva: -0.05, n: 8, m: 6, esp: 0.003 });
    tf(g, [L * (-0.12 + i * 0.09), ry * 2 - 0.003, (i - 1) * 0.008], [0, 0.4 * (i - 1) + 0.3, 0]);
    out.push(parte(g, assado ? 'brilhante' : 'acetinado'));
  }
  return out;
}

/** Saltimbocca: escalopes dourados com presunto de Parma e sálvia, napados com o molho de Marsala. */
function gSaltimbocca(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L;
  const molho = (x: number, y: number, z: number): RGB => mix(C('#c89a5a'), C('#a87038'), 0.3 + 0.4 * fbm(x * 60, y * 60, z * 60, k.s));
  out.push(parte(fatia(L, W, 0.003, (xd, zd, r, x, y, z) => molho(x, y, z), { exp: 2, irreg: 0.2, s: k.s, nx: 12, nz: 10 }), 'brilhante', true));
  const dour = corAssada(C('#c88a48'), C('#7a4218'), k.s, 60, 0.5);
  [[-L * 0.2, -W * 0.06, 0.3], [L * 0.2, W * 0.06, -0.4]].forEach(([x, z, r], i) => {
    const g = fatia(L * 0.5, W * 0.62, 0.006, (xd, zd, rr, X, Y, Z) => mix(dour(X, Y, Z, 0, 0), molho(X, Y, Z), suave(0.7, 0.95, rr) * 0.6), { exp: 2.2, irreg: 0.15, s: k.s + i, nx: 12, nz: 10 });
    tf(g, [x, 0.003, z], [0, r, 0]);
    out.push(parte(g, 'acetinado'));
    const pr = fatia(L * 0.42, W * 0.5, 0.0015, (xd, zd, rr, X, Y, Z) => mix(mul(C('#c45a5c'), 0.92 + 0.12 * fbm(X * 200, Y * 200, Z * 200, k.s + i)), C('#f4e4d8'), suave(0.78, 0.86, rr) * suave(0, 0.5, zd)), {
      exp: 2.2, irreg: 0.25, s: k.s + 5 + i, nx: 12, nz: 10, alto: (xd, zd, rr) => 0.0015 + 0.003 * Math.sin(xd * 5 + zd * 3 + i) * rr,
    });
    tf(pr, [x, 0.0095, z], [0, r + 0.2, 0]);
    out.push(parte(pr, 'acetinado'));
    const sal = folha(L * 0.18, L * 0.08, C('#6a7a58'), C('#9aa68a'), { contorno: contornos.oval, curva: 0.04, n: 10, m: 6 });
    tf(sal, [x - L * 0.06, 0.014, z], [0, r + 0.8, 0]);
    out.push(parte(sal, 'fosco'));
    // fio de molho por cima da carne
    const pts = [0, 1, 2, 3, 4, 5].map((j) => V(x + (j - 2.5) * L * 0.05, 0.0135, z + 0.012 * Math.sin(j * 1.9 + i)));
    out.push(parte(faixa(pts, 0.006, 0.0015, (X, Y, Z) => molho(X, Y, Z), V(0, 1, 0), 18), 'brilhante'));
  });
  return out;
}

/** Fajitas: tortillas com tiras de alcatra grelhadas e pimentões. */
function gFajitas(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T;
  const R = L * 0.3;
  const tort = (s: number): Face => (xd, zd, r, x, y, z) => {
    const mancha = 1 - suave(0.1, 0.3, celula(x * 90, z * 90, 0, s));
    return mix(mul(C('#ecdcb0'), 0.95 + 0.06 * fbm(x * 80, z * 80, 0, s)), C('#8a5a2a'), mancha * 0.5);
  };
  [[-L * 0.19, 0, 0], [L * 0.19, 0.0015, 0.4]].forEach(([x, y, r], i) => {
    const g = fatia(R * 2, R * 2, 0.0025, tort(k.s + i), { exp: 2, irreg: 0.04, s: k.s + i, nx: 14, nz: 14, alto: (xd, zd, rr) => 0.0025 + 0.006 * rr * rr * Math.max(0, Math.sin(Math.atan2(zd, xd) * 2 + i)) });
    tf(g, [x, y, 0], [0, r, 0]);
    out.push(parte(g, 'fosco', i === 0));
  });
  const carne = corAssada(C('#8a4a26'), C('#3a1a0a'), k.s, 90, 0.7);
  for (let i = 0; i < 16; i++) {
    const lado = i < 8 ? -1 : 1;
    const x = lado * L * 0.19 + k.r.f(-R * 0.5, R * 0.5), z = k.r.f(-R * 0.45, R * 0.45);
    const l = k.r.f(0.045, 0.065);
    const g = corpo({ x0: -l / 2, x1: l / 2, n: 6, m: 6, exp: 3, cor: carne, perfil: (t) => ({ ry: 0.0045 * Math.sin(PI * (0.1 + 0.8 * t)) ** 0.3, rz: 0.006 * Math.sin(PI * (0.1 + 0.8 * t)) ** 0.3, cy: 0.0045 }) });
    tf(g, [x, 0.004, z], [0, k.r.f(0, PI), k.r.f(-0.15, 0.15)]);
    out.push(parte(g, 'brilhante'));
  }
  for (let i = 0; i < 12; i++) {
    const lado = i % 2 ? -1 : 1;
    const x = lado * L * 0.19 + k.r.f(-R * 0.5, R * 0.5), z = k.r.f(-R * 0.45, R * 0.45);
    const cor = i % 3 === 0 ? C('#3a7a2a') : i % 3 === 1 ? C('#d02a1a') : C('#e8b020');
    const l = k.r.f(0.04, 0.06), ang = k.r.f(0, PI);
    const pts = [0, 1, 2].map((j) => V(x + Math.cos(ang) * (j - 1) * l / 2, 0.009 + 0.002 * (j === 1 ? 1 : 0), z + Math.sin(ang) * (j - 1) * l / 2 + (j === 1 ? 0.004 : 0)));
    out.push(parte(faixa(pts, 0.006, 0.0025, (X, Y, Z) => mix(mul(cor, 0.95 + 0.1 * fbm(X * 200, Y * 200, Z * 200, i)), C('#4a2a14'), 0.15 * suave(0.3, 0.9, fbm(X * 120, 0, Z * 120, i))), V(0, 1, 0), 10), 'brilhante'));
  }
  return out;
}

/** Cilindro de manteiga temperada enrolado no papel-manteiga, pontas torcidas. */
function gManteigaCilindro(k: Ctx): Parte[] {
  const L = k.T, r = L * 0.11, Lc = L * 0.6;
  const papel: CorFn = (x, y, z, t, a) => {
    const dentro = 1 - suave(Lc / 2 - 0.004, Lc / 2 + 0.006, Math.abs(x));
    const torce = (1 - dentro) * Math.abs(Math.sin(a * 3 + x * 260)) ** 4;
    const vinco = Math.abs(Math.sin(x * 90 + a * 2 + fbm(x * 30, y * 30, z * 30, k.s) * 3)) ** 20;
    const c = mix(C('#f6f2e6'), mix(C('#f2dc8a'), C('#c8d0a0'), 0.15 * fbm(x * 200, y * 200, z * 200, k.s)), dentro * 0.55);
    return mul(c, 1 - 0.1 * torce - 0.06 * vinco);
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 34, m: 18, cor: papel,
    perfil: (t) => {
      const x = Math.abs(lerp(-L / 2, L / 2, t));
      const q = x < Lc / 2 ? 1 : lerp(1, 0.16, suave(Lc / 2, Lc / 2 + L * 0.08, x)) + 0.25 * suave(L / 2 - 0.02, L / 2, x);
      return { ry: r * q, rz: r * q, cy: r };
    },
    mod: (t, a) => {
      const x = Math.abs(lerp(-L / 2, L / 2, t));
      return 1 + (x > Lc / 2 ? 0.25 * Math.sin(a * 3 + x * 260) : 0.02 * Math.sin(a * 5 + t * 30));
    },
    desloc: (p) => { if (p.y < r * 0.1) p.y = r * 0.1 - (r * 0.1 - p.y) * 0.3; },
  }), 'acetinado', true)];
}

/** Ossobuco refogado: rodela grossa com o osso e o tutano no meio, carne escura do molho e barbante em volta. */
function gOssobuco(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const rOsso = R * 0.27, rTut = R * 0.16;
  const molho = (x: number, y: number, z: number) => mul(mix(C('#6a2a16'), C('#8a3e1e'), 0.5 + 0.5 * fbm(x * 80, y * 80, z * 80, k.s)), 0.95);
  const face: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z);
    if (r < rTut) return mix(C('#a86a48'), C('#7a4a30'), fbm(x * 300, z * 300, 0, k.s) * 0.5 + 0.3);
    if (r < rOsso) return mul(C('#e8dcc0'), 0.9 + 0.1 * ruido(x * 600, z * 600, 0, k.s));
    // músculos separados por veios de tecido (o que deixa o ossobuco macio)
    const cel = celula(x * 70, z * 70, 0, k.s);
    const veio = suave(0.88, 0.97, cel);
    const c = mix(mul(C('#7a3a24'), 0.9 + 0.15 * fbm(x * 200, z * 200, 0, k.s)), C('#d8b088'), veio * 0.6);
    return mix(c, molho(x, y, z), suave(R * 0.85, R, r) * 0.7);
  };
  out.push(parte(rodela(R, H, (x, y, z) => (y > H * 0.97 ? face(x, y, z, 0, 0) : molho(x, y, z)), {
    n: 28, m: 34, mod: (t, a) => 1 + 0.07 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t, k.s) + 0.04 * Math.sin(a * 5),
    desloc: (p) => { const r = Math.hypot(p.x, p.z); if (p.y > H * 0.9 && r > rOsso) p.y += 0.003 * fbm(p.x * 60, p.z * 60, 0, k.s); },
  }), 'brilhante', true));
  out.push(parte(tornoAnel({ caminho: [[rOsso, 0.001], [rOsso * 1.02, H + 0.004], [rTut * 1.05, H + 0.005], [rTut, H * 0.92]], n: 12, m: 20, cor: tn(C('#e4d8bc'), 0.06, 400, k.s) }), 'acetinado'));
  const anel: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    anel.push(V(Math.cos(a) * R * 1.02, H * 0.5, Math.sin(a) * R * 1.02));
  }
  out.push(parte(fio(anel, 0.0012, { fechado: true, n: 40, cor: C('#9a7448') }), 'fosco'));
  return out;
}

/** Leque de fatias de carne (alcatra rosada, cordeiro em borboleta, bifes de fígado). */
function gLequeCarne(k: Ctx): Parte[] {
  const L = k.T, n = k.v.n ?? 6;
  const figado = k.tem('figado');
  const Lf = L * (figado ? 0.5 : 0.45), Wf = L * k.L, e = L * k.A;
  const face = (i: number): Face => (xd, zd, r, x, y, z) => {
    if (figado) {
      const c = mul(mix(k.c1, k.c2, suave(0.3, 0.9, fbm(x * 60, y * 60, z * 60, k.s + i)) * 0.5), 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, k.s));
      return mix(c, C('#c8b0a8'), 0.15 * (1 - suave(0.04, 0.12, celula(x * 160, z * 160, 0, k.s + i))));
    }
    const fib = 0.94 + 0.08 * Math.abs(Math.sin((x + z * 0.3) * 600 + fbm(x * 60, z * 60, 0, k.s) * 3));
    const rr = r + 0.06 * fbm(xd * 3, zd * 3, i, k.s);
    let c = mul(mix(k.ci, C('#9a5a4a'), suave(0.6, 0.86, rr)), fib);
    c = mix(c, mul(k.cc, 0.85 + 0.3 * fbm(x * 200, y * 200, z * 200, k.s + i)), suave(0.86, 0.93, rr));
    return c;
  };
  const fs = leque(n, (i) => fatia(Lf, Wf, e, face(i), { exp: figado ? 2.1 : 2.6, irreg: figado ? 0.2 : 0.1, s: k.s + i, nx: 10, nz: 8 }), { passo: L * 0.1, giro: figado ? 0.25 : 0.1, ergue: e * 0.55, inclina: 0.12 });
  return fs.map((g, i) => parte(g, figado ? 'umido' : 'acetinado', i === 0));
}

/** Arroz jasmim cozido em montinho de grãos soltos. */
function gArrozGraos(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const grao: CorFn = (x, y, z) => mix(k.c1, k.c2, 0.4 * fbm(x * 600, y * 600, z * 600, k.s));
  const dome = (r: number) => H * Math.max(0, 1 - (r / R) ** 2) ** 0.7;
  out.push(parte(torno({
    caminho: (s) => (s < 0.15 ? [R * 0.98 * (s / 0.15), 0] : [R * 0.98 * (1 - (s - 0.15) / 0.85), dome(R * 0.98 * (1 - (s - 0.15) / 0.85)) * 0.94]),
    n: 14, m: 24,
    cor: (x, y, z) => mul(grao(x, y, z, 0, 0), 0.9 - 0.08 * Math.abs(Math.sin(x * 700 + z * 500)) ** 3),
    mod: (t, a) => 1 + 0.04 * ruido(Math.cos(a) * 4, t * 5, Math.sin(a) * 4, k.s),
  }), 'acetinado', true));
  const n = 150;
  for (let i = 0; i < n; i++) {
    const rr = R * 0.95 * Math.sqrt(k.r.n()), a = k.r.f(0, TAU);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const g = elipsoide(0.0034, 0.001, 0.0012, (X, Y, Z) => grao(X + i * 0.01, Y, Z, 0, 0), 4, 5);
    tf(g, [x, dome(rr) * 0.94 + 0.0006, z], [k.r.f(-0.5, 0.5), k.r.f(0, TAU), k.r.f(-0.3, 0.3)]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* cordeiro: carré limpo, coroa, guarda de honra, sela, noisettes       */
/* ------------------------------------------------------------------ */

/**
 * Carré em pé ao longo de X: olho do lombo embaixo, capa fina de gordura do lado de fora (+Z) e
 * os ossos limpos subindo, inclinados `incl` em Z na ponta. Devolve [carne, ossos].
 */
function carreEmPe(k: Ctx, n: number, esp: number, incl: number, assado: boolean): { carne: THREE.BufferGeometry; ossos: THREE.BufferGeometry[]; L: number } {
  const L = n * esp, H = 0.06, Z = 0.022;
  const crua = carneCrua(C('#b04a4e'), k.s, 0.12, 0.003);
  const gord = gordura(k.s);
  const tost = corAssada(C('#9a5a2c'), C('#4a2410'), k.s, 50, 0.6);
  const cor: CorFn = (x, y, z, t, a) => {
    const capa = suave(Z * 0.55, Z * 0.8, z + 0.003 * fbm(x * 60, y * 60, 0, k.s));
    const c = mix(crua(x, y, z, t, a), gord(x, y, z, t, a), capa);
    return assado ? mix(c, tost(x, y, z, t, a), 0.85) : c;
  };
  const corte: CorFn = (x, y, z) => {
    const olho = Math.hypot((y - H * 0.38) / (H * 0.32), (z + Z * 0.1) / (Z * 0.7));
    let c = mul(C('#c05058'), 0.92 + 0.1 * fbm(y * 300, z * 300, 0, k.s));
    c = mix(c, C('#f0e4d0'), suave(0.95, 1.05, olho) * 0.8);
    c = mix(c, C('#f2e8d6'), suave(Z * 0.6, Z * 0.8, z));
    return assado ? mix(mix(c, C('#d07068'), 0.2), C('#8a5a40'), suave(0.85, 1, Math.max(Math.abs(z) / Z, y / H))) : c;
  };
  const carne = corpo({
    x0: -L / 2, x1: L / 2, n: Math.max(10, n * 3), m: 22, exp: 2.6, tampa: true, aneisTampa: 4, cor, corTampa: corte,
    perfil: (t) => ({ ry: H / 2, rz: Z, cy: H / 2 }),
    mod: (t, a) => 1 + 0.06 * Math.max(0, Math.cos(a)) * Math.abs(Math.sin(t * n * PI)) + 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), k.s),
    desloc: (p) => { if (p.y > H * 0.7) p.z -= (p.y - H * 0.7) * 0.5; },
  });
  const corOsso: CorFn = (x, y, z) => mul(assado ? mix(OSSO, C('#b08a5a'), 0.45) : OSSO, 0.9 + 0.1 * fbm(x * 300, y * 300, z * 300, k.s));
  const ossos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = lerp(-L / 2, L / 2, (i + 0.5) / n);
    ossos.push(tubo([V(x, H * 0.55, -Z * 0.2), V(x, H * 1.05, -Z * 0.15 + incl * 0.3), V(x, H * 1.5, incl * 0.7), V(x, H * 1.75, incl)], {
      raio: (t) => 0.0042 * (1 + 0.35 * suave(0.85, 1, t)), achata: 0.7, cima: V(1, 0, 0), m: 8, n: 12, cor: corOsso,
    }));
  }
  return { carne, ossos, L };
}

/** Curva uma peça feita ao longo de X em volta do eixo Y (raio R): x vira ângulo, z vira raio a mais. */
function curvar(g: THREE.BufferGeometry, R: number, a0: number): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = a0 + x / R, r = R + z;
    p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Carré de cordeiro limpo (deitado), coroa (dois carrés em círculo, ossos para fora) ou guarda de honra (ossos cruzados). */
function gCarre(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const assado = k.tem('assado');
  const ac = assado ? 'brilhante' : 'umido';
  if (k.tem('coroa')) {
    const n = 7, esp = 0.021;
    const R = (2 * n * esp) / TAU;
    for (let j = 0; j < 2; j++) {
      const { carne, ossos } = carreEmPe(ctxCom(k, {}, { s: k.s + j }), n, esp, 0.016, assado);
      out.push(parte(curvar(carne, R, j * PI + PI / 2), ac, j === 0));
      for (const o of ossos) out.push(parte(curvar(o, R, j * PI + PI / 2), 'acetinado'));
    }
    const anel: THREE.Vector3[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      anel.push(V(Math.cos(a) * (R + 0.023), 0.048, Math.sin(a) * (R + 0.023)));
    }
    out.push(parte(fio(anel, 0.0013, { fechado: true, n: 48, cor: assado ? C('#9a7448') : BARBANTE }), 'fosco'));
    return out;
  }
  if (k.tem('guarda')) {
    const n = 6, esp = 0.024;
    for (const sg of [-1, 1]) {
      const { carne, ossos } = carreEmPe(ctxCom(k, {}, { s: k.s + sg }), n, esp, -0.05, assado);
      for (const g of [carne, ...ossos]) {
        if (sg < 0) tf(g, [0, 0, 0], [0, PI, 0]);
        tf(g, [sg * esp * 0.25, 0, sg * 0.032]);
      }
      out.push(parte(carne, ac, sg < 0));
      for (const o of ossos) out.push(parte(o, 'acetinado'));
    }
    return out;
  }
  const { carne, ossos } = carreEmPe(k, k.v.n ?? 7, 0.024, 0.0, assado);
  for (const g of [carne, ...ossos]) tf(g, [0, 0, 0], [-PI / 2 + 0.25, 0, 0]);
  out.push(parte(carne, ac, true));
  for (const o of ossos) out.push(parte(o, 'acetinado'));
  return out;
}

/**
 * Lombo de cordeiro com osso: o olho rosado comprido com a capa de gordura creme por cima e,
 * de um lado, a fileira de costelas curtas saindo em arco, com as pontas dos ossos aparentes.
 */
function gSelaCordeiro(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, H = Math.min(0.056, L * 0.2), W = Math.min(0.07, L * 0.25), n = Math.max(5, Math.round(L / 0.03));
  const crua = carneCrua(k.c1, k.s, 0.15, 0.003);
  const gord = gordura(k.s, '#f2e6d0');
  const zc = 0.042 * 0.4;
  const fora: CorFn = (x, y, z, t, a) => mix(crua(x, y, z, t, a), gord(x, y, z, t, a), 0.8 * suave(H * 0.76, H * 0.93, y + H * 0.08 * fbm(x * 40, 0, z * 40, k.s)));
  const corte: CorFn = (x, y, z, t, a) => {
    const olho = Math.hypot((y - H * 0.42) / (H * 0.34), (z - zc - W * 0.06) / (W * 0.36));
    const c = mul(k.ci, 0.9 + 0.12 * fbm(y * 300, z * 300, x, k.s));
    return mix(c, gord(x, y, z, t, a), Math.max(suave(1, 1.15, olho) * 0.8, suave(H * 0.7, H * 0.86, y)));
  };
  const aba: CorFn = (x, y, z, t, a) => mix(crua(x, y, z, t, a), gord(x, y, z, t, a), 0.35 + 0.3 * suave(-0.2, 0.5, fbm(x * 70, y * 70, z * 70, k.s + 2)));
  const osso: CorFn = (x, y, z) => mul(mix(OSSO, C('#e8c8b8'), 0.2), 0.9 + 0.1 * fbm(x * 300, y * 300, z * 300, k.s));
  const { carne, ossos } = pecaCostelas({ L, H, W, n, aba: 0.042, sobe: H * 0.4, limpo: 0.38, rOsso: 0.0055, esp: 0.012, fora, corte, aba2: aba, osso, s: k.s });
  carne.forEach((g, i) => out.push(parte(g, 'umido', i === 0)));
  for (const g of ossos) out.push(parte(g, 'acetinado'));
  return out;
}

/** Noisette de cordeiro dourada: napada de creme com tomilho, ou com as listras da chapa. */
function gNoisette(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const chapa_ = k.tem('chapa');
  const crosta = corAssada(C('#9a5a2c'), C('#4a2410'), k.s, 90, 0.6);
  const topo: CorFn = chapa_ ? grelha(crosta, 0.012, 0.7, C('#26120a'), 0.26) : crosta;
  const lado: CorFn = (x, y, z, t, a) => {
    const r = Math.hypot(x, z) / R;
    const anel = suave(0.82, 0.92, r);
    return mix(mix(C('#b85a58'), C('#8a5040'), suave(0.15, 0.0, Math.min(y, H - y) / H) ), mix(C('#e8d8bc'), C('#b07a44'), 0.5), anel * 0.8);
  };
  out.push(parte(rodela(R, H, (x, y, z, t, a) => (y > H * 0.96 ? topo(x, y, z, t, a) : lado(x, y, z, t, a)), { n: 22, m: 28, mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t, k.s) }), 'brilhante', true));
  if (k.tem('creme')) {
    out.push(parte(torno({ caminho: [[0, H * 0.98], [R * 0.86, H * 0.98], [R * 0.9, H + 0.0025], [R * 0.5, H + 0.0045], [0, H + 0.005]], n: 10, m: 24, cor: tn(C('#efe0c0'), 0.06, 200, k.s), mod: (t, a) => 1 + 0.12 * Math.sin(a * 3 + 1) * suave(0.2, 0.6, t) }), 'brilhante'));
    out.push(...tomilho(V(-R * 0.4, H + 0.004, -R * 0.1), R * 0.9, 0.4, k.r).map((g) => parte(g, 'fosco')));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* decoração: feixe de vagem, cebolinha glaceada                         */
/* ------------------------------------------------------------------ */

function gFeixeVagem(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, r = 0.0036;
  const verde: CorFn = (x, y, z) => mul(mix(k.c1, k.c2, 0.3 + 0.3 * fbm(x * 80, y * 80, z * 80, k.s)), 0.92 + 0.1 * ruido(x * 400, y * 400, z * 400, k.s));
  const pos: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0.5, 0.87], [-0.5, 0.87], [0, 1.73], [1.5, 0.87]];
  pos.forEach(([a, b], i) => {
    const dz = a * r * 2.05, dy = r + b * r * 1.9;
    const l = L * (0.92 + 0.08 * Math.sin(i * 2.3)), dx = L * 0.03 * Math.sin(i * 1.7);
    out.push(parte(tubo([V(-l / 2 + dx, dy, dz), V(dx, dy + 0.001 * Math.sin(i), dz + 0.0015 * Math.cos(i)), V(l / 2 + dx, dy, dz)], {
      raio: (t) => r * (1 - 0.6 * suave(0.88, 1, t) - 0.3 * suave(0.1, 0, t)) * (1 + 0.06 * Math.sin(t * 60)), m: 8, n: 16, cor: verde,
    }), 'brilhante', i === 0));
  });
  // tirinha de pimentão escaldado amarrando o feixe
  const anel: THREE.Vector3[] = [];
  const cy = r * 2.6, ry = r * 2.9, rz = r * 3.4;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    anel.push(V(0, Math.max(0.0008, cy + ry * Math.cos(a)), rz * Math.sin(a)));
  }
  out.push(parte(tubo(anel, { raio: 0.003, achata: 0.25, cima: V(1, 0, 0), fechado: true, m: 6, n: 24, cor: tn(C('#c8241a'), 0.08, 300, k.s) }), 'brilhante'));
  for (const sg of [-1, 1]) out.push(parte(faixa([V(0, cy + ry, 0), V(sg * 0.006, cy + ry + 0.002, 0.002), V(sg * 0.011, cy + ry - 0.001, 0.004)], 0.005, 0.0012, tn(C('#c8241a'), 0.08, 300, k.s), V(0, 1, 0), 8), 'brilhante'));
  return out;
}

function gCebolinhaGlaceada(k: Ctx): Parte[] {
  const R = k.T / 2, H = k.T * k.A;
  return [parte(torno({
    caminho: [[0, 0], [R * 0.35, H * 0.03], [R * 0.85, H * 0.22], [R, H * 0.48], [R * 0.78, H * 0.8], [R * 0.25, H * 0.97], [0, H]],
    n: 14, m: 18,
    cor: (x, y, z, t, a) => {
      const veio = Math.abs(Math.sin(a * 9)) ** 14;
      const c = mix(k.c1, k.c2, suave(0.3, 0.95, t) * 0.5 + 0.15 * fbm(x * 200, y * 200, z * 200, k.s));
      return mul(c, 0.95 + 0.06 * veio + 0.08 * suave(0.6, 1, t));
    },
    mod: (t, a) => 1 + 0.03 * Math.sin(a * 2 + k.s),
  }), 'brilhante', true)];
}

/* ------------------------------------------------------------------ */
/* porco: lombo com túnel, costeleta com osso, pernil em losangos,      */
/* costelinhas; bacon esticado; hambúrguer com queijo; peritônio        */
/* ------------------------------------------------------------------ */

/** Lombo de porco com o túnel recheado de ameixa aparecendo nas pontas cortadas. */
function gLomboTunel(k: Ctx): Parte[] {
  const L = k.T, ry = (L * k.A) / 2, rz = (L * k.L) / 2;
  const crua = carneCrua(k.c1, k.s, 0.15);
  const gord = gordura(k.s);
  const cor: CorFn = (x, y, z, t, a) => mix(crua(x, y, z, t, a), gord(x, y, z, t, a), suave(ry * 1.55, ry * 1.7, y + 0.004 * fbm(x * 40, 0, z * 40, k.s)));
  const corte: CorFn = (x, y, z) => {
    const rho = Math.hypot((y - ry) / ry, z / rz);
    if (rho < 0.3 + 0.05 * Math.sin(Math.atan2(z, y - ry) * 3)) return mix(C('#3a1820'), C('#6a2a30'), suave(0.2, 0.8, celula(y * 400, z * 400, x, k.s)) * 0.6);
    let c = mul(k.ci, 0.93 + 0.1 * fbm(y * 300, z * 300, 0, k.s));
    if (y > ry * 1.6) c = gord(x, y, z, 0, 0);
    return c;
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 18, m: 24, exp: 2.4, tampa: true, aneisTampa: 6, cor, corTampa: corte,
    perfil: (t) => ({ ry: ry * (1 - 0.06 * (1 - suave(0, 0.06, Math.min(t, 1 - t)))), rz, cy: ry }),
    mod: (t, a) => 1 + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), k.s),
    desloc: (p) => { if (p.y < ry * 0.25) p.y = ry * 0.25 - (ry * 0.25 - p.y) * 0.3; },
  }), 'umido', true)];
}

/** Costeleta de porco com o osso da costela: crua, dourada, grelhada com sálvia ou com o bolso recheado. */
function gCosteleta(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, recheada = k.tem('recheada');
  const e = L * k.A * (recheada ? 1.35 : 1);
  const crua = carneCrua(k.c1, k.s, 0.1, 0.003);
  const gord = gordura(k.s);
  const dour = corAssada(C('#b07038'), C('#5a2c10'), k.s, 70, 0.6);
  const grel = k.tem('grelhada'), assada = k.tem('dourada') || grel;
  const base: CorFn = assada ? dour : crua;
  const topo: CorFn = grel ? grelha(dour, 0.016, 0.7, C('#24120a'), 0.24) : base;
  // contorno: olho redondo e a cauda que afina, com o osso ao longo da borda de trás (-Z)
  const g = placa(16, 12, (xd, zd) => {
    const x = xd * L / 2, z = zd * W / 2;
    const cauda = suave(0.1, 1, xd) * 0.35;
    return [x, z * (1 - cauda) - cauda * W * 0.12];
  }, (xd, zd, r) => e * (1 - 0.3 * r ** 5), (x, y, z, u, v) => {
    const [xd, zd] = noDisco(u, v);
    const r = Math.hypot(xd, zd);
    const borda = suave(0.8, 0.9, r) * suave(-0.3, 0.3, zd);
    const c = mix(y > e * 0.6 ? topo(x, y, z, 0, 0) : base(x, y, z, 0, 0), assada ? mix(gord(x, y, z, 0, 0), C('#c08a48'), 0.6) : gord(x, y, z, 0, 0), borda);
    if (recheada) {
      const fenda = (1 - suave(0.08, 0.2, Math.abs(y - e * 0.5) / e)) * suave(0.84, 0.95, r) * suave(0.1, 0.4, zd);
      return mix(c, mix(C('#2a4a1a'), C('#4a7a2a'), fbm(x * 300, y * 300, z * 300, k.s)), fenda);
    }
    return c;
  }, (xd, zd, r) => e * 0.08 * r ** 5);
  out.push(parte(g, assada ? 'brilhante' : 'umido', true));
  const corOsso: CorFn = (x, y, z) => mul(assada ? mix(OSSO, C('#b08a5a'), 0.4) : OSSO, 0.88 + 0.12 * fbm(x * 300, y * 300, z * 300, k.s));
  out.push(parte(tubo([V(L * 0.15, e * 0.75, -W * 0.36), V(-L * 0.2, e * 0.8, -W * 0.42), V(-L * 0.48, e * 0.7, -W * 0.4), V(-L * 0.64, e * 0.6, -W * 0.36)], {
    raio: (t) => 0.006 * (1 + 0.3 * suave(0.85, 1, t)), achata: 0.75, cima: V(0, 1, 0), m: 10, n: 16, cor: corOsso,
  }), 'acetinado'));
  if (grel) {
    const s = folha(L * 0.32, L * 0.13, C('#6a7a58'), C('#9aa68a'), { contorno: contornos.oval, curva: 0.03, n: 10, m: 6 });
    tf(s, [-L * 0.15, e + 0.0008, W * 0.02], [0, 0.3, 0]);
    out.push(parte(s, 'fosco'));
  }
  if (recheada) {
    for (let i = 0; i < 3; i++) {
      const f = folha(L * 0.12, L * 0.07, C('#2e5a1e'), C('#4a7a2a'), { contorno: contornos.oval, curva: -0.2, n: 6, m: 5 });
      tf(f, [lerp(-L * 0.15, L * 0.2, i / 2), e * 0.5, W * 0.44], [0, -PI / 2 + 0.3 * (i - 1), 0.3]);
      out.push(parte(f, 'brilhante'));
    }
  }
  return out;
}

/** Pernil com a gordura riscada em losangos: cru, ou assado com crosta de temperos. */
function gPernilLosangos(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, H = L * k.A, W = L * k.L;
  const crosta = k.tem('crosta');
  const prof = (t: number) => Math.sin(PI * (0.04 + 0.92 * t)) ** 0.55 * lerp(1, 0.42, suave(0.3, 0.95, t));
  const crua = carneCrua(k.c1, k.s, 0.1);
  const gordC = crosta ? C('#c07a34') : C('#f2e4cc');
  const sulcoC = crosta ? C('#5a2408') : C('#c86a66');
  const losango = (x: number, z: number) => {
    const a = Math.abs(fr((x + z) / 0.034) - 0.5) * 2, b = Math.abs(fr((x - z) / 0.034) - 0.5) * 2;
    return Math.max(suave(0.86, 0.95, a), suave(0.86, 0.95, b));
  };
  const cor: CorFn = (x, y, z, t, a) => {
    const capa = suave(-0.1, 0.25, Math.cos(a));
    const s = losango(x, z) * capa;
    let g = mul(gordC, 0.92 + 0.12 * fbm(x * 50, y * 50, z * 50, k.s));
    if (crosta) g = mix(g, C('#5a2a10'), 0.35 * suave(0.3, 0.9, ruido(x * 500, y * 500, z * 500, k.s)));
    const c = mix(crosta ? mix(crua(x, y, z, t, a), C('#9a5a2a'), 0.8) : crua(x, y, z, t, a), g, capa);
    return mix(c, sulcoC, s);
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L * 0.4, n: 28, m: 28, exp: 2.2, cor,
    perfil: (t) => ({ ry: (H / 2) * prof(t), rz: (W / 2) * prof(t), cy: (H / 2) * prof(t) }),
    mod: (t, a) => 1 - 0.012 * losango(lerp(-L / 2, L * 0.4, t), Math.sin(a) * W / 2) * suave(-0.1, 0.25, Math.cos(a)) + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), k.s),
    desloc: (p) => { if (p.y < H * 0.08) p.y = H * 0.08 - (H * 0.08 - p.y) * 0.3; },
  }), crosta ? 'brilhante' : 'acetinado', true));
  const corOsso: CorFn = (x, y, z) => mul(crosta ? mix(OSSO, C('#a87a48'), 0.5) : OSSO, 0.9 + 0.1 * fbm(x * 200, y * 200, z * 200, k.s));
  out.push(parte(osso([V(L * 0.3, H * 0.22, 0), V(L * 0.42, H * 0.22, 0), V(L * 0.5, H * 0.22, 0)], 0.011, mul(OSSO, crosta ? 0.85 : 1), 1.6), 'acetinado'));
  void corOsso;
  return out;
}

/**
 * Costelinhas de porco: duas ripas de costela (placas chatas com os ossos paralelos aparentes e as
 * pontas saindo na borda), uma meio por cima da outra; laqueadas marrom-avermelhadas e brilhantes,
 * ou cruas pinceladas de glaçagem âmbar.
 */
function gCostelinhas(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, laq = k.tem('laqueada');
  const comp = L * 0.62, larg = Math.min(0.1, L * k.L * 0.5), esp = 0.017;
  const crua = carneCrua(k.c1, k.s, 0.1, 0.003);
  const laca = corAssada(C('#8a2e12'), C('#3e1006'), k.s, 70, 0.75);
  const cor: CorFn = laq
    ? (x, y, z, t, a) => mix(laca(x, y, z, t, a), C('#b0501e'), 0.25 * suave(0.2, 0.8, fbm(x * 90, y * 90, z * 90, k.s)))
    : (x, y, z, t, a) => mix(crua(x, y, z, t, a), C('#d89a48'), 0.3 + 0.12 * fbm(x * 80, y * 80, z * 80, k.s));
  const corOsso: CorFn = (x, y, z) => mul(laq ? mix(OSSO, C('#7a4a26'), 0.65) : mix(OSSO, C('#e0b070'), 0.2), 0.88 + 0.12 * fbm(x * 300, y * 300, z * 300, k.s));
  const ripas: [number, number, number, number][] = [[-L * 0.08, 0, -larg * 0.42, 0.12], [L * 0.1, esp * 0.75, larg * 0.5, -0.18]];
  ripas.forEach(([x, y, z, rot], j) => {
    for (const [i, g] of placaCostelas(comp, larg, esp, 5, cor, corOsso, k.s + j).entries()) {
      tf(g, [x, y, z], [j ? 0.06 : 0, rot + (j ? PI : 0), 0]);
      out.push(parte(g, i ? 'acetinado' : 'brilhante', j === 0 && i === 0));
    }
  });
  return out;
}

/** Duas fatias longas de bacon esticadas lado a lado. */
function gBaconEsticado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, w = 0.032, e = 0.0028;
  for (const sg of [-1, 1]) {
    const s = k.s + sg;
    const g = chapa(24, 6, (u, v, lado) => {
      const x = (u - 0.5) * L * (sg > 0 ? 0.97 : 1);
      return [x, lado * e + 0.0015 * Math.sin(u * 9 + sg) * (1 - lado * 0.2), sg * w * 0.56 + v * (w / 2) * (1 + 0.06 * Math.sin(u * 13 + s))];
    }, (x, y, z, u, v) => {
      const f = fr((v + 1) * 1.6 + 0.25 * fbm(u * 6, sg, 0, s));
      const c = mix(C('#b23c3c'), C('#f2e2d0'), suave(0.32, 0.42, f) * (1 - suave(0.68, 0.78, f)));
      return mul(c, 0.9 + 0.14 * fbm(x * 200, y * 200, z * 200, s));
    });
    out.push(parte(g, 'acetinado', sg < 0));
  }
  return out;
}

/** Hambúrguer com a fatia de queijo derretida escorrendo pelas bordas. */
function gHamburguerQueijo(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = 0.018;
  const crosta = corAssada(C('#7a4024'), C('#3a1c0c'), k.s, 120, 0.7);
  const lado: CorFn = (x, y, z) => mix(mul(C('#8a4a34'), 0.8 + 0.3 * fbm(x * 400, y * 400, z * 400, k.s)), C('#5a2a16'), 0.3 * (1 - suave(0.1, 0.3, celula(x * 600, y * 600, z * 600, k.s))));
  out.push(parte(rodela(R, H, (x, y, z, t, a) => (y > H * 0.95 ? crosta(x, y, z, t, a) : lado(x, y, z, t, a)), { n: 18, m: 26, mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, t, k.s) }), 'acetinado', true));
  const S = R * 1.55;
  const g = chapa(16, 16, (u, v, lado) => {
    let x = (u - 0.5) * S, z = v * S / 2;
    const a = 0.6;
    [x, z] = [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
    const r = Math.hypot(x, z);
    const fora = Math.max(0, r - R * 0.92);
    const pinga = fora > 0 ? fora * 1.9 + 0.004 * Math.sin(Math.atan2(z, x) * 5 + k.s) : 0;
    const y = H + 0.0015 - Math.min(H * 0.7, pinga) + lado * 0.0018;
    const k2 = fora > 0 ? (R * 0.95 + fora * 0.35) / r : 1;
    return [x * k2, y, z * k2];
  }, (x, y, z) => mix(C('#f2d478'), C('#e8b850'), 0.3 + 0.3 * fbm(x * 90, y * 90, z * 90, k.s)));
  out.push(parte(g, 'brilhante'));
  return out;
}

/** Peritônio (crépine): membrana fina e translúcida com a renda de gordura. */
function gPeritonio(k: Ctx): Parte[] {
  const L = k.T, W = L * k.L;
  return [parte(chapa(26, 20, (u, v, lado) => {
    const x = (u - 0.5) * L, z = v * W / 2 * (1 + 0.08 * Math.sin(u * 7 + k.s));
    const y = 0.006 * (0.5 + 0.5 * Math.sin(x * 60 + z * 40)) * (0.6 + 0.4 * fbm(x * 15, z * 15, 0, k.s)) + 0.004 + lado * 0.0006;
    return [x, y, z];
  }, (x, y, z) => {
    const c = celula(x * 70, z * 70, 0, k.s);
    const veio = suave(0.72, 0.9, c) + 0.7 * suave(0.85, 0.97, celula(x * 160, z * 160, 0, k.s + 3));
    return mix(mix(C('#d8a49c'), C('#e8c0b8'), 0.5 + 0.5 * fbm(x * 40, z * 40, 0, k.s)), C('#fcf6ea'), clamp(veio));
  }), 'umido', true)];
}

/* ------------------------------------------------------------------ */
/* miúdos: pé de porco, rabada, bucho                                   */
/* ------------------------------------------------------------------ */

/**
 * Pé de porco cortado ao meio no comprimento, as duas metades deitadas com o corte para cima:
 * borda de pele rosada-acinzentada, miolo de tendão e gelatina com a fileira de ossinhos claros
 * e, na ponta, metade do casco (um dedo com a unha córnea). Cozido fica creme, gelatinoso e brilhante.
 */
function gPeMetades(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, R = L * 0.13;
  const coz = k.tem('cozido');
  const xCasco = L * 0.26;
  // canela larga no tornozelo, afinando até os dedos
  const larg = (t: number) => lerp(1.05, 0.72, t) * (1 + 0.14 * Math.exp(-(((t - 0.62) / 0.1) ** 2))) * Math.sin(PI * (0.04 + 0.92 * t)) ** 0.22;
  const pele: CorFn = (x, y, z) => {
    const dobra = Math.abs(Math.sin(x * 170 + 2 * fbm(y * 40, z * 40, 0, k.s))) ** 8 * suave(-L * 0.1, L * 0.05, x) * suave(L * 0.2, L * 0.08, x);
    const c = coz ? mix(C('#c8a074'), C('#b08454'), 0.3 + 0.3 * fbm(x * 60, y * 60, z * 60, k.s)) : mix(C('#cc9a8c'), C('#a88a84'), 0.25 + 0.3 * fbm(x * 60, y * 60, z * 60, k.s));
    return mul(c, (1 - 0.16 * dobra) * (0.96 + 0.06 * ruido(x * 500, y * 500, z * 500, k.s)));
  };
  const corte = (_sg: number): CorFn => (x, y, z) => {
    const zz = Math.abs(z) / (R * 0.95 * (1 + 0.14 * Math.exp(-((((x + L / 2) / (xCasco + L / 2) - 0.62) / 0.1) ** 2))));
    const borda = suave(0.72, 0.88, zz);
    // ossinhos em fila (metatarsos e falanges), cortados no comprimento
    const fase = fr((x + L / 2) / (L * 0.12) + 0.1 * fbm(z * 80, 0, 0, k.s));
    const osso = suave(0.08, 0.16, fase) * suave(0.95, 0.85, fase) * (1 - suave(0.26, 0.38, zz));
    const gel = coz ? mix(C('#c89a62'), C('#dcb47c'), 0.4 + 0.4 * fbm(x * 150, z * 150, 0, k.s)) : mix(C('#e2a898'), C('#cc8a7c'), 0.3 + 0.4 * fbm(x * 150, z * 150, 0, k.s));
    let c = mix(gel, mul(coz ? C('#f4ecdc') : OSSO, 0.95 + 0.08 * fbm(x * 300, z * 300, 0, k.s)), osso);
    c = mix(c, mix(C('#c87a5a'), C('#a86048'), 0.5), (1 - suave(0.05, 0.12, Math.abs(zz - 0.5))) * (1 - osso) * 0.25);
    return mix(c, pele(x, y, z, 0, 0), borda);
  };
  for (const sg of [-1, 1]) {
    const g = corpo({
      x0: -L / 2, x1: xCasco + L * 0.03, n: 24, m: 20, cor: (x, y, z, t, a) => (y > R * 0.97 ? corte(sg)(x, y, z, t, a) : pele(x, y, z, t, a)),
      perfil: (t) => ({ ry: R * larg(t), rz: R * 0.95 * larg(t), cy: R * 0.98 }),
      mod: (t, a) => 1 + 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), k.s + sg),
      desloc: (p) => { if (p.y > R) p.y = R; if (p.y < R * 0.25) p.y = R * 0.25 - (R * 0.25 - p.y) * 0.3; },
    });
    tf(g, [0, 0, sg * R * 1.25], [0, sg * 0.06, 0]);
    out.push(parte(g, coz ? 'brilhante' : 'acetinado', sg < 0));
    // metade do casco: um dedo com a unha córnea, curva, mais escura na ponta
    const casco = corpo({
      x0: xCasco, x1: L / 2, n: 12, m: 14,
      cor: (x, y, z) => mul(mix(C(coz ? '#9a8064' : '#8a7660'), C('#4a3c30'), suave(xCasco + L * 0.08, L / 2, x) * 0.55), 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, k.s)),
      perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - t ** 2.4)) * 0.85 + 0.12 * (1 - t); return { ry: R * 0.7 * e + R * 0.04, rz: R * 0.62 * e + R * 0.04, cy: R * 0.62 * e + R * 0.12 }; },
      desloc: (p) => { if (p.y < R * 0.08) p.y = R * 0.08; },
    });
    tf(casco, [0, 0, sg * R * 1.25], [0, sg * 0.06, 0]);
    out.push(parte(casco, 'acetinado'));
  }
  return out;
}

/** Rodelas de rabada refogadas, escuras e brilhantes, com a vértebra no meio. */
function gRabada(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T;
  const molho = (x: number, y: number, z: number) => mul(mix(C('#4a1c10'), C('#6a2c18'), 0.5 + 0.5 * fbm(x * 90, y * 90, z * 90, k.s)), 1);
  const pos: [number, number, number][] = [[-L * 0.22, -L * 0.2, 0.03], [L * 0.22, -L * 0.18, 0.027], [-L * 0.2, L * 0.21, 0.025], [L * 0.21, L * 0.2, 0.021]];
  pos.forEach(([x, z, R], i) => {
    const H = 0.032;
    const face: CorFn = (X, Y, Z) => {
      const r = Math.hypot(X, Z) / R;
      const ang = Math.atan2(Z, X);
      const osso_ = r < 0.32 + 0.08 * Math.cos(ang * 4) ? 1 : 0;
      const gord = suave(0.86, 0.95, celula(X * 90, Z * 90, i, k.s));
      let c = mix(mul(C('#6a2a1a'), 0.9 + 0.15 * fbm(X * 200, Z * 200, 0, k.s + i)), C('#c8a070'), gord * 0.5);
      c = mix(c, mix(C('#e0d0b0'), C('#a07050'), r < 0.12 ? 0.7 : 0), osso_);
      return mix(c, molho(X, Y, Z), suave(0.8, 1, r) * 0.6);
    };
    const g = rodela(R, H, (X, Y, Z) => (Y > H * 0.96 ? face(X, Y, Z, 0, 0) : molho(X, Y, Z)), { n: 18, m: 24, mod: (t, a) => 1 + 0.12 * Math.max(0, Math.cos(a * 4)) ** 2 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, i, k.s) });
    tf(g, [x, 0, z], [0, i * 1.3, 0]);
    out.push(parte(g, 'brilhante', i === 0));
  });
  return out;
}

/** Bucho em quadrados, com a textura de favo de mel (cozido, branco-creme). */
function gBucho(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const S = k.T * 0.46, e = 0.004;
  const favo = (x: number, z: number, s: number) => suave(0.55, 0.9, celula(x * 110, z * 110, 0, s));
  const pos: [number, number, number][] = [[-k.T * 0.25, -k.T * 0.12, 0.2], [k.T * 0.24, -k.T * 0.1, -0.3], [0, k.T * 0.2, 0.9]];
  pos.forEach(([x0, z0, rot], i) => {
    const g = chapa(18, 18, (u, v, lado) => {
      const x = (u - 0.5) * S, z = v * S / 2;
      const y = lado ? e + 0.0035 * favo(x, z, k.s + i) : 0.0005 * Math.sin(x * 50);
      return [x, y + 0.002 * Math.sin(u * 3 + i) * Math.sin(v * 2), z];
    }, (x, y, z) => {
      const f = favo(x, z, k.s + i);
      return mul(mix(k.c1, k.c2, 0.25 * fbm(x * 80, z * 80, 0, k.s)), 0.58 + 0.45 * f);
    });
    tf(g, [x0, i * 0.0015, z0], [0, rot, 0]);
    out.push(parte(g, 'acetinado', i === 0));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* legumes: guarnições de pimentão e pepino, maçã, repolho, brócolis,   */
/* couve-flor e espinafre refogado                                      */
/* ------------------------------------------------------------------ */

/** Quadrado de pimentão (curvo, brilhante por fora) e o torcidinho com a tira do meio torcida. */
function gPimentaoQuadrado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const S = k.T, e = 0.004, Rc = S * 1.4;
  const fora: CorFn = tn(k.c1, 0.08, 120, k.s), dentro: CorFn = tn(mix(k.c1, C('#f0c0a0'), 0.35), 0.06, 200, k.s);
  // abaulado para cima: a casca (face de cima) fica à vista
  const arco = (z: number) => Math.sqrt(Math.max(0, Rc * Rc - z * z)) - Rc + S * 0.1;
  const peca = (x0: number, x1: number, z0: number, z1: number, tor = 0, sobe = 0) => chapaL(Math.max(2, Math.round((x1 - x0) / S * 14)), Math.max(2, Math.round((z1 - z0) / S * 8)), (u, v, lado) => {
    const x = lerp(x0, x1, u), zc = (z0 + z1) / 2, hz = (z1 - z0) / 2;
    let z = zc + v * hz, y = arco(z) + lado * e;
    if (tor) {
      const th = tor * Math.sin(PI * u);
      const dy = y - arco(zc) - e / 2, dz = z - zc;
      y = arco(zc) + e / 2 + dy * Math.cos(th) - dz * Math.sin(th) + sobe * Math.sin(PI * u);
      z = zc + dy * Math.sin(th) + dz * Math.cos(th);
    }
    return [x, y, z];
  }, (x, y, z, u, v, lado) => (lado ? fora(x, y, z, 0, 0) : dentro(x, y, z, 0, 0)));
  if (!k.tem('torcido')) {
    out.push(parte(peca(-S / 2, S / 2, -S / 2, S / 2), 'brilhante', true));
    return out;
  }
  const a = S / 6, b = S * 0.36;
  out.push(parte(peca(-S / 2, S / 2, -S / 2, -a), 'brilhante', true));
  out.push(parte(peca(-S / 2, S / 2, a, S / 2), 'brilhante'));
  out.push(parte(peca(-S / 2, -b, -a, a), 'brilhante'));
  out.push(parte(peca(b, S / 2, -a, a), 'brilhante'));
  out.push(parte(peca(-b, b, -a * 0.85, a * 0.85, PI, S * 0.12), 'brilhante'));
  return out;
}

/** Bolinha de pimentão (miolo do botão de cenoura). */
const gPimentaoBolinha = (k: Ctx): Parte[] => [parte(elipsoide(k.T / 2, k.T * 0.42, k.T / 2, (x, y, z) => mix(k.c1, C('#ff8a6a'), suave(0.5, 1, y / (k.T * 0.42)) * 0.25), 7, 10), 'brilhante', true)];


/**
 * Pedaço de pepino cortado em quarto no comprimento (ponta do centro para baixo, casca em cima);
 * com os cortes em V paralelos aos lados planos, as camadas deslizam umas sobre as outras em leque.
 */
function gPepinoV(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const L = k.T, R = L * 0.4;
  const casca = (x: number, y: number, z: number) => mix(k.c1, k.c2, 0.3 * Math.abs(Math.sin(Math.atan2(z, y) * 16)) + 0.2 * fbm(x * 200, y * 200, z * 200, k.s));
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(y, z) / R;
    if (r > 0.94) return casca(x, y, z);
    if (r > 0.86) return mix(C('#9ac06a'), C('#d8e8b0'), 0.5);
    const sem = 1 - suave(0.3, 0.46, r);
    const c = mix(mul(k.ci, 0.97 + 0.05 * fbm(x * 300, y * 300, z * 300, k.s)), C('#eef4d8'), sem * 0.6);
    // sementes claras enfileiradas no miolo
    return mix(c, C('#f8f8e8'), sem * suave(0.6, 0.9, Math.abs(Math.sin(x * 380))) * 0.6);
  };
  // c = y - |z|: o V de cada corte é uma reta paralela aos lados planos (c constante)
  const toca = (c: number) => { const z = (-c + Math.sqrt(2 * R * R - c * c)) / 2; return Math.atan2(z, z + c); };
  const metade = (ca: number, cb: number | null): [number, number][] => {
    const pts: [number, number][] = [[ca, 0]];
    const aIni = cb === null ? 0 : toca(cb);
    if (cb !== null) pts.push([cb, 0]);
    const aFim = toca(ca);
    for (let i = 0; i <= 6; i++) {
      const a = lerp(aIni, aFim, i / 6);
      pts.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    return pts;
  };
  const cortes = k.tem('v') ? [0, R * 0.3, R * 0.6] : [0];
  cortes.forEach((ca, j) => {
    const cb = j < cortes.length - 1 ? cortes[j + 1] : null;
    const dx = (cortes.length - 1 - j) * 0 + j * L * 0.2;
    for (const sg of [1, -1]) {
      const poly = metade(ca, cb).map(([y, z]) => [y, sg * z] as [number, number]);
      out.push(parte(prisma(poly, -L / 2 + dx, L / 2 + dx, cor), 'acetinado', j === 0 && sg === 1));
    }
  });
  return out;
}

/** Gomos de maçã separados, caramelados e brilhantes, a casca vermelha por baixo. */
function gMacaGlaceada(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const rx = 0.036, ry = 0.04;
  const casca: CorFn = (x, y, z) => mix(k.c1, C('#e0a040'), 0.25 * suave(0.2, 0.9, fbm(x * 60, y * 60, z * 60, k.s)));
  const pos: [number, number, number][] = [[-0.045, -0.035, 0.4], [0.04, -0.04, -0.6], [-0.03, 0.04, 2.2], [0.045, 0.035, 3.6], [0, 0, 1.4]];
  pos.forEach(([x, z, rot], i) => {
    const gs = gomo(rx, ry, ry, PI / 4, casca, (X, Y, Z, rho) => {
      const car = mix(C('#e8b45a'), C('#9a5a1a'), suave(0.2, 0.9, fbm(X * 90, Y * 90, Z * 90, k.s + i)) * 0.6 + suave(0.8, 1, rho) * 0.3);
      return mix(car, mul(C('#c88a3a'), 0.9), (1 - suave(0.12, 0.22, rho)) * 0.5);
    }, { nu: 12, nv: 5, ponta: 0.7 });
    for (const g of gs) {
      tf(g, [0, ry, 0], [0, 0, 0]);
      tf(g, [x, 0, z], [0, rot, 0]);
      out.push(parte(g, 'brilhante', i === 4 && g === gs[0]));
    }
  });
  return out;
}

/** Quarto de repolho com o miolo branco (ou com o miolo já retirado), camadas de folha à mostra. */
function gRepolhoQuarto(k: Ctx): Parte[] {
  const R = k.T / 2;
  const sem = k.tem('semmiolo');
  const folhaCor: CorFn = (x, y, z) => {
    const nerv = Math.abs(Math.sin(Math.atan2(z, -y) * 7 + x * 30)) ** 20;
    return mul(mix(k.c1, k.c2, 0.25 * fbm(x * 40, y * 40, z * 40, k.s) + 0.4 * nerv), 0.92 + 0.1 * ruido(x * 300, y * 300, z * 300, k.s));
  };
  // miolo: cone branco que sai do talo (lado -X) para dentro
  const miolo = (u: number, rho: number) => rho < 0.42 * (1 - u) ** 0.8 && u < 0.85;
  const face = (x: number, y: number, z: number, rho: number, th: number): RGB => {
    if (rho > 0.95) return folhaCor(x, y, z, 0, 0);
    const u = th;
    if (miolo(u, rho)) return sem ? mul(C('#d8dcc0'), 0.8 + 0.1 * fbm(x * 200, y * 200, z * 200, k.s)) : mul(C('#f2f2e2'), 0.95 + 0.05 * fbm(x * 200, y * 200, z * 200, k.s));
    const cam = fr(rho * 9 + 0.4 * fbm(x * 30, y * 30, z * 30, k.s));
    const linha = suave(0.7, 0.9, cam);
    const base = mix(C('#dce4a0'), C('#a8c870'), suave(0.45, 0.95, rho) * 0.8);
    return mix(base, C('#6a9a40'), linha * (0.5 + 0.5 * rho));
  };
  const sulco = sem ? (u: number, rho: number) => (miolo(u, rho) ? 0.012 * suave(0, 0.15, 0.42 * (1 - u) ** 0.8 - rho) * suave(0.85, 0.7, u) : 0) : undefined;
  return gomo(R, R * 0.95, R * 0.95, PI / 2, folhaCor, face, { nu: 18, nv: 8, ponta: 0.85, sulco }).map((g, i) => parte(tf(g, [0, 0, 0], [-PI / 4, 0, 0]), 'acetinado', i === 0));
}

/** Buquês de brócolis (com palitos do talo) ou de couve-flor, soltos num montinho. */
function gBuques(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const couve = k.tem('couve');
  const L = k.T;
  const talo: CorFn = (x, y, z) => mul(couve ? C('#eae6cc') : C('#8ab05a'), 0.9 + 0.1 * fbm(x * 200, y * 200, z * 200, k.s));
  const cabeca: CorFn = (x, y, z) => {
    const g = celula(x * (couve ? 300 : 700), y * (couve ? 300 : 700), z * (couve ? 300 : 700), k.s);
    return couve ? mul(mix(k.c1, k.c2, 0.4 * g), 0.95) : mul(mix(k.c1, k.c2, suave(0.2, 0.8, g)), 0.85 + 0.25 * (1 - g));
  };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + k.r.f(-0.3, 0.3), rr = i === 0 ? 0 : L * 0.25;
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, rot = k.r.f(0, TAU);
    const s = k.r.f(0.85, 1.15) * L * 0.2;
    const parts: THREE.BufferGeometry[] = [];
    parts.push(tubo([V(-s * 0.9, s * 0.18, 0), V(-s * 0.4, s * 0.22, 0.002), V(0, s * 0.3, 0)], { raio: (t) => s * lerp(0.12, 0.2, t), m: 7, n: 8, cor: talo }));
    for (let j = 0; j < 5; j++) {
      const b = j === 0 ? V(s * 0.15, s * 0.38, 0) : V(s * 0.05 + Math.cos(j * 1.6) * s * 0.12, s * 0.32 + Math.sin(j * 2.3) * s * 0.06, Math.sin(j * 1.6) * s * 0.22);
      const r = s * (j === 0 ? 0.32 : 0.24);
      parts.push(tf(elipsoide(r * 0.85, r, r, cabeca, 6, 8, (t, ang) => 1 + 0.08 * Math.sin(ang * 5 + t * 9 + j)), [b.x, b.y, b.z], [0, 0, -0.9]));
    }
    for (const g of parts) {
      tf(g, [cx, i === 0 ? s * 0.15 : 0, cz], [0, rot, i === 0 ? 0.4 : 0]);
      out.push(parte(g, couve ? 'acetinado' : 'fosco', i === 0 && g === parts[1]));
    }
  }
  if (!couve) {
    for (let i = 0; i < 5; i++) {
      const g = bloco(L * 0.3, 0.006, 0.006, (x, y, z) => mul(C('#c8dc9a'), 0.92 + 0.1 * fbm(x * 200, y * 200, z * 200, k.s + i)));
      tf(g, [L * 0.42 + (i % 2) * 0.004, 0.003 + (i > 2 ? 0.006 : 0), -L * 0.2 + i * 0.008], [0, 0.2 + i * 0.05, 0]);
      out.push(parte(g, 'acetinado'));
    }
  }
  return out;
}

/** Espinafre refogado: montinho de folhas murchas, verde-escuras e brilhantes. */
function gEspinafreRefogado(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const verde = (s: number): CorFn => (x, y, z) => mul(mix(k.c1, k.c2, 0.35 * suave(-0.3, 0.7, fbm(x * 90, y * 90, z * 90, s))), 0.88 + 0.16 * fbm(x * 300, y * 300, z * 300, s + 1));
  out.push(parte(torno({ caminho: [[0, 0], [R * 0.95, 0], [R * 0.8, H * 0.35], [R * 0.4, H * 0.8], [0, H * 0.88]], n: 12, m: 18, cor: verde(k.s), mod: (t, a) => 1 + 0.1 * fbm(Math.cos(a) * 3, t * 4, Math.sin(a) * 3, k.s) }), 'brilhante', true));
  for (let i = 0; i < 16; i++) {
    const a = k.r.f(0, TAU), rr = R * k.r.f(0.05, 0.85);
    const y = H * 0.88 * (1 - (rr / R) ** 2) + 0.001;
    const g = folha(k.T * k.r.f(0.35, 0.5), k.T * k.r.f(0.22, 0.3), k.c1, k.c2, { contorno: contornos.oval, curva: k.r.f(-0.3, 0.2), concha: k.r.f(-0.2, 0.25), ondula: 0.08, cor: verde(k.s + i), n: 9, m: 7 });
    tf(g, [Math.cos(a) * rr, y, Math.sin(a) * rr], [k.r.f(-0.4, 0.4), a + k.r.f(-1, 1), -Math.atan2(rr, R) * 0.8]);
    out.push(parte(g, 'brilhante'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* lote                                                                 */
/* ------------------------------------------------------------------ */

const BOI = '7e1e24 e8d6b8 902628 7a4a30 c8c8c4';
const CORD = 'a84448 eee2d0 c05860 9a5a30 e4c8b8';
const PORC = 'd48880 f2e8dc e0988e c08a5a ecd6c0';

export const LOTE: Lote = {
  'tomate-concassee': { visual: vis('esferoide', 'concassee', 0.05, 'c8281c e04a32 d83a26 a8321e', { a: 0.45, ac: 'brilhante' }), gerar: gConcassee },
  'limao-gomo': { visual: vis('citrico', 'gomo', 0.065, 'e8d830 d8c820 eccb3a c8b830', { a: 0.4, l: 0.45 }), gerar: gLimaoGomo },
  'ostras-no-gelo': { visual: vis('bivalve', 'ostras-gelo', 0.26, '9a9688 6a665a d8ccb0 d8d0c0', { a: 0.15, l: 0.8, ac: 'brilhante' }), gerar: gOstrasGelo },
  'peru-fatiado': { visual: vis('peca_ave', 'peru-fatiado', 0.3, 'c08038 7a4218 f0e2c8 c08038', { a: 0.3, l: 0.6 }), gerar: gPeruFatiado },
  'pato-trinchado': { visual: vis('peca_ave', 'pato-trinchado', 0.32, 'b8702c 6a3412 a8705e b8702c', { a: 0.2, l: 0.6 }), gerar: gPatoTrinchado },
  'faisao-bardeado': { visual: vis('ave', 'ave', 0.3, 'd4a888 c08878 c88a7a b0702e', { a: 0.42, l: 0.5, d: 'magro' }), gerar: gAveBardeada },
  'faisao-bardeado-assado': { visual: vis('ave', 'ave', 0.3, 'c88a44 9a5a24 e0c8a8 b0702e', { a: 0.42, l: 0.5, d: 'magro assado', ac: 'brilhante' }), gerar: gAveBardeada },
  'faisao-em-porcoes': { visual: vis('peca_ave', 'porcoes', 0.22, 'c08038 7a3e16 e2c8a8 c08038', { a: 0.4, l: 0.8 }), gerar: gFaisaoPorcoes },
  'pato-escaldado': { visual: vis('ave', 'ave', 0.38, 'ecdcc0 dcc6a6 c8a090 a85a28', { a: 0.4, l: 0.5, d: 'magro', ac: 'acetinado' }), gerar: gPatoOriental },
  'pato-laqueado': { visual: vis('ave', 'ave', 0.38, '8c3216 5a1a0a c8907a 8c3216', { a: 0.4, l: 0.5, d: 'magro laqueado', ac: 'brilhante' }), gerar: gPatoOriental },
  'magret-fatiado': { visual: vis('peca_ave', 'magret-leque', 0.2, '8a4a1a f0e2c8 b84850 8a4a1a', { a: 0.1, l: 0.7 }), gerar: gMagretFatias },
  'pato-chaudfroid-fatias': { visual: vis('peca_ave', 'chaudfroid-fatias', 0.2, 'f2ead6 e8d8bc b84850 f2ead6', { a: 0.06, l: 0.4, d: 'chaudfroid' }), gerar: gMagretFatias },
  'peito-frango-recheado': { visual: vis('peca_ave', 'peito-recheado', 0.18, 'd89a48 8a4a18 f2e2d6 d89a48', { a: 0.2, l: 0.5 }), gerar: gPeitoRecheado },
  'escalope-frango-grelhado': { visual: vis('peca_ave', 'escalope-chapa', 0.16, 'e4c08a b07a3a f0e2d0 e4c08a', { a: 0.06, l: 0.62 }), gerar: gEscalopeChapa },
  'coxa-frango-grelhada': { visual: vis('peca_ave', 'coxa-grelhada', 0.2, 'c88a3e 7a3e14 f0e0d0 c88a3e', { a: 0.3, l: 0.4 }), gerar: gFrangoDourado },
  'frango-salteado-pedacos': { visual: vis('peca_ave', 'salteado', 0.2, 'c88a3e 7a3e14 f0e0d0 c88a3e', { a: 0.25, l: 0.8, d: 'pedacos' }), gerar: gFrangoDourado },
  'pate-selado': { visual: vis('miudo', 'pate-selado', 0.08, '9a6450 f2cc52 a86e5a 7a4a34', { a: 0.45, l: 1, ac: 'acetinado' }), gerar: gPateSelado },
  'acem-com-capa-gordura': { visual: vis('carne', 'acem-capa', 0.25, '8a2428 f0e6d0 9a2c2e 7a4a30', { a: 0.36, l: 0.5, d: 'grossa' }), gerar: gAcemCapa },
  'acem-aparado': { visual: vis('carne', 'acem-aparado', 0.25, '8a2428 f0e6d0 9a2c2e 7a4a30', { a: 0.3, l: 0.5 }), gerar: gAcemCapa },
  'carne-bandeja': { visual: vis('carne', 'bandeja', 0.24, '8a2428 f4f4f0 9a2c2e 7a4a30', { a: 0.12, l: 0.72 }), gerar: gCarneBandeja },
  'carne-embrulhada': { visual: vis('carne', 'embrulhada', 0.22, 'f2eee4 e8d8a8 9a2c2e 7a4a30', { a: 0.3, l: 0.6, ac: 'fosco' }), gerar: gCarneEmbrulhada },
  'file-mignon-cru': { visual: vis('carne', 'file-inteiro', 0.4, '7a1c22 e6d4bc 8a2428 6a3a2a', { a: 0.2, l: 0.24 }), gerar: gFileMignon },
  'file-mignon-cordao': { visual: vis('carne', 'file-inteiro', 0.4, '7a1c22 e6d4bc 8a2428 6a3a2a', { a: 0.2, l: 0.24, d: 'cordao' }), gerar: gFileMignon },
  'file-mignon-amarrado': { visual: vis('carne', 'file-inteiro', 0.4, '7a1c22 e6d4bc 8a2428 6a3a2a', { a: 0.2, l: 0.24, d: 'amarrado' }), gerar: gFileMignon },
  'file-mignon-dourado': { visual: vis('carne', 'file-inteiro', 0.4, '7a1c22 e6d4bc c8606a 6a3a2a', { a: 0.2, l: 0.24, d: 'dourado', ac: 'brilhante' }), gerar: gFileMignon },
  'bife-batido': { visual: vis('carne', 'bife-batido', 0.2, '8a2428 f0e6d0 9a2c2e 7a4a30', { a: 0.03, l: 0.7 }), gerar: gBifeBatido },
  'carne-moida-fios': { visual: vis('carne_moida', 'fios', 0.11, '9a2e30 e8c8b8 9a2e30 7a4a30', { a: 0.4 }), gerar: gMoidaFios },
  'costela-bovina-com-ossos': { visual: vis('carne_osso', 'costela-ossos', 0.3, BOI, { a: 0.3, l: 0.47, n: 3 }), gerar: gPecaCostela },
  'costela-bovina-assada': { visual: vis('carne_osso', 'costela-ossos', 0.3, '7e1e24 e8d6b8 b84a50 7a4a30', { a: 0.3, l: 0.47, n: 3, d: 'assado', ac: 'brilhante' }), gerar: gPecaCostela },
  'lombo-porco-com-costelas': { visual: vis('carne_osso', 'lombo-costelas', 0.35, PORC, { a: 0.22, l: 0.32, n: 6, d: 'espinha' }), gerar: gPecaCostela },
  'peito-vitela-com-costelas': { visual: vis('carne_osso', 'peito-costelas', 0.35, 'd08680 eee4d4 dc948c b8804a', { a: 0.1, l: 0.6, n: 6, d: 'chata' }), gerar: gPecaCostela },
  'manta-carne-recheada': { visual: vis('carne', 'manta', 0.3, '8a2428 f0e6d0 9a2c2e 7a4a30', { a: 0.08, l: 0.72 }), gerar: gManta },
  'manta-cordeiro-recheada': { visual: vis('carne', 'manta', 0.3, 'a84448 eee2d0 c05860 9a5a30', { a: 0.08, l: 0.7, d: 'ervas' }), gerar: gManta },
  'files-porco-abertos': { visual: vis('carne', 'manta', 0.28, 'd48880 f2e8dc e0988e c08a5a', { a: 0.12, l: 0.62, d: 'dois' }), gerar: gManta },
  'file-em-massa-cru': { visual: vis('folhado', 'file-massa', 0.32, 'f0dab0 e0c494 8a2428 c8802c', { a: 0.26, l: 0.34 }), gerar: gFileEmMassa },
  'file-em-massa-assado': { visual: vis('folhado', 'file-massa', 0.32, 'c8802c 8a4a16 b84a50 c8802c', { a: 0.28, l: 0.35, d: 'assado', ac: 'brilhante' }), gerar: gFileEmMassa },
  saltimbocca: { visual: vis('carne', 'saltimbocca', 0.22, 'c88a48 c45a5c f0dcd0 c88a48', { a: 0.08, l: 0.7 }), gerar: gSaltimbocca },
  'fajitas-na-tortilla': { visual: vis('pao_chato', 'fajitas', 0.26, 'ecdcb0 8a4a26 f0e6d0 c8a060', { a: 0.06, l: 0.62 }), gerar: gFajitas },
  'manteiga-cilindro-papel': { visual: vis('barra', 'cilindro-papel', 0.2, 'f6f2e6 f2dc8a f2dc8a e0b040', { a: 0.22, l: 0.22 }), gerar: gManteigaCilindro },
  'ossobuco-cozido': { visual: vis('carne_osso', 'ossobuco', 0.11, '6a2a16 e8dcc0 7a3a24 6a2a16', { a: 0.32 }), gerar: gOssobuco },
  'alcatra-fatias-rosadas': { visual: vis('carne', 'fatias', 0.22, '8a2428 f0e6d0 c8505a 5a2e1a', { a: 0.045, l: 0.24, n: 6 }), gerar: gLequeCarne },
  'perna-cordeiro-fatias': { visual: vis('carne', 'fatias', 0.26, 'a84448 eee2d0 c8606a 7a4220', { a: 0.05, l: 0.26, n: 6 }), gerar: gLequeCarne },
  'figado-bifes': { visual: vis('miudo', 'bifes', 0.22, '4a1c18 32100e 5a2420 6a4a38', { a: 0.025, l: 0.3, n: 4, d: 'figado' }), gerar: gLequeCarne },
  'arroz-jasmim-graos': { visual: vis('castanha', 'arroz-graos', 0.11, 'f4f2ea e4e2d4 f6f6f0 ecece0', { a: 0.4 }), gerar: gArrozGraos },
  'carre-cordeiro-limpo': { visual: vis('carne_osso', 'carre-limpo', 0.17, CORD, { a: 0.4, l: 0.6, n: 7 }), gerar: gCarre },
  'coroa-de-cordeiro-ossos': { visual: vis('carne_osso', 'coroa', 0.14, CORD, { a: 0.8, l: 1, d: 'coroa' }), gerar: gCarre },
  'guarda-de-honra-ossos': { visual: vis('carne_osso', 'guarda', 0.15, CORD, { a: 0.8, l: 0.7, d: 'guarda' }), gerar: gCarre },
  'guarda-de-honra-assada': { visual: vis('carne_osso', 'guarda', 0.15, '9a5a2c eee2d0 c8606a 9a5a2c', { a: 0.8, l: 0.7, d: 'guarda assado', ac: 'brilhante' }), gerar: gCarre },
  'lombo-cordeiro-com-osso': { visual: vis('carne_osso', 'sela', 0.28, 'b8545a f0e6d6 c8646a 9a5a30', { a: 0.18, l: 0.75 }), gerar: gSelaCordeiro },
  'noisette-napada': { visual: vis('carne', 'noisette', 0.07, '9a5a2c eee2d0 c05860 9a5a2c', { a: 0.42, d: 'creme', ac: 'brilhante' }), gerar: gNoisette },
  'noisette-na-chapa': { visual: vis('carne', 'noisette', 0.07, '9a5a2c eee2d0 c05860 9a5a2c', { a: 0.42, d: 'chapa', ac: 'brilhante' }), gerar: gNoisette },
  'feixe-vagem-pimentao': { visual: vis('vagem', 'feixe', 0.14, '4a9a2a 6ab03a c0e090 4a8a2a', { a: 0.12, l: 0.12 }), gerar: gFeixeVagem },
  'cebolinha-glaceada': { visual: vis('bulbo', 'glaceada', 0.03, 'e8b860 c88a3a f2e2c0 c88a3a', { a: 0.8, ac: 'brilhante' }), gerar: gCebolinhaGlaceada },
  'lombo-porco-tunel': { visual: vis('carne', 'tunel', 0.25, 'd48880 f2e8dc e0988e c08a5a', { a: 0.34, l: 0.36 }), gerar: gLomboTunel },
  'costeleta-porco-com-osso': { visual: vis('carne_osso', 'costeleta', 0.16, PORC, { a: 0.14, l: 0.7 }), gerar: gCosteleta },
  'costeleta-porco-recheada': { visual: vis('carne_osso', 'costeleta', 0.16, PORC, { a: 0.14, l: 0.7, d: 'recheada' }), gerar: gCosteleta },
  'costeleta-porco-dourada': { visual: vis('carne_osso', 'costeleta', 0.16, PORC, { a: 0.14, l: 0.7, d: 'dourada', ac: 'brilhante' }), gerar: gCosteleta },
  'costeleta-porco-grelhada': { visual: vis('carne_osso', 'costeleta', 0.16, PORC, { a: 0.14, l: 0.7, d: 'grelhada', ac: 'brilhante' }), gerar: gCosteleta },
  'pernil-losangos': { visual: vis('carne', 'pernil-losangos', 0.45, 'e0948c f2e4cc e8a098 b8783a', { a: 0.34, l: 0.38 }), gerar: gPernilLosangos },
  'pernil-losangos-crosta': { visual: vis('carne', 'pernil-losangos', 0.45, 'e0948c c07a34 e8a098 b8783a', { a: 0.34, l: 0.38, d: 'crosta', ac: 'brilhante' }), gerar: gPernilLosangos },
  'costelinhas-laqueadas': { visual: vis('carne_osso', 'costelinhas', 0.26, '8a2e12 f6eee6 e0a098 8a2e12', { a: 0.12, l: 0.62, d: 'laqueada', ac: 'brilhante' }), gerar: gCostelinhas },
  'costelinhas-pinceladas': { visual: vis('carne_osso', 'costelinhas', 0.26, 'd8908a f6eee6 e0a098 b07a4a', { a: 0.12, l: 0.62, ac: 'brilhante' }), gerar: gCostelinhas },
  'bacon-esticado': { visual: vis('carne', 'bacon-esticado', 0.3, 'b23c3c f2e2d0 d87a70 a85a2a', { a: 0.02, l: 0.24 }), gerar: gBaconEsticado },
  'hamburguer-queijo-derretido': { visual: vis('carne_moida', 'hamburguer-queijo', 0.11, '7a4024 f2d478 8a4a34 7a4024', { a: 0.2 }), gerar: gHamburguerQueijo },
  'peritonio-rendado': { visual: vis('miudo', 'peritonio', 0.3, 'e8c8c0 fbf4e8 f0dcd4 d8b8a0', { a: 0.03, l: 0.72, ac: 'umido' }), gerar: gPeritonio },
  'pe-porco-metades': { visual: vis('miudo', 'pe-metades', 0.2, 'f0d4c8 e0c0b0 f0dcd0 d0a070', { a: 0.25, l: 0.55, ac: 'acetinado' }), gerar: gPeMetades },
  'pe-porco-metades-cozido': { visual: vis('miudo', 'pe-metades', 0.2, 'e8d0b0 d8b890 e8d0b0 d0a070', { a: 0.25, l: 0.55, d: 'cozido', ac: 'brilhante' }), gerar: gPeMetades },
  'rabada-rodelas-cozidas': { visual: vis('carne_osso', 'rabada-rodelas', 0.15, '4a1c10 c8a070 6a2a1a 4a1c10', { a: 0.22, l: 1 }), gerar: gRabada },
  'bucho-favo': { visual: vis('miudo', 'favo', 0.16, 'f2ecdc e4dcc8 f2ecdc e8d8b8', { a: 0.04, l: 0.9, ac: 'acetinado' }), gerar: gBucho },
  'pimentao-quadrado': { visual: vis('pimenta', 'quadrado', 0.04, 'd8201a b8180e f0c0a0 a8402a', { a: 0.15, l: 1 }), gerar: gPimentaoQuadrado },
  'pimentao-torcidinho': { visual: vis('pimenta', 'quadrado', 0.04, 'd8201a b8180e f0c0a0 a8402a', { a: 0.3, l: 1, d: 'torcido' }), gerar: gPimentaoQuadrado },
  'pimentao-bolinha': { visual: vis('pimenta', 'bolinha', 0.008, 'd8201a b8180e e84a2a a8402a', { a: 0.85, l: 1 }), gerar: gPimentaoBolinha },
  'pepino-quarto': { visual: vis('fuso', 'quarto', 0.05, '24501f 7aa04a e0ecc4 8a9a5a', { a: 0.4, l: 0.6 }), gerar: gPepinoV },
  'pepino-em-v': { visual: vis('fuso', 'quarto-v', 0.05, '24501f 7aa04a e0ecc4 8a9a5a', { a: 0.4, l: 0.6, d: 'v' }), gerar: gPepinoV },
  'maca-gomos-glaceados': { visual: vis('esferoide', 'gomos', 0.14, 'b82018 e0b040 e8b45a c8903a', { a: 0.3, l: 0.9, ac: 'brilhante' }), gerar: gMacaGlaceada },
  'repolho-quarto': { visual: vis('folhoso', 'quarto', 0.18, '7aa850 c8dc98 e8f0d8 c8c890', { a: 0.5, l: 0.6 }), gerar: gRepolhoQuarto },
  'repolho-quarto-sem-miolo': { visual: vis('folhoso', 'quarto', 0.18, '7aa850 c8dc98 e8f0d8 c8c890', { a: 0.5, l: 0.6, d: 'semmiolo' }), gerar: gRepolhoQuarto },
  'brocolis-buques': { visual: vis('talo', 'buques', 0.16, '2a5a2a 4a7a3a c8e0a0 4a6a2a', { a: 0.4, l: 1 }), gerar: gBuques },
  'couve-flor-buques': { visual: vis('talo', 'buques', 0.16, 'f2ecd8 e0d8b8 f6f2e6 d8c088', { a: 0.4, l: 1, d: 'couve' }), gerar: gBuques },
  'espinafre-refogado': { visual: vis('folhoso', 'refogado', 0.11, '1e3e16 3a6a24 2a4a1c 2a4a1c', { a: 0.4, l: 1 }), gerar: gEspinafreRefogado },
};
