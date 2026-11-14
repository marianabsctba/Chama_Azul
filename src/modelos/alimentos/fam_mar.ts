// Famílias de pescados: peixes roliços e chatos, filés e postas, crustáceos,
// bivalves, conchas em espiral e lula.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, contornos, olho, grao, disco, type Ctx, type Gerador } from './pecas';

const PRETO: RGB = [0.01, 0.01, 0.012];
const BRANCO_OLHO: RGB = [0.75, 0.72, 0.6];

/* ------------------------------------------------------------------ */
/* Nadadeira: folha fina em pé (plano XY), com raios marcados           */
/* ------------------------------------------------------------------ */

function nadadeira(L: number, W: number, cor: RGB, contorno: (t: number) => number, curva = 0, esp?: number): THREE.BufferGeometry {
  const g = folha(L, W, cor, mul(cor, 0.75), {
    contorno, curva, esp: esp ?? Math.max(0.0006, W * 0.025), n: 10, m: 6,
    cor: (x, y, z) => mul(cor, 0.85 + 0.25 * Math.abs(Math.sin(z * 900 / Math.max(0.3, W * 30) + x * 40))),
  });
  g.rotateX(PI / 2); // largura passa para Y
  return g;
}

/* ------------------------------------------------------------------ */
/* peixe roliço (construído em pé, cabeça em +X, depois deitado de lado) */
/* ------------------------------------------------------------------ */

export const gPeixe: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const T = k.T;
  const enguia = k.tem('enguia'), tamboril = k.tem('tamboril'), tubarao = k.tem('tubarao');
  const caudaFr = enguia ? 0.02 : 0.17;
  const Lb = T * (1 - caudaFr);
  const Hm = T * k.A, Wm = T * k.L;
  const x0 = -T / 2 + T * caudaFr, x1 = T / 2;
  const p = Math.log(0.5) / Math.log(tamboril ? 0.8 : tubarao ? 0.6 : 0.58);
  const fOf = (t: number) => {
    if (enguia) return Math.min(1, Math.sin(PI * clamp(t)) * 2.6) ** 0.7 * lerp(0.35, 1, suave(0, 0.5, t));
    return Math.sin(PI * clamp(t) ** p) ** 0.75;
  };
  const altura = (t: number) => Math.max(fOf(t), (enguia ? 0.05 : 0.14) * (1 - t)) * Hm * (tamboril ? lerp(0.55, 1, t) : 1);
  const largura = (t: number) => Math.max(fOf(t), (enguia ? 0.05 : 0.08) * (1 - t)) * Wm * (tamboril ? lerp(0.5, 1.6, t ** 2) : 1);
  // cor da pele
  const fEsc = 1 / Math.max(0.002, T * 0.012);
  const corPele: CorFn = (x, y, z, t) => {
    const h = altura(t) / 2;
    const yr = clamp(y / Math.max(1e-5, h), -1, 1);
    let c = mix(c2, c1, suave(-0.35, 0.45, yr + 0.15 * fbm(x * 20, y * 20, z * 20, s)));
    if (k.tem('faixa')) c = mix(c, c3, (1 - suave(0.08, 0.22, Math.abs(yr - 0.02))) * 0.7);
    if (k.tem('pintas')) c = mix(c, mul(c1, 0.45), (1 - suave(0.18, 0.3, celula(x * 90 / T, y * 90 / T, z * 90 / T, s))) * suave(-0.4, 0.2, yr));
    if (k.tem('listras')) c = mix(c, mul(c1, 0.35), suave(0.55, 0.85, Math.sin(x * 70 / T + Math.sin(y * 50 / T) * 2.2)) * suave(0.0, 0.4, yr));
    if (k.tem('faixas')) c = mix(c, mul(c1, 0.4), suave(0.5, 0.8, Math.sin(x * 40 / T)) * suave(-0.6, 0.2, yr) * suave(0.95, 0.75, t));
    if (k.tem('mancha')) {
      const d = Math.hypot((t - 0.68) * Lb, y - h * 0.15);
      c = mix(c, PRETO, (1 - suave(Hm * 0.06, Hm * 0.1, d)) * 0.85);
    }
    // linha lateral, guelra e boca
    const lat = 1 - suave(0.0, 0.035, Math.abs(yr - 0.22 - 0.1 * Math.sin(t * 3)));
    c = mix(c, k.tem('linha') ? mix(c2, c3, 0.5) : mul(c, 0.8), lat * 0.6 * suave(0.05, 0.2, t) * suave(0.85, 0.75, t));
    const guelra = 1 - suave(0.0, 0.012, Math.abs(t - 0.79 + 0.02 * yr * yr));
    c = mix(c, mul(c, 0.55), guelra * 0.8);
    if (t > 0.9) c = mix(c, mul(c, 0.4), (1 - suave(0.0, 0.08, Math.abs(yr + 0.2))) * suave(0.92, 0.97, t) * 0.8);
    // escamas: semicírculos alternados
    const ex = x * fEsc, ey = y * fEsc + (Math.floor(x * fEsc) % 2) * 0.5;
    const esc = Math.abs(Math.sin(ex * PI)) * 0.5 + Math.abs(Math.sin(ey * PI)) * 0.5;
    if (!k.tem('semescamas')) c = mul(c, 1 - 0.07 * suave(0.75, 1, esc));
    return mul(c, 1 + 0.04 * fbm(x * 90, y * 90, z * 90, s) + (k.tem('iridescente') ? 0.08 * Math.sin(x * 80 + y * 60) : 0));
  };
  const corpoG = corpo({
    x0, x1, n: enguia ? 56 : 40, m: 28, cor: corPele,
    perfil: (t) => {
      const h = altura(t), w = largura(t);
      return { ry: h / 2, rz: w / 2, cy: (tamboril ? -0.15 * Hm * t : 0.0) + (enguia ? 0 : Hm * 0.04 * Math.sin(PI * t)) };
    },
    mod: (t, a) => 1 + (tubarao ? 0 : 0.0) - (Math.cos(a) < -0.6 && !enguia ? 0.03 * Math.sin(PI * t) : 0),
  });
  out.push(parte(corpoG, k.ac, true));
  const corFin = mix(c1, c3, 0.3);
  // cauda
  const xp = x0 + Lb * 0.01;
  const hp = altura(0.0);
  if (!enguia) {
    const Lc = T * caudaFr * 1.15;
    if (k.tem('caudaredonda')) {
      const g = nadadeira(Lc, Hm * 0.75, corFin, contornos.gota);
      tf(g, [xp, 0, 0], [0, PI, 0]);
      out.push(parte(g, 'acetinado'));
    } else {
      for (const sg of [-1, 1]) {
        const g = nadadeira(Lc, Hm * 0.26, corFin, contornos.lanca);
        tf(g, [xp, hp * 0.25 * sg, 0], [0, PI, -sg * (tubarao ? (sg > 0 ? 0.75 : 0.35) : 0.5)]);
        out.push(parte(g, 'acetinado'));
      }
      const g = nadadeira(Lc * 0.45, hp * 1.1, corFin, contornos.redonda);
      tf(g, [xp + Lc * 0.05, 0, 0], [0, PI, 0]);
      out.push(parte(g, 'acetinado'));
    }
  }
  // dorsal e anal
  const dorsais: [number, number, number][] = enguia ? [[0.05, 0.75, 0.25]] : k.tem('duasdorsais') ? [[0.42, 0.18, 0.5], [0.2, 0.14, 0.4]] : [[0.4, k.tem('espinhos') ? 0.36 : 0.28, k.tem('espinhos') ? 0.75 : 0.45]];
  for (const [tt, comp, alt] of dorsais) {
    const yy = altura(tt + comp / 2) / 2;
    const g = nadadeira(Lb * comp, Hm * alt, corFin, enguia ? contornos.fita : k.tem('espinhos') ? contornos.serrilhada : contornos.gota, 0);
    tf(g, [x0 + Lb * tt, yy * 0.9 + Hm * 0.04, 0], [0, 0, 0]);
    out.push(parte(g, 'acetinado'));
  }
  {
    const tt = enguia ? 0.05 : 0.18, comp = enguia ? 0.55 : 0.16;
    const yy = altura(tt + comp / 2) / 2;
    const g = nadadeira(Lb * comp, Hm * (enguia ? 0.2 : 0.3), corFin, enguia ? contornos.fita : contornos.gota);
    tf(g, [x0 + Lb * tt, -yy * 0.9 + Hm * 0.02, 0], [0, 0, 0]);
    out.push(parte(g, 'acetinado'));
  }
  if (!enguia) {
    // peitorais e pélvicas
    for (const sg of [-1, 1]) {
      const tp = 0.72;
      const g = folha(Lb * (k.tem('peitoralgrande') ? 0.22 : 0.14), Hm * 0.18, corFin, mul(corFin, 0.8), { contorno: contornos.gota, n: 8, m: 6, esp: 0.0008 });
      tf(g, [x0 + Lb * tp, -altura(tp) * 0.12, sg * largura(tp) * 0.47], [sg * 0.3, PI + sg * 0.25, -0.35]);
      out.push(parte(g, 'acetinado'));
      const tv = 0.52;
      const g2 = folha(Lb * 0.09, Hm * 0.1, corFin, mul(corFin, 0.8), { contorno: contornos.gota, n: 6, m: 6, esp: 0.0008 });
      tf(g2, [x0 + Lb * tv, -altura(tv) * 0.45, sg * largura(tv) * 0.25], [sg * 0.9, PI + sg * 0.2, 0.3]);
      out.push(parte(g2, 'acetinado'));
    }
  }
  // olhos
  const to = tamboril ? 0.9 : enguia ? 0.96 : 0.88;
  const ro = Hm * (k.tem('olhogrande') ? 0.1 : 0.07) * (enguia ? 0.8 : 1);
  for (const sg of [-1, 1]) {
    const g = olho(ro, k.tem('olhovermelho') ? [0.6, 0.1, 0.05] : BRANCO_OLHO, PRETO);
    const yo = altura(to) * (tamboril ? 0.4 : 0.18);
    tf(g, [x0 + Lb * to, yo, sg * largura(to) * 0.42], [0, sg > 0 ? 0 : PI, 0]);
    out.push(parte(g, 'umido'));
  }
  // barbilhões
  if (k.tem('barbilhao')) {
    const nb = k.tem('bagre') ? 4 : k.tem('carpa') ? 2 : 1;
    for (let i = 0; i < nb; i++) {
      const sg = i % 2 ? 1 : -1;
      const lb = (k.tem('bagre') ? 0.25 : 0.06) * T;
      const pa = V(x1 - Lb * 0.03, -altura(0.97) * 0.3, sg * largura(0.97) * 0.3 * (nb > 1 ? 1 : 0));
      out.push(parte(caule([pa, pa.clone().add(V(lb * 0.2, -lb * 0.3, sg * lb * 0.3)), pa.clone().add(V(-lb * 0.3, -lb * 0.45, sg * lb * 0.8))], T * 0.003, T * 0.0012, () => mul(c1, 0.7), 4), 'acetinado'));
    }
  }
  // deita de lado (dorso para +Z)
  for (const pt of out) pt.g.rotateX(PI / 2);
  void ci;
  return out;
};

/* ------------------------------------------------------------------ */
/* peixe chato (deitado com o lado escuro para cima)                    */
/* ------------------------------------------------------------------ */

export const gPeixeChato: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const T = k.T;
  const raia = k.v.v === 'arraia';
  const caudaFr = raia ? 0.45 : 0.14;
  const Lb = T * (1 - caudaFr);
  const W = T * k.L, Hm = T * k.A;
  const x0 = -T / 2 + T * caudaFr, x1 = T / 2;
  const contorno = (t: number) => {
    if (raia) return Math.max(0.02, 1 - Math.abs(t - 0.45) / 0.55) ** 0.9;
    const u = 2 * t - 1;
    return Math.sqrt(Math.max(0, 1 - Math.abs(u) ** (k.tem('redondo') ? 2.5 : 2))) * (1 - 0.1 * u) + 0.06 * (1 - t);
  };
  const fP = 60 / T;
  const corTopo: CorFn = (x, y, z, t) => {
    let c = mix(c1, c2, suave(0.2, 0.8, fbm(x * 12 / T, y, z * 12 / T, s)) * 0.5);
    if (k.tem('pintas')) c = mix(c, mul(c2, 0.8), 1 - suave(0.15, 0.28, celula(x * fP, 0, z * fP, s)));
    if (k.tem('tuberculos')) c = mix(c, mul(c1, 1.4), 1 - suave(0.08, 0.16, celula(x * fP * 1.3, 0, z * fP * 1.3, s + 3)));
    const lat = 1 - suave(0, W * 0.012, Math.abs(z - W * 0.02 * Math.sin(t * 6)));
    c = mix(c, mul(c, 0.75), lat * suave(0.1, 0.3, t) * suave(0.85, 0.7, t));
    return y > 0 ? mul(c, 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s)) : mix(c3, mul(c3, 0.9), fbm(x * 40, 0, z * 40, s));
  };
  out.push(parte(corpo({
    x0, x1, n: 34, m: 30, cor: corTopo,
    perfil: (t) => ({ ry: Hm / 2 * Math.sqrt(contorno(t)) * (raia ? lerp(0.6, 1, Math.sin(PI * t)) : 1), rz: (W / 2) * contorno(t), cy: Hm / 2 }),
    mod: (t, a) => 1 + (k.tem('tuberculos') ? 0.03 * ruido(t * 20, Math.cos(a) * 5, Math.sin(a) * 5, s) : 0),
    desloc: (p) => { if (p.y > Hm / 2) p.y = Hm / 2 + (p.y - Hm / 2) * 1.2; else p.y = Hm / 2 + (p.y - Hm / 2) * 0.6; },
  }), k.ac, true));
  // franja de nadadeiras em volta (exceto na arraia)
  if (!raia) {
    out.push(parte(corpo({
      x0: x0 + Lb * 0.02, x1: x1 - Lb * 0.12, n: 30, m: 16,
      cor: (x, y, z) => mul(mix(c1, c3, y > Hm * 0.5 ? 0.2 : 0.7), 0.9 + 0.2 * Math.abs(Math.sin(x * 500 / T))),
      perfil: (t) => {
        const tt = lerp(0.02, 0.88, t);
        return { ry: Hm * 0.08, rz: (W / 2) * contorno(tt) * 1.13 + W * 0.02 * Math.sin(PI * t), cy: Hm * 0.48 };
      },
    }), 'acetinado'));
    const g = folha(T * caudaFr * 1.2, W * 0.32, mix(c1, c3, 0.2), mul(c1, 0.8), { contorno: contornos.gota, esp: Hm * 0.04, n: 8, m: 6 });
    tf(g, [x0 + Lb * 0.02, Hm * 0.48, 0], [0, PI, 0]);
    out.push(parte(g, 'acetinado'));
  } else {
    out.push(parte(caule([V(x0 + Lb * 0.05, Hm * 0.45, 0), V(x0 - T * 0.2, Hm * 0.4, W * 0.02), V(-T / 2, Hm * 0.35, 0)], Hm * 0.25, Hm * 0.05, () => c1, 6), 'acetinado'));
  }
  // olhos no lado de cima
  const to = raia ? 0.78 : 0.86;
  for (const dz of raia ? [-1, 1] : [0.2, -0.15]) {
    const g = olho(Hm * 0.32, BRANCO_OLHO, PRETO);
    g.rotateX(-PI / 2);
    g.translate(x0 + Lb * to + (raia ? 0 : dz * Lb * 0.06), Hm * 0.95, (raia ? dz * W * 0.06 : dz * W * 0.12));
    out.push(parte(g, 'umido'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* filé, manta, posta e ova                                             */
/* ------------------------------------------------------------------ */

export const gFilePeixe: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'posta') {
    // posta redonda deitada: pele na borda, anéis de músculo, espinha no centro
    const R = k.T / 2, H = k.T * k.A;
    const cor: CorFn = (x, y, z) => {
      const r = Math.hypot(x, z) / R;
      const ang = Math.atan2(z, x);
      if (r > 0.94 || (y > H * 0.08 && y < H * 0.92)) return mix(c1, c2, suave(-0.3, 0.3, Math.sin(ang)) * 0.6);
      const anel = Math.abs(Math.sin(Math.hypot(x * (1 + 0.3 * Math.sin(ang * 2)), z) / R * PI * 5)) ** 6;
      let c = mix(ci, mul(ci, 0.8), anel * 0.6);
      c = mix(c, c3, 1 - suave(0.06, 0.1, r));
      if (k.tem('cavidade')) c = mix(c, mul(ci, 0.6), (1 - suave(0.08, 0.14, Math.hypot(x / R - 0.0, z / R + 0.45))) );
      return mul(c, 1 + 0.04 * fbm(x * 90, y * 90, z * 90, s));
    };
    out.push(parte(disco(R, H, cor, { n: 34, m: 30, l: k.L, borda: 0.25, mod: (t, a) => 1 + 0.04 * Math.cos(a * 2) + 0.02 * fbm(Math.cos(a), Math.sin(a), 0, s) }), 'umido', true));
    return out;
  }
  if (v === 'ova') {
    const L = k.T, R = (L * k.L) / 2;
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s)), c2, 1 - suave(0.15, 0.3, celula(x * 700, y * 700, z * 700, s)));
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 28, m: 20, cor,
      perfil: (t) => { const u = 2 * t - 1; const r = R * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.15 * Math.abs(Math.sin(t * PI * 2))); return { ry: r * 0.7, rz: r, cy: r * 0.7, cz: R * 0.2 * Math.sin(t * PI * 1.3) }; },
    }), 'umido', true));
    return out;
  }
  // filé ou manta deitado, pele embaixo
  const L = k.T, W = L * k.L, H = L * k.A;
  const nf = v === 'filete' ? k.v.n ?? 3 : 1;
  const manta = v === 'manta';
  for (let i = 0; i < nf; i++) {
    const zOff = nf > 1 ? (i - (nf - 1) / 2) * W * 1.15 : 0;
    const cor: CorFn = (x, y, z, t) => {
      if (y < H * 0.12) return mix(c2, mul(c2, 0.7), suave(0.2, 0.8, fbm(x * 50, 0, z * 50, s)));
      // miômeros: linhas brancas em V
      const m = Math.abs(Math.sin((x + Math.abs(z - zOff) * 0.7) * 70 / L)) ** 12;
      let c = mix(c1, c3, m * (manta ? 0.2 : 0.55));
      if (manta || k.tem('sal')) c = mix(c, [0.95, 0.95, 0.92], (1 - suave(0.08, 0.2, celula(x * 400, y * 400, z * 400, s))) * 0.8);
      return mul(c, 1 + 0.05 * fbm(x * 70, y * 70, z * 70, s));
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 30, m: 24, exp: manta ? 4 : 3, cor,
      perfil: (t) => {
        const env = Math.sqrt(suave(0, 0.1, t)) * Math.sqrt(suave(1, manta ? 0.6 : 0.85, t));
        const larg = manta ? lerp(1.0, 0.45, t) : lerp(0.35, 1, Math.sqrt(t)) * (1 - 0.15 * t);
        return { ry: (H / 2) * env * (manta ? 0.7 : lerp(0.35, 1, t)), rz: (W / 2) * env * larg, cy: (H / 2) * (manta ? 0.7 : lerp(0.35, 1, t)), cz: zOff };
      },
      desloc: (p) => { if (p.y < 0) p.y = 0; },
    }), k.ac, true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* crustáceos                                                           */
/* ------------------------------------------------------------------ */

function corCasca(k: Ctx, juntas: number, comp: number): CorFn {
  const { c1, c2, s } = k;
  return (x, y, z) => {
    const j = Math.abs(Math.sin((x / comp) * PI * juntas)) ** 0.3;
    const c = mix(c1, c2, suave(0.35, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.5);
    return mul(c, lerp(0.7, 1.05, j) + 0.06 * fbm(x * 300, y * 300, z * 300, s));
  };
}

function pinca(L: number, R: number, cor: CorFn, ponta: RGB): THREE.BufferGeometry[] {
  // palma inchada + dedo fixo + dedo móvel, apontando para +X
  const out: THREE.BufferGeometry[] = [];
  out.push(corpo({ x0: 0, x1: L * 0.6, n: 12, m: 12, cor, perfil: (t) => { const r = R * (0.55 + 0.45 * Math.sin(PI * (0.2 + 0.8 * t))); return { ry: r * 0.75, rz: r }; } }));
  const dedo = (sg: number) => corpo({
    x0: L * 0.5, x1: L, n: 10, m: 8,
    cor: (x, y, z, t) => mix(mul(cor(x, y, z, t, 0), 1), ponta, suave(0.6, 0.95, t)),
    perfil: (t) => { const r = R * 0.38 * (1 - t) ** 0.8 + R * 0.03; return { ry: r * 0.8, rz: r, cz: sg * R * 0.28 + sg * R * 0.25 * Math.sin(PI * t) * 0, cy: 0 }; },
    desloc: (p) => { p.z += sg * R * 0.2 * Math.sin(((p.x - L * 0.5) / (L * 0.5)) * PI) - sg * 0.0; },
  });
  out.push(dedo(1), dedo(-1));
  return out;
}

export const gCrustaceo: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T;
  const add = (g: THREE.BufferGeometry, corpoP = false) => out.push(parte(g, k.ac, corpoP));
  if (v === 'caranguejo') {
    // carapaça larga ao longo de X, pernas para os lados, garras para +Z
    const Wc = L * 0.55, Dc = Wc * 0.72, Hc = Wc * 0.32;
    const corC: CorFn = (x, y, z) => mix(mix(c2, c1, suave(Hc * 0.2, Hc * 0.6, y)), mul(c1, 0.8), suave(0.4, 0.8, fbm(x * 60, y * 60, z * 60, s)) * 0.4);
    add(corpo({
      x0: -Wc / 2, x1: Wc / 2, n: 24, m: 28, cor: corC,
      perfil: (t) => { const r = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); return { ry: (Hc / 2) * r ** 0.6, rz: (Dc / 2) * r, cy: Hc * 0.55 }; },
      mod: (t, a) => 1 + 0.04 * Math.max(0, Math.sin(a)) * Math.abs(Math.sin(t * PI * 9)),
      desloc: (p) => { if (p.y < Hc * 0.55) p.y = Hc * 0.55 - (Hc * 0.55 - p.y) * 0.5; },
    }), true);
    const corP = corCasca(k, 3, L * 0.1);
    for (const sg of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z0 = lerp(Dc * 0.18, -Dc * 0.35, i / 3);
        const p0 = V(sg * Wc * 0.42, Hc * 0.45, z0);
        const p1 = V(sg * (Wc * 0.62 + L * 0.06), Hc * 0.85, z0 * 1.3 - Dc * 0.05);
        const p2 = V(sg * (Wc * 0.68 + L * 0.16), 0.002, z0 * 1.5 - Dc * 0.1);
        add(tubo([p0, p1, p2], { raio: (t) => L * 0.022 * (1 - t * 0.7), m: 7, n: 12, cor: corP }));
      }
      // garra
      const b0 = V(sg * Wc * 0.3, Hc * 0.45, Dc * 0.42);
      const b1 = V(sg * Wc * 0.45, Hc * 0.55, Dc * 0.62);
      add(tubo([b0, b1], { raio: L * 0.035, m: 8, n: 6, cor: corP }));
      for (const g of pinca(L * 0.32, L * 0.065, corC, PRETO)) {
        g.rotateY(-PI / 2 + sg * 0.6);
        g.translate(b1.x, b1.y, b1.z);
        add(g);
      }
    }
    for (const sg of [-1, 1]) {
      const g = olho(L * 0.012, PRETO, PRETO);
      g.translate(sg * Wc * 0.08, Hc * 0.8, Dc * 0.48);
      out.push(parte(g, 'umido'));
    }
    return out;
  }
  // lagosta, lagostim e camarão: deitados com a cabeça em +X
  const camarao = v === 'camarao';
  const R = L * (camarao ? 0.07 : 0.085) * (k.L / 0.17 || 1);
  const xCab0 = camarao ? L * 0.05 : -L * 0.02, xCab1 = L * 0.38;
  const corPele = corCasca(k, 1, L);
  // cefalotórax
  add(corpo({
    x0: xCab0, x1: xCab1, n: 18, m: 18,
    cor: (x, y, z) => {
      let c = mix(c1, c2, suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.45);
      if (k.tem('cruz')) c = mix(c, mul(c1, 1.6), 1 - suave(0, R * 0.08, Math.abs(z)));
      return mul(c, 1 + 0.05 * ruido(x * 400, y * 400, z * 400, s));
    },
    perfil: (t) => { const r = R * Math.sqrt(Math.sin(PI * (0.08 + 0.92 * t) ** 0.8)) * lerp(1, 0.5, t ** 2); return { ry: r, rz: r * 0.9, cy: R * 1.15 }; },
  }), true);
  // rostro
  add(corpo({ x0: xCab1 - R * 0.3, x1: xCab1 + R * 0.9, n: 6, m: 6, cor: corPele, perfil: (t) => ({ ry: R * 0.12 * (1 - t), rz: R * 0.1 * (1 - t), cy: R * 1.5 }) }));
  // abdômen segmentado, arqueado (camarão em C)
  const nseg = 6;
  const xa1 = xCab0 + R * 0.3, xa0 = -L / 2 + L * (camarao ? 0.14 : 0.12);
  const arco = camarao ? 1 : 0.15;
  const ptsA: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    if (camarao) {
      const ang = t * PI * 0.85, Rarc = (xa1 - xa0) * 0.62;
      ptsA.push(V(xa1 - Math.sin(ang) * Rarc, R * 1.05 - t * R * 0.4, -(1 - Math.cos(ang)) * Rarc));
    } else ptsA.push(V(lerp(xa1, xa0, t), R * 1.05 - R * 0.25 * t * arco * 6, 0));
  }
  add(tubo(ptsA, {
    raio: (t) => R * lerp(0.95, 0.5, t) * (1 - 0.1 * Math.abs(Math.sin(t * PI * nseg)) ** 0.3 * 0 + 0.06 * Math.abs(Math.cos(t * PI * nseg)) ** 8),
    achata: 1.1, m: 16, n: 36, cima: V(0, 1, 0),
    cor: (x, y, z, t) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.45), lerp(0.72, 1.05, Math.abs(Math.sin(t * PI * nseg)) ** 0.25)),
  }), true);
  // leque da cauda
  const fim = ptsA[ptsA.length - 1], antes = ptsA[ptsA.length - 2];
  const dir = fim.clone().sub(antes).normalize();
  const angBase = Math.atan2(-dir.z, dir.x);
  for (let i = 0; i < 5; i++) {
    const g = folha(L * 0.13, L * 0.06, mix(c1, c2, 0.3), c2, { contorno: contornos.gota, esp: R * 0.04, n: 6, m: 6 });
    tf(g, [fim.x, fim.y - R * 0.3, fim.z], [0, angBase + (i - 2) * 0.32, -0.1]);
    add(g);
  }
  // patas
  for (const sg of [-1, 1]) {
    for (let i = 0; i < (camarao ? 5 : 4); i++) {
      const x = lerp(xCab0 + R * 0.3, xCab1 - R * 0.6, i / 4);
      const p0 = V(x, R * 0.6, sg * R * 0.6);
      add(tubo([p0, V(x + L * 0.02, R * 1.0, sg * (R + L * 0.05)), V(x - L * 0.02, 0.0015, sg * (R + L * 0.1))], { raio: (t) => R * 0.1 * (1 - 0.6 * t), m: 5, n: 8, cor: corPele }));
    }
    // antenas varrendo para trás
    const pA = V(xCab1, R * 1.4, sg * R * 0.4);
    add(tubo([pA, V(xCab1 + L * 0.12, R * 1.6, sg * L * 0.12), V(xCab1 - L * 0.1, R * 1.4, sg * L * 0.28), V(-L * 0.25, R * 1.0, sg * L * 0.32)], { raio: (t) => R * 0.08 * (1 - 0.8 * t), m: 4, n: 20, cor: corPele }));
    // olhos
    const g = olho(R * 0.14, PRETO, PRETO);
    g.translate(xCab1 - R * 0.1, R * 1.65, sg * R * 0.35);
    out.push(parte(g, 'umido'));
    if (!camarao) {
      // garras: braço + pinça (desiguais na lagosta)
      const esc = v === 'lagostim' ? 0.55 : sg > 0 ? 1.1 : 0.85;
      const b0 = V(xCab1 - R * 0.5, R * 0.8, sg * R * 0.6);
      const b1 = V(xCab1 + L * 0.06, R * 0.7, sg * (R + L * 0.06));
      add(tubo([b0, b1, b1.clone().add(V(L * 0.08, 0, sg * L * 0.01))], { raio: (t) => R * 0.25 * esc * (1 - 0.3 * t), m: 8, n: 10, cor: corPele }));
      for (const g2 of pinca(L * 0.3 * esc, R * 0.6 * esc * (v === 'lagostim' ? 0.7 : 1), corPele, mul(c2, 0.9))) {
        g2.rotateY(-sg * 0.15);
        g2.translate(b1.x + L * 0.08, b1.y, b1.z);
        add(g2);
      }
    }
  }
  void c3;
  return out;
};

/* ------------------------------------------------------------------ */
/* bivalves                                                             */
/* ------------------------------------------------------------------ */

export const gBivalve: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const contorno = (t: number) => {
    const u = 2 * t - 1;
    switch (v) {
      case 'mexilhao': return Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2)) * lerp(0.35, 1.1, t ** 0.8);
      case 'vieira': return Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.4)) * lerp(0.4, 1.05, t ** 0.6);
      default: return Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.1)) * (1 + 0.05 * u);
    }
  };
  const x0 = -L / 2;
  const cor: CorFn = (x, y, z) => {
    const d = Math.hypot(x - x0, z * 1.1) / L;
    let c = mul(c1, 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
    const anel = Math.abs(Math.sin(d * (v === 'ameijoa' ? 70 : 40) + fbm(x * 30, y * 30, z * 30, s))) ** 2;
    c = mix(c, c2, anel * (v === 'ostra' ? 0.5 : 0.6));
    if (v === 'vieira') c = mix(c, c2, suave(0.4, 0.9, Math.cos(Math.atan2(z, x - x0) * 18)) * 0.6);
    if (v === 'ostra') c = mix(c, c3, suave(0.2, 0.8, fbm(x * 40, y * 40, z * 40, s + 2)) * 0.5);
    const juntura = 1 - suave(0, H * 0.06, Math.abs(y - H * 0.45));
    return mix(c, mul(c1, 0.35), juntura * 0.7);
  };
  out.push(parte(corpo({
    x0, x1: L / 2, n: 26, m: 26, exp: 1.6, cor,
    perfil: (t) => ({ ry: (H / 2) * Math.sqrt(contorno(t)) * (v === 'ostra' ? 1 : 1), rz: (W / 2) * contorno(t), cy: H * 0.45, cz: v === 'mexilhao' ? W * 0.12 * (1 - t) : 0 }),
    mod: (t, a) => 1 + (v === 'ostra' ? 0.12 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s) : 0),
    desloc: (p) => {
      if (v === 'vieira') {
        const ph = Math.atan2(p.z, p.x - x0);
        const rad = Math.hypot(p.z, p.x - x0) / L;
        p.y += Math.sign(p.y - H * 0.45) * H * 0.16 * Math.abs(Math.cos(ph * 9)) * rad;
      }
      if (v === 'ostra' && p.y > H * 0.45) p.y = H * 0.45 + (p.y - H * 0.45) * 0.45;
    },
  }), k.ac, true));
  if (v === 'vieira') {
    for (const sg of [-1, 1]) {
      const g = folha(L * 0.2, L * 0.14, c1, c2, { contorno: contornos.gota, esp: H * 0.1, n: 5, m: 6 });
      tf(g, [x0 + L * 0.02, H * 0.45, 0], [0, -sg * 1.3, 0]);
      out.push(parte(g, k.ac));
    }
  }
  if (v === 'mexilhao' && k.tem('barba')) {
    for (let i = 0; i < 6; i++) {
      const x = lerp(-L * 0.2, L * 0.1, i / 5);
      out.push(parte(caule([V(x, H * 0.45, W * 0.4), V(x + k.r.f(-1, 1) * L * 0.03, H * 0.3, W * 0.7)], L * 0.006, L * 0.003, () => [0.35, 0.28, 0.18], 3), 'fosco'));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* conchas em espiral (búzio, escargot)                                 */
/* ------------------------------------------------------------------ */

export const gConchaEspiral: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const escargot = k.v.v === 'escargot';
  // concha construída em pé: espira para cima, voltas marcadas por suturas em espiral
  const H = escargot ? k.T * 0.85 : k.T;
  const R = escargot ? k.T / 2 : k.T * 0.3;
  const voltas = escargot ? 3.5 : 6;
  const ombro = escargot ? 0.42 : 0.32; // altura relativa da volta maior
  const env = (u: number) => {
    if (u < ombro) {
      const f = u / ombro;
      return escargot ? Math.sin((f * PI) / 2) ** 0.6 : 0.18 + 0.82 * Math.sin((f * PI) / 2) ** 1.5;
    }
    return (1 - (u - ombro) / (1 - ombro)) ** (escargot ? 0.8 : 1.15);
  };
  const fase = (t: number, a: number) => {
    const f = t * voltas - a / TAU;
    return f - Math.floor(f);
  };
  const g = torno({
    caminho: (u) => [R * env(u), H * u], n: 60, m: 32,
    mod: (t, a) => 1 - 0.14 * suave(0.82, 1, fase(t, a)) * suave(0.05, 0.25, t) + 0.03 * Math.sin(a * 9 + t * 40) * (escargot ? 0 : 1),
    cor: (x, y, z, t, a) => {
      const f = fase(t, a);
      let c = mix(c1, c2, Math.abs(Math.sin(f * PI * 3)) ** 3 * 0.55 + suave(0.3, 0.8, fbm(x * 90, y * 90, z * 90, s)) * 0.25);
      c = mix(c, mul(c2, 0.7), suave(0.85, 0.98, f) * 0.8);
      // abertura (boca) de um lado da volta maior
      const ab = Math.exp(-(((a - PI / 2 + PI) % TAU - PI) ** 2) / 0.35) * suave(0.05, 0.15, t) * suave(ombro + 0.05, ombro - 0.05, t);
      return mix(c, ci, ab * 0.9);
    },
  });
  out.push(parte(g, k.ac, true));
  if (k.tem('carne')) out.push(parte(tf(elipsoide(R * 0.5, H * 0.18, R * 0.35, () => mul(ci, 0.9), 6, 10), [R * 0.75, H * 0.12, 0]), 'umido'));
  // búzio deitado com a espira em +X; escargot fica em pé levemente inclinado
  for (const p of out) {
    if (escargot) p.g.rotateZ(-0.35);
    else p.g.rotateZ(-PI / 2);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* lula                                                                 */
/* ------------------------------------------------------------------ */

export const gCefalopode: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const R = L * k.L / 2;
  const Lm = L * 0.55;
  const xm0 = -L / 2, xm1 = xm0 + Lm;
  const corPele: CorFn = (x, y, z) => {
    const ponto = 1 - suave(0.15, 0.4, celula(x * 260, y * 260, z * 260, s));
    return mix(mul(c1, 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s)), c2, ponto * suave(R * 0.4, R * 1.6, y) * 0.9 + 0.15 * suave(R * 0.9, R * 1.8, y));
  };
  out.push(parte(corpo({
    x0: xm0, x1: xm1, n: 28, m: 20, cor: corPele, tampa: true, corTampa: () => mul(c1, 0.9),
    perfil: (t) => { const r = R * Math.sqrt(suave(0, 0.35, t)) * lerp(0.6, 1, t); return { ry: r * 0.85, rz: r, cy: R * 0.85 }; },
  }), 'umido', true));
  // nadadeiras na ponta
  const g = folha(Lm * 0.4, R * 4.2, c1, c2, { contorno: (t) => Math.max(0.05, Math.sin(PI * t ** 0.7)), esp: R * 0.04, n: 10, m: 8, cor: corPele });
  g.translate(xm0 + Lm * 0.02, R * 0.95, 0);
  out.push(parte(g, 'umido'));
  // cabeça e olhos
  const xc = xm1 + L * 0.06;
  out.push(parte(tf(elipsoide(L * 0.06, R * 0.6, R * 0.7, corPele, 10, 14), [xc, R * 0.7, 0]), 'umido', true));
  for (const sg of [-1, 1]) {
    const o = olho(R * 0.28, [0.2, 0.25, 0.3], PRETO);
    o.translate(xc, R * 0.8, sg * R * 0.55);
    out.push(parte(o, 'umido'));
  }
  // braços e tentáculos para +X
  for (let i = 0; i < 10; i++) {
    const tent = i >= 8;
    const sg = i % 2 ? 1 : -1;
    const spread = (Math.floor(i / 2) + 0.5) * 0.12 * sg;
    const len = tent ? L * 0.36 : L * 0.22;
    const p0 = V(xc + L * 0.05, R * 0.5, spread * R * 2);
    const pts = [p0, V(p0.x + len * 0.4, R * 0.3, p0.z + spread * len * 0.6), V(p0.x + len * 0.8, R * 0.15, p0.z + spread * len * 1.1 + Math.sin(i) * len * 0.1), V(p0.x + len, 0.004, p0.z + spread * len * 1.3)];
    out.push(parte(tubo(pts, { raio: (t) => R * (tent ? 0.12 * (1 - t * 0.6) + 0.1 * suave(0.75, 0.9, t) * suave(1, 0.95, t) : 0.2 * (1 - t * 0.85)), m: 6, n: 14, cor: corPele }), 'umido'));
  }
  return out;
};

export { grao };
