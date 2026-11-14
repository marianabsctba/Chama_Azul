// Famílias de aves e carnes: ave inteira, peças de ave, cortes em bloco,
// cortes com osso, carne moída, miúdos e linguiças.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, contornos, osso, disco, type Ctx, type Gerador } from './pecas';

const OSSO: RGB = [0.86, 0.8, 0.68];
const TUTANO: RGB = [0.75, 0.55, 0.42];

/** Pele de ave com poros. */
function corPeleAve(k: Ctx, escala: number): CorFn {
  const { c1, c2, s } = k;
  const f = 1 / Math.max(0.001, escala * 0.012);
  return (x, y, z) => {
    const poro = 1 - suave(0.1, 0.2, celula(x * f, y * f, z * f, s));
    let c = mix(c1, c2, suave(0.35, 0.9, fbm(x * 25 / escala, y * 25 / escala, z * 25 / escala, s)) * 0.45);
    c = mul(c, 1 - poro * 0.08 + 0.04 * fbm(x * 90, y * 90, z * 90, s));
    return c;
  };
}

/** Carne com marmoreio, fibras e gordura conforme as palavras de detalhe. */
function corCarne(k: Ctx, opc: { topo?: number; L: number }): CorFn {
  const { c1, c2, c3, s } = k;
  const L = opc.L;
  const fm = 1 / Math.max(0.002, L * 0.06);
  return (x, y, z) => {
    let c = mul(c1, 1 + 0.06 * fbm(x * 40 / L, y * 40 / L, z * 40 / L, s));
    if (k.tem('fibras')) c = mul(c, 1 - 0.08 * Math.abs(Math.sin((z + 0.3 * y) * 260 / Math.max(0.3, L * 3) + fbm(x * 5 / L, y * 5 / L, z * 5 / L, s) * 3)) ** 3);
    if (k.tem('marmoreio')) {
      const n = fbm(x * fm, y * fm, z * fm, s + 5);
      const veio = 1 - suave(0.0, 0.022, Math.abs(n));
      const area = suave(0.05, 0.45, fbm(x * fm * 0.4 + 3, y * fm * 0.4, z * fm * 0.4, s + 11));
      c = mix(c, c2, veio * area * 0.5 + (1 - suave(0.04, 0.09, celula(x * fm * 3, y * fm * 3, z * fm * 3, s))) * 0.2);
    }
    if (k.tem('membrana')) c = mix(c, c3, suave(0.45, 0.75, fbm(x * 8 / L, y * 30 / L, z * 30 / L, s + 7)) * 0.6);
    if (k.tem('camadas') && opc.topo) {
      const fase = (y / opc.topo) * (k.v.n ?? 5) + 0.3 * fbm(x * 6 / L, 0, z * 6 / L, s);
      c = mix(c, c2, suave(0.35, 0.6, Math.sin(fase * PI)) * 0.95);
    }
    if (opc.topo && k.tem('capa')) c = mix(c, c2, suave(opc.topo * 0.78, opc.topo * 0.86, y + opc.topo * 0.04 * fbm(x * 20 / L, 0, z * 20 / L, s)));
    if (opc.topo && k.tem('pele')) c = mix(c, c3, suave(opc.topo * 0.9, opc.topo * 0.97, y));
    if (k.tem('faixa')) c = mix(c, c2, suave(0.32, 0.4, z / L));
    return c;
  };
}

/* ------------------------------------------------------------------ */
/* ave inteira (de peito para cima, pescoço em +X)                      */
/* ------------------------------------------------------------------ */

export const gAve: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const T = k.T;
  const coelho = k.v.v === 'coelho';
  const Lb = T * (coelho ? 0.62 : 0.86);
  const H = T * k.A, W = T * k.L;
  const x0 = -Lb / 2, x1 = Lb / 2;
  const pele = corPeleAve(k, T);
  const perfilH = (t: number) => Math.sin(PI * (0.06 + 0.88 * t)) ** 0.55 * (coelho ? lerp(0.85, 0.7, t) : lerp(0.85, 1, suave(0.1, 0.6, t)) * lerp(1, 0.75, suave(0.7, 1, t)));
  out.push(parte(corpo({
    x0, x1, n: 34, m: 32, exp: 2.3, cor: pele,
    perfil: (t) => ({ ry: (H / 2) * perfilH(t), rz: (W / 2) * Math.sin(PI * (0.05 + 0.9 * t)) ** 0.5, cy: H / 2 }),
    mod: (t, a) => {
      if (coelho) return 1;
      const topo = Math.max(0, Math.cos(a));
      // dois lobos de peito com sulco do esterno
      return 1 + 0.07 * topo * Math.abs(Math.sin(a)) ** 0.8 * Math.sin(PI * t) - 0.05 * Math.exp(-(a * a) / 0.03) * Math.sin(PI * t) * (k.tem('magro') ? 1.6 : 1);
    },
    desloc: (p) => { if (p.y < H * 0.18) p.y = H * 0.18 - (H * 0.18 - p.y) * 0.4; },
  }), k.ac, true));
  if (coelho) {
    // patas traseiras longas para -X e dianteiras para +X
    for (const sg of [-1, 1]) {
      const z = sg * W * 0.32;
      out.push(parte(tubo([V(x0 + Lb * 0.12, H * 0.45, z), V(x0 - T * 0.08, H * 0.3, z * 1.1), V(-T / 2, H * 0.12, z * 1.05)], { raio: (t) => W * lerp(0.2, 0.06, t), m: 12, n: 16, cor: pele }), k.ac));
      out.push(parte(tubo([V(x1 - Lb * 0.1, H * 0.35, z * 0.8), V(x1 + T * 0.06, H * 0.2, z), V(T / 2, H * 0.08, z)], { raio: (t) => W * lerp(0.11, 0.045, t), m: 10, n: 12, cor: pele }), k.ac));
    }
    out.push(parte(tubo([V(x1 - Lb * 0.02, H * 0.5, 0), V(x1 + T * 0.04, H * 0.45, 0)], { raio: W * 0.16, m: 12, n: 6, cor: () => mul(k.ci, 0.9) }), k.ac));
    return out;
  }
  // coxas e sobrecoxas dobradas nos lados, pontas para trás
  for (const sg of [-1, 1]) {
    const z = sg * W * 0.4;
    const coxa = elipsoide(Lb * 0.22, H * 0.28, W * 0.2, pele, 10, 14);
    tf(coxa, [x0 + Lb * 0.3, H * 0.42, z], [0, sg * 0.25, -0.3]);
    out.push(parte(coxa, k.ac));
    const p0 = V(x0 + Lb * 0.32, H * 0.5, z * 1.05);
    const p1 = V(x0 + Lb * 0.05, H * 0.78, z * 0.75);
    const p2 = V(x0 - T * 0.02, H * 0.92, z * 0.35);
    out.push(parte(tubo([p0, p0.clone().lerp(p1, 0.5).add(V(0, H * 0.05, sg * W * 0.03)), p1, p2], {
      raio: (t) => W * (0.16 * (1 - t) ** 0.9 + 0.045) * (k.tem('coxagrossa') ? 1.2 : 1), m: 12, n: 16,
      cor: (x, y, zz, t) => mix(pele(x, y, zz, t, 0), OSSO, suave(0.86, 0.95, t)),
    }), k.ac));
    // asas dobradas
    const a0 = V(x1 - Lb * 0.18, H * 0.45, sg * W * 0.45);
    out.push(parte(tubo([a0, V(x1 - Lb * 0.35, H * 0.3, sg * W * 0.55), V(x1 - Lb * 0.1, H * 0.15, sg * W * 0.5), V(x1 - Lb * 0.3, H * 0.08, sg * W * 0.38)], {
      raio: (t) => W * (k.tem('asagrande') ? 0.1 : 0.085) * (1 - 0.5 * t), m: 10, n: 18, cor: pele,
    }), k.ac));
  }
  // pescoço cortado e sobrecu
  out.push(parte(tubo([V(x1 - Lb * 0.05, H * 0.45, 0), V(x1 + T * 0.04, H * 0.38, 0), V(x1 + T * 0.07, H * 0.33, 0)], { raio: W * 0.1, m: 12, n: 8, cor: (x, y, z, t) => mix(pele(x, y, z, t, 0), k.ci, suave(0.7, 1, t)) }), k.ac));
  out.push(parte(tf(elipsoide(Lb * 0.06, H * 0.09, W * 0.08, pele, 6, 10), [x0 - Lb * 0.01, H * 0.5, 0]), k.ac));
  void c1; void c2; void s;
  return out;
};

/* ------------------------------------------------------------------ */
/* peças de ave                                                         */
/* ------------------------------------------------------------------ */

export const gPecaAve: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const pele = corPeleAve(k, L * 2);
  if (v === 'peito' || v === 'magret') {
    const magret = v === 'magret';
    const cor: CorFn = (x, y, z) => {
      if (magret) {
        if (y > H * 0.55) {
          const losango = Math.min(Math.abs(Math.sin((x + z) * 180)), Math.abs(Math.sin((x - z) * 180)));
          return mix(mul(c2, 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s)), mul(c2, 0.75), (1 - suave(0, 0.12, losango)) * (k.tem('riscado') ? 1 : 0));
        }
        return mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
      }
      const nervo = 1 - suave(0, W * 0.04, Math.abs(z + W * 0.15 - x * 0.2));
      const c = mix(mul(c1, 1 + 0.05 * fbm(x * 50, y * 50, z * 50, s)), c2, nervo * suave(0, H * 0.3, H * 0.35 - y) * 0.7);
      return mul(c, 1 - 0.05 * Math.abs(Math.sin((x * 0.6 + z) * 300)) ** 4);
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 28, m: 26, exp: magret ? 3 : 2.4, cor,
      perfil: (t) => {
        const env = magret ? Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.5)) : Math.sin(PI * clamp(t) ** 0.75) ** 0.75;
        return { ry: (H / 2) * env, rz: (W / 2) * env * (magret ? 1 : lerp(0.75, 1, t)), cy: (H / 2) * env };
      },
      desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
    }), k.ac, true));
    if (!magret && k.tem('sassami')) {
      // filezinho solto por baixo, saindo de lado
      out.push(parte(corpo({ x0: -L * 0.4, x1: L * 0.35, n: 16, m: 12, cor: (x, y, z) => mul(c1, 0.96 + 0.05 * fbm(x * 70, y * 70, z * 70, s)), perfil: (t) => { const e = Math.sin(PI * t) ** 0.8; return { ry: H * 0.18 * e, rz: W * 0.16 * e, cy: H * 0.18 * e, cz: -W * 0.42 }; } }), k.ac));
    }
    return out;
  }
  if (v === 'perna') {
    // sobrecoxa larga em -X, coxa em baqueta para +X com ponta de osso
    const sob = elipsoide(L * 0.24, H * 0.5, W * 0.5, pele, 12, 18);
    sob.translate(-L * 0.24, H * 0.5, 0);
    out.push(parte(sob, k.ac, true));
    out.push(parte(tubo([V(-L * 0.06, H * 0.48, 0), V(L * 0.12, H * 0.45, 0), V(L * 0.32, H * 0.36, 0), V(L * 0.47, H * 0.3, 0)], {
      raio: (t) => H * (0.4 * Math.sin(PI * (0.15 + 0.6 * t)) ** 1.2 * (1 - suave(0.6, 0.85, t)) + 0.09 + 0.06 * suave(0.92, 1, t)), m: 16, n: 22,
      cor: (x, y, z, t) => mix(pele(x, y, z, t, 0), OSSO, suave(0.85, 0.92, t)),
    }), k.ac, true));
    // linha de gordura da junta
    out.push(parte(tf(elipsoide(L * 0.02, H * 0.25, W * 0.35, () => mul(c2, 1.1), 3, 10), [-L * 0.05, H * 0.55, 0]), 'acetinado'));
    return out;
  }
  if (v === 'asa') {
    const pts = [V(-L / 2, H * 0.4, -W * 0.2), V(-L * 0.18, H * 0.45, W * 0.15), V(L * 0.05, H * 0.42, W * 0.25), V(L * 0.25, H * 0.35, -W * 0.05), V(L / 2, H * 0.25, -W * 0.3)];
    out.push(parte(tubo(pts, {
      raio: (t) => H * 0.45 * (t < 0.35 ? lerp(1, 0.75, t / 0.35) * (1 - 0.3 * suave(0.28, 0.35, t)) : t < 0.7 ? 0.85 * (1 - 0.15 * Math.sin((t - 0.35) / 0.35 * PI) * 0) : lerp(0.55, 0.2, (t - 0.7) / 0.3)),
      achata: 1.25, cima: V(0, 1, 0), m: 16, n: 36, cor: pele,
    }), k.ac, true));
    return out;
  }
  if (v === 'carcaca') {
    const cor: CorFn = (x, y, z) => {
      const cost = Math.abs(Math.sin(x * 140)) ** 6;
      return mix(mix(ci, OSSO, 0.4 + 0.3 * fbm(x * 60, y * 60, z * 60, s)), mul(c1, 0.8), cost * 0.4);
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 30, m: 24, cor,
      perfil: (t) => { const e = Math.sin(PI * (0.08 + 0.84 * t)) ** 0.7; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
      mod: (t, a) => 1 - 0.12 * Math.max(0, Math.cos(a)) ** 4 - 0.04 * Math.abs(Math.sin(t * PI * 10)) ** 4 * Math.abs(Math.sin(a)),
    }), 'acetinado', true));
    out.push(parte(osso([V(-L / 2 - L * 0.05, H * 0.12, 0), V(L / 2 + L * 0.05, H * 0.12, 0)], H * 0.06, OSSO, 1.2), 'acetinado'));
    return out;
  }
  if (v === 'furcula') {
    const r = L * 0.03;
    out.push(parte(tubo([V(-L / 2, r, -W / 2), V(-L * 0.1, r, -W * 0.25), V(L * 0.35, r, -W * 0.04), V(L / 2, r, 0), V(L * 0.35, r, W * 0.04), V(-L * 0.1, r, W * 0.25), V(-L / 2, r, W / 2)], { raio: (t) => r * (1 + 0.6 * suave(0.42, 0.5, t) * suave(0.58, 0.5, t) + 0.5 * (suave(0.06, 0, t) + suave(0.94, 1, t))), achata: 0.6, cima: V(0, 1, 0), m: 6, n: 40, cor: () => OSSO }), 'acetinado', true));
    return out;
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* carne em bloco, cilindro, fatia, pernil                              */
/* ------------------------------------------------------------------ */

export const gCarne: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corCarne(k, { topo: H, L });
  const corCorte = corCarne({ ...k, tem: (w: string) => k.tem(w) && w !== 'pele' && w !== 'fibras' } as Ctx, { topo: H, L });
  const irr = k.tem('irregular') ? 0.12 : 0.04;
  if (v === 'bloco' || v === 'achatado') {
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 24, m: 32, exp: v === 'achatado' ? 3.5 : 4.5, tampa: true, cor, corTampa: corCorte,
      perfil: (t) => {
        const ch = 1 - 0.1 * (1 - suave(0, 0.06, Math.min(t, 1 - t)));
        const larg = 1 + (k.tem('cunha') ? 0.25 * (t - 0.5) : 0);
        return { ry: (H / 2) * ch * (1 + (k.tem('cunha') ? -0.3 * (t - 0.5) : 0)), rz: (W / 2) * ch * larg, cy: H / 2 };
      },
      mod: (t, a) => 1 + irr * fbm(t * 5, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s),
      desloc: (p) => { if (p.y < 0) p.y *= 0.3; },
    }), k.ac, true));
    return out;
  }
  if (v === 'fatia') {
    // fatia finíssima ondulada com borda de gordura
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 30, m: 40, exp: 6, cor: (x, y, z, t, a) => mix(mul(c1, 1 + 0.06 * fbm(x * 60, 0, z * 60, s)), c2, suave(W * 0.32, W * 0.42, z + W * 0.04 * fbm(x * 15, 0, 0, s))),
      perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 3)); return { ry: H / 2, rz: (W / 2) * e, cy: H * 2 }; },
      desloc: (p) => { p.y += H * 4 * (0.5 + 0.5 * Math.sin(p.x * 40 + p.z * 25)); },
    }), k.ac, true));
    return out;
  }
  if (v === 'cilindro') {
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 32, m: 26, cor, tampa: true, corTampa: corCorte,
      perfil: (t) => {
        const fino = k.tem('afina') ? lerp(1, 0.4, suave(0.45, 1, t)) : 1;
        const r = Math.sqrt(suave(0, 0.05, t)) * Math.sqrt(suave(1, 0.95, t)) * fino;
        return { ry: (H / 2) * Math.max(0.15, r), rz: (W / 2) * Math.max(0.15, r), cy: H / 2 };
      },
      mod: (t, a) => 1 + irr * fbm(t * 6, Math.cos(a), Math.sin(a), s),
    }), k.ac, true));
    if (k.tem('cordao')) out.push(parte(tubo([V(-L * 0.45, H * 0.3, W * 0.42), V(0, H * 0.35, W * 0.48), V(L * 0.3, H * 0.3, W * 0.3)], { raio: (t) => H * 0.16 * (1 - 0.5 * t), m: 10, n: 16, cor }), k.ac));
    return out;
  }
  if (v === 'pernil' || v === 'paleta') {
    const paleta = v === 'paleta';
    const corP: CorFn = (x, y, z) => (k.tem('pele') ? mix(c3, mul(c3, 0.85), suave(0.3, 0.9, fbm(x * 30, y * 30, z * 30, s))) : cor(x, y, z, 0, 0));
    out.push(parte(corpo({
      x0: -L / 2, x1: L * 0.32, n: 30, m: 28, cor: corP, exp: paleta ? 2.6 : 2,
      perfil: (t) => {
        const r = Math.sin(PI * (0.12 + 0.88 * t ** 0.65)) ** 0.7 * lerp(1, 0.3, suave(0.4, 1, t));
        return { ry: (H / 2) * r * (paleta ? 0.7 : 1), rz: (W / 2) * r * (paleta ? lerp(1.1, 0.8, t) : 1), cy: (H / 2) * r * (paleta ? 0.7 : 1) };
      },
      mod: (t, a) => 1 + 0.05 * fbm(t * 4, Math.cos(a), Math.sin(a), s),
    }), k.ac, true));
    // osso da canela saliente em +X
    out.push(parte(osso([V(L * 0.2, H * 0.22, 0), V(L * 0.38, H * 0.2, 0), V(L / 2, H * 0.17, 0)], H * 0.07, OSSO, 1.6), 'acetinado'));
    if (!paleta) out.push(parte(tf(elipsoide(L * 0.04, H * 0.1, W * 0.1, () => OSSO, 5, 8), [-L / 2 + L * 0.02, H * 0.45, 0]), 'acetinado'));
    return out;
  }
  if (v === 'borboleta') {
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 28, m: 36, exp: 3, cor,
      perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.4)); return { ry: (H / 2) * e, rz: (W / 2) * e * (1 - 0.2 * Math.cos(t * TAU * 2) ** 2), cy: H / 2 }; },
      mod: (t, a) => 1 + 0.15 * fbm(t * 5, Math.cos(a) * 2, Math.sin(a) * 2, s),
      desloc: (p) => { if (p.y < 0) p.y *= 0.3; },
    }), k.ac, true));
    return out;
  }
  if (v === 'medalhao') {
    const R = L / 2;
    out.push(parte(disco(R, H, (x, y, z) => {
      const r = Math.hypot(x, z) / R;
      if (k.tem('envolto') && r > 0.9) return mix(c2, c1, suave(0.4, 0.6, Math.sin(y * 300 + Math.atan2(z, x) * 2) * 0.5 + 0.5) * 0.4);
      return cor(x, y * 0.3, z, 0, 0);
    }, { n: 26, m: 30, borda: 0.25, mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a), Math.sin(a), t, s) }), k.ac, true));
    if (k.tem('amarrado')) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 16; i++) pts.push(V(Math.cos((i / 16) * TAU) * R * 1.02, H * 0.5, Math.sin((i / 16) * TAU) * R * 1.02));
      out.push(parte(tubo(pts, { raio: R * 0.025, m: 5, n: 32, fechado: true, cor: () => [0.85, 0.8, 0.7] }), 'fosco'));
    }
    return out;
  }
  void ci;
  return out;
};

/* ------------------------------------------------------------------ */
/* cortes com osso                                                      */
/* ------------------------------------------------------------------ */

export const gCarneOsso: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corCarne(k, { topo: H, L });
  const n = k.v.n ?? 6;
  const corOsso: RGB = OSSO;
  const blocoCarne = (x0: number, x1: number, ry: number, rz: number, cy: number, cz = 0, ex = 3.5) => corpo({
    x0, x1, n: 24, m: 30, exp: ex, tampa: true, cor, corTampa: corCarne({ ...k, tem: (w: string) => k.tem(w) && w !== 'pele' } as Ctx, { topo: H, L }),
    perfil: (t) => { const ch = 1 - 0.08 * (1 - suave(0, 0.06, Math.min(t, 1 - t))); return { ry: ry * ch, rz: rz * ch, cy, cz }; },
    mod: (t, a) => 1 + 0.04 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
  });
  switch (v) {
    case 'costela': case 'costelinha': case 'lombo_osso': {
      const fino = v === 'costelinha';
      out.push(parte(blocoCarne(-L / 2, L / 2, H * (fino ? 0.35 : 0.42), W * 0.42, H * (fino ? 0.35 : 0.58), -W * 0.05), k.ac, true));
      for (let i = 0; i < n; i++) {
        const x = lerp(-L / 2 + L * 0.06, L / 2 - L * 0.06, i / Math.max(1, n - 1));
        const yb = fino ? H * 0.35 : H * 0.14;
        const pts = v === 'lombo_osso'
          ? [V(x, H * 0.08, W * 0.15), V(x, H * 0.35, W * 0.42), V(x, H * 0.62, W * 0.4)]
          : fino
            ? [V(x, yb, -W * 0.4), V(x, yb + H * 0.05, W * 0.1), V(x + L * 0.02, yb - H * 0.02, W * 0.5), V(x + L * 0.03, yb - H * 0.05, W * 0.62)]
            : [V(x, H * 0.1, W * 0.2), V(x, H * 0.45, W * 0.45), V(x + L * 0.01, H * 0.88, W * 0.42)];
        out.push(parte(osso(pts, H * (fino ? 0.08 : 0.09), corOsso, 1.25), 'acetinado'));
      }
      return out;
    }
    case 'peito_vitela': {
      out.push(parte(blocoCarne(-L / 2, L / 2, H * 0.4, W * 0.48, H * 0.55), k.ac, true));
      for (let i = 0; i < n; i++) {
        const x = lerp(-L * 0.42, L * 0.42, i / Math.max(1, n - 1));
        out.push(parte(osso([V(x, H * 0.12, -W * 0.45), V(x + L * 0.01, H * 0.1, 0), V(x + L * 0.02, H * 0.12, W * 0.42)], H * 0.08, corOsso, 1.1), 'acetinado'));
      }
      out.push(parte(osso([V(-L * 0.46, H * 0.1, -W * 0.42), V(L * 0.46, H * 0.1, -W * 0.42)], H * 0.1, [0.92, 0.9, 0.84], 1.1), 'acetinado'));
      return out;
    }
    case 'carre': case 'guarda': case 'coroa': {
      const rack = (sx: number): THREE.BufferGeometry[] => {
        const gs: THREE.BufferGeometry[] = [];
        const Rl = H * 0.32;
        gs.push(corpo({
          x0: -L / 2, x1: L / 2, n: 20, m: 22, tampa: true, cor, corTampa: (x, y, z) => mix(ci, c2, suave(Rl * 0.75, Rl * 0.95, Math.hypot(y - Rl, z))),
          perfil: () => ({ ry: Rl, rz: Rl * 1.1, cy: Rl }),
          mod: (t, a) => 1 + 0.1 * Math.max(0, Math.cos(a - 0.6)) ** 2,
        }));
        for (let i = 0; i < n; i++) {
          const x = lerp(-L / 2 + L * 0.06, L / 2 - L * 0.06, i / Math.max(1, n - 1));
          gs.push(osso([V(x, Rl * 0.8, 0), V(x, Rl * 1.6, sx * W * 0.25), V(x, H * 0.95, sx * W * 0.62)], H * 0.045, corOsso, 1.3));
        }
        return gs;
      };
      if (v === 'carre') {
        for (const g of rack(1)) out.push(parte(g, g === undefined ? 'acetinado' : k.ac, true));
      } else if (v === 'guarda') {
        for (const sx of [-1, 1]) for (const g of rack(-sx)) out.push(parte(g.translate(0, 0, sx * W * 0.45).rotateX(sx * 0.15), k.ac, true));
      } else {
        // coroa: anel de carne com ossos para cima e para fora
        const Rc = L * 0.38, Hc = H * 0.45;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < 20; i++) pts.push(V(Math.cos((i / 20) * TAU) * Rc, Hc * 0.5, Math.sin((i / 20) * TAU) * Rc));
        out.push(parte(tubo(pts, { raio: Hc * 0.5, achata: 0.55, cima: V(0, 1, 0), m: 16, n: 40, fechado: true, cor }), k.ac, true));
        const nb = n * 2;
        for (let i = 0; i < nb; i++) {
          const a = (i / nb) * TAU;
          const d = V(Math.cos(a), 0, Math.sin(a));
          out.push(parte(osso([d.clone().multiplyScalar(Rc).setY(Hc * 0.6), d.clone().multiplyScalar(Rc * 1.05).setY(Hc * 1.4), d.clone().multiplyScalar(Rc * 1.2).setY(H)], H * 0.035, corOsso, 1.3), 'acetinado'));
        }
      }
      return out;
    }
    case 'bife': case 'costeleta': {
      // bife deitado com osso de costela numa borda
      const cab = v === 'costeleta';
      const Lc = cab ? L * 0.45 : L;
      const corB: CorFn = (x, y, z) => {
        const r = Math.hypot((x - (cab ? -L / 2 + Lc / 2 : 0)) / (Lc / 2), z / (W / 2));
        return mix(cor(x, y * 0.2, z, 0, 0), c2, suave(0.82, 0.92, r) * (k.tem('borda') ? 1 : 0));
      };
      const g = disco(Lc / 2, H, corB, { n: 26, m: 32, borda: 0.3, l: W / Lc, mod: (t, a) => 1 + 0.06 * fbm(Math.cos(a), Math.sin(a), t, s) });
      g.translate(cab ? -L / 2 + Lc / 2 : 0, 0, 0);
      out.push(parte(g, k.ac, true));
      if (cab) out.push(parte(osso([V(-L / 2 + Lc * 0.8, H * 0.5, 0), V(L * 0.1, H * 0.55, W * 0.05), V(L / 2, H * 0.5, W * 0.04)], H * 0.18, corOsso, 1.3), 'acetinado'));
      else out.push(parte(osso([V(-L * 0.4, H * 0.5, W * 0.44), V(0, H * 0.52, W * 0.5), V(L * 0.42, H * 0.5, W * 0.4)], H * 0.28, corOsso, 1.1), 'acetinado'));
      return out;
    }
    case 'rodela': {
      const R = L / 2;
      const corR: CorFn = (x, y, z) => {
        const r = Math.hypot(x, z) / R;
        if (r < 0.16) return mix(TUTANO, mul(TUTANO, 0.8), fbm(x * 200, y * 200, z * 200, s));
        if (r < 0.3) return corOsso;
        const nervo = Math.abs(Math.sin(Math.atan2(z, x) * 5 + r * 6)) ** 20;
        return mix(mix(cor(x, y, z, 0, 0), c3, nervo * 0.6), c2, suave(0.88, 0.96, r) * 0.6);
      };
      out.push(parte(disco(R, H, corR, { n: 30, m: 30, borda: 0.3, l: k.v.l === undefined ? 1 : 0.9, mod: (t, a) => 1 + 0.08 * fbm(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0, s) }), k.ac, true));
      return out;
    }
    case 'canela': {
      out.push(parte(corpo({
        x0: -L / 2, x1: L * 0.35, n: 28, m: 24, cor,
        perfil: (t) => { const r = Math.sin(PI * (0.15 + 0.85 * t ** 0.7)) ** 0.6 * lerp(1, 0.35, t); return { ry: (H / 2) * r, rz: (W / 2) * r, cy: H / 2 }; },
        mod: (t, a) => 1 + 0.07 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
      }), k.ac, true));
      out.push(parte(osso([V(L * 0.25, H * 0.5, 0), V(L / 2, H * 0.48, 0)], H * 0.12, corOsso, 1.5), 'acetinado'));
      return out;
    }
    case 'rabada': {
      const ns = k.v.n ?? 5;
      let x = -L / 2;
      for (let i = 0; i < ns; i++) {
        const f = 1 - i * 0.12;
        const R = H * 0.5 * f, esp = L / ns * 0.88;
        const corR: CorFn = (px, py, pz) => {
          const r = Math.hypot(py - R, pz) / R;
          if (r < 0.22) return corOsso;
          return mix(cor(px, py, pz, 0, 0), c2, suave(0.75, 0.9, r) * 0.8);
        };
        out.push(parte(corpo({ x0: x, x1: x + esp, n: 6, m: 24, tampa: true, cor: corR, corTampa: corR, perfil: () => ({ ry: R, rz: R * 1.05, cy: R }), mod: (t, a) => 1 + 0.1 * Math.abs(Math.cos(a * 2)) ** 3 }), k.ac, true));
        x += L / ns;
      }
      return out;
    }
    case 'sela': {
      out.push(parte(blocoCarne(-L / 2, L / 2, H * 0.3, W * 0.22, H * 0.3, -W * 0.24, 2.5), k.ac, true));
      out.push(parte(blocoCarne(-L / 2, L / 2, H * 0.3, W * 0.22, H * 0.3, W * 0.24, 2.5), k.ac, true));
      out.push(parte(osso([V(-L / 2, H * 0.62, 0), V(L / 2, H * 0.62, 0)], H * 0.12, corOsso, 1.05), 'acetinado'));
      for (const sg of [-1, 1]) out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 10, m: 12, exp: 4, tampa: true, cor: () => mul(c2, 1), perfil: () => ({ ry: H * 0.05, rz: W * 0.14, cy: H * 0.06, cz: sg * W * 0.6 }) }), 'acetinado'));
      return out;
    }
    case 'osso_tutano': {
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 10, m: 24, tampa: true,
        cor: (x, y, z) => mul(corOsso, 1 + 0.08 * fbm(x * 90, y * 90, z * 90, s)),
        corTampa: (x, y, z) => (Math.hypot(y - H / 2, z) < H * 0.3 ? TUTANO : corOsso),
        perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }),
      }), 'acetinado', true));
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* carne moída                                                          */
/* ------------------------------------------------------------------ */

export const gCarneMoida: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const fq = 1 / Math.max(0.002, k.T * 0.025);
  const cor: CorFn = (x, y, z) => {
    const fio = Math.abs(Math.sin((x * 1.3 + Math.sin(z * fq) * 0.004 + y) * fq * 4));
    const gord = 1 - suave(0.1, 0.25, celula(x * fq * 2, y * fq * 2, z * fq * 2, s));
    return mix(mul(c1, 0.85 + 0.25 * fio), c2, gord * 0.8);
  };
  const g = torno({
    caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.7, H * (1 - Math.cos(th)) / 2 * (k.v.v === 'bola' ? 1 : 0.9)]; },
    n: 24, m: 32, cor,
    desloc: (p) => {
      const n = ruido(p.x * fq * 0.5, p.y * fq * 0.5, p.z * fq * 0.5, s) * 0.15 + ruido(p.x * fq * 2, p.y * fq * 2, p.z * fq * 2, s + 1) * 0.08;
      const yy = p.y;
      p.multiplyScalar(1 + n);
      p.y = Math.max(0, yy + (p.y - yy) * 0.6);
    },
  });
  return [parte(g, k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* miúdos                                                               */
/* ------------------------------------------------------------------ */

export const gMiudo: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const brilho: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 30 / L, y * 30 / L, z * 30 / L, s)) * 0.3), 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s));
  const lobo = (x0: number, x1: number, rz: number, ry: number, cz: number, cor: CorFn, ac: 'umido' | 'acetinado' = 'umido') => corpo({
    x0, x1, n: 20, m: 22, cor,
    perfil: (t) => { const e = Math.sin(PI * clamp(t) ** 0.85) ** 0.6; return { ry: ry * e, rz: rz * e, cy: ry * e * 0.95, cz }; },
    desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
  });
  switch (v) {
    case 'figado': {
      out.push(parte(lobo(-L / 2, L * 0.15, W * 0.28, H * 0.5, -W * 0.18, brilho), 'umido', true));
      out.push(parte(lobo(-L * 0.25, L / 2, W * 0.3, H * 0.45, W * 0.18, brilho), 'umido', true));
      if (k.tem('bile')) out.push(parte(tf(elipsoide(L * 0.06, H * 0.1, W * 0.05, () => c3, 4, 8), [-L * 0.05, H * 0.75, 0]), 'umido'));
      return out;
    }
    case 'figado_grande': {
      const cor: CorFn = (x, y, z) => mix(brilho(x, y, z, 0, 0), mul(c1, 0.75), (1 - suave(0, W * 0.02, Math.abs(z - x * 0.3 + W * 0.1))) * 0.7);
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 28, m: 28, exp: 2.2, cor,
        perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.2)); return { ry: (H / 2) * e * lerp(1, 0.5, t), rz: (W / 2) * e, cy: (H / 2) * e * lerp(1, 0.5, t) }; },
        mod: (t, a) => 1 + 0.06 * fbm(t * 4, Math.cos(a), Math.sin(a), s),
        desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
      }), 'umido', true));
      return out;
    }
    case 'rim': {
      const cor: CorFn = (x, y, z) => mix(brilho(x, y, z, 0, 0), c3, (1 - suave(W * 0.08, W * 0.2, Math.hypot(x, z + W * 0.35))) * (k.tem('gordura') ? 1 : 0.6));
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: 24, cor,
        perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: (H / 2) * e * 0.98 + H * 0.02, cz: W * 0.18 * Math.sin(PI * t) }; },
        mod: (t, a) => 1 - 0.3 * Math.exp(-((a - (3 * PI) / 2) ** 2) / 0.25) * Math.sin(PI * t) ** 3 + (k.tem('lobulado') ? 0.05 * Math.abs(Math.sin(t * 30 + a * 3)) : 0),
      }), 'umido', true));
      return out;
    }
    case 'coracao': {
      // em pé, ponta para cima não; deitado com a ponta em +X
      const cor: CorFn = (x, y, z, t) => mix(brilho(x, y, z, t, 0), c3, suave(0.18, 0.08, t) + 0.3 * suave(0.25, 0.9, fbm(x * 60, y * 60, z * 60, s)) * suave(0.4, 0.1, t));
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: 22, cor,
        perfil: (t) => { const e = Math.sqrt(suave(0, 0.15, t)) * (1 - t) ** 0.7 + 0.02; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
        mod: (t, a) => 1 + 0.04 * Math.sin(a * 2 + t * 5),
      }), 'umido', true));
      for (let i = 0; i < 3; i++) {
        const z = (i - 1) * W * 0.22;
        out.push(parte(tubo([V(-L / 2 + L * 0.06, H * 0.55, z), V(-L / 2 - L * 0.06, H * 0.6 + i * H * 0.05, z * 1.2)], { raio: W * 0.09, m: 10, n: 6, cor: () => mul(c3, 0.9), pontaRedonda: false }), 'acetinado'));
      }
      return out;
    }
    case 'lingua': {
      const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.1 * ruido(x * 600, y * 600, z * 600, s)), c2, suave(0.3, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.4);
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 28, m: 24, exp: 2.4, cor,
        perfil: (t) => { const e = Math.sqrt(suave(0, 0.06, t)) * lerp(1, 0.55, t ** 1.4) * Math.sqrt(suave(1, 0.85, t)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: (H / 2) * e }; },
        desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
      }), 'acetinado', true));
      return out;
    }
    case 'lobos': case 'sebo': {
      // timo, sebo: lóbulos irregulares
      const nl = k.v.n ?? 6;
      for (let i = 0; i < nl; i++) {
        const r = L * k.r.f(0.16, 0.26);
        const g = elipsoide(r, r * 0.65, r * 0.85, brilho, 10, 14, (t, a) => 1 + 0.12 * fbm(t * 3, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s + i));
        g.translate(k.r.f(-L * 0.3, L * 0.3), r * 0.55, k.r.f(-W * 0.3, W * 0.3));
        out.push(parte(g, v === 'sebo' ? 'fosco' : 'umido', true));
      }
      return out;
    }
    case 'miudos_ave': {
      // pescoço segmentado, moela, coração e fígado lado a lado
      out.push(parte(corpo({ x0: -L / 2, x1: -L * 0.05, n: 24, m: 14, cor: (x, y, z) => mul(c1, 0.9 + 0.12 * Math.abs(Math.sin(x * 400))), perfil: () => ({ ry: H * 0.18, rz: H * 0.2, cy: H * 0.18, cz: -W * 0.2 }), mod: (t) => 1 + 0.08 * Math.abs(Math.sin(t * PI * 7)) }), 'acetinado', true));
      const moela = elipsoide(L * 0.12, H * 0.25, W * 0.15, (x, y, z) => mix(c3, mul(c1, 0.8), suave(0.3, 0.8, fbm(x * 60, y * 60, z * 60, s))), 10, 14);
      moela.translate(L * 0.1, H * 0.25, -W * 0.2);
      out.push(parte(moela, 'acetinado', true));
      const cor2 = elipsoide(L * 0.07, H * 0.16, W * 0.08, () => mul(c2, 1), 8, 10);
      cor2.translate(L * 0.35, H * 0.16, -W * 0.25);
      out.push(parte(cor2, 'umido'));
      out.push(parte(lobo(-L * 0.2, L * 0.45, W * 0.2, H * 0.22, W * 0.25, (x, y, z) => mul(c2, 0.8 + 0.1 * fbm(x * 60, y * 60, z * 60, s))), 'umido', true));
      return out;
    }
    case 'pe': {
      const cor: CorFn = (x, y, z) => mix(mul(c1, 1 + 0.06 * fbm(x * 60, y * 60, z * 60, s)), c2, suave(0.3, 0.9, fbm(x * 20, y * 20, z * 20, s)) * 0.3);
      out.push(parte(corpo({ x0: -L / 2, x1: L * 0.25, n: 24, m: 22, cor, tampa: true, corTampa: () => k.ci, perfil: (t) => ({ ry: (H / 2) * lerp(1, 0.75, t), rz: (W / 2) * lerp(1, 0.85, t), cy: H / 2 }) }), k.ac, true));
      for (const sg of [-1, 1]) {
        out.push(parte(corpo({ x0: L * 0.22, x1: L / 2, n: 10, m: 14, cor: () => mul(c3, 1), perfil: (t) => { const e = (1 - t) ** 0.6; return { ry: H * 0.32 * e + H * 0.03, rz: W * 0.2 * e + W * 0.02, cy: H * 0.3, cz: sg * W * 0.2 }; } }), 'acetinado'));
      }
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* linguiça, salsicha e tripa                                           */
/* ------------------------------------------------------------------ */

export const gLinguica: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, R = (L * k.L) / 2;
  const f = 1 / Math.max(0.001, R * 0.6);
  const cor: CorFn = (x, y, z) => {
    const gord = 1 - suave(0.12, 0.26, celula(x * f, y * f, z * f, s));
    return mul(mix(c1, c2, gord * (k.tem('lisa') ? 0 : 0.6)), 1 + 0.05 * fbm(x * 80, y * 80, z * 80, s));
  };
  if (v === 'espiral' || v === 'tripa') {
    const pts: THREE.Vector3[] = [];
    const voltas = k.v.n ?? 3;
    const N = voltas * 16;
    const passo = L / (2 * (0.6 + voltas));
    const Rt = Math.min(R, passo * 0.46);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const ang = t * voltas * TAU;
      const rr = passo * (0.6 + (ang / TAU));
      pts.push(V(Math.cos(ang) * rr, Rt + (v === 'tripa' ? Math.sin(i * 1.3) * Rt * 0.5 : 0), Math.sin(ang) * rr));
    }
    out.push(parte(tubo(pts, { raio: Rt, m: v === 'tripa' ? 8 : 16, n: N * 4, cor: v === 'tripa' ? (x, y, z) => mul(c1, 1 + 0.15 * fbm(x * 200, y * 200, z * 200, s)) : cor }), k.ac, true));
    return out;
  }
  const ng = v === 'reta' ? 1 : k.v.n ?? 4;
  const Lg = L / ng;
  for (let i = 0; i < ng; i++) {
    const x0 = -L / 2 + i * Lg;
    const ang = (i - (ng - 1) / 2) * 0.12;
    const g = corpo({
      x0: x0 + Lg * 0.03, x1: x0 + Lg * 0.97, n: 18, m: 18, cor,
      perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** (ng > 1 ? 4 : 6))); return { ry: R * e, rz: R * e, cy: R, cz: Math.sin(ang) * L * 0.15 }; },
      mod: (t, a) => 1 + (k.tem('lisa') ? 0 : 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), s + i)),
    });
    out.push(parte(g, k.ac, true));
    if (i < ng - 1) {
      // nó torcido entre gomos
      out.push(parte(tf(elipsoide(Lg * 0.06, R * 0.28, R * 0.28, () => mul(c1, 0.85), 4, 8), [x0 + Lg, R, Math.sin(ang) * L * 0.15]), k.ac));
    }
  }
  return out;
};

export { contornos, folha, caule, caixa };
