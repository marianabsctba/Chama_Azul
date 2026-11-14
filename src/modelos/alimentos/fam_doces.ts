// Famílias de líquidos em recipiente, cremes, bolos, tortas, confeitos,
// massa choux, folhados e merengues.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, tf, parte, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from './nucleo';
import { folha, caule, contornos, grao, disco, type Ctx, type Gerador } from './pecas';
import { fruto } from './fam_vegetais';

const BRANCO: RGB = [0.92, 0.92, 0.9];

/* ------------------------------------------------------------------ */
/* recipiente com conteúdo (líquidos, cremes em taça, pudins)           */
/* ------------------------------------------------------------------ */

/** Perfil de recipiente com parede: sobe por fora e desce por dentro até o fundo. */
function caminhoRecipiente(Rb: number, Rt: number, H: number, esp: number): [number, number][] {
  return [[0, 0], [Rb * 0.95, 0], [Rb, esp * 0.5], [Rt, H], [Rt - esp * 0.6, H + esp * 0.3], [Rt - esp, H * 0.98], [Rb - esp, esp * 1.2], [Rb * 0.6, esp], [0, esp]];
}

export const gRecipiente: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const D = k.T, H = D * k.A;
  const R = D / 2;
  const corVaso: CorFn = (x, y, z) => mul(c2, 1 + 0.03 * fbm(x * 30, y * 30, z * 30, s));
  const nivel = k.v.l ?? 0.75; // fração da altura ocupada
  const corLiq: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.04 * fbm(x * 40, y * 40, z * 40, s));
    if (k.tem('ervas')) c = mix(c, c3, 1 - suave(0.08, 0.16, celula(x * 90, 0, z * 90, s)));
    if (k.tem('espuma')) c = mix(c, mul(c1, 1.15), suave(0.2, 0.8, fbm(x * 120, 0, z * 120, s)));
    if (k.tem('noz')) c = mix(c, [0.45, 0.3, 0.15], 1 - suave(0.05, 0.1, celula(x * 160, 0, z * 160, s)));
    if (k.tem('crosta')) c = mix(c3, mul(c3, 0.75), suave(0.3, 0.8, fbm(x * 60, 0, z * 60, s)));
    if (k.tem('cristais')) c = mix(c, mul(c1, 1.4), 1 - suave(0.15, 0.3, celula(x * 200, y * 200, z * 200, s)));
    return c;
  };
  if (v === 'garrafa') {
    const Rg = R, Hc = H * 0.62;
    const corG: CorFn = (x, y, z) => (y > Hc * 0.25 && y < Hc * 0.75 ? mul(c3, 1 + 0.03 * fbm(x * 50, y * 50, z * 50, s)) : mix(mul(c2, 0.9), c1, 0.5));
    out.push(parte(torno({ caminho: [[0, 0], [Rg * 0.95, 0], [Rg, Rg * 0.1], [Rg, Hc], [Rg * 0.9, Hc + Rg * 0.4], [Rg * 0.38, Hc + Rg * 0.9], [Rg * 0.32, H * 0.94], [Rg * 0.36, H * 0.96], [Rg * 0.33, H], [0, H]], n: 30, m: 28, cor: corG }), 'brilhante', true));
    out.push(parte(tf(disco(Rg * 0.35, H * 0.04, () => [0.12, 0.12, 0.12], { n: 8, m: 16 }), [0, H * 0.985, 0]), 'acetinado'));
    return out;
  }
  if (v === 'lata') {
    const L = D, W = L * 0.55, Hh = L * k.A;
    out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 12, m: 34, exp: 6, tampa: true, cor: (x, y, z) => (y > Hh * 0.92 ? mix(c1, mul(c1, 0.7), Math.abs(Math.sin(z * 260)) ** 8) : mul(c2, 1 + 0.05 * Math.sin(y * 900))), corTampa: () => c2, perfil: () => ({ ry: Hh / 2, rz: W / 2, cy: Hh / 2 }) }), 'brilhante', true));
    return out;
  }
  if (v === 'travessa') {
    const L = D, W = L * 0.65;
    out.push(parte(torno({ caminho: caminhoRecipiente(R * 0.85, R, H, R * 0.06), n: 26, m: 36, l: W / L, cor: corVaso }), 'brilhante', true));
    const hl = H * nivel;
    out.push(parte(tf(disco((R * 0.85 + (R - R * 0.85) * nivel) - R * 0.07, hl * 0.6 + (k.tem('crosta') || k.tem('domo') ? H * 0.2 : 0), corLiq, { n: 18, m: 34, l: W / L, borda: 0.8 }), [0, hl * 0.4, 0]), k.ac));
    return out;
  }
  // tigela, taça, ramequim, pote
  const Rb = v === 'taca' ? R * 0.45 : v === 'ramequim' ? R * 0.95 : v === 'pote' ? R * 0.95 : R * 0.62;
  const esp = R * (v === 'taca' ? 0.04 : 0.07);
  let caminho = caminhoRecipiente(Rb, R, H, esp);
  if (v === 'taca') {
    // taça com pé
    const Hp = H * 0.4;
    caminho = [[0, 0], [R * 0.55, 0], [R * 0.5, H * 0.03], [R * 0.08, H * 0.06], [R * 0.06, Hp], [Rb, Hp + H * 0.1], [R, H], [R - esp, H], [Rb - esp, Hp + H * 0.12], [0, Hp + H * 0.1]];
  }
  const ramequim = v === 'ramequim';
  out.push(parte(torno({ caminho, n: 30, m: 36, cor: corVaso, mod: ramequim ? (t, a) => 1 + 0.025 * Math.abs(Math.cos(a * 14)) * (t < 0.5 ? 1 : 0) : undefined }), 'brilhante', true));
  const base = v === 'taca' ? H * 0.5 : esp;
  const hl = lerp(base, H * 0.97, nivel);
  const rAt = (h: number) => (v === 'taca' ? lerp(Rb, R, (h - H * 0.5) / (H * 0.5)) : lerp(Rb, R, h / H)) - esp * 1.05;
  const domo = k.tem('domo') ? H * 0.45 : 0;
  const conteudo = torno({
    caminho: [[0, base], [rAt(base + esp) * 0.98, base + esp * 0.2], [rAt(hl), hl], ...(domo ? [[rAt(H) * 1.02, H] as [number, number], [rAt(H) * 1.0, H + domo * 0.7] as [number, number], [rAt(H) * 0.7, H + domo] as [number, number], [0, H + domo * 1.05] as [number, number]] : [[rAt(hl) * 0.6, hl + esp * 0.1] as [number, number], [0, hl + esp * 0.15] as [number, number]])],
    n: 20, m: 30, cor: corLiq,
    mod: k.tem('picos') ? (t, a) => 1 + 0.06 * Math.sin(a * 6 + t * 10) : undefined,
    desloc: k.tem('cristais') || k.tem('aerado') ? (p) => { if (p.y > hl - esp) p.y += esp * 2 * (0.5 + 0.5 * fbm(p.x * 120, 0, p.z * 120, s)); } : undefined,
  });
  out.push(parte(conteudo, k.ac, false));
  if (k.tem('tampado')) {
    // papel alumínio amarrado
    out.push(parte(torno({ caminho: [[0, H * 1.0], [R * 1.05, H * 0.98], [R * 1.12, H * 0.75], [R * 1.08, H * 0.7], [R * 1.0, H * 0.95], [0, H * 1.08]], n: 16, m: 30, cor: (x, y, z) => mul([0.78, 0.78, 0.8], 0.9 + 0.2 * ruido(x * 120, y * 120, z * 120, s)), mod: (t, a) => 1 + 0.03 * Math.sin(a * 17) }), 'brilhante'));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 20; i++) pts.push(V(Math.cos((i / 20) * TAU) * R * 1.1, H * 0.8, Math.sin((i / 20) * TAU) * R * 1.1));
    out.push(parte(tubo(pts, { raio: R * 0.015, m: 4, n: 40, fechado: true, cor: () => [0.8, 0.72, 0.55] }), 'fosco'));
    out.push(parte(tubo([V(-R * 1.1, H * 0.8, 0), V(-R * 0.5, H * 1.3, 0), V(R * 0.5, H * 1.3, 0), V(R * 1.1, H * 0.8, 0)], { raio: R * 0.015, m: 4, n: 20, cor: () => [0.8, 0.72, 0.55] }), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* pastas e cremes em monte                                             */
/* ------------------------------------------------------------------ */

export const gPasta: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.05 * fbm(x * 70, y * 70, z * 70, s));
    if (k.tem('pontos')) c = mix(c, c2, 1 - suave(0.08, 0.18, celula(x * 260, y * 260, z * 260, s)));
    if (k.tem('mesclado')) c = mix(c, c2, suave(0.2, 0.7, fbm(x * 60, y * 60, z * 60, s)) * 0.5);
    return c;
  };
  if (v === 'swirl') {
    // creme de confeiteiro em espiral com pico
    const voltas = 3;
    const g = torno({
      caminho: (u) => {
        const th = u * PI;
        const r = R * Math.sin(th) ** 0.6 * (1 - u * 0.4);
        const h = H * (1 - Math.cos(th)) / 2;
        return [u > 0.92 ? r * 0.3 : r, h + (u > 0.9 ? H * 0.15 * (u - 0.9) * 10 : 0)];
      },
      n: 30, m: 32, cor,
      mod: (t, a) => 1 - 0.16 * (1 - Math.abs(Math.sin(t * PI * voltas * 1.6 - a / 2))) ** 3 * suave(0.1, 0.3, t) + (k.tem('estrias') ? 0.05 * Math.cos(a * 8 + t * 10) : 0),
    });
    return [parte(g, k.ac, true)];
  }
  // monte macio irregular
  const g = torno({
    caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.7, (H * (1 - Math.cos(th))) / 2 * (u < 0.5 ? 0.3 : 1)]; },
    n: 24, m: 30, cor,
    mod: (t, a) => 1 + 0.12 * fbm(Math.cos(a) * 1.5, Math.sin(a) * 1.5, t * 2, s) * suave(0.2, 0.5, t),
    desloc: (p) => { p.y *= 1 + 0.15 * fbm(p.x * 40, 0, p.z * 40, s + 1); },
  });
  void c3;
  return [parte(g, k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* bolos                                                                */
/* ------------------------------------------------------------------ */

export const gBolo: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const D = k.T, H = D * k.A, R = D / 2;
  const nc = k.v.n ?? 3;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 1 + 0.04 * fbm(x * 60, y * 60, z * 60, s));
    const lado = Math.hypot(x, z) > R * 0.93;
    if (k.tem('camadas') && lado) c = mix(ci, c2, suave(0.45, 0.6, Math.sin((y / H) * PI * nc * 2)));
    if (k.tem('base') && y < H * 0.18) c = c3;
    if (k.tem('frutas') && y > H * 0.9) c = mix(c, c3, 1 - suave(0.12, 0.22, celula(x * 50, 0, z * 50, s)));
    if (k.tem('nome') && y > H * 0.95) c = mix(c, c2, (1 - suave(0, R * 0.02, Math.abs(z - Math.sin(x * 60) * R * 0.08))) * (Math.abs(x) < R * 0.5 ? 1 : 0));
    if (k.tem('renda') && y > H * 0.95) c = mix(c, BRANCO, suave(0.5, 0.7, Math.sin(Math.atan2(z, x) * 12) * Math.sin(Math.hypot(x, z) * 200)));
    if (k.tem('ouro') && y > H * 0.95) c = mix(c, [0.85, 0.65, 0.2], 1 - suave(R * 0.08, R * 0.12, Math.hypot(x - R * 0.2, z)));
    if (k.tem('fitas') && lado) c = mix(c, mul(c1, 0.75), Math.abs(Math.sin(Math.atan2(z, x) * 30)) ** 4);
    if (k.tem('cigarros') && lado) c = mix(c, mul(c2, 0.8), Math.abs(Math.sin(Math.atan2(z, x) * 40)) ** 2);
    if (k.tem('frutasdentro')) {
      // pedaços de fruta cristalizada e passas aparecendo na massa escura
      const ff = 4.5 / R;
      const cel = celula(x * ff, y * ff, z * ff, s);
      const tipo = ruido(Math.floor(x * ff) * 7.1, Math.floor(y * ff) * 3.3, Math.floor(z * ff) * 5.7, s + 2);
      const fruta: RGB = tipo > 0.3 ? c3 : tipo > -0.2 ? [0.55, 0.42, 0.08] : [0.12, 0.05, 0.03];
      c = mix(c, fruta, (1 - suave(0.16, 0.3, cel)) * 0.9);
    }
    if (k.tem('crosta')) {
      // casca dourada mais escura em cima e nos lados, com poros
      const poro = 1 - suave(0.08, 0.18, celula(x * 260, y * 260, z * 260, s));
      c = mul(mix(c, c2, suave(H * 0.85, H, y) * 0.8 + 0.25), 1 - poro * 0.12);
    }
    if (k.tem('calda')) c = mix(c, c2, suave(H * 0.62, H * 0.8, y + H * 0.08 * Math.sin(Math.atan2(z, x) * 7)));
    return c;
  };
  switch (v) {
    case 'cilindro': case 'quadrado': {
      const quad = v === 'quadrado';
      if (quad) {
        const corQ: CorFn = (x, y, z) => {
          const lado = Math.max(Math.abs(x), Math.abs(z)) > R * 0.94;
          let c = cor(x, y, z, 0, 0);
          if (k.tem('camadas') && lado) c = mix(ci, c2, suave(0.45, 0.6, Math.sin((y / H) * PI * nc * 2)));
          return c;
        };
        out.push(parte(corpo({ x0: -R, x1: R, n: 18, m: 36, exp: 8, tampa: true, linear: true, cor: corQ, corTampa: corQ, perfil: () => ({ ry: H / 2, rz: R * k.L, cy: H / 2 }) }), k.ac, true));
      } else {
        const b = Math.min(R, H) * 0.08;
        // bolo de frutas e pão de ló: topo levemente abaulado e malha mais fina para os pedaços aparecerem
        const domo = k.tem('frutasdentro') || k.tem('crosta') ? 0.06 : 0;
        const fino = k.tem('frutasdentro');
        out.push(parte(torno({
          caminho: [[0, 0], [R * 0.9, 0], [R, b], [R, H - b], [R - b * 1.2, H], [R * 0.5, H * (1 + domo * 0.7)], [0, H * (1 + domo)]],
          n: fino ? 44 : 30, m: fino ? 60 : 40, cor,
          mod: k.tem('canelado') ? (t, a) => 1 + 0.04 * Math.abs(Math.cos(a * 8)) : undefined,
          desloc: domo ? (p) => { if (p.y > H * 0.9) p.y += H * 0.02 * fbm(p.x * 30, 0, p.z * 30, s); } : undefined,
        }), k.ac, true));
        if (k.tem('frutasdentro')) {
          // cerejas cristalizadas e amêndoas por cima
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU, rr = R * (i % 3 === 0 ? 0.3 : 0.62);
            const yTopo = H * (1 + domo * (1 - (rr / R) ** 2) * 0.9);
            if (i % 2 === 0) out.push(parte(tf(elipsoide(R * 0.07, R * 0.05, R * 0.07, (x, y, z) => mul(c3, 0.9 + 0.2 * ruido(x * 300, y * 300, z * 300, s)), 6, 10), [Math.cos(a) * rr, yTopo, Math.sin(a) * rr]), 'brilhante'));
            else out.push(parte(tf(elipsoide(R * 0.09, R * 0.025, R * 0.05, () => [0.62, 0.42, 0.24], 5, 8), [Math.cos(a) * rr, yTopo, Math.sin(a) * rr], [0, -a, 0]), 'acetinado'));
          }
        }
      }
      if (k.tem('leque')) {
        for (let i = 0; i < 9; i++) {
          const g = folha(R * 0.6, R * 0.25, c2, c2, { contorno: contornos.gota, esp: R * 0.01, ondula: 0.1, n: 8, m: 6 });
          tf(g, [0, H * 1.01, 0], [0, (i / 9) * PI - PI / 2, 0.35]);
          out.push(parte(g, 'brilhante'));
        }
      }
      if (k.tem('cigarros3d')) {
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * TAU;
          out.push(parte(tubo([V(Math.cos(a) * R * 1.03, 0, Math.sin(a) * R * 1.03), V(Math.cos(a) * R * 1.03, H * 1.12, Math.sin(a) * R * 1.03)], { raio: R * 0.035, m: 6, n: 4, cor: () => mul(c2, 0.9) }), 'acetinado'));
        }
      }
      return out;
    }
    case 'sanduiche': {
      for (let i = 0; i < 2; i++) {
        const y0 = i * H * 0.52;
        out.push(parte(tf(disco(R, H * 0.44, (x, y, z) => mix(cor(x, y, z, 0, 0), BRANCO, i === 1 && y > H * 0.4 ? 0.5 * (1 - suave(0.1, 0.3, celula(x * 300, 0, z * 300, s))) : 0), { n: 18, m: 36 }), [0, y0, 0]), k.ac, true));
      }
      out.push(parte(tf(disco(R * 0.96, H * 0.1, () => c3, { n: 8, m: 36 }), [0, H * 0.42, 0]), 'brilhante', true));
      return out;
    }
    case 'anel': {
      const rIn = R * 0.3;
      out.push(parte(tornoAnel({ caminho: [[R, 0], [R * 0.98, H * 0.9], [R * 0.9, H], [rIn * 1.1, H], [rIn, H * 0.9], [rIn, 0]], n: 30, m: 44, cor, mod: k.tem('canelado') ? (t, a) => 1 + 0.05 * Math.abs(Math.cos(a * 7 + t * 3)) : undefined }), k.ac, true));
      return out;
    }
    case 'cupula': {
      const nf = k.v.n ?? 10;
      const cor2: CorFn = (x, y, z, t, a) => {
        let c = cor(x, y, z, t, a);
        if (k.tem('fatias')) c = mix(c, mul(c1, 0.75), Math.abs(Math.sin(a * nf / 2 + Math.floor(y / H * 4) * 0.8)) ** 20 + Math.abs(Math.sin(y / H * PI * 4)) ** 30);
        return c;
      };
      out.push(parte(torno({ caminho: [[0, 0], [R * 0.95, 0], [R, H * 0.15], [R * 0.88, H * 0.6], [R * 0.55, H * 0.92], [0, H]], n: 28, m: 40, cor: cor2, mod: k.tem('canelado') ? (t, a) => 1 + 0.06 * Math.abs(Math.cos((a * nf) / 2)) ** 0.6 - 0.03 : undefined }), k.ac, true));
      return out;
    }
    case 'rolo': {
      const L = D, Rr = L * k.L / 2;
      const espiral: CorFn = (x, y, z) => {
        const r = Math.hypot(y - Rr, z) / Rr;
        const ang = Math.atan2(z, y - Rr);
        const f = (r * 3.2 - ang / TAU) % 1;
        const ff = f < 0 ? f + 1 : f;
        // massa clara, faixa de recheio e a casca dourada fininha de cada volta
        const c = mix(ci, c2, suave(0.62, 0.72, ff) * (1 - suave(0.86, 0.92, ff)));
        return mix(c, c1, suave(0.9, 0.97, ff) * 0.8 + suave(0.93, 0.99, r));
      };
      // casca dourada com açúcar polvilhado por cima; nas pontas, a espiral de massa e recheio
      // emenda da última volta da massa, de lado: um degrau com um fio de recheio aparecendo
      const aEmenda = 1.15;
      const casca: CorFn = (x, y, z, t, a) => {
        const dA = Math.abs(a - aEmenda);
        if (dA < 0.06) return mix(c2, mul(c1, 0.6), dA / 0.06);
        const c = mul(c1, 0.95 + 0.1 * fbm(x * 70, y * 70, z * 70, s));
        // superfície assada: dourado mais escuro em cima, mais claro embaixo
        return mul(c, lerp(0.92, 1.05, suave(Rr * 1.8, Rr * 0.4, y)));
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 20, m: 64, tampa: true, aneisTampa: 14, cor: casca, corTampa: espiral,
        perfil: () => ({ ry: Rr, rz: Rr, cy: Rr }),
        mod: (t, a) => 0.965 + 0.035 * (((a - aEmenda) % TAU) + TAU) % TAU / TAU + 0.01 * fbm(t * 8, Math.cos(a) * 2, Math.sin(a) * 2, s),
        desloc: (p) => { if (p.y < Rr * 0.15) p.y = Rr * 0.15 - (Rr * 0.15 - p.y) * 0.3; },
      }), k.ac, true));
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* tortas                                                               */
/* ------------------------------------------------------------------ */

export const gTorta: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const D = k.T, H = D * k.A, R = D / 2;
  const l = v === 'barco' ? 0.45 : 1;
  const nf = 24;
  const massa: CorFn = (x, y, z) => mix(c1, mul(c1, 0.75), suave(0.2, 0.9, fbm(x * 60, y * 60, z * 60, s)) * 0.5);
  const esp = R * 0.06;
  // casca canelada com parede
  out.push(parte(torno({
    caminho: v === 'tatin' ? [[0, 0], [R * 0.95, 0], [R, H * 0.3], [R * 0.95, H], [0, H]] : [[0, 0], [R * 0.85, 0], [R, H * 0.15], [R, H], [R - esp, H * 1.02], [R - esp, H * 0.2], [R * 0.8, esp], [0, esp]],
    n: 26, m: 48, l, cor: v === 'tatin' ? (x, y, z) => (y > H * 0.9 ? mix(c3, mul(c3, 0.6), Math.abs(Math.sin(Math.atan2(z, x) * 7 + Math.hypot(x, z) * 30)) ** 2) : massa(x, y, z, 0, 0)) : massa,
    mod: v === 'tatin' ? undefined : (t, a) => 1 + 0.035 * Math.abs(Math.cos((a * nf) / 2)) * (t < 0.55 ? 1 : 0),
  }), k.ac, true));
  if (v === 'fundo' || v === 'tatin') return out;
  // recheio
  const corR: CorFn = (x, y, z) => {
    let c = mul(c2, 1 + 0.05 * fbm(x * 60, y * 60, z * 60, s));
    if (k.tem('frutas')) c = mix(c, c3, 1 - suave(0.15, 0.3, celula(x * 60 / D * 0.2, 0, z * 60 / D * 0.2, s)));
    if (k.tem('caramelizado')) c = mix(c, mul(c2, 0.55), suave(0.3, 0.9, fbm(x * 80, 0, z * 80, s)) * 0.6);
    return c;
  };
  if (v === 'tampa') {
    out.push(parte(torno({ caminho: [[0, H * 1.25], [R * 0.95, H * 1.02], [R * 1.02, H * 0.95], [R * 0.98, H * 0.9], [0, H * 0.9]].reverse() as [number, number][], n: 20, m: 40, cor: (x, y, z) => mix(massa(x, y, z, 0, 0), mul(c1, 0.5), 1 - suave(R * 0.05, R * 0.08, Math.hypot(x, z))), mod: (t, a) => 1 + 0.03 * Math.abs(Math.sin(a * 20)) * suave(0.4, 0.2, Math.abs(t - 0.2)) }), k.ac, true));
    return out;
  }
  out.push(parte(tf(disco((R - esp) * 0.99, H * 0.25, corR, { n: 12, m: 40, l, borda: 0.8 }), [0, H * 0.72, 0]), k.tem('frutas') || k.tem('brilho') ? 'brilhante' : k.ac));
  if (v === 'trelica') {
    for (let i = -3; i <= 3; i++) {
      for (const dir of [0, 1]) {
        const off = (i / 3.5) * R * 0.85;
        const cmp = Math.sqrt(Math.max(0, R * R - off * off)) * 0.95;
        const p0 = dir ? V(off, H * 1.0, -cmp) : V(-cmp, H * 1.0, off);
        const p1 = dir ? V(off, H * 1.0, cmp) : V(cmp, H * 1.0, off);
        out.push(parte(tubo([p0, p0.clone().lerp(p1, 0.5).add(V(0, H * 0.06, 0)), p1], { raio: H * 0.06, achata: 3, cima: V(0, 1, 0), m: 6, n: 12, cor: massa }), k.ac));
      }
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* confeitos: biscoitos, telhas, chocolates de decoração                */
/* ------------------------------------------------------------------ */

export const gConfeito: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const R = L / 2;
  const cor: CorFn = (x, y, z) => {
    let c = mix(c1, c2, suave(0.3, 0.9, fbm(x * 90, y * 90, z * 90, s)) * 0.4);
    if (k.tem('acucar')) c = mix(c, BRANCO, 1 - suave(0.08, 0.16, celula(x * 400, y * 400, z * 400, s)));
    if (k.tem('sementes')) c = mix(c, [0.05, 0.05, 0.05], 1 - suave(0.06, 0.12, celula(x * 300, y * 300, z * 300, s)));
    if (k.tem('renda')) c = mix(c, mul(c1, 0.55), suave(0.6, 0.85, celula(x * 160, y * 160, z * 160, s)));
    if (k.tem('borda')) c = mix(c, c2, suave(0.75, 0.95, Math.hypot(x / (L / 2), z / (W / 2))));
    if (k.tem('veios')) c = mix(c, mul(c1, 0.7), (1 - suave(0, 0.08, Math.abs(Math.sin((x - Math.abs(z) * 1.3) * 200)))) * 0.5);
    return c;
  };
  const nc = k.v.n ?? 1;
  const mult = (gerar: (i: number) => THREE.BufferGeometry[], ac = k.ac) => {
    for (let i = 0; i < nc; i++) {
      const off = nc > 1 ? V((i - (nc - 1) / 2) * L * 1.1, 0, (i % 2) * W * 0.3) : V();
      for (const g of gerar(i)) out.push(parte(g.translate(off.x, off.y, off.z), ac, true));
    }
  };
  switch (v) {
    case 'biscoito': {
      const pontas = k.v.d?.includes('estrela') ? 5 : k.v.d?.includes('flor') ? 8 : 0;
      mult(() => [disco(R, H, cor, { n: 16, m: 40, borda: 0.6, l: k.L, mod: pontas ? (t, a) => 1 - 0.25 * (1 - Math.abs(Math.cos((a * pontas) / 2))) ** 1.5 : undefined })]);
      return out;
    }
    case 'retangulo': {
      mult((i) => [corpo({ x0: -L / 2, x1: L / 2, n: 12, m: 30, exp: 6, tampa: true, cor, corTampa: cor, perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }) }).rotateY(i * 0.1)]);
      return out;
    }
    case 'roseta': {
      mult(() => [torno({ caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.5 * (1 - u * 0.5), H * (1 - Math.cos(th)) / 2 * (u < 0.5 ? 0.3 : 1)]; }, n: 18, m: 40, cor, mod: (t, a) => 1 + 0.1 * Math.abs(Math.cos(a * 4 + t * 8)) - 0.05 })]);
      return out;
    }
    case 'palito': {
      mult((i) => [corpo({ x0: -L / 2, x1: L / 2, n: 20, m: 16, exp: 2.5, cor, perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 6)) * (1 - 0.15 * Math.sin(PI * t)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; } }).rotateY(i * 0.08)]);
      return out;
    }
    case 'telha': case 'renda': case 'pennant': {
      // disco fino curvado sobre um rolo
      mult(() => {
        const g = disco(R, H, cor, { n: 12, m: 40, borda: 0.6, l: k.L, mod: v === 'renda' ? (t, a) => 1 + 0.06 * Math.sin(a * 14) : undefined });
        const pa = g.getAttribute('position');
        const rc = R * 1.1;
        for (let j = 0; j < pa.count; j++) {
          const x = pa.getX(j), y = pa.getY(j);
          const ang = x / rc;
          pa.setXYZ(j, Math.sin(ang) * (rc - y), rc - Math.cos(ang) * (rc - y), pa.getZ(j));
        }
        g.computeVertexNormals();
        g.rotateZ(PI);
        return [g];
      });
      return out;
    }
    case 'cesta': case 'taca': {
      // cestinha ou copinho de borda ondulada ou canelada
      const esp = R * 0.05;
      mult(() => [torno({ caminho: [[0, 0], [R * 0.45, 0], [R * 0.85, H * 0.5], [R, H], [R - esp, H], [R * 0.85 - esp, H * 0.5], [R * 0.45 - esp, esp], [0, esp]], n: 24, m: 48, cor, mod: (t, a) => 1 + (v === 'cesta' ? 0.12 * Math.sin(a * 8) * suave(0.25, 0.5, t) * suave(0.85, 0.6, t) : 0.05 * Math.abs(Math.cos(a * 8))) })]);
      return out;
    }
    case 'tubo': {
      mult((i) => {
        const r = H / 2;
        const g = tornoAnel({ caminho: [[r, 0], [r, L], [r * 0.75, L], [r * 0.75, 0]], n: 30, m: 18, cor: (x, y, z) => mul(cor(x, y, z, 0, 0), 1 - 0.15 * Math.abs(Math.sin(Math.atan2(z, x) * 1 + y * 200 / L)) ** 30) });
        g.translate(0, -L / 2, 0).rotateZ(PI / 2).translate(0, r, 0).rotateY(i * 0.3);
        return [g];
      });
      return out;
    }
    case 'fita': case 'espiral': case 'raspas': case 'fios': {
      const nf = v === 'fios' ? 14 : v === 'raspas' ? 8 : 1;
      for (let i = 0; i < nf; i++) {
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 16; j++) {
          const t = j / 16;
          if (v === 'espiral') { const a = t * TAU * 2.2; pts.push(V(lerp(-L / 2, L / 2, t), H * 0.5 + Math.cos(a) * H * 0.4, Math.sin(a) * H * 0.4)); }
          else if (v === 'fita') pts.push(V(lerp(-L / 2, L / 2, t), H * 0.5 + Math.sin(t * TAU * 1.5) * H * 0.4, Math.sin(t * TAU * 0.7) * W * 0.3));
          else pts.push(V(lerp(-L / 2, L / 2, t) + k.r.f(-L, L) * 0.05, H * (0.2 + 0.6 * k.r.n()), k.r.f(-W / 2, W / 2)));
        }
        const larg = v === 'fita' ? W / 2 : v === 'espiral' ? H * 0.2 : v === 'raspas' ? W * 0.04 : L * 0.004;
        out.push(parte(tubo(pts, { raio: v === 'fita' || v === 'espiral' ? larg * 0.06 : larg, achata: v === 'fita' || v === 'espiral' ? 16 : v === 'raspas' ? 3 : 1, cima: V(0, 1, 0), m: v === 'fios' ? 4 : 6, n: 60, cor }), k.ac, true));
      }
      return out;
    }
    case 'folha': {
      const g = folha(L, W, c1, mul(c1, 0.7), { contorno: contornos.oval, esp: H / 2, curva: 0.1, concha: 0.1, n: 16, m: 10, cor });
      g.translate(-L / 2, 0, 0);
      out.push(parte(g, k.ac, true));
      return out;
    }
    case 'formas': {
      const R = L / 7;
      for (let i = 0; i < 6; i++) {
        const quad = i % 2 === 1;
        const g = quad ? corpo({ x0: -R * 0.8, x1: R * 0.8, n: 6, m: 24, exp: 10, tampa: true, linear: true, cor, corTampa: cor, perfil: () => ({ ry: H / 2, rz: R * 0.8, cy: H / 2 }) }) : disco(R, H, cor, { n: 8, m: 24 });
        g.translate((i % 3 - 1) * L * 0.36, 0, (Math.floor(i / 3) - 0.5) * L * 0.36);
        out.push(parte(g, k.ac, true));
      }
      return out;
    }
    case 'cacos': {
      for (let i = 0; i < (k.v.n ?? 6); i++) {
        const r = L * k.r.f(0.18, 0.3);
        const lados = k.r.i(3, 5);
        const g = disco(r, H, (x, y, z) => mix(cor(x, y, z, 0, 0), c3, k.tem('castanhas') ? 1 - suave(0.12, 0.25, celula(x * 120, 0, z * 120, s)) : 0), { n: 8, m: lados * 3, borda: 0.3, mod: (t, a) => 1 + 0.25 * Math.cos(a * lados + i) });
        g.rotateY(k.r.f(0, TAU));
        g.translate(k.r.f(-L * 0.35, L * 0.35), i * H * 0.3, k.r.f(-W * 0.35, W * 0.35));
        out.push(parte(g, 'brilhante', true));
      }
      return out;
    }
    case 'oval': {
      // financier e bolinhos ovais
      mult(() => [corpo({ x0: -L / 2, x1: L / 2, n: 16, m: 24, exp: 3.5, cor, perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 3)); return { ry: (H / 2), rz: (W / 2) * e, cy: H / 2 }; }, desloc: (p) => { if (p.y > H * 0.5) p.y += H * 0.15 * (1 - (p.z / (W / 2)) ** 2); } })]);
      return out;
    }
  }
  void c3;
  return out;
};

/* ------------------------------------------------------------------ */
/* massa choux                                                          */
/* ------------------------------------------------------------------ */

export const gChoux: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, H = L * k.A, W = L * k.L;
  const craquel: CorFn = (x, y, z) => {
    const c = mix(c1, mul(c1, 0.75), suave(0.65, 0.9, celula(x * 160, y * 160, z * 160, s)));
    return mul(mix(c2, c, suave(0, H * 0.4, y)), 1 + 0.05 * fbm(x * 90, y * 90, z * 90, s));
  };
  const bomba = (R: number, Hh: number, cor: CorFn, n = 18, m = 24) => torno({
    caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.7, (Hh * (1 - Math.cos(th))) / 2 * (u < 0.5 ? 0.3 : 1)]; },
    n, m, cor, mod: (t, a) => 1 + 0.06 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, t * 3, s),
  });
  switch (v) {
    case 'bomba': case 'profiterole': {
      const R = L / 2;
      out.push(parte(bomba(R, H, craquel), k.ac, true));
      if (v === 'profiterole') {
        out.push(parte(torno({
          caminho: [[0, H * 0.55], [R * 0.95, H * 0.4], [R * 1.05, H * 0.42], [R * 0.85, H * 0.92], [0, H * 1.07]],
          n: 16, m: 28, cor: () => mul(c3, 1), mod: (t, a) => 1 + 0.08 * Math.sin(a * 5) * suave(0.5, 0.2, t),
        }), 'brilhante'));
      }
      return out;
    }
    case 'eclair': case 'frito': {
      const frito = v === 'frito';
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: frito ? 24 : 20, cor: frito ? (x, y, z) => mix(craquel(x, y, z, 0, 0), [0.95, 0.94, 0.9], 1 - suave(0.08, 0.15, celula(x * 500, y * 500, z * 500, s))) : (x, y, z) => (y > H * 0.7 ? mul(c3, 1 + 0.04 * fbm(x * 60, 0, z * 60, s)) : craquel(x, y, z, 0, 0)),
        perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 6)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
        mod: frito ? (t, a) => 1 + 0.12 * Math.abs(Math.cos(a * 3)) : (t, a) => 1 + 0.03 * fbm(t * 6, Math.cos(a), Math.sin(a), s),
      }), k.ac, true));
      return out;
    }
    case 'croquembouche': {
      const R = L / 2;
      out.push(parte(disco(R * 1.05, H * 0.03, (x, y, z) => mix(c3, mul(c3, 0.7), 1 - suave(0.1, 0.2, celula(x * 100, 0, z * 100, s))), { n: 10, m: 36 }), 'brilhante', true));
      const rb = R * 0.22;
      const andares = Math.floor((H * 0.95) / (rb * 1.6));
      for (let a = 0; a < andares; a++) {
        const y = H * 0.03 + a * rb * 1.6;
        const rr = (R - rb) * (1 - a / andares) + rb * 0.3;
        const nb = Math.max(1, Math.floor((TAU * rr) / (rb * 1.9)));
        for (let b = 0; b < nb; b++) {
          const ang = (b / nb) * TAU + a * 0.4;
          const g = bomba(rb, rb * 1.6, craquel, 8, 10);
          g.translate(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
          out.push(parte(g, k.ac, true));
        }
      }
      // fios de caramelo
      for (let i = 0; i < 6; i++) {
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 20; j++) { const t = j / 20; const ang = t * TAU * 3 + i; const rr = R * (1 - t) * 1.05; pts.push(V(Math.cos(ang) * rr, H * 0.05 + t * H * 0.95, Math.sin(ang) * rr)); }
        out.push(parte(tubo(pts, { raio: R * 0.006, m: 3, n: 60, cor: () => mul(c3, 1.2) }), 'brilhante'));
      }
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* folhados (filo e massa folhada)                                      */
/* ------------------------------------------------------------------ */

export const gFolhado: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const L = k.T, W = L * k.L, H = L * k.A;
  const dourado: CorFn = (x, y, z) => {
    const camada = Math.abs(Math.sin(y * 2500)) ** 6;
    return mul(mix(mix(c2, c1, suave(0, H, y) * 0.6 + 0.4 * fbm(x * 50, y * 50, z * 50, s)), mul(c1, 0.7), camada * 0.4), 1 + 0.04 * fbm(x * 120, y * 120, z * 120, s));
  };
  switch (v) {
    case 'baklava': {
      const cor: CorFn = (x, y, z) => {
        const lo = Math.min(Math.abs(Math.sin((x + z * 0.6) * 60)), Math.abs(Math.sin((x - z * 0.6) * 60)));
        return mix(dourado(x, y, z, 0, 0), mul(c3, 0.8), (1 - suave(0, 0.08, lo)) * (y > H * 0.8 ? 1 : 0.3));
      };
      out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 20, m: 36, exp: 8, tampa: true, linear: true, cor, corTampa: cor, perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }) }), 'brilhante', true));
      return out;
    }
    case 'cigarro': case 'strudel': {
      const strudel = v === 'strudel';
      const pts: THREE.Vector3[] = [];
      const R = H / 2;
      if (strudel) for (let j = 0; j <= 12; j++) { const a = PI * 0.1 + (j / 12) * PI * 0.8; pts.push(V(-Math.cos(a) * L * 0.5, R, -Math.sin(a) * W * 0.8 + W * 0.4)); }
      else for (let j = 0; j <= 4; j++) pts.push(V(lerp(-L / 2 + R, L / 2 - R, j / 4), R, 0));
      out.push(parte(tubo(pts, { raio: R, m: 18, n: strudel ? 36 : 16, cor: (x, y, z, t, a) => mul(dourado(x, y, z, t, a), 1 - 0.12 * Math.abs(Math.sin(a * 0.5 + t * 30)) ** 20), achata: strudel ? 1.3 : 1, cima: V(0, 1, 0) }), k.ac, true));
      if (k.tem('acucar')) for (const p of out) void p;
      return out;
    }
    case 'triangulo': {
      out.push(parte(corpo({ x0: -L / 2, x1: L / 2, n: 18, m: 24, exp: 3, cor: dourado, perfil: (t) => ({ ry: (H / 2) * Math.sqrt(1 - t) * 1, rz: (W / 2) * Math.max(0.03, 1 - t), cy: (H / 2) * Math.sqrt(1 - t) }), desloc: (p) => { if (p.y < 0) p.y = 0; } }), k.ac, true));
      return out;
    }
    case 'bolsa': {
      const R = L / 2;
      out.push(parte(torno({ caminho: [[0, 0], [R * 0.8, 0], [R, H * 0.3], [R * 0.7, H * 0.65], [R * 0.2, H * 0.72], [R * 0.5, H * 0.9], [R * 0.35, H], [0, H * 0.92]], n: 26, m: 32, cor: dourado, mod: (t, a) => 1 + 0.12 * Math.sin(a * 7 + t * 12) * suave(0.4, 0.8, t) }), k.ac, true));
      return out;
    }
    case 'bouchee': {
      const R = L / 2, r = R * 0.55;
      out.push(parte(tornoAnel({ caminho: [[R, 0], [R, H], [r, H], [r, H * 0.25]].concat([[r * 0.5, H * 0.2], [r * 0.5, 0]]) as [number, number][], n: 26, m: 36, cor: dourado, mod: (t, a) => 1 + 0.03 * Math.abs(Math.cos(a * 9)) }), k.ac, true));
      out.push(parte(tf(disco(r * 0.95, H * 0.2, dourado, { n: 8, m: 24 }), [R * 0.8, H * 0.0, R * 0.6]), k.ac));
      return out;
    }
    case 'tranche': case 'feuillete': {
      const losango = v === 'feuillete';
      const cor: CorFn = (x, y, z) => {
        const borda = losango ? Math.abs(x / (L / 2)) + Math.abs(z / (W / 2)) > 0.72 : Math.abs(z) > W * 0.36;
        return borda ? dourado(x, y, z, 0, 0) : mix(c3, mul(c3, 0.8), suave(0.3, 0.8, fbm(x * 60, 0, z * 60, s)));
      };
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 24, m: 36, exp: losango ? 1.05 : 8, tampa: true, linear: true, cor, corTampa: dourado,
        perfil: () => ({ ry: H / 2, rz: W / 2, cy: H / 2 }),
        desloc: (p) => {
          const dentro = losango ? Math.abs(p.x / (L / 2)) + Math.abs(p.z / (W / 2)) < 0.72 : Math.abs(p.z) < W * 0.36;
          if (dentro && p.y > H * 0.5) p.y -= H * 0.45;
        },
      }), k.ac, true));
      return out;
    }
    case 'rosinha': {
      const R = L / 2;
      for (let i = 0; i < 10; i++) {
        const anel = i < 5 ? 0 : 1;
        const ang = (i / 5) * TAU + anel * 0.6;
        const g = folha(R * (anel ? 0.6 : 0.95), R * 0.55, c1, c2, { contorno: contornos.redonda, concha: 0.4, curva: 0.5, esp: H * 0.06, n: 8, m: 8, cor: dourado });
        tf(g, [0, H * (0.1 + anel * 0.25), 0], [0, -ang, 0.4 + anel * 0.4]);
        out.push(parte(g, k.ac, true));
      }
      return out;
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* merengues                                                            */
/* ------------------------------------------------------------------ */

export const gMerengue: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const D = k.T, H = D * k.A, R = D / 2;
  const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0, H * 0.6, H * 0.6 - y) * 0.3), 1 + 0.03 * fbm(x * 90, y * 90, z * 90, s));
  switch (v) {
    case 'concha': {
      out.push(parte(torno({ caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.8, (H * (1 - Math.cos(th))) / 2 * (u < 0.5 ? 0.2 : 1) + (u > 0.85 ? H * 0.2 * (u - 0.85) * 6 : 0)]; }, n: 22, m: 28, cor, l: 0.75 }).rotateZ(0), k.ac, true));
      return out;
    }
    case 'ninho': case 'disco': {
      const voltas = 3;
      const pts: THREE.Vector3[] = [];
      const rt = R / (voltas + 0.5) / 2;
      for (let i = 0; i <= voltas * 20; i++) { const t = i / (voltas * 20); const a = t * voltas * TAU; const rr = rt * 1.5 + t * (R - rt * 2.5); pts.push(V(Math.cos(a) * rr, rt * 0.9, Math.sin(a) * rr)); }
      if (v === 'ninho') for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * 2 * TAU; pts.push(V(Math.cos(a) * (R - rt), rt * 0.9 + rt * 1.6 * (1 + t * 1.2), Math.sin(a) * (R - rt))); }
      out.push(parte(tubo(pts, { raio: rt * 1.05, m: 10, n: pts.length * 3, cor: (x, y, z, t, a) => mul(cor(x, y, z, t, a), 1 - 0.1 * Math.abs(Math.cos(a * 4)) ** 4) }), k.ac, true));
      return out;
    }
    case 'pavlova': {
      const esp = R * 0.25;
      out.push(parte(torno({ caminho: [[0, 0], [R * 0.9, 0], [R, H * 0.5], [R * 0.95, H], [R - esp * 0.5, H * 1.05], [R - esp, H * 0.9], [R - esp * 1.3, H * 0.5], [0, H * 0.45]], n: 28, m: 36, cor, mod: (t, a) => 1 + 0.04 * Math.sin(a * 9) * suave(0.2, 0.4, t) }), k.ac, true));
      out.push(parte(tf(torno({ caminho: (u) => { const th = u * PI; return [(R - esp * 1.2) * Math.sin(th) ** 0.6, (H * 0.5 * (1 - Math.cos(th))) / 2]; }, n: 14, m: 30, cor: (x, y, z) => mix(BRANCO, c3, 1 - suave(0.15, 0.3, celula(x * 40 / D * 0.25, y * 40 / D * 0.25, z * 40 / D * 0.25, s))) }), [0, H * 0.45, 0]), 'brilhante'));
      return out;
    }
  }
  return out;
};

export { grao, caule, elipsoide, fruto };
