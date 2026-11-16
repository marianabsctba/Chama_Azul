// Famílias de padaria e despensa: massas de pão, pães, pães chatos, queijos,
// barras, placas finas, montes de pó ou grãos, castanhas e massas alimentícias.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, caixa, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, contornos, grao, disco, type Ctx, type Gerador } from './pecas';
import { fruto } from './fam_vegetais';

/** Crosta de pão: base clara, topo mais dourado, poros. */
function corCrosta(k: Ctx, H: number): CorFn {
  const { c1, c2, s } = k;
  return (x, y, z) => {
    const c = mix(c2, c1, suave(H * 0.15, H * 0.75, y) + 0.25 * fbm(x * 30, y * 30, z * 30, s));
    const poro = 1 - suave(0.08, 0.16, celula(x * 300, y * 300, z * 300, s));
    return mul(c, 1 + 0.06 * fbm(x * 90, y * 90, z * 90, s) - poro * 0.1);
  };
}

function polvilhar(c: RGB, poeira: RGB, x: number, y: number, z: number, s: number, q = 0.5): RGB {
  return mix(c, poeira, suave(1 - q * 0.5, 1, ruido(x * 500, y * 500, z * 500, s) * 0.5 + 0.5) * 0.9);
}

/* ------------------------------------------------------------------ */
/* massa em bola                                                        */
/* ------------------------------------------------------------------ */

export const gMassaBola: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.04 * fbm(x * 50, y * 50, z * 50, s));
    if (k.tem('farinha')) c = polvilhar(c, c2, x, y, z, s, 0.4);
    if (k.tem('x')) {
      const d = Math.min(Math.abs(x - z), Math.abs(x + z));
      c = mix(c, mul(c1, 0.8), (1 - suave(0, R * 0.04, d)) * suave(H * 0.6, H * 0.9, y));
    }
    return c;
  };
  const g = torno({
    caminho: (u) => {
      const th = u * PI;
      const sn = Math.sin(th);
      // base baixa e arredondada, depois uma cúpula: bola de massa assentada, sem parede reta de queijo
      if (u < 0.5) return [R * sn ** 0.5, H * 0.15 * (1 - Math.cos(th))];
      return [R * sn ** 0.9, H * 0.15 + H * 0.85 * -Math.cos(th)];
    },
    n: 26, m: 32, cor,
    desloc: k.tem('x') ? (p) => { const d = Math.min(Math.abs(p.x - p.z), Math.abs(p.x + p.z)); p.y -= (1 - suave(0, R * 0.08, d)) * H * 0.08 * suave(H * 0.5, H, p.y); } : undefined,
  });
  return [parte(g, k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* pães                                                                 */
/* ------------------------------------------------------------------ */

export const gPao: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const crosta = corCrosta(k, H);
  switch (v) {
    case 'forma': {
      const hb = H * 0.62;
      const cor: CorFn = (x, y, z) => {
        let c = crosta(x, y, z, 0, 0);
        if (k.tem('fios')) c = mix(c, c3, (1 - suave(0.1, 0.2, celula(x * 120, y * 120, z * 120, s))) * 0.6);
        return c;
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: 32, exp: 5, tampa: true, cor, corTampa: crosta,
        perfil: (t) => { const ch = 1 - 0.08 * (1 - suave(0, 0.05, Math.min(t, 1 - t))); return { ry: (hb / 2) * ch, rz: (W / 2) * ch, cy: hb / 2 }; },
        desloc: (p, t) => {
          if (p.y > hb * 0.7) {
            const zz = clamp(Math.abs(p.z) / (W / 2));
            const cup = Math.sqrt(Math.max(0, 1 - zz * zz)) * Math.sqrt(suave(0, 0.1, Math.min(t, 1 - t)));
            p.y += (H - hb) * cup * suave(hb * 0.7, hb, p.y);
            p.z *= 1 + 0.06 * cup;
          }
        },
      }), k.ac, true));
      return out;
    }
    case 'filao': {
      const cor: CorFn = (x, y, z) => {
        const corte = Math.abs(Math.sin((x - z * 0.9) * (k.v.n ?? 5) * PI / L)) ** 30;
        return mix(crosta(x, y, z, 0, 0), mul(c2, 1.05), corte * suave(H * 0.6, H * 0.9, y) * 0.9);
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 72, m: 36, exp: 2.2, cor,
        perfil: (t) => { const e = Math.sqrt(suave(0, 0.1, t)) * Math.sqrt(suave(1, 0.9, t)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
        desloc: (p) => {
          if (p.y < H * 0.2) p.y = H * 0.2 - (H * 0.2 - p.y) * 0.4;
          const corte = Math.abs(Math.sin((p.x - p.z * 0.9) * (k.v.n ?? 5) * PI / L)) ** 30;
          p.y -= corte * H * 0.06 * suave(H * 0.6, H, p.y);
        },
      }), k.ac, true));
      return out;
    }
    case 'tranca': {
      const N = 40;
      for (let i = 0; i < 3; i++) {
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= N; j++) {
          const t = j / N;
          const ph = t * TAU * 2.5 + (i * TAU) / 3;
          const env = Math.sin(PI * (0.04 + 0.92 * t)) ** 0.4;
          pts.push(V(lerp(-L / 2, L / 2, t) * 0.92, H * 0.38 * env + H * 0.14 * Math.cos(ph * 2) * env, W * 0.26 * Math.sin(ph) * env));
        }
        out.push(parte(tubo(pts, { raio: (t) => H * 0.3 * Math.sin(PI * (0.06 + 0.88 * t)) ** 0.5, m: 14, n: 80, cor: crosta }), 'brilhante', true));
      }
      return out;
    }
    case 'brioche': {
      const R = L / 2;
      const nf = k.v.n ?? 12;
      const cor = crosta;
      out.push(parte(torno({ caminho: [[0, 0], [R * 0.6, 0], [R * 0.95, H * 0.45], [R * 0.85, H * 0.55], [R * 0.5, H * 0.6], [0, H * 0.62]], n: 22, m: 48, cor, mod: (t, a) => 1 + 0.07 * Math.abs(Math.cos(a * nf / 2)) * suave(0.05, 0.4, t) - 0.03 }), 'brilhante', true));
      out.push(parte(tf(fruto({ R: R * 0.32, H: H * 0.42, cor: (x, y, z) => mul(c1, 0.9 + 0.08 * fbm(x * 90, y * 90, z * 90, s)), s }), [0, H * 0.55, 0]), 'brilhante', true));
      return out;
    }
    case 'redondo': case 'bicarbonato': {
      const R = L / 2;
      const prof = v === 'bicarbonato' ? 0.18 : 0.08;
      const cor: CorFn = (x, y, z) => {
        const d = k.tem('cruz') ? Math.min(Math.abs(x), Math.abs(z)) : Math.min(Math.abs(x - z), Math.abs(x + z)) * 0.7;
        let c = mix(crosta(x, y, z, 0, 0), mul(c2, 1.05), (1 - suave(0, R * 0.08, d)) * suave(H * 0.45, H * 0.8, y));
        if (k.tem('farinha')) c = polvilhar(c, [0.92, 0.9, 0.85], x, y, z, s, 0.5);
        return c;
      };
      out.push(parte(torno({
        caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.6, (u < 0.5 ? 0.25 : 1) * H * (1 - Math.cos(th)) / 2 + (u < 0.5 ? 0 : 0)]; },
        n: 26, m: 36, cor,
        desloc: (p) => {
          const d = k.tem('cruz') ? Math.min(Math.abs(p.x), Math.abs(p.z)) : Math.min(Math.abs(p.x - p.z), Math.abs(p.x + p.z)) * 0.7;
          p.y -= (1 - suave(0, R * 0.12, d)) * H * prof * suave(H * 0.4, H, p.y);
        },
      }), k.ac, true));
      return out;
    }
    case 'bagel': case 'anel': {
      const Rc = L * 0.3, rs = L * 0.2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 24; i++) pts.push(V(Math.cos((i / 24) * TAU) * Rc, H / 2, Math.sin((i / 24) * TAU) * Rc));
      const cor: CorFn = (x, y, z) => {
        let c = crosta(x, y, z, 0, 0);
        if (k.tem('gergelim')) c = mix(c, [0.92, 0.85, 0.65], 1 - suave(0.06, 0.12, celula(x * 300, y * 300, z * 300, s)));
        return c;
      };
      out.push(parte(tubo(pts, { raio: H / 2, achata: rs / (H / 2), cima: V(0, 1, 0), m: 20, n: 48, fechado: true, cor }), k.ac, true));
      return out;
    }
    case 'kugelhopf': case 'coroa': {
      const R = L / 2;
      const rIn = R * 0.22;
      const nf = k.v.n ?? 14;
      const cor: CorFn = (x, y, z) => {
        let c = crosta(x, y, z, 0, 0);
        if (v === 'coroa') c = mix(c, c3, suave(0.6, 0.9, Math.sin(Math.atan2(z, x) * nf + y * 120)) * suave(H * 0.3, H * 0.6, y) * 0.8);
        if (k.tem('acucar')) c = polvilhar(c, [0.96, 0.96, 0.95], x, y, z, s, 0.7);
        return c;
      };
      const caminho: [number, number][] = v === 'coroa'
        ? [[R * 0.98, 0], [R, H * 0.6], [R * 0.75, H], [R * 0.45, H * 0.85], [rIn * 1.6, H * 0.5], [rIn * 1.5, 0]]
        : [[R * 0.95, 0], [R * 0.95, H * 0.3], [R * 0.8, H * 0.85], [R * 0.6, H], [rIn * 1.15, H * 0.92], [rIn, H * 0.5], [rIn * 1.05, 0]];
      out.push(parte(tornoAnel({ caminho, n: 32, m: 48, cor, mod: (t, a) => 1 + (v === 'coroa' ? 0.1 : 0.06) * Math.abs(Math.cos((a * nf) / 2 + t * (v === 'coroa' ? 3 : 2))) ** (v === 'coroa' ? 3 : 1) - 0.03 }), v === 'coroa' ? 'brilhante' : k.ac, true));
      if (v === 'kugelhopf') for (let i = 0; i < nf; i++) {
        const a = (i / nf) * TAU;
        out.push(parte(tf(elipsoide(R * 0.07, R * 0.035, R * 0.05, () => mul(c3, 1), 4, 8), [Math.cos(a) * R * 0.62, H * 1.0, Math.sin(a) * R * 0.62], [0, -a, 0]), 'acetinado'));
      }
      return out;
    }
    case 'rosquinhas': {
      // três pãezinhos modelados lado a lado: caracol, nó e meia-lua
      const r = H * 0.28;
      const caracol: THREE.Vector3[] = [];
      for (let i = 0; i <= 36; i++) { const a = (i / 36) * TAU * 2; const rr = r * 0.4 + (a / TAU) * r * 1.9; caracol.push(V(-L * 0.33 + Math.cos(a) * rr, r, Math.sin(a) * rr)); }
      out.push(parte(tubo(caracol, { raio: (t) => r * (0.55 + 0.45 * Math.sin(PI * t) ** 0.3), m: 12, n: 80, cor: crosta }), 'brilhante', true));
      const no: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const t = (i / 40) * TAU; no.push(V(Math.sin(t) + 2 * Math.sin(2 * t), 0, Math.cos(t) - 2 * Math.cos(2 * t)).multiplyScalar(r * 0.75).add(V(0, r + Math.sin(3 * (i / 40) * TAU) * r * 0.5, 0))); }
      out.push(parte(tubo(no, { raio: r * 0.75, m: 12, n: 90, cor: crosta }), 'brilhante', true));
      const lua: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) { const a = PI * 0.15 + (i / 12) * PI * 0.7; lua.push(V(L * 0.33 + Math.cos(a) * r * 2.2 - r, r, Math.sin(a) * r * 2.2 - r * 1.4)); }
      out.push(parte(tubo(lua, { raio: (t) => r * (0.3 + 0.8 * Math.sin(PI * t)), m: 14, n: 30, cor: crosta }), 'brilhante', true));
      return out;
    }
    case 'calzone': {
      const cor: CorFn = (x, y, z) => {
        let c = crosta(x, y, z, 0, 0);
        const fenda = Math.min(Math.abs(x - L * 0.12), Math.abs(x + L * 0.12));
        c = mix(c, c3, (1 - suave(0, L * 0.012, fenda)) * suave(H * 0.6, H * 0.9, y) * (Math.abs(z) < W * 0.25 ? 1 : 0));
        return c;
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 32, m: 30, cor,
        perfil: (t) => { const e = Math.sin(PI * t) ** 0.55; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: (H / 2) * e * 0.9, cz: -W * 0.25 * (1 - e) }; },
        mod: (t, a) => 1 + 0.05 * Math.abs(Math.sin(t * 60)) * suave(0.3, 0.9, Math.abs(Math.sin(a))) * (Math.sin(a) > 0 ? 1 : 0.3),
        desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
      }), k.ac, true));
      return out;
    }
    case 'poori': {
      const R = L / 2;
      out.push(parte(fruto({ R, H, cor: (x, y, z) => mul(mix(c1, c2, suave(0.2, 0.9, fbm(x * 60, y * 60, z * 60, s)) * 0.5), 1), s, ruido: 0.03, fRuido: 8 / R }), 'brilhante', true));
      return out;
    }
    case 'bruschetta': {
      const R = L / 2;
      const cor: CorFn = (x, y, z) => {
        if (y > H * 0.85) {
          const p = celula(x * 120, 0, z * 120, s);
          return mix(c3, mix(c2, [0.25, 0.45, 0.15], suave(0.5, 0.6, ruido(x * 200, 0, z * 200, s))), suave(0.3, 0.5, p));
        }
        return mix(ci, c1, suave(0.85, 0.95, Math.hypot(x / R, z / (R * k.L / k.L))));
      };
      out.push(parte(disco(R, H, cor, { n: 22, m: 30, l: k.L * 1.0, borda: 0.4, mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a), Math.sin(a), 0, s) }), k.ac, true));
      return out;
    }
    case 'disco_grosso': {
      const R = L / 2;
      const cor: CorFn = (x, y, z) => {
        let c = crosta(x, y, z, 0, 0);
        if (k.tem('graos')) c = mix(c, c3, 1 - suave(0.08, 0.16, celula(x * 160, y * 160, z * 160, s)));
        return c;
      };
      out.push(parte(disco(R, H, cor, { n: 24, m: 36, borda: 0.35 }), k.ac, true));
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* pães chatos                                                          */
/* ------------------------------------------------------------------ */

export const gPaoChato: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, H = L * k.A;
  const R = L / 2;
  const fp = 1 / Math.max(0.003, L * 0.04);
  const pintas = (c: RGB, x: number, y: number, z: number, q: number): RGB => mix(c, c2, (1 - suave(0.1, 0.3, celula(x * fp, y * fp * 0.3, z * fp, s))) * q);
  if (v === 'retangulo' || v === 'quadrado') {
    const W = L * k.L;
    const cor: CorFn = (x, y, z) => {
      let c = mix(c2, c1, suave(H * 0.3, H, y) * 0.8 + 0.2 * fbm(x * 30, y * 30, z * 30, s));
      if (k.tem('covinhas')) c = mix(c, mul(c1, 1.15), 1 - suave(0.15, 0.3, celula(x * 40, 0, z * 40, s)));
      if (k.tem('alecrim')) c = mix(c, c3, (1 - suave(0.05, 0.1, celula(x * 90, 0, z * 90, s + 4))) * (y > H * 0.7 ? 1 : 0));
      if (k.tem('sal')) c = mix(c, [0.97, 0.97, 0.95], (1 - suave(0.04, 0.07, celula(x * 150, 0, z * 150, s + 7))) * (y > H * 0.7 ? 1 : 0));
      if (k.tem('folhado')) c = mix(c, mul(c1, 0.7), Math.abs(Math.sin(y * 4000)) ** 8 * (y < H * 0.85 ? 1 : 0));
      return pintas(c, x, y, z, k.tem('pintas') ? 0.7 : 0);
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 26, m: 34, exp: 5, tampa: true, cor, corTampa: cor,
      perfil: (t) => { const ch = 1 - 0.1 * (1 - suave(0, 0.05, Math.min(t, 1 - t))); return { ry: (H / 2) * ch, rz: (W / 2) * ch, cy: H / 2 }; },
      desloc: k.tem('covinhas') ? (p) => { if (p.y > H * 0.7) p.y -= H * 0.25 * (1 - suave(0.15, 0.35, celula(p.x * 40, 0, p.z * 40, s))); } : undefined,
    }), k.ac, true));
    return out;
  }
  const borda = v === 'pizza' ? 1.8 : 1;
  const cor: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / R;
    let c = mul(c1, 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s));
    if (v === 'pizza') {
      if (r < 0.86 && y > H * 0.6) {
        c = mix(c3, mul(c3, 0.8), suave(0.3, 0.7, fbm(x * 40, 0, z * 40, s)));
        // coberturas em padrão regular
        const gx = Math.round(x / (R * 0.28)), gz = Math.round(z / (R * 0.28));
        const d = Math.hypot(x - gx * R * 0.28, z - gz * R * 0.28);
        if ((gx + gz) % 2 === 0) c = mix(c, c2, 1 - suave(R * 0.06, R * 0.08, d));
      } else c = mix(mul(c1, 1.1), mul(c1, 0.75), suave(0.3, 0.8, fbm(x * 50, y * 50, z * 50, s)));
    }
    if (k.tem('pintas')) c = pintas(c, x, y, z, 0.8);
    if (k.tem('bolhas')) c = mix(c, mul(c1, 1.1), 1 - suave(0.1, 0.2, celula(x * 90, 0, z * 90, s)));
    if (k.tem('ervas')) c = mix(c, c3, 1 - suave(0.04, 0.09, celula(x * 160, y * 160, z * 160, s)));
    return c;
  };
  const caminho: [number, number][] = v === 'pizza'
    ? [[0, 0], [R * 0.9, 0], [R, H * 0.5], [R * 0.97, H * borda], [R * 0.88, H * borda * 0.9], [R * 0.84, H * 0.75], [0, H * 0.75]]
    : [[0, 0], [R * 0.8, 0], [R, H * 0.5], [R * 0.8, H], [0, H]];
  out.push(parte(torno({
    caminho, n: 30, m: 40, cor,
    mod: (t, a) => 1 + 0.025 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s),
    desloc: (p) => { if (k.tem('curvada')) p.y += H * 2.5 * (Math.hypot(p.x, p.z) / R) ** 3; },
  }), k.ac, true));
  return out;
};

/* ------------------------------------------------------------------ */
/* queijos                                                              */
/* ------------------------------------------------------------------ */

export const gQueijo: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const fh = 1 / Math.max(0.004, L * 0.08);
  const interior: CorFn = (x, y, z) => {
    let c = mul(ci, 1 + 0.04 * fbm(x * 90, y * 90, z * 90, s));
    if (k.tem('furos')) c = mix(c, mul(ci, 0.7), 1 - suave(0.2, 0.28, celula(x * fh, y * fh, z * fh, s)));
    if (k.tem('granulado')) c = mix(c, mul(ci, 1.12), 1 - suave(0.1, 0.2, celula(x * 500, y * 500, z * 500, s)));
    return c;
  };
  const casca: CorFn = (x, y, z) => mix(c1, c2, suave(0.3, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.5);
  if (v === 'cunha') {
    // ponta em -X, casca no fundo (+X) e em cima e embaixo
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 24, m: 32, exp: 7, tampa: true, linear: true,
      cor: (x, y, z, t) => (k.tem('cascatopo') && (y > H * 0.93 || y < H * 0.07) ? casca(x, y, z, t, 0) : interior(x, y, z, t, 0)),
      corTampa: casca,
      perfil: (t) => ({ ry: H / 2, rz: (W / 2) * Math.max(0.02, t), cy: H / 2 }),
    }), k.ac, true));
    return out;
  }
  if (v === 'roda' || v === 'cilindro') {
    const R = L / 2;
    const cor: CorFn = (x, y, z) => casca(x, y, z, 0, 0);
    if (v === 'roda') out.push(parte(torno({ caminho: [[0, 0], [R * 0.9, 0], [R, H * 0.15], [R * 1.02, H * 0.5], [R, H * 0.85], [R * 0.9, H], [0, H]], n: 26, m: 40, cor }), k.ac, true));
    else out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 18, m: 28, tampa: true, cor: (x, y, z) => mix(c1, c2, suave(0.2, 0.9, fbm(x * 80, y * 80, z * 80, s)) * 0.3), corTampa: interior, perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }) }), k.ac, true));
    return out;
  }
  // bloco
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 18, m: 32, exp: 7, tampa: true, cor: k.tem('casca') ? casca : interior, corTampa: interior,
    perfil: (t) => { const ch = 1 - 0.05 * (1 - suave(0, 0.05, Math.min(t, 1 - t))); return { ry: (H / 2) * ch, rz: (W / 2) * ch, cy: H / 2 }; },
    mod: (t, a) => 1 + (k.tem('macio') ? 0.02 * fbm(t * 6, Math.cos(a), Math.sin(a), s) : 0),
  }), k.ac, true));
  return out;
};

/* ------------------------------------------------------------------ */
/* barras (manteiga, chocolate, fermento, tofu)                          */
/* ------------------------------------------------------------------ */

export const gBarra: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const nx = k.v.n ?? 6, nz = Math.max(1, Math.round(nx * k.L));
  const grade = k.v.v === 'chocolate';
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.04 * fbm(x * 80, y * 80, z * 80, s));
    if (grade) {
      const gx = Math.abs(Math.sin(((x + L / 2) / L) * nx * PI)), gz = Math.abs(Math.sin(((z + W / 2) / W) * nz * PI));
      c = mul(c, y > H * 0.7 ? 0.85 + 0.15 * Math.min(1, Math.min(gx, gz) * 3) : 0.95);
    }
    if (k.tem('esfarelado')) c = mix(c, mul(c1, 0.8), 1 - suave(0.1, 0.3, celula(x * 250, y * 250, z * 250, s)));
    if (k.tem('papel')) c = mix(c, c2, suave(-L * 0.05, L * 0.05, x) );
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: grade ? nx * 6 : 16, m: 36, exp: 7, tampa: true, linear: grade, cor, corTampa: k.tem('papel') ? (x, y, z) => (x > 0 ? c2 : ci) : cor,
    perfil: (t) => { const ch = 1 - 0.06 * (1 - suave(0, 0.04, Math.min(t, 1 - t))); return { ry: (H / 2) * ch, rz: (W / 2) * ch, cy: H / 2 }; },
    desloc: grade ? (p) => {
      if (p.y > H * 0.6) {
        const gx = Math.abs(Math.sin(((p.x + L / 2) / L) * nx * PI)), gz = Math.abs(Math.sin(((p.z + W / 2) / W) * nz * PI));
        p.y -= H * 0.3 * (1 - Math.min(1, Math.min(gx, gz) * 2.5)) * suave(H * 0.6, H, p.y);
      }
    } : k.tem('esfarelado') ? (p) => { p.multiplyScalar(1 + 0.02 * ruido(p.x * 300, p.y * 300, p.z * 300, s)); } : undefined,
  }), k.ac, true));
  return out;
};

/* ------------------------------------------------------------------ */
/* placas finas                                                         */
/* ------------------------------------------------------------------ */

export const gPlaca: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = Math.max(0.0008, L * k.A);
  const nf = k.v.n ?? 1;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
    if (k.tem('grade')) c = mul(c, 0.85 + 0.3 * Math.min(Math.abs(Math.sin((x + z) * 600)), Math.abs(Math.sin((x - z) * 600))) ** 0.4);
    if (k.tem('sal')) c = mix(c, [0.92, 0.92, 0.88], suave(0.3, 0.8, fbm(x * 50, y * 50, z * 50, s + 3)) * 0.5);
    if (k.tem('rede')) c = mix(c2, c, suave(0.6, 0.8, celula(x * 160, y * 160, z * 160, s)));
    if (k.tem('favo')) c = mix(c, mul(c1, 0.7), suave(0.75, 0.9, celula(x * 90, y * 90, z * 90, s)));
    if (k.tem('borda')) c = mix(c, c2, suave(W * 0.32, W * 0.42, z));
    if (k.tem('camadas')) c = mix(c, c2, Math.abs(Math.sin(y * 9000)) ** 6 * 0.6);
    if (k.tem('veios')) c = mix(c, c3, (1 - suave(0.0, 0.05, Math.abs(fbm(x * 30, 0, z * 30, s)))) * 0.6);
    if (k.tem('pintas')) c = mix(c, c2, 1 - suave(0.08, 0.2, celula(x * 160, 0, z * 160, s)));
    return c;
  };
  for (let i = 0; i < nf; i++) {
    const rot = nf > 1 ? (i - (nf - 1) / 2) * 0.12 : 0;
    const g = corpo({
      x0: -L / 2, x1: L / 2, n: nf > 1 ? 14 : 28, m: nf > 1 ? 24 : 40, exp: 10, tampa: true, linear: true, cor, corTampa: cor,
      perfil: (t) => {
        let rz = W / 2;
        if (v === 'ondulada') rz *= 1 + 0.0;
        return { ry: H / 2, rz, cy: H / 2 + i * H * 1.05 };
      },
      desloc: (p) => {
        if (v === 'ondulada') { const az = clamp(Math.abs(p.z) / (W / 2)); p.y += Math.sin(p.x * 140) * H * 1.2 * suave(0.75, 1, az); }
        if (v === 'favo' || k.tem('favo')) p.y += H * 0.35 * suave(0.75, 0.9, celula(p.x * 90, 0, p.z * 90, s));
        if (k.tem('ondas')) p.y += H * 2 * Math.sin(p.x * 30 + p.z * 20) * 0.5;
      },
    });
    g.rotateY(rot);
    out.push(parte(g, k.ac, true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* monte de pó ou grãos                                                 */
/* ------------------------------------------------------------------ */

export const gMonte: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const tipo = k.v.v;
  const buraco = k.tem('buraco');
  const paleta: RGB[] = k.tem('cores') ? [c1, c2, c3, ci] : [c1, c2];
  const corMonte: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.05 * fbm(x * 80, y * 80, z * 80, s));
    if (k.tem('farelo')) c = mix(c, c2, 1 - suave(0.08, 0.16, celula(x * 500, y * 500, z * 500, s)));
    if (tipo !== 'po') {
      const fq = 1 / Math.max(0.0015, R * 0.08);
      const cel = celula(x * fq, y * fq, z * fq, s);
      c = mul(mix(c, mul(c, 0.7), suave(0.7, 0.95, cel)), 1);
      if (k.tem('cores')) {
        const idx = Math.floor((ruido(Math.floor(x * fq), Math.floor(y * fq), Math.floor(z * fq), s) * 0.5 + 0.5) * paleta.length);
        c = mix(c, paleta[Math.min(paleta.length - 1, idx)], 0.6);
      }
    }
    return c;
  };
  out.push(parte(torno({
    caminho: (u) => {
      // u em [0, 0.5]: base; [0.5, 1]: encosta até o topo
      if (u < 0.3) return [R * (u / 0.3), 0];
      const f = (u - 0.3) / 0.7;
      const r = R * (1 - f);
      let h = H * (1 - (r / R) ** 1.6) ** 0.9;
      if (buraco) h -= H * 0.45 * (1 - suave(0, R * 0.45, r));
      return [r, h];
    },
    n: 28, m: 32, cor: corMonte,
    mod: (t, a) => 1 + 0.04 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 2, s) * suave(0.25, 0.4, t),
  }), k.ac, true));
  if (tipo === 'po') return out;
  // grãos sobre a superfície
  const ng = Math.min(64, k.v.n ?? 64);
  const gl = k.T * (k.v.l ?? 0.08);
  const forma = tipo;
  for (let i = 0; i < ng; i++) {
    const rr = R * Math.sqrt(k.r.f(0.0, 1)) * 0.95;
    const a = k.r.f(0, TAU);
    let h = H * (1 - (rr / R) ** 1.6) ** 0.9;
    if (buraco) h -= H * 0.45 * (1 - suave(0, R * 0.45, rr));
    const cor = paleta[i % paleta.length];
    const cg: CorFn = (x, y, z) => mul(cor, 1 + 0.08 * fbm(x * 300, y * 300, z * 300, s + i) + (k.tem('olho') && Math.abs(x) < gl * 0.12 && y > 0 ? -0.8 : 0));
    let g: THREE.BufferGeometry;
    switch (forma) {
      case 'longo': g = grao(gl / 2, gl * 0.14, gl * 0.16, cg, 5, 6); break;
      case 'disco': g = grao(gl / 2, gl * 0.16, gl / 2, cg, 5, 8); break;
      case 'esfera': g = grao(gl / 2, gl / 2, gl / 2, cg, 4, 6); break;
      case 'floco': g = grao(gl / 2, gl * 0.06, gl * 0.4, cg, 4, 7); break;
      case 'triangulo': g = grao(gl / 2, gl * 0.35, gl * 0.35, cg, 4, 3); break;
      case 'meia': g = grao(gl / 2, gl * 0.22, gl / 2, cg, 4, 7); break;
      case 'rim': g = grao(gl / 2, gl * 0.28, gl * 0.3, cg, 5, 7, ); g.translate(0, 0, 0); break;
      default: g = grao(gl / 2, gl * 0.32, gl * 0.34, cg, 5, 7); break;
    }
    g.rotateX(k.r.f(0, TAU));
    g.rotateY(k.r.f(0, TAU));
    g.translate(Math.cos(a) * rr, h + gl * 0.1, Math.sin(a) * rr);
    out.push(parte(g, forma === 'esfera' || k.tem('brilho') ? 'brilhante' : k.ac));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* castanhas                                                            */
/* ------------------------------------------------------------------ */

export const gCastanha: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const nc = k.v.n ?? 1;
  for (let i = 0; i < nc; i++) {
    const off = nc > 1 ? V(Math.cos(i * 2.4) * L * 0.55 * Math.sqrt(i), 0, Math.sin(i * 2.4) * L * 0.55 * Math.sqrt(i)) : V();
    const rotY = k.r.f(0, TAU) * (nc > 1 ? 1 : 0);
    const gs: Parte[] = [];
    const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.08 * fbm(x * 300, y * 300, z * 300, s + i)), c2, suave(0.3, 0.8, fbm(x * 150, y * 150, z * 150, s)) * 0.5);
    switch (v) {
      case 'gota': case 'alongada': {
        gs.push(parte(corpo({
          x0: -L / 2, x1: L / 2, n: 16, m: 16, cor: v === 'gota' ? (x, y, z) => mul(cor(x, y, z, 0, 0), 1 - 0.1 * Math.abs(Math.sin(x * 600 + z * 300)) ** 6) : cor,
          perfil: (t) => { const e = Math.sin(PI * clamp(t) ** (v === 'gota' ? 0.7 : 1)) ** 0.7; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
          mod: v === 'alongada' && k.tem('triangular') ? (t, a) => 1 + 0.12 * Math.cos(a * 3) : undefined,
        }), k.ac, true));
        break;
      }
      case 'esfera': {
        gs.push(parte(fruto({ R: L / 2, H, cor, s, pontaBase: 0, covaBase: 0 }), k.ac, true));
        if (k.tem('cupula')) gs.push(parte(tf(elipsoide(L * 0.22, H * 0.06, L * 0.22, () => c2, 3, 10), [0, 0.0, 0]), 'fosco'));
        break;
      }
      case 'metade': {
        // noz e pecã: metade enrugada com sulco central e face chata embaixo
        const kx = 7 / L, kz = 12 / W;
        const ruga = (x: number, z: number) => Math.abs(Math.sin(x * kx * PI + Math.sin(z * kz) * 1.6 + fbm(x * kx, 0, z * kz, s + i) * 2));
        const sulco = (z: number) => Math.exp(-((z / (W * 0.07)) ** 2));
        gs.push(parte(corpo({
          x0: -L / 2, x1: L / 2, n: 26, m: 28,
          cor: (x, y, z) => mul(cor(x, y, z, 0, 0), (0.62 + 0.45 * ruga(x, z)) * (1 - 0.35 * sulco(z))),
          perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); return { ry: H * e, rz: (W / 2) * e * (1 - 0.1 * Math.abs(Math.sin(t * PI * 3))), cy: 0 }; },
          desloc: (p) => {
            if (p.y < 0) { p.y *= 0.05; return; }
            p.y *= (1 - 0.5 * sulco(p.z)) * (0.82 + 0.22 * ruga(p.x, p.z));
          },
        }), k.ac, true));
        break;
      }
      case 'pistache': {
        gs.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 14, m: 16, cor: () => mul(c3, 1), perfil: (t) => { const e = Math.sin(PI * t) ** 0.7; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; }, mod: (t, a) => (Math.abs(a - PI / 2) < 0.35 ? 0.4 : 1) }), 'fosco', true));
        gs.push(parte(tf(elipsoide(L * 0.38, H * 0.32, W * 0.3, (x, y, z) => mix(c1, c2, suave(0.1, 0.6, fbm(x * 300, y * 300, z * 300, s))), 8, 10), [0, H * 0.5, W * 0.05]), k.ac));
        break;
      }
      case 'amendoim': {
        const rede: CorFn = (x, y, z) => mix(c3, mul(c3, 0.75), suave(0.75, 0.9, celula(x * 500, y * 500, z * 500, s)));
        gs.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 22, m: 16, cor: rede, perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (1 - 0.25 * Math.exp(-((t - 0.5) ** 2) / 0.006)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; } }), 'fosco', true));
        break;
      }
      case 'castanha': {
        gs.push(parte(corpo({
          x0: -L / 2, x1: L / 2, n: 18, m: 20, cor: (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 100, y * 100, z * 100, s)), c2, suave(-L * 0.2, -L * 0.45, x)),
          perfil: (t) => { const e = Math.sin(PI * clamp(t) ** 0.8) ** 0.6; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
          desloc: (p) => { if (p.y < H * 0.3) p.y = H * 0.3 - (H * 0.3 - p.y) * 0.3; },
        }), 'brilhante', true));
        break;
      }
    }
    for (const p of gs) {
      p.g.rotateY(rotY);
      p.g.translate(off.x, off.y, off.z);
      out.push(p);
    }
  }
  void ci;
  return out;
};

/* ------------------------------------------------------------------ */
/* massas alimentícias                                                  */
/* ------------------------------------------------------------------ */

export const gMassa: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 120, y * 120, z * 120, s)), c2, suave(0.4, 0.9, fbm(x * 200, y * 200, z * 200, s + 1)) * 0.3);
  const nc = k.v.n ?? 1;
  const copia = (gerar: (i: number) => THREE.BufferGeometry[], ac = k.ac) => {
    for (let i = 0; i < nc; i++) {
      const off = nc > 1 ? V((i % 3 - 1) * L * 1.05, 0, (Math.floor(i / 3) - (Math.ceil(nc / 3) - 1) / 2) * W * 1.2) : V();
      for (const g of gerar(i)) out.push(parte(g.translate(off.x, off.y, off.z), ac, true));
    }
  };
  switch (v) {
    case 'feixe': {
      const nf = 30;
      for (let i = 0; i < nf; i++) {
        const a = i * 2.4, rr = W * 0.5 * Math.sqrt(i / nf);
        const r = L * 0.0045;
        out.push(parte(corpo({ x0: -L / 2 + k.r.f(0, L * 0.02), x1: L / 2 - k.r.f(0, L * 0.02), n: 6, m: 5, tampa: false, cor, perfil: () => ({ ry: r, rz: r, cy: W * 0.5 + Math.cos(a) * rr, cz: Math.sin(a) * rr }) }), k.ac, true));
      }
      return out;
    }
    case 'ninho': {
      const nfios = k.v.n ?? 9;
      const R = L / 2;
      const esp = W; // espessura ou largura do fio
      const fita = k.tem('fita');
      for (let i = 0; i < nfios; i++) {
        const pts: THREE.Vector3[] = [];
        const fase = (i / nfios) * TAU, inc = k.r.f(0.2, 0.5);
        for (let j = 0; j <= 48; j++) {
          const a = (j / 48) * TAU * 2.2 + fase;
          const rr = R * (0.45 + 0.4 * Math.sin(j * 0.31 + i) ** 2);
          pts.push(V(Math.cos(a) * rr, H * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(a * 1.5 + inc * 7))) * (1 - 0.6 * (rr / R - 0.45)), Math.sin(a) * rr));
        }
        out.push(parte(tubo(pts, { raio: fita ? esp * 0.0625 : esp / 2, achata: fita ? 8 : 1, cima: V(0, 1, 0), m: fita ? 6 : 4, n: 60, cor }), k.ac, true));
      }
      return out;
    }
    case 'raviolo': {
      copia(() => {
        const base = corpo({ x0: -L / 2, x1: L / 2, n: 14, m: 32, exp: 10, tampa: true, linear: true, cor: (x, y, z) => mul(cor(x, y, z, 0, 0), 1 - 0.12 * Math.abs(Math.sin(x * 900)) ** 4 * (Math.abs(z) > W * 0.4 ? 1 : 0) - 0.12 * Math.abs(Math.sin(z * 900)) ** 4 * (Math.abs(x) > L * 0.4 ? 1 : 0)), corTampa: cor, perfil: () => ({ ry: H * 0.08, rz: W / 2, cy: H * 0.08 }) });
        const almofada = corpo({ x0: -L * 0.34, x1: L * 0.34, n: 14, m: 24, exp: 3, cor, perfil: (t) => { const e = Math.sin(PI * t) ** 0.6; return { ry: H * 0.45 * e, rz: W * 0.34 * e, cy: H * 0.12 }; }, desloc: (p) => { if (p.y < H * 0.12) p.y = H * 0.12; } });
        return [base, almofada];
      });
      return out;
    }
    case 'tortellini': {
      copia((i) => {
        const pts: THREE.Vector3[] = [];
        const Rr = L * 0.3;
        for (let j = 0; j <= 20; j++) { const a = PI * 0.25 + (j / 20) * PI * 1.5; pts.push(V(Math.cos(a) * Rr, H * 0.35, Math.sin(a) * Rr)); }
        const anel = tubo(pts, { raio: (t) => H * 0.35 * (0.6 + 0.4 * Math.sin(PI * t)), m: 12, n: 40, cor });
        const aba = folha(L * 0.4, W * 0.35, c1, c1, { contorno: contornos.redonda, curva: 0.4, esp: H * 0.06, n: 8, m: 8, cor });
        tf(aba, [-L * 0.25, H * 0.55, 0], [0, 0, 0.6]);
        anel.rotateY(i);
        aba.rotateY(i);
        return [anel, aba];
      });
      return out;
    }
    case 'tubo': case 'diagonal': case 'estriado': {
      // tubos curtos ocos: penne (diagonal), rigatoni (estriado), ditalini, canelone (recheado)
      const R = H / 2, r = R * (k.tem('recheado') ? 0.0 : 0.72);
      copia((i) => {
        const caminho: [number, number][] = [[R, 0], [R, L], [r, L], [r, 0]];
        let g: THREE.BufferGeometry;
        if (k.tem('recheado')) g = corpo({ x0: 0, x1: L, n: 18, m: 24, tampa: true, cor, corTampa: () => c3, perfil: () => ({ ry: R, rz: R }) }).rotateZ(PI / 2);
        else g = tornoAnel({ caminho, n: 34, m: 22, cor, mod: v === 'estriado' ? (t, a) => (t < 0.45 ? 1 + 0.06 * Math.abs(Math.cos(a * 7)) : 1) : undefined });
        if (v === 'diagonal') {
          const pa = g.getAttribute('position');
          for (let j = 0; j < pa.count; j++) pa.setY(j, pa.getY(j) + pa.getZ(j) * 0.9);
          g.computeVertexNormals();
        }
        g.translate(0, -L / 2, 0);
        g.rotateZ(PI / 2);
        g.translate(0, R, 0);
        g.rotateY(i * 0.7);
        return [g];
      });
      return out;
    }
    case 'gnocchi': {
      copia((i) => {
        const g = corpo({ x0: -L / 2, x1: L / 2, n: 18, m: 18, cor, perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; }, mod: (t, a) => 1 - 0.07 * Math.abs(Math.sin(a * 2.5 + 0)) ** 8 * (Math.cos(a) > 0 ? 1 : 0) - 0.06 * Math.abs(Math.sin(t * PI * 6)) ** 6 * Math.max(0, Math.cos(a)) });
        g.rotateY(i * 0.8);
        return [g];
      });
      return out;
    }
    case 'concha': case 'orelha': {
      copia((i) => {
        const R = L / 2;
        const esp = R * 0.14;
        const fundo = v === 'concha' ? H : H * 0.5;
        const g = torno({ caminho: [[0, 0], [R * 0.6, fundo * 0.15], [R, fundo], [R - esp, fundo + esp * 0.2], [R * 0.55, fundo * 0.3 + esp], [0, esp]], n: 22, m: 24, l: v === 'concha' ? 0.7 : 1, cor, mod: v === 'concha' ? (t, a) => 1 + 0.05 * Math.abs(Math.cos(a * 8)) * (t < 0.45 ? 1 : 0) : undefined });
        if (v === 'concha') { g.rotateX(PI / 2 * 0.9); g.translate(0, R * 0.7, 0); }
        g.rotateY(i * 0.9);
        return [g];
      });
      return out;
    }
    case 'espiral': {
      copia((i) => {
        const gs: THREE.BufferGeometry[] = [];
        const R = H * 0.42;
        for (let f = 0; f < 3; f++) {
          const pts: THREE.Vector3[] = [];
          for (let j = 0; j <= 30; j++) { const t = j / 30; const a = t * TAU * 3 + (f * TAU) / 3; pts.push(V(lerp(-L / 2, L / 2, t), H / 2 + Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55)); }
          gs.push(tubo(pts, { raio: R * 0.42, m: 8, n: 70, cor }));
        }
        for (const g of gs) g.rotateY(i * 0.6);
        return gs;
      });
      return out;
    }
    case 'laco': {
      copia((i) => {
        const g = corpo({
          x0: -L / 2, x1: L / 2, n: 24, m: 30, exp: 8, tampa: true, linear: true, cor, corTampa: cor,
          perfil: (t) => ({ ry: H * 0.06, rz: (W / 2) * (0.35 + 0.65 * Math.abs(2 * t - 1) ** 0.8), cy: H * 0.5 }),
          desloc: (p) => { p.y += H * 0.35 * Math.sin((p.x / L) * PI * 2) * (Math.abs(p.z) / (W / 2)) + H * 0.25 * (1 - suave(0, L * 0.12, Math.abs(p.x))); },
        });
        g.rotateY(i * 0.7);
        return [g];
      });
      return out;
    }
  }
  return out;
};

export { caixa, caule };
