// Famílias de aves e carnes: ave inteira, peças de ave, cortes em bloco,
// cortes com osso, carne moída, miúdos e linguiças.
import * as THREE from 'three';
import {
  corpo, torno, rgb, tubo, elipsoide, caixa, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
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
function corCarne(k: Ctx, opc: { topo?: number; L: number; W?: number }): CorFn {
  const { c1, c2, c3, s } = k;
  const L = opc.L;
  const W = opc.W ?? L * k.L;
  const fm = 1 / Math.max(0.002, L * 0.16);
  return (x, y, z) => {
    // músculo com regiões mais escuras e mais claras, nunca chapado
    let c = mul(c1, 0.9 + 0.16 * fbm(x * 12 / L, y * 12 / L, z * 12 / L, s));
    if (k.tem('fibras')) c = mul(c, 1 - 0.1 * Math.abs(Math.sin((z + 0.3 * y) * 90 / Math.max(0.05, W) + fbm(x * 4 / L, y * 4 / L, z * 4 / L, s) * 2.5)) ** 4);
    if (k.tem('marmoreio')) {
      // veios finos e sinuosos de gordura, mais densos em algumas áreas
      // veios finos e ramificados: ruído em eixos girados e deformados, para não aparecer o quadriculado
      const X = (x * 0.62 + z * 0.55 - y * 0.56) * fm * 1.1, Y = (x * -0.48 + z * 0.83 + y * 0.29) * fm * 1.1, Z = (x * 0.62 - z * 0.1 + y * 0.78) * fm * 1.1;
      const wx = fbm(X * 0.5 + 7.1, Y * 0.5, Z * 0.5, s + 21) * 0.9, wy = fbm(X * 0.5, Y * 0.5 + 3.7, Z * 0.5, s + 23) * 0.9;
      const n = fbm(X + wx, Y + wy, Z, s + 5);
      const veio = (1 - suave(0.0, 0.1, Math.abs(n))) * (0.6 + 0.4 * suave(-0.2, 0.3, fbm(X * 2.3, Y * 2.3, Z * 2.3, s + 9)));
      const area = 0.3 + 0.7 * suave(-0.1, 0.4, fbm(x * fm * 0.35 + 3, y * fm * 0.35, z * fm * 0.35, s + 11));
      c = mix(c, mix(c2, c1, 0.3), Math.min(0.5, veio * area * 0.5));
    }
    if (k.tem('membrana')) c = mix(c, c3, suave(0.4, 0.8, fbm(x * 6 / L, y * 22 / L, z * 22 / L, s + 7)) * 0.32);
    if (k.tem('camadas') && opc.topo) {
      const fase = (y / opc.topo) * (k.v.n ?? 5) + 0.3 * fbm(x * 6 / L, 0, z * 6 / L, s);
      c = mix(c, c2, suave(0.55, 0.8, Math.sin(fase * PI)) * 0.95);
    }
    if (opc.topo && k.tem('capa')) c = mix(c, mul(c2, 0.97 + 0.05 * fbm(x * 40 / L, y * 40 / L, z * 40 / L, s)), suave(opc.topo * 0.76, opc.topo * 0.84, y + opc.topo * 0.05 * fbm(x * 20 / L, 0, z * 20 / L, s)));
    if (opc.topo && k.tem('pele')) c = mix(c, c3, suave(opc.topo * 0.9, opc.topo * 0.97, y));
    // faixa de gordura numa borda comprida (contrafilé)
    if (k.tem('faixa')) c = mix(c, mul(c2, 0.97 + 0.05 * fbm(x * 30 / L, y * 30 / L, 0, s)), suave(W * 0.29, W * 0.33, z + W * 0.025 * fbm(x * 12 / L, y * 12 / L, 0, s)));
    return c;
  };
}

/* ------------------------------------------------------------------ */
/* ave inteira (de peito para cima, pescoço em +X)                      */
/* ------------------------------------------------------------------ */

export const gAve: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const T = k.T;
  const coelho = k.v.v === 'coelho';
  if (coelho) return gCoelho(k);
  // Ave de peito para cima, pescoço em +X e cavidade em -X, amarrada como no açougue.
  const Lb = T * 0.8;
  const H = T * k.A, W = T * k.L;
  const x0 = -Lb / 2, x1 = Lb / 2;
  const magro = k.tem('magro');
  const pele0 = corPeleAve(k, T);
  // pele creme com rosado onde a carne aparece por baixo e amarelado de gordura nos flancos
  const pele: CorFn = (x, y, z, t, a) => {
    let c = pele0(x, y, z, t, a);
    const flanco = suave(W * 0.2, W * 0.45, Math.abs(z)) * suave(H * 0.75, H * 0.35, y);
    c = mix(c, mul(c2, 0.97), flanco * 0.35);
    // cavidade aberta atrás, entre as coxas
    const cav = (1 - suave(0, W * 0.13, Math.hypot(z, (y - H * 0.5) * 1.2))) * suave(x0 + Lb * 0.1, x0, x);
    return mix(c, mul(ci, 0.6), cav * 0.85);
  };
  const altura = (t: number) => Math.sin(PI * (0.04 + 0.92 * t)) ** 0.45 * lerp(0.84, 1, suave(0.05, 0.5, t)) * lerp(1, 0.78, suave(0.72, 1, t));
  const largura = (t: number) => Math.sin(PI * (0.03 + 0.94 * t)) ** 0.38 * lerp(1, 0.86, suave(0.55, 1, t));
  const EXP = 2.3;
  out.push(parte(corpo({
    x0, x1, n: 36, m: 36, exp: EXP, cor: pele,
    perfil: (t) => ({ ry: (H / 2) * altura(t), rz: (W / 2) * largura(t), cy: H / 2 }),
    mod: (t, a) => {
      const topo = Math.max(0, Math.cos(a));
      // dois lobos de peito com o sulco do esterno no meio
      const lobos = 0.08 * topo * Math.abs(Math.sin(a)) ** 0.7 * Math.sin(PI * t);
      const quilha = 0.045 * Math.exp(-(a * a) / 0.025) * Math.sin(PI * t) * (magro ? 1.7 : 1);
      return 1 + lobos - quilha;
    },
    desloc: (p) => { if (p.y < H * 0.16) p.y = H * 0.16 - (H * 0.16 - p.y) * 0.35; },
  }), k.ac, true));

  // superfície lateral do corpo (sem os lobos), para encostar coxas e asas
  const ladoZ = (x: number, y: number) => {
    const t = clamp((x - x0) / Lb);
    const ry = (H / 2) * altura(t), rz = (W / 2) * largura(t);
    const v = clamp(Math.abs(y - H / 2) / Math.max(1e-6, ry), 0, 0.999);
    return rz * (1 - v ** EXP) ** (1 / EXP);
  };

  for (const sg of [-1, 1]) {
    // sobrecoxa: bojo grande no flanco de trás
    const xs = x0 + Lb * 0.3, ys = H * 0.5;
    const zs = ladoZ(xs, ys) * 0.82;
    const sob = elipsoide(Lb * 0.23, H * 0.3, W * 0.2, pele, 12, 16);
    tf(sob, [xs, ys, sg * zs], [0, sg * 0.35, 0.15]);
    out.push(parte(sob, k.ac));
    // coxa (baqueta) apontando para trás e para cima, pontas quase se cruzando na cavidade
    const p0 = V(x0 + Lb * 0.36, H * 0.56, sg * zs * 1.02);
    const p1 = V(x0 + Lb * 0.14, H * 0.72, sg * zs * 0.95);
    const p2 = V(x0 - T * 0.02, H * 0.84, sg * W * 0.2);
    const p3 = V(x0 - T * 0.06, H * 0.86, sg * W * 0.1);
    const grossa = k.tem('coxagrossa') ? 1.15 : 1;
    out.push(parte(tubo([p0, p1, p2, p3], {
      raio: (t) => W * grossa * (0.15 * (1 - suave(0.05, 0.8, t)) + 0.045 + 0.022 * suave(0.85, 1, t)) * (magro ? 0.9 : 1),
      m: 14, n: 20,
      cor: (x, y, z, t) => mix(pele(x, y, z, t, 0), [0.93, 0.86, 0.72], suave(0.84, 0.93, t)),
    }), k.ac));
    // asa dobrada rente ao corpo: braço para trás, antebraço para a frente, ponta embaixo
    const asa = k.tem('asagrande') ? 1.15 : 1;
    const pa = (fx: number, fy: number, folga: number) => {
      const x = x1 - Lb * fx, y = H * fy;
      return V(x, y, sg * (ladoZ(x, y) + W * folga));
    };
    out.push(parte(tubo([pa(0.1, 0.55, -0.02), pa(0.3, 0.42, 0.03), pa(0.42, 0.3, 0.04), pa(0.3, 0.2, 0.05), pa(0.1, 0.16, 0.04), pa(0.02, 0.12, 0.0)], {
      raio: (t) => W * 0.055 * asa * (t < 0.4 ? 1.25 : lerp(1.1, 0.55, (t - 0.4) / 0.6)) * (1 + 0.25 * Math.exp(-((t - 0.42) ** 2) / 0.004)),
      achata: 1.8, cima: V(0, 0, sg), m: 12, n: 30, cor: pele,
    }), k.ac));
  }
  // pescoço cortado com a pele frouxa e o sobrecu embaixo, atrás
  out.push(parte(tubo([V(x1 - Lb * 0.06, H * 0.48, 0), V(x1 + T * 0.03, H * 0.42, 0), V(x1 + T * 0.06, H * 0.38, 0)], {
    raio: (t) => W * lerp(0.13, 0.1, t), m: 14, n: 8,
    cor: (x, y, z, t) => mix(pele(x, y, z, t, 0), mul(ci, 0.85), suave(0.75, 1, t)),
  }), k.ac));
  out.push(parte(tf(elipsoide(Lb * 0.07, H * 0.1, W * 0.09, pele, 6, 10), [x0 + Lb * 0.01, H * 0.24, 0], [0, 0, -0.4]), k.ac));
  void c1; void s;
  return out;
};

/** Coelho limpo, deitado, com patas traseiras longas e dianteiras curtas. */
function gCoelho(k: Ctx): Parte[] {
  const out: Parte[] = [];
  const T = k.T;
  const Lb = T * 0.62;
  const H = T * k.A, W = T * k.L;
  const x0 = -Lb / 2, x1 = Lb / 2;
  const pele0 = corPeleAve(k, T);
  // carne rosada com a película e o lombo um pouco mais claros
  const pele: CorFn = (x, y, z, t, a) => mix(pele0(x, y, z, t, a), mul(k.c2, 1.02), suave(H * 0.6, H * 0.95, y) * 0.4);
  out.push(parte(corpo({
    x0, x1, n: 34, m: 28, exp: 2.2, cor: pele,
    perfil: (t) => ({ ry: (H / 2) * Math.sin(PI * (0.06 + 0.88 * t)) ** 0.55 * lerp(0.95, 0.72, t), rz: (W / 2) * Math.sin(PI * (0.05 + 0.9 * t)) ** 0.5 * lerp(1, 0.8, t), cy: H / 2 }),
    mod: (t, a) => 1 + 0.04 * Math.abs(Math.sin(t * PI * 9)) * Math.max(0, Math.cos(a)) ** 2,
    desloc: (p) => { if (p.y < H * 0.15) p.y = H * 0.15 - (H * 0.15 - p.y) * 0.4; },
  }), k.ac, true));
  for (const sg of [-1, 1]) {
    const z = sg * W * 0.3;
    // traseira: coxa grossa que afina até o pé, encostada no corpo
    out.push(parte(tubo([V(x0 + Lb * 0.18, H * 0.45, z * 0.9), V(x0 - T * 0.04, H * 0.3, z * 1.05), V(x0 - T * 0.14, H * 0.14, z * 0.8), V(-T / 2, H * 0.1, z * 0.6)], { raio: (t) => W * lerp(0.24, 0.06, t ** 0.7), m: 12, n: 18, cor: pele }), k.ac));
    // dianteira curta dobrada para a frente
    out.push(parte(tubo([V(x1 - Lb * 0.16, H * 0.35, z * 0.85), V(x1 + T * 0.02, H * 0.2, z * 0.9), V(T * 0.45, H * 0.1, z * 0.6)], { raio: (t) => W * lerp(0.12, 0.045, t), m: 10, n: 12, cor: pele }), k.ac));
  }
  out.push(parte(tubo([V(x1 - Lb * 0.04, H * 0.5, 0), V(x1 + T * 0.05, H * 0.44, 0)], { raio: W * 0.17, m: 12, n: 6, cor: (x, y, z, t) => mix(pele(x, y, z, t, 0), mul(k.ci, 0.85), suave(0.6, 1, t)) }), k.ac));
  return out;
}

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
    // sobrecoxa larga e achatada em -X, com a coxa em baqueta saindo dela para +X e a junta de osso na ponta
    const xj = -L * 0.06;
    const corS: CorFn = (x, y, z, t, a) => mix(pele(x, y, z, t, a), mul(c2, 1.04), (1 - suave(L * 0.008, L * 0.03, Math.abs(x - xj))) * 0.75);
    const sob = elipsoide(L * 0.27, H * 0.42, W * 0.5, corS, 14, 20, (t, a) => 1 + 0.06 * fbm(t * 3, Math.cos(a) * 1.4, Math.sin(a) * 1.4, s));
    tf(sob, [-L * 0.22, H * 0.42, 0], [0, 0.12, 0]);
    out.push(parte(sob, k.ac, true));
    out.push(parte(tubo([V(-L * 0.12, H * 0.48, 0), V(L * 0.1, H * 0.46, W * 0.03), V(L * 0.3, H * 0.38, W * 0.02), V(L * 0.47, H * 0.3, 0)], {
      raio: (t) => H * (0.36 * Math.sin(PI * clamp(t / 0.82) ** 0.75) ** 0.8 * (1 - suave(0.6, 0.85, t)) + 0.1 + 0.07 * suave(0.9, 1, t)),
      m: 16, n: 26,
      cor: (x, y, z, t) => mix(corS(x, y, z, t, 0), OSSO, suave(0.86, 0.93, t)),
    }), k.ac, true));
    return out;
  }
  if (v === 'asa') {
    // três segmentos em zigue-zague: coxinha da asa, meio achatado e ponta
    const pA = V(-L / 2 + L * 0.05, H * 0.42, -L * 0.16), pB = V(-L * 0.12, H * 0.44, L * 0.16);
    const pC = V(L * 0.24, H * 0.36, -L * 0.1), pD = V(L / 2 - L * 0.02, H * 0.28, L * 0.1);
    out.push(parte(tubo([pA, pA.clone().lerp(pB, 0.5).add(V(0, H * 0.04, 0)), pB], {
      raio: (t) => H * (0.4 * Math.sin(PI * (0.22 + 0.6 * t)) ** 0.8 + 0.12 * suave(0.85, 1, t)), m: 14, n: 16, cor: pele,
    }), k.ac, true));
    out.push(parte(tubo([pB.clone().lerp(pA, 0.06), pB.clone().lerp(pC, 0.5).add(V(0, H * 0.03, 0)), pC], {
      raio: (t) => H * (0.27 + 0.04 * Math.sin(PI * t)) * (1 - 0.15 * suave(0.85, 1, t)), achata: 1.8, cima: V(0, 1, 0), m: 14, n: 16, cor: pele,
    }), k.ac, true));
    out.push(parte(tubo([pC.clone().lerp(pB, 0.05), pC.clone().lerp(pD, 0.5).add(V(0, H * 0.02, 0)), pD], {
      raio: (t) => H * lerp(0.2, 0.05, t ** 0.8), achata: 1.6, cima: V(0, 1, 0), m: 10, n: 12, cor: pele,
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

/**
 * Leva um ponto de seção elíptica (anéis com ângulos uniformes) para a seção de
 * caixa arredondada, mantendo o ruído do raio. Assim as faces planas recebem
 * vértices espalhados por igual, e o marmoreio e as camadas aparecem nelas.
 */
function quadrar(p: THREE.Vector3, a: number, cy: number, ry: number, rz: number, cz: number, ex: number) {
  // fator de ruído/escala já aplicado ao anel (norma elíptica do ponto)
  const m = Math.hypot((p.y - cy) / ry, (p.z - cz) / rz);
  if (m < 1e-9) return;
  // canto proporcional ao expoente: 5 dá cantos pequenos, 3.5 mais redondos
  const rc = Math.min(ry, rz) * clamp(1.6 / ex, 0.15, 0.6);
  const [y, z] = retArredondado(a, ry, rz, rc);
  p.y = cy + y * m;
  p.z = cz + z * m;
}

/**
 * Ponto do contorno de um retângulo de cantos redondos, andando por comprimento de arco
 * a partir do meio da face de cima (ângulo 0) em direção a +Z.
 */
function retArredondado(a: number, ry: number, rz: number, rc: number): [number, number] {
  const sy = ry - rc, sz = rz - rc, q = (PI / 2) * rc;
  const segs = [sz, q, 2 * sy, q, 2 * sz, q, 2 * sy, q, sz];
  const P = segs.reduce((x, y) => x + y, 0);
  let d = (((a / TAU) % 1) + 1) % 1 * P;
  let i = 0;
  while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
  const f = segs[i] > 0 ? d / segs[i] : 0;
  const arco = (cyc: number, czc: number, a0: number): [number, number] => {
    const th = a0 - f * (PI / 2);
    return [cyc + rc * Math.sin(th), czc + rc * Math.cos(th)];
  };
  switch (i) {
    case 0: return [ry, f * sz];
    case 1: return arco(sy, sz, PI / 2);
    case 2: return [sy - f * 2 * sy, rz];
    case 3: return arco(-sy, sz, 0);
    case 4: return [-ry, sz - f * 2 * sz];
    case 5: return arco(-sy, -sz, -PI / 2);
    case 6: return [-sy + f * 2 * sy, -rz];
    case 7: return arco(sy, -sz, -PI);
    default: return [ry, -sz + f * sz];
  }
}

export const gCarne: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corCarne(k, { topo: H, L });
  const corCorte = corCarne({ ...k, tem: (w: string) => k.tem(w) && w !== 'pele' && w !== 'fibras' } as Ctx, { topo: H, L });
  const irr = k.tem('irregular') ? 0.12 : v === 'cilindro' ? 0.07 : 0.04;
  if (v === 'bloco' || v === 'achatado') {
    const perfilB = (t: number) => {
      const ch = 1 - 0.1 * (1 - suave(0, 0.06, Math.min(t, 1 - t)));
      const larg = 1 + (k.tem('cunha') ? 0.25 * (t - 0.5) : 0);
      return { ry: (H / 2) * ch * (1 + (k.tem('cunha') ? -0.3 * (t - 0.5) : 0)), rz: (W / 2) * ch * larg, cy: H / 2 };
    };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 48, m: 52, tampa: true, aneisTampa: 6, cor, corTampa: corCorte,
      perfil: perfilB,
      mod: (t, a) => 1 + irr * fbm(t * 5, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s),
      desloc: (p, t, a) => {
        const q = perfilB(t);
        quadrar(p, a, H / 2, q.ry, q.rz, 0, v === 'achatado' ? 3.5 : 5);
        if (p.y < 0) p.y *= 0.3;
      },
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
    if (k.tem('cordao')) {
      // cordão: músculo fino colado na lateral, mais gordo e irregular, afinando nas pontas
      const corC: CorFn = (x, y, z, t, a) => mul(cor(x, y, z, t, a), 0.94);
      out.push(parte(tubo([V(-L * 0.44, H * 0.5, W * 0.34), V(-L * 0.15, H * 0.55, W * 0.4), V(L * 0.1, H * 0.5, W * 0.38), V(L * 0.3, H * 0.42, W * 0.26)], {
        raio: (t) => H * 0.2 * Math.sin(PI * (0.08 + 0.84 * t)) ** 0.5 * (1 + 0.12 * Math.sin(t * 17)), m: 10, n: 22, cor: corC,
      }), k.ac));
    }
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
    out.push(parte(osso([V(L * 0.24, H * 0.22, 0), V(L * 0.34, H * 0.2, 0), V(L * 0.4, H * 0.18, 0)], H * 0.1, OSSO, 1.5), 'acetinado'));
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
/* peças com costelas: olho de carne deitado e as costelas em arco      */
/* ------------------------------------------------------------------ */

export interface OpcCostelas {
  /** Comprimento (X), altura e largura do olho de carne. */
  L: number; H: number; W: number;
  /** Número de costelas. */
  n: number;
  /** Quanto as costelas avançam à frente do olho (Z) e quanto a ponta sobe acima do topo dele. */
  aba: number; sobe: number;
  /** Fração final do osso limpa, sem carne (carré limpo ~0.5; costela de açougue ~0.15). */
  limpo: number;
  /** Meia largura do osso (em X) e espessura da aba de carne entre os ossos. */
  rOsso: number; esp: number;
  fora: CorFn; corte: CorFn; aba2: CorFn; osso: CorFn;
  s: number;
}

/**
 * Peça com costelas (costela bovina, lombo de porco, carré e lombo de cordeiro): o olho de carne
 * deitado na frente e, saindo dele por trás, a parede de costelas que sobe e se curva para trás:
 * arcos curtos e paralelos com a carne entre eles e a ponta do osso aparente. Só o olho toca a tábua.
 */
export function pecaCostelas(o: OpcCostelas): { carne: THREE.BufferGeometry[]; ossos: THREE.BufferGeometry[] } {
  const { L, H, W, n } = o;
  const zc = o.aba * 0.4;
  const carne: THREE.BufferGeometry[] = [];
  const ponta = (t: number) => 1 - 0.07 * (1 - suave(0, 0.06, Math.min(t, 1 - t)));
  carne.push(corpo({
    x0: -L / 2, x1: L / 2, n: 16, m: 26, exp: 2.5, tampa: true, aneisTampa: 5, cor: o.fora, corTampa: o.corte,
    perfil: (t) => ({ ry: (H / 2) * ponta(t), rz: (W / 2) * ponta(t), cy: H / 2, cz: zc }),
    mod: (t, a) => 1 + 0.035 * fbm(t * 5, Math.cos(a) * 1.4, Math.sin(a) * 1.4, o.s),
    desloc: (p) => { const lim = H * 0.22; if (p.y < lim) p.y = lim - (lim - p.y) * 0.3; },
  }));
  // arco das costelas no plano YZ (Bézier quadrática): sai de dentro do olho pelo lado de trás,
  // sobe rente a ele e se curva para trás; de frente se vê a parede de ossos paralelos
  const P0: [number, number] = [H * 0.35, zc - W * 0.18];
  const P1: [number, number] = [H * 0.95 + o.sobe * 0.75, zc - W * 0.36];
  const P2: [number, number] = [H + o.sobe, zc - W * 0.36 - o.aba];
  const B = (s: number): [number, number] => {
    const u = 1 - s;
    return [u * u * P0[0] + 2 * u * s * P1[0] + s * s * P2[0], u * u * P0[1] + 2 * u * s * P1[1] + s * s * P2[1]];
  };
  const T = (s: number): [number, number] => {
    const ty = 2 * (1 - s) * (P1[0] - P0[0]) + 2 * s * (P2[0] - P1[0]);
    const tz = 2 * (1 - s) * (P1[1] - P0[1]) + 2 * s * (P2[1] - P1[1]);
    const l = Math.hypot(ty, tz) || 1;
    return [ty / l, tz / l];
  };
  const xs = Array.from({ length: n }, (_, i) => lerp(-L / 2, L / 2, (i + 0.5) / n));
  const vale = (x: number) => {
    const q = ((x + L / 2) / L) * n - 0.5;
    return Math.abs(q - Math.round(q));
  };
  // aba de carne entre os ossos: placa fina que segue o arco, mais fina entre um osso e outro
  const sMax = 1 - o.limpo;
  carne.push(corpo({
    x0: -L / 2 + o.rOsso * 0.2, x1: L / 2 - o.rOsso * 0.2, n: Math.max(14, n * 5), m: 18, exp: 2.4, tampa: true, linear: true, cor: o.aba2, corTampa: o.aba2,
    perfil: () => ({ ry: o.esp / 2, rz: 0.5, cy: 0, cz: 0 }),
    desloc: (p) => {
      const s = clamp(p.z + 0.5, 0, 1) * sMax;
      const [by, bz] = B(s);
      const [ty, tz] = T(s);
      const off = p.y * (1 - 0.35 * suave(0.12, 0.5, vale(p.x))) * lerp(1.15, 0.7, s / Math.max(0.01, sMax));
      p.y = by + tz * off;
      p.z = bz - ty * off;
    },
  }));
  const ossos: THREE.BufferGeometry[] = [];
  for (const x of xs) {
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 6; j++) {
      const [by, bz] = B(lerp(0.06, 1, j / 6));
      pts.push(V(x, by, bz));
    }
    ossos.push(tubo(pts, {
      raio: (t) => o.rOsso * (1 + 0.2 * suave(0.88, 1, t)), achata: clamp((o.esp * 0.62) / o.rOsso, 0.45, 1.6), cima: V(1, 0, 0), m: 10, n: 16, cor: o.osso,
    }));
  }
  return { carne, ossos };
}

/**
 * Placa de costelinhas (costela de porco em ripa): carne chata com os ossos paralelos atravessando
 * a largura, marcados em relevo no topo e com as pontas aparecendo nas duas bordas.
 */
export function placaCostelas(L: number, W: number, esp: number, n: number, carne: CorFn, osso: CorFn, s: number): THREE.BufferGeometry[] {
  const xs = Array.from({ length: n }, (_, i) => lerp(-L / 2, L / 2, (i + 0.5) / n));
  const vale = (x: number) => {
    const q = ((x + L / 2) / L) * n - 0.5;
    return Math.abs(q - Math.round(q));
  };
  const out: THREE.BufferGeometry[] = [];
  // no lado dos ossos a película é fina: os ossos aparecem como listras claras sob ela
  const listrada: CorFn = (x, y, z, t, a) => mix(carne(x, y, z, t, a), mix(osso(x, y, z, t, a), carne(x, y, z, t, a), 0.35), (1 - suave(0.1, 0.2, vale(x))) * suave(esp * 0.6, esp * 0.9, y) * suave(W * 0.5, W * 0.3, Math.abs(z)));
  out.push(corpo({
    x0: -L / 2, x1: L / 2, n: Math.max(16, n * 5), m: 22, exp: 3.2, tampa: true, linear: true, cor: listrada, corTampa: carne,
    // a ripa afina numa das bordas (a ponta da costela) e engrossa na outra (o lombo)
    perfil: () => ({ ry: esp / 2, rz: W / 2, cy: esp / 2 }),
    mod: (t, a) => 1 + 0.05 * fbm(t * 8, Math.cos(a), Math.sin(a), s),
    desloc: (p) => {
      const zz = p.z / (W / 2);
      const fino = lerp(1.15, 0.75, (zz + 1) / 2);
      if (p.y > esp / 2) p.y = esp / 2 + (p.y - esp / 2) * fino * (1 - 0.4 * suave(0.12, 0.5, vale(p.x)));
      else p.y = esp / 2 - (esp / 2 - p.y) * 0.6;
    },
  }));
  for (const x of xs) {
    // osso chato e largo, quase todo dentro da carne: só o dorso aparece em relevo e a ponta sai na borda fina
    const pts = [V(x, esp * 0.5, -W / 2 + esp * 0.4), V(x + esp * 0.1, esp * 0.82, -W * 0.2), V(x + esp * 0.15, esp * 0.8, W * 0.2), V(x + esp * 0.2, esp * 0.5, W / 2 + esp * 0.45)];
    out.push(tubo(pts, { raio: (t) => esp * 0.5 * lerp(1.1, 0.8, t), achata: 0.5, cima: V(1, 0, 0), m: 8, n: 12, cor: osso }));
  }
  return out;
}

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
  const blocoCarne = (x0: number, x1: number, ry: number, rz: number, cy: number, cz = 0, ex = 3.5, corF: CorFn = cor) => corpo({
    x0, x1, n: 32, m: 44, tampa: true, cor: corF, corTampa: corCarne({ ...k, tem: (w: string) => k.tem(w) && w !== 'pele' } as Ctx, { topo: H, L }),
    perfil: (t) => { const ch = 1 - 0.08 * (1 - suave(0, 0.06, Math.min(t, 1 - t))); return { ry: ry * ch, rz: rz * ch, cy, cz }; },
    mod: (t, a) => 1 + 0.04 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
    desloc: (p, t, a) => { const ch = 1 - 0.08 * (1 - suave(0, 0.06, Math.min(t, 1 - t))); quadrar(p, a, cy, ry * ch, rz * ch, cz, ex); },
  });
  switch (v) {
    case 'costela': {
      // costela bovina e lombo de porco já desossados: peça deitada, capa de gordura em cima,
      // o olho de carne aparece nas pontas cortadas (os ossos ficam nas peças "com ossos")
      // a capa é aparada: gordura fina e creme, com a carne aparecendo por baixo em manchas
      const semCapa = corCarne({ ...k, tem: (w: string) => k.tem(w) && w !== 'capa' } as Ctx, { topo: H, L });
      const corC: CorFn = (x, y, z, t, a) => {
        const c = semCapa(x, y, z, t, a);
        const capa = suave(H * 0.8, H * 0.9, y + H * 0.06 * fbm(x * 18 / L, 0, z * 18 / L, s));
        const fina = 0.3 + 0.4 * suave(-0.3, 0.4, fbm(x * 30 / L, y * 30 / L, z * 30 / L, s + 3));
        return mix(c, mul(c2, 0.92 + 0.08 * fbm(x * 90, y * 90, z * 90, s)), capa * fina);
      };
      out.push(parte(blocoCarne(-L / 2, L / 2, H * 0.48, W * 0.46, H * 0.5, 0, 3.2, corC), k.ac, true));
      return out;
    }
    case 'costelinha': {
      // ripa de costelinha: placa chata com os ossos paralelos aparentes
      const crua = corCarne(k, { topo: H, L });
      const corO: CorFn = (x, y, z) => mul(corOsso, 0.9 + 0.1 * fbm(x * 300, y * 300, z * 300, s));
      const corP: CorFn = (x, y, z, t, a) => mix(crua(x, y, z, t, a), c2, (1 - suave(0.1, 0.24, celula(x * 90, y * 90, z * 90, s))) * 0.25);
      placaCostelas(L, W, Math.max(0.014, H * 0.5), n, corP, corO, s).forEach((g, i) => out.push(parte(g, i ? 'acetinado' : k.ac, i === 0)));
      return out;
    }
    case 'lombo_osso': {
      const fino = false as boolean;
      out.push(parte(blocoCarne(-L / 2, L / 2, H * (fino ? 0.35 : 0.48), W * 0.42, H * (fino ? 0.35 : 0.5), -W * 0.05), k.ac, true));
      for (let i = 0; i < n; i++) {
        const x = lerp(-L / 2 + L * 0.06, L / 2 - L * 0.06, i / Math.max(1, n - 1));
        const yb = fino ? H * 0.35 : H * 0.14;
        const pts = v === 'lombo_osso'
          ? [V(x, H * 0.12, W * 0.2), V(x + L * 0.005, H * 0.4, W * 0.33), V(x + L * 0.01, H * 0.7, W * 0.34)]
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
        out.push(parte(osso([V(x, H * 0.18, -W * 0.6), V(x + L * 0.01, H * 0.14, 0), V(x + L * 0.02, H * 0.18, W * 0.58)], H * 0.1, corOsso, 1.1), 'acetinado'));
      }
      out.push(parte(osso([V(-L * 0.46, H * 0.1, -W * 0.42), V(L * 0.46, H * 0.1, -W * 0.42)], H * 0.1, [0.92, 0.9, 0.84], 1.1), 'acetinado'));
      return out;
    }
    case 'carre': case 'guarda': case 'coroa': {
      const rack = (sx: number): THREE.BufferGeometry[] => {
        const gs: THREE.BufferGeometry[] = [];
        // lombo em meia-lua, chato embaixo, com a capa de gordura no lado de fora da curva dos ossos
        const Rl = H * 0.36;
        const corR = corCarne(k, { topo: Rl * 2.15, L });
        gs.push(corpo({
          x0: -L / 2, x1: L / 2, n: 20, m: 30, tampa: true, aneisTampa: 5, cor: corR,
          corTampa: (x, y, z) => mix(mul(ci, 0.9 + 0.1 * fbm(x * 90, y * 90, z * 90, s)), c2, suave(Rl * 0.72, Rl * 0.92, Math.hypot(y - Rl, z - sx * Rl * 0.15))),
          perfil: () => ({ ry: Rl, rz: Rl * 1.25, cy: Rl }),
          mod: (t, a) => 1 + 0.12 * Math.max(0, Math.cos(a + sx * 0.7)) ** 2 - 0.1 * Math.max(0, -Math.cos(a)) ** 3,
          desloc: (p) => { if (p.y < Rl * 0.25) p.y = Rl * 0.25 - (Rl * 0.25 - p.y) * 0.35; },
        }));
        for (let i = 0; i < n; i++) {
          const x = lerp(-L / 2 + L * 0.07, L / 2 - L * 0.07, i / Math.max(1, n - 1));
          gs.push(tubo([V(x, Rl * 1.1, sx * Rl * 0.3), V(x, Rl * 1.85, sx * W * 0.4), V(x, H * 1.08, sx * W * 0.8), V(x, H * 1.18, sx * W * 1.02)], {
            raio: (t) => H * 0.06 * (1 + 0.35 * suave(0.85, 1, t)), achata: 1.5, cima: V(0, 0, 1), m: 8, n: 12,
            cor: (px, py, pz) => mul(corOsso, 1 + 0.07 * ruido(px * 300, py * 300, pz * 300)),
          }));
        }
        return gs;
      };
      if (v === 'carre') {
        // carré limpo: olho rosado com capa de gordura e as costelas em arco, com metade do osso raspada
        const Hc = Math.min(H * 0.55, 0.058), Wc = Math.min(W * 0.62, 0.062), abaC = W * 0.45, zC = abaC * 0.4;
        const capa: CorFn = (x, y, z) => mul(c2, 0.95 + 0.08 * fbm(x * 120, y * 120, z * 120, s));
        const crua: CorFn = (x, y, z, t, a) => mix(cor(x, y, z, t, a), capa(x, y, z, t, a), 0.85 * suave(Hc * 0.72, Hc * 0.92, y + Hc * 0.08 * fbm(x * 50, 0, z * 50, s)));
        const corte: CorFn = (x, y, z) => {
          const olho = Math.hypot((y - Hc * 0.42) / (Hc * 0.32), (z - zC - Wc * 0.1) / (Wc * 0.34));
          const c = mul(ci, 0.9 + 0.12 * fbm(y * 300, z * 300, x, s));
          return mix(c, capa(x, y, z, 0, 0), Math.max(suave(1, 1.15, olho) * 0.85, suave(Hc * 0.72, Hc * 0.86, y)));
        };
        const corO: CorFn = (x, y, z) => mul(corOsso, 0.92 + 0.1 * fbm(x * 300, y * 300, z * 300, s));
        const { carne, ossos } = pecaCostelas({
          L, H: Hc, W: Wc, n, aba: abaC, sobe: Hc * 0.55, limpo: 0.55, rOsso: Math.min(0.0055, L / n * 0.22), esp: 0.011,
          fora: crua, corte, aba2: (x, y, z, t, a) => mix(cor(x, y, z, t, a), capa(x, y, z, t, a), 0.45 * suave(-0.2, 0.5, fbm(x * 80, y * 80, z * 80, s))), osso: corO, s,
        });
        carne.forEach((g, i) => out.push(parte(g, k.ac, i === 0)));
        for (const g of ossos) out.push(parte(g, 'acetinado'));
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
          out.push(parte(osso([d.clone().multiplyScalar(Rc).setY(Hc * 0.6), d.clone().multiplyScalar(Rc * 1.05).setY(Hc * 1.4), d.clone().multiplyScalar(Rc * 1.2).setY(H)], H * 0.05, corOsso, 1.3), 'acetinado'));
        }
      }
      return out;
    }
    case 'costeleta': {
      // costeleta de cordeiro deitada: a noz de carne (olho) rosada, uma faixa fina de gordura só no
      // lado de fora, a aba de carne que afina ao longo do osso e o osso limpo curto saindo uns 4 cm
      const e = Math.max(0.014, H), Wn = Math.min(W * 1.05, 0.06);
      const Ln = L * 0.42, xFimCarne = -L / 2 + L * 0.62, xFim = -L / 2 + L * 0.88;
      const xOsso = -L / 2 + Ln * 0.7, zOsso = Wn * 0.26;
      const capa: CorFn = (x, y, z) => mul(c2, 0.92 + 0.08 * fbm(x * 150, y * 150, z * 150, s));
      const olho = (x: number, z: number) => Math.hypot((x + L / 2 - Ln * 0.5) / (Ln * 0.4), (z + Wn * 0.04) / (Wn * 0.36));
      const face: CorFn = (x, y, z) => {
        const c = mul(ci, 0.88 + 0.14 * fbm(x * 260, z * 260, y * 10, s));
        const veio = (1 - suave(0, 0.06, Math.abs(fbm(x * 120, z * 120, 0, s + 3)))) * 0.2;
        // fora do olho: carne da aba um pouco mais escura; gordura só na borda de fora (z negativo)
        const fora = suave(1, 1.1, olho(x, z));
        let cc = mix(mix(c, capa(x, y, z, 0, 0), veio), mul(ci, 0.78), fora * 0.6);
        cc = mix(cc, capa(x, y, z, 0, 0), fora * suave(-Wn * 0.1, -Wn * 0.3, z) * 0.9);
        return cc;
      };
      const contorno = (t: number) => (t < 0.45 ? Math.sqrt(Math.max(0.0004, 1 - ((0.45 - t) / 0.45) ** 2)) : lerp(1, 0.42, suave(0.45, 1, t)));
      out.push(parte(corpo({
        x0: -L / 2, x1: xFimCarne, n: 20, m: 30, exp: 3.4,
        cor: (x, y, z, t, a) => (y > e * 0.8 ? face(x, y, z, t, a) : mix(mul(face(x, y, z, t, a), 0.85), capa(x, y, z, t, a), suave(-Wn * 0.1, -Wn * 0.3, z) * 0.7)),
        perfil: (t) => ({ ry: (e / 2) * lerp(1, 0.75, suave(0.5, 1, t)), rz: (Wn / 2) * contorno(t), cy: e / 2, cz: lerp(-Wn * 0.02, zOsso * 0.9, suave(0.35, 1, t)) }),
        mod: (t, a) => 1 + 0.05 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
        desloc: (p) => { if (p.y < e * 0.15) p.y = e * 0.15 - (e * 0.15 - p.y) * 0.3; if (p.y > e * 0.85) p.y = e * 0.85 + (p.y - e * 0.85) * 0.4; },
      }), k.ac, true));
      // osso da costela: começa dentro da noz e sai limpo pela ponta da aba
      out.push(parte(tubo([V(xOsso, e * 0.5, zOsso * 0.6), V(lerp(xOsso, xFim, 0.45), e * 0.52, zOsso * 0.9), V(xFim - 0.004, e * 0.5, zOsso), V(xFim, e * 0.5, zOsso * 1.02)], {
        raio: (t) => 0.006 * (1 + 0.22 * suave(0.85, 1, t)), achata: 0.75, cima: V(0, 1, 0), m: 10, n: 14,
        cor: (x, y, z) => mul(corOsso, 0.92 + 0.1 * fbm(x * 300, y * 300, z * 300, s)),
      }), 'acetinado'));
      return out;
    }
    case 'bife': {
      // bife deitado com osso de costela numa borda
      const cab = false as boolean;
      const Lc = cab ? L * 0.45 : L;
      const corB: CorFn = (x, y, z) => {
        const r = Math.hypot(x / (Lc / 2), z / (W / 2)); // cor calculada antes de mover o disco
        // capa de gordura só na borda de trás; o osso fica na borda da frente
        const lado = cab ? 1 : suave(W * 0.15, -W * 0.05, z);
        const c = mix(cor(x, y * 0.2, z, 0, 0), c2, suave(0.8, 0.9, r) * lado * (k.tem('borda') ? 1 : 0));
        if (cab) return c;
        // osso da costela reto ao longo da borda, rente às duas faces
        const zb = W * 0.33 - L * 0.04 * (x / (L * 0.4)) ** 2;
        const dOsso = Math.hypot((z - zb) / (W * 0.05), Math.max(0, Math.abs(x) - L * 0.24) / (W * 0.06));
        return mix(c, mul(corOsso, 1 + 0.06 * ruido(x * 200, y * 200, z * 200)), 1 - suave(0.8, 1.2, dOsso));
      };
      const g = disco(Lc / 2, H, corB, { n: 34, m: 52, borda: 0.3, l: W / Lc, mod: (t, a) => 1 + 0.06 * fbm(Math.cos(a), Math.sin(a), t, s) });
      g.translate(cab ? -L / 2 + Lc / 2 : 0, 0, 0);
      out.push(parte(g, k.ac, true));
      if (cab) out.push(parte(osso([V(-L / 2 + Lc * 0.8, H * 0.5, 0), V(L * 0.1, H * 0.55, W * 0.05), V(L / 2, H * 0.5, W * 0.04)], H * 0.18, corOsso, 1.3), 'acetinado'));
      else out.push(parte(osso([V(-L * 0.26, H * 0.55, W * 0.34), V(0, H * 0.6, W * 0.37), V(L * 0.26, H * 0.55, W * 0.33)], H * 0.32, corOsso, 1.6), 'acetinado'));
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
          return mix(cor(px, py, pz, 0, 0), c2, suave(0.85, 0.97, r) * 0.2 + suave(0.4, 0.9, fbm(px * 90, py * 90, pz * 90, s)) * 0.12);
        };
        out.push(parte(corpo({ x0: x, x1: x + esp, n: 6, m: 24, tampa: true, cor: corR, corTampa: corR, perfil: () => ({ ry: R, rz: R * 1.05, cy: R }), mod: (t, a) => 1 + 0.1 * Math.abs(Math.cos(a * 2)) ** 3 }), k.ac, true));
        x += L / ns;
      }
      return out;
    }
    case 'sela': {
      // sela: os dois lombos unidos pela espinha, cobertos por uma capa fina de gordura,
      // com o sulco da espinha no meio e as abas dobradas por baixo
      const Hs = H * 0.62;
      const corS: CorFn = (x, y, z) => {
        const c = mix(cor(x, y, z, 0, 0), mul(c2, 0.96 + 0.06 * fbm(x * 50, y * 50, z * 50, s)), suave(Hs * 0.72, Hs * 0.92, y + Hs * 0.08 * fbm(x * 30, 0, z * 30, s)) * 0.75);
        return mix(c, corOsso, (1 - suave(W * 0.02, W * 0.04, Math.abs(z))) * suave(Hs * 0.7, Hs * 0.85, y) * 0.8);
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 30, m: 40, tampa: true, aneisTampa: 5, cor: corS,
        corTampa: (x, y, z) => mix(mix(mul(ci, 0.95), c2, suave(Hs * 0.62, Hs * 0.8, y)), corOsso, 1 - suave(W * 0.04, W * 0.07, Math.hypot(z, y - Hs * 0.55))),
        perfil: (t) => { const ch = 1 - 0.08 * (1 - suave(0, 0.06, Math.min(t, 1 - t))); return { ry: (Hs / 2) * ch, rz: (W / 2) * ch, cy: Hs / 2 }; },
        mod: (t, a) => 1 - 0.12 * Math.exp(-(a * a) / 0.04) + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
        desloc: (p) => { if (p.y < Hs * 0.2) p.y = Hs * 0.2 - (Hs * 0.2 - p.y) * 0.35; },
      }), k.ac, true));
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
  const bola = k.v.v === 'bola';
  // fios de carne moída: sulcos sinuosos escuros, fios mais claros e pontinhos de gordura
  const fq = 1 / Math.max(0.0015, k.T * 0.02);
  const fio = (x: number, y: number, z: number) => {
    const w = fbm(x * fq * 0.35, y * fq * 0.35, z * fq * 0.35, s + 2) * 2.2;
    return Math.abs(Math.sin((x * 0.8 + z * 0.6 + y * 0.4) * fq * 1.1 + w * 3));
  };
  const cor: CorFn = (x, y, z) => {
    const f = fio(x, y, z);
    const gord = 1 - suave(0.08, 0.2, celula(x * fq * 1.6, y * fq * 1.6, z * fq * 1.6, s));
    const c = mul(c1, 0.72 + 0.4 * f ** 0.6 + 0.08 * fbm(x * fq * 0.2, y * fq * 0.2, z * fq * 0.2, s));
    return mix(c, c2, gord * 0.7);
  };
  const g = torno({
    caminho: (u) => {
      // fundo chato e domo por cima
      if (u < 0.2) return [R * 0.97 * (u / 0.2), 0];
      const th = ((u - 0.2) / 0.8) * (PI / 2);
      return [R * Math.cos(th) ** 0.8, H * Math.sin(th)];
    },
    n: 30, m: 44, cor,
    desloc: (p) => {
      // relevo de montinho solto: lombadas suaves mais os sulcos dos fios
      const r = Math.hypot(p.x, p.z);
      const amp = bola ? 0.04 : 0.07;
      const k1 = 1 + amp * fbm(p.x * fq * 0.18, p.y * fq * 0.18, p.z * fq * 0.18, s) + 0.035 * (fio(p.x, p.y, p.z) - 0.5);
      if (r > 1e-6) { p.x *= k1; p.z *= k1; }
      p.y = Math.max(0, p.y * (1 + (k1 - 1) * 0.8));
    },
  });
  const out: Parte[] = [parte(g, k.ac, true)];
  // fiozinhos soltos por cima, como sai do moedor
  if (!bola) {
    for (let i = 0; i < 26; i++) {
      const ang = k.r.f(0, TAU), rr = Math.sqrt(k.r.f(0, 1)) * R * 0.75;
      const cs = Math.min(1, rr / R) ** 1.25;
      const y = H * Math.sqrt(1 - cs * cs) * 0.97;
      const p0 = V(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
      const dir = V(k.r.f(-1, 1), 0, k.r.f(-1, 1)).normalize().multiplyScalar(R * k.r.f(0.12, 0.22));
      const r0 = R * 0.035;
      out.push(parte(tubo([p0, p0.clone().addScaledVector(dir, 0.5).add(V(0, r0 * 0.6, 0)), p0.clone().add(dir)], {
        raio: r0, m: 5, n: 6, cor: (x, yy, z) => mul(c1, 0.85 + 0.3 * ruido(x * fq, yy * fq, z * fq, s)),
      }), k.ac));
    }
  }
  return out;
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
    case 'figado': case 'figado_grande': {
      // lobos lisos e moles, achatados sobre a tábua: centro grosso e arredondado, borda fina,
      // vermelho-amarronzados com reflexo úmido (não cúpulas vermelhas)
      const grande = v === 'figado_grande';
      const base = mix(c1, rgb('#3e1c16'), 0.6);
      const corF: CorFn = (x, y, z) => {
        let c = mix(base, mix(c2, rgb('#2e0e0e'), 0.3), suave(0.25, 0.85, fbm(x * 18 / L, y * 18 / L, z * 18 / L, s)) * 0.45);
        c = mix(c, rgb('#62281e'), suave(0.3, 0.9, fbm(x * 55 / L, y * 55 / L, z * 55 / L, s + 3)) * 0.25);
        // borda fina mais escura e arroxeada; fígado grande com a malha de lóbulos bem leve
        c = mix(c, rgb('#3a1418'), (1 - suave(H * 0.03, H * 0.18, y)) * 0.35);
        if (grande) c = mul(c, 1 - 0.07 * (1 - suave(0.04, 0.1, celula(x * 260, y * 260, z * 260, s))));
        return mul(c, 1 + 0.04 * fbm(x * 400, y * 400, z * 400, s + 5));
      };
      /** Lobo em língua deitado ao longo de +X a partir da origem: seção em lente (bordas finas). */
      const loboF = (len: number, larg: number, esp: number, pico: number, sd: number) => corpo({
        x0: 0, x1: len, n: 24, m: 26, exp: 1.45, cor: corF,
        perfil: (t) => {
          // largo e redondo perto de `pico`, afinando até a ponta
          const env = t < pico ? Math.sin((PI / 2) * (t / pico)) ** 0.55 : Math.cos((PI / 2) * ((t - pico) / (1 - pico))) ** 0.75;
          const e = Math.max(0.02, env);
          return { ry: esp * e ** 0.8, rz: (larg / 2) * e, cy: esp * e ** 0.8 * 0.85 };
        },
        mod: (t, a) => 1 + 0.05 * fbm(t * 3, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s + sd),
        desloc: (p) => { if (p.y < 0) p.y *= 0.12; },
      });
      if (!grande) {
        // fígado de ave: dois lobos unidos por uma ponte, abertos em V
        const A = loboF(L * 0.64, W * 0.78, H * 0.4, 0.36, 0);
        tf(A, [-L * 0.32, 0, W * 0.04], [0, 0.32, 0]);
        const B = loboF(L * 0.52, W * 0.62, H * 0.34, 0.4, 2);
        tf(B, [-L * 0.3, 0, -W * 0.04], [0, -0.42, 0]);
        out.push(parte(A, 'umido', true), parte(B, 'umido', true));
        out.push(parte(tf(elipsoide(L * 0.08, H * 0.22, W * 0.1, corF, 6, 10), [-L * 0.28, H * 0.12, 0]), 'umido'));
        if (k.tem('bile')) out.push(parte(tf(elipsoide(L * 0.035, H * 0.06, W * 0.03, () => c3, 4, 8), [-L * 0.12, H * 0.42, W * 0.12]), 'umido'));
      } else {
        // fígado inteiro de boi, vitela, cordeiro ou porco: lobo grande em cunha e um menor ao lado
        const A = loboF(L * 0.95, W * 0.8, H * 0.5, 0.4, 0);
        tf(A, [-L * 0.47, 0, W * 0.08], [0, 0.1, 0]);
        const B = loboF(L * 0.6, W * 0.6, H * 0.36, 0.45, 2);
        tf(B, [-L * 0.42, 0, -W * 0.12], [0, -0.55, 0]);
        out.push(parte(A, 'umido', true), parte(B, 'umido', true));
      }
      return out;
    }
    case 'rim': {
      // rim de boi/porco em forma de feijão, deitado: liso, marrom-avermelhado e brilhante, com o
      // recôncavo (hilo) do lado de +Z, onde fica a gordura branca e a saída dos vasos
      const curva = W * 0.24;
      const cor: CorFn = (x, y, z) => {
        const lob = k.tem('lobulado') ? 0.06 * (1 - suave(0.04, 0.12, celula(x * 70, y * 70, z * 70, s))) : 0;
        return mul(mix(mul(c1, 1.08), c2, 0.25 + 0.25 * fbm(x * 40, y * 40, z * 40, s)), 1 - lob + 0.04 * fbm(x * 160, y * 160, z * 160, s));
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 26, m: 26, cor,
        perfil: (t) => {
          const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.8;
          return { ry: (H / 2) * e, rz: (W / 2) * e, cy: (H / 2) * e * 0.96 + H * 0.04, cz: curva * (0.5 - Math.sin(PI * t)) };
        },
        // o recôncavo: afunda o lado de +Z no meio do comprimento
        mod: (t, a) => 1 - 0.42 * Math.exp(-((a - PI / 2) ** 2) / 0.35) * Math.exp(-(((t - 0.5) / 0.2) ** 2)),
        desloc: (p) => { if (p.y < H * 0.1) p.y = H * 0.1 - (H * 0.1 - p.y) * 0.3; },
      }), 'umido', true));
      // gordura branca e vasos no recôncavo
      const zH = -curva * 0.5 + W * 0.5 * 0.55;
      const gord: CorFn = (x, y, z) => mul(c3, 0.93 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
      out.push(parte(tf(elipsoide(L * 0.22, H * 0.34, W * 0.2, gord, 8, 12, (t, a) => 1 + 0.12 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, s + 2)), [0, H * 0.48, zH]), 'acetinado'));
      if (k.tem('gordura')) {
        out.push(parte(tubo([V(-L * 0.04, H * 0.5, zH), V(-L * 0.06, H * 0.55, zH + W * 0.14), V(-L * 0.1, H * 0.5, zH + W * 0.22)], { raio: H * 0.07, m: 8, n: 8, cor: (x, y, z) => mix(c3, [0.75, 0.45, 0.42], 0.4) }), 'umido'));
      }
      return out;
    }
    case 'coracao': {
      // em pé, ponta para cima não; deitado com a ponta em +X
      const cor: CorFn = (x, y, z, t) => mix(brilho(x, y, z, t, 0), c3, suave(0.18, 0.08, t) + 0.3 * suave(0.25, 0.9, fbm(x * 60, y * 60, z * 60, s)) * suave(0.4, 0.1, t));
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: 22, cor,
        perfil: (t) => { const e = Math.sin(PI * (0.04 + 0.96 * clamp(t) ** 0.8)) ** 0.55 * 1.02 + 0.01; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
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
      // pé de porco deitado: canela de pele rosada-acinzentada com dobras no tornozelo, que
      // afina e termina nos dois dedos com cascos (unhas) córneos e os dois esporões atrás
      const pele: CorFn = (x, y, z) => {
        const dobra = Math.abs(Math.sin((x + L * 0.08) * 160 + 2 * fbm(y * 40, z * 40, 0, s))) ** 8 * suave(-L * 0.2, 0, x) * suave(L * 0.18, L * 0.02, x);
        const c = mix(mul(c1, 0.97 + 0.08 * fbm(x * 60, y * 60, z * 60, s)), c2, suave(0.3, 0.9, fbm(x * 20, y * 20, z * 20, s)) * 0.35);
        return mul(c, 1 - 0.18 * dobra);
      };
      const xDedo = L * 0.2;
      out.push(parte(corpo({
        x0: -L / 2, x1: xDedo + L * 0.04, n: 26, m: 22, cor: pele, tampa: true, aneisTampa: 3,
        corTampa: (x, y, z) => {
          const r = Math.hypot((y - H / 2) / (H / 2), z / (W / 2));
          return r < 0.42 ? mix(OSSO, TUTANO, 0.3) : mix(k.ci, c1, suave(0.8, 0.95, r));
        },
        perfil: (t) => {
          const tornozelo = 1 + 0.12 * Math.exp(-(((t - 0.55) / 0.1) ** 2));
          return { ry: (H / 2) * lerp(1, 0.68, t) * tornozelo, rz: (W / 2) * lerp(1, 0.82, t) * tornozelo, cy: (H / 2) * lerp(1, 0.68, t) * tornozelo + H * 0.02 };
        },
        mod: (t, a) => 1 + 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), s),
      }), k.ac, true));
      const casco: CorFn = (x, y, z) => mul(mix(c3, [0.45, 0.38, 0.3], suave(xDedo + L * 0.12, L / 2, x) * 0.6), 0.9 + 0.12 * fbm(x * 300, y * 300, z * 300, s));
      for (const sg of [-1, 1]) {
        // dedo com casco: unha arredondada em cima, chata embaixo, separada da outra por uma fenda
        out.push(parte(corpo({
          x0: xDedo, x1: L / 2, n: 12, m: 16, cor: casco,
          perfil: (t) => {
            const e = Math.sqrt(Math.max(0, 1 - t ** 2.2)) * 0.85 + 0.15 * (1 - t);
            return { ry: H * 0.3 * e + H * 0.02, rz: W * 0.22 * e + W * 0.02, cy: H * 0.3 * e * 0.9 + H * 0.04, cz: sg * W * (0.2 + 0.04 * t) };
          },
          desloc: (p) => { if (p.y < H * 0.04) p.y = H * 0.04; },
        }), 'acetinado'));
        // esporão atrás, perto do chão
        out.push(parte(tf(elipsoide(L * 0.035, H * 0.11, W * 0.08, casco, 5, 8), [L * 0.02, H * 0.36, sg * W * 0.3], [0, 0, -0.5]), 'acetinado'));
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
