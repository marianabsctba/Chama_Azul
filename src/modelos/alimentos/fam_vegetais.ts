// Famílias de hortaliças, raízes, ervas, cogumelos e pimentas.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  caminhoEsfera, type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, sepalas, contornos, corFolha, grao, plumosa, type Ctx, type Gerador } from './pecas';

/* ------------------------------------------------------------------ */
/* Fruto em pé genérico (torno com covinhas, pescoço, lobos e sulco)   */
/* ------------------------------------------------------------------ */

export interface OpcFruto {
  R: number;
  H: number; // altura total
  covaTopo?: number;
  covaBase?: number;
  largCova?: number;
  pescoco?: number; // fração da altura que vira pescoço no topo
  finoPescoco?: number; // raio relativo do pescoço
  pontaBase?: number; // alonga a base em ponta
  lobos?: number;
  ampLobo?: number;
  costelas?: number;
  ampCostela?: number;
  sulco?: number;
  ruido?: number;
  fRuido?: number;
  l?: number;
  n?: number;
  m?: number;
  cor: CorFn;
  s?: number;
}

export function fruto(o: OpcFruto): THREE.BufferGeometry {
  const { R, H } = o;
  const lc = o.largCova ?? 0.3;
  const caminho = (s: number): [number, number] => {
    const th = s * PI;
    const sn = Math.sin(th);
    let r = R * sn;
    let h = (H / 2) * (1 - Math.cos(th));
    if (o.pescoco) {
      const k = suave(1 - o.pescoco * 1.6, 1, s);
      r *= lerp(1, o.finoPescoco ?? 0.3, k);
      h += k * H * o.pescoco * 0.6;
    }
    if (o.pontaBase) {
      const k = suave(0.5, 0, s);
      r *= lerp(1, 0.55, k * k);
      h -= k * k * H * o.pontaBase;
    }
    if (o.covaTopo && s > 0.5) h -= o.covaTopo * H * Math.exp(-((sn / lc) ** 2));
    if (o.covaBase && s < 0.5) h += o.covaBase * H * Math.exp(-((sn / lc) ** 2));
    return [r, h];
  };
  const fr = o.fRuido ?? 6 / R;
  return torno({
    caminho, n: o.n ?? 22, m: o.m ?? 28, l: o.l, cor: o.cor,
    mod: (t, a) => {
      let k = 1;
      const env = Math.sin(t * PI) ** 0.5;
      if (o.lobos) k *= 1 + (o.ampLobo ?? 0.04) * Math.cos(o.lobos * a) * env;
      if (o.costelas) k *= 1 - (o.ampCostela ?? 0.06) * (1 - Math.abs(Math.sin((o.costelas * a) / 2))) ** 3 * env;
      if (o.sulco) k *= 1 - o.sulco * Math.exp(-((((a + PI) % TAU) - PI) ** 2) / 0.04) * env;
      if (o.ruido) k *= 1 + o.ruido * fbm(Math.cos(a) * 1.5, t * 3, Math.sin(a) * 1.5, o.s ?? 0);
      return k;
    },
    desloc: o.ruido && o.fRuido ? (p) => { p.multiplyScalar(1 + o.ruido! * 0.4 * ruido(p.x * fr, p.y * fr, p.z * fr, (o.s ?? 0) + 4)); } : undefined,
  });
}

/** Cabinho no topo de uma fruta em pé. */
export function cabinho(x: number, y: number, z: number, L: number, r: number, cor: RGB, curva = 0.3): THREE.BufferGeometry {
  return caule([V(x, y - L * 0.25, z), V(x + L * curva * 0.3, y + L * 0.5, z), V(x + L * curva, y + L, z)], r, r * 0.7, (px, py, pz) => mul(cor, 1 + 0.1 * ruido(px * 400, py * 400, pz * 400)), 6);
}

/* ------------------------------------------------------------------ */
/* esferoide                                                           */
/* ------------------------------------------------------------------ */

export const gEsferoide: Gerador = (k) => {
  const R = k.T / 2, H = k.T * k.A;
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'maca') {
    const cor: CorFn = (x, y, z) => {
      const listra = 0.5 + 0.5 * ruido(Math.atan2(z, x) * 6, y * 30, 0, s);
      const lent = 1 - suave(0.08, 0.16, celula(x * 260, y * 260, z * 260, s));
      const c = mix(c1, c2, listra * 0.7 * suave(0, H, y + H * 0.2));
      return mix(mul(c, 1 + 0.05 * fbm(x * 40, y * 40, z * 40, s)), mul(c, 1.35), lent * 0.5);
    };
    out.push(parte(fruto({ R, H, covaTopo: 0.16, covaBase: 0.1, largCova: 0.28, lobos: 5, ampLobo: 0.025, cor, s, l: k.L }), k.ac, true));
    out.push(parte(cabinho(0, H * 0.86, 0, H * 0.3, R * 0.05, rgb3(k.c3, '#5b4024')), 'fosco'));
    if (k.tem('folha')) out.push(parte(tf(folha(R * 0.8, R * 0.38, rgb3(k.c3, '#4f7d2b'), mul(rgb3(k.c3, '#4f7d2b'), 1.3)), [0, H * 1.05, 0], [0.2, 0.6, 0.35]), 'acetinado'));
  } else if (v === 'pera') {
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 50, y * 50, z * 50, s)), c2, (1 - suave(0.06, 0.14, celula(x * 300, y * 300, z * 300, s))) * 0.6 + suave(0.6, 1, ruido(x * 20, y * 20, z * 20, s)) * 0.4);
    out.push(parte(fruto({ R, H, pescoco: 0.42, finoPescoco: 0.42, covaBase: 0.05, cor, s, l: k.L }), k.ac, true));
    out.push(parte(cabinho(0, H * 1.18, 0, H * 0.22, R * 0.05, rgb3(k.c3, '#5b4024'), 0.4), 'fosco'));
  } else if (v === 'tomate') {
    const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(H * 0.75, H, y) * 0.5), 1 + 0.04 * fbm(x * 40, y * 40, z * 40, s));
    out.push(parte(fruto({ R, H, covaTopo: 0.08, covaBase: 0.03, lobos: k.v.n ?? 5, ampLobo: 0.05, largCova: 0.35, cor, s, l: k.L }), 'brilhante', true));
    const topo = V(0, H * 0.93, 0);
    const sp = sepalas(5, R * 0.55, R * 0.16, c3, topo, -0.3, k.r);
    sp.push(cabinho(0, H * 0.95, 0, R * 0.25, R * 0.06, c3, 0.1));
    for (const g of sp) out.push(parte(g, 'fosco'));
  } else if (v === 'cebola') {
    const cor: CorFn = (x, y, z, t, a) => {
      const veio = Math.abs(Math.sin(a * 11 + fbm(x * 30, y * 30, z * 30, s) * 1.5)) ** 6;
      return mul(mix(c1, c2, veio * 0.45 + suave(0.85, 1, t) * 0.4), 1 + 0.07 * fbm(x * 60, y * 60, z * 60, s));
    };
    out.push(parte(fruto({ R, H, pescoco: 0.22, finoPescoco: 0.12, covaBase: 0.04, cor, s, l: k.L }), k.ac, true));
    for (let i = 0; i < 7; i++) {
      const ang = k.r.f(0, TAU), rr = k.r.f(0, R * 0.12);
      const L = R * k.r.f(0.15, 0.3);
      out.push(parte(caule([V(Math.cos(ang) * rr, H * 0.02, Math.sin(ang) * rr), V(Math.cos(ang) * (rr + L), -L * 0.15, Math.sin(ang) * (rr + L))], R * 0.012, R * 0.006, () => mul(c2, 0.9), 4), 'fosco'));
    }
  } else if (v === 'raiz') {
    // beterraba, nabo, rabanete: globo com cauda fina e talos curtos
    const cor: CorFn = (x, y, z) => {
      const base = k.tem('topo') ? mix(k.ci, c1, suave(H * 0.35, H * 0.7, y)) : c1;
      const anel = Math.abs(Math.sin(y * 900 + fbm(x * 40, y * 40, z * 40, s) * 3)) ** 20 * 0.25;
      return mul(base, 1 - anel + 0.05 * fbm(x * 60, y * 60, z * 60, s));
    };
    out.push(parte(fruto({ R, H, pontaBase: 0.25, covaTopo: 0.03, cor, s, l: k.L }), k.ac, true));
    out.push(parte(caule([V(0, -H * 0.2, 0), V(R * 0.1, -H * 0.5, 0), V(R * 0.3, -H * 0.85, 0)], R * 0.06, R * 0.01, () => k.tem('topo') ? k.ci : c1, 5), k.ac));
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * TAU + 0.3;
      const L = H * k.r.f(0.3, 0.5);
      out.push(parte(caule([V(0, H * 0.9, 0), V(Math.cos(ang) * L * 0.2, H + L * 0.6, Math.sin(ang) * L * 0.2), V(Math.cos(ang) * L * 0.5, H + L, Math.sin(ang) * L * 0.5)], R * 0.07, R * 0.05, () => c3, 6), 'acetinado'));
    }
  } else if (v === 'ovo') {
    // ovo deitado ao longo de X
    const L = k.T, Rr = (k.T * k.L) / 2;
    const cor: CorFn = (x, y, z) => {
      const p = 1 - suave(0.05, 0.13, celula(x * 500, y * 500, z * 500, s));
      return mul(mix(c1, c2, p * 0.4 + 0.15 * suave(0.3, 1, fbm(x * 60, y * 60, z * 60, s))), 1);
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 24, m: 24, cor,
      perfil: (t) => {
        const u = 2 * t - 1;
        const r = Rr * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.14 * u) * (1 - 0.05 * u * u);
        return { ry: r, rz: r };
      },
    }), k.ac, true));
  } else if (v === 'caqui') {
    const cor = tomE(c1, 0.05, 40, s);
    out.push(parte(fruto({ R, H, covaTopo: 0.05, lobos: 4, ampLobo: 0.04, cor, s, l: k.L }), 'brilhante', true));
    const sp = sepalas(4, R * 0.45, R * 0.35, c3, V(0, H * 0.97, 0), -0.15, k.r);
    sp.push(cabinho(0, H * 0.98, 0, R * 0.15, R * 0.06, mul(c3, 0.7), 0));
    for (const g of sp) out.push(parte(g, 'fosco'));
  } else if (v === 'melao') {
    const cor: CorFn = (x, y, z, t, a) => {
      const rede = 1 - suave(0.04, 0.1, Math.abs(celula(x * 90, y * 90, z * 90, s) - 0.9));
      const gomo = Math.abs(Math.cos(a * 5)) ** 40;
      return mix(mix(c1, c2, rede * 0.9), mul(c1, 0.8), gomo);
    };
    out.push(parte(fruto({ R, H, costelas: 10, ampCostela: 0.03, covaTopo: 0.03, covaBase: 0.03, cor, s, l: k.L, m: 36 }), 'fosco', true));
    out.push(parte(cabinho(0, H * 0.97, 0, R * 0.15, R * 0.05, mul(c2, 0.8), 0.2), 'fosco'));
  } else if (v === 'tuberculo') {
    // deitado ao longo de X, irregular, com olhos, anéis ou pelos
    const L = k.T, ry = (L * k.A) / 2, rz = (L * k.L) / 2;
    const amp = k.tem('nodoso') ? 0.2 : k.tem('liso') ? 0.04 : 0.09;
    const cor: CorFn = (x, y, z) => {
      let c = mul(c1, 1 + 0.1 * fbm(x * 70, y * 70, z * 70, s));
      if (k.tem('olhos')) c = mix(c, c2, 1 - suave(0.05, 0.12, celula(x * 60, y * 60, z * 60, s)));
      if (k.tem('aneis')) c = mix(c, c2, Math.abs(Math.sin(x * 260 + fbm(x * 30, y * 30, z * 30, s) * 2)) ** 10 * 0.8);
      if (k.tem('pelos')) c = mix(c, c2, suave(0.2, 0.6, ruido(x * 400, y * 400, z * 400, s)) * 0.6);
      if (k.tem('verruga')) c = mix(c, c2, 1 - suave(0.15, 0.3, celula(x * 220, y * 220, z * 220, s)));
      return c;
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 24, m: 24, cor,
      perfil: (t) => {
        const u = 2 * t - 1;
        const sx = Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.4));
        return { ry: ry * sx, rz: rz * sx };
      },
      mod: (t, a) => 1 + amp * fbm(t * 4, Math.cos(a) * 1.3, Math.sin(a) * 1.3, s),
    }), k.ac, true));
    if (k.tem('raizes')) {
      for (let i = 0; i < 10; i++) {
        const ang = k.r.f(0, TAU), x = k.r.f(-L * 0.3, L * 0.3);
        const p0 = V(x, ry * 0.3 * Math.cos(ang), rz * 0.9 * Math.sin(ang));
        const dir = V(0, Math.cos(ang) - 0.8, Math.sin(ang)).normalize();
        out.push(parte(caule([p0, p0.clone().addScaledVector(dir, L * 0.12).add(V(k.r.f(-0.01, 0.01), 0, 0)), p0.clone().addScaledVector(dir, L * 0.22)], L * 0.008, L * 0.002, () => mul(c2, 0.9), 4), 'fosco'));
      }
    }
  } else if (v === 'bola') {
    // esfera lisa: sorvete, sorbet, trufa de chocolate, bolinhas
    const amp = k.tem('rugoso') ? 0.06 : 0.015;
    const cor: CorFn = (x, y, z) => mul(c1, 1 + 0.06 * fbm(x * 90, y * 90, z * 90, s));
    out.push(parte(fruto({ R, H, ruido: amp, cor, s, l: k.L, fRuido: 0.8 / R * 6 }), k.ac, true));
    if (k.tem('palito')) out.push(parte(caule([V(0, H * 0.5, 0), V(0, H * 1.6, 0)], R * 0.08, R * 0.08, () => k.c3, 6), 'fosco'));
  } else {
    // 'liso': esfera ou elipsoide simples com manchinhas
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.05 * fbm(x * 50, y * 50, z * 50, s)), c2, suave(0.4, 0.8, fbm(x * 20, y * 20, z * 20, s + 2)) * 0.5);
    out.push(parte(fruto({ R, H, covaTopo: 0.03, cor, s, l: k.L, ruido: k.tem('rugoso') ? 0.08 : 0 }), k.ac, true));
    if (k.tem('cabo')) out.push(parte(cabinho(0, H * 0.96, 0, H * 0.25, R * 0.07, c3, 0.2), 'fosco'));
  }
  return out;
};

function rgb3(c: RGB, _fallback: string): RGB {
  return c;
}
function tomE(c: RGB, amp: number, f: number, s: number): CorFn {
  return (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));
}

/* ------------------------------------------------------------------ */
/* abobora (moranga, bolota, garrafa, espaguete)                       */
/* ------------------------------------------------------------------ */

export const gAbobora: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'garrafa' || v === 'oval') {
    // deitada ao longo de X
    const L = k.T, R = (L * k.L) / 2;
    const garrafa = v === 'garrafa';
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.05 * fbm(x * 30, y * 30, z * 30, s)), c2, suave(0.3, 0.7, fbm(x * 12, y * 40, z * 40, s)) * 0.35);
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 28, m: 28, cor,
      perfil: (t) => {
        const u = 2 * t - 1;
        let r = R * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.2));
        if (garrafa) {
          const bulbo = R * Math.sqrt(Math.max(0, 1 - ((t - 0.3) / 0.3) ** 2));
          const pesc = 0.55 * R * Math.sqrt(Math.max(0, 1 - Math.abs((t - 0.6) / 0.4) ** 5));
          r = Math.max(bulbo, t > 0.3 ? pesc : 0);
        }
        return { ry: r, rz: r, cy: r };
      },
    }), 'acetinado', true));
    out.push(parte(caule([V(L / 2 - L * 0.01, R * (garrafa ? 0.55 : 1), 0), V(L / 2 + L * 0.03, R * (garrafa ? 0.6 : 1.05), 0)], R * 0.12, R * 0.09, () => mul(c3, 0.8), 6), 'fosco'));
    return out;
  }
  const R = k.T / 2, H = k.T * k.A;
  const n = k.v.n ?? 10;
  const cor: CorFn = (x, y, z, t, a) => {
    const gomo = 1 - Math.abs(Math.sin((n * a) / 2));
    const c = mix(c1, c2, gomo ** 3 * 0.7 + suave(0.4, 0.8, fbm(x * 25, y * 25, z * 25, s)) * 0.3);
    return mul(c, 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s));
  };
  out.push(parte(fruto({ R, H, costelas: n, ampCostela: v === 'bolota' ? 0.16 : 0.09, covaTopo: v === 'bolota' ? 0.05 : 0.18, covaBase: 0.12, largCova: 0.3, pontaBase: v === 'bolota' ? 0.3 : 0, cor, s, m: 40, n: 24 }), 'acetinado', true));
  out.push(parte(caule([V(0, H * (v === 'bolota' ? 0.92 : 0.8), 0), V(R * 0.05, H * 1.02, 0), V(R * 0.12, H * 1.1, 0)], R * 0.09, R * 0.07, (x, y, z) => mul(c3, 1 + 0.15 * ruido(x * 300, y * 300, z * 300)), 7), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* cone (cenoura, mandioquinha, cercefi)                               */
/* ------------------------------------------------------------------ */

export const gCone: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const L = k.T, R = (L * k.L) / 2;
  const out: Parte[] = [];
  const p = k.v.v === 'curta' ? 1.2 : 0.85;
  const cor: CorFn = (x, y, z) => {
    const anel = Math.abs(Math.sin(x * 600 + fbm(x * 20, y * 60, z * 60, s) * 4)) ** 30;
    return mul(mix(c1, c2, anel * 0.6), 1 + 0.06 * fbm(x * 80, y * 80, z * 80, s));
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 20, cor,
    perfil: (t) => {
      const r = R * Math.sqrt(suave(0, 0.07, t)) * (1 - t) ** p * (k.v.v === 'curta' ? 1 + 0.25 * Math.sin(t * PI) : 1) + R * 0.02;
      return { ry: r, rz: r, cy: R };
    },
    mod: (t, a) => 1 + 0.04 * fbm(t * 9, Math.cos(a), Math.sin(a), s),
  }), k.ac, true));
  if (k.tem('rama')) {
    const x0 = -L / 2;
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU;
      const g = plumosa(L * 0.38, c3, k.r, 5);
      for (const gg of g) out.push(parte(tf(gg, [x0 + L * 0.01, R, 0], [ang, 0, PI - 0.55 + k.r.f(-0.15, 0.15)]), 'fosco'));
    }
  } else {
    out.push(parte(caule([V(-L / 2 + 0.002, R, 0), V(-L / 2 - L * 0.02, R, 0)], R * 0.35, R * 0.3, () => mul(c3, 0.9), 8), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* fuso: corpos alongados ao longo de X                                 */
/* ------------------------------------------------------------------ */

export const gFuso: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = (L * k.L) / 2;
  const v = k.v.v;
  const out: Parte[] = [];
  let curva = 0, faces = 0, ampFace = 0, verr = 0, gota = 0, ponta0 = 0.3, ponta1 = 0.3, segm = 0, ondas = 0;
  let tampa = false;
  switch (v) {
    case 'banana': curva = 0.15; faces = 5; ampFace = 0.06; ponta0 = 0.6; ponta1 = 0.5; break;
    case 'pepino': verr = 0.25; ponta0 = 0.25; ponta1 = 0.2; break;
    case 'berinjela': gota = 0.45; ponta0 = 0.15; ponta1 = 0.15; break;
    case 'abobrinha': gota = 0.12; ponta0 = 0.12; ponta1 = 0.15; faces = 6; ampFace = 0.015; break;
    case 'mandioca': ponta0 = 0.1; ponta1 = 0.55; tampa = true; curva = 0.05; break;
    case 'batata_doce': ponta0 = 0.7; ponta1 = 0.7; curva = 0.06; break;
    case 'mooli': ponta0 = 0.12; ponta1 = 0.45; break;
    case 'loofah': faces = 10; ampFace = 0.22; gota = 0.2; break;
    case 'melao_amargo': verr = 1; ponta0 = 0.5; ponta1 = 0.6; faces = 8; ampFace = 0.07; break;
    case 'babaco': faces = 5; ampFace = 0.12; ponta0 = 0.25; ponta1 = 0.35; break;
    case 'curuba': curva = 0.05; ponta0 = 0.4; ponta1 = 0.4; break;
    case 'lotus': segm = k.v.n ?? 3; ponta0 = 0.05; ponta1 = 0.05; tampa = true; break;
    case 'oval': ponta0 = 0.9; ponta1 = 0.9; break;
    case 'tamara': ponta0 = 0.9; ponta1 = 0.9; ondas = 1; break;
    case 'cilindro': ponta0 = 0.08; ponta1 = 0.08; break;
    default: break;
  }
  const cor: CorFn = (x, y, z, t, a) => {
    let c = mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
    if (k.tem('listras')) c = mix(c, c2, suave(0.0, 0.5, Math.sin(a * 9 + fbm(x * 25, y * 25, z * 25, s) * 2.5)) * 0.7);
    if (k.tem('pintas')) c = mix(c, c2, (1 - suave(0.1, 0.22, celula(x * 160, y * 160, z * 160, s))) * 0.8);
    if (k.tem('aneis')) c = mix(c, c2, Math.abs(Math.sin(x * 300 + fbm(x * 30, y * 30, z * 30, s) * 2)) ** 14 * 0.7);
    if (k.tem('manchado')) c = mix(c, c2, suave(0.2, 0.6, fbm(x * 30, y * 30, z * 30, s + 5)) * 0.6);
    if (v === 'banana') c = mix(c, mul(c2, 0.5), suave(0.94, 0.99, t) + suave(0.04, 0.0, t) * 0.8);
    if (k.tem('gradiente')) c = mix(c2, c, suave(0.15, 0.4, t));
    return c;
  };
  const corTampa: CorFn = (x, y, z) => mul(ci, 1 + 0.05 * fbm(x * 80, y * 80, z * 80, s));
  const base = R;
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 36, m: 24, cor, corTampa, tampa,
    perfil: (t) => {
      const u = 2 * t - 1;
      let r = R;
      r *= Math.sqrt(suave(0, ponta0, t)) * Math.sqrt(suave(1, 1 - ponta1, t));
      if (ponta0 > 0.6) r = R * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2));
      if (gota) r *= lerp(1 - gota, 1 + gota * 0.2, suave(-1, 0.7, u));
      if (segm) r *= 1 - 0.12 * Math.abs(Math.cos(t * PI * segm)) ** 12;
      return { ry: Math.max(r, R * 0.02), rz: Math.max(r, R * 0.02), cy: base + curva * L * (1 - u * u) * -1 + curva * L };
    },
    mod: (t, a) => {
      let m = 1;
      if (faces) m *= 1 + ampFace * (Math.abs(Math.cos((faces * a) / 2)) - 0.6);
      if (verr) m *= 1 + 0.1 * verr * (1 - suave(0.1, 0.25, celula(t * 18, Math.cos(a) * 2.5, Math.sin(a) * 2.5, s)));
      if (ondas) m *= 1 + 0.08 * fbm(t * 10, Math.cos(a) * 2, Math.sin(a) * 2, s);
      return m;
    },
  }), k.ac, true));
  // pontas: cabo e cálice
  const r0 = R * (gota ? 1 - gota : 1);
  if (v === 'berinjela' || v === 'abobrinha' || k.tem('calice')) {
    const pos = V(-L / 2 + L * 0.03, base, 0);
    const sp = sepalas(5, R * 0.9, r0 * 0.7, c3, pos, -1.0, k.r);
    for (const g of sp) {
      tf(g, [0, 0, 0], [0, 0, 0]);
      g.translate(-pos.x, -pos.y, -pos.z);
      g.rotateZ(PI / 2);
      g.translate(pos.x, pos.y, pos.z);
      out.push(parte(g, 'fosco'));
    }
    out.push(parte(caule([V(-L / 2 + L * 0.02, base, 0), V(-L / 2 - L * 0.05, base + R * 0.1, 0), V(-L / 2 - L * 0.1, base + R * 0.3, 0)], r0 * 0.22, r0 * 0.16, () => mul(c3, 0.85), 6), 'fosco'));
  } else if (v === 'banana') {
    const yb = base + 0; // ponta da haste no x0
    out.push(parte(caule([V(-L / 2 + L * 0.02, yb, 0), V(-L / 2 - L * 0.04, yb + R * 0.4, 0), V(-L / 2 - L * 0.08, yb + R * 1.0, 0)], R * 0.28, R * 0.22, () => mix(c1, c3, 0.6), 6), 'fosco'));
  } else if (k.tem('cabo')) {
    out.push(parte(caule([V(-L / 2 + L * 0.01, base, 0), V(-L / 2 - L * 0.04, base, 0)], R * 0.15, R * 0.12, () => c3, 6), 'fosco'));
  }
  if (k.tem('folhas')) {
    for (let i = 0; i < 4; i++) {
      const g = folha(L * 0.35, R * 0.8, c3, mul(c3, 1.3), { curva: 0.15, contorno: contornos.lanca });
      tf(g, [-L / 2 + L * 0.02, base, 0], [(i / 4) * TAU, 0, PI - 0.25]);
      out.push(parte(g, 'acetinado'));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* folhoso: repolho, alface, alcachofra, endívia                        */
/* ------------------------------------------------------------------ */

export const gFolhoso: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  const corVeio = (base: RGB, veio: RGB): CorFn => (x, y, z, t, a) => {
    const vv = Math.abs(Math.sin(a * 7 + Math.sin(t * 5 + a * 3) * 0.6)) ** 24 * suave(1, 0.2, t);
    return mul(mix(base, veio, vv * 0.8), 1 + 0.07 * fbm(x * 50, y * 50, z * 50, s));
  };
  if (v === 'repolho' || v === 'bruxelas') {
    out.push(parte(fruto({ R: R * 0.92, H: H * 0.95, covaBase: 0.04, cor: corVeio(c1, c2), s, ruido: 0.03, m: 32 }), k.ac, true));
    const nf = v === 'repolho' ? 7 : 5;
    for (let i = 0; i < nf; i++) {
      const ang = (i / nf) * TAU + k.r.f(-0.3, 0.3);
      const fl = torno({
        caminho: (sx) => {
          const th = lerp(0.15, 0.62, sx) * PI;
          return [R * Math.sin(th), H / 2 - (H / 2) * Math.cos(th)];
        },
        n: 10, m: 12, cor: corVeio(mul(c1, 0.92), c2),
        mod: (t, a) => (Math.abs(((a + PI) % TAU) - PI) < 1.1 ? 1.02 + 0.03 * Math.sin(t * 9) : 0.6),
      });
      tf(fl, [0, 0, 0], [0, ang, 0]);
      out.push(parte(fl, k.ac));
    }
    // talo cortado embaixo
    out.push(parte(tf(elipsoide(R * 0.15, R * 0.06, R * 0.15, () => mul(c2, 0.95), 4, 10), [0, R * 0.04, 0]), 'fosco'));
  } else if (v === 'alface' || v === 'frisee') {
    const crespa = v === 'frisee' || k.tem('crespa');
    out.push(parte(fruto({ R: R * 0.55, H: H * 0.7, cor: corVeio(mix(c1, c2, 0.4), c2), s, ruido: 0.05 }), k.ac, true));
    const nf = crespa ? 16 : 12;
    for (let i = 0; i < nf; i++) {
      const ang = (i / nf) * TAU * 2.3 + k.r.f(-0.2, 0.2);
      const camada = i / nf;
      const Lf = R * lerp(1.05, 0.7, camada), W = Lf * (crespa ? 0.62 : 0.9);
      const g = folha(Lf, W, mix(c1, c2, camada * 0.4), mix(c2, rgb1(1, 1, 0.85), 0.4), {
        contorno: crespa ? contornos.recortada : contornos.redonda, curva: crespa ? lerp(0.25, 0.8, camada) : lerp(0.6, 1.4, camada), concha: 0.35, ondula: crespa ? 0.12 : 0.06, n: 12, m: 10, s,
      });
      tf(g, [0, R * 0.05, 0], [0, -ang, crespa ? lerp(0.12, 0.7, camada) : lerp(0.45, 1.0, camada)]);
      out.push(parte(g, k.ac));
    }
  } else if (v === 'alcachofra') {
    // núcleo em ovo + brácteas em filotaxia + talo deitado
    const nb = k.v.n ?? 44;
    out.push(parte(fruto({ R: R * 0.7, H: H * 0.95, cor: tomE(c1, 0.05, 40, s), s }), k.ac, true));
    const ouro = PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nb; i++) {
      const f = i / nb;
      const th = lerp(0.95, 0.15, f) * PI; // de baixo para o topo
      const ang = i * ouro;
      const rr = R * 0.7 * Math.sin(th), y = (H * 0.95) / 2 * (1 - Math.cos(th));
      const Lb = R * lerp(0.75, 0.4, f), Wb = Lb * 0.8;
      const g = folha(Lb, Wb, mix(c1, c2, 0.15 + 0.5 * f), c2, {
        contorno: contornos.gota, curva: -0.25, concha: 0.4, esp: Wb * 0.08, n: 6, m: 6,
        cor: (x, yy, z) => mix(mul(c1, 0.95 + 0.1 * f), c2, suave(Lb * 0.6, Lb, x) * 0.8),
      });
      tf(g, [Math.cos(ang) * rr * 0.9, y, Math.sin(ang) * rr * 0.9], [0, -ang, PI / 2 - lerp(0.25, 0.75, f) - (th - PI / 2) * 0.3]);
      out.push(parte(g, k.ac));
    }
    if (!k.tem('semtalo')) out.push(parte(caule([V(0, H * 0.05, 0), V(0, -H * 0.1, 0), V(R * 0.1, -H * 0.4, 0)], R * 0.16, R * 0.13, tomE(mix(c1, c3, 0.5), 0.05, 50, s), 8), 'fosco'));
  } else if (v === 'endivia') {
    // cone alongado deitado ao longo de X
    const L = k.T, Rr = (L * k.L) / 2;
    const cor: CorFn = (x, y, z, t) => mul(mix(c1, c2, suave(0.65, 1, t)), 1 + 0.05 * fbm(x * 80, y * 80, z * 80, s));
    const perfil = (t: number) => {
      const r = Rr * Math.sqrt(suave(0, 0.08, t)) * Math.sin(PI * (0.25 + 0.75 * t) ** 1.2) ** 0.8 + 1e-4;
      return { ry: r, rz: r, cy: Rr };
    };
    out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 30, m: 24, cor, perfil }), k.ac, true));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU;
      const g = folha(L * 0.8, Rr * 1.3, c1, c2, { contorno: contornos.lanca, concha: 0.6, n: 12, m: 8, cor: (x, y, z) => mix(c1, c2, suave(L * 0.55, L * 0.8, x)) });
      tf(g, [-L / 2 + L * 0.12, Rr, 0], [ang, 0, 0]);
      g.translate(0, Math.cos(ang) * Rr * 0.82 - 0, Math.sin(ang) * Rr * 0.82);
      out.push(parte(g, k.ac));
    }
  }
  return out;
};
function rgb1(r: number, g: number, b: number): RGB {
  return [r, g, b];
}

/* ------------------------------------------------------------------ */
/* bulbo: alho, erva-doce, couve-rábano, chalota                        */
/* ------------------------------------------------------------------ */

export const gBulbo: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  if (v === 'alho') {
    const nd = k.v.n ?? 9;
    const corD: CorFn = (x, y, z) => {
      const veio = Math.abs(Math.sin(Math.atan2(z, x) * 30 + y * 200)) ** 10;
      return mix(mul(c1, 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s)), c2, veio * 0.4 + suave(H * 0.5, 0, y) * 0.0);
    };
    // dentes em gomos em volta do eixo
    for (let i = 0; i < nd; i++) {
      const ang = (i / nd) * TAU;
      const d = fruto({ R: R * 0.42, H: H * 0.95, pescoco: 0.3, finoPescoco: 0.15, l: 0.75, cor: corD, s: s + i, n: 14, m: 14 });
      tf(d, [Math.cos(ang) * R * 0.45, 0, Math.sin(ang) * R * 0.45], [0, -ang, 0.2], [1, 1, 1]);
      // inclina para o centro no topo
      out.push(parte(d, 'fosco', true));
    }
    out.push(parte(fruto({ R: R * 0.55, H: H * 1.08, pescoco: 0.3, finoPescoco: 0.12, cor: corD, s }), 'fosco', true));
    out.push(parte(tf(elipsoide(R * 0.35, R * 0.05, R * 0.35, () => mul(c2, 0.8), 4, 10), [0, 0, 0]), 'fosco'));
  } else if (v === 'chalota') {
    const cor = tomE(c1, 0.1, 50, s);
    for (let i = 0; i < (k.v.n ?? 1); i++) {
      const g = fruto({ R: R * (i ? 0.85 : 1), H, pescoco: 0.3, finoPescoco: 0.15, covaBase: 0.03, cor, s: s + i });
      tf(g, [i * R * 1.3, 0, 0], [0, 0, i ? -0.25 : 0.05]);
      out.push(parte(g, 'fosco', true));
    }
  } else if (v === 'erva_doce') {
    // bulbo em camadas deitado + hastes + folhas plumosas
    const cor: CorFn = (x, y, z, t, a) => mix(mul(c1, 1 + 0.04 * fbm(x * 50, y * 50, z * 50, s)), c2, Math.abs(Math.sin(a * 3)) ** 30 * 0.4 + suave(0.7, 1, t) * 0.5);
    const g = fruto({ R, H, l: 0.75, pescoco: 0.25, finoPescoco: 0.45, covaBase: 0.05, cor, s, costelas: 4, ampCostela: 0.06 });
    out.push(parte(g, k.ac, true));
    for (let i = 0; i < 4; i++) {
      const ang = (i - 1.5) * 0.25;
      const Lh = H * 1.3;
      const top = V(Math.sin(ang) * Lh, H + Lh * Math.cos(ang), 0);
      out.push(parte(caule([V(0, H * 0.8, 0), V(top.x * 0.5, H + Lh * 0.5, 0), top], R * 0.16, R * 0.08, tomE(mix(c2, c3, 0.5), 0.06, 60, s), 7), 'acetinado'));
      for (const p of plumosa(Lh * 0.5, c3, k.r, 4)) out.push(parte(tf(p, [top.x, top.y, 0], [0, i * 1.4, PI / 2 + ang]), 'fosco'));
    }
  } else if (v === 'couve_rabano') {
    const cor = tomE(c1, 0.05, 50, s);
    out.push(parte(fruto({ R, H, covaTopo: 0.03, pontaBase: 0.12, cor, s }), k.ac, true));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU, y0 = H * lerp(0.4, 0.85, (i % 3) / 2);
      const rr = R * Math.sin(Math.acos(clamp((y0 - H / 2) / (H / 2), -1, 1)));
      const p0 = V(Math.cos(ang) * rr * 0.95, y0, Math.sin(ang) * rr * 0.95);
      const p1 = V(Math.cos(ang) * (rr + R * 0.5), y0 + H * 0.6, Math.sin(ang) * (rr + R * 0.5));
      out.push(parte(caule([p0, p0.clone().lerp(p1, 0.5).add(V(0, H * 0.05, 0)), p1], R * 0.06, R * 0.04, () => c1, 6), k.ac));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* talo: brócolis, couve-flor, aspargo, aipo, cebolinha, alho-poró      */
/* ------------------------------------------------------------------ */

function cabecaFloretes(R: number, H: number, cor: CorFn, s: number, nFl: number, r: { f: (a: number, b: number) => number }): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  // cúpula central granulosa
  out.push(fruto({ R, H, cor, s, ruido: 0.05, fRuido: 6 / R, m: 30, n: 18 }));
  const ouro = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nFl; i++) {
    const f = (i + 0.5) / nFl;
    const th = Math.acos(1 - f * 0.9);
    const ang = i * ouro;
    const rr = R * Math.sin(th) * 0.92, y = H / 2 + (H / 2) * Math.cos(th) * 0.92;
    const rf = R * r.f(0.26, 0.36);
    const g = fruto({ R: rf, H: rf * 1.4, cor, s: s + i, ruido: 0.1, fRuido: 6 / rf, n: 8, m: 10 });
    const n = V(Math.sin(th) * Math.cos(ang), Math.cos(th), Math.sin(th) * Math.sin(ang));
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
    g.applyQuaternion(q);
    g.translate(Math.cos(ang) * rr - n.x * rf * 0.6, y - n.y * rf * 0.6, Math.sin(ang) * rr - n.z * rf * 0.6);
    out.push(g);
  }
  return out;
}

export const gTalo: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'brocolis' || v === 'couveflor') {
    const R = k.T / 2, H = k.T * k.A;
    const corCab: CorFn = (x, y, z) => {
      const g = 1 - suave(0.1, 0.3, celula(x * 500, y * 500, z * 500, s));
      return mul(mix(c1, c2, g * 0.6 + 0.25 * fbm(x * 40, y * 40, z * 40, s)), 1);
    };
    const cab = cabecaFloretes(R * 0.85, H * 0.55, corCab, s, v === 'brocolis' ? 14 : 18, k.r);
    for (const g of cab) {
      g.translate(0, H * 0.42, 0);
      out.push(parte(g, k.ac, true));
    }
    if (v === 'brocolis') {
      const corT = tomE(c3, 0.06, 60, s);
      out.push(parte(caule([V(0, 0, 0), V(0, H * 0.25, 0), V(0, H * 0.55, 0)], R * 0.28, R * 0.38, corT, 12), 'acetinado', true));
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU;
        out.push(parte(caule([V(0, H * 0.35, 0), V(Math.cos(ang) * R * 0.35, H * 0.55, Math.sin(ang) * R * 0.35), V(Math.cos(ang) * R * 0.55, H * 0.7, Math.sin(ang) * R * 0.55)], R * 0.1, R * 0.08, corT, 7), 'acetinado'));
      }
    } else {
      // folhas verdes envolvendo a base
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU;
        const g = folha(R * 1.1, R * 0.7, c3, mul(c3, 1.5), { curva: 0.9, concha: 0.4, contorno: contornos.oval, ondula: 0.05, n: 10, m: 8, s: s + i });
        tf(g, [0, H * 0.05, 0], [0, -ang, 0.55]);
        out.push(parte(g, 'acetinado'));
      }
      out.push(parte(caule([V(0, 0, 0), V(0, H * 0.4, 0)], R * 0.25, R * 0.3, tomE(mix(c2, c3, 0.3), 0.05, 60, s), 10), 'acetinado'));
    }
    return out;
  }
  // talos deitados ao longo de X
  const L = k.T, Rr = (L * k.L) / 2;
  const nt = k.v.n ?? 1;
  const corT: CorFn = (x, y, z, t, a) => {
    let c = k.tem('gradiente') ? mix(c2, c1, suave(0.15, 0.6, t)) : c1;
    c = mul(c, 1 + 0.06 * fbm(x * 60, y * 120, z * 120, s) + 0.06 * Math.sin(a * 14));
    return c;
  };
  for (let i = 0; i < nt; i++) {
    const ang = nt > 1 ? (i / nt) * TAU : 0;
    const off = nt > 1 ? Rr * 1.2 : 0;
    const yz = V(0, Math.cos(ang) * off * 0.6, Math.sin(ang) * off);
    const Li = L * (nt > 1 ? k.r.f(0.85, 1) : 1);
    const ranhura = v === 'aipo' || v === 'cardo' || v === 'ruibarbo';
    const g = corpo({
      x0: -L / 2, x1: -L / 2 + Li * (v === 'poro' ? 0.55 : 1), n: nt > 3 ? 18 : 28, m: ranhura ? 18 : 14, cor: corT, tampa: true,
      corTampa: () => ci,
      perfil: (t) => {
        let r = Rr * (v === 'aspargo' ? lerp(1.1, 0.85, t) : 1);
        if (v === 'cebolinha' || v === 'poro') r *= 1 + 0.25 * suave(0.2, 0, t);
        return { ry: r * (ranhura ? 0.75 : 1), rz: r, cy: Rr + yz.y, cz: yz.z };
      },
      mod: ranhura ? (t, a) => 1 + 0.06 * Math.cos(a * 7) - 0.25 * suave(-0.4, -1, Math.cos(a)) : undefined,
    });
    out.push(parte(g, k.ac, true));
    if (v === 'aspargo') {
      // ponta em botão escamoso
      const xp = -L / 2 + Li;
      const p = fruto({ R: Rr * 1.05, H: Rr * 4, pescoco: 0.2, finoPescoco: 0.3, cor: (x, y, z) => mix(mix(c1, c2, 0.5), c2, Math.abs(Math.sin(Math.atan2(z, x) * 3 + y * 900)) ** 6), s, n: 12, m: 14 });
      tf(p, [xp - Rr * 0.5, Rr + yz.y, yz.z], [0, 0, -PI / 2]);
      out.push(parte(p, k.ac));
      for (let e = 0; e < 4; e++) {
        const xe = -L / 2 + Li * (0.3 + e * 0.15);
        const sc = folha(Rr * 0.9, Rr * 0.5, c2, c2, { contorno: contornos.lanca, n: 4, m: 6 });
        tf(sc, [xe, Rr * 1.85 + yz.y, yz.z], [(e % 2 ? 1 : -1) * 1.2 + PI / 2 * 0, 0, 0.35]);
        out.push(parte(sc, k.ac));
      }
    }
    if (v === 'cebolinha') {
      const xr = -L / 2;
      for (let r = 0; r < 6; r++) {
        const ang = k.r.f(0, TAU);
        out.push(parte(caule([V(xr, Rr + yz.y, yz.z), V(xr - L * 0.03, Rr + yz.y + Math.cos(ang) * Rr, yz.z + Math.sin(ang) * Rr * 2)], Rr * 0.12, Rr * 0.05, () => rgb1(0.75, 0.7, 0.6), 4), 'fosco'));
      }
    }
    if (v === 'poro') {
      // folhas achatadas verde-escuras em leque
      for (let f = 0; f < 5; f++) {
        const ang = (f - 2) * 0.12;
        const g = folha(L * 0.5, Rr * 2.2, c3, mul(c3, 1.25), { contorno: contornos.fita, curva: 0.05, esp: Rr * 0.08, n: 14, m: 8 });
        tf(g, [-L / 2 + L * 0.5, Rr + (f - 2) * Rr * 0.18, 0], [PI / 2 + ang * 2, ang, 0]);
        out.push(parte(g, 'acetinado'));
      }
    }
  }
  if (v === 'aipo' || v === 'ruibarbo' || v === 'cardo') {
    // folhas no topo do maço
    const nf = v === 'ruibarbo' ? 1 : 5;
    for (let f = 0; f < nf; f++) {
      const W = v === 'ruibarbo' ? L * 0.55 : L * 0.18;
      const g = folha(v === 'ruibarbo' ? L * 0.5 : L * 0.2, W, c3, mul(c3, 1.2), { contorno: v === 'ruibarbo' ? contornos.palmada : contornos.recortada, ondula: 0.15, concha: 0.2, n: 12, m: 10, s: s + f });
      tf(g, [L / 2 - L * 0.04, Rr * 2, (f - (nf - 1) / 2) * Rr * 1.5], [0, (f - (nf - 1) / 2) * 0.4, 0.15]);
      out.push(parte(g, 'acetinado'));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* cacho: uva, groselha, berinjela-ervilha                              */
/* ------------------------------------------------------------------ */

export const gCacho: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T;
  const nb = k.v.n ?? 30;
  const rb = (k.v.l ?? 0.1) * L / 2; // raio do bago relativo a L
  const corB: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 200, y * 200, z * 200, s)) * 0.5), 1);
  const ramos: THREE.Vector3[][] = [];
  if (v === 'linha') {
    // cabinho horizontal com bagas penduradas (groselha)
    const cab = [V(-L / 2, rb * 2.5, 0), V(0, rb * 2.8, 0), V(L / 2, rb * 2.2, 0)];
    out.push(parte(caule(cab, rb * 0.12, rb * 0.08, () => c3, 5), 'fosco'));
    for (let i = 0; i < nb; i++) {
      const x = lerp(-L / 2 + rb, L / 2 - rb, i / Math.max(1, nb - 1));
      const z = (i % 2 ? 1 : -1) * rb * 0.9;
      const g = grao(rb, rb, rb, corB, 6, 10);
      g.translate(x, rb, z);
      out.push(parte(g, 'umido', true));
      out.push(parte(caule([V(x, rb * 1.8, z * 0.5), V(x, rb * 2.6, 0)], rb * 0.08, rb * 0.08, () => c3, 4), 'fosco'));
    }
    return out;
  }
  // cacho cônico deitado ao longo de X (topo do cacho em -X)
  const Rc = L * (k.v.a ?? 0.35);
  const ouro = PI * (3 - Math.sqrt(5));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < nb; i++) {
    const f = (i + 0.5) / nb;
    const x = lerp(-L / 2 + rb * 1.2, L / 2 - rb, f);
    const rad = Rc * Math.sin(PI * (0.25 + 0.75 * (1 - f) ** 0.9) ) * (0.55 + 0.45 * ((i * 0.618) % 1));
    const ang = i * ouro * 3.1;
    pts.push(V(x, Rc + Math.cos(ang) * rad * 0.7, Math.sin(ang) * rad));
  }
  const ex = v === 'uva' ? 1.2 : 1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const g = grao(rb * ex, rb, rb, corB, 6, 10);
    g.rotateY(k.r.f(0, TAU));
    g.translate(p.x, p.y, p.z);
    out.push(parte(g, v === 'uva' ? 'acetinado' : 'brilhante', true));
    if (i % 3 === 0) ramos.push([V(p.x - rb * 0.5, Rc + (p.y - Rc) * 0.3, p.z * 0.3), p.clone().lerp(V(p.x, Rc, 0), 0.6)]);
  }
  const eixo = [V(-L / 2 - L * 0.1, Rc + rb, 0), V(-L / 2 + L * 0.1, Rc, 0), V(L * 0.3, Rc, 0)];
  out.push(parte(caule(eixo, rb * 0.25, rb * 0.12, tomE(c3, 0.1, 200, s), 6), 'fosco'));
  for (const r of ramos) out.push(parte(caule(r, rb * 0.1, rb * 0.08, () => c3, 4), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* erva: ramos, folhas soltas, maços                                    */
/* ------------------------------------------------------------------ */

export const gErva: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T;
  const nerv = mix(c1, c2, 0.6);
  const ctMap: Record<string, (t: number) => number> = {
    oval: contornos.oval, lanca: contornos.lanca, serrilhada: contornos.serrilhada, recortada: contornos.recortada,
    redonda: contornos.redonda, palmada: contornos.palmada, fita: contornos.fita, gota: contornos.gota,
  };
  const ct = ctMap[k.v.d?.split(' ')[0] ?? 'oval'] ?? contornos.oval;
  const corCaule = tomE(c3, 0.08, 200, s);
  if (v === 'folha') {
    // folha solta grande (louro, parreira, bananeira, espinafre)
    const W = L * k.L;
    const g = folha(L, W, c1, nerv, { contorno: ct, curva: 0.05, concha: 0.08, ondula: k.tem('ondulada') ? 0.08 : 0.02, n: 22, m: 12, s, esp: Math.max(0.0007, W * 0.012) });
    g.translate(-L / 2, 0, 0);
    out.push(parte(g, k.ac, true));
    if (!k.tem('semcabo')) out.push(parte(caule([V(-L / 2 + L * 0.02, 0.001, 0), V(-L / 2 - L * 0.08, 0.002, 0)], W * 0.025, W * 0.02, corCaule, 5), 'acetinado'));
    return out;
  }
  if (v === 'haste' || v === 'cebolinha') {
    // feixe de hastes tubulares finas
    const nh = k.v.n ?? 12;
    const rh = L * 0.006;
    for (let i = 0; i < nh; i++) {
      const z = (i - nh / 2) * rh * 2.1 + k.r.f(-rh, rh);
      const y = rh + (i % 3) * rh * 1.6;
      const g = corpo({ x0: -L / 2, x1: L / 2 * k.r.f(0.85, 1), n: 12, m: 6, perfil: (t) => ({ ry: rh * (1 - 0.6 * t ** 4), rz: rh * (1 - 0.6 * t ** 4), cy: y, cz: z }), cor: tomE(c1, 0.08, 200, s) });
      out.push(parte(g, k.ac, true));
    }
    return out;
  }
  if (v === 'maco') {
    // folhas com talo grosso em leque (espinafre, acelga, mostarda, dente-de-leão)
    const nf = k.v.n ?? 5;
    for (let i = 0; i < nf; i++) {
      const ang = (i - (nf - 1) / 2) * 0.22;
      const Lt = L * 0.38, W = L * k.L;
      const tal = caule([V(-L / 2, L * 0.01, 0), V(-L / 2 + Lt, L * 0.02, 0)], W * 0.06, W * 0.07, tomE(c2, 0.05, 100, s), 7);
      const fl = folha(L - Lt, W, c1, nerv, { contorno: ct, concha: 0.12, ondula: k.tem('ondulada') ? 0.12 : 0.04, n: 16, m: 10, s: s + i, curva: 0.03 });
      fl.translate(-L / 2 + Lt * 0.9, L * 0.02, 0);
      for (const g of [tal, fl]) {
        g.rotateY(ang);
        g.translate(0, i * L * 0.008, 0);
      }
      out.push(parte(tal, 'acetinado', true));
      out.push(parte(fl, k.ac, true));
    }
    return out;
  }
  // ramo: caule com folhas opostas, agulhas ou plumas
  const nn = k.v.n ?? 7;
  const caminho = [V(-L / 2, 0.002, 0), V(-L / 6, L * 0.02, L * 0.02), V(L / 6, L * 0.025, -L * 0.01), V(L / 2, L * 0.02, 0)];
  const rc = v === 'agulha' ? L * 0.012 : L * 0.008;
  out.push(parte(caule(caminho, rc, rc * 0.5, v === 'agulha' ? tomE(c2, 0.1, 200, s) : corCaule, 6), 'fosco', true));
  const curvaC = new THREE.CatmullRomCurve3(caminho);
  if (v === 'plumoso') {
    for (let i = 0; i < nn; i++) {
      const t = 0.15 + (0.85 * i) / nn;
      const p = curvaC.getPointAt(t);
      for (const sg of [-1, 1]) {
        const g = plumosa(L * 0.35 * (1.1 - t * 0.5), c1, k.r, 3);
        for (const gg of g) out.push(parte(tf(gg, [p.x, p.y, p.z], [0, sg * k.r.f(0.6, 1.1), 0.1]), k.ac));
      }
    }
    return out;
  }
  const nfolhas = v === 'agulha' ? nn * 4 : nn;
  for (let i = 0; i < nfolhas; i++) {
    const t = 0.08 + (0.9 * i) / nfolhas;
    const p = curvaC.getPointAt(Math.min(1, t));
    const pares = v === 'agulha' ? [((i * 2.39) % TAU)] : [0, PI];
    for (const giro of pares) {
      let g: THREE.BufferGeometry;
      if (v === 'agulha') {
        const la = L * (k.tem('mini') ? 0.05 : 0.14) * (1 - t * 0.4);
        g = folha(la, la * (k.tem('mini') ? 0.5 : 0.14), c1, mul(c1, 1.25), { contorno: contornos.oval, esp: la * 0.05, n: 4, m: 6, curva: 0.15 });
        tf(g, [p.x, p.y, p.z], [giro, -0.7 - k.r.f(0, 0.3), 0.35]);
      } else {
        const lf = L * 0.32 * (1.05 - t * 0.5) * k.r.f(0.8, 1.1);
        g = folha(lf, lf * (k.v.l ?? 0.55), c1, nerv, { contorno: ct, concha: 0.15, curva: -0.05, n: 10, m: 8, s: s + i, ondula: k.tem('rugosa') ? 0.06 : 0.01 });
        tf(g, [p.x, p.y, p.z], [giro === 0 ? 0.25 : -0.25, giro === 0 ? -1.0 - k.r.f(0, 0.3) : 1.0 + k.r.f(0, 0.3), 0.1]);
      }
      out.push(parte(g, k.ac));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* vagem                                                                */
/* ------------------------------------------------------------------ */

export const gVagem: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, Hh = W * (k.v.a ?? 0.7);
  const ng = k.v.n ?? 6;
  const curva = v === 'fina' ? 0.06 : 0.04;
  const graos = k.tem('graos');
  const faces = v === 'quiabo' ? 5 : 0;
  const cor: CorFn = (x, y, z, t, a) => {
    let c = mul(c1, 1 + 0.06 * fbm(x * 90, y * 90, z * 90, s));
    if (faces) c = mix(c, c2, Math.abs(Math.cos((faces * a) / 2)) ** 20 * 0.5);
    if (k.tem('pintas')) c = mix(c, c2, (1 - suave(0.08, 0.2, celula(x * 150, y * 150, z * 150, s))) * 0.7);
    return mix(c, c2, Math.abs(Math.sin(a)) ** 40 * 0.4);
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 36, m: faces ? 15 : 14, cor, corTampa: () => ci,
    perfil: (t) => {
      const u = 2 * t - 1;
      let env = Math.sqrt(suave(0, 0.12, t)) * Math.sqrt(suave(1, v === 'quiabo' ? 0.1 : 0.8, t));
      if (v === 'quiabo') env = Math.sqrt(suave(0, 0.08, t)) * (1 - t) ** 0.7;
      let bump = 1;
      if (graos) bump = 1 + 0.34 * Math.abs(Math.sin(t * PI * ng)) ** 1.5 * Math.sin(PI * t);
      return { ry: Hh / 2 * env * bump, rz: W / 2 * env * (graos ? 0.9 + 0.1 * bump : 1), cy: Hh / 2 + curva * L * (1 - u * u) };
    },
    mod: faces ? (t, a) => 1 + 0.1 * (Math.abs(Math.cos((faces * a) / 2)) - 0.6) : undefined,
  }), k.ac, true));
  // cabinho na ponta -X
  out.push(parte(caule([V(-L / 2 + 0.002, Hh / 2, 0), V(-L / 2 - L * 0.04, Hh * 0.6, 0)], Math.min(W, Hh) * (v === 'quiabo' ? 0.35 : 0.15), Math.min(W, Hh) * 0.1, () => c3, 6), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* espiga de milho                                                      */
/* ------------------------------------------------------------------ */

export const gEspiga: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = (L * k.L) / 2;
  const fileiras = 14;
  const cor: CorFn = (x, y, z, t, a) => {
    const gx = Math.abs(Math.sin((x / L) * PI * 40)), ga = Math.abs(Math.sin(a * fileiras / 2));
    const borda = Math.max(gx, ga) ** 10;
    return mul(mix(c1, c2, borda * 0.8), 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s));
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 60, m: 28, cor,
    perfil: (t) => {
      const r = R * Math.sqrt(suave(0, 0.06, t)) * lerp(1, 0.7, t) * Math.sqrt(suave(1, 0.9, t)) + 1e-4;
      return { ry: r, rz: r, cy: R };
    },
    mod: (t, a) => 1 + 0.05 * Math.abs(Math.sin((t * PI * 40))) ** 0.5 * Math.abs(Math.sin(a * fileiras / 2)) ** 0.5,
  }), 'brilhante', true));
  if (k.tem('palha')) {
    for (let i = 0; i < 5; i++) {
      const ang = PI + (i - 2) * 0.55;
      const g = folha(L * 1.1, R * 2.4, c3, mul(c3, 1.15), { contorno: contornos.lanca, concha: 0.9, n: 18, m: 8, esp: R * 0.05, s: s + i });
      tf(g, [-L / 2 - L * 0.08, R + Math.cos(ang) * R * 0.95, Math.sin(ang) * R * 0.95], [ang, 0, 0]);
      out.push(parte(g, 'fosco'));
    }
    // cabelo do milho
    for (let i = 0; i < 9; i++) {
      out.push(parte(caule([V(L / 2 - L * 0.04, R, 0), V(L / 2 + L * 0.05, R + k.r.f(-R, R) * 0.6, k.r.f(-R, R) * 0.6), V(L / 2 + L * 0.12, R * 0.6 + k.r.f(-R, R), k.r.f(-R, R))], R * 0.03, R * 0.015, () => rgb1(0.6, 0.38, 0.12), 3), 'fosco'));
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* cogumelo                                                             */
/* ------------------------------------------------------------------ */

export const gCogumelo: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  const nc = k.v.n ?? 1;
  for (let c = 0; c < nc; c++) {
    const esc = nc > 1 ? k.r.f(0.7, 1) : 1;
    const off = nc > 1 ? V((c - (nc - 1) / 2) * R * 1.1, 0, k.r.f(-R, R) * 0.4) : V();
    const rC = R * esc, hT = H * 0.55 * esc, rT = R * (v === 'cepe' ? 0.4 : v === 'chanterelle' ? 0.22 : 0.2) * esc;
    const corChapeu: CorFn = (x, y, z, t, a) => {
      let cc = mul(c1, 1 + 0.07 * fbm(x * 60, y * 60, z * 60, s));
      if (k.tem('flocos')) cc = mix(cc, c2, (1 - suave(0.1, 0.25, celula(x * 140, y * 140, z * 140, s))) * 0.7);
      if (k.tem('favo')) cc = mix(cc, mul(c1, 0.4), suave(0.75, 0.95, celula(x * 160, y * 160, z * 160, s)));
      const lamela = Math.abs(Math.sin(a * 40)) ** 4;
      return t < 0.45 ? mix(ci, mul(ci, 0.75), lamela * 0.6) : cc;
    };
    let chapeu: THREE.BufferGeometry;
    if (v === 'chanterelle') {
      // funil de borda ondulada
      chapeu = torno({
        caminho: [[0, 0], [rT, 0.0], [rT * 1.2, hT * 0.8], [rC * 0.8, hT * 1.35], [rC, hT * 1.5], [rC * 0.9, hT * 1.6], [rC * 0.4, hT * 1.45], [0, hT * 1.25]],
        n: 22, m: 30, cor: (x, y, z, t) => mul(c1, 1 + 0.08 * fbm(x * 60, y * 60, z * 60, s) - (t < 0.45 ? 0.1 * Math.abs(Math.sin(Math.atan2(z, x) * 25)) : 0)),
        mod: (t, a) => 1 + 0.1 * Math.sin(a * 5 + c) * suave(0.3, 0.6, t),
      });
      chapeu.translate(off.x, off.y, off.z);
      out.push(parte(chapeu, k.ac, true));
      continue;
    }
    if (v === 'ostra' || v === 'orelha') {
      // leque em camadas, assimétrico
      const g = torno({
        caminho: [[0, 0], [rC * 0.2, rC * 0.08], [rC, rC * 0.32], [rC * 1.03, rC * 0.42], [rC * 0.6, rC * 0.46], [0, rC * 0.36]],
        n: 16, m: 26, cor: corChapeu, l: 0.75,
        mod: (t, a) => (0.55 + 0.45 * Math.max(0, Math.cos(a))) * (1 + 0.06 * Math.sin(a * 7)) * (1 + (v === 'orelha' ? 0.15 * fbm(t * 4, a, 0, s) : 0)),
      });
      tf(g, [off.x * 0.6, off.y + c * rC * 0.25, off.z], [0, c * 0.6, 0]);
      out.push(parte(g, k.ac, true));
      continue;
    }
    // talo
    const talo = torno({
      caminho: v === 'cepe'
        ? [[0, 0], [rT * 1.15, hT * 0.05], [rT * 1.3, hT * 0.4], [rT * 0.9, hT * 0.95], [0, hT * 1.0]]
        : [[0, 0], [rT * 0.95, 0], [rT, hT * 0.5], [rT * 0.9, hT], [0, hT]],
      n: 10, m: 14, cor: (x, y, z) => mul(ci, 1 + 0.06 * fbm(x * 80, y * 80, z * 80, s) - 0.05 * Math.abs(Math.sin(y * 800))),
    });
    talo.translate(off.x, off.y, off.z);
    out.push(parte(talo, 'fosco', true));
    // chapéu
    const hc = H - hT;
    if (v === 'morel') {
      chapeu = fruto({ R: rC, H: hc * 1.6, pescoco: 0.5, finoPescoco: 0.35, cor: corChapeu, s, ruido: 0.12, fRuido: 6 / rC, m: 26 });
    } else {
      const plano = v === 'shiitake' ? 0.55 : v === 'pied_de_mouton' ? 0.65 : 1;
      chapeu = torno({
        caminho: [[0, 0], [rT * 1.2, hc * 0.05], [rC * 0.85, hc * 0.12], [rC, hc * 0.3], [rC * 0.92, hc * 0.7 * plano], [rC * 0.55, hc * plano], [0, hc * 1.05 * plano]],
        n: 18, m: 28, cor: corChapeu,
        mod: (t, a) => 1 + (k.tem('irregular') ? 0.08 * fbm(Math.cos(a), Math.sin(a), t, s) : 0.015 * Math.sin(a * 5)),
      });
    }
    chapeu.translate(off.x, off.y + hT * 0.85, off.z);
    out.push(parte(chapeu, k.ac, true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* pimenta                                                              */
/* ------------------------------------------------------------------ */

export const gPimenta: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const brilho: CorFn = (x, y, z) => mul(c1, 1 + 0.05 * fbm(x * 50, y * 50, z * 50, s));
  if (v === 'pimentao' || v === 'lanterna') {
    const R = k.T / 2, H = k.T * k.A;
    const n = k.v.n ?? 4;
    out.push(parte(fruto({ R, H, covaTopo: 0.12, covaBase: v === 'pimentao' ? 0.06 : 0, largCova: 0.35, lobos: n, ampLobo: v === 'pimentao' ? 0.1 : 0.14, pontaBase: v === 'lanterna' ? 0.15 : 0, cor: brilho, s, m: 32, ruido: k.tem('enrugado') ? 0.06 : 0 }), 'brilhante', true));
    out.push(parte(caule([V(0, H * 0.82, 0), V(R * 0.05, H * 1.0, 0), V(R * 0.2, H * 1.12, 0)], R * 0.14, R * 0.09, () => c3, 8), 'acetinado'));
    out.push(parte(tf(elipsoide(R * 0.28, R * 0.06, R * 0.28, () => c3, 4, 12), [0, H * 0.86, 0]), 'acetinado'));
    return out;
  }
  // pimentas alongadas deitadas ao longo de X
  const L = k.T, R = (L * k.L) / 2;
  const curva = v === 'chili' || v === 'seco' ? 0.12 : v === 'anaheim' ? 0.08 : 0.03;
  const romba = v === 'jalapeno' ? 0.35 : v === 'coracao' ? 0.5 : 0.85;
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 18, cor: brilho,
    perfil: (t) => {
      const u = 2 * t - 1;
      let r = R * Math.sqrt(suave(0, 0.08, t)) * (v === 'coracao' ? Math.sin(PI * (0.35 + 0.65 * t)) ** 0.7 : (1 - t * romba) ** 0.8) + R * 0.03;
      r *= 1 + (k.tem('enrugado') ? 0.08 * fbm(t * 12, 0, 0, s) : 0);
      return { ry: r * (v === 'coracao' ? 0.7 : 1), rz: r, cy: R + curva * L * (1 - u * u) * 0 + curva * L * u * u };
    },
    mod: (t, a) => 1 + (k.tem('enrugado') ? 0.09 * fbm(t * 14, Math.cos(a) * 2, Math.sin(a) * 2, s) : 0.02 * Math.cos(a * 3)),
  }), k.tem('enrugado') ? 'acetinado' : 'brilhante', true));
  // cálice e cabo na ponta -X
  const yb = R + curva * L;
  out.push(parte(tf(elipsoide(R * 0.25, R * 0.75, R * 0.75, () => c3, 4, 12), [-L / 2 + R * 0.12, yb, 0]), 'acetinado'));
  out.push(parte(caule([V(-L / 2, yb, 0), V(-L / 2 - L * 0.06, yb + R * 0.3, 0), V(-L / 2 - L * 0.1, yb + R * 0.9, 0)], R * 0.18, R * 0.13, () => c3, 6), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* alga (fios e tiras; folhas retangulares ficam em 'placa')            */
/* ------------------------------------------------------------------ */

export const gAlga: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T;
  const n = k.v.n ?? 10;
  const larg = L * k.L;
  for (let i = 0; i < n; i++) {
    const z0 = k.r.f(-L * 0.2, L * 0.2);
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 6; j++) pts.push(V(lerp(-L / 2, L / 2, j / 6), larg * 0.6 + i * larg * 0.15 + Math.abs(Math.sin(j * 1.7 + i)) * larg * 0.4, z0 + Math.sin(j * 1.3 + i * 2) * L * 0.06));
    out.push(parte(tubo(pts, { raio: larg / 2, achata: k.v.v === 'tiras' ? 4 : 1, cima: V(0, 1, 0), m: 6, n: 24, cor: (x, y, z) => mix(c1, c2, suave(0.2, 0.8, fbm(x * 60, y * 60, z * 60, s)) * 0.5) }), k.ac, true));
  }
  return out;
};

export { caminhoEsfera };
