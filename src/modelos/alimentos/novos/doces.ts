// Alimentos novos do grupo doces: bolos, sobremesas e pastelaria do jeito que o livro
// deixa cada um no fim da técnica (fôrmas forradas, tortas cruas, calda no ponto,
// pão-de-ló aberto, sorbets, biscoitos e confeitaria de vitrine).
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, tubo, elipsoide, caixa, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, disco, type Ctx, type Gerador } from '../pecas';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* cores e utilidades comuns                                            */
/* ------------------------------------------------------------------ */

const LOUCA = rgb('#f4f1ea');
const METAL = rgb('#b6b8ba');
const LATA = rgb('#8e9194');
const PAPEL = rgb('#efe7d3');
const ACUCAR = rgb('#fbfaf6');
const CACAU = rgb('#5e3a26');
const CHOCO = rgb('#3a2116');
const FARINHA = rgb('#f3eee2');
const BARBANTE = rgb('#d8c8a4');

type Cam = [number, number][];

/** Brilho de cristal: perto de 1 no miolo das células pequenas. */
const cristal = (x: number, y: number, z: number, f: number, s: number) => 1 - suave(0.04, 0.24, celula(x * f, y * f, z * f, s));

/** Caminho de torno por trechos [s, raio, altura], com s de 0 a 1. */
function trechos(k: [number, number, number][]): (s: number) => [number, number] {
  return (s) => {
    for (let i = 1; i < k.length; i++) {
      if (s <= k[i][0] || i === k.length - 1) {
        const f = clamp((s - k[i - 1][0]) / Math.max(1e-9, k[i][0] - k[i - 1][0]));
        return [lerp(k[i - 1][1], k[i][1], f), lerp(k[i - 1][2], k[i][2], f)];
      }
    }
    return [0, 0];
  };
}

/** Raio relativo de um polígono regular de n lados (para mod de torno). */
const poligono = (a: number, n: number, giro = 0) => {
  const set = TAU / n;
  const q = ((((a + giro) % set) + set) % set) - set / 2;
  return Math.cos(PI / n) / Math.cos(q);
};

/** Chapa em grade deitada (altura por x e z), para superfícies com relevo fino. */
function grade(nx: number, nz: number, Lx: number, Lz: number, alt: (x: number, z: number) => number, cor: CorFn): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(Lx, Lz, nx, nz);
  g.rotateX(-PI / 2);
  g.deleteAttribute('uv');
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const col: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = alt(x, z);
    p.setY(i, y);
    const c = cor(x, y, z, 0, 0);
    col.push(clamp(c[0]), clamp(c[1]), clamp(c[2]));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Ramequim branco canelado por fora; `dentro` pinta a parede interna. */
function ramequim(R: number, H: number, s: number): THREE.BufferGeometry {
  const e = R * 0.09, ri = R - e;
  const tot = R + H + e + H + ri;
  const fParede = (R * 0.95 + H) / tot;
  const cor: CorFn = (x, y, z) => {
    const c = mul(LOUCA, 0.96 + 0.04 * fbm(x * 40, y * 40, z * 40, s));
    return y < e * 0.4 ? mul(c, 0.9) : c;
  };
  return torno({
    caminho: [[0, 0], [R * 0.9, 0], [R, e * 0.5], [R, H], [R - e * 0.5, H + e * 0.3], [ri, H], [ri, e * 1.8], [ri * 0.92, e], [0, e]],
    n: 26, m: 64, cor,
    mod: (t, a) => (t > 0.1 && t < fParede ? 1 + 0.032 * Math.abs(Math.cos(a * 8)) ** 0.7 : 1),
  });
}

/* ------------------------------------------------------------------ */
/* saco de confeitar cheio                                              */
/* ------------------------------------------------------------------ */

const gSacoCheio: Gerador = (k) => {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, x0 = -L / 2, xb = L / 2 - L * 0.12;
  const Rm = L * 0.14;
  const raio = (t: number) => {
    if (t < 0.06) return lerp(Rm * 0.32, Rm * 0.2, t / 0.06); // sobra do saco, frouxa
    if (t < 0.14) return Rm * 0.16; // torção que fecha a boca
    if (t < 0.32) return lerp(Rm * 0.16, Rm, Math.sin(((t - 0.14) / 0.18) * PI / 2) ** 0.8);
    if (t < 0.94) return lerp(Rm, Rm * 0.2, (t - 0.32) / 0.62);
    return Rm * 0.17; // torcido logo acima do bico para vedar
  };
  const torcao = (t: number) => suave(0.03, 0.07, t) * (1 - suave(0.13, 0.17, t)) + suave(0.93, 0.95, t);
  const cheio = (t: number) => suave(0.13, 0.2, t) * (1 - suave(0.92, 0.94, t));
  const cor: CorFn = (x, y, z, t, a) => {
    // merengue branco visto pelo plástico, com reflexo; sobra do saco vazia, mais acinzentada
    const merengue = mul(mix(ACUCAR, rgb('#ece6d6'), 0.3 + 0.3 * fbm(x * 90, y * 90, z * 90, s)), 1);
    const vazio = mul(rgb('#d9dcdc'), 0.95 + 0.08 * ruido(x * 200, y * 200, z * 200, s));
    let c = mix(vazio, merengue, cheio(t));
    // vincos da torção em espiral
    c = mul(c, 1 - 0.22 * torcao(t) * Math.abs(Math.sin(a * 3 + t * 120)) ** 2);
    // solda lateral do saco
    c = mix(c, mul(vazio, 0.85), Math.abs(Math.sin(a / 2 - 0.9)) ** 60);
    // reflexo do plástico no alto
    return mix(c, [1, 1, 1], suave(0.75, 1, Math.cos(a)) * 0.25 * cheio(t));
  };
  out.push(parte(corpo({
    x0, x1: xb, n: 44, m: 30, cor,
    perfil: (t) => { const r = raio(t); return { ry: r * 0.86, rz: r * 1.08, cy: r * 0.86 }; },
    mod: (t, a) => 1 + 0.16 * torcao(t) * Math.sin(a * 3 + t * 120) + 0.025 * Math.sin(a * 6 + 3 * fbm(t * 6, Math.cos(a), Math.sin(a), s)) * cheio(t),
  }), 'umido', true));
  // bico pitanga de inox
  const Rb = Rm * 0.22, Hb = L * 0.13;
  const bico = torno({
    caminho: [[0, 0], [Rb, 0], [Rb, Hb * 0.12], [Rb * 0.78, Hb * 0.4], [Rb * 0.52, Hb], [Rb * 0.42, Hb * 1.02], [Rb * 0.38, Hb * 0.9], [0, Hb * 0.9]],
    n: 16, m: 32,
    cor: (x, y, z) => (y > Hb * 0.95 && Math.hypot(x, z) < Rb * 0.45 ? mul(METAL, 0.45) : mul(METAL, 0.9 + 0.2 * Math.abs(Math.sin(y * 900)) ** 8)),
    mod: (t, a) => 1 + 0.2 * suave(0.45, 0.75, t) * Math.abs(Math.cos(a * 4)) ** 0.6,
  });
  out.push(parte(tf(bico, [xb - Hb * 0.1, raio(1) * 0.86 + Rb * 0.15, 0], [0, 0, -PI / 2]), 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* conchas de merengue unidas com ganache                               */
/* ------------------------------------------------------------------ */

const gConchasGanache: Gerador = (k) => {
  const { c1, c2, s, r } = k;
  const out: Parte[] = [];
  const L = k.T, Hs = L * 0.22, Ws = L * 0.21;
  const gH = L * 0.075;
  const casca = (cima: boolean): THREE.BufferGeometry => {
    const g = corpo({
      x0: -L / 2, x1: L / 2, n: 22, m: 32,
      cor: (x, y, z) => {
        let c = mix(c1, c2, suave(0.2, 0.9, fbm(x * 120, y * 120, z * 120, s)) * 0.35);
        if (cima) {
          // polvilho: açúcar de confeiteiro e cacau peneirados por cima
          const topo = suave(Hs * 0.3, Hs * 0.75, y);
          const ac = suave(-0.35, 0.25, fbm(x * 160, 0, z * 160, s + 4)) * topo;
          const ca = suave(0.05, 0.45, fbm(x * 210, 3, z * 210, s + 9)) * topo;
          c = mix(c, ACUCAR, ac * 0.9);
          c = mix(c, CACAU, ca * 0.75);
        } else c = mix(c, rgb('#e6d2a8'), suave(Hs * 0.3, 0, y) * 0.5);
        return c;
      },
      perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.75; return { ry: Hs * e, rz: Ws * e }; },
      // estrias do bico pitanga torcidas ao longo da concha
      mod: (t, a) => 1 + 0.09 * Math.abs(Math.sin(a * 4 + t * 16)) - 0.045,
      desloc: (p) => {
        if (cima ? p.y < 0 : p.y > 0) p.y *= 0.1;
        if (!cima && p.y < -Hs * 0.86) p.y = -Hs * 0.86 - (p.y + Hs * 0.86) * 0.2;
      },
    });
    return g;
  };
  out.push(parte(tf(casca(false), [0, Hs * 0.86, 0]), 'fosco', true));
  const yG = Hs * 0.86 + Hs * 0.1;
  out.push(parte(tf(elipsoide(L * 0.46, gH * 0.75, Ws * 1.02, (x, y, z) => mul(rgb('#4a2618'), 0.9 + 0.15 * fbm(x * 200, y * 200, z * 200, s)), 12, 26, (t, a) => 1 + 0.06 * Math.sin(a * 5 + t * 9)), [0, yG + gH * 0.4, 0]), 'brilhante'));
  const yC = yG + gH * 0.8 + Hs * 0.1;
  out.push(parte(tf(casca(true), [0, yC, 0]), 'fosco', true));
  // lascas de chocolate enroladas sobre a concha de cima
  for (let i = 0; i < 12; i++) {
    const x = r.f(-L * 0.32, L * 0.32), z = r.f(-Ws * 0.5, Ws * 0.5);
    const e = Math.sqrt(Math.max(0, 1 - (2 * x / L) ** 2 - (z / Ws) ** 2 * 0.8));
    const g = folha(L * r.f(0.09, 0.13), L * 0.045, CHOCO, mul(CHOCO, 1.5), {
      contorno: contornos.fita, curva: 0.45, esp: L * 0.005, n: 6, m: 4,
      cor: (xx, yy, zz) => mix(CHOCO, rgb('#6a3f28'), Math.abs(Math.sin(xx * 900 + zz * 300)) ** 3 * 0.6),
    });
    tf(g, [x, yC + Hs * e * 0.97, z], [r.f(-0.2, 0.2), r.f(0, TAU), r.f(-0.15, 0.15)]);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* suflê: fôrma forrada e suflê cru nivelado                            */
/* ------------------------------------------------------------------ */

const gSufle: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  const e = R * 0.09, ri = R - e;
  out.push(parte(ramequim(R, H, s), 'brilhante', true));
  if (k.v.v === 'forrada') {
    // manteiga em pinceladas verticais e açúcar cristal grudado por cima
    const d = 0.0008, f = 0.0003;
    const cor: CorFn = (x, y, z) => {
      const ang = Math.atan2(z, x);
      let c = mix(rgb('#f2dc96'), rgb('#e8c870'), 0.5 + 0.5 * Math.sin(ang * 46 + 2 * fbm(x * 60, y * 12, z * 60, s)));
      c = mix(c, ACUCAR, 0.3 + 0.3 * suave(-0.4, 0.4, fbm(x * 70, y * 70, z * 70, s)));
      // cada grão de açúcar pega a luz: brilho sorteado por vértice
      const grao = ruido(x * 4000, y * 4000, z * 4000, s);
      c = mix(c, [1, 1, 1], suave(0.2, 0.7, grao) * 0.85);
      return mul(c, 0.9 + 0.12 * ruido(x * 2600, y * 2600, z * 2600, s + 1));
    };
    out.push(parte(torno({
      caminho: [[0, e + f], [ri * 0.9, e + f], [ri - f, e * 1.8], [ri - f, H * 0.985], [ri - f - d, H * 0.985], [ri - f - d, e * 1.8 + d], [ri * 0.9 - d, e + f + d], [0, e + f + d]],
      n: 22, m: 48, cor,
    }), 'fosco'));
    return out;
  }
  // suflê cru: massa nivelada com a espátula e o sulco limpo pelo dedo junto da borda
  const f = 0.0004;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.96 + 0.06 * fbm(x * 90, y * 90, z * 90, s));
    // marcas finas da espátula que nivelou
    c = mul(c, 1 - 0.04 * Math.abs(Math.sin(x * 520 + 2 * fbm(z * 40, 0, x * 10, s))) ** 4);
    // bolhinhas das claras
    c = mix(c, mul(c1, 1.12), cristal(x, y, z, 700, s + 3) * 0.5);
    return mix(c, mul(c1, 0.8), suave(H * 0.95, H * 0.88, y) * 0.3);
  };
  out.push(parte(torno({
    caminho: trechos([[0, 0, e + f], [0.08, ri * 0.9, e + f], [0.12, ri - f, e * 1.9], [0.3, ri - f, H * 0.8], [0.4, ri - 0.0012, H * 0.845], [0.48, ri - 0.0035, H * 0.86], [0.56, ri - 0.0058, H * 0.93], [0.62, ri - 0.0075, H * 0.985], [0.68, ri - 0.011, H * 0.997], [1, 0, H * 0.997]]),
    n: 26, m: 64, cor,
  }), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* pudim no vapor embrulhado com alça                                   */
/* ------------------------------------------------------------------ */

const gPudimEmbrulhado: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2 / 1.14, H = R * 1.3;
  // tigela de pudim com aba
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.55, 0], [R * 0.6, H * 0.03], [R * 0.95, H * 0.84], [R * 1.04, H * 0.88], [R * 1.05, H * 0.93], [R * 0.98, H * 0.94], [0, H * 0.94]],
    n: 14, m: 48,
    cor: (x, y, z) => mul(c1, (y < H * 0.05 ? 0.8 : 1) * (0.96 + 0.04 * fbm(x * 30, y * 30, z * 30, s))),
  }), 'brilhante'));
  // tampa de papel-manteiga com alumínio por fora, prega no meio, saia franzida até meia altura
  const crinkle = (x: number, y: number, z: number) => fbm(x * 160, y * 160, z * 160, s + 5);
  const yB = H * 0.86;
  const cor: CorFn = (x, y, z) => {
    const papel = y < H * 0.6 && Math.hypot(x, z) > R * 1.04;
    if (papel) return mul(PAPEL, 0.92 + 0.08 * crinkle(x, y, z));
    const vinco = y < yB ? Math.abs(Math.sin(Math.atan2(z, x) * 21 + 2.5 * fbm(x * 40, y * 20, z * 40, s))) ** 3 * 0.18 : 0;
    return mul(rgb('#c9cbcd'), 0.8 + 0.32 * crinkle(x, y, z) + 0.08 * Math.abs(Math.sin(x * 400)) ** 6 - vinco);
  };
  out.push(parte(torno({
    caminho: [[0, H * 0.955], [R * 0.96, H * 0.95], [R * 1.0, H * 0.9], [R * 0.99, yB], [R * 1.06, H * 0.7], [R * 1.12, H * 0.56], [R * 1.135, H * 0.555], [R * 1.075, H * 0.7], [R * 1.005, yB], [R * 1.045, H * 0.935], [R * 0.97, H * 1.0], [R * 0.5, H * 1.055], [0, H * 1.065]],
    n: 34, m: 64, cor,
    mod: (t, a) => 1 + 0.006 * fbm(Math.cos(a) * 4, t * 6, Math.sin(a) * 4, s),
    desloc: (p) => {
      // prega dupla no meio da tampa, para o pudim crescer
      if (p.y > H * 0.97) p.y += H * 0.05 * Math.exp(-((p.z / (R * 0.07)) ** 2)) * suave(R * 0.95, R * 0.6, Math.abs(p.x));
      // saia franzida abaixo do barbante
      if (p.y < yB) {
        const a = Math.atan2(p.z, p.x);
        const q = 1 + 0.045 * Math.sin(a * 21 + 2.5 * fbm(p.x * 40, p.y * 20, p.z * 40, s)) * suave(yB, H * 0.6, p.y);
        p.x *= q; p.z *= q;
      }
    },
  }), 'brilhante', true));
  // barbante amarrado sob a aba e alça por cima
  const rB = R * 1.0 + 0.0025;
  const anel: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) anel.push(V(Math.cos((i / 24) * TAU) * rB, yB, Math.sin((i / 24) * TAU) * rB));
  const corB: CorFn = (x, y, z) => mul(BARBANTE, 0.75 + 0.25 * Math.abs(Math.sin((x + y + z) * 2600)));
  out.push(parte(tubo(anel, { raio: 0.0022, m: 5, n: 64, fechado: true, cor: corB }), 'fosco'));
  out.push(parte(tubo([V(0, yB, -rB), V(0, H * 1.25, -R * 0.55), V(0, H * 1.36, 0), V(0, H * 1.25, R * 0.55), V(0, yB, rB)], { raio: 0.0022, m: 5, n: 30, cor: corB }), 'fosco'));
  out.push(parte(tf(elipsoide(0.005, 0.0035, 0.005, corB, 5, 7), [rB * Math.cos(0.4), yB, rB * Math.sin(0.4)]), 'fosco'));
  return out;
};

/* ------------------------------------------------------------------ */
/* calda de açúcar no ponto, tirada na água gelada                      */
/* ------------------------------------------------------------------ */

const gCaldaPonto: Gerador = (k) => {
  const { c1, s, r } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  // calda vítrea: mais escura no fundo e na massa, clara onde a luz atravessa
  const cor = (h: number): CorFn => (x, y, z) => {
    const c = mix(mul(c1, 0.5), c1, suave(0, h, y));
    // luz que atravessa a calda e acende o lado oposto
    return mul(mix(c, mul(c1, 1.2), suave(0.2, 0.9, fbm(x * 300 + 4, y * 300, z * 300, s)) * 0.4), 1 + 0.05 * fbm(x * 400, y * 400, z * 400, s));
  };
  const T = k.T;
  if (v === 'fio') {
    // fio fino que se formou ao abrir os dedos, com as gotas que ficaram nas pontas
    const fios: THREE.Vector3[][] = [
      [V(-T * 0.45, 0.0012, -T * 0.05), V(-T * 0.2, 0.0008, T * 0.06), V(0, 0.0007, -T * 0.02), V(T * 0.22, 0.0008, T * 0.05), V(T * 0.45, 0.0012, -T * 0.03)],
      [V(-T * 0.3, 0.0008, T * 0.16), V(-T * 0.05, 0.0006, T * 0.2), V(T * 0.15, 0.0006, T * 0.13)],
    ];
    fios.forEach((pts, i) => {
      out.push(parte(tubo(pts, { raio: (t) => (i ? 0.00035 : 0.0005) + 0.0009 * (suave(0.12, 0, t) + suave(0.88, 1, t)), m: 6, n: 40, cor: cor(0.002) }), 'umido', i === 0));
    });
    for (const [x, z, rr] of [[-T * 0.45, -T * 0.05, 1], [T * 0.45, -T * 0.03, 0.8]] as const) {
      out.push(parte(tf(elipsoide(T * 0.07 * rr, T * 0.04 * rr, T * 0.06 * rr, cor(T * 0.06), 6, 10), [x, T * 0.025 * rr, z]), 'umido'));
    }
    return out;
  }
  if (v === 'bala-mole' || v === 'bala-dura') {
    const dura = v === 'bala-dura';
    const Rb = T / 2, Hb = Rb * (dura ? 1.75 : 1.2);
    out.push(parte(torno({
      caminho: (u) => {
        const th = u * PI;
        // bala mole cede e se espalha embaixo; a dura fica redonda e firme
        // pontinha puxada no alto, onde o dedo soltou a calda
        const r0 = Rb * Math.sin(th) * (dura ? 1 : 1 + 0.25 * (1 - u) ** 2) * (1 - 0.55 * suave(0.72, 1, u));
        return [u > 0.97 ? 0 : r0, (Hb * (1 - Math.cos(th))) / 2 + Hb * 0.16 * suave(0.75, 1, u)];
      },
      n: 22, m: 28, cor: cor(Hb),
      mod: (t, a) => 1 + (dura ? 0.02 : 0.05) * fbm(Math.cos(a) * 1.5, t * 2.5, Math.sin(a) * 1.5, s) - (dura ? 0 : 0.06 * suave(0.6, 0.9, t) * Math.abs(Math.sin(a))),
      desloc: (p) => { if (p.y > Hb * 0.85) p.x += Rb * 0.25 * suave(Hb * 0.85, Hb * 1.16, p.y); },
    }), 'umido', true));
    return out;
  }
  if (v === 'crosta-mole') {
    // fios grossos que dobram e quebram, mas ainda grudentos
    const fios = 3;
    for (let i = 0; i < fios; i++) {
      const L = T * r.f(0.6, 0.85), z = (i - 1) * T * 0.22, ang = r.f(-0.25, 0.25);
      const c = Math.cos(ang), sn = Math.sin(ang);
      const pts: THREE.Vector3[] = [];
      // fio reto que dobrou num ponto só, em ângulo, sem partir
      const dobra = r.f(0.35, 0.65), giro = r.f(0.5, 0.9) * (i % 2 ? 1 : -1);
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        let x = (u - 0.5) * L, zz = z;
        if (u > dobra) { const q = (u - dobra) * L; x = (dobra - 0.5) * L + q * Math.cos(giro); zz = z + q * Math.sin(giro); }
        pts.push(V(x * c - zz * sn, 0.0013 + (Math.abs(u - dobra) < 0.1 ? 0.0006 : 0), x * sn + zz * c));
      }
      out.push(parte(tubo(pts, { raio: (t) => 0.0012 * (0.92 + 0.08 * Math.sin(t * 9 + i)), m: 7, n: 30, cor: cor(0.0026) }), 'umido', i === 1));
    }
    return out;
  }
  // crosta dura: lascas de vidro de açúcar, finas, de contorno anguloso
  for (let i = 0; i < 6; i++) {
    const Rl = T * r.f(0.18, 0.3), e = 0.0011;
    const lados = r.i(4, 6);
    const raios = Array.from({ length: lados }, () => r.f(0.5, 1.2));
    // um vértice por canto: arestas retas de vidro quebrado
    const mod = (_t: number, a: number) => raios[Math.round(((a / TAU) * lados + lados) % lados) % lados];
    const g = disco(Rl, e, (x, y, z) => mix(cor(e)(x, y, z, 0, 0), mul(c1, 1.25), suave(Rl * 0.5, Rl, Math.hypot(x, z)) * 0.5), { n: 6, m: lados, borda: 0.25, mod, l: r.f(0.45, 0.75) });
    const a = (i / 6) * TAU + r.f(-0.3, 0.3), d = T * (i === 0 ? 0 : r.f(0.18, 0.3));
    tf(g, [Math.cos(a) * d, i * 0.0004, Math.sin(a) * d], [r.f(-0.15, 0.15), r.f(0, TAU), r.f(-0.15, 0.15)]);
    out.push(parte(g, 'umido', true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* sorbets                                                              */
/* ------------------------------------------------------------------ */

const gSorbet: Gerador = (k) => {
  const { c1, c2, s } = k;
  if (k.v.v === 'roseta') {
    // roseta de bico pitanga: oito gomos que giram subindo até a ponta
    const R = k.T / 2, H = k.T * k.A;
    const cor: CorFn = (x, y, z) => mix(mul(c1, 0.95 + 0.08 * fbm(x * 150, y * 150, z * 150, s)), c2, cristal(x, y, z, 600, s) * 0.35);
    return [parte(torno({
      caminho: (u) => {
        const th = u * PI;
        const rr = R * Math.sin(th) ** 0.55 * (1 - u * 0.55);
        return [u > 0.96 ? 0 : rr, H * (1 - Math.cos(th)) / 2 + (u > 0.85 ? H * 0.12 * (u - 0.85) / 0.15 : 0)];
      },
      n: 30, m: 64, cor,
      mod: (t, a) => 1 - 0.2 * Math.abs(Math.sin(a * 4 + t * 9)) ** 1.6 * suave(0.04, 0.2, t) + 0.05 * Math.sin(t * PI * 7) * suave(0.1, 0.3, t),
    }), 'acetinado', true)];
  }
  // bola de sorvete com as marcas do boleador e a lingueta que ele deixa na base
  const R = k.T / 2;
  const volta = (t: number, a: number) => Math.sin(t * PI * 9 + Math.sin(a) * 2.2) * suave(0.25, 0.45, t);
  const cor: CorFn = (x, y, z, t, a) => {
    // geada clara nas cristas das voltas do boleador, roxo fundo nos vales
    const crista = 0.5 + 0.5 * volta(t, a);
    let c = mul(mix(mul(c1, 0.85), c2, crista * 0.45), 0.94 + 0.08 * fbm(x * 120, y * 120, z * 120, s));
    c = mix(c, mix(c2, [1, 1, 1], 0.3), suave(0.4, 0.85, ruido(x * 3000, y * 3000, z * 3000, s)) * 0.25);
    // pontinhos escuros da casca da fruta
    return mix(c, mul(c1, 0.4), suave(0.6, 0.85, ruido(x * 2300, y * 2300, z * 2300, s + 2)) * 0.7);
  };
  return [parte(torno({
    caminho: (u) => {
      const th = u * PI;
      return [u > 0.97 ? 0 : R * Math.sin(th) * (1 + 0.08 * (1 - u)), R * 0.92 * (1 - Math.cos(th))];
    },
    n: 30, m: 48, cor,
    mod: (t, a) => 1 + 0.045 * volta(t, a) + 0.025 * fbm(Math.cos(a) * 2, t * 3, Math.sin(a) * 2, s)
      + 0.2 * suave(0.22, 0.1, t) * suave(0.1, 1, Math.cos(a)),
  }), 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* formas de chocolate com polvilho duplo                               */
/* ------------------------------------------------------------------ */

const gFormasPolvilhadas: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const H = k.T * 0.075;
  const formas: [number, number, number, number, number][] = [
    // lados (0 = disco), raio, x, z, giro
    [0, k.T * 0.22, -k.T * 0.27, -k.T * 0.08, 0],
    [4, k.T * 0.25, k.T * 0.25, -k.T * 0.1, PI / 4 + 0.2],
    [3, k.T * 0.26, 0, k.T * 0.2, 0.4],
  ];
  formas.forEach(([lados, Rf, x, z, giro], i) => {
    const mod = lados ? (_t: number, a: number) => poligono(a, lados, giro) : undefined;
    const corC: CorFn = (xx, yy, zz) => mul(c1, 0.92 + 0.12 * fbm(xx * 200, yy * 200, zz * 200, s + i));
    out.push(parte(tf(disco(Rf, H, corC, { n: 8, m: 40, mod, borda: 0.35 }), [x, 0, z]), 'brilhante', true));
    // camada de polvilho: açúcar primeiro, cacau peneirado por cima
    const corP: CorFn = (xx, yy, zz) => {
      const ac = 0.3 + 0.62 * suave(-0.4, 0.4, fbm(xx * 260, 0, zz * 260, s + 7 + i));
      let c = mix(c1, ACUCAR, ac);
      c = mix(c, CACAU, suave(-0.05, 0.4, fbm(xx * 380, 2, zz * 380, s + 11 + i)) * 0.8);
      return mul(c, 0.95 + 0.08 * ruido(xx * 2000, yy * 2000, zz * 2000, s));
    };
    const Rp = Rf * 0.93, hp = 0.0006;
    out.push(parte(tf(torno({
      caminho: trechos([[0, 0, 0], [0.08, Rp, 0], [0.16, Rp, hp], [1, 0, hp * 1.5]]),
      n: 12, m: 40, cor: corP, mod,
      desloc: (p) => { if (p.y > hp * 0.5) p.y += 0.0005 * (0.5 + 0.5 * fbm(p.x * 260, 0, p.z * 260, s + i)); },
    }), [x, H - 0.0002, z]), 'fosco'));
  });
  return out;
};

/* ------------------------------------------------------------------ */
/* farofa da massa podre (gordura esfregada na farinha)                 */
/* ------------------------------------------------------------------ */

const gFarofaMassa: Gerador = (k) => {
  const { c1, c2, c3, s, r } = k;
  const out: Parte[] = [];
  const R = k.T * 0.42, H = R * 0.45;
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.92 + 0.12 * fbm(x * 140, y * 140, z * 140, s));
    // flocos de manteiga amarelada e de banha branca ainda aparentes
    c = mix(c, c2, (1 - suave(0.08, 0.2, celula(x * 260, y * 260, z * 260, s))) * 0.8);
    c = mix(c, c3, (1 - suave(0.06, 0.16, celula(x * 300, y * 300, z * 300, s + 5))) * 0.7);
    return c;
  };
  out.push(parte(torno({
    caminho: (u) => { const th = u * PI; return [u > 0.96 ? 0 : R * 0.9 * Math.sin(th) ** 0.6, (H * 0.8 * (1 - Math.cos(th))) / 2 * (u < 0.5 ? 0.25 : 1)]; },
    n: 16, m: 36, cor,
    mod: (t, a) => 1 + 0.14 * fbm(Math.cos(a) * 1.6, Math.sin(a) * 1.6, t * 2, s) * suave(0.15, 0.45, t),
    desloc: (p) => {
      const q = 1 + 0.16 * ruido(p.x * 260, p.y * 260, p.z * 260, s + 3) * suave(0, H * 0.3, p.y);
      p.x *= q; p.z *= q;
      p.y *= 1 + 0.25 * fbm(p.x * 70, 0, p.z * 70, s + 1) + 0.12 * ruido(p.x * 400, 0, p.z * 400, s + 2);
    },
  }), 'fosco', true));
  // grumos de farofa cobrindo o monte e espalhados em volta, uns mais amarelos de manteiga
  for (let i = 0; i < 150; i++) {
    const a = r.f(0, TAU), d = R * Math.sqrt(r.f(0, 1.5));
    const sobre = d < R * 0.98;
    const tam = k.T * r.f(0.022, 0.045);
    const y = sobre ? H * (1 - (d / R) ** 2) ** 0.8 * 0.95 + tam * 0.2 : tam * 0.45;
    const tom = mix(c1, r.n() < 0.3 ? c2 : c3, r.f(0, 0.6));
    const g = elipsoide(tam, tam * r.f(0.55, 0.8), tam * r.f(0.6, 1.1), (x, yy, z) => mul(tom, 0.88 + 0.18 * ruido(x * 900, yy * 900, z * 900, s)), 4, 5,
      (t, aa) => 1 + 0.2 * ruido(t * 3, Math.cos(aa) * 2, Math.sin(aa) * 2, s + i));
    out.push(parte(tf(g, [Math.cos(a) * d, y, Math.sin(a) * d], [r.f(0, 1), r.f(0, TAU), r.f(0, 1)]), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* tortas cruas: tampa com funil, dupla, bordas em pregas, folhas, trança */
/* ------------------------------------------------------------------ */

const gTortaCrua: Gerador = (k) => {
  const { c1, c2, c3, ci, s, r } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2 / 1.06;
  // prato de torta de louça com aba larga
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.68, 0], [R * 0.71, 0.003], [R * 0.86, 0.034], [R * 1.0, 0.037], [R * 1.03, 0.039], [R * 1.0, 0.0415], [R * 0.86, 0.039], [R * 0.7, 0.0068], [0, 0.0068]],
    n: 14, m: 48, cor: (x, y, z) => mul(c3, (y < 0.002 ? 0.86 : 1) * (0.96 + 0.04 * fbm(x * 30, y * 30, z * 30, s))),
  }), 'brilhante'));
  // massa crua: crua por baixo, pincelada de gema por cima (com traços do pincel)
  const pincelada: CorFn = (x, y, z) => {
    let c = mix(c1, c2, 0.05 + 0.25 * suave(-0.1, 0.7, fbm(x * 70, y * 70, z * 70, s)));
    // gema acumulada nos traços do pincel
    c = mix(c, mul(c1, 0.86), Math.max(0, Math.sin(x * 170 + z * 40 + 2.5 * fbm(x * 25, 0, z * 25, s))) ** 3 * 0.5);
    return c;
  };
  const crua: CorFn = (x, y, z) => mul(mix(c2, FARINHA, 0.2 * suave(0, 0.6, fbm(x * 90, y * 90, z * 90, s))), 0.95 + 0.06 * ruido(x * 300, y * 300, z * 300, s));
  const ang = (p: THREE.Vector3) => Math.atan2(p.z, p.x);

  if (v === 'pregas') {
    // fundo de massa crua no prato, sem tampa, com a borda levantada em pregas
    out.push(parte(torno({
      caminho: [[0, 0.0072], [R * 0.69, 0.0075], [R * 0.86, 0.0385], [R * 0.9, 0.041], [R * 0.87, 0.042], [R * 0.84, 0.0395], [R * 0.67, 0.0112], [0, 0.0108]],
      n: 14, m: 48, cor: crua,
    }), 'acetinado', true));
    const N = 22;
    out.push(parte(tornoAnel({
      caminho: [[R * 1.03, 0.0395], [R * 1.04, 0.05], [R * 1.0, 0.0605], [R * 0.94, 0.062], [R * 0.89, 0.058], [R * 0.86, 0.048], [R * 0.87, 0.0395], [R * 0.96, 0.04]],
      n: 10, m: 132,
      cor: (x, y, z) => mul(crua(x, y, z, 0, 0), 1 - 0.12 * Math.abs(Math.cos(Math.atan2(z, x) * N)) ** 6 * suave(0.045, 0.058, y)),
      desloc: (p) => {
        const w = Math.sin(ang(p) * N), h = suave(0.044, 0.06, p.y);
        const q = 1 + 0.04 * w * h;
        p.x *= q; p.z *= q;
        p.y += 0.0025 * Math.abs(w) * h;
      },
    }), 'acetinado'));
    return out;
  }

  // tampa abaulada sobre o recheio
  const funil = v === 'funil';
  const rIn = v === 'tranca' ? R * 1.02 : R * 0.9;
  const tampa: Cam = [[0, 0.012], [R * 0.66, 0.012], [R * 0.86, 0.037], [rIn, 0.046], [rIn * 0.97, 0.0505], [R * 0.75, 0.062], [R * 0.45, 0.072]];
  if (funil) tampa.push([R * 0.11, 0.0768], [R * 0.075, 0.0745], [R * 0.066, 0.066], [0, 0.066]);
  else tampa.push([R * 0.2, 0.0768], [0, 0.0775]);
  out.push(parte(torno({
    caminho: tampa, n: 18, m: 48,
    cor: (x, y, z) => {
      const c = pincelada(x, y, z, 0, 0);
      // vapor e gema mais escura em volta do furo
      return funil ? mix(c, mul(c1, 0.6), suave(R * 0.16, R * 0.08, Math.hypot(x, z))) : c;
    },
    desloc: (p) => { if (p.y > 0.05) p.y += 0.0012 * fbm(p.x * 40, 0, p.z * 40, s); },
  }), 'brilhante', true));
  if (funil) {
    // boca do funil de louça aparecendo no furo
    out.push(parte(torno({
      caminho: [[0, 0.05], [R * 0.06, 0.05], [R * 0.058, 0.08], [R * 0.052, 0.0815], [R * 0.044, 0.08], [R * 0.042, 0.06], [0, 0.06]],
      n: 12, m: 28, cor: (x, y, z) => (y < 0.0795 && Math.hypot(x, z) < R * 0.047 ? mul(LOUCA, 0.25) : LOUCA),
    }), 'brilhante'));
  }
  if (v === 'dupla') {
    // saídas de vapor: cinco cortes em leque e um no meio, com o recheio de ruibarbo à mostra
    const corR: CorFn = (x, y, z) => mul(ci, 0.8 + 0.25 * fbm(x * 300, y * 300, z * 300, s));
    for (let i = 0; i < 6; i++) {
      const a = (i / 5) * TAU + 0.3;
      const d = i === 5 ? 0 : R * 0.4;
      const y = i === 5 ? 0.0778 : 0.0748;
      out.push(parte(tf(elipsoide(R * 0.1, 0.0012, R * 0.016, corR, 4, 8), [Math.cos(a) * d, y, Math.sin(a) * d], [0, i === 5 ? 0.9 : -a, i === 5 ? 0 : 0.1]), 'umido'));
    }
  }
  if (v === 'tranca') {
    // trança de três tiras de massa assentada na borda
    const Nc = 16, np = Nc * 6;
    for (let j = 0; j < 3; j++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < np; i++) {
        const u = (i / np) * TAU, th = Nc * u + (j * TAU) / 3;
        const rr = R * 0.97 + 0.0058 * Math.sin(th);
        pts.push(V(Math.cos(u) * rr, 0.0525 + 0.0024 * Math.sin(2 * th), Math.sin(u) * rr));
      }
      out.push(parte(tubo(pts, { raio: 0.0034, achata: 1.35, cima: V(0, 1, 0), m: 6, n: 96, fechado: true, cor: (x, y, z) => mul(pincelada(x, y, z, 0, 0), 0.92 + 0.1 * suave(0.051, 0.056, y)) }), 'brilhante'));
    }
    return out;
  }
  // anel de massa sobre a aba do prato
  const anel: Cam = [[R * 1.05, 0.0395], [R * 1.065, 0.0445], [R * 1.04, 0.0495], [R * 0.96, 0.052], [R * 0.88, 0.0505], [R * 0.855, 0.045], [R * 0.87, 0.0395], [R * 0.96, 0.0405]];
  if (v === 'folhas') {
    out.push(parte(tornoAnel({ caminho: anel, n: 8, m: 48, cor: pincelada }), 'brilhante'));
    // folhas de massa sobrepostas, cada uma com veios marcados na faca
    const nf = 24;
    for (let i = 0; i < nf; i++) {
      const phi = (i / nf) * TAU + r.f(-0.04, 0.04);
      const Lf = R * r.f(0.36, 0.4), Wf = Lf * 0.5;
      const tg = V(-Math.sin(phi), 0, Math.cos(phi));
      const c0 = V(Math.cos(phi) * R * 0.96, 0.0515 + (i % 2) * 0.0018, Math.sin(phi) * R * 0.96).addScaledVector(tg, -Lf * 0.4);
      const g = folha(Lf, Wf, mul(c1, 1.04), mul(c1, 0.5), { contorno: contornos.lanca, esp: 0.0026, curva: 0.06, concha: -0.08, n: 8, m: 6, s: s + i });
      tf(g, [c0.x, c0.y, c0.z], [r.f(-0.15, 0.15), -phi - PI / 2, 0.1]);
      out.push(parte(g, 'brilhante'));
    }
    return out;
  }
  // borda marcada: polegar (torta simples) ou garfo (torta dupla)
  const garfo = v === 'dupla';
  const N = garfo ? 44 : 32;
  const marca = (p: THREE.Vector3) => (garfo ? (0.5 + 0.5 * Math.cos(ang(p) * N)) ** 6 : (0.5 + 0.5 * Math.cos(ang(p) * N)) ** 2.5);
  out.push(parte(tornoAnel({
    caminho: anel, n: 8, m: garfo ? 176 : 128,
    cor: (x, y, z) => {
      const p = V(x, y, z);
      return mul(pincelada(x, y, z, 0, 0), 1 - 0.22 * marca(p) * suave(0.046, 0.05, y));
    },
    desloc: (p) => {
      const h = suave(0.046, 0.051, p.y), m = marca(p);
      p.y -= (garfo ? 0.0013 : 0.0032) * m * h;
      const q = 1 + (garfo ? 0 : 0.014 * m * h);
      p.x *= q; p.z *= q;
    },
  }), 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* bomba com caramelo e amêndoas                                        */
/* ------------------------------------------------------------------ */

const gBombaCaramelo: Gerador = (k) => {
  const { c1, c2, c3, s, r } = k;
  const out: Parte[] = [];
  const L = k.T, Rz = L * 0.1, Ry = L * 0.092;
  const e = (t: number) => Math.sqrt(Math.max(0, 1 - Math.abs(2 * t - 1) ** 5));
  const perfil = (t: number) => ({ ry: Ry * e(t), rz: Rz * e(t), cy: Ry });
  const chao = (p: THREE.Vector3) => { if (p.y < Ry * 0.25) p.y = Ry * 0.25 - (Ry * 0.25 - p.y) * 0.3; };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 40, perfil,
    cor: (x, y, z, t, a) => {
      let c = mul(c1, 0.9 + 0.15 * fbm(x * 160, y * 160, z * 160, s));
      // vales das estrias do bico mais claros, rachaduras da casca
      c = mix(c, c2, (1 - Math.abs(Math.cos(a * 5))) ** 3 * 0.5);
      c = mix(c, c2, suave(0.35, 0.7, fbm(x * 260, y * 60, z * 260, s + 3)) * 0.35);
      return mix(c, mul(c2, 1.05), suave(Ry * 0.6, 0, y) * 0.5);
    },
    mod: (t, a) => 1 + 0.035 * Math.abs(Math.cos(a * 5)) + 0.02 * fbm(t * 10, Math.cos(a) * 2, Math.sin(a) * 2, s),
    desloc: chao,
  }), 'fosco', true));
  // capa de caramelo âmbar só no topo, com a borda escorrida
  out.push(parte(corpo({
    x0: -L / 2 * 0.985, x1: L / 2 * 0.985, n: 30, m: 32, perfil,
    cor: (x, y, z) => mix(mul(c3, 0.7), mix(c3, rgb('#f0b050'), 0.4), suave(Ry * 1.2, Ry * 2, y) * (0.6 + 0.4 * fbm(x * 120, y * 120, z * 120, s))),
    mod: (t, a) => 0.86 + 0.24 * suave(0.05, 0.4, Math.cos(a) + 0.12 * Math.sin(t * 37) + 0.08 * fbm(t * 6, 0, 0, s)),
    desloc: chao,
  }), 'umido'));
  // lascas de amêndoa assentadas no caramelo
  for (let i = 0; i < 26; i++) {
    const t = r.f(0.08, 0.92), x = lerp(-L / 2, L / 2, t);
    const z = r.f(-Rz * 0.55, Rz * 0.55);
    const yTop = Ry + Ry * e(t) * 1.08 * Math.sqrt(Math.max(0, 1 - (z / (Rz * e(t) * 1.08)) ** 2));
    const ra = L * r.f(0.04, 0.055);
    const g = elipsoide(ra, L * 0.0045, ra * 0.68, (xx, _y, zz) => mix(rgb('#f2e4c4'), rgb('#b07a42'), suave(0.75, 0.95, Math.hypot(xx / ra, zz / (ra * 0.68)))), 4, 7);
    tf(g, [x, yTop, z], [r.f(-0.5, 0.5) + z / Rz * 0.6, r.f(0, TAU), r.f(-0.4, 0.4)]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* bolos: fondant com desenhos, estêncil, brilho de geleia, chantilly   */
/* ------------------------------------------------------------------ */

const gBoloFondant: Gerador = (k) => {
  const { c1, c2, s, r } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = k.T * k.A;
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.004], [R, H - 0.009], [R - 0.003, H - 0.002], [R - 0.009, H], [0, H]],
    n: 18, m: 56, cor: (x, y, z) => mul(c1, 0.97 + 0.04 * fbm(x * 25, y * 25, z * 25, s) - (y < 0.003 ? 0.08 : 0)),
  }), 'acetinado', true));
  const corC: CorFn = (x, y, z) => mul(c2, 0.9 + 0.2 * suave(0.3, 1, fbm(x * 300, y * 300, z * 300, s)));
  const rr = 0.0013;
  // arabescos de chocolate no topo: seis volutas saindo do centro
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + r.f(-0.05, 0.05);
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 9; j++) {
      const u = j / 9;
      const d = lerp(R * 0.14, R * 0.66, u), a = a0 + 0.35 * Math.sin(u * PI * 1.3);
      pts.push(V(Math.cos(a) * d, H + rr * 0.6, Math.sin(a) * d));
    }
    // voluta enrolada na ponta
    const pf = pts[pts.length - 1], af = a0 + 0.35 * Math.sin(PI * 1.3);
    for (let j = 1; j <= 7; j++) {
      const w = (j / 7) * TAU * 0.85, rc = R * 0.09 * (1 - j / 10);
      const cx = pf.x - Math.cos(af) * R * 0.09, cz = pf.z - Math.sin(af) * R * 0.09;
      pts.push(V(cx + Math.cos(af + w) * rc, H + rr * 0.6, cz + Math.sin(af + w) * rc));
    }
    out.push(parte(tubo(pts, { raio: rr, m: 4, n: 34, cor: corC }), 'brilhante'));
  }
  // grinalda de festões na lateral, pontinhos no encontro de cada festão e no topo
  const nF = 12, pf: THREE.Vector3[] = [];
  for (let i = 0; i < nF * 8; i++) {
    const a = (i / (nF * 8)) * TAU;
    pf.push(V(Math.cos(a) * (R + rr * 0.7), H * 0.82 - H * 0.14 * Math.abs(Math.sin((a * nF) / 2)), Math.sin(a) * (R + rr * 0.7)));
  }
  out.push(parte(tubo(pf, { raio: rr, m: 4, n: 144, fechado: true, cor: corC }), 'brilhante'));
  for (let i = 0; i < nF; i++) {
    const a = (i / nF) * TAU;
    out.push(parte(tf(elipsoide(0.0026, 0.0026, 0.0022, corC, 4, 6), [Math.cos(a) * (R + 0.0015), H * 0.83, Math.sin(a) * (R + 0.0015)]), 'brilhante'));
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    out.push(parte(tf(elipsoide(0.0022, 0.0016, 0.0022, corC, 4, 6), [Math.cos(a) * (R - 0.012), H + 0.0008, Math.sin(a) * (R - 0.012)]), 'brilhante'));
  }
  return out;
};

/** Desenho rendado da toalhinha em açúcar (0 a 1), por raio relativo e ângulo. */
function renda(r: number, th: number): number {
  const bOut = 0.9 + 0.05 * Math.abs(Math.cos(th * 12));
  const borda = suave(bOut - 0.06, bOut - 0.03, r) * (1 - suave(bOut - 0.01, bOut + 0.01, r));
  const anelE = 1 - suave(0.015, 0.03, Math.abs(r - 0.8));
  const anelM = 1 - suave(0.012, 0.025, Math.abs(r - 0.5));
  const centro = 1 - suave(0.09, 0.12, r);
  let pet = 0;
  if (r > 0.52 && r < 0.79) {
    const u = (r - 0.52) / 0.27, w = 0.75 * Math.sin(PI * u) ** 0.7;
    const d = 1 - Math.abs(Math.cos(th * 6));
    pet = 1 - suave(w * 0.5, w * 0.5 + 0.08, d);
    // furinho no meio de cada pétala
    pet *= suave(0.05, 0.09, Math.hypot(u - 0.5, d * 1.8));
  }
  if (r > 0.13 && r < 0.49) {
    const u = (r - 0.13) / 0.36, w = 0.8 * Math.sin(PI * u) ** 0.8;
    const d = 1 - Math.abs(Math.cos(th * 4 + PI / 8));
    pet = Math.max(pet, 1 - suave(w * 0.45, w * 0.45 + 0.08, d));
  }
  return clamp(Math.max(borda, anelE, anelM, centro, pet));
}

const gBoloEstencil: Gerador = (k) => {
  const { c1, c2, c3, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, h = k.T * 0.13, hf = k.T * 0.04;
  const casca: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.2, 0.8, fbm(x * 70, y * 70, z * 70, s)) * 0.5), 1 - 0.1 * (1 - suave(0.05, 0.15, celula(x * 300, y * 300, z * 300, s))));
  // disco de baixo, recheio de geleia e creme, disco de cima com o desenho de açúcar
  out.push(parte(disco(R, h, casca, { n: 10, m: 48 }), 'fosco', true));
  out.push(parte(tf(disco(R * 0.965, hf, (x, y, z) => (y < hf * 0.5 ? mul(c3, 0.9 + 0.2 * fbm(x * 90, y * 90, z * 90, s)) : mul(ci, 0.97 + 0.04 * fbm(x * 90, y * 90, z * 90, s))), { n: 6, m: 48, borda: 0.8 }), [0, h - 0.0005, 0]), 'acetinado', true));
  const y0 = h + hf - 0.001;
  out.push(parte(tf(torno({
    caminho: trechos([[0, 0, 0], [0.06, R * 0.95, 0], [0.09, R, h * 0.15], [0.16, R, h * 0.85], [0.2, R * 0.96, h], [1, 0, h * 1.04]]),
    n: 34, m: 72,
    cor: (x, y, z) => {
      const c = casca(x, y, z, 0, 0);
      if (y < h * 0.97) return c;
      const q = renda(Math.hypot(x, z) / R, Math.atan2(z, x));
      return mix(c, mix(ACUCAR, [1, 1, 1], cristal(x, y, z, 900, s) * 0.5), q * 0.95);
    },
  }), [0, y0, 0]), 'fosco', true));
  return out;
};

const gBoloGeleia: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const Rg = k.T / 2, R = Rg / 1.28, H = R * 0.55, yG = 0.013;
  // grade redonda de esfriar: aro, arames paralelos e pés
  const corM: CorFn = (x, y, z) => mul(METAL, 0.85 + 0.2 * ruido(x * 300, y * 300, z * 300, s));
  const aro: THREE.Vector3[] = [];
  for (let i = 0; i < 32; i++) aro.push(V(Math.cos((i / 32) * TAU) * Rg, yG, Math.sin((i / 32) * TAU) * Rg));
  out.push(parte(tubo(aro, { raio: 0.0018, m: 5, n: 64, fechado: true, cor: corM }), 'brilhante'));
  for (let i = -4; i <= 4; i++) {
    const z = (i / 4.6) * Rg, c = Math.sqrt(Math.max(0, Rg * Rg - z * z)) * 0.99;
    out.push(parte(tubo([V(-c, yG, z), V(c, yG, z)], { raio: 0.0011, m: 4, n: 4, cor: corM }), 'brilhante'));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    out.push(parte(tubo([V(Math.cos(a) * Rg, yG, Math.sin(a) * Rg), V(Math.cos(a) * Rg * 0.97, 0.0012, Math.sin(a) * Rg * 0.97)], { raio: 0.0013, m: 4, n: 3, cor: corM }), 'brilhante'));
  }
  // bolo de chocolate
  const y0 = yG + 0.0011;
  out.push(parte(tf(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.003], [R, H - 0.003], [R - 0.004, H], [0, H]],
    n: 14, m: 48, cor: (x, y, z) => mul(c1, 0.9 + 0.15 * fbm(x * 140, y * 140, z * 140, s)),
  }), [0, y0, 0]), 'fosco', true));
  // geleia de abricó brilhante: fina no topo, escorrendo em gotas pela lateral
  const g = 0.0012;
  const escorre = (a: number) => Math.max(0, Math.sin(a * 7 + 1.3 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s))) ** 2 * (0.6 + 0.4 * ruido(a * 3, 0, 0, s + 1));
  out.push(parte(tf(torno({
    caminho: [[0, H * 0.4], [R * 0.97, H * 0.4], [R + g, H * 0.45], [R + g, H * 0.97], [R - 0.003, H + g], [R * 0.6, H + g * 1.2], [0, H + g * 1.3]],
    n: 18, m: 64,
    cor: (x, y, z) => {
      const base = mix(mul(c2, 0.55), c2, 0.5 + 0.5 * fbm(x * 90, y * 90, z * 90, s));
      return mix(base, mix(c3, [1, 1, 1], 0.2), suave(0.3, 0.9, fbm(x * 200, y * 40, z * 200, s + 4)) * 0.4);
    },
    desloc: (p) => {
      if (p.y < H * 0.9 && Math.hypot(p.x, p.z) > R * 0.9) {
        const a = Math.atan2(p.z, p.x);
        const fundo = H * (0.86 - 0.5 * escorre(a));
        const f = clamp((p.y - H * 0.45) / (H * 0.45));
        p.y = lerp(fundo, H * 0.9, f);
      }
    },
  }), [0, y0, 0]), 'umido'));
  return out;
};

const gBoloChantilly: Gerador = (k) => {
  const { c1, c2, s, r } = k;
  const out: Parte[] = [];
  const R = k.T / 2 / 1.04, H = R * 0.9;
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R + 0.002, 0.003], [R + 0.003, H - 0.009], [R - 0.004, H - 0.001], [R - 0.013, H], [0, H * 1.004]],
    n: 14, m: 48,
    cor: (x, y, z) => {
      const rr = Math.hypot(x, z), th = Math.atan2(z, x);
      // creme alisado: marcas em espiral da espátula no topo
      return mul(c1, 0.97 + 0.03 * fbm(x * 60, y * 60, z * 60, s) - (y > H * 0.95 ? 0.05 * Math.abs(Math.sin(rr * 160 + th * 2)) ** 3 : 0));
    },
    mod: (t, a) => 1 + 0.006 * fbm(Math.cos(a) * 3, t * 5, Math.sin(a) * 3, s),
  }), 'acetinado', true));
  // capa de castanhas picadas na lateral: grânulos tostados de tons diferentes, relevo áspero
  const hN = H - 0.012;
  const corN: CorFn = (x, y, z) => {
    const cel = celula(x * 260, y * 260, z * 260, s + 4);
    const tipo = ruido(Math.floor(x * 260) * 1.7, Math.floor(y * 260) * 2.3, Math.floor(z * 260) * 3.1, s);
    let c = mix(c2, rgb('#e8cc98'), 0.5 + 0.5 * tipo);
    c = mul(c, 1 - 0.3 * suave(0.5, 0.95, cel));
    // creme aparecendo entre os pedaços no alto da faixa
    return mix(c, c1, suave(hN * 0.85, hN, y) * 0.5);
  };
  out.push(parte(tornoAnel({
    caminho: [[R + 0.0055, 0.0015], [R + 0.0055, hN], [R + 0.0005, hN + 0.002], [R + 0.0005, 0.0015]],
    n: 22, m: 80, cor: corN,
    mod: (t, a) => 1 + 0.018 * ruido(Math.cos(a) * 40, t * 60, Math.sin(a) * 40, s + 9),
  }), 'acetinado'));
  // pedaços maiores soltos por cima da capa
  for (let i = 0; i < 60; i++) {
    const a = r.f(0, TAU), y = H * Math.sqrt(r.f(0.01, 0.8)) * 0.92;
    const tam = R * r.f(0.03, 0.05);
    const tom = r.f(0, 1);
    const cor = mix(c2, rgb('#e6c48c'), tom * 0.6);
    const g = elipsoide(tam, tam * r.f(0.6, 0.9), tam * r.f(0.5, 0.8), (x, yy, z) => mul(cor, 0.85 + 0.25 * ruido(x * 900, yy * 900, z * 900, s)), 4, 4);
    tf(g, [Math.cos(a) * (R + 0.0065), y + tam * 0.5, Math.sin(a) * (R + 0.0065)], [r.f(0, TAU), r.f(0, TAU), r.f(0, TAU)]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gBoloRosetas: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, H = R * 0.8;
  const n = 12;
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.003], [R, H - 0.008], [R - 0.003, H - 0.001], [R - 0.01, H], [0, H]],
    n: 16, m: 48,
    cor: (x, y, z) => {
      const c = mul(c1, 0.97 + 0.03 * fbm(x * 60, y * 60, z * 60, s));
      // marcas leves das 12 divisões feitas com a faca
      return y > H * 0.98 ? mul(c, 1 - 0.07 * Math.abs(Math.cos(Math.atan2(z, x) * n / 2 + PI / 2)) ** 30 * suave(R * 0.1, R * 0.3, Math.hypot(x, z))) : c;
    },
  }), 'acetinado', true));
  const corR: CorFn = (x, y, z) => mul(c1, 0.95 + 0.06 * fbm(x * 200, y * 200, z * 200, s));
  const Rr = R * 0.15, Hr = R * 0.2;
  const Rm = R * 0.085, Hm = R * 0.19;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + PI / n, d = R * 0.76;
    const p: [number, number, number] = [Math.cos(a) * d, H - 0.001, Math.sin(a) * d];
    // roseta de chantilly em bico pitanga
    out.push(parte(tf(torno({
      caminho: (u) => { const th = u * PI; return [u > 0.95 ? 0 : Rr * Math.sin(th) ** 0.55 * (1 - u * 0.5), Hr * (1 - Math.cos(th)) / 2]; },
      n: 7, m: 20, cor: corR,
      mod: (t, aa) => 1 - 0.22 * Math.abs(Math.sin(aa * 2.5 + t * 5)) ** 1.5 * suave(0.05, 0.25, t),
    }), p, [0, a, 0]), 'acetinado'));
    // morango pincelado de geleia, de pé sobre a roseta
    out.push(parte(tf(torno({
      caminho: (u) => { const th = u * PI; return [u > 0.95 ? 0 : Rm * Math.sin(th) ** 0.8 * (1.1 - 0.6 * u), Hm * (1 - Math.cos(th)) / 2]; },
      n: 7, m: 9,
      cor: (x, y, z) => {
        if (y < Hm * 0.1) return c3;
        const c = mix(c2, mul(c2, 0.7), suave(Hm * 0.5, Hm, y) * 0.4);
        return mix(c, rgb('#e8d070'), 1 - suave(0.06, 0.14, celula(x * 500, y * 500, z * 500, s + i)));
      },
    }), [p[0], H + Hr * 0.75, p[2]], [0, 0, 0.12]), 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* pão-de-ló aberto em camadas embebidas                                */
/* ------------------------------------------------------------------ */

const gPaoDeLoCamadas: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2 / 1.3, h = R * 0.22, folga = 0.0015;
  const aNotch = PI * 0.85;
  const miolo = (x: number, y: number, z: number, embebido: number) => {
    // miolo aerado: alvéolos escuros, mais calda nas bordas, poças brilhantes
    const alv = 1 - suave(0.1, 0.45, celula(x * 170, y * 170, z * 170, s));
    let c = mul(ci, 0.95 + 0.1 * ruido(x * 2500, y * 2500, z * 2500, s));
    c = mix(c, rgb('#c08a30'), embebido * (0.3 + 0.35 * suave(-0.3, 0.6, fbm(x * 50, 0, z * 50, s + 2))));
    c = mul(c, 1 - alv * 0.4);
    return mix(c, mix(c, [1, 0.95, 0.75], 0.5), embebido * suave(0.45, 0.8, fbm(x * 90, 0, z * 90, s + 6)) * 0.4);
  };
  const lado = (x: number, y: number, z: number) => {
    let c = mul(c2, 0.92 + 0.12 * fbm(x * 120, y * 120, z * 120, s));
    // entalhe de alinhamento: corte vertical que mostra o miolo
    const d = Math.abs(((Math.atan2(z, x) - aNotch + PI) % TAU + TAU) % TAU - PI);
    c = mix(c, mul(ci, 0.8), 1 - suave(0.04, 0.1, d));
    return c;
  };
  for (let i = 0; i < 3; i++) {
    const topo = i === 2;
    const cor: CorFn = (x, y, z) => {
      const rr = Math.hypot(x, z);
      if (rr > R * 0.975 || y < h * 0.85) {
        return y < 0.0015 && !topo ? miolo(x, y, z, 0.6) : lado(x, y, z);
      }
      if (topo) return mul(c1, 0.9 + 0.14 * fbm(x * 90, y * 90, z * 90, s) - 0.1 * (1 - suave(0.05, 0.15, celula(x * 320, 0, z * 320, s))));
      return miolo(x, y, z, 1);
    };
    const g = torno({
      caminho: topo
        ? [[0, 0], [R * 0.98, 0], [R, h * 0.15], [R, h * 0.85], [R * 0.95, h], [R * 0.5, h * 1.08], [0, h * 1.1]]
        : trechos([[0, 0, 0], [0.06, R * 0.97, 0], [0.09, R, h * 0.12], [0.18, R, h * 0.94], [0.21, R * 0.975, h], [1, 0, h]]),
      n: topo ? 14 : 24, m: topo ? 44 : 52, cor,
      desloc: topo ? undefined : (p) => {
        if (p.y > h * 0.98 && Math.hypot(p.x, p.z) < R * 0.97) p.y -= 0.002 * (1 - suave(0.1, 0.45, celula(p.x * 170, p.y * 170, p.z * 170, s))) + 0.0006 * ruido(p.x * 2500, 0, p.z * 2500, s);
      },
    });
    tf(g, [i * R * 0.36, i * (h + folga), -i * R * 0.08]);
    out.push(parte(g, topo ? 'fosco' : 'acetinado', true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* fôrmas de bolo e de pão: untada, forrada, dupla forração, com massa  */
/* ------------------------------------------------------------------ */

const gForma: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  if (v === 'pao') return formaPao(k);
  const dupla = v === 'dupla';
  const R = k.T / 2 / (dupla ? 1.08 : 1.01), H = R * 0.62, e = 0.0012, Ri = R - e;
  // dentro: manteiga pincelada deixa o metal amarelado e brilhante
  const untado = v === 'disco' || v === 'massa';
  out.push(parte(torno({
    caminho: [[0, 0], [R - 0.004, 0], [R, 0.004], [R, H], [R + 0.0015, H + 0.001], [R - 0.0005, H + 0.0022], [Ri, H], [Ri, e + 0.003], [Ri - 0.003, e], [0, e]],
    n: dupla ? 20 : 24, m: dupla ? 40 : 56,
    cor: (x, y, z) => {
      const dentro = Math.hypot(x, z) < Ri + e * 0.3 && y > e * 0.5 && y < H;
      let c = mul(METAL, 0.88 + 0.12 * Math.abs(Math.sin(Math.hypot(x, z) * 900)) ** 4 + 0.05 * fbm(x * 50, y * 50, z * 50, s));
      if (dentro && untado) c = mix(c, rgb('#e8d8a0'), 0.25 + 0.15 * Math.sin(Math.atan2(z, x) * 40 + 3 * fbm(x * 40, y * 40, z * 40, s)));
      return y < 0.001 ? mul(c, 0.8) : c;
    },
  }), 'brilhante', v !== 'massa'));
  if (v === 'untada') {
    // farinha grudada na manteiga, com o excesso já batido fora
    const d = 0.0007, f = 0.0003;
    out.push(parte(torno({
      caminho: [[0, e + f], [Ri * 0.96, e + f], [Ri - f, e + 0.0035], [Ri - f, H * 0.99], [Ri - f - d, H * 0.99], [Ri - f - d, e + 0.0035 + d], [Ri * 0.95 - d, e + f + d], [0, e + f + d]],
      n: 18, m: 56,
      cor: (x, y, z) => {
        const cobre = suave(-0.45, 0.35, fbm(x * 45, y * 45, z * 45, s + 2));
        return mul(mix(mix(METAL, rgb('#efe0a8'), 0.4), FARINHA, 0.5 + 0.5 * cobre), 0.94 + 0.08 * ruido(x * 2500, y * 2500, z * 2500, s));
      },
    }), 'fosco'));
    return out;
  }
  const corPapel: CorFn = (x, y, z) => mul(PAPEL, 0.93 + 0.07 * fbm(x * 120, y * 120, z * 120, s) - 0.05 * Math.abs(Math.sin(x * 300 + z * 140)) ** 20);
  if (v === 'disco') {
    out.push(parte(tf(disco(Ri - 0.0015, 0.0005, corPapel, { n: 4, m: 56, borda: 0.9 }), [0, e + 0.0002, 0]), 'acetinado'));
    return out;
  }
  if (v === 'massa') {
    // massa crua de bolo de frutas até 2/3, com a cavidade no centro
    out.push(parte(torno({
      caminho: trechos([[0, 0, e + 0.0003], [0.06, Ri * 0.92, e + 0.0003], [0.1, Ri - 0.0005, e + 0.004], [0.2, Ri - 0.0005, H * 0.66], [0.25, Ri - 0.005, H * 0.68], [0.45, Ri * 0.75, H * 0.665], [0.65, Ri * 0.45, H * 0.62], [0.82, Ri * 0.2, H * 0.53], [1, 0, H * 0.5]]),
      n: 26, m: 56,
      cor: (x, y, z) => {
        let c = mul(c1, 0.94 + 0.1 * fbm(x * 90, y * 90, z * 90, s));
        // marcas da espátula em círculos
        c = mul(c, 1 - 0.06 * Math.abs(Math.sin(Math.hypot(x, z) * 260 + fbm(x * 30, 0, z * 30, s) * 2)) ** 3);
        // passas e cerejas aparecendo
        const cel = celula(x * 120, y * 120, z * 120, s);
        const tipo = ruido(Math.floor(x * 120) * 3.1, Math.floor(z * 120) * 5.3, 0, s);
        return mix(c, tipo > 0 ? c2 : rgb('#2a140c'), (1 - suave(0.12, 0.24, cel)) * 0.85);
      },
    }), 'acetinado', true));
    // passas e cerejas cristalizadas meio afundadas na superfície
    for (let i = 0; i < 26; i++) {
      const a = k.r.f(0, TAU), d = Ri * Math.sqrt(k.r.f(0.02, 0.85));
      const yS = H * (0.5 + 0.16 * suave(0, Ri * 0.75, d));
      const passa = i % 3 !== 0;
      const tam = passa ? 0.0045 : 0.0055;
      out.push(parte(tf(elipsoide(tam, tam * 0.55, tam * 0.75, (x, y, z) => mul(passa ? rgb('#3a1a10') : c2, 0.85 + 0.25 * ruido(x * 1500, y * 1500, z * 1500, s)), 4, 6), [Math.cos(a) * d, yS, Math.sin(a) * d], [0, k.r.f(0, TAU), 0]), 'brilhante'));
    }
    return out;
  }
  // dupla forração: papel dobrado por dentro e por fora, jornal amarrado com barbante
  const anelPapel = (r0: number, h0: number, h1: number, esp: number, cor: CorFn, n: number, m: number) =>
    tornoAnel({ caminho: [[r0, h0], [r0, h1], [r0 - esp, h1], [r0 - esp, h0]], n, m, cor });
  out.push(parte(anelPapel(Ri - 0.0004, e + 0.0004, H * 1.45, 0.0008, corPapel, 8, 40), 'fosco'));
  // dobra cortada em piques assentada no fundo, por baixo do disco
  out.push(parte(tf(disco(Ri - 0.0013, 0.0006, (x, y, z) => mul(corPapel(x, y, z, 0, 0), 1 - 0.1 * Math.abs(Math.sin(Math.atan2(z, x) * 24)) ** 12 * suave(Ri * 0.8, Ri * 0.9, Math.hypot(x, z))), { n: 4, m: 48, borda: 0.9 }), [0, e + 0.0003, 0]), 'fosco'));
  out.push(parte(anelPapel(R + 0.0022, 0.0004, H * 1.4, 0.0008, corPapel, 8, 40), 'fosco'));
  const jornal: CorFn = (x, y, z) => {
    const th = Math.atan2(z, x);
    // colunas de texto em blocos cinzentos, entrelinhas claras e uma manchete escura
    const col = Math.abs(Math.sin(th * 9)) > 0.15 ? 1 : 0;
    const bloco = suave(-0.2, 0.2, ruido(th * 9, y * 220, 0, s + 3));
    const linha = 0.6 + 0.4 * ruido(x * 3000, y * 3000, z * 3000, s);
    let c = mul(rgb('#cfcbbe'), 0.95 + 0.05 * fbm(x * 40, y * 40, z * 40, s));
    c = mix(c, rgb('#55524c'), col * (0.35 + 0.4 * bloco) * linha);
    return mix(c, rgb('#2e2c2a'), (Math.abs(y - H * 0.8) < H * 0.06 && Math.sin(th * 3) > 0.3 ? 0.75 : 0));
  };
  out.push(parte(anelPapel(R + 0.006, 0.0002, H * 0.95, 0.0012, jornal, 32, 40), 'fosco'));
  const rB = R + 0.0078, yB = H * 0.5;
  const anel: THREE.Vector3[] = [];
  for (let i = 0; i < 24; i++) anel.push(V(Math.cos((i / 24) * TAU) * rB, yB, Math.sin((i / 24) * TAU) * rB));
  const corB: CorFn = (x, y, z) => mul(BARBANTE, 0.7 + 0.25 * Math.abs(Math.sin((x + y + z) * 2600)));
  out.push(parte(tubo(anel, { raio: 0.0017, m: 4, n: 48, fechado: true, cor: corB }), 'fosco'));
  out.push(parte(tf(elipsoide(0.005, 0.0035, 0.0035, corB, 4, 6), [rB, yB, 0]), 'fosco'));
  return out;
};

/** Fôrma de pão retangular forrada com papel-manteiga, cantos sobrepostos acima da borda. */
function formaPao(k: Ctx): Parte[] {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T / 1.02, W = L * 0.5, H = L * 0.33, e = 0.0012;
  const corM: CorFn = (x, y, z) => mul(LATA, 0.88 + 0.12 * fbm(x * 60, y * 60, z * 60, s) + 0.06 * Math.abs(Math.sin(y * 700)) ** 6);
  const cx = { n: 2, m: 16 };
  const placa = (dx: number, dy: number, dz: number, p: [number, number, number], cor: CorFn, ac: 'brilhante' | 'fosco', r: [number, number, number] = [0, 0, 0], principal = false) =>
    out.push(parte(tf(caixa(dx, dy, dz, cor, cx), p, r), ac, principal));
  placa(L, e, W, [0, e / 2, 0], corM, 'brilhante', [0, 0, 0], true);
  placa(L, H, e, [0, H / 2, W / 2], corM, 'brilhante');
  placa(L, H, e, [0, H / 2, -W / 2], corM, 'brilhante');
  placa(e, H, W, [L / 2, H / 2, 0], corM, 'brilhante');
  placa(e, H, W, [-L / 2, H / 2, 0], corM, 'brilhante');
  // papel por dentro, subindo 2,5 cm acima da borda
  const corP: CorFn = (x, y, z) => mul(PAPEL, 0.92 + 0.08 * fbm(x * 100, y * 100, z * 100, s) - (y > H ? 0.03 : 0));
  const p = 0.0006, Hp = H + 0.025, Li = L - 2 * e - 0.001, Wi = W - 2 * e - 0.001;
  placa(Li, p, Wi, [0, e + p / 2, 0], corP, 'fosco');
  placa(Li, Hp, p, [0, Hp / 2, Wi / 2], corP, 'fosco');
  placa(Li, Hp, p, [0, Hp / 2, -Wi / 2], corP, 'fosco');
  placa(p, Hp, Wi, [Li / 2, Hp / 2, 0], corP, 'fosco');
  placa(p, Hp, Wi, [-Li / 2, Hp / 2, 0], corP, 'fosco');
  // abas dos cantos cortados na diagonal, sobrepostas por dentro
  const ab = 0.028;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (Li / 2 - ab * 0.32), pz = sz * (Wi / 2 - ab * 0.32);
    placa(ab, Hp * 0.98, p, [px, Hp * 0.49, pz], (x, y, z) => mul(corP(x, y, z, 0, 0), 0.93), 'fosco', [0, sx * sz > 0 ? -PI / 4 : PI / 4, 0]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* massa folhada marcada com as voltas                                  */
/* ------------------------------------------------------------------ */

const gFolhadaMarcada: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * 0.72, H = L * 0.11;
  const voltas = k.v.n ?? 6;
  const furos: [number, number][] = [];
  for (let i = 0; i < voltas; i++) furos.push([(Math.floor(i / 2) - (Math.ceil(voltas / 2) - 1) / 2) * L * 0.2, (i % 2 ? 1 : -1) * W * 0.14]);
  const dep = (x: number, z: number) => furos.reduce((m, [fx, fz]) => Math.max(m, Math.exp(-((Math.hypot(x - fx, z - fz) / (L * 0.03)) ** 2))), 0);
  const lado: CorFn = (x, y, z) => {
    // camadas de massa e manteiga aparecendo nas bordas
    const c = mix(c1, c2, suave(0.3, 0.7, Math.sin((y / H) * PI * 5 + fbm(x * 30, 0, z * 30, s)) * 0.5 + 0.5) * 0.6);
    return mul(c, 0.95 + 0.06 * fbm(x * 100, y * 100, z * 100, s));
  };
  // bloco de lados em camadas; o topo com os furinhos é uma grade que assenta sobre ele
  const Hb = H * 0.6;
  out.push(parte(tf(caixa(L, Hb, W, lado, { n: 8, m: 40 }), [0, Hb / 2, 0]), 'acetinado', true));
  out.push(parte(grade(44, 32, L * 0.992, W * 0.992,
    (x, z) => {
      const borda = Math.min(L / 2 - Math.abs(x), W / 2 - Math.abs(z));
      return lerp(Hb * 0.97, H + 0.0005 * fbm(x * 60, 0, z * 60, s), suave(0, 0.009, borda) ** 0.6) - H * 0.3 * dep(x, z);
    },
    (x, y, z) => {
      let c = mul(c1, 0.96 + 0.06 * fbm(x * 80, y * 80, z * 80, s));
      c = mix(c, FARINHA, suave(0.1, 0.6, fbm(x * 45, 0, z * 45, s + 3)) * 0.55);
      return mul(c, 1 - 0.18 * dep(x, z));
    }), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* saco de papel-vegetal                                                */
/* ------------------------------------------------------------------ */

const gSacoPapel: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const L = k.T, Rm = L * 0.19;
  const raio = (t: number) => lerp(Rm, Rm * 0.04, t ** 0.95);
  const fecho = (t: number) => suave(0.2, 0, t);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 40, m: 48,
    perfil: (t) => { const r = raio(t), f = fecho(t); return { ry: r * (1 - 0.6 * f), rz: r * (1 + 0.15 * f), cy: r * (1 - 0.6 * f) }; },
    cor: (x, y, z, t, a) => {
      let c = mul(c1, 0.94 + 0.06 * fbm(x * 90, y * 90, z * 90, s));
      // emenda em espiral do papel enrolado (onde há duas voltas, fica mais branco)
      const sp = (((a / TAU + t * 1.6) % 1) + 1) % 1;
      c = mix(c, mul(c1, 1.1), suave(0.5, 0.58, sp) * 0.7);
      c = mix(c, mul(c1, 0.72), (1 - suave(0.01, 0.06, Math.abs(sp - 0.5))) * 0.8);
      // ponta cortada
      return t > 0.97 ? mul(c, 0.7) : c;
    },
  }), 'acetinado', true));
  // sobra da boca dobrada para dentro e vincada, deitada sobre o cone
  const t0 = 0.05, r0 = raio(t0), f0 = fecho(t0);
  const g = folha(L * 0.3, Rm * 1.5, c1, mul(c1, 0.85), { contorno: (t) => Math.max(0.05, 1 - t * 0.95), esp: 0.0006, curva: -0.1, n: 6, m: 6, cor: (x, y, z) => mul(c1, 0.86 + 0.08 * fbm(x * 90, y * 90, z * 90, s) - 0.12 * Math.exp(-((x / 0.003) ** 2))) });
  tf(g, [-L / 2 + L * 0.01, 2 * r0 * (1 - 0.6 * f0) + 0.0008, 0], [0, 0, -0.12]);
  out.push(parte(g, 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* rolo de massa de biscoito no filme com rodelas                       */
/* ------------------------------------------------------------------ */

const gRoloBiscoito: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T, R = L * 0.13, zr = -R * 1.05;
  const massa: CorFn = (x, y, z) => {
    const c = mul(c1, 0.95 + 0.07 * fbm(x * 120, y * 120, z * 120, s));
    // pontinhos de baunilha
    return mix(c, rgb('#2a1a10'), (1 - suave(0.02, 0.07, celula(x * 900, y * 900, z * 900, s))) * 0.7);
  };
  const xa = -L / 2 + L * 0.18, xb = L / 2 - L * 0.35;
  out.push(parte(tf(corpo({ x0: xa, x1: xb, n: 10, m: 32, tampa: true, cor: massa, corTampa: massa, perfil: () => ({ ry: R, rz: R, cy: R }) }), [0, 0, zr]), 'acetinado', true));
  // filme plástico por cima de parte do rolo, torcido na ponta
  const xf = xb - (xb - xa) * 0.35;
  out.push(parte(tf(corpo({
    x0: -L / 2, x1: xf, n: 30, m: 32,
    perfil: (t) => {
      const x = lerp(-L / 2, xf, t);
      const cauda = suave(xa + R * 0.4, xa - L * 0.05, x);
      const r = lerp(R * 1.025, R * 0.16 * (1 + 0.8 * suave(-L / 2 + L * 0.06, -L / 2, x)), cauda);
      return { ry: r, rz: r, cy: lerp(R, R * 0.6, cauda) };
    },
    mod: (t, a) => 1 + 0.12 * suave(0.25, 0.05, t) * Math.sin(a * 4 + t * 90) + 0.015 * Math.sin(a * 9 + t * 30),
    cor: (x, y, z, t, a) => {
      const sobre = mix(mul(massa(x, y, z, t, a), 1.05), [1, 1, 1], 0.28);
      const vazio = rgb('#dfe3e2');
      return mix(mix(sobre, vazio, suave(xa + R * 0.2, xa - R * 0.4, x)), [1, 1, 1], suave(0.7, 1, Math.cos(a)) * 0.3);
    },
  }), [0, 0, zr]), 'umido'));
  // rodelas cruas já cortadas
  const rr = R * 0.98, hh = L * 0.045;
  for (let i = 0; i < 4; i++) {
    const g = disco(rr, hh, (x, y, z) => mul(massa(x, y, z, 0, 0), y > hh * 0.9 ? 1.04 : 1), { n: 8, m: 32, borda: 0.15 });
    tf(g, [lerp(-L * 0.36, L * 0.36, i / 3), 0, R * 1.35], [0, i * 0.7, 0]);
    out.push(parte(g, 'acetinado'));
  }
  void c2;
  return out;
};

/* ------------------------------------------------------------------ */
/* biscoitos: pingado de amêndoa, demerara, meio coberto de chocolate   */
/* ------------------------------------------------------------------ */

const gBiscoito: Gerador = (k) => {
  const { c1, c2, c3, s, r } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const R = k.T / 2, H = k.T * k.A;
  if (v === 'pingado') {
    // forma livre: espalhou no forno, borda fina e mais tostada
    const forma = (a: number) => 1 + 0.12 * fbm(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0, s) + 0.04 * ruido(Math.cos(a) * 5, Math.sin(a) * 5, 1, s);
    out.push(parte(torno({
      caminho: trechos([[0, 0, 0], [0.4, R * 0.97, 0], [0.47, R, H * 0.3], [0.55, R * 0.9, H * 0.6], [1, 0, H]]),
      n: 18, m: 40,
      cor: (x, y, z) => {
        const rr = Math.hypot(x, z) / R;
        let c = mix(c1, c2, suave(0.6, 1.02, rr) * 0.85);
        c = mul(c, 0.93 + 0.1 * fbm(x * 200, y * 200, z * 200, s));
        // amêndoa moída e furinhos rendados na borda
        c = mix(c, c3, (1 - suave(0.05, 0.14, celula(x * 600, y * 600, z * 600, s))) * 0.6);
        return mix(c, mul(c2, 0.6), (1 - suave(0.1, 0.22, celula(x * 350, 0, z * 350, s + 2))) * suave(0.7, 0.95, rr) * 0.7);
      },
      mod: (t, a) => forma(a),
      desloc: (p) => { p.y *= 1 + 0.15 * fbm(p.x * 80, 0, p.z * 80, s); },
    }), 'fosco', true));
    return out;
  }
  // biscoito redondo de base
  out.push(parte(torno({
    caminho: trechos([[0, 0, 0], [0.32, R * 0.97, 0], [0.4, R, H * 0.45], [0.48, R * 0.94, H * 0.92], [1, 0, H]]),
    n: 16, m: 40,
    cor: (x, y, z) => {
      const rr = Math.hypot(x, z) / R;
      const c = mix(c1, c2, suave(0.75, 1, rr) * 0.6 + suave(H * 0.3, 0, y) * 0.3);
      return mul(c, 0.94 + 0.1 * fbm(x * 180, y * 180, z * 180, s) - 0.08 * (1 - suave(0.03, 0.08, Math.abs(fbm(x * 70, 0, z * 70, s + 3)))));
    },
    mod: (t, a) => 1 + 0.015 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 0, s),
  }), 'fosco', true));
  if (v === 'demerara') {
    // cristais grandes de açúcar demerara, facetados
    for (let i = 0; i < 120; i++) {
      const a = r.f(0, TAU), d = R * 0.93 * Math.sqrt(r.f(0, 1));
      const tam = R * r.f(0.035, 0.06);
      const cor = mix(c3, rgb('#f0c878'), r.f(0.1, 0.9));
      // cada face do cristal reflete diferente: tom sorteado por vértice
      const g = elipsoide(tam, tam * r.f(0.6, 0.9), tam * r.f(0.7, 1), (x, y, z) => mul(cor, 0.8 + 0.45 * (0.5 + 0.5 * ruido(x * 9000, y * 9000, z * 9000, s + i))), 3, 4);
      tf(g, [Math.cos(a) * d, H * (1 - 0.08 * (d / R) ** 2) + tam * 0.2, Math.sin(a) * d], [r.f(0, TAU), r.f(0, TAU), r.f(0, TAU)]);
      out.push(parte(g, 'brilhante'));
    }
    return out;
  }
  // metade mergulhada no chocolate, riscada com o garfo
  const Rc = R * 1.035;
  out.push(parte(corpo({
    x0: -R * 0.04, x1: Rc, n: 20, m: 96, exp: 5,
    perfil: (t) => { const x = lerp(-R * 0.04, Rc, t); const w = Math.sqrt(Math.max(0, Rc * Rc - x * x)); return { ry: H * 0.64, rz: Math.max(1e-4, w), cy: H * 0.52 }; },
    cor: (x, y, z) => mix(mul(c3, 0.8), mul(c3, 1.9), Math.max(0, Math.sin(z * 330 + Math.sin(x * 90) * 1.2)) ** 2 * suave(H * 0.9, H * 1.1, y) * 0.7),
    desloc: (p) => { if (p.y > H * 0.95) p.y += 0.0009 * Math.sin(p.z * 330 + Math.sin(p.x * 90) * 1.2); },
  }), 'brilhante'));
  return out;
};

/* ------------------------------------------------------------------ */
/* lote                                                                 */
/* ------------------------------------------------------------------ */

export const LOTE: Lote = {
  'saco-confeitar-cheio': { visual: { f: 'merengue', v: 'saco-cheio', t: 0.3, a: 0.25, c1: '#f8f6f0', c2: '#e8e2d4', ci: '#f8f6f0', cc: '#f8f6f0', ac: 'umido' }, gerar: gSacoCheio },
  'conchas-merengue-ganache': { visual: { f: 'merengue', v: 'conchas-ganache', t: 0.075, a: 0.7, c1: '#f6f0e2', c2: '#e6d8bc', ci: '#4a2618', cc: '#e8c890', ac: 'fosco' }, gerar: gConchasGanache },
  'forma-sufle-forrada': { visual: { f: 'bolo', v: 'forrada', t: 0.09, a: 0.6, c1: '#fbfaf6', c2: '#f0dc98', ci: '#fbfaf6', cc: '#fbfaf6', ac: 'brilhante' }, gerar: gSufle },
  'sufle-cru-nivelado': { visual: { f: 'bolo', v: 'cru', t: 0.09, a: 0.6, c1: '#f2dc9c', c2: '#e8cc80', ci: '#f2dc9c', cc: '#c89040', ac: 'acetinado' }, gerar: gSufle },
  'pudim-vapor-embrulhado': { visual: { f: 'bolo', v: 'pudim-embrulhado', t: 0.17, a: 0.75, c1: '#efe6d4', c2: '#c9cbcd', ci: '#8a4a22', cc: '#c9cbcd', ac: 'brilhante' }, gerar: gPudimEmbrulhado },
  'calda-ponto-fio': { visual: { f: 'confeito', v: 'fio', t: 0.05, a: 0.1, c1: '#e6bc5a', ci: '#e6bc5a', cc: '#e6bc5a', ac: 'umido' }, gerar: gCaldaPonto },
  'calda-ponto-bala-mole': { visual: { f: 'confeito', v: 'bala-mole', t: 0.022, a: 0.6, c1: '#e0b04c', ci: '#e0b04c', cc: '#e0b04c', ac: 'umido' }, gerar: gCaldaPonto },
  'calda-ponto-bala-dura': { visual: { f: 'confeito', v: 'bala-dura', t: 0.019, a: 0.9, c1: '#d89e3a', ci: '#d89e3a', cc: '#d89e3a', ac: 'umido' }, gerar: gCaldaPonto },
  'calda-ponto-crosta-mole': { visual: { f: 'confeito', v: 'crosta-mole', t: 0.045, a: 0.1, c1: '#c8832a', ci: '#c8832a', cc: '#c8832a', ac: 'umido' }, gerar: gCaldaPonto },
  'calda-ponto-crosta-dura': { visual: { f: 'confeito', v: 'crosta-dura', t: 0.05, a: 0.08, c1: '#b8681a', ci: '#b8681a', cc: '#b8681a', ac: 'umido' }, gerar: gCaldaPonto },
  'sorbet-blueberry': { visual: { f: 'confeito', v: 'bola', t: 0.056, a: 0.9, c1: '#5e2c74', c2: '#a888c4', ci: '#4e2462', cc: '#4e2462', ac: 'acetinado' }, gerar: gSorbet },
  'sorbet-roseta': { visual: { f: 'confeito', v: 'roseta', t: 0.06, a: 0.75, c1: '#f0a24a', c2: '#fad08a', ci: '#f0a24a', cc: '#f0a24a', ac: 'acetinado' }, gerar: gSorbet },
  'formas-chocolate-polvilhadas': { visual: { f: 'confeito', v: 'formas-polvilhadas', t: 0.1, a: 0.08, c1: '#3e2318', c2: '#fbfaf6', ci: '#3e2318', cc: '#3e2318', ac: 'brilhante' }, gerar: gFormasPolvilhadas },
  'farofa-massa-podre': { visual: { f: 'massa_bola', v: 'farofa', t: 0.17, a: 0.3, c1: '#ecdcb4', c2: '#f0d47a', c3: '#fbf8f0', ci: '#eee2c2', cc: '#d8a050', ac: 'fosco' }, gerar: gFarofaMassa },
  'torta-crua-funil': { visual: { f: 'torta', v: 'funil', t: 0.25, a: 0.32, c1: '#dba64a', c2: '#eedcae', c3: '#f2efe8', ci: '#c0703a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'torta-dupla-crua': { visual: { f: 'torta', v: 'dupla', t: 0.25, a: 0.32, c1: '#dba64a', c2: '#eedcae', c3: '#f2efe8', ci: '#a8344a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'fundo-torta-pregas': { visual: { f: 'torta', v: 'pregas', t: 0.25, a: 0.25, c1: '#eedcae', c2: '#eedcae', c3: '#f2efe8', ci: '#eedcae', cc: '#d8a050', ac: 'acetinado' }, gerar: gTortaCrua },
  'torta-borda-folhas': { visual: { f: 'torta', v: 'folhas', t: 0.25, a: 0.32, c1: '#dba64a', c2: '#eedcae', c3: '#f2efe8', ci: '#c0703a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'torta-borda-tranca': { visual: { f: 'torta', v: 'tranca', t: 0.25, a: 0.32, c1: '#dba64a', c2: '#eedcae', c3: '#f2efe8', ci: '#c0703a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'bomba-caramelo-amendoa': { visual: { f: 'choux', v: 'bomba-caramelo', t: 0.13, a: 0.2, l: 0.2, c1: '#b07a3c', c2: '#dcb478', c3: '#a0581a', ci: '#f6eedc', cc: '#c8873a', ac: 'fosco' }, gerar: gBombaCaramelo },
  'bolo-fondant-desenhos': { visual: { f: 'bolo', v: 'fondant', t: 0.2, a: 0.5, c1: '#f6efe4', c2: '#3a2116', ci: '#f0d890', cc: '#f6efe4', ac: 'acetinado' }, gerar: gBoloFondant },
  'massa-folhada-marcada': { visual: { f: 'placa', v: 'folhada-marcada', t: 0.2, a: 0.11, l: 0.72, c1: '#efdcae', c2: '#f4e2a0', ci: '#efdcae', cc: '#d8a050', n: 6, ac: 'acetinado' }, gerar: gFolhadaMarcada },
  'forma-bolo-untada': { visual: { f: 'bolo', v: 'untada', t: 0.22, a: 0.32, c1: '#b6b8ba', ci: '#f3eee2', cc: '#b6b8ba', ac: 'brilhante' }, gerar: gForma },
  'forma-bolo-disco-papel': { visual: { f: 'bolo', v: 'disco', t: 0.22, a: 0.32, c1: '#b6b8ba', ci: '#efe7d3', cc: '#b6b8ba', ac: 'brilhante' }, gerar: gForma },
  'forma-bolo-dupla-forracao': { visual: { f: 'bolo', v: 'dupla', t: 0.24, a: 0.4, c1: '#b6b8ba', ci: '#efe7d3', cc: '#b6b8ba', ac: 'brilhante' }, gerar: gForma },
  'forma-pao-forrada': { visual: { f: 'bolo', v: 'pao', t: 0.24, a: 0.4, l: 0.5, c1: '#8e9194', ci: '#efe7d3', cc: '#8e9194', ac: 'brilhante' }, gerar: gForma },
  'forma-bolo-massa-crua': { visual: { f: 'bolo', v: 'massa', t: 0.22, a: 0.32, c1: '#d2a462', c2: '#a8202a', ci: '#d2a462', cc: '#8a5a2a', ac: 'acetinado' }, gerar: gForma },
  'pao-de-lo-camadas-embebidas': { visual: { f: 'bolo', v: 'camadas-embebidas', t: 0.26, a: 0.25, c1: '#c08a3a', c2: '#b8782a', ci: '#f2d888', cc: '#c08a3a', ac: 'acetinado' }, gerar: gPaoDeLoCamadas },
  'bolo-estencil-renda': { visual: { f: 'bolo', v: 'estencil', t: 0.2, a: 0.34, c1: '#d09a48', c2: '#b8782a', c3: '#a8162a', ci: '#f8f2e4', cc: '#d09a48', ac: 'fosco' }, gerar: gBoloEstencil },
  'bolo-brilho-abrico': { visual: { f: 'bolo', v: 'brilho-geleia', t: 0.25, a: 0.3, c1: '#4a2a1c', c2: '#d8862a', c3: '#f0b050', ci: '#4a2a1c', cc: '#8a4a20', ac: 'fosco' }, gerar: gBoloGeleia },
  'bolo-chantilly-castanhas': { visual: { f: 'bolo', v: 'chantilly-castanhas', t: 0.21, a: 0.45, c1: '#faf8f2', c2: '#a8743a', ci: '#f2d888', cc: '#faf8f2', ac: 'acetinado' }, gerar: gBoloChantilly },
  'bolo-rosetas-morango': { visual: { f: 'bolo', v: 'rosetas-morango', t: 0.2, a: 0.45, c1: '#faf8f2', c2: '#c8141e', c3: '#3a7a2a', ci: '#f2d888', cc: '#faf8f2', ac: 'acetinado' }, gerar: gBoloRosetas },
  'saco-papel-cone': { visual: { f: 'confeito', v: 'saco-papel', t: 0.16, a: 0.3, c1: '#efe7d3', ci: '#efe7d3', cc: '#efe7d3', ac: 'acetinado' }, gerar: gSacoPapel },
  'rolo-biscoito-rodelas': { visual: { f: 'confeito', v: 'rolo-rodelas', t: 0.17, a: 0.3, c1: '#ead0a0', c2: '#e0c090', ci: '#ead0a0', cc: '#c89048', ac: 'acetinado' }, gerar: gRoloBiscoito },
  'biscoito-pingado-amendoa': { visual: { f: 'confeito', v: 'pingado', t: 0.06, a: 0.1, c1: '#dcae62', c2: '#9a5a22', c3: '#f0dcb0', ci: '#dcae62', cc: '#dcae62', ac: 'fosco' }, gerar: gBiscoito },
  'biscoito-demerara': { visual: { f: 'confeito', v: 'demerara', t: 0.06, a: 0.15, c1: '#dcaa5a', c2: '#a8682a', c3: '#b87a32', ci: '#dcaa5a', cc: '#dcaa5a', ac: 'fosco' }, gerar: gBiscoito },
  'biscoito-meio-chocolate': { visual: { f: 'confeito', v: 'meio-chocolate', t: 0.06, a: 0.13, c1: '#e4bc70', c2: '#b8803a', c3: '#3a2116', ci: '#e4bc70', cc: '#e4bc70', ac: 'fosco' }, gerar: gBiscoito },
};
