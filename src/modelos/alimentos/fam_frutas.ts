// Famílias de frutas: cítricos, frutas de caroço, bagas e tropicais.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, sepalas, contornos, grao, type Gerador } from './pecas';
import { fruto, cabinho } from './fam_vegetais';

const tomF = (c: RGB, amp: number, f: number, s: number): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));

/** Gira uma geometria construída em pé para deitar com o topo em +X. */
function deitar(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.rotateZ(-PI / 2);
  return g;
}

/* ------------------------------------------------------------------ */
/* cítricos                                                            */
/* ------------------------------------------------------------------ */

export const gCitrico: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const poros = 1 / Math.max(0.004, k.T * 0.02);
  const cor: CorFn = (x, y, z) => {
    const p = 1 - suave(0.18, 0.35, celula(x * poros, y * poros, z * poros, s));
    const c = mix(c1, c2, suave(0.3, 0.9, fbm(x * 18, y * 18, z * 18, s)) * 0.35);
    return mul(c, 1 - p * 0.16 + 0.04 * fbm(x * 70, y * 70, z * 70, s));
  };
  const modPoro = (t: number, a: number) => 1 + 0.012 * ruido(Math.cos(a) * 30, t * 30, Math.sin(a) * 30, s);
  if (v === 'limao' || v === 'oval') {
    const L = k.T, R = (L * k.L) / 2;
    const bico = v === 'limao' ? 0.12 : 0.03;
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 26, m: 28, cor, mod: modPoro,
      perfil: (t) => {
        const u = 2 * t - 1;
        let r = R * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.1));
        r *= 1 - bico * 2.2 * suave(0.75, 1, Math.abs(u));
        const bc = bico * R * 3 * suave(0.82, 1, Math.abs(u)) * 0;
        return { ry: r + bc, rz: r + bc, cy: R };
      },
    }), 'acetinado', true));
    // bicos nas pontas
    out.push(parte(tf(elipsoide(R * 0.16, R * 0.12, R * 0.12, cor, 4, 10), [L / 2 - R * 0.06, R, 0]), 'acetinado'));
    out.push(parte(tf(elipsoide(R * 0.08, R * 0.1, R * 0.1, () => mul(c3, 0.8), 4, 8), [-L / 2 + R * 0.02, R, 0]), 'fosco'));
    return out;
  }
  const R = k.T / 2, H = k.T * k.A;
  if (v === 'givre') {
    // casca de limão oca com cúpula de sorbet e tampa
    out.push(parte(fruto({ R, H: H * 0.6, cor, s, m: 28 }), 'acetinado', true));
    out.push(parte(tf(fruto({ R: R * 0.96, H: H * 0.5, cor: tomF(ci, 0.08, 90, s), ruido: 0.05, s }), [0, H * 0.32, 0]), 'fosco', true));
    const tampa = fruto({ R: R * 0.9, H: H * 0.35, cor, s: s + 1 });
    tf(tampa, [R * 0.3, H * 0.62, 0], [0, 0, -0.4]);
    out.push(parte(tampa, 'acetinado'));
    return out;
  }
  out.push(parte(fruto({ R, H, covaTopo: v === 'mexerica' ? 0.08 : 0.03, covaBase: 0.03, largCova: 0.22, cor, s, m: 32, n: 24, l: k.L, lobos: v === 'mexerica' ? 10 : 0, ampLobo: 0.015 }), 'acetinado', true));
  out.push(parte(tf(elipsoide(R * 0.07, R * 0.04, R * 0.07, () => mul(c3, 0.8), 4, 8), [0, H * (v === 'mexerica' ? 0.92 : 0.97), 0]), 'fosco'));
  if (k.tem('folha')) out.push(parte(tf(folha(R * 0.9, R * 0.4, c3, mul(c3, 1.3), { curva: 0.1 }), [0, H * 0.98, 0], [0, 0.4, 0.3]), 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* frutas de caroço                                                    */
/* ------------------------------------------------------------------ */

export const gCaroco: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'azeitona' || v === 'deitada') {
    const L = k.T, R = (L * k.L) / 2;
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 200, y * 200, z * 200, s)), c2, suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.4);
    out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 18, m: 18, cor, perfil: (t) => { const r = R * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); return { ry: r, rz: r, cy: R }; } }), 'brilhante', true));
    if (k.tem('cabo')) out.push(parte(caule([V(-L / 2, R, 0), V(-L / 2 - L * 0.4, R * 1.4, 0)], R * 0.08, R * 0.06, () => c3, 5), 'fosco'));
    return out;
  }
  const R = k.T / 2, H = k.T * k.A;
  const blush = (x: number, y: number, z: number) => suave(-0.2, 0.7, x / R + fbm(x * 30, y * 30, z * 30, s) * 0.6);
  let cor: CorFn;
  let ac = k.ac;
  if (v === 'pessego') {
    cor = (x, y, z) => mul(mix(c1, c2, blush(x, y, z)), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s));
    ac = 'fosco';
  } else if (v === 'ameixa') {
    cor = (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s)), c2, suave(0.2, 0.8, fbm(x * 120, y * 120, z * 120, s + 3)) * 0.35);
  } else {
    cor = (x, y, z) => mul(mix(c1, c2, blush(x, y, z) * 0.7), 1 + 0.04 * fbm(x * 60, y * 60, z * 60, s));
  }
  const sulco = v === 'pessego' || v === 'nectarina' || v === 'ameixa' || v === 'cereja' ? 0.05 : 0;
  out.push(parte(fruto({ R, H, covaTopo: v === 'cereja' ? 0.1 : 0.06, covaBase: 0.02, largCova: 0.25, sulco, cor, s, m: 30, l: k.L, pontaBase: v === 'tamarillo' ? 0.15 : 0, pescoco: v === 'tamarillo' ? 0.1 : 0, finoPescoco: 0.6 }), ac, true));
  if (v === 'cereja') {
    out.push(parte(caule([V(0, H * 0.85, 0), V(R * 0.2, H * 1.6, 0), V(R * 0.9, H * 2.4, 0)], R * 0.06, R * 0.05, () => c3, 6), 'fosco'));
  } else {
    out.push(parte(cabinho(0, H * 0.94, 0, H * (v === 'tamarillo' ? 0.4 : 0.12), R * 0.05, c3, 0.2), 'fosco'));
    if (k.tem('folha')) out.push(parte(tf(folha(R * 1.1, R * 0.4, rgb2(0.25, 0.45, 0.15), rgb2(0.35, 0.6, 0.2), { contorno: contornos.lanca, curva: 0.1 }), [0, H * 1.0, 0], [0, 0.8, 0.25]), 'acetinado'));
  }
  return out;
};
function rgb2(r: number, g: number, b: number): RGB {
  return [r, g, b];
}

/* ------------------------------------------------------------------ */
/* bagas                                                               */
/* ------------------------------------------------------------------ */

export const gBaga: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  if (v === 'morango') {
    const cor: CorFn = (x, y, z) => {
      const sem = 1 - suave(0.12, 0.2, celula(x * 260, y * 260, z * 260, s));
      return mix(mul(mix(c1, ci, suave(H * 0.85, H, y) * 0.6), 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s)), c2, sem);
    };
    // cone arredondado com a ponta para baixo
    out.push(parte(torno({
      caminho: (u) => {
        const th = u * PI;
        let r = R * Math.sin(th) * (0.4 + 0.6 * u ** 0.7);
        const h = (H / 2) * (1 - Math.cos(th)) ** 1;
        return [r, h - (u > 0.9 ? (u - 0.9) * H * 0.4 : 0)];
      },
      n: 32, m: 40, cor, mod: (t, a) => 1 + 0.02 * ruido(Math.cos(a) * 5, t * 8, Math.sin(a) * 5, s),
    }), 'brilhante', true));
    const sp = sepalas(7, R * 0.75, R * 0.25, c3, V(0, H * 0.94, 0), -0.25, k.r);
    for (const g of sp) out.push(parte(g, 'acetinado'));
    out.push(parte(cabinho(0, H * 0.95, 0, H * 0.25, R * 0.07, c3, 0.2), 'acetinado'));
    return out;
  }
  if (v === 'framboesa' || v === 'amora') {
    // corpo + drupéolas
    const nd = v === 'framboesa' ? 60 : 50;
    const Hh = v === 'amora' ? H * 1.3 : H;
    out.push(parte(fruto({ R: R * 0.82, H: Hh * 0.9, cor: () => mul(c1, 0.7), s, n: 10, m: 14, covaBase: v === 'framboesa' ? 0.25 : 0 }), k.ac, true));
    const ouro = PI * (3 - Math.sqrt(5));
    const rd = R * (v === 'framboesa' ? 0.26 : 0.27);
    const corD: CorFn = (x, y, z) => mix(c1, c2, suave(0.0, 0.5, y - 0) * 0 + 0.3 * suave(0, 1, fbm(x * 300, y * 300, z * 300, s)));
    for (let i = 0; i < nd; i++) {
      const f = (i + 0.5) / nd;
      const th = Math.acos(1 - 2 * f * (v === 'framboesa' ? 0.88 : 1));
      const ang = i * ouro;
      const n = V(Math.sin(th) * Math.cos(ang), Math.cos(th), Math.sin(th) * Math.sin(ang));
      const g = grao(rd, rd, rd, corD, 4, 7);
      g.translate(n.x * R * 0.85, Hh / 2 + n.y * Hh * 0.45, n.z * R * 0.85);
      out.push(parte(g, 'brilhante', true));
    }
    out.push(parte(tf(elipsoide(R * 0.3, R * 0.06, R * 0.3, () => c3, 3, 10), [0, Hh * 0.92, 0]), 'fosco'));
    return out;
  }
  if (v === 'physalis' || v === 'physalis_caramel') {
    const cor = tomF(c1, 0.05, 60, s);
    out.push(parte(fruto({ R, H, cor, s }), 'brilhante', true));
    const nh = 5;
    for (let i = 0; i < nh; i++) {
      const ang = (i / nh) * TAU;
      const pet = folha(R * 2.6, R * 1.5, c2, mul(c2, 0.8), { contorno: contornos.gota, concha: 0.6, curva: v === 'physalis' ? -1.1 : 0.2, esp: R * 0.02, n: 12, m: 8, s: s + i });
      if (v === 'physalis') tf(pet, [0, H * 1.25, 0], [0, -ang, -0.3]);
      else tf(pet, [0, H * 0.7, 0], [0, -ang, 0.9]);
      out.push(parte(pet, 'fosco'));
    }
    return out;
  }
  // blueberry e bagas lisas
  const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s)), c2, suave(0.0, 0.8, fbm(x * 300, y * 300, z * 300, s + 1)) * 0.5);
  out.push(parte(fruto({ R, H, covaTopo: 0.12, largCova: 0.25, cor, s, m: 20, n: 16 }), 'fosco', true));
  const coroa = torno({ caminho: [[0, 0], [R * 0.25, 0], [R * 0.3, R * 0.12], [R * 0.2, R * 0.08], [0, R * 0.02]], n: 6, m: 10, cor: () => mul(c1, 0.6), mod: (t, a) => 1 + 0.25 * Math.cos(a * 5) });
  coroa.translate(0, H * 0.88, 0);
  out.push(parte(coroa, 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* tropicais                                                           */
/* ------------------------------------------------------------------ */

function coroaFolhas(n: number, L: number, cor: RGB, base: THREE.Vector3, r: { f: (a: number, b: number) => number }, abre = 0.35): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const ouro = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const Lf = L * lerp(1, 0.45, f) * r.f(0.85, 1.1);
    const g = folha(Lf, Lf * 0.13, mix(cor, rgb2(0.35, 0.4, 0.3), r.f(0, 0.3)), mul(cor, 1.25), { contorno: contornos.lanca, concha: 0.5, curva: -0.4, esp: Lf * 0.012, n: 10, m: 6 });
    tf(g, [base.x, base.y, base.z], [0, -i * ouro, PI / 2 - lerp(abre + 0.6, 0.15, f)]);
    out.push(g);
  }
  return out;
}

export const gTropical: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  switch (v) {
    case 'abacaxi': {
      // em pé construído e depois deitado: comprimento em X é o fruto mais a coroa
      const Ht = k.T; // comprimento total
      const Hc = Ht * 0.58, Rc = Ht * (k.L ?? 0.22) * 0.5 / 0.5 * 0.5;
      const ns = 8;
      const esc = (y: number, a: number) => {
        const u = (a / TAU) * ns + (y / Hc) * 6, w = (a / TAU) * ns - (y / Hc) * 6;
        const fu = u - Math.floor(u), fw = w - Math.floor(w);
        return Math.min(Math.abs(fu - 0.5), Math.abs(fw - 0.5)) * 2; // 0 na borda, 1 no centro
      };
      const cor: CorFn = (x, y, z, t, a) => {
        const e = esc(y, a);
        const c = mix(c2, c1, suave(0.05, 0.5, e));
        const espinho = suave(0.85, 1, e);
        return mul(mix(c, mul(c2, 0.6), espinho), 1 + 0.06 * fbm(x * 80, y * 80, z * 80, s));
      };
      const corpoA = fruto({ R: Rc, H: Hc, cor, s, m: 40, n: 30, covaTopo: 0.02 });
      // relevo das escamas
      const pa = corpoA.getAttribute('position');
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        const a = (Math.atan2(x, z) + TAU) % TAU;
        const e = esc(y, a);
        const k2 = 1 + 0.045 * e * Math.sin(PI * clamp(y / Hc));
        pa.setXYZ(i, x * k2, y, z * k2);
      }
      corpoA.computeVertexNormals();
      out.push(parte(deitar(corpoA), 'fosco', true));
      for (const g of coroaFolhas(k.v.n ?? 26, Ht * 0.42, c3, V(0, Hc * 0.96, 0), k.r)) out.push(parte(deitar(g), 'acetinado'));
      return out;
    }
    case 'manga': {
      // oval achatada deitada de lado, com bico
      const L = k.T, W = L * k.L, Hm = L * k.A;
      const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(-0.3, 0.6, x / L * 2 + y / Hm + fbm(x * 15, y * 15, z * 15, s) * 0.6)), 1 + 0.04 * fbm(x * 70, y * 70, z * 70, s));
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 26, m: 26, cor,
        perfil: (t) => {
          const u = 2 * t - 1;
          const r = Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.2)) * (1 + 0.12 * u);
          return { ry: (Hm / 2) * r, rz: (W / 2) * r, cy: Hm / 2, cz: W * 0.08 * u * u };
        },
      }), 'acetinado', true));
      out.push(parte(caule([V(L / 2 - L * 0.02, Hm / 2, 0), V(L / 2 + L * 0.04, Hm * 0.55, 0)], L * 0.015, L * 0.01, () => c3, 5), 'fosco'));
      return out;
    }
    case 'papaia': {
      const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.1, 0.9, (y / (k.T)) + fbm(x * 12, y * 12, z * 12, s) * 0.3)), 1 + 0.04 * fbm(x * 60, y * 60, z * 60, s));
      const Rp = (k.T * k.L) / 2;
      const g = fruto({ R: Rp, H: k.T, pescoco: 0.35, finoPescoco: 0.55, cor, s, costelas: 5, ampCostela: 0.04, m: 30 });
      out.push(parte(deitar(g), 'acetinado', true));
      out.push(parte(deitar(cabinho(0, k.T * 1.15, 0, k.T * 0.04, Rp * 0.12, c3, 0)), 'fosco'));
      return out;
    }
    case 'carambola': {
      const L = k.T, Rr = (L * k.L) / 2;
      const cor: CorFn = (x, y, z, t, a) => mix(mul(c1, 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s)), c2, Math.abs(Math.cos((5 * a) / 2)) ** 30 * 0.6);
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 26, m: 40, cor,
        perfil: (t) => { const r = Rr * Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.2)); return { ry: r, rz: r, cy: Rr }; },
        mod: (t, a) => 0.45 + 0.55 * Math.abs(Math.cos((5 * a) / 2)) ** 1.5,
      }), 'brilhante', true));
      out.push(parte(caule([V(-L / 2, Rr, 0), V(-L / 2 - L * 0.04, Rr, 0)], Rr * 0.08, Rr * 0.06, () => c3, 5), 'fosco'));
      return out;
    }
    case 'kiwi': case 'sapotilha': case 'feijoa': case 'tamarillo_ovo': {
      const L = k.T, Rr = (L * k.L) / 2;
      const peludo = v === 'kiwi';
      const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.12 * fbm(x * 150, y * 150, z * 150, s)), c2, peludo ? suave(0.2, 0.7, ruido(x * 900, y * 900, z * 900, s)) * 0.5 : suave(0.4, 0.9, fbm(x * 40, y * 40, z * 40, s)) * 0.4);
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 22, m: 24, cor,
        perfil: (t) => { const u = 2 * t - 1; const r = Rr * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.3)) * (1 - 0.04 * u); return { ry: r * (k.A / k.L), rz: r, cy: Rr * (k.A / k.L) }; },
      }), 'fosco', true));
      out.push(parte(tf(elipsoide(Rr * 0.08, Rr * 0.12, Rr * 0.12, () => mul(c2, 0.7), 3, 8), [-L / 2, Rr * (k.A / k.L), 0]), 'fosco'));
      if (v === 'feijoa') for (const g of sepalas(4, Rr * 0.4, Rr * 0.12, c2, V(L / 2, Rr * (k.A / k.L), 0), 0, k.r)) out.push(parte(g.rotateZ(0), 'fosco'));
      return out;
    }
    case 'maracuja': case 'granadilla': case 'goiaba': case 'liso': {
      const rug = v === 'maracuja' ? 0.025 : 0;
      const cor: CorFn = (x, y, z) => {
        let c = mix(mul(c1, 1 + 0.06 * fbm(x * 50, y * 50, z * 50, s)), c2, suave(0.2, 0.8, fbm(x * 25, y * 25, z * 25, s + 1)) * 0.4);
        if (v === 'maracuja' || v === 'granadilla') c = mix(c, mul(c1, 1.3), (1 - suave(0.05, 0.12, celula(x * 300, y * 300, z * 300, s))) * 0.5);
        return c;
      };
      out.push(parte(fruto({ R, H, covaTopo: 0.03, cor, s, ruido: rug, fRuido: 4 / R, l: k.L, m: 28 }), v === 'goiaba' ? 'acetinado' : 'brilhante', true));
      out.push(parte(cabinho(0, H * 0.97, 0, H * 0.18, R * 0.06, c3, 0.3), 'fosco'));
      return out;
    }
    case 'roma': case 'mangostao': {
      const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.05 * fbm(x * 40, y * 40, z * 40, s)), c2, suave(0.0, 0.8, fbm(x * 15, y * 15, z * 15, s + 2)) * 0.4);
      out.push(parte(fruto({ R, H, covaBase: 0.03, lobos: v === 'roma' ? 6 : 0, ampLobo: 0.03, cor, s, m: 30 }), v === 'roma' ? 'brilhante' : 'acetinado', true));
      if (v === 'roma') {
        const coroa = torno({ caminho: [[0, 0], [R * 0.25, 0], [R * 0.2, R * 0.25], [R * 0.32, R * 0.45], [R * 0.22, R * 0.42], [0, R * 0.2]], n: 10, m: 18, cor: () => mul(c1, 0.8), mod: (t, a) => 1 + 0.3 * Math.cos(a * 6) * suave(0.4, 0.7, t) });
        coroa.translate(0, H * 0.92, 0);
        out.push(parte(coroa, 'acetinado'));
      } else {
        for (const g of sepalas(4, R * 0.5, R * 0.42, c3, V(0, H * 0.93, 0), -0.3, k.r)) out.push(parte(g, 'fosco'));
        out.push(parte(cabinho(0, H * 0.95, 0, H * 0.18, R * 0.08, mul(c3, 0.7), 0.1), 'fosco'));
      }
      return out;
    }
    case 'coco': {
      const cor: CorFn = (x, y, z, t, a) => {
        const fibra = Math.abs(Math.sin(a * 40 + fbm(x * 30, y * 30, z * 30, s) * 4)) ** 3;
        let c = mix(c1, c2, fibra * 0.5);
        const ang3 = [0, TAU / 3, (2 * TAU) / 3];
        for (const aa of ang3) {
          const ex = Math.sin(aa) * R * 0.22, ez = Math.cos(aa) * R * 0.22;
          const d = Math.hypot(x - ex, z - ez);
          if (y > H * 0.85) c = mix(c, mul(c2, 0.35), 1 - suave(R * 0.06, R * 0.1, d));
        }
        return mul(c, 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
      };
      out.push(parte(fruto({ R, H, pescoco: 0.08, finoPescoco: 0.6, cor, s, ruido: 0.03, fRuido: 5 / R, costelas: 3, ampCostela: 0.04, m: 32 }), 'fosco', true));
      return out;
    }
    case 'figo': {
      const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.0, 1, y / H) * 0.6 + suave(0.3, 0.9, fbm(x * 40, y * 40, z * 40, s)) * 0.2), 1 + 0.03 * Math.sin(Math.atan2(z, x) * 14));
      out.push(parte(fruto({ R, H, pescoco: 0.38, finoPescoco: 0.25, covaBase: 0.04, cor, s, m: 26 }), 'acetinado', true));
      out.push(parte(cabinho(0, H * 1.18, 0, H * 0.12, R * 0.08, c3, 0.2), 'fosco'));
      return out;
    }
    case 'lichia': case 'rambutan': case 'durian': case 'kiwano': case 'figo_india': case 'pitaia': {
      const freq = v === 'lichia' ? 6 / R * 1.1 : 5 / R;
      const cor: CorFn = (x, y, z) => {
        const c = celula(x * freq, y * freq, z * freq, s);
        return mul(mix(mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s)), c2, suave(0.6, 0.95, c) * (v === 'pitaia' ? 0 : 0.6)), 1);
      };
      const corpoG = fruto({ R, H, cor, s, m: 30, n: 22, l: k.L, ruido: v === 'lichia' ? 0.04 : 0, fRuido: freq * 0.9 });
      out.push(parte(v === 'kiwano' || v === 'figo_india' || v === 'pitaia' ? deitarSe(corpoG, false) : corpoG, v === 'pitaia' || v === 'kiwano' ? 'brilhante' : 'fosco', true));
      // espinhos, pelos, chifres ou escamas
      const ne = v === 'rambutan' ? 64 : v === 'durian' ? 70 : v === 'kiwano' ? 30 : v === 'pitaia' ? 16 : v === 'figo_india' ? 28 : 0;
      const ouro = PI * (3 - Math.sqrt(5));
      for (let i = 0; i < ne; i++) {
        const f = (i + 0.5) / ne;
        const th = Math.acos(1 - 2 * f);
        const ang = i * ouro;
        const n = V(Math.sin(th) * Math.cos(ang) * k.L, Math.cos(th), Math.sin(th) * Math.sin(ang));
        const pBase = V(n.x * R, H / 2 + n.y * (H / 2), n.z * R);
        n.normalize();
        let g: THREE.BufferGeometry;
        if (v === 'rambutan') {
          const l = R * 0.5;
          const pTop = pBase.clone().addScaledVector(n, l).add(V(0, l * 0.3, 0));
          g = caule([pBase, pBase.clone().addScaledVector(n, l * 0.6), pTop], R * 0.05, R * 0.015, () => mix(c1, c2, 0.5), 3);
        } else if (v === 'pitaia') {
          g = folha(R * 0.5, R * 0.35, c2, mul(c2, 1.2), { contorno: contornos.gota, esp: R * 0.03, n: 6, m: 6, curva: 0.4 });
          const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), V(n.x * 0.3, 1, n.z * 0.3).normalize().lerp(n, 0.4).normalize());
          g.applyQuaternion(q);
          g.translate(pBase.x, pBase.y, pBase.z);
        } else if (v === 'figo_india') {
          g = caule([pBase, pBase.clone().addScaledVector(n, R * 0.12)], R * 0.012, R * 0.004, () => rgb2(0.9, 0.85, 0.6), 3);
        } else {
          const l = v === 'durian' ? R * 0.22 : R * 0.3;
          const cone = torno({ caminho: [[0, 0], [l * 0.5, 0.0], [0, l]], n: 4, m: 6, cor: () => mix(c1, c2, 0.4) });
          const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
          cone.applyQuaternion(q);
          cone.translate(pBase.x - n.x * l * 0.1, pBase.y - n.y * l * 0.1, pBase.z - n.z * l * 0.1);
          g = cone;
        }
        out.push(parte(g, v === 'pitaia' ? 'brilhante' : 'fosco'));
      }
      if (v === 'lichia' || v === 'rambutan') out.push(parte(cabinho(0, H * 0.96, 0, H * 0.25, R * 0.06, c3, 0.2), 'fosco'));
      return out;
    }
    case 'abacate': {
      const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.12 * fbm(x * 150, y * 150, z * 150, s)), c2, suave(0.3, 0.8, fbm(x * 60, y * 60, z * 60, s)) * 0.4);
      const Rp = (k.T * k.L) / 2;
      const g = fruto({ R: Rp, H: k.T * 0.92, pescoco: 0.4, finoPescoco: 0.55, cor, s, ruido: 0.025, fRuido: 8 / Rp, m: 28 });
      out.push(parte(deitar(g), 'acetinado', true));
      out.push(parte(deitar(cabinho(0, k.T * 1.0, 0, k.T * 0.04, Rp * 0.1, mul(c2, 0.6), 0)), 'fosco'));
      return out;
    }
    default: {
      // corpo alongado deitado (babaco, curuba, pepino-melão, tâmara)
      const L = k.T, Rr = (L * k.L) / 2;
      const faces = v === 'babaco' ? 5 : 0;
      const cor: CorFn = (x, y, z, t, a) => {
        let c = mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
        if (k.tem('listras')) c = mix(c, c2, suave(0.3, 0.7, Math.sin(a * 6 + fbm(x * 25, y * 25, z * 25, s) * 2)) * 0.7);
        if (k.tem('enrugado')) c = mix(c, c2, suave(0.3, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.4);
        return c;
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 26, m: faces ? 25 : 22, cor,
        perfil: (t) => { const u = 2 * t - 1; const r = Rr * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** (v === 'babaco' || v === 'curuba' ? 3 : 2.2))); return { ry: r, rz: r, cy: Rr }; },
        mod: (t, a) => (faces ? 1 + 0.12 * (Math.abs(Math.cos((faces * a) / 2)) - 0.6) : 1) * (k.tem('enrugado') ? 1 + 0.05 * fbm(t * 12, Math.cos(a) * 2, Math.sin(a) * 2, s) : 1),
      }), k.tem('enrugado') ? 'brilhante' : 'acetinado', true));
      out.push(parte(caule([V(-L / 2, Rr, 0), V(-L / 2 - L * 0.05, Rr * 1.1, 0)], Rr * 0.1, Rr * 0.07, () => c3, 5), 'fosco'));
      return out;
    }
  }
};

function deitarSe(g: THREE.BufferGeometry, sim: boolean): THREE.BufferGeometry {
  return sim ? deitar(g) : g;
}

export { deitar };
