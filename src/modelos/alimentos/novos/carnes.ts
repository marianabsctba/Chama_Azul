// Alimentos novos do grupo carnes: peças lardeadas, bardeadas e enroladas com barbante,
// rolinhos presos com palito, filé recheado e Wellington fatiados, bifes com pimenta e
// com marcas de grelha, cordeiro em túnel, em massa, em crosta e com alho, espetinhos,
// carne em peritônio, pernis assado e glaceado, linguiças, carne moída moldada, tartare,
// miúdos preparados e as miudezas que o livro serve junto (alcaparras, cornichons,
// lascas de parmesão, gremolada, manteiga temperada, petit tian).
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, osso, type Ctx } from '../pecas';
import type { Acabamento } from '../material';
import { gCarne, gLinguica } from '../fam_carnes';
import {
  OSSO, fr, chapa, placa, fio, laco, espetoMetal, espetoMadeira, corAssada, corFibra, rodela, ctxCom,
} from './aves';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* cores comuns                                                         */
/* ------------------------------------------------------------------ */

const BARB_COZIDO: RGB = rgb('#a8865a');

/** Faixas de toucinho: carne rosada e gordura branca alternadas. */
function toucinho(q: number): RGB {
  const f = fr(q);
  return mix(rgb('#c4586a'), rgb('#f4e8dc'), suave(0.38, 0.52, f) * suave(0.95, 0.82, f) + (f < 0.1 ? 0.6 : 0));
}

/** Carne moída: fios sinuosos, sulcos escuros e pontinhos de gordura. */
function corMoida(c1: RGB, c2: RGB, s: number, esc = 0.003): CorFn {
  const fq = 1 / esc;
  return (x, y, z) => {
    const w = fbm(x * fq * 0.35, y * fq * 0.35, z * fq * 0.35, s + 2) * 2.2;
    const f = Math.abs(Math.sin((x * 0.8 + z * 0.6 + y * 0.4) * fq * 1.1 + w * 3));
    const gord = 1 - suave(0.08, 0.2, celula(x * fq * 1.4, y * fq * 1.4, z * fq * 1.4, s));
    const c = mul(c1, 0.74 + 0.36 * f ** 0.6 + 0.08 * fbm(x * fq * 0.2, y * fq * 0.2, z * fq * 0.2, s));
    return mix(c, c2, gord * 0.65);
  };
}

/** Rede do peritônio: veios claros de gordura em células, sobre a carne. */
function corRede(base: CorFn, veio: RGB, s: number, f = 260): CorFn {
  return (x, y, z, t, a) => {
    const c = celula(x * f, y * f, z * f, s);
    const r = suave(0.72, 0.9, c + 0.15 * fbm(x * f * 0.3, y * f * 0.3, z * f * 0.3, s + 1));
    return mix(base(x, y, z, t, a), mul(veio, 0.95 + 0.1 * ruido(x * f * 3, y * f * 3, z * f * 3, s)), r * 0.85);
  };
}

/* ------------------------------------------------------------------ */
/* rolo de carne amarrado (lagarto, lombo, filé, paleta)                */
/* ------------------------------------------------------------------ */

interface OpcRolo {
  fora: CorFn;
  /** Cor da face cortada nas pontas: rho de 0 (centro) a 1 (borda), ângulo. */
  corte: (rho: number, ang: number, x: number, y: number, z: number) => RGB;
  laços: number;
  longo?: boolean;
  cordao?: RGB;
  ac?: Acabamento;
  /** Achata o rolo embaixo (apoio). */
  apoio?: number;
}

function rolo(k: Ctx, o: OpcRolo): { out: Parte[]; ry: number; rz: number; L: number } {
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ry = H / 2, rz = W / 2;
  const ts = Array.from({ length: o.laços }, (_, i) => 0.09 + (0.82 * i) / Math.max(1, o.laços - 1));
  const aperto = (t: number) => (o.laços ? 1 - 0.05 * Math.max(...ts.map((q) => Math.exp(-(((t - q) / 0.012) ** 2)))) : 1);
  const borda = (t: number) => 1 - 0.1 * (1 - suave(0, 0.05, Math.min(t, 1 - t)));
  const perfil = (t: number) => {
    const b = borda(t) * (1 + 0.03 * Math.sin(t * 11 + k.s));
    return { ry: ry * b, rz: rz * b, cy: ry };
  };
  const corte: CorFn = (x, y, z) => {
    const yy = (y - ry) / ry, zz = z / rz;
    return o.corte(Math.min(1, Math.hypot(yy, zz)), Math.atan2(zz, yy), x, y, z);
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 32, tampa: true, aneisTampa: 6, cor: o.fora, corTampa: corte, perfil,
    mod: (t, a) => aperto(t) * (1 + 0.035 * fbm(t * 6, Math.cos(a) * 1.2, Math.sin(a) * 1.2, k.s)),
    desloc: (p) => { const lim = ry * (o.apoio ?? 0.25); if (p.y < lim) p.y = lim - (lim - p.y) * 0.4; },
  }), o.ac ?? k.ac, true));
  const r = 0.0017;
  for (const t of ts) {
    const b = borda(t) * 0.95;
    for (const g of laco(lerp(-L / 2, L / 2, t), ry, ry * b, rz * b, r, { no: true, cor: o.cordao, n: 20 })) out.push(parte(g, 'fosco'));
  }
  if (o.longo) {
    const pts: THREE.Vector3[] = [];
    const N = 14;
    const yb = Math.max(r, ry - ry * (1 - (o.apoio ?? 0.25)) * 0.6);
    pts.push(V(-L / 2 - r * 2, ry, 0));
    for (let i = 0; i <= N; i++) pts.push(V(lerp(-L / 2, L / 2, i / N), ry * 2 + r * 0.6, 0));
    pts.push(V(L / 2 + r * 2, ry, 0));
    for (let i = N; i >= 0; i--) pts.push(V(lerp(-L / 2, L / 2, i / N), yb, 0));
    out.push(parte(fio(pts, r, { fechado: true, n: 56, cor: o.cordao }), 'fosco'));
  }
  return { out, ry, rz, L };
}

/** Carne crua com fibras e película prateada aqui e ali. */
function foraCrua(k: Ctx, base: RGB, membrana = 0.25): CorFn {
  const fib = corFibra(base, k.s, 0.0035, [0, 0.5, 1]);
  return (x, y, z, t, a) => mix(fib(x, y, z, t, a), rgb('#e0dcd6'), suave(0.45, 0.8, fbm(x * 18, y * 50, z * 50, k.s + 7)) * membrana);
}

/** Face de corte de carne crua, com fibra cortada de topo. */
function corteCru(base: RGB, s: number): (rho: number, ang: number, x: number, y: number, z: number) => RGB {
  return (rho, ang, x, y, z) => mul(base, 0.9 + 0.14 * fbm(y * 120, z * 120, x, s) - 0.06 * (1 - suave(0.1, 0.25, celula(y * 400, z * 400, x, s))));
}

/** Espiral de recheio na face de corte de um rolo. */
const espiral = (rho: number, ang: number, voltas: number) => fr(rho * voltas - ang / TAU);

/* ------------------------------------------------------------------ */
/* lagarto lardeado, bardeado e com toucinho em ziguezague              */
/* ------------------------------------------------------------------ */

const LARDOS: [number, number][] = [[0.35, 0.3], [-0.4, 0.4], [0.05, -0.45], [-0.25, -0.1], [0.5, -0.3], [-0.05, 0.55]];

function lagartoLardeado(k: Ctx): Parte[] {
  const base = k.c1;
  const lado = 0.26;
  const ry = (k.T * k.A) / 2, rz = (k.T * k.L) / 2, L = k.T;
  const { out } = rolo(k, {
    laços: 0, fora: foraCrua(k, base),
    corte: (rho, ang, x, y, z) => {
      const yy = (y - ry) / ry, zz = z / rz;
      // cada tira de toucinho aparece de topo como um quadradinho branco
      for (const [a, b] of LARDOS) if (Math.abs(yy - a) < lado * 0.5 && Math.abs(zz - b) < lado * 0.5 * (ry / rz)) return mix(rgb('#f2e6dc'), rgb('#e8c0b8'), 0.2 * fbm(y * 300, z * 300, 0, k.s));
      return corteCru(base, k.s)(rho, ang, x, y, z);
    },
  });
  // pontas das tiras saindo dos dois lados
  for (const sx of [-1, 1]) {
    LARDOS.forEach(([a, b], i) => {
      const comp = 0.008 + 0.006 * ((i * 7) % 3);
      const g = caixa(comp, lado * ry, lado * ry, (x, y, z) => mul(rgb('#f2e6dc'), 0.94 + 0.08 * fbm(x * 300, y * 300, z * 300, k.s + i)), { n: 4, m: 12, exp: 5 });
      tf(g, [sx * (L / 2 + comp / 2 - 0.001), ry + a * ry * 0.9, b * rz * 0.9], [0, 0, 0]);
      out.push(parte(g, 'acetinado'));
    });
  }
  return out;
}

function lagartoBardeado(k: Ctx): Parte[] {
  const base = k.c1;
  const gord = rgb('#f2e8dc');
  const { out } = rolo(k, {
    laços: 6, longo: true,
    fora: (x, y, z, t, a) => {
      // lâmina fina de toucinho: branca com veios rosados e a emenda sobreposta em cima
      let c = mix(gord, rgb('#e8c4bc'), suave(0.3, 0.9, fbm(x * 30, y * 90, z * 90, k.s)) * 0.45);
      const emenda = 1 - suave(0.02, 0.09, Math.abs(Math.sin(a * 0.5 - 0.35)));
      c = mix(c, mul(c, 0.8), emenda * 0.6);
      return mul(c, 0.96 + 0.06 * ruido(x * 400, y * 400, z * 400, k.s));
    },
    corte: (rho, ang, x, y, z) => (rho > 0.9 ? mix(gord, rgb('#e8c4bc'), 0.2) : corteCru(base, k.s)(rho, ang, x, y, z)),
  });
  return out;
}

function lagartoZiguezague(k: Ctx): Parte[] {
  const base = k.c1;
  const larg = 0.034;
  const ry = (k.T * k.A) / 2, rz = (k.T * k.L) / 2, L = k.T;
  const { out } = rolo(k, {
    laços: 0,
    fora: (x, y, z, t, a) => {
      // fatias de toucinho enroladas nas laterais: cada fatia uma faixa, emendas escuras
      const q = (x + L / 2) / larg;
      const emenda = 1 - suave(0.0, 0.05, Math.min(fr(q), 1 - fr(q)));
      let c = toucinho(fr(q) * 1.8 + 0.06 * fbm(x * 30, Math.cos(a), Math.sin(a), k.s));
      c = mul(mix(c, mul(c, 0.7), emenda), 0.95 + 0.06 * fbm(x * 200, y * 200, z * 200, k.s));
      // o topo fica sem as fatias: a carne aparece entre os dentes da tira
      return mix(c, mul(base, 0.95 + 0.1 * fbm(x * 90, y * 90, z * 90, k.s)), suave(0.45, 0.6, Math.cos(a)));
    },
    corte: (rho, ang, x, y, z) => (rho > 0.9 ? toucinho(rho * 6) : corteCru(base, k.s)(rho, ang, x, y, z)),
  });
  // tira em ziguezague cobrindo o topo, presa nas pontas
  const esp = 0.0035;
  const tri = (u: number) => Math.abs(fr(u * 9) * 2 - 1);
  out.push(parte(chapa(110, 4, (u, v, l) => {
    const w = rz * (0.28 + 0.4 * tri(u));
    const z = v * w;
    const yTopo = ry + ry * Math.sqrt(Math.max(0, 1 - (z / (rz * 1.02)) ** 2)) * 1.02;
    const x = lerp(-L / 2 - 0.004, L / 2 + 0.004, u);
    const ponta = suave(0.02, 0, Math.min(u, 1 - u)) * ry * 0.4;
    return [x, yTopo + (l ? esp : 0.0004) - ponta, z];
  }, (x, y, z, u, v) => toucinho((v + 1) * 1.6 + 0.15 * fbm(x * 40, 0, 0, k.s))), 'acetinado'));
  return out;
}

/* ------------------------------------------------------------------ */
/* peças recheadas e enroladas                                          */
/* ------------------------------------------------------------------ */

function rolos(tipo: 'boi' | 'lombo' | 'file' | 'dois' | 'paleta') {
  return (k: Ctx): Parte[] => {
    const { c1, c2, s } = k;
    const espinafre = (x: number, y: number, z: number) => mix(rgb('#2a5218'), rgb('#4a7a28'), suave(-0.2, 0.7, fbm(x * 300, y * 300, z * 300, s)));
    if (tipo === 'boi') {
      return rolo(k, {
        laços: 9, longo: true, fora: foraCrua(k, c1),
        corte: (rho, ang, x, y, z) => (espiral(rho, ang, 2.2) > 0.76 && rho < 0.92 ? espinafre(x, y, z) : corteCru(c1, s)(rho, ang, x, y, z)),
      }).out;
    }
    if (tipo === 'lombo') {
      const recheio = (x: number, y: number, z: number) => mix(mix(rgb('#e8d49a'), rgb('#c89a5a'), suave(0, 0.8, fbm(x * 260, y * 260, z * 260, s)) * 0.6), rgb('#5a7a3a'), 1 - suave(0.08, 0.16, celula(x * 350, y * 350, z * 350, s)));
      return rolo(k, {
        laços: 7,
        // lombo rosado com a capa de gordura só por cima (a peça foi enrolada com a gordura para fora no alto)
        fora: (x, y, z, t, a) => {
          const H = k.T * k.A;
          const carne = foraCrua(k, c1, 0.1)(x, y, z, t, a);
          const gord = mul(mix(c2, rgb('#ecd4c4'), suave(0.2, 0.9, fbm(x * 30, y * 60, z * 60, s)) * 0.4), 0.95 + 0.06 * fbm(x * 250, y * 250, z * 250, s));
          return mix(carne, gord, suave(H * 0.86, H * 0.97, y + H * 0.06 * fbm(x * 30, 0, z * 30, s + 5)) * 0.65);
        },
        corte: (rho, ang, x, y, z) => {
          if (rho > 0.88) return mul(c2, 0.98);
          const q = espiral(rho, ang, 1.6);
          if (q > 0.8) return recheio(x, y, z);
          if (q > 0.72) return mul(c2, 0.96);
          return corteCru(c1, s)(rho, ang, x, y, z);
        },
      }).out;
    }
    if (tipo === 'file') {
      return rolo(k, {
        laços: 6, fora: foraCrua(k, c1, 0.1),
        // o filé aberto em livro e enrolado sobre o recheio: espiral de espinafre no corte
        corte: (rho, ang, x, y, z) => (rho < 0.18 || (espiral(rho, ang, 1.5) > 0.72 && rho < 0.9) ? espinafre(x, y, z) : corteCru(c1, s)(rho, ang, x, y, z)),
      }).out;
    }
    if (tipo === 'dois') {
      const cogumelo = (x: number, y: number, z: number) => mix(rgb('#7a6450'), rgb('#a8947a'), suave(-0.2, 0.7, fbm(x * 400, y * 400, z * 400, s)) * 0.7);
      const fora0 = foraCrua(k, c1, 0.1);
      return rolo(k, {
        laços: 6,
        fora: (x, y, z, t, a) => {
          // a emenda dos dois filés nos flancos
          const em = 1 - suave(0.0, 0.08, Math.abs(Math.cos(a)));
          return mix(fora0(x, y, z, t, a), mul(c1, 0.6), em * 0.7);
        },
        corte: (rho, ang, x, y, z) => {
          const yy = Math.cos(ang) * rho, zz = Math.sin(ang) * rho;
          if (Math.hypot(yy / 0.45, zz / 0.62) < 1) return cogumelo(x, y, z);
          if (Math.abs(yy) < 0.04) return mul(c1, 0.75);
          return corteCru(c1, s)(rho, ang, x, y, z);
        },
      }).out;
    }
    // paleta recheada, enrolada, dourada e refogada
    const dourado = corAssada(rgb('#9a5a30'), rgb('#4a2210'), s, 40, 0.8);
    return rolo(k, {
      laços: 6, longo: true, cordao: BARB_COZIDO, ac: 'brilhante',
      fora: (x, y, z, t, a) => mix(dourado(x, y, z, t, a), rgb('#c8a070'), (1 - suave(0.08, 0.2, celula(x * 120, y * 120, z * 120, s))) * 0.35),
      corte: (rho, ang, x, y, z) => {
        if (rho > 0.9) return mul(rgb('#5a2a14'), 1);
        const q = espiral(rho, ang, 1.8);
        if (q > 0.74) return mix(rgb('#5a6a2a'), rgb('#c8a878'), suave(0, 0.8, fbm(x * 300, y * 300, z * 300, s)) * 0.6);
        return mul(rgb('#9a6a58'), 0.9 + 0.14 * fbm(y * 120, z * 120, x, s));
      },
    }).out;
  };
}

/* ------------------------------------------------------------------ */
/* rolinhos presos com palito: paupiette e bacon com ameixa             */
/* ------------------------------------------------------------------ */

function rolinho(tipo: 'paupiette' | 'bacon') {
  return (k: Ctx): Parte[] => {
    const { c1, s } = k;
    const out: Parte[] = [];
    const L = k.T, R = (L * k.L) / 2;
    const bacon = tipo === 'bacon';
    const fora: CorFn = bacon
      ? (x, y, z, t, a) => {
        // duas fatias enroladas em hélice, faixas de carne e gordura no sentido da fatia
        const q = (x + L / 2) / (L * 0.52) - a / TAU;
        const emenda = 1 - suave(0, 0.05, Math.min(fr(q), 1 - fr(q)));
        const c = toucinho(fr(q) * 2 + 0.05 * fbm(x * 60, Math.cos(a), Math.sin(a), s));
        return mul(mix(c, mul(c, 0.72), emenda), 0.95 + 0.06 * ruido(x * 500, y * 500, z * 500, s));
      }
      : (x, y, z, t, a) => {
        // vitela clara batida, com a borda do escalope desenhando uma linha no rolo
        const borda = 1 - suave(0.0, 0.07, Math.abs(Math.sin(a * 0.5 - 0.9 + x * 6)));
        return mix(mul(c1, 0.93 + 0.1 * fbm(x * 120, y * 120, z * 120, s)), mul(c1, 0.72), borda * 0.6);
      };
    out.push(parte(corpo({
      x0: -L / 2, x1: L / 2, n: 18, m: 28, tampa: true, aneisTampa: 6,
      cor: fora,
      corTampa: (x, y, z) => {
        const yy = (y - R) / R, zz = z / R;
        const rho = Math.hypot(yy, zz), ang = Math.atan2(zz, yy);
        if (bacon) {
          if (rho < 0.5 + 0.05 * Math.sin(ang * 5)) return mix(rgb('#2a1220'), rgb('#4a2030'), suave(-0.3, 0.6, fbm(y * 500, z * 500, x, s)));
          return toucinho(rho * 7);
        }
        const q = espiral(rho, ang, 1.7);
        if (rho < 0.12) return mul(c1, 0.92);
        if (q > 0.58 && q < 0.8) return mul(rgb('#c8505e'), 0.92 + 0.12 * fbm(y * 300, z * 300, x, s));
        if (q >= 0.8 && q < 0.87) return rgb('#5e7e4e');
        return mul(c1, 0.9 + 0.1 * fbm(y * 200, z * 200, x, s));
      },
      perfil: (t) => { const b = 1 - 0.12 * (1 - suave(0, 0.08, Math.min(t, 1 - t))); return { ry: R * b, rz: R * b, cy: R }; },
      mod: (t, a) => 1 + 0.04 * fbm(t * 4, Math.cos(a), Math.sin(a), s),
      desloc: (p) => { if (p.y < R * 0.2) p.y = R * 0.2 - (R * 0.2 - p.y) * 0.4; },
    }), bacon ? 'acetinado' : 'umido', true));
    // palito atravessando o rolo de lado a lado
    out.push(parte(espetoMadeira(V(-L * 0.12, R * 1.55, -R * 1.9), V(L * 0.1, R * 0.75, R * 2.1), 0.0011, true, rgb('#e6d2a6')), 'fosco'));
    return out;
  };
}

/* ------------------------------------------------------------------ */
/* filé recheado fatiado e Wellington                                   */
/* ------------------------------------------------------------------ */

/** Corte de filé tostado: casca escura, anel cinza e miolo malpassado. */
function corteFile(rho: number, x: number, y: number, z: number, s: number): RGB {
  if (rho > 0.92) return mix(rgb('#5a2a18'), rgb('#3a1a10'), suave(0, 0.8, fbm(y * 300, z * 300, x, s)) * 0.5);
  const c = mix(rgb('#c4404a'), rgb('#a8706a'), suave(0.62, 0.86, rho));
  return mul(c, 0.92 + 0.12 * fbm(y * 150, z * 150, x * 3, s));
}

function fileRecheadoFatiado(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ry = H / 2, rz = W / 2;
  const nf = 7, gap = 0.0055;
  const lf = (L - gap * (nf - 1)) / nf;
  const crosta = corAssada(rgb('#7a3a1e'), rgb('#3a1a0c'), s, 60, 0.8);
  for (let i = 0; i < nf; i++) {
    const x0 = -L / 2 + i * (lf + gap);
    const af = lerp(1, 0.82, suave(0.6, 1, (i + 0.5) / nf));
    out.push(parte(corpo({
      x0, x1: x0 + lf, n: 4, m: 22, tampa: true, aneisTampa: 4, linear: true,
      cor: crosta,
      corTampa: (x, y, z) => corteFile(Math.hypot((y - ry * af) / (ry * af), z / (rz * af)), x, y, z, s + i),
      perfil: () => ({ ry: ry * af, rz: rz * af, cy: ry * af }),
      mod: (t, a) => 1 + 0.04 * fbm(i, Math.cos(a), Math.sin(a), s),
      desloc: (p) => { if (p.y < ry * 0.3) p.y = ry * 0.3 - (ry * 0.3 - p.y) * 0.3; },
    }), 'acetinado', true));
    if (i < nf - 1) {
      // duxelles entre as fatias, sobrando um pouco por cima
      const xd = x0 + lf + gap / 2;
      out.push(parte(corpo({
        x0: xd - gap * 0.6, x1: xd + gap * 0.6, n: 2, m: 16, tampa: true, linear: true,
        cor: (x, y, z) => mix(rgb('#3a2a1c'), rgb('#5a4430'), suave(-0.3, 0.7, fbm(x * 600, y * 600, z * 600, s + i))),
        perfil: () => ({ ry: ry * af * 0.96, rz: rz * af * 0.92, cy: ry * af * 1.04 }),
        mod: (t, a) => 1 + 0.08 * fbm(i * 3, Math.cos(a) * 2, Math.sin(a) * 2, s + 9),
      }), 'umido'));
    }
  }
  return out;
}

function wellington(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ry = H / 2, rz = W / 2;
  const Lt = L * 0.72;
  const dourado = rgb('#c8822e'), claro = rgb('#e8b45a'), escuro = rgb('#8a4a18');
  const trelica = (x: number, a: number) => {
    const u = a * 0.05;
    const d1 = fr((x + u) / 0.03), d2 = fr((x - u) / 0.03);
    return 1 - suave(0.06, 0.14, Math.min(d1, 1 - d1, d2, 1 - d2));
  };
  const massa: CorFn = (x, y, z, t, a) => {
    const topo = Math.max(0, Math.cos(a));
    let c = mix(claro, dourado, 0.5 + 0.5 * topo + 0.3 * fbm(x * 40, y * 40, z * 40, s));
    c = mix(c, escuro, trelica(x, a) * topo * 0.6 + suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s + 2)) * 0.25);
    return mul(c, 0.95 + 0.08 * ruido(x * 300, y * 300, z * 300, s));
  };
  /** Camadas do corte: filé malpassado, duxelles, crêpe e massa folhada. */
  const camadas = (rho: number, x: number, y: number, z: number, si: number): RGB => {
    if (rho < 0.5) return corteFile(rho / 0.55, x, y, z, si);
    if (rho < 0.54) return rgb('#6a4234');
    if (rho < 0.7) return mix(rgb('#3a2818'), rgb('#5a4228'), suave(-0.3, 0.7, fbm(x * 700, y * 700, z * 700, si)));
    if (rho < 0.74) return mix(rgb('#e8d088'), rgb('#4a7a2a'), (1 - suave(0.1, 0.2, celula(x * 900, y * 900, z * 900, si))) * 0.7);
    // folhado: lâminas finas, mais douradas para fora
    const lam = Math.abs(Math.sin(rho * 160 + fbm(x * 80, y * 80, z * 80, si) * 2)) ** 3;
    return mix(mix(rgb('#f2deae'), dourado, suave(0.8, 1, rho)), rgb('#c89a5a'), lam * 0.45);
  };
  const perfil = (t: number) => {
    const fim = Math.sqrt(suave(0, 0.08, t));
    return { ry: ry * Math.max(0.2, fim), rz: rz * Math.max(0.2, fim), cy: ry };
  };
  // o rolo inteiro, ponta fechada em -X e a face cortada em +X
  out.push(parte(corpo({
    x0: -L / 2, x1: -L / 2 + Lt, n: 26, m: 40, tampa: true, aneisTampa: 7, exp: 2.6,
    cor: massa,
    corTampa: (x, y, z) => (x < 0 ? massa(x, y, z, 0, 0) : camadas(Math.min(1, Math.hypot((y - ry) / ry, z / rz)), x, y, z, s)),
    perfil,
    mod: (t, a) => 1 + 0.025 * trelica(lerp(-L / 2, -L / 2 + Lt, t), a) * Math.max(0, Math.cos(a)) + 0.02 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
    desloc: (p) => { if (p.y < ry * 0.3) p.y = ry * 0.3 - (ry * 0.3 - p.y) * 0.3; },
  }), 'acetinado', true));
  // duas fatias deitadas na frente do corte
  const ef = L * 0.07;
  for (let i = 0; i < 2; i++) {
    const g = corpo({
      x0: -ef / 2, x1: ef / 2, n: 2, m: 36, tampa: true, aneisTampa: 7, exp: 2.6, linear: true,
      cor: massa,
      corTampa: (x, y, z) => camadas(Math.min(1, Math.hypot(y / ry, z / rz)), x, y, z, s + 5 + i),
      perfil: () => ({ ry, rz }),
    });
    // deita a fatia (eixo X para cima) e encosta uma na outra
    g.rotateZ(PI / 2);
    g.rotateX(0.0);
    const incl = i === 0 ? 0 : -0.5;
    g.rotateZ(incl);
    g.translate(-L / 2 + Lt + ry * 1.25 + i * ry * 1.05, ef / 2 + (i ? ry * 0.45 : 0), i * rz * 0.15);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* bifes: pimenta moída e marcas de grelha                              */
/* ------------------------------------------------------------------ */

function bifePimenta(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const fib = corFibra(c1, s, 0.003, [1, 0, 0.6]);
  out.push(parte(rodela(R, H, (x, y, z, t, a) => {
    const c = fib(x, y, z, t, a);
    // pimenta grudada também em pontinhos na cor
    return mix(c, rgb('#2a2018'), (1 - suave(0.05, 0.14, celula(x * 500, y * 500, z * 500, s))) * (y > H * 0.9 || y < H * 0.1 ? 0.8 : 0.2));
  }, { n: 18, m: 30, borda: 0.4, mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s) }), 'umido', true));
  // grãos quebrados grosseiramente sobre a face de cima
  const r = k.r;
  for (let i = 0; i < 80; i++) {
    const ang = r.f(0, TAU), rr = Math.sqrt(r.f(0, 1)) * R * 0.78;
    const tam = r.f(0.0012, 0.0022);
    const tom = r.f(0, 1);
    const g = elipsoide(tam, tam * 0.6, tam * r.f(0.6, 1), (x, y, z) => mix(rgb('#1e1814'), rgb('#6a5a48'), tom * 0.7 + 0.2 * ruido(x * 3000, y * 3000, z * 3000, s)), 3, 5, (t, a) => 1 + 0.3 * Math.abs(Math.cos(a * 1.5)));
    tf(g, [Math.cos(ang) * rr, H - tam * 0.15, Math.sin(ang) * rr], [r.f(-0.3, 0.3), r.f(0, TAU), r.f(-0.3, 0.3)]);
    out.push(parte(g, 'fosco'));
  }
  return out;
}

function bifeGrelha(k: Ctx): Parte[] {
  const { c1, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const e = 0.018;
  const marca = (x: number, z: number) => {
    const d1 = fr((x * 0.94 + z * 0.34) / e), d2 = fr((x * 0.34 - z * 0.94) / e);
    return Math.max(1 - suave(0.08, 0.16, Math.min(d1, 1 - d1)), 1 - suave(0.08, 0.16, Math.min(d2, 1 - d2)));
  };
  const crosta = corAssada(rgb('#8a4a28'), rgb('#5a2a16'), s, 60, 0.6);
  const cont = (xd: number, zd: number): [number, number] => {
    const ang = Math.atan2(zd, xd);
    const irr = 1 + 0.05 * fbm(Math.cos(ang) * 2, Math.sin(ang) * 2, 0, s);
    return [xd * R * irr, zd * R * 0.86 * irr];
  };
  const g = placa(34, 34, cont, (xd, zd, r) => {
    const [x, z] = cont(xd, zd);
    return H * (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - r ** 8))) - H * 0.04 * marca(x, z) * (r < 0.95 ? 1 : 0);
  }, (x, y, z) => {
    const c = crosta(x, y, z, 0, 0);
    // quadriculado escuro em cima; lateral mais clara, quase sem tostar
    const topo = suave(H * 0.8, H * 0.95, y);
    return mix(mix(c, mul(c1, 1.4), suave(H * 0.7, H * 0.2, y) * 0.4), rgb('#2a140a'), marca(x, z) * topo * 0.85);
  }, () => 0);
  return [parte(g, 'acetinado', true)];
}

/* ------------------------------------------------------------------ */
/* miudezas servidas junto                                              */
/* ------------------------------------------------------------------ */

function manteigaTemperada(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T * 0.3, H = 0.008;
  for (let i = 0; i < 3; i++) {
    const g = rodela(R, H, (x, y, z) => {
      let c = mul(c1, 0.96 + 0.06 * fbm(x * 200, y * 200, z * 200, s + i));
      // pedacinhos de cebola miúda tingidos de vinho e salsinha
      c = mix(c, rgb('#b07890'), 1 - suave(0.12, 0.2, celula(x * 260, y * 260, z * 260, s + i)));
      return mix(c, rgb('#4a7a2a'), (1 - suave(0.08, 0.14, celula(x * 240, y * 240, z * 240, s + i + 9))) * 0.8);
    }, { n: 18, m: 28, borda: 0.25 });
    tf(g, [i * R * 1.15, i * H * 0.35, (i % 2) * R * 0.3], [0, 0, i ? -0.12 : 0]);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
}

function gremolada(k: Ctx): Parte[] {
  // gremolada solta, como polvilhada: alguns tufinhos baixos e irregulares de salsa picada miúda,
  // flocos espalhados em volta, raspas finas de limão e alho picado (nada de disco ou montinho liso)
  const { s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = R * 0.14;
  const salsa = rgb('#1e4214'), salsaClara = rgb('#386a22'), limao = rgb('#f0c818'), alho = rgb('#eee6cc');
  const cor: CorFn = (x, y, z) => {
    let c = mix(salsa, salsaClara, suave(0.25, 0.75, celula(x * 900, y * 900, z * 900, s)) * 0.7);
    c = mul(c, 0.8 + 0.3 * ruido(x * 1500, y * 1500, z * 1500, s + 2));
    c = mix(c, alho, (1 - suave(0.06, 0.12, celula(x * 700, y * 700, z * 700, s + 3))) * 0.9);
    return mix(c, limao, (1 - suave(0.05, 0.1, celula(x * 600, y * 600, z * 600, s + 4))) * 0.9);
  };
  const tufos: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4 + k.r.f(-0.4, 0.4), rr = i === 0 ? 0 : R * k.r.f(0.3, 0.6);
    const r = R * k.r.f(0.14, 0.24);
    tufos.push([Math.cos(a) * rr, Math.sin(a) * rr, r]);
    const g = elipsoide(r, H, r * k.r.f(0.6, 0.9), cor, 7, 12, (t, aa) => 1 + 0.3 * ruido(Math.cos(aa) * 2, t * 4, i, s) + 0.12 * ruido(Math.cos(aa) * 7, t * 9, i + 0.5, s + 1));
    out.push(parte(tf(g, [Math.cos(a) * rr, H, Math.sin(a) * rr], [0, k.r.f(0, TAU), 0]), 'fosco', true));
  }
  // altura aproximada no ponto (x, z): em cima de um tufo ou rente ao prato
  const alto = (x: number, z: number) => {
    let y = 0;
    for (const [tx, tz, r] of tufos) { const d = Math.hypot(x - tx, z - tz) / r; if (d < 1) y = Math.max(y, H + H * Math.sqrt(1 - d * d) * 0.9); }
    return y;
  };
  // flocos de salsa picada
  for (let i = 0; i < 110; i++) {
    const ang = k.r.f(0, TAU), rr = Math.sqrt(k.r.f(0, 1)) * R * 1.05;
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const tam = R * k.r.f(0.05, 0.1);
    const c = mix(salsa, salsaClara, k.r.f(0, 1));
    const g = elipsoide(tam, tam * 0.18, tam * k.r.f(0.45, 0.8), (xx, yy, zz) => mul(c, 0.9 + 0.2 * ruido(xx * 3000, yy * 3000, zz * 3000, s)), 3, 5);
    tf(g, [x, alto(x, z) + tam * 0.1, z], [k.r.f(-0.6, 0.6), k.r.f(0, TAU), k.r.f(-0.6, 0.6)]);
    out.push(parte(g, 'acetinado'));
  }
  // raspas de limão: fios finos e curtos, amarelos
  for (let i = 0; i < 18; i++) {
    const ang = k.r.f(0, TAU), rr = Math.sqrt(k.r.f(0, 1)) * R * 0.95;
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, y = alto(x, z) + R * 0.03;
    const dir = k.r.f(0, TAU), len = R * k.r.f(0.15, 0.3);
    const p0 = V(x, y, z), d = V(Math.cos(dir), 0, Math.sin(dir)).multiplyScalar(len);
    out.push(parte(tubo([p0.clone().addScaledVector(d, -0.5), p0.clone().add(V(0, R * 0.04, 0)).addScaledVector(V(-d.z, 0, d.x), 0.15), p0.clone().addScaledVector(d, 0.5)], {
      raio: R * 0.014, achata: 0.5, m: 4, n: 5, cor: (xx, yy, zz) => mul(limao, 0.92 + 0.12 * ruido(xx * 2000, yy * 2000, zz * 2000, s + i)),
    }), 'brilhante'));
  }
  // alho picado: cubinhos claros
  for (let i = 0; i < 24; i++) {
    const ang = k.r.f(0, TAU), rr = Math.sqrt(k.r.f(0, 1)) * R * 0.9;
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const tam = R * k.r.f(0.05, 0.08);
    const g = caixa(tam, tam * 0.8, tam, (xx, yy, zz) => mul(alho, 0.93 + 0.1 * ruido(xx * 3000, yy * 3000, zz * 3000, s)), { n: 1, m: 8, aneisTampa: 1 });
    tf(g, [x, alto(x, z) + tam * 0.3, z], [k.r.f(0, TAU), k.r.f(0, TAU), k.r.f(0, TAU)]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

function alcaparras(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const r = k.T * k.r.f(0.1, 0.13);
    const ang = i * 2.4, rr = i === 0 ? 0 : k.T * 0.14 * Math.sqrt(i);
    const camada = i > 8 ? 1 : 0;
    // botão de flor: oval com pontinha e escamas sobrepostas
    const g = elipsoide(r * 1.15, r * 0.95, r, (x, y, z) => mix(mix(c1, c2, suave(-0.3, 0.6, fbm(x * 900, y * 900, z * 900, s + i)) * 0.6), rgb('#c8c890'), (1 - suave(0.04, 0.1, celula(x * 1500, y * 1500, z * 1500, s + i))) * 0.5), 6, 9, (t, a) => 1 + 0.06 * Math.abs(Math.sin(a * 3 + t * 6)) + 0.15 * suave(0.85, 1, t));
    tf(g, [Math.cos(ang) * rr * (camada ? 0.5 : 1), r * 0.9 + camada * r * 1.4, Math.sin(ang) * rr * (camada ? 0.5 : 1)], [k.r.f(0, TAU), k.r.f(0, TAU), k.r.f(0, TAU)]);
    out.push(parte(g, 'brilhante', true));
  }
  return out;
}

function cornichons(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = L * 0.11;
  for (let i = 0; i < 3; i++) {
    const Li = L * (0.85 + 0.15 * ((i * 5) % 3) / 2);
    const g = corpo({
      x0: -Li / 2, x1: Li / 2, n: 20, m: 16,
      cor: (x, y, z) => mix(mul(c1, 0.9 + 0.16 * fbm(x * 200, y * 200, z * 200, s + i)), c2, (1 - suave(0.1, 0.22, celula(x * 500, y * 500, z * 500, s + i))) * 0.5),
      perfil: (t) => { const e = Math.sin(PI * (0.04 + 0.92 * t)) ** 0.55; return { ry: R * e, rz: R * e, cy: R, cz: R * 0.6 * Math.sin(PI * t) }; },
      mod: (t, a) => 1 + 0.08 * (1 - suave(0.1, 0.25, celula(t * 14, Math.cos(a) * 2, Math.sin(a) * 2, s + i))),
    });
    tf(g, [0, 0, (i - 1) * R * 2.3], [0, (i - 1) * 0.15, 0]);
    out.push(parte(g, 'brilhante', true));
  }
  return out;
}

function lascasParmesao(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 6; i++) {
    const Li = k.T * k.r.f(0.55, 0.8), Wi = Li * k.r.f(0.5, 0.7), e = 0.0012;
    const curva = k.r.f(0.1, 0.35);
    const g = chapa(10, 6, (u, v, l) => {
      const x = (u - 0.5) * Li, z = v * Wi / 2 * (1 - 0.3 * Math.abs(2 * u - 1)) * (1 + 0.1 * Math.sin(u * 9 + i));
      return [x, curva * Li * (2 * u - 1) ** 2 * 0.5 + (l ? e : 0), z];
    }, (x, y, z) => mix(mul(c1, 0.94 + 0.1 * fbm(x * 300, y * 300, z * 300, s + i)), rgb('#fff8e0'), (1 - suave(0.05, 0.12, celula(x * 800, y * 800, z * 800, s + i))) * 0.6 + 0 * c2[0]));
    tf(g, [((i % 3) - 1) * k.T * 0.35, i * 0.0015, (Math.floor(i / 3) - 0.5) * k.T * 0.4], [k.r.f(-0.15, 0.15), k.r.f(0, TAU), k.r.f(-0.15, 0.15)]);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* cordeiro                                                             */
/* ------------------------------------------------------------------ */

/** Perfil de perna (gigot): larga atrás, afinando para a canela em +X. */
function rPerna(t: number) {
  return Math.sin(PI * (0.12 + 0.88 * clamp(t) ** 0.65)) ** 0.7 * lerp(1, 0.32, suave(0.4, 1, t));
}

function pernaDesossada(k: Ctx): Parte[] {
  const { c1, c2, c3, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const fib = corFibra(c1, s, 0.004, [0.3, 0.5, 1]);
  const furo = (t: number) => suave(0.965, 0.99, t);
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 40, m: 32,
    cor: (x, y, z, t, a) => {
      // gordura aparada: restos brancos e película; na ponta, o túnel onde estava o osso
      let c = mix(fib(x, y, z, t, a), c2, suave(0.35, 0.75, fbm(x * 25, y * 25, z * 25, s)) * 0.5);
      c = mix(c, c3, suave(0.4, 0.8, fbm(x * 12, y * 40, z * 40, s + 3)) * 0.25);
      c = mix(c, mul(c1, 1.1), suave(0.93, 0.955, t));
      return mix(c, rgb('#3a0c10'), furo(t));
    },
    perfil: (t) => {
      const r = Math.max(0.56, rPerna(t * 0.72)) * Math.sqrt(suave(0, 0.06, t)) * (t > 0.97 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.03)) : 1);
      return { ry: (H / 2) * r, rz: (W / 2) * r, cy: (H / 2) * Math.max(0.56, rPerna(t * 0.72)) };
    },
    mod: (t, a) => 1 + 0.06 * fbm(t * 4, Math.cos(a), Math.sin(a), s),
    desloc: (p, t) => { p.x -= L * 0.03 * furo(t); if (p.y < 0) p.y *= 0.2; },
  }), 'umido', true)];
}

function pernaMassa(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ouro = rgb('#d0943e'), claro = rgb('#ecc47a'), escuro = rgb('#9a5a20');
  const massa: CorFn = (x, y, z, t, a) => {
    const topo = Math.max(0, Math.cos(a));
    let c = mix(claro, ouro, 0.4 + 0.5 * topo + 0.25 * fbm(x * 30, y * 30, z * 30, s));
    c = mix(c, escuro, suave(0.35, 0.9, fbm(x * 70, y * 70, z * 70, s + 1)) * 0.35 * topo);
    // emenda da massa dobrada por baixo
    return mul(c, 0.95 + 0.07 * ruido(x * 250, y * 250, z * 250, s));
  };
  const ry = (t: number) => (H / 2) * Math.max(0.36, rPerna(t * 0.92)) * Math.sqrt(suave(0, 0.07, t)) * Math.sqrt(suave(1, 0.9, t));
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 34, m: 30, cor: massa,
    perfil: (t) => { const q = ry(t) / (H / 2); return { ry: ry(t), rz: (W / 2) * q, cy: (H / 2) * Math.max(0.36, rPerna(t * 0.92)) }; },
    mod: (t, a) => 1 + 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), s),
    desloc: (p) => { if (p.y < 0) p.y *= 0.2; },
  }), 'brilhante', true));
  // folhas de massa decorando o topo, com nervuras marcadas
  const topo = (x: number) => { const t = (x + L / 2) / L; return (H / 2) * Math.max(0.36, rPerna(t * 0.92)) * 2 * Math.sqrt(suave(0, 0.07, t)) * Math.sqrt(suave(1, 0.9, t)); };
  const folhas: [number, number, number][] = [[-0.12, 0.0, 0.5], [0.0, 0.02, -0.4], [0.1, -0.01, 0.2], [-0.02, -0.03, 2.6], [0.2, 0, 3.0]];
  folhas.forEach(([fx, fz, ang], i) => {
    const x = fx * L, Lf = L * 0.16;
    const g = folha(Lf, Lf * 0.42, ouro, escuro, {
      contorno: contornos.lanca, esp: 0.002, n: 10, m: 6, curva: -0.08,
      cor: (xx, yy, zz) => mix(mix(claro, ouro, 0.6), escuro, (1 - suave(0, 0.0015, Math.abs(zz))) * 0.6 + Math.abs(Math.sin((xx - Math.abs(zz) * 1.4) * 260)) ** 12 * 0.4),
    });
    tf(g, [x, topo(x) - 0.002, fz * L], [0, ang, -0.1 * Math.cos(ang)]);
    out.push(parte(g, 'brilhante'));
    void i;
  });
  return out;
}

function lomboCrosta(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const ry = H / 2, rz = W / 2;
  const selado = corAssada(rgb('#8a4a2a'), rgb('#4a2212'), s, 60, 0.7);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 30, tampa: true, aneisTampa: 5, exp: 3,
    cor: selado,
    corTampa: (x, y, z) => {
      const rho = Math.hypot((y - ry) / ry, z / rz);
      if (rho > 0.9) return rgb('#5a2a16');
      return mix(mul(c1, 1.05), rgb('#b8706a'), suave(0.6, 0.9, rho) * 0.6);
    },
    perfil: (t) => { const b = 1 - 0.1 * (1 - suave(0, 0.05, Math.min(t, 1 - t))); return { ry: ry * b, rz: rz * b, cy: ry }; },
    mod: (t, a) => 1 + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
    desloc: (p) => { if (p.y < ry * 0.3) p.y = ry * 0.3 - (ry * 0.3 - p.y) * 0.3; },
  }), 'acetinado', true));
  // mostarda e por cima as migalhas com ervas, apertadas no lado da gordura
  const e = 0.004;
  out.push(parte(chapa(48, 12, (u, v, l) => {
    const x = lerp(-L / 2 + 0.004, L / 2 - 0.004, u);
    const z = v * rz * 0.94;
    const yTop = ry + ry * Math.pow(Math.max(0, 1 - Math.abs(z / (rz * 0.98)) ** 3), 1 / 3);
    const bump = e * 0.35 * fbm(x * 500, 0, z * 500, s);
    return [x, yTop + (l ? e * (1 - 0.6 * Math.abs(v) ** 4) + bump : -0.0005), z];
  }, (x, y, z) => {
    let c = mix(rgb('#d8bc80'), rgb('#b88a48'), suave(-0.3, 0.7, fbm(x * 300, y * 300, z * 300, s)) * 0.7);
    c = mix(c, rgb('#3e6e22'), (1 - suave(0.1, 0.22, celula(x * 450, y * 450, z * 450, s + 2))) * 0.9);
    return mix(c, rgb('#d8a828'), (1 - suave(0.05, 0.12, celula(x * 300, y * 300, z * 300, s + 6))) * 0.5);
  }), 'fosco'));
  return out;
}

function pernaAlho(k: Ctx): Parte[] {
  const out = gCarne(ctxCom(k, { v: 'pernil', d: 'pele' }));
  const L = k.T, H = L * k.A;
  const x0 = -L / 2, x1 = L * 0.32;
  const topo = (x: number) => {
    const t = clamp((x - x0) / (x1 - x0));
    const r = Math.sin(PI * (0.12 + 0.88 * t ** 0.65)) ** 0.7 * lerp(1, 0.3, suave(0.4, 1, t));
    return H * r;
  };
  const alho = rgb('#f2ead2'), alecrim = rgb('#3a5a2a');
  const furos: [number, number][] = [[-0.3, 0.02], [-0.2, -0.05], [-0.12, 0.05], [-0.03, -0.02], [0.06, 0.03], [-0.25, -0.1], [-0.08, 0.1]];
  furos.forEach(([fx, fz], i) => {
    const x = fx * L, z = fz * L;
    const y = topo(x) * Math.sqrt(Math.max(0, 1 - (z / (L * 0.16)) ** 2)) * 0.98;
    const ang = k.r.f(0, TAU);
    // corte escuro, lasca de alho saindo e raminho de alecrim
    const fenda = elipsoide(0.012, 0.002, 0.0035, () => rgb('#5a1218'), 4, 6);
    tf(fenda, [x, y, z], [0, ang, 0]);
    out.push(parte(fenda, 'umido'));
    const lasca = elipsoide(0.008, 0.0065, 0.003, (xx, yy, zz) => mul(alho, 0.94 + 0.08 * ruido(xx * 2000, yy * 2000, zz * 2000, i)), 5, 8);
    tf(lasca, [x, y + 0.004, z], [0, ang, 0.35]);
    out.push(parte(lasca, 'acetinado'));
    if (i % 2 === 0) {
      const base = V(x + 0.003, y + 0.001, z);
      const dir = V(Math.cos(ang + 1), 0.9, Math.sin(ang + 1)).normalize();
      const pts = [base, base.clone().addScaledVector(dir, 0.012), base.clone().addScaledVector(dir, 0.024).add(V(0.003, -0.002, 0))];
      out.push(parte(tubo(pts, { raio: 0.0008, m: 4, n: 6, cor: () => rgb('#6a5a3a') }), 'fosco'));
      for (let j = 0; j < 8; j++) {
        const p = base.clone().addScaledVector(dir, 0.004 + j * 0.0026);
        for (const sg of [-1, 1]) {
          const d2 = V(-dir.z * sg, 0.3, dir.x * sg).normalize();
          out.push(parte(tubo([p, p.clone().addScaledVector(d2, 0.006)], { raio: 0.0006, achata: 0.5, cima: V(0, 1, 0), m: 4, n: 3, cor: () => mul(alecrim, 0.9 + 0.1 * (j % 2)) }), 'acetinado'));
        }
      }
    }
  });
  return out;
}

function espetinhoCordeiro(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, a = 0.03;
  const n = 5;
  const tostado = corAssada(rgb('#8a4a2a'), rgb('#3e1e10'), s, 70, 0.8);
  for (let i = 0; i < n; i++) {
    const x = -L * 0.3 + i * (a + 0.006);
    const g = caixa(a, a * 0.92, a * 0.95, (xx, yy, zz) => {
      const c = tostado(xx, yy, zz, 0, 0);
      // marcas da grelha atravessando o cubo e quinas chamuscadas
      const m = 1 - suave(0.1, 0.2, Math.min(fr((xx + zz * 0.3) / 0.009), 1 - fr((xx + zz * 0.3) / 0.009)));
      return mix(c, rgb('#1e0e06'), m * 0.55);
    }, { n: 10, m: 32, exp: 4 });
    g.rotateX(k.r.f(-0.25, 0.25));
    g.rotateY(k.r.f(-0.2, 0.2));
    g.translate(x, a * 0.5, 0);
    // relevo irregular
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j < p.count; j++) {
      const f = 1 + 0.06 * fbm(p.getX(j) * 120, p.getY(j) * 120, p.getZ(j) * 120, s + i);
      p.setXYZ(j, x + (p.getX(j) - x) * f, a * 0.5 + (p.getY(j) - a * 0.5) * f, p.getZ(j) * f);
    }
    g.computeVertexNormals();
    out.push(parte(g, 'acetinado', true));
  }
  for (const g of espetoMetal(V(-L / 2 + 0.01, a * 0.5, 0), V(L / 2, a * 0.5, 0), 0.0017)) out.push(parte(g, 'brilhante'));
  return out;
}

/** Peça envolta em peritônio, frita: nuggets de cordeiro ou crépinette com raminho. */
function emPeritonio(tipo: 'nugget' | 'crepinette') {
  return (k: Ctx): Parte[] => {
    const { s } = k;
    const out: Parte[] = [];
    const frito = corAssada(rgb('#9a5428'), rgb('#5a2a12'), s, 60, 0.7);
    const cor = corRede(frito, rgb('#ecc080'), s, 380);
    if (tipo === 'nugget') {
      const L = k.T, W = L * k.L, H = L * k.A;
      out.push(parte(elipsoide(L / 2, H / 2, W / 2, cor, 30, 40, (t, a) => 1 + 0.1 * fbm(t * 3, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s) - 0.08 * Math.max(0, -Math.cos(a)) ** 3), 'brilhante', true));
      out[0].g.translate(0, H / 2, 0);
      return out;
    }
    const R = k.T / 2, H = k.T * k.A;
    out.push(parte(rodela(R, H, cor, { n: 34, m: 56, borda: 0.5, mod: (t, a) => 1 + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t, s) }), 'brilhante', true));
    // raminho de erva por baixo da rede, aparecendo em cima
    const g = folha(R * 0.9, R * 0.45, rgb('#3e6a2a'), rgb('#6a8a4a'), {
      contorno: contornos.oval, esp: 0.0006, n: 10, m: 6,
      cor: corRede((x, y, z) => mix(rgb('#3e5e22'), rgb('#5a7a32'), suave(-0.3, 0.6, fbm(x * 300, y * 300, z * 300, s))), rgb('#d8b070'), s, 240),
    });
    tf(g, [-R * 0.45, H + 0.0004, 0], [0, 0.3, 0]);
    out.push(parte(g, 'brilhante'));
    return out;
  };
}

function petitTian(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, Hb = 0.011;
  // disco de cebola refogada moldado no aro
  out.push(parte(rodela(R, Hb, (x, y, z) => {
    const fio = Math.abs(Math.sin((x * 0.7 + z) * 700 + fbm(x * 90, y * 90, z * 90, s) * 4)) ** 4;
    return mul(mix(rgb('#d8a860'), rgb('#a8682a'), suave(-0.3, 0.7, fbm(x * 120, y * 120, z * 120, s)) * 0.6), 0.9 + 0.15 * fio);
  }, { n: 14, m: 32, borda: 0.4 }), 'acetinado', true));
  const rf = R * 0.3, ef = 0.003;
  const abobrinha: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / rf;
    if (r > 0.86) return rgb('#2e5a1e');
    const c = mix(rgb('#eef0c8'), rgb('#c8d890'), suave(0.6, 0.85, r));
    return mix(c, rgb('#d8d8a0'), (1 - suave(0.05, 0.12, Math.abs(r - 0.4))) * 0.6);
  };
  const tomate: CorFn = (x, y, z) => {
    const r = Math.hypot(x, z) / rf, a = Math.atan2(z, x);
    if (r > 0.85) return rgb('#c8201a');
    // lóculos com sementes e as paredes vermelhas
    const lob = Math.abs(Math.cos(a * 1.5)) ** 4;
    const c = mix(rgb('#e8503a'), rgb('#f0a080'), suave(0.2, 0.6, r) * (1 - lob) * 0.8);
    return mix(c, rgb('#e8d8a0'), (1 - suave(0.04, 0.1, celula(x * 900, 0, z * 900, s))) * (1 - lob) * suave(0.25, 0.4, r) * 0.6);
  };
  const gratin = (base: CorFn): CorFn => (x, y, z, t, a) => mix(base(x, y, z, t, a), rgb('#c8903a'), (1 - suave(0.1, 0.25, celula(x * 500, y * 500, z * 500, s + 3))) * 0.55);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const g = rodela(rf, ef, gratin(i % 2 ? tomate : abobrinha), { n: 10, m: 16, borda: 0.4 });
    g.rotateZ(-0.55);
    g.rotateY(-a);
    g.translate(Math.cos(a) * R * 0.6, Hb + rf * 0.42, Math.sin(a) * R * 0.6);
    out.push(parte(g, i % 2 ? 'brilhante' : 'acetinado'));
  }
  for (let i = 0; i < 3; i++) {
    const g = rodela(rf, ef, gratin(i % 2 ? abobrinha : tomate), { n: 10, m: 16, borda: 0.4 });
    g.rotateZ(-0.35);
    g.rotateY(-i * 2.1);
    g.translate(Math.cos(i * 2.1) * R * 0.15, Hb + rf * 0.5 + 0.004, Math.sin(i * 2.1) * R * 0.15);
    out.push(parte(g, 'acetinado'));
  }
  // folhinhas de tomilho
  for (let i = 0; i < 14; i++) {
    const a = k.r.f(0, TAU), rr = k.r.f(0, R * 0.7);
    const g = elipsoide(0.0018, 0.0005, 0.0008, () => rgb('#4a6a2a'), 3, 4);
    tf(g, [Math.cos(a) * rr, Hb + rf * 0.85, Math.sin(a) * rr], [0, k.r.f(0, TAU), 0]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* porco: pernil com torresmo e pernil glaceado                         */
/* ------------------------------------------------------------------ */

function pernilAssado(tipo: 'torresmo' | 'glaceado') {
  return (k: Ctx): Parte[] => {
    const { s } = k;
    const out: Parte[] = [];
    const L = k.T, W = L * k.L, H = L * k.A;
    const x0 = -L / 2, x1 = L * 0.32;
    const glace = tipo === 'glaceado';
    const sulco = (x: number, t: number, a: number) => {
      if (!glace) {
        const d = fr((x + 0.003 * Math.sin(a * 3)) / 0.02);
        return (1 - suave(0.08, 0.2, Math.min(d, 1 - d))) * suave(-0.5, 0.2, Math.cos(a)) * suave(0.95, 0.85, t);
      }
      const R = (H + W) / 4;
      const aa = Math.atan2(Math.sin(a), Math.cos(a));
      const u1 = fr((x + aa * R) / 0.055), u2 = fr((x - aa * R) / 0.055);
      return (1 - suave(0.05, 0.13, Math.min(u1, 1 - u1, u2, 1 - u2))) * suave(-0.3, 0.3, Math.cos(a)) * suave(0.86, 0.76, t);
    };
    const cor: CorFn = (x, y, z, t, a) => {
      const sl = sulco(x, t, a);
      if (glace) {
        // gordura em losangos coberta de calda de açúcar mascavo e mostarda; colarinho de pele perto da canela
        let c = mix(rgb('#d08a36'), rgb('#a8561c'), suave(-0.3, 0.7, fbm(x * 25, y * 25, z * 25, s)) * 0.5);
        c = mix(c, rgb('#4a1e08'), sl * 0.8);
        const colar = suave(0.78, 0.8 + 0.02 * Math.abs(Math.sin(a * 6)), t);
        return mix(c, mul(rgb('#7a4a2a'), 0.9 + 0.15 * fbm(x * 90, y * 90, z * 90, s)), colar);
      }
      // torresmo: pele estufada em bolhas douradas, sulcos mais escuros
      const bolha = 1 - suave(0.05, 0.35, celula(x * 260, y * 260, z * 260, s));
      let c = mix(rgb('#d89a48'), rgb('#a8601e'), suave(-0.3, 0.7, fbm(x * 50, y * 50, z * 50, s)) * 0.7);
      c = mix(c, rgb('#f2cc84'), bolha * 0.45);
      return mix(c, rgb('#6a3010'), sl * 0.75);
    };
    out.push(parte(corpo({
      x0, x1, n: glace ? 54 : 76, m: glace ? 54 : 38, linear: true, cor,
      perfil: (t) => { const r = rPerna(t); return { ry: (H / 2) * r, rz: (W / 2) * r, cy: (H / 2) * r }; },
      mod: (t, a) => 1 + 0.04 * fbm(t * 4, Math.cos(a), Math.sin(a), s) - 0.02 * sulco(lerp(x0, x1, t), t, a),
      desloc: (p, t, a) => {
        if (!glace) {
          const b = 0.0025 * (1 - suave(0.05, 0.4, celula(p.x * 260, p.y * 260, p.z * 260, s))) * Math.max(0, Math.cos(a));
          p.y += b;
        }
        if (p.y < 0) p.y *= 0.2;
      },
    }), glace ? 'brilhante' : 'acetinado', true));
    // osso da canela saliente e a junta na ponta
    out.push(parte(osso([V(L * 0.26, H * 0.2, 0), V(L * 0.36, H * 0.18, 0), V(L * 0.44, H * 0.17, 0)], H * 0.09, glace ? mul(OSSO, 0.85) : mul(OSSO, 0.8), 1.5), 'acetinado'));
    return out;
  };
}

/* ------------------------------------------------------------------ */
/* linguiças                                                            */
/* ------------------------------------------------------------------ */

function linguicaEspiral(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, R = (L * k.L) / 2;
  const voltas = 3.2, N = 56;
  const passo = L / (2 * (0.55 + voltas));
  const Rt = Math.min(R, passo * 0.47);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * voltas * TAU;
    const rr = passo * (0.55 + ang / TAU);
    pts.push(V(Math.cos(ang) * rr, Rt, Math.sin(ang) * rr));
  }
  const grelhada: CorFn = (x, y, z) => {
    let c = mix(rgb('#b8603a'), rgb('#7a3a1a'), suave(-0.3, 0.7, fbm(x * 70, y * 70, z * 70, s)) * 0.8);
    c = mix(c, rgb('#d88a5a'), (1 - suave(0.1, 0.25, celula(x * 300, y * 300, z * 300, s))) * 0.25);
    // marcas da grelha só em cima
    const m = 1 - suave(0.08, 0.16, Math.min(fr(x / 0.018), 1 - fr(x / 0.018)));
    return mix(c, rgb('#2a1206'), m * suave(Rt * 1.3, Rt * 1.85, y) * 0.8);
  };
  out.push(parte(tubo(pts, { raio: (t) => Rt * (t < 0.02 || t > 0.98 ? 0.75 : 1), m: 14, n: N * 4, cor: grelhada }), 'brilhante', true));
  // dois espetos de madeira em cruz seguram a espiral
  const ext = passo * (0.55 + voltas) + Rt * 2.5;
  out.push(parte(espetoMadeira(V(-ext, Rt, -ext * 0.15), V(ext, Rt * 1.05, ext * 0.15), 0.0018), 'fosco'));
  out.push(parte(espetoMadeira(V(-ext * 0.15, Rt * 0.95, ext), V(ext * 0.15, Rt, -ext), 0.0018), 'fosco'));
  return out;
}

function linguicaGomos(k: Ctx): Parte[] {
  const kk = ctxCom(k, { v: 'gomos', n: 4 });
  const out = gLinguica(kk);
  const L = kk.T, R = (L * kk.L) / 2;
  const ng = 4, Lg = L / ng;
  const r = 0.0012;
  for (let i = 0; i < ng - 1; i++) {
    const ang = (i - (ng - 1) / 2) * 0.12;
    const cz = Math.sin(ang) * L * 0.15;
    for (const g of laco(-L / 2 + (i + 1) * Lg, R, R * 0.38, R * 0.38, r, { cz, no: true })) out.push(parte(g, 'fosco'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* carne moída moldada                                                  */
/* ------------------------------------------------------------------ */

function hamburguer(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  const cor = corMoida(c1, c2, s, 0.0025);
  return [parte(torno({
    caminho: (u) => {
      if (u < 0.2) return [R * 0.94 * (u / 0.2), 0];
      if (u < 0.45) { const q = (u - 0.2) / 0.25; return [R * 0.94 + R * 0.06 * Math.sin(q * PI), H * q]; }
      const q = (u - 0.45) / 0.55;
      // topo plano com a leve cova no meio que evita estufar
      return [R * (1 - q) * 0.97, H * (1 - 0.06 * Math.exp(-((1 - q) * (1 - q)) / 0.08) + 0.02 * Math.sin(q * PI))];
    },
    n: 30, m: 40, cor,
    desloc: (p) => {
      const r = Math.hypot(p.x, p.z);
      const k1 = 1 + 0.03 * fbm(p.x * 60, p.y * 60, p.z * 60, s) + 0.02 * (ruido(p.x * 400, p.y * 400, p.z * 400, s));
      if (r > 1e-6) { p.x *= k1; p.z *= k1; }
      p.y = Math.max(0, p.y * (1 + (k1 - 1) * 0.5));
    },
  }), 'acetinado', true)];
}

function brochette(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, Lc = L * 0.55, R = (L * k.L) / 2;
  const cor = corMoida(c1, c2, s, 0.0022);
  out.push(parte(corpo({
    x0: -Lc / 2, x1: Lc / 2, n: 30, m: 22, cor,
    perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 3)); return { ry: R * e, rz: R * e, cy: R }; },
    // marcas dos dedos apertando a carne em volta do espeto
    mod: (t, a) => 1 + 0.08 * Math.sin(t * PI * 9) * Math.max(0, Math.cos(a - 0.4)) + 0.04 * fbm(t * 8, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s),
  }), 'acetinado', true));
  for (const g of espetoMetal(V(-L / 2 + 0.008, R, 0), V(L / 2, R, 0), 0.0017)) out.push(parte(g, 'brilhante'));
  return out;
}

function almondega(k: Ctx): Parte[] {
  const { c1, c2, s } = k;
  const R = k.T / 2;
  const g = elipsoide(R, R * 0.92, R, corMoida(c1, c2, s, 0.002), 14, 18, (t, a) => 1 + 0.05 * fbm(t * 3, Math.cos(a) * 1.5, Math.sin(a) * 1.5, s));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -R * 0.75) p.setY(i, -R * 0.75 - (-R * 0.75 - p.getY(i)) * 0.3);
  g.computeVertexNormals();
  return [parte(g, 'acetinado', true)];
}

function boloDeCarne(moldado: boolean) {
  return (k: Ctx): Parte[] => {
    const { s } = k;
    const L = k.T, W = L * k.L, H = L * k.A;
    const ry = H / 2, rz = W / 2;
    const crosta = corAssada(rgb('#7a3e22'), rgb('#3e1c0e'), s, 50, 0.7);
    const moida = corMoida(rgb('#8a5a40'), rgb('#c8a080'), s, 0.003);
    const cor: CorFn = (x, y, z, t, a) => mix(moida(x, y, z, t, a), crosta(x, y, z, t, a), 0.65 + 0.2 * Math.max(0, Math.cos(a)));
    return [parte(corpo({
      x0: -L / 2, x1: L / 2, n: 30, m: 36, exp: moldado ? 6 : 3, cor,
      tampa: moldado, aneisTampa: moldado ? 3 : undefined,
      perfil: (t) => {
        const e = moldado ? 1 - 0.06 * (1 - suave(0, 0.04, Math.min(t, 1 - t))) : Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 3.5));
        return { ry: ry * e, rz: rz * e, cy: ry };
      },
      mod: (t, a) => 1 + (moldado ? 0.015 : 0.05) * fbm(t * 6, Math.cos(a) * 1.4, Math.sin(a) * 1.4, s),
      desloc: (p) => {
        // fôrma desenformada: base mais larga; forma livre: rachaduras na crosta
        if (moldado) p.z *= lerp(1.08, 0.9, clamp(p.y / H));
        if (p.y < ry * 0.25) p.y = ry * 0.25 - (ry * 0.25 - p.y) * 0.25;
      },
    }), 'acetinado', true)];
  };
}

function tartare(k: Ctx): Parte[] {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const rc = R * 0.3, fundo = H * 0.45;
  const cor: CorFn = (x, y, z) => {
    // carne picada na faca: cubinhos com reflexo, cebola e salsinha
    const cel = celula(x * 450, y * 450, z * 450, s);
    let c = mul(c1, 0.78 + 0.35 * suave(0.2, 0.8, cel) + 0.08 * fbm(x * 200, y * 200, z * 200, s));
    c = mix(c, rgb('#f2ead8'), 1 - suave(0.06, 0.12, celula(x * 380, y * 380, z * 380, s + 2)));
    return mix(c, rgb('#3a7a26'), 1 - suave(0.05, 0.11, celula(x * 420, y * 420, z * 420, s + 4)));
  };
  out.push(parte(torno({
    caminho: (u) => {
      if (u < 0.15) return [R * 0.95 * (u / 0.15), 0];
      if (u < 0.35) { const q = (u - 0.15) / 0.2; return [R * 0.95 + R * 0.05 * Math.sin(q * PI), H * q]; }
      const q = (u - 0.35) / 0.65;
      const r = R * (1 - q);
      // cova no centro para a gema
      return [r, r < rc * 1.4 ? H - fundo * Math.cos(clamp(r / (rc * 1.4)) * PI / 2) : H];
    },
    n: 34, m: 40, cor,
    desloc: (p) => { const k1 = 1 + 0.025 * fbm(p.x * 150, p.y * 150, p.z * 150, s); p.x *= k1; p.z *= k1; },
  }), 'umido', true));
  // gema crua inteira dentro da cova
  const gema = elipsoide(rc, rc * 0.62, rc, (x, y, z) => mix(rgb('#f0a414'), rgb('#ffd060'), suave(0, rc * 0.6, y) * 0.5), 10, 16);
  gema.translate(0, H - fundo + rc * 0.62, 0);
  out.push(parte(gema, 'brilhante'));
  return out;
}

/* ------------------------------------------------------------------ */
/* miúdos                                                               */
/* ------------------------------------------------------------------ */

function rinsEspeto(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const Lk = k.T * 0.55, Wk = Lk * 0.62, H = 0.013;
  for (const sg of [-1, 1]) {
    const cont = (xd: number, zd: number): [number, number] => {
      // feijão: borda de fora redonda, reentrância (hilo) voltada para o meio
      const z = (zd + 1) / 2;
      const recorte = 0.32 * Math.exp(-(xd * xd) / 0.12) * (1 - z) ** 2;
      return [xd * Lk / 2, sg * (Wk * (z * (1 - recorte) + recorte) + 0.002)];
    };
    const g = placa(26, 18, cont, (xd, zd, r) => H * (0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - r ** 6))), (x, y, z) => {
      if (y < H * 0.5) return mul(rgb('#6a2420'), 0.9 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
      // face cortada: córtex escuro em volta e medula raiada clara para o centro, miolo limpo
      const hx = x, hz = z - sg * 0.004;
      const d = Math.hypot(hx / (Lk / 2), hz / Wk);
      const ang = Math.atan2(hz, hx);
      let c = mix(rgb('#8a3a32'), rgb('#5a1a18'), suave(0.55, 0.85, d));
      c = mix(c, rgb('#b0605a'), Math.abs(Math.sin(ang * 14)) ** 6 * suave(0.75, 0.3, d) * 0.6);
      return mix(c, rgb('#d8a8a0'), (1 - suave(0.18, 0.28, d)) * 0.7);
    });
    out.push(parte(g, 'umido', true));
  }
  // espetos em cruz que mantêm as metades abertas e achatadas
  for (const sg of [-1, 1]) out.push(parte(espetoMadeira(V(-Lk * 0.75, H * 0.5, -sg * Wk * 1.25), V(Lk * 0.75, H * 0.55, sg * Wk * 1.25), 0.0015), 'fosco'));
  return out;
}

function massaSebo(k: Ctx): Parte[] {
  const { c1, s } = k;
  const R = k.T / 2, H = k.T * k.A;
  return [parte(torno({
    caminho: (u) => {
      if (u < 0.25) return [R * 0.92 * (u / 0.25), 0];
      const q = (u - 0.25) / 0.75;
      return [R * Math.cos(q * PI / 2) ** 0.55, H * Math.sin(q * PI / 2) ** 0.9];
    },
    n: 24, m: 36,
    cor: (x, y, z) => {
      // massa crua opaca, flocos de sebo e farinha polvilhada
      let c = mul(c1, 0.94 + 0.08 * fbm(x * 90, y * 90, z * 90, s));
      c = mix(c, rgb('#fbf8ee'), 1 - suave(0.08, 0.18, celula(x * 300, y * 300, z * 300, s)));
      return mix(c, rgb('#ffffff'), suave(0.4, 0.9, fbm(x * 40, y * 40, z * 40, s + 5)) * 0.35);
    },
    desloc: (p) => {
      const k1 = 1 + 0.035 * fbm(p.x * 50, p.y * 50, p.z * 50, s) - 0.02 * (1 - suave(0.0, 0.08, Math.abs(fbm(p.x * 25, 0, p.z * 25, s + 3))));
      p.x *= k1; p.z *= k1;
      p.y = Math.max(0, p.y * k1);
    },
  }), 'fosco', true)];
}

function coracaoRecheado(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const refogado = corAssada(rgb('#6a3020'), rgb('#3a160e'), s, 45, 0.8);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 26,
    cor: (x, y, z, t, a) => mix(refogado(x, y, z, t, a), rgb('#c8986a'), suave(0.22, 0.08, t) * 0.6 * (0.6 + 0.4 * fbm(x * 80, y * 80, z * 80, s))),
    perfil: (t) => { const e = Math.sin(PI * (0.06 + 0.94 * clamp(t) ** 0.8)) ** 0.55 * 1.02 + 0.01; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
    mod: (t, a) => 1 + 0.04 * Math.sin(a * 2 + t * 5) + 0.03 * fbm(t * 5, Math.cos(a), Math.sin(a), s),
    desloc: (p) => { if (p.y < H * 0.12) p.y = H * 0.12 - (H * 0.12 - p.y) * 0.3; },
  }), 'brilhante', true));
  // recheio aparecendo na abertura, com bacon e cebola
  const rech = elipsoide(L * 0.07, H * 0.3, W * 0.3, (x, y, z) => {
    let c = mix(rgb('#c8a46a'), rgb('#8a6a3e'), suave(-0.3, 0.7, fbm(x * 300, y * 300, z * 300, s)) * 0.7);
    c = mix(c, rgb('#b8505a'), (1 - suave(0.1, 0.2, celula(x * 250, y * 250, z * 250, s + 1))) * 0.7);
    return mix(c, rgb('#3a5a22'), (1 - suave(0.04, 0.1, celula(x * 400, y * 400, z * 400, s + 2))) * 0.6);
  }, 8, 14, (t, a) => 1 + 0.12 * fbm(t * 3, Math.cos(a) * 2, Math.sin(a) * 2, s));
  rech.translate(-L / 2 + L * 0.01, H * 0.55, 0);
  out.push(parte(rech, 'acetinado'));
  // espetos de madeira atravessando a borda de cima
  for (let i = 0; i < 3; i++) {
    const x = -L / 2 + L * (0.08 + i * 0.035);
    out.push(parte(espetoMadeira(V(x, H * (0.62 + 0.06 * i), -W * 0.62), V(x + L * 0.01, H * (0.66 + 0.04 * i), W * 0.62), 0.0014, false, rgb('#b89868')), 'fosco'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* lote                                                                 */
/* ------------------------------------------------------------------ */

const BOI = { c1: '#7c1e24', c2: '#e6d4bc', ci: '#8a2428', cc: '#6a3a2a', c3: '#c8c8c4' };
const PORCO = { c1: '#d48880', c2: '#f2e8dc', ci: '#e0988e', cc: '#c08a5a', c3: '#ecd6c0' };
const CORDEIRO = { c1: '#9c3638', c2: '#eee2d0', ci: '#b05050', cc: '#8a5030', c3: '#e4c8b8' };

export const LOTE: Lote = {
  'lagarto-lardeado': {
    visual: { f: 'carne', v: 'lagarto-lardeado', t: 0.3, a: 0.22, l: 0.24, ...BOI, ac: 'umido' },
    gerar: lagartoLardeado,
  },
  'lagarto-bardeado': {
    visual: { f: 'carne', v: 'lagarto-bardeado', t: 0.3, a: 0.24, l: 0.26, ...BOI },
    gerar: lagartoBardeado,
  },
  'lagarto-com-toucinho': {
    visual: { f: 'carne', v: 'lagarto-com-toucinho', t: 0.3, a: 0.24, l: 0.26, ...BOI },
    gerar: lagartoZiguezague,
  },
  'lagarto-recheado-amarrado': {
    visual: { f: 'carne', v: 'lagarto-recheado-amarrado', t: 0.28, a: 0.3, l: 0.32, ...BOI, ac: 'umido' },
    gerar: rolos('boi'),
  },
  'lombo-de-porco-enrolado': {
    visual: { f: 'carne', v: 'lombo-de-porco-enrolado', t: 0.26, a: 0.38, l: 0.4, ...PORCO },
    gerar: rolos('lombo'),
  },
  'file-de-porco-recheado': {
    visual: { f: 'carne', v: 'file-de-porco-recheado', t: 0.24, a: 0.23, l: 0.25, ...PORCO, ac: 'umido' },
    gerar: rolos('file'),
  },
  'file-de-porco-duplo-amarrado': {
    visual: { f: 'carne', v: 'file-de-porco-duplo-amarrado', t: 0.26, a: 0.28, l: 0.35, ...PORCO, ac: 'umido' },
    gerar: rolos('dois'),
  },
  'paleta-de-cordeiro-enrolada': {
    visual: { f: 'carne', v: 'paleta-de-cordeiro-enrolada', t: 0.26, a: 0.38, l: 0.42, c1: '#7a4026', c2: '#c8a070', ci: '#9a6a58', cc: '#6a3a20', c3: '#5a6a2a', ac: 'brilhante' },
    gerar: rolos('paleta'),
  },
  'escalope-de-vitela-enrolado': {
    visual: { f: 'carne', v: 'escalope-de-vitela-enrolado', t: 0.085, a: 0.42, l: 0.42, c1: '#e8aaa2', c2: '#f4ece4', ci: '#e8aaa2', cc: '#c08a5a', ac: 'umido' },
    gerar: rolinho('paupiette'),
  },
  'bacon-enrolado': {
    visual: { f: 'carne', v: 'bacon-enrolado', t: 0.05, a: 0.6, l: 0.6, c1: '#c4586a', c2: '#f4e8dc', ci: '#3a1828', cc: '#a85a2a' },
    gerar: rolinho('bacon'),
  },
  'file-mignon-recheado-fatiado': {
    visual: { f: 'carne', v: 'file-mignon-recheado-fatiado', t: 0.22, a: 0.36, l: 0.38, c1: '#5a2a18', c2: '#3a2a1c', ci: '#c4404a', cc: '#5a2a18' },
    gerar: fileRecheadoFatiado,
  },
  'file-wellington-fatiado': {
    visual: { f: 'carne', v: 'file-wellington-fatiado', t: 0.36, a: 0.26, l: 0.3, c1: '#c8822e', c2: '#3a2818', ci: '#c4404a', cc: '#c8822e' },
    gerar: wellington,
  },
  'file-mignon-com-pimenta': {
    visual: { f: 'carne', v: 'file-mignon-com-pimenta', t: 0.075, a: 0.42, l: 1, c1: '#8a1e26', c2: '#e6d4bc', ci: '#8a2428', cc: '#6a3a2a', ac: 'umido' },
    gerar: bifePimenta,
  },
  'file-mignon-grelhado-quadriculado': {
    visual: { f: 'carne', v: 'file-mignon-grelhado-quadriculado', t: 0.085, a: 0.36, l: 0.86, c1: '#8a3a30', c2: '#5a2a16', ci: '#c4505a', cc: '#7a3e22' },
    gerar: bifeGrelha,
  },
  'manteiga-temperada-rodelas': {
    visual: { f: 'queijo', v: 'manteiga-temperada-rodelas', t: 0.1, a: 0.1, l: 0.4, c1: '#f2dc8a', c2: '#b07890', ci: '#f4e2a0', cc: '#e8c060' },
    gerar: manteigaTemperada,
  },
  gremolada: {
    visual: { f: 'erva', v: 'gremolada', t: 0.05, a: 0.25, l: 1, c1: '#3a7a24', c2: '#f2eedc', c3: '#f0c820', ci: '#3a7a24', cc: '#3a6a20', ac: 'fosco' },
    gerar: gremolada,
  },
  alcaparras: {
    visual: { f: 'baga', v: 'alcaparras', t: 0.03, a: 0.4, l: 1, c1: '#5e6e30', c2: '#3e4a1e', ci: '#8a9a5a', cc: '#5e6e30', ac: 'brilhante' },
    gerar: alcaparras,
  },
  cornichons: {
    visual: { f: 'fuso', v: 'cornichons', t: 0.055, a: 0.25, l: 0.6, c1: '#3e5a22', c2: '#7a8a4a', ci: '#c8c47a', cc: '#5a6a2a', ac: 'brilhante' },
    gerar: cornichons,
  },
  'parmesao-em-lascas': {
    visual: { f: 'queijo', v: 'parmesao-em-lascas', t: 0.06, a: 0.15, l: 0.9, c1: '#ecdca0', c2: '#d8c080', ci: '#f2e4b0', cc: '#d8b870' },
    gerar: lascasParmesao,
  },
  'perna-de-cordeiro-desossada': {
    visual: { f: 'carne', v: 'perna-de-cordeiro-desossada', t: 0.34, a: 0.32, l: 0.36, ...CORDEIRO, ac: 'umido' },
    gerar: pernaDesossada,
  },
  'perna-de-cordeiro-em-massa': {
    visual: { f: 'carne', v: 'perna-de-cordeiro-em-massa', t: 0.38, a: 0.36, l: 0.4, c1: '#d0943e', c2: '#9a5a20', ci: '#b05050', cc: '#d0943e', ac: 'brilhante' },
    gerar: pernaMassa,
  },
  'lombo-de-cordeiro-em-crosta': {
    visual: { f: 'carne', v: 'lombo-de-cordeiro-em-crosta', t: 0.2, a: 0.26, l: 0.32, ...CORDEIRO },
    gerar: lomboCrosta,
  },
  'perna-de-cordeiro-com-alho': {
    visual: { f: 'carne', v: 'perna-de-cordeiro-com-alho', t: 0.4, a: 0.3, l: 0.32, ...CORDEIRO, d: 'pele' },
    gerar: pernaAlho,
  },
  'espetinho-de-cordeiro': {
    visual: { f: 'carne', v: 'espetinho-de-cordeiro', t: 0.26, a: 0.13, l: 0.13, ...CORDEIRO, cc: '#6a3a20' },
    gerar: espetinhoCordeiro,
  },
  'cordeiro-no-peritonio': {
    visual: { f: 'carne', v: 'cordeiro-no-peritonio', t: 0.05, a: 0.5, l: 0.78, c1: '#9a5428', c2: '#e8b870', ci: '#a86a58', cc: '#9a5428', ac: 'brilhante' },
    gerar: emPeritonio('nugget'),
  },
  'carne-de-porco-crepinette': {
    visual: { f: 'carne_moida', v: 'carne-de-porco-crepinette', t: 0.07, a: 0.3, l: 1, c1: '#9a5428', c2: '#e8b870', ci: '#c89a88', cc: '#9a5428', ac: 'brilhante' },
    gerar: emPeritonio('crepinette'),
  },
  'abobrinha-petit-tian': {
    visual: { f: 'torta', v: 'abobrinha-petit-tian', t: 0.075, a: 0.4, l: 1, c1: '#2e5a1e', c2: '#c8201a', ci: '#d8a860', cc: '#c8903a' },
    gerar: petitTian,
  },
  'pernil-com-torresmo': {
    visual: { f: 'carne', v: 'pernil-com-torresmo', t: 0.5, a: 0.35, l: 0.38, c1: '#d89a48', c2: '#f2cc84', ci: '#f0dcc8', cc: '#b8783a' },
    gerar: pernilAssado('torresmo'),
  },
  'pernil-glaceado': {
    visual: { f: 'carne', v: 'pernil-glaceado', t: 0.5, a: 0.35, l: 0.38, c1: '#c87a2e', c2: '#4a1e08', ci: '#e8a8a0', cc: '#b8641e', ac: 'brilhante' },
    gerar: pernilAssado('glaceado'),
  },
  'linguica-em-espiral': {
    visual: { f: 'linguica', v: 'linguica-em-espiral', t: 0.2, l: 0.13, c1: '#b8603a', c2: '#7a3a1a', ci: '#d8a088', cc: '#9a5a32', ac: 'brilhante' },
    gerar: linguicaEspiral,
  },
  'linguica-em-gomos-amarrados': {
    visual: { f: 'linguica', v: 'linguica-em-gomos-amarrados', t: 0.4, l: 0.08, c1: '#c8705a', c2: '#f2dccc', ci: '#c87a6a', cc: '#9a5a32', n: 4 },
    gerar: linguicaGomos,
  },
  'carne-moida-hamburguer': {
    visual: { f: 'carne_moida', v: 'carne-moida-hamburguer', t: 0.11, a: 0.36, l: 1, c1: '#8a262a', c2: '#e2c4b4', ci: '#8a262a', cc: '#7a4a30' },
    gerar: hamburguer,
  },
  'carne-moida-no-espeto': {
    visual: { f: 'carne_moida', v: 'carne-moida-no-espeto', t: 0.24, a: 0.15, l: 0.15, c1: '#a8484a', c2: '#ecd4c4', ci: '#a8484a', cc: '#7a4a30' },
    gerar: brochette,
  },
  'carne-moida-almondega': {
    visual: { f: 'carne_moida', v: 'carne-moida-almondega', t: 0.04, a: 0.9, l: 1, c1: '#8e3030', c2: '#e2c4b4', ci: '#8e3030', cc: '#7a4a30' },
    gerar: almondega,
  },
  'carne-moida-bolo-assado': {
    visual: { f: 'carne_moida', v: 'carne-moida-bolo-assado', t: 0.22, a: 0.34, l: 0.48, c1: '#7a3e22', c2: '#c8a080', ci: '#9a6a54', cc: '#7a3e22' },
    gerar: boloDeCarne(false),
  },
  'carne-moida-bolo-moldado': {
    visual: { f: 'carne_moida', v: 'carne-moida-bolo-moldado', t: 0.22, a: 0.36, l: 0.46, c1: '#7a3e22', c2: '#c8a080', ci: '#9a6a54', cc: '#7a3e22' },
    gerar: boloDeCarne(true),
  },
  'carne-moida-tartare': {
    visual: { f: 'carne_moida', v: 'carne-moida-tartare', t: 0.09, a: 0.26, l: 1, c1: '#9a1e26', c2: '#e2c4b4', ci: '#9a1e26', cc: '#7a4a30', ac: 'umido' },
    gerar: tartare,
  },
  'rim-aberto-no-espeto': {
    visual: { f: 'miudo', v: 'rim-aberto-no-espeto', t: 0.11, a: 0.15, l: 0.75, c1: '#6a2420', c2: '#8a3a32', ci: '#8a3a32', cc: '#6a4030', ac: 'umido' },
    gerar: rinsEspeto,
  },
  'sebo-massa-crua': {
    visual: { f: 'massa', v: 'sebo-massa-crua', t: 0.14, a: 0.24, l: 1, c1: '#ece0c6', c2: '#fbf8ee', ci: '#ece0c6', cc: '#d8b070', ac: 'fosco' },
    gerar: massaSebo,
  },
  'coracao-recheado': {
    visual: { f: 'miudo', v: 'coracao-recheado', t: 0.14, a: 0.6, l: 0.62, c1: '#6a3020', c2: '#3a160e', ci: '#7a4a3a', cc: '#5a2a1a', ac: 'brilhante' },
    gerar: coracaoRecheado,
  },
};


