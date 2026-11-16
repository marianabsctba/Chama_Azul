// Alimentos novos pedidos pela ficha de cena (cena1): as formas intermediárias que os passos de
// caldos, ovos, queijos, ervas, peixes e frutos do mar mostram e que não tinham modelo: ossos e
// aparas para caldo, cabeça e carcaça de peixe, peixes abertos em borboleta, pelados e embrulhados,
// filés de gravadlax, enfeites de peixe (laço de anchova, borboleta de lima, limões trançado e
// alado, rosa de gengibre, cebolinha em cachos, pepino torcido), caranguejo desmontado e recheado,
// cauda e medalhões de lagosta, gema limpa, omelete em rolo, queijos e legumes recheados.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, semente, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, criarCtx, type Ctx, type Gerador, type Visual } from '../pecas';
import type { Acabamento } from '../material';
import { gPeixe, gPeixeChato, gFilePeixe } from '../fam_mar';
import { chapa, corSalmao } from './peixes';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* Utilidades de malha                                                  */
/* ------------------------------------------------------------------ */

const C = (h: string): RGB => rgb(h);
type Pos = [number, number, number];

/** Fica só com os triângulos cujo centro passa no teste (vértices compactados). */
function cortar(g: THREE.BufferGeometry, manter: (x: number, y: number, z: number) => boolean): THREE.BufferGeometry | null {
  const pos = g.getAttribute('position'), col = g.getAttribute('color'), nor = g.getAttribute('normal');
  const ix = g.getIndex()!.array as ArrayLike<number>;
  const novo = new Map<number, number>();
  const P: number[] = [], Cc: number[] = [], N: number[] = [], I: number[] = [];
  for (let f = 0; f < ix.length; f += 3) {
    const a = ix[f], b = ix[f + 1], c = ix[f + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (!manter(cx, cy, cz)) continue;
    for (const v of [a, b, c]) {
      let n = novo.get(v);
      if (n === undefined) {
        n = P.length / 3;
        novo.set(v, n);
        P.push(pos.getX(v), pos.getY(v), pos.getZ(v));
        Cc.push(col.getX(v), col.getY(v), col.getZ(v));
        N.push(nor.getX(v), nor.getY(v), nor.getZ(v));
      }
      I.push(n);
    }
  }
  if (!I.length) return null;
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  r.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  r.setIndex(I);
  return r;
}

/** Repinta a cor por vértice a partir da posição e da cor atual. */
function recolorir(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, c: RGB) => RGB): void {
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const c = f(pos.getX(i), pos.getY(i), pos.getZ(i), [col.getX(i), col.getY(i), col.getZ(i)]);
    col.setXYZ(i, clamp(c[0]), clamp(c[1]), clamp(c[2]));
  }
  col.needsUpdate = true;
}

function caixaDe(gs: THREE.BufferGeometry[]): THREE.Box3 {
  const b = new THREE.Box3();
  for (const g of gs) {
    g.computeBoundingBox();
    b.union(g.boundingBox!);
  }
  return b;
}

/** Caixa dos vértices numa faixa de X (para tampar um corte). */
function secaoX(gs: THREE.BufferGeometry[], x0: number, x1: number) {
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const g of gs) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x < x0 || x > x1) continue;
      y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i));
      z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i));
    }
  }
  return { cy: (y0 + y1) / 2, cz: (z0 + z1) / 2, ry: (y1 - y0) / 2, rz: (z1 - z0) / 2, y0 };
}

/** Vértices de cima de uma geometria (para espalhar coisas sobre a peça). */
function topo(g: THREE.BufferGeometry, minNy = 0.75): THREE.Vector3[] {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) if (n.getY(i) > minNy) out.push(V(p.getX(i), p.getY(i), p.getZ(i)));
  return out;
}

/** Caminho de domo (monte) para o torno: base plana de raio R e altura Hd. */
function domo(R: number, Hd: number): [number, number][] {
  const c: [number, number][] = [[0, 0], [R * 0.97, 0]];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI * 0.5; c.push([R * Math.cos(a) * (i === 8 ? 0 : 1), Hd * Math.sin(a) ** 0.8]); }
  return c;
}

const ctxDe = (id: string, v: Visual, a: number, l: number, ac: Acabamento): Ctx => criarCtx(id, v, semente(id), a, l, ac);
/** Peixe roliço do gerador da família, deitado de lado (flanco para cima, dorso em +Z, cabeça em +X). */
const peixe = (id: string, v: Visual) => gPeixe(ctxDe(id, v, 0.2, 0.11, 'umido'));
const tom = (c: RGB, amp: number, f: number, s = 0): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));

const SALMAO: Visual = { f: 'peixe', v: 'rolico', t: 0.7, a: 0.22, l: 0.11, c1: '#4a5a6a', c2: '#d9dde0', ci: '#f08a5d', cc: '#f4c4a3', c3: '#c0c8cf', d: 'pintas' };
const TRUTA: Visual = { f: 'peixe', v: 'rolico', t: 0.35, a: 0.2, l: 0.1, c1: '#6f7a5a', c2: '#e0d9c8', ci: '#f2a37f', cc: '#f3d0b8', c3: '#e58a8a', d: 'pintas faixa iridescente' };
const SARDINHA: Visual = { f: 'peixe', v: 'rolico', t: 0.15, a: 0.17, l: 0.09, c1: '#2e4f7a', c2: '#d8dfe6', ci: '#b5695a', cc: '#d8b49a', c3: '#b8c4d0', d: 'iridescente' };
const MERLUZA: Visual = { f: 'peixe', v: 'rolico', t: 0.45, a: 0.17, l: 0.1, c1: '#8c949c', c2: '#e5e8ea', ci: '#f4f0ea', cc: '#fbf8f2', c3: '#b0b8c0', d: 'duasdorsais' };

/** Pedaços do peixe que passam no teste de X (nadadeiras do meio somem junto). */
function pedacos(ps: Parte[], manter: (x: number, y: number, z: number) => boolean): Parte[] {
  const out: Parte[] = [];
  for (const p of ps) {
    const g = cortar(p.g, manter);
    if (g) out.push(parte(g, p.ac, p.corpo));
  }
  return out;
}

/** Seção de peixe cortado: carne com septos, pele na borda e espinha no centro. */
function corCorte(s: { cy: number; cz: number; ry: number; rz: number }, carne: RGB, pele: RGB, semEspinha = false): CorFn {
  const OSSO = C('#efe8da'), SANGUE = C('#8a2e26');
  return (x, y, z) => {
    const ny = (y - s.cy) / Math.max(1e-5, s.ry), nz = (z - s.cz) / Math.max(1e-5, s.rz);
    const r = Math.hypot(ny, nz);
    let c = mix(carne, mul(carne, 0.86), Math.abs(Math.sin(Math.atan2(nz, ny) * 2 + r * 7)) ** 14 * 0.5);
    c = mix(c, pele, suave(0.84, 0.97, r));
    if (!semEspinha) {
      c = mix(c, SANGUE, (1 - suave(0.06, 0.12, Math.hypot(ny * 1.1, nz + 0.02))) * 0.55);
      c = mix(c, OSSO, 1 - suave(0.08, 0.12, Math.hypot(ny * 1.15, (nz - 0.12) * 1.4)));
    }
    return mul(c, 1 + 0.05 * fbm(x * 300, y * 300, z * 300, 3));
  };
}

/** Tampa fina (elipse em YZ) na face de um corte em X. */
function tampa(x: number, s: { cy: number; cz: number; ry: number; rz: number }, cor: CorFn): THREE.BufferGeometry {
  return tf(elipsoide(0.0012, s.ry * 0.97, s.rz * 0.97, cor, 6, 22), [x, s.cy, s.cz]);
}

/** Espinha de peixe deitada no plano XZ: coluna com vértebras, espinhos dorsais (+Z) e costelas (-Z). */
function espinha(x0: number, x1: number, y: number, r: number, n: number, alt: number, cor: CorFn, costelas = true): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const L = x1 - x0;
  out.push(tubo([V(x0, y, 0), V(x0 + L * 0.5, y, r * 0.6), V(x1, y, 0)], {
    raio: (t) => r * (0.85 + 0.35 * Math.abs(Math.sin(t * PI * n)) ** 0.5), m: 6, n: Math.max(12, n * 3), cor, cima: V(0, 1, 0),
  }));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * L;
    const f = 0.55 + 0.45 * Math.sin(PI * ((i + 0.5) / n));
    out.push(tubo([V(x, y, r), V(x - alt * 0.15, y, alt * 0.5 * f), V(x - alt * 0.4, y - r * 0.3, alt * f)], { raio: (t) => r * 0.32 * (1 - 0.75 * t), m: 4, n: 5, cor }));
    if (costelas) out.push(tubo([V(x, y, -r), V(x - alt * 0.1, y - r * 0.2, -alt * 0.55 * f), V(x - alt * 0.45, y - r * 0.5, -alt * 1.05 * f)], { raio: (t) => r * 0.28 * (1 - 0.7 * t), m: 4, n: 5, cor }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Caldos: carcaça de frango, aparas e cabeça de peixe, bonito seco     */
/* ------------------------------------------------------------------ */

/** Carcaça de frango crua: espinhaço em cima, costelas em arco até o esterno, bacia larga atrás. */
const gCarcacaFrango: Gerador = (k) => {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T, H = L * 0.42, W = L * 0.55;
  const OSSO = C('#eadcc4'), CARNE = C('#d48f86'), SANGUE = C('#9a3a34');
  const cOsso: CorFn = (x, y, z) => {
    let c = mix(OSSO, CARNE, suave(0.05, 0.55, fbm(x * 90, y * 90, z * 90, s)) * 0.75);
    c = mix(c, SANGUE, suave(0.55, 0.85, fbm(x * 160, y * 160, z * 160, s + 4)) * 0.5);
    return mul(c, 1 + 0.06 * ruido(x * 400, y * 400, z * 400, s));
  };
  // espinhaço com as vértebras marcadas
  out.push(parte(tubo([V(-L * 0.5, H * 0.82, 0), V(-L * 0.15, H * 0.95, 0), V(L * 0.2, H * 0.92, 0), V(L * 0.5, H * 0.7, 0)], {
    raio: (t) => L * 0.028 * (0.8 + 0.3 * Math.abs(Math.sin(t * PI * 14)) ** 0.4), m: 8, n: 42, cor: cOsso, cima: V(0, 1, 0),
  }), 'acetinado', true));
  // costelas: arcos do espinhaço até a quilha, dos dois lados
  const nC = 7;
  for (let i = 0; i < nC; i++) {
    const x = lerp(-L * 0.05, L * 0.4, i / (nC - 1));
    const f = 1 - 0.35 * (i / (nC - 1)) ** 2;
    for (const sg of [-1, 1]) {
      const pts = [V(x, H * 0.88, sg * L * 0.02), V(x - L * 0.02, H * 0.72, sg * W * 0.4 * f), V(x - L * 0.04, H * 0.32, sg * W * 0.48 * f), V(x - L * 0.02, H * 0.06, sg * W * 0.16 * f)];
      out.push(parte(tubo(pts, { raio: (t) => L * 0.009 * (1 - 0.3 * t), m: 5, n: 14, cor: cOsso }), 'acetinado'));
    }
  }
  // quilha do esterno, lâmina fina embaixo na frente
  out.push(parte(tf(elipsoide(L * 0.2, H * 0.12, L * 0.015, cOsso, 10, 10), [L * 0.22, H * 0.1, 0]), 'acetinado'));
  // bacia (ostra) larga e achatada atrás, com carne grudada
  out.push(parte(tf(elipsoide(L * 0.24, H * 0.13, W * 0.42, (x, y, z) => mix(cOsso(x, y, z, 0, 0), CARNE, suave(-0.2, 0.4, fbm(x * 50, 0, z * 50, s + 2)) * 0.6), 12, 16,
    (t, a) => 1 + 0.12 * Math.cos(a * 2) * Math.sin(PI * t)), [-L * 0.3, H * 0.72, 0]), 'acetinado'));
  // pescoço curto na frente
  out.push(parte(tubo([V(L * 0.45, H * 0.72, 0), V(L * 0.52, H * 0.6, L * 0.01), V(L * 0.56, H * 0.45, 0)], { raio: L * 0.032, m: 8, n: 10, cor: (x, y, z) => mix(cOsso(x, y, z, 0, 0), CARNE, 0.5) }), 'acetinado'));
  return out;
};

/** Aparas para caldo de peixe: pedaços de espinha, carne branca solta, barbatanas e pele. */
const gAparasPeixe: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const OSSO = C('#f0eadc'), CARNE = C('#f4efe6'), PELE = C('#9aa2aa');
  const cOsso: CorFn = (x, y, z) => mix(mul(OSSO, 1 + 0.05 * ruido(x * 500, y * 500, z * 500, s)), C('#d8a8a0'), suave(0.5, 0.9, fbm(x * 120, y * 120, z * 120, s)) * 0.5);
  // três pedaços de espinha com costelas
  const esp: [number, number, number, number][] = [[-0.04, 0.02, 0.6, 0.075], [0.012, -0.03, -0.4, 0.06], [0.035, 0.03, 2.4, 0.05]];
  esp.forEach(([x, z, ang, L], i) => {
    for (const g of espinha(-L / 2, L / 2, 0.003, 0.0028, 7, 0.022, cOsso, i !== 2)) out.push(parte(tf(g, [x, 0.0005 + i * 0.002, z], [0, ang, 0]), 'acetinado', i === 0));
  });
  // carne branca em pedaços irregulares
  const cCarne: CorFn = (x, y, z) => {
    const l = Math.abs(Math.sin((x + z * 0.6) * 260 + 2 * fbm(x * 40, y * 40, z * 40, s))) ** 8;
    return mul(mix(CARNE, C('#e2d6c8'), l * 0.6), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s + 1));
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r.f(-0.3, 0.3), d = r.f(0.015, 0.045);
    const rx = r.f(0.008, 0.014);
    out.push(parte(tf(elipsoide(rx, rx * 0.45, rx * 0.7, cCarne, 7, 9, (t, b) => 1 + 0.18 * fbm(t * 3, Math.cos(b), Math.sin(b), s + i)), [Math.cos(a) * d, rx * 0.4 + r.f(0, 0.004), Math.sin(a) * d], [r.f(-0.2, 0.2), r.f(0, TAU), 0]), 'umido'));
  }
  // barbatanas cortadas, com raios
  for (let i = 0; i < 3; i++) {
    const L = r.f(0.022, 0.032);
    const g = folha(L, L * 0.8, mul(PELE, 1.1), mul(PELE, 0.8), {
      contorno: contornos.gota, n: 7, m: 7, curva: 0.08,
      cor: (x, y, z) => mul(mix(C('#c8ccd0'), C('#7a8288'), Math.abs(Math.sin(Math.atan2(z, x) * 14)) ** 6 * 0.6), 1 + 0.05 * ruido(x * 600, 0, z * 600, s)),
    });
    out.push(parte(tf(g, [r.f(-0.05, 0.05), 0.006 + i * 0.002, r.f(-0.04, 0.04)], [0, r.f(0, TAU), 0.1]), 'acetinado'));
  }
  // tira de pele prateada
  out.push(parte(tf(folha(0.05, 0.014, PELE, PELE, { contorno: contornos.fita, n: 10, m: 5, ondula: 0.15, cor: (x, y, z) => mix(C('#c8d0d6'), C('#5a6670'), suave(-0.004, 0.006, z)) }), [-0.02, 0.008, -0.045], [0, 0.4, 0]), 'umido'));
  return out;
};

/** Cabeça de peixe branco (merluza) cortada atrás das guelras, com a seção e o vermelho das guelras. */
const gCabecaPeixe: Gerador = () => {
  const T = MERLUZA.t, xc = T / 2 - 0.3 * T, xOp = T / 2 - 0.26 * T;
  const out = pedacos(peixe('merluza', MERLUZA), (x) => x > xc);
  const corpos = out.filter((p) => p.corpo).map((p) => p.g);
  const sc = secaoX(corpos, xc, xc + 0.006);
  for (const g of corpos) {
    // guelras vermelhas aparecendo na fresta do opérculo
    recolorir(g, (x, y, z, c) => {
      const d = x - xOp + 0.004 * Math.sin(z * 260);
      const k = (1 - suave(0.001, 0.007, Math.abs(d + 0.004))) * suave(-0.4, 0.2, (z - sc.cz) / sc.rz) * (1 - suave(0.55, 0.9, Math.abs(z - sc.cz) / sc.rz));
      return mix(c, mul(C('#a82a2a'), 1 + 0.2 * ruido(x * 900, y * 900, z * 900)), k * 0.85);
    });
  }
  out.push(parte(tampa(xc, sc, corCorte(sc, C('#f4efe6'), C('#9aa2aa'))), 'umido'));
  return out;
};

/** Lascas de bonito seco (katsuobushi): aparas finas, enroladas e rosadas, num montinho. */
const gBonitoSeco: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const A = C('#d9a184'), B = C('#a8604a');
  const n = 26;
  for (let i = 0; i < n; i++) {
    const L = r.f(0.018, 0.03), W = L * r.f(0.45, 0.7);
    const tint = r.f(0, 1);
    const g = folha(L, W, A, B, {
      contorno: contornos.redonda, n: 6, m: 6, esp: 0.00025, curva: r.f(-0.6, 0.6), concha: r.f(0.3, 0.9), ondula: 0.25,
      cor: (x, y, z) => {
        const veio = Math.abs(Math.sin(x * 700 + z * 120 + 3 * fbm(x * 90, 0, z * 90, s + i))) ** 3;
        return mul(mix(mix(A, C('#ecc4ac'), tint * 0.5), B, veio * 0.45), 1 + 0.06 * ruido(x * 900, y * 900, z * 900, s));
      },
    });
    const a = r.f(0, TAU), d = 0.03 * Math.sqrt(r.n());
    const h = 0.012 * (1 - d / 0.035) + r.f(0, 0.004);
    out.push(parte(tf(g, [Math.cos(a) * d - L / 2, h, Math.sin(a) * d], [r.f(-0.7, 0.7), r.f(0, TAU), r.f(-0.5, 0.5)]), 'fosco', i < 4));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Ovos e queijos                                                       */
/* ------------------------------------------------------------------ */

/** Gema separada sem nada de clara: domo laranja brilhante com reflexo claro. */
const gGemaLimpa: Gerador = (k) => {
  const R = k.T / 2, H = R * 0.62;
  const G = C('#f2a414');
  return [parte(torno({
    caminho: (t) => {
      const a = t * PI * 0.5;
      const r = t < 0.12 ? R * 0.96 * (t / 0.12) : R * Math.cos((t - 0.12) / 0.88 * PI * 0.5) ** 0.85;
      return [Math.max(0, r), t < 0.12 ? 0 : H * Math.sin(a + 0.1) ** 1.1];
    },
    n: 18, m: 30, l: 0.96,
    cor: (x, y, z) => {
      let c = mix(mul(G, 0.9), C('#f8c040'), suave(0.2, 1, y / H) * 0.6);
      c = mix(c, C('#e88a10'), suave(0.6, 1, Math.hypot(x, z) / R) * 0.4);
      return mul(c, 1 + 0.03 * fbm(x * 300, y * 300, z * 300, k.s));
    },
  }), 'brilhante', true)];
};

/** Omelete fina enrolada em rolo: a espiral das camadas aparece nas pontas. */
const gOmeleteRolo: Gerador = (k) => {
  const { s } = k;
  const L = k.T, r0 = L * 0.035, passo = L * 0.03, voltas = 3.2, e = L * 0.012;
  const A = C('#f2cc4a'), D = C('#c8902e');
  const g = chapa(70, 10, (u, v, lado) => {
    const th = u * voltas * TAU;
    const r = r0 + (passo * th) / TAU + (lado ? e * 0.5 : -e * 0.5);
    const x = (v * L) / 2 * (1 - 0.04 * Math.cos(th));
    return [x, r * Math.sin(th) * 0.92, r * Math.cos(th)];
  }, (x, y, z, u, v, lado) => {
    // face de fora dourada em manchas, de dentro amarela lisa
    const fora = lado === 1 && u > 0.82;
    let c = mul(A, 1 + 0.06 * fbm(x * 120, y * 120, z * 120, s));
    if (fora) c = mix(c, D, suave(-0.1, 0.5, fbm(x * 70, y * 70, z * 70, s + 2)) * 0.75);
    return mix(c, mul(A, 0.92), Math.abs(v) > 0.97 ? 0.4 : 0);
  });
  g.rotateY(0); // eixo do rolo em X
  return [parte(g, 'acetinado', true)];
};

/** Queijo fresco caseiro em disco alto, úmido, com a marca das furinhos da forma escorredora. */
const gQueijoFrescoDisco: Gerador = (k) => {
  const { s } = k;
  const R = k.T / 2, H = R * 1.05;
  const B = C('#f7f5ee');
  return [parte(torno({
    caminho: [[0, 0], [R * 0.9, 0], [R, H * 0.08], [R * 1.01, H * 0.6], [R * 0.97, H * 0.92], [R * 0.82, H * 1.0], [R * 0.3, H * 1.04], [0, H * 1.03]],
    n: 26, m: 36,
    mod: (t, a) => 1 + 0.03 * fbm(t * 4, Math.cos(a) * 2, Math.sin(a) * 2, s) - 0.012 * (1 - suave(0.18, 0.32, celula(t * 14, Math.cos(a) * 9, Math.sin(a) * 9, s))),
    cor: (x, y, z) => {
      const furo = 1 - suave(0.15, 0.3, celula(x * 260, y * 260, z * 260, s + 1));
      let c = mix(B, C('#e8e2d0'), furo * 0.5);
      c = mix(c, C('#efe8d4'), suave(0.2, 0.7, fbm(x * 40, y * 40, z * 40, s)) * 0.3);
      return c;
    },
  }), 'umido', true)];
};

/** Crottin de cabra: cilindrinho de casca enrugada marfim com mofo cinza-azulado. */
const gCrottin: Gerador = (k) => {
  const { s } = k;
  const R = k.T / 2, H = R * 1.45;
  const B = C('#e4d8b8'), M = C('#9a9e98');
  const rugas = (x: number, y: number, z: number) => Math.abs(fbm(x * 110, y * 110, z * 110, s));
  return [parte(torno({
    caminho: [[0, 0], [R * 0.85, 0], [R * 0.98, H * 0.08], [R, H * 0.5], [R * 0.96, H * 0.9], [R * 0.82, H], [0, H * 1.01]],
    n: 34, m: 52,
    desloc: (p) => {
      const w = rugas(p.x, p.y, p.z);
      const d = 1 + 0.07 * (1 - w * 2.2);
      p.x *= d; p.z *= d;
      if (p.y > H * 0.9) p.y += R * 0.04 * (0.5 - w);
    },
    cor: (x, y, z) => {
      let c = mix(mul(B, 0.72), mul(B, 1.05), suave(0.05, 0.4, rugas(x, y, z)));
      c = mix(c, M, suave(0.1, 0.6, fbm(x * 60, y * 60, z * 60, s + 3)) * 0.55);
      return mix(c, C('#d8c8a0'), suave(0.5, 0.9, fbm(x * 30, y * 30, z * 30, s + 5)) * 0.3);
    },
  }), 'fosco', true)];
};

/** Estrela de queijo confeitada no bico pitanga (sólido de revolução estriado e torcido). */
function estrelaQueijo(R: number, H: number, s: number): THREE.BufferGeometry {
  const B = C('#f6f2e6'), E = C('#4e8a34');
  return torno({
    caminho: [[0, 0], [R, 0], [R * 0.95, H * 0.25], [R * 0.7, H * 0.55], [R * 0.35, H * 0.82], [R * 0.08, H], [0, H * 1.01]],
    n: 16, m: 32,
    mod: (t, a) => 1 + 0.22 * Math.cos(a * 8) * Math.sin(PI * Math.min(1, t * 1.2)),
    desloc: (p, t) => {
      const g = t * 1.1;
      const x = p.x, z = p.z;
      p.x = x * Math.cos(g) - z * Math.sin(g);
      p.z = x * Math.sin(g) + z * Math.cos(g);
    },
    cor: (x, y, z) => mix(mul(B, 1 + 0.04 * fbm(x * 400, y * 400, z * 400, s)), E, (1 - suave(0.08, 0.16, celula(x * 900, y * 900, z * 900, s + 7))) * 0.8),
  });
}

/** Meio tomate-cereja escavado com a estrela de queijo de cabra e cebolinha. */
const gTomateRecheado: Gerador = (k) => {
  const { s } = k;
  const R = k.T / 2, H = R * 0.85;
  const V1 = C('#d4261c'), POLPA = C('#e8604a');
  const out: Parte[] = [];
  // casca da metade: tigelinha com borda grossa (o miolo foi tirado)
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.6, H * 0.06], [R * 0.92, H * 0.4], [R, H * 0.85], [R * 0.95, H], [R * 0.8, H * 0.98], [R * 0.76, H * 0.6], [R * 0.4, H * 0.32], [0, H * 0.3]],
    n: 22, m: 30,
    cor: (x, y, z, t) => {
      if (t > 0.6) return mix(POLPA, C('#f08a6a'), suave(0.3, 0.8, fbm(x * 300, 0, z * 300, s)) * 0.5);
      return mul(mix(V1, C('#f04a30'), suave(0.6, 0.95, y / H) * 0.3), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s));
    },
  }), 'brilhante', true));
  out.push(parte(tf(estrelaQueijo(R * 0.8, R * 1.15, s), [0, H * 0.32, 0]), 'acetinado'));
  return out;
};

/** Pedaço de abobrinha escaldada escavado, com a estrela de queijo. */
const gAbobrinhaRecheada: Gerador = (k) => {
  const { s } = k;
  const R = k.T / 2, H = R * 1.1;
  const VE = C('#2e5a22'), POLPA = C('#e8eccc');
  const out: Parte[] = [];
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.95, 0], [R, H * 0.1], [R, H * 0.95], [R * 0.95, H], [R * 0.82, H], [R * 0.78, H * 0.9], [R * 0.4, H * 0.55], [0, H * 0.52]],
    n: 22, m: 32,
    cor: (x, y, z, t) => {
      if (t > 0.62) return mix(POLPA, C('#d8e0a8'), suave(0.3, 0.9, fbm(x * 260, y * 260, z * 260, s)) * 0.5);
      const a = Math.atan2(z, x);
      let c = mix(VE, C('#6a9a4a'), Math.abs(Math.sin(a * 6)) ** 6 * 0.5);
      c = mix(c, C('#b8d07a'), (1 - suave(0.1, 0.2, celula(x * 300, y * 300, z * 300, s))) * 0.5);
      if (y < H * 0.04 || y > H * 0.97) c = mix(POLPA, VE, 0.15);
      return c;
    },
  }), 'acetinado', true));
  out.push(parte(tf(estrelaQueijo(R * 0.72, R * 1.0, s + 1), [0, H * 0.55, 0]), 'acetinado'));
  return out;
};

/** Ervilha-torta escaldada aberta pela costura com um cordão de queijo confeitado. */
const gErvilhaRecheada: Gerador = (k) => {
  const { s } = k;
  const L = k.T, W = L * 0.24;
  const VE = C('#6aa83c');
  const out: Parte[] = [];
  const larg = (t: number) => Math.sin(PI * clamp(t)) ** 0.6;
  // vagem aberta: concha rasa
  out.push(parte(chapa(30, 10, (u, v, lado) => {
    const w = (W / 2) * larg(u) + 1e-4;
    const z = v * w;
    const y = W * 0.45 * (Math.abs(v) ** 1.6) * larg(u) + (lado ? 0.0007 : 0) + W * 0.12 * Math.sin(PI * u) ** 2 * 0;
    return [(u - 0.5) * L, y, z];
  }, (x, y, z, u, v, lado) => mul(mix(VE, C('#a8d07a'), lado ? 0.35 : 0), 1 + 0.06 * fbm(x * 200, y * 200, z * 200, s))), 'acetinado', true));
  // ervilhinhas no fundo
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + 0.15 * i;
    out.push(parte(tf(elipsoide(W * 0.13, W * 0.11, W * 0.13, tom(C('#88c050'), 0.06, 300, s), 5, 7), [(t - 0.5) * L, W * 0.06, 0]), 'acetinado'));
  }
  // cordão de queijo em estrelinhas encostadas
  const B = C('#f6f2e6');
  out.push(parte(corpo({
    x0: -L * 0.38, x1: L * 0.38, n: 40, m: 12,
    perfil: (t) => ({ ry: W * 0.3 * Math.sin(PI * t) ** 0.4, rz: W * 0.28 * Math.sin(PI * t) ** 0.4, cy: W * 0.32 }),
    mod: (t, a) => 1 + 0.25 * Math.abs(Math.sin(t * PI * 9)) ** 0.5 * 0.5 + 0.12 * Math.cos(a * 6 + t * 30),
    cor: (x, y, z) => mix(B, C('#4e8a34'), (1 - suave(0.08, 0.16, celula(x * 900, y * 900, z * 900, s + 7))) * 0.7),
  }), 'acetinado'));
  return out;
};

/** Crosta de creme coalhado levantada: placa grossa amarelada, enrugada, com creme branco embaixo. */
const gCrostaCreme: Gerador = (k) => {
  const { s } = k;
  const L = k.T, W = L * 0.7, H = L * 0.1;
  const A = C('#ecc860'), B = C('#fbf3d8');
  const borda = (u: number, v: number) => 1 - 0.12 * fbm(u * 3, v * 3, 0, s);
  return [parte(chapa(34, 26, (u, v, lado) => {
    const x = (u - 0.5) * L * borda(u, v);
    const z = v * (W / 2) * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 4)) * borda(v, u);
    const rug = 0.25 * Math.abs(fbm(x * 90, 0, z * 90, s));
    const y = lado ? H * (0.55 + rug) * (1 - Math.abs(v) ** 6) + H * 0.1 : H * 0.15 * fbm(x * 60, 1, z * 60, s + 2);
    return [x, y + H * 0.2 * Math.sin(PI * u) * 0, z];
  }, (x, y, z, u, v, lado) => {
    if (!lado) return mul(B, 1 + 0.04 * fbm(x * 200, 0, z * 200, s));
    let c = mix(A, C('#d8a440'), suave(0.1, 0.6, fbm(x * 70, 0, z * 70, s + 1)) * 0.5);
    c = mix(c, C('#f6e4a8'), suave(0.2, 0.0, Math.abs(fbm(x * 90, 0, z * 90, s))) * 0.4);
    return c;
  }), 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* Ervas e temperos                                                     */
/* ------------------------------------------------------------------ */

/** Fios de açafrão: estigmas vermelho-alaranjados, finos, com a ponta em trombeta. */
const gFiosAcafrao: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const V1 = C('#c8260c'), PONTA = C('#e85a14'), BASE = C('#e8b040');
  for (let i = 0; i < 22; i++) {
    const L = r.f(0.018, 0.028);
    const a = r.f(0, TAU), d = 0.008 * Math.sqrt(r.n());
    const p0 = V(Math.cos(a) * d, 0.0005 + r.f(0, 0.002), Math.sin(a) * d);
    const ang = r.f(0, TAU);
    const dir = V(Math.cos(ang), 0, Math.sin(ang));
    const lat = V(-dir.z, 0, dir.x);
    const cv = r.f(-0.25, 0.25);
    const pts = [0, 0.33, 0.66, 1].map((t) => p0.clone().addScaledVector(dir, L * t).addScaledVector(lat, L * cv * Math.sin(PI * t)).add(V(0, 0.0012 * Math.sin(PI * t * 1.3), 0)));
    out.push(parte(tubo(pts, {
      raio: (t) => 0.00035 + 0.0009 * suave(0.6, 1, t), m: 5, n: 10, achata: 0.7,
      cor: (x, y, z, t) => mul(mix(mix(BASE, V1, suave(0.0, 0.25, t)), PONTA, suave(0.8, 1, t) * 0.6), 1 + 0.1 * ruido(x * 2000, y * 2000, z * 2000, s)),
    }), 'acetinado', i === 0));
  }
  return out;
};

/** Grãos de zimbro: bagas de azul-arroxeado escuro com pruína clara e a estrelinha de três pontas. */
const gZimbro: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const A = C('#2e2a48'), P = C('#8a8aa8');
  const pos: [number, number, number][] = [[0, 0, 0], [0.0085, 0, 0.002], [-0.008, 0, 0.003], [0.002, 0, 0.0085], [-0.002, 0, -0.0085], [0.007, 0, -0.007], [0.004, 0.006, 0.0005]];
  pos.forEach(([x, y, z], i) => {
    const R = 0.0042 * r.f(0.9, 1.1);
    const ax = r.f(0, TAU), ay = r.f(0, TAU);
    // a estrela fica num polo da baga
    const g = elipsoide(R, R * 0.95, R, (px, py, pz, t) => {
      let c = mix(A, P, suave(0.1, 0.6, fbm(px * 900, py * 900, pz * 900, s + i)) * 0.55);
      c = mix(c, C('#4a3a5a'), suave(0.5, 0.9, fbm(px * 400, py * 400, pz * 400, s + 2)) * 0.4);
      const polo = suave(0.8, 0.95, t);
      const estrela = Math.abs(Math.cos(Math.atan2(pz, py) * 1.5)) ** 8 * polo;
      return mix(c, C('#1a1622'), estrela * 0.8);
    }, 8, 12);
    out.push(parte(tf(g, [x, R + y, z], [ax, ay, 0]), 'acetinado', i === 0));
  });
  return out;
};

/** Montinho de casca de limão picada bem fina: lasquinhas amarelas com o lado branco. */
const gCascaLimaoPicada: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const AM = C('#eec412'), BR = C('#f6f0d0');
  const R = k.T / 2, H = R * 0.75;
  // base do monte (as lascas de baixo, apertadas)
  out.push(parte(torno({
    caminho: domo(R * 0.6, H * 0.6),
    n: 10, m: 24,
    mod: (t, a) => 1 + 0.08 * fbm(t * 3, Math.cos(a) * 3, Math.sin(a) * 3, s),
    cor: (x, y, z) => {
      const c = celula(x * 900, y * 900, z * 900, s);
      return mix(mix(AM, mul(AM, 0.85), c), BR, suave(0.6, 0.8, fbm(x * 700, y * 700, z * 700, s + 1)) * 0.6);
    },
  }), 'acetinado', true));
  // lasquinhas soltas por cima e em volta
  for (let i = 0; i < 200; i++) {
    const a = r.f(0, TAU), d = R * 0.75 * Math.sqrt(r.n());
    const h = H * 0.75 * Math.max(0, 1 - (d / R) ** 2) + 0.0006;
    const e = r.f(0.0011, 0.0019);
    const lado = r.n() < 0.3;
    const g = elipsoide(e, e * 0.35, e * 0.7, () => (lado ? BR : mul(AM, r.f(0.9, 1.08))), 2, 4);
    out.push(parte(tf(g, [Math.cos(a) * d, h, Math.sin(a) * d], [r.f(-0.5, 0.5), r.f(0, TAU), r.f(-0.5, 0.5)]), 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Ossobuco                                                             */
/* ------------------------------------------------------------------ */

/** Rodela de ossobuco braseado: carne em gomos com nervos, osso redondo e o tutano no meio. */
const gOssobuco: Gerador = (k) => {
  const { s } = k;
  const R = k.T / 2, H = R * 0.62;
  const out: Parte[] = [];
  const MOLHO = C('#7a3a1e'), CARNE = C('#8e4a2e'), NERVO = C('#c8a070'), OSSO = C('#e8dcc0'), TUTANO = C('#c89a68');
  const contorno = (a: number) => 1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s);
  const ro = R * 0.22;
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.85, 0], [R * 0.98, H * 0.12], [R, H * 0.5], [R * 0.97, H * 0.88], [R * 0.85, H * 0.98], [R * 0.4, H], [0, H]],
    n: 22, m: 40,
    mod: (t, a) => contorno(a),
    desloc: (p, t) => { if (t > 0.75) p.y += H * 0.05 * fbm(p.x * 60, 0, p.z * 60, s); },
    cor: (x, y, z, t) => {
      const rr = Math.hypot(x, z) / R, a = Math.atan2(z, x);
      if (t < 0.75) return mul(mix(MOLHO, CARNE, suave(0.2, 0.7, fbm(x * 80, y * 80, z * 80, s)) * 0.6), 1 + 0.08 * ruido(x * 300, y * 300, z * 300, s));
      // face de cima: gomos de músculo separados por nervos claros, em volta do osso
      const gomo = Math.abs(Math.sin(a * 2.5 + rr * 3 + 1.5 * fbm(x * 30, 0, z * 30, s))) ** 18;
      let c = mix(mul(CARNE, 1.1), NERVO, gomo * 0.7);
      c = mix(c, MOLHO, suave(0.75, 0.98, rr) * 0.7);
      c = mix(c, mul(MOLHO, 0.9), suave(0.2, 0.7, fbm(x * 50, 0, z * 50, s + 3)) * 0.35);
      return mul(c, 1 + 0.06 * ruido(x * 400, 0, z * 400, s));
    },
  }), 'brilhante', true));
  // osso: anel um pouco acima da carne, com tutano dentro
  out.push(parte(torno({
    caminho: [[0, H * 0.7], [ro * 0.55, H * 0.72], [ro * 0.62, H * 1.06], [ro, H * 1.06], [ro * 1.05, H * 0.9], [ro * 1.08, H * 0.6], [0, H * 0.6]],
    n: 14, m: 24, l: 0.85,
    cor: (x, y, z) => {
      const rr = Math.hypot(x, z / 0.85) / ro;
      if (rr < 0.6 && y < H * 1.0) return mul(mix(TUTANO, C('#a87048'), suave(0.2, 0.8, fbm(x * 400, 0, z * 400, s)) * 0.5), 1);
      return mul(mix(OSSO, C('#c8b08a'), suave(0.3, 0.8, fbm(x * 300, y * 300, z * 300, s)) * 0.5), 1);
    },
  }), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Peixes inteiros transformados                                         */
/* ------------------------------------------------------------------ */

interface OpcBorb { id: string; v: Visual; cabeca: boolean; fCab: number; fCauda: number; carne: RGB; gordura: RGB; pele: RGB; dorso: RGB; salmao?: boolean }

/** Peixe aberto em borboleta e sem espinha: dois lombos abertos (carne para cima), cauda e cabeça. */
function borboleta(o: OpcBorb): Parte[] {
  const T = o.v.t, H = T * (o.v.a ?? 0.2);
  const xh = T / 2 - o.fCab * T, xt = -T / 2 + o.fCauda * T;
  const out = pedacos(peixe(o.id, o.v), (x) => (o.cabeca && x > xh) || x < xt);
  for (const p of out) p.corpo = false;
  const b = caixaDe(out.map((p) => p.g));
  const y0 = b.min.y;
  const x0 = xt - T * 0.012, x1 = xh + T * (o.cabeca ? 0.02 : 0);
  const Lb = x1 - x0;
  const w = (u: number) => H * (0.3 + 0.62 * suave(0, 0.55, u)) * (o.cabeca ? 1 - 0.25 * suave(0.85, 1, u) : 1 - 0.12 * suave(0.92, 1, u));
  const esp = H * 0.2;
  const s = semente(o.id);
  const passo = T * 0.04;
  const sangue = C('#8a3a30');
  const g = chapa(52, 18, (u, v, lado) => {
    const x = x0 + u * Lb;
    const z = v * w(u);
    const vv = Math.abs(v);
    const e = esp * Math.sqrt(Math.max(0, 1 - vv ** 2.4)) * (0.45 + 0.55 * suave(0, 0.3, u)) + 0.0004;
    let y = y0 + 0.0003 + esp * 0.3 * vv ** 3;
    if (lado) y += e * (1 - 0.3 * (1 - suave(0.02, 0.1, vv)));
    return [x, y, z];
  }, (x, y, z, u, v, lado) => {
    const vv = Math.abs(v);
    if (!lado) return mul(mix(o.pele, o.dorso, (1 - vv) * 0.8), 1 + 0.06 * fbm(x * 200, 0, z * 200, s));
    let c: RGB;
    if (o.salmao) c = corSalmao(o.carne, o.gordura, passo, s, 0.9)(x, y, z, u, v);
    else {
      const q = (x + 0.8 * Math.abs(z)) / passo + 0.3 * fbm(x * 30, 0, z * 30, s);
      c = mix(o.carne, o.gordura, Math.abs(Math.sin(q * PI)) ** 10 * 0.55);
    }
    c = mix(c, sangue, (1 - suave(0.015, 0.06, vv)) * 0.55);
    c = mix(c, mix(o.pele, o.dorso, 0.4), suave(0.9, 0.99, vv));
    return mul(c, 1 + 0.05 * fbm(x * 150, y * 150, z * 150, s + 1));
  });
  out.push(parte(g, 'umido', true));
  return out;
}

const gSardinhaBorboleta: Gerador = () => borboleta({ id: 'sardinha', v: SARDINHA, cabeca: false, fCab: 0.2, fCauda: 0.19, carne: C('#b8705e'), gordura: C('#d8a898'), pele: C('#d8dfe6'), dorso: C('#2e4f7a') });
const gSalmaoBorboleta: Gerador = () => borboleta({ id: 'salmao', v: SALMAO, cabeca: true, fCab: 0.21, fCauda: 0.18, carne: C('#f08a5d'), gordura: C('#fbe4d4'), pele: C('#d9dde0'), dorso: C('#4a5a6a'), salmao: true });
const gTrutaBorboleta: Gerador = () => borboleta({ id: 'truta', v: TRUTA, cabeca: true, fCab: 0.22, fCauda: 0.17, carne: C('#f2a07c'), gordura: C('#f8d4c0'), pele: C('#e0d9c8'), dorso: C('#6f7a5a') });

/** Cabeça e carcaça do salmão depois de tirar os dois filés: cabeça, espinha com costelas e rabo. */
const gCabecaCarcacaSalmao: Gerador = () => {
  const T = SALMAO.t, xh = T / 2 - 0.22 * T, xt = -T / 2 + 0.19 * T;
  const out = pedacos(peixe('salmao', SALMAO), (x) => x > xh || x < xt);
  const corpos = out.filter((p) => p.corpo).map((p) => p.g);
  const b = caixaDe(out.map((p) => p.g));
  const sh = secaoX(corpos, xh, xh + 0.006), st = secaoX(corpos, xt - 0.006, xt);
  const LAR = C('#f08a5d'), PELE = C('#c8ccd0');
  out.push(parte(tampa(xh, sh, corCorte(sh, LAR, PELE)), 'umido'));
  out.push(parte(tampa(xt, st, corCorte(st, LAR, PELE)), 'umido'));
  const r = T * 0.006, y = b.min.y + r * 1.1;
  const cOsso: CorFn = (x, yy, z) => mix(C('#f2ece0'), LAR, suave(0.3, 0.8, fbm(x * 90, yy * 90, z * 90, 7)) * 0.65);
  for (const g of espinha(xt - 0.002, xh + 0.002, y, r, 22, T * 0.075, cOsso)) out.push(parte(g, 'acetinado', true));
  // restos de carne laranja grudados na espinha
  const rng = new (class { s = 11; n() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; } })();
  for (let i = 0; i < 9; i++) {
    const x = lerp(xt, xh, (i + 0.5) / 9);
    out.push(parte(tf(elipsoide(T * 0.02, r * 0.9, T * 0.008, tom(LAR, 0.08, 120, i), 5, 8), [x, y + r * 0.2, (rng.n() - 0.5) * T * 0.03]), 'umido'));
  }
  return out;
};

/** Salmão pochê pelado dos dois lados: cabeça e rabo com pele, carne rosada com a emenda dos filés. */
const gSalmaoPelado: Gerador = () => {
  const T = SALMAO.t, xh = T / 2 - 0.2 * T, xt = -T / 2 + 0.2 * T;
  const ps = peixe('salmao', SALMAO);
  // nadadeiras do meio saem com a pele
  const out = ps.map((p) => (p.corpo || p.ac === 'umido' ? p : null)).filter(Boolean) as Parte[];
  for (const p of ps) if (!p.corpo && p.ac !== 'umido') {
    const g = cortar(p.g, (x) => x > xh + 0.01 || x < xt - 0.005);
    if (g) out.push(parte(g, p.ac));
  }
  const ROSA = C('#f2a08a'), GORD = C('#fbe8de'), ESC = C('#c08070');
  const corp = out.filter((p) => p.corpo).map((p) => p.g);
  const b = caixaDe(corp);
  const cz = (b.min.z + b.max.z) / 2;
  const cs = corSalmao(ROSA, GORD, T * 0.045, 5, 0.9);
  for (const g of corp) recolorir(g, (x, y, z, c) => {
    const borda = 0.006 * fbm(y * 120, z * 120, 0, 4);
    const k = suave(xt - 0.004, xt + 0.004, x + borda) * (1 - suave(xh - 0.004, xh + 0.004, x + borda));
    let f = cs(x, y, z, 0, 0);
    f = mix(f, mul(ROSA, 0.88), (1 - suave(0.002, 0.005, Math.abs(z - cz - 0.004))) * 0.7); // emenda dos filés
    f = mix(f, ESC, suave(0.85, 1, Math.abs(z - cz) / ((b.max.z - b.min.z) / 2)) * 0.4);
    // cabeça e rabo cozidos: pele um pouco mais opaca
    const cc = mix(c, C('#a8a8a0'), 0.18);
    return mix(cc, f, k);
  });
  // olho cozido fica branco-acinzentado
  for (const p of out) if (!p.corpo && p.ac === 'umido') recolorir(p.g, (x, y, z, c) => mix(c, C('#e6e2d8'), 0.75));
  return out;
};

/** Linguado inteiro sem pele dos dois lados: carne branco-rosada com a linha do meio e os miótomos. */
const LINGUADO: Visual = { f: 'peixe_chato', v: 'oval', t: 0.35, a: 0.05, l: 0.45, c1: '#7a5e40', c2: '#5a4430', ci: '#f6f2ec', cc: '#fbf8f2', c3: '#f2efe8', d: 'pintas' };
const gLinguadoPelado: Gerador = () => {
  const ps = gPeixeChato(ctxDe('linguado', LINGUADO, 0.06, 0.5, 'umido'));
  const CARNE = C('#f4e6e0'), LINHA = C('#e2c4bc'), NAD = C('#e0d0bc');
  for (const p of ps) {
    if (p.corpo) {
      recolorir(p.g, (x, y, z) => {
        const q = (x + 1.4 * Math.abs(z)) / 0.012 + 0.4 * fbm(x * 40, 0, z * 40, 3);
        let c = mix(CARNE, LINHA, Math.abs(Math.sin(q * PI)) ** 12 * 0.5);
        c = mix(c, mul(LINHA, 0.9), (1 - suave(0.0015, 0.005, Math.abs(z))) * 0.6);
        return mul(c, 1 + 0.04 * fbm(x * 200, y * 200, z * 200, 1));
      });
      p.ac = 'acetinado';
    } else if (p.ac !== 'umido') recolorir(p.g, (x, y, z, c) => mix(c, NAD, 0.7));
  }
  return ps;
};

/** Rodovalho inteiro opaco (pele fosca, sem o brilho de vidro do acabamento úmido). */
const RODOVALHO: Visual = { f: 'peixe_chato', v: 'oval', t: 0.5, a: 0.07, l: 0.85, c1: '#7a6a50', c2: '#5a4c38', ci: '#f6f2ec', cc: '#fbf8f2', c3: '#f2efe6', d: 'tuberculos redondo' };
const gRodovalho: Gerador = () => {
  const ps = gPeixeChato(ctxDe('rodovalho', RODOVALHO, 0.06, 0.5, 'umido'));
  for (const p of ps) if (p.corpo) p.ac = 'acetinado';
  return ps;
};

/** Peixe embrulhado em pano úmido para a geladeira: trouxa de pano com o rabo de fora. */
const gPeixeNoPano: Gerador = (k) => {
  const { s } = k;
  const T = TRUTA.t, xt = -T / 2 + 0.17 * T;
  const out = pedacos(peixe('truta', TRUTA), (x) => x < xt);
  for (const p of out) p.corpo = false;
  const b = caixaDe(out.map((p) => p.g));
  const H = T * 0.2, Wm = T * 0.1;
  const PANO = C('#e4e2da');
  const cy = (b.min.y + b.max.y) / 2;
  out.push(parte(corpo({
    x0: xt - T * 0.03, x1: T / 2 + T * 0.03, n: 40, m: 26,
    perfil: (t) => {
      const f = Math.sin(PI * clamp(0.04 + 0.92 * t)) ** 0.45;
      return { ry: (Wm / 2) * 1.5 * f + 0.002, rz: (H / 2) * 1.2 * f + 0.002, cy };
    },
    mod: (t, a) => 1 + 0.07 * Math.sin(a * 3 + t * 22) * Math.sin(PI * t) + 0.05 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s),
    desloc: (p) => { if (p.y < b.min.y + 0.0005) p.y = b.min.y + 0.0005 + (p.y - b.min.y) * 0.1; },
    cor: (x, y, z) => {
      const trama = Math.abs(Math.sin(x * 1400)) * Math.abs(Math.sin(z * 1400));
      let c = mul(PANO, 1 - 0.07 * trama);
      c = mix(c, C('#b8bcc0'), suave(0.0, 0.6, fbm(x * 30, y * 30, z * 30, s)) * 0.45);
      return c;
    },
  }), 'acetinado', true));
  return out;
};

/* ------------------------------------------------------------------ */
/* Filés                                                                */
/* ------------------------------------------------------------------ */

const FILE = (t: number, l: number, c1: string, c2: string, c3: string, cc: string, a = 0.06): Visual => ({ f: 'file_peixe', v: 'lado', t, a, l, c1, c2, ci: c1, cc, c3, ac: 'brilhante' });
const FILE_SALMAO = FILE(0.3, 0.3, '#f08a5d', '#b8b8b8', '#fbe6d8', '#f4c4a3', 0.075);
const FILE_TAINHA: Visual = FILE(0.2, 0.3, '#ecd6cc', '#8a8f94', '#f8ece6', '#f6ece2');

/** Raminho de endro: talo fino com fios. */
function raminhoEndro(p: THREE.Vector3, L: number, ang: number, s: number): THREE.BufferGeometry[] {
  const VE = C('#4e7e3a');
  const cf: CorFn = (x, y, z) => mul(VE, 1 + 0.15 * ruido(x * 900, y * 900, z * 900, s));
  const d = V(Math.cos(ang), 0, Math.sin(ang));
  const n = V(-d.z, 0, d.x);
  const out: THREE.BufferGeometry[] = [tubo([p, p.clone().addScaledVector(d, L * 0.5).add(V(0, 0.0008, 0)), p.clone().addScaledVector(d, L)], { raio: 0.00045, m: 3, n: 5, cor: cf })];
  for (let i = 1; i <= 3; i++) {
    const q = p.clone().addScaledVector(d, (L * i) / 4);
    for (const sg of [-1, 1]) out.push(tubo([q, q.clone().addScaledVector(d, L * 0.15).addScaledVector(n, sg * L * 0.22).add(V(0, 0.0006, 0))], { raio: 0.0003, m: 3, n: 3, cor: cf }));
  }
  return out;
}

/** Filé de salmão temperado com sal, açúcar e pimenta e coberto de endro picado. */
const gFileSalmaoEndro: Gerador = (k) => {
  const { s } = k;
  const out = gFilePeixe(ctxDe('c1-file-salmao-endro', FILE_SALMAO, 0.08, 0.3, 'brilhante')).map((p) => parte(cortar(p.g, (_x, y) => y > 0.0004) ?? p.g, p.ac, p.corpo));
  const pts = topo(out[0].g);
  for (const p of out) if (p.corpo) recolorir(p.g, (x, y, z, c) => {
    // cura: cristais claros e pimenta moída
    const cri = 1 - suave(0.1, 0.22, celula(x * 600, y * 600, z * 600, s));
    const pim = 1 - suave(0.06, 0.12, celula(x * 500, y * 500, z * 500, s + 3));
    return mix(mix(c, C('#f6eee6'), cri * 0.6 * (y > 0.004 ? 1 : 0)), C('#2a2420'), pim * 0.8 * (y > 0.004 ? 1 : 0));
  });
  const r = k.r;
  for (let i = 0; i < 12 && pts.length; i++) {
    const p = pts[Math.floor(r.n() * pts.length)];
    for (const g of raminhoEndro(p.clone().add(V(0, 0.0005, 0)), r.f(0.018, 0.03), r.f(0, TAU), s + i)) out.push(parte(g, 'acetinado'));
  }
  return out;
};

/** Dois filés de gravadlax empilhados (carne com carne) com o endro aparecendo entre eles. */
const gFilesEmpilhados: Gerador = (k) => {
  const { s } = k;
  const vis = FILE_SALMAO;
  const H = vis.t * (vis.a ?? 0.06);
  const cima = gFilePeixe(ctxDe('c1-files-salmao-b', { ...vis, c2: '#9aa4ae' }, 0.08, 0.3, 'brilhante'));
  const out: Parte[] = [];
  // filé de baixo: só a carne das bordas aparece, então basta um bloco leve com o contorno do filé
  const L = vis.t, Wf = L * vis.l!;
  const larg = (t: number) => Math.sqrt(suave(0, 0.12, t)) * lerp(0.35, 1, Math.sqrt(t)) * Math.sqrt(suave(1, 0.9, t));
  const espB = (t: number) => lerp(0.25, 1, t ** 0.6) * Math.sqrt(suave(0, 0.08, t)) * Math.sqrt(suave(1, 0.9, t));
  const cs = corSalmao(C('#f08a5d'), C('#fbe6d8'), L * 0.05, s, 1.2);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 16, exp: 2.6,
    perfil: (t) => { const ry = (H / 2) * Math.max(0.05, espB(t)); return { ry, rz: (Wf / 2) * Math.max(0.02, larg(t)), cy: ry }; },
    desloc: (p) => { if (p.y < 0) p.y = 0; },
    cor: (x, y, z, t, a) => (Math.cos(a) < -0.2 || y < H * 0.06 ? mix(C('#b8b8b8'), C('#6a7078'), suave(-0.6, 0.6, z / (Wf / 2))) : cs(x, y, z, t, a)),
  }), 'brilhante'));
  const bb = caixaDe([out[0].g]);
  // de cima: virado, pele prateada para cima; a carne de baixo fica escondida
  for (const p of cima) {
    const g = cortar(p.g, (_x, y) => y < H * 0.4);
    if (!g) continue;
    g.rotateX(PI);
    g.translate(0, bb.max.y + 0.003, 0);
    recolorir(g, (x, y, z, c) => c);
    out.push(parte(g, p.ac, true));
  }
  // endro saindo pelas bordas
  const r = k.r;
  for (let i = 0; i < 8; i++) {
    const t = r.f(-0.4, 0.4) * vis.t;
    const sg = r.n() < 0.5 ? -1 : 1;
    const w = vis.t * vis.l! * 0.42 * Math.sin(PI * (0.5 + t / vis.t)) ** 0.6;
    for (const g of raminhoEndro(V(t, bb.max.y + 0.001, sg * w * 0.7), r.f(0.015, 0.024), sg > 0 ? r.f(1.0, 2.1) : r.f(-2.1, -1.0), s + i)) out.push(parte(g, 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Enfeites de peixe                                                    */
/* ------------------------------------------------------------------ */

/** Laço de anchova: o filé fino enrolado em duas alças com a tirinha de pimentão no nó. */
const gLacoAnchova: Gerador = (k) => {
  const { s } = k;
  const A = C('#7a3a2e'), PR = C('#c8c4c0'), PIM = C('#d01a12');
  const R = k.T * 0.26;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * TAU;
    // lemniscata: duas alças
    const d = 1 + Math.sin(t) ** 2;
    pts.push(V((R * 1.7 * Math.cos(t)) / d, R * 0.35 + R * 0.25 * Math.sin(2 * t) * 0.5, (R * 1.2 * Math.sin(t) * Math.cos(t)) / d));
  }
  const out: Parte[] = [];
  out.push(parte(tubo(pts, {
    raio: R * 0.16, achata: 0.32, m: 10, n: 96, fechado: true, cima: V(0, 0, 1),
    cor: (x, y, z, t, a) => {
      const borda = Math.abs(Math.sin(a));
      let c = mix(A, mul(A, 1.35), suave(0.3, 0.8, fbm(x * 300, y * 300, z * 300, s)) * 0.4);
      c = mix(c, PR, suave(0.85, 1, Math.cos(a)) * 0.35);
      return mix(c, mul(A, 0.7), borda ** 6 * 0.3);
    },
  }), 'brilhante', true));
  // nó: tirinha de pimentão cruzando o meio
  out.push(parte(tubo([V(0, R * 0.2, -R * 0.45), V(0, R * 0.62, 0), V(0, R * 0.2, R * 0.45)], {
    raio: R * 0.13, achata: 0.35, m: 8, n: 16, cima: V(1, 0, 0),
    cor: (x, y, z) => mul(PIM, 1 + 0.08 * fbm(x * 400, y * 400, z * 400, s)),
  }), 'brilhante'));
  return out;
};

/** Quarto de rodela cítrica (setor fino) com polpa em gomos, pele branca e casca. */
function quartoRodela(R: number, e: number, polpa: RGB, casca: RGB, s: number, a0: number, a1: number): THREE.BufferGeometry {
  return chapa(14, 10, (u, v, lado) => {
    const a = lerp(a0, a1, u), r = R * (v + 1) / 2;
    return [r * Math.cos(a), lado ? e : 0, r * Math.sin(a)];
  }, (x, y, z, u, v, lado) => {
    const rr = (v + 1) / 2;
    const a = lerp(a0, a1, u);
    if (rr > 0.93) return casca;
    if (rr > 0.85) return C('#f2f2e0');
    const memb = Math.abs(Math.sin(((a - a0) / (a1 - a0)) * PI * 2.5)) ** 0.0001 * 0 + (1 - suave(0.0, 0.08, Math.abs(Math.sin(a * 5.5))));
    let c = mix(polpa, mul(polpa, 1.25), suave(0.3, 0.7, fbm(x * 600, 0, z * 600, s)) * 0.5);
    c = mix(c, C('#f0f4dc'), memb * 0.7);
    return mix(c, C('#f0f4dc'), 1 - suave(0.05, 0.12, rr));
  });
}

/** Borboleta de lima: dois quartos de rodela de costas (as asas) e a estrelinha de pimentão no meio. */
const gBorboletaLima: Gerador = (k) => {
  const { s } = k;
  const R = k.T * 0.48, e = 0.003;
  const P = C('#9ac83a'), K = C('#4a8a1e');
  const out: Parte[] = [];
  // cada quarto com o ângulo reto para fora e a casca encostada no meio
  for (const sg of [-1, 1]) {
    const g = quartoRodela(R, e, P, K, s, -PI / 4, PI / 4);
    // leva o arco para o centro: espelha e afasta
    g.translate(-R, 0, 0);
    if (sg < 0) g.rotateY(PI);
    g.translate(sg * R * 0.08, 0, 0);
    recolorir(g, (x, y, z, c) => c);
    out.push(parte(g, 'brilhante', sg > 0));
  }
  // estrela de pimentão
  const PIM = C('#d81a10');
  out.push(parte(torno({
    caminho: [[0, e], [R * 0.2, e], [R * 0.2, e + 0.002], [0, e + 0.002]], n: 6, m: 20,
    mod: (t, a) => 0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)) ** 3,
    cor: (x, y, z) => mul(PIM, 1 + 0.06 * fbm(x * 500, y * 500, z * 500, s)),
  }), 'brilhante'));
  return out;
};

/** Limão com a casca cortada em tiras presas na ponta e trançadas por cima. */
const gLimaoTrancado: Gerador = (k) => {
  const { s } = k;
  const L = k.T, R = L * 0.37;
  const AM = C('#ecd62a'), BR = C('#f6f0c8');
  const out: Parte[] = [];
  // limão deitado sem as pontas, com uma faixa de casca tirada em cima (aparece o branco)
  out.push(parte(corpo({
    x0: -L * 0.44, x1: L * 0.44, n: 26, m: 30, tampa: true,
    perfil: (t) => { const f = Math.sin(PI * (0.12 + 0.76 * t)) ** 0.55; return { ry: R * f, rz: R * 0.95 * f, cy: R }; },
    cor: (x, y, z, t, a) => {
      if (y > R * 1.55 && Math.abs(z) < R * 0.42) return mul(BR, 1 + 0.04 * fbm(x * 300, y * 300, z * 300, s));
      return mul(AM, 1 + 0.08 * fbm(x * 200, y * 200, z * 200, s) - 0.06 * (1 - suave(0.1, 0.2, celula(x * 500, y * 500, z * 500, s))));
    },
    corTampa: (x, y, z) => {
      const rr = Math.hypot(y - R, z) / R;
      if (rr > 0.85) return AM;
      return mix(C('#f2ea9a'), BR, (1 - suave(0, 0.08, Math.abs(Math.sin(Math.atan2(z, y - R) * 5)))) * 0.6);
    },
  }), 'acetinado', true));
  // três tiras saindo da ponta direita e trançadas para a esquerda por cima do limão
  for (let j = 0; j < 3; j++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = L * 0.42 - t * L * 0.85;
      const ph = t * PI * 3 + (j * TAU) / 3;
      const env = Math.sin(PI * (0.08 + 0.84 * (1 - Math.abs(x) / (L * 0.5)) * 0.5 + 0.42)) ;
      const yTopo = R + Math.sqrt(Math.max(0, (R * Math.sin(PI * (0.12 + 0.76 * (x / (L * 0.88) + 0.5))) ** 0.55) ** 2)) ;
      pts.push(V(x, yTopo + 0.0015 + 0.0016 * (1 + Math.cos(ph)) * suave(0, 0.15, t), Math.sin(ph) * R * 0.3 * suave(0, 0.2, t) * env));
    }
    out.push(parte(tubo(pts, {
      raio: R * 0.11, achata: 0.22, m: 8, n: 40, cima: V(0, 1, 0),
      cor: (x, y, z, t, a) => (Math.cos(a) > 0 ? mul(AM, 1 + 0.06 * fbm(x * 300, y * 300, z * 300, s + j)) : BR),
    }), 'acetinado'));
  }
  return out;
};

/** Fatia fina com borda canelada, cortada até o centro e torcida em S (limão alado e pepino). */
function fatiaTorcida(k: Ctx, cores: { casca: RGB; branco: RGB; polpa: RGB; sem?: RGB }, gomos: number, torcao: number): Parte[] {
  const { s } = k;
  const R = k.T / 2, e = 0.0025;
  const g = chapa(36, 16, (u, v, lado) => {
    const a = (u - 0.5) * TAU * 0.995, r = R * (v + 1) / 2;
    const sulco = 1 - 0.06 * Math.abs(Math.sin(a * 10)) ** 0.5 * suave(0.85, 1, (v + 1) / 2);
    let x = r * Math.cos(a) * sulco, z = r * Math.sin(a) * sulco;
    let y = lado ? e : 0;
    // torção: cada metade gira em volta do eixo X para um lado; o corte fica em a = ±PI
    const th = torcao * Math.tanh(x / (R * 0.45));
    const y2 = y * Math.cos(th) - z * Math.sin(th);
    z = y * Math.sin(th) + z * Math.cos(th);
    y = y2;
    return [x, y, z];
  }, (x, y, z, u, v) => {
    const rr = (v + 1) / 2, a = (u - 0.5) * TAU;
    if (rr > 0.93) return mix(cores.casca, cores.branco, Math.abs(Math.sin(a * 10)) ** 8 * 0.8);
    if (rr > 0.86) return cores.branco;
    let c = mix(cores.polpa, mul(cores.polpa, 1.15), suave(0.3, 0.7, fbm(x * 500, y * 500, z * 500, s)) * 0.5);
    if (gomos) c = mix(c, cores.branco, (1 - suave(0.0, 0.07, Math.abs(Math.sin(a * gomos / 2)))) * 0.7);
    if (cores.sem) c = mix(c, cores.sem, (1 - suave(0.12, 0.2, celula(Math.cos(a * 6) * 2 + rr * 3, Math.sin(a * 6) * 2, 0, s))) * suave(0.25, 0.4, rr) * (1 - suave(0.55, 0.65, rr)));
    return mix(c, cores.branco, (1 - suave(0.03, 0.09, rr)) * 0.8);
  });
  return [parte(g, 'brilhante', true)];
}

const gLimaoAlado: Gerador = (k) => fatiaTorcida(k, { casca: C('#ecd62a'), branco: C('#f6f2d8'), polpa: C('#f2e870') }, 10, 0.55);
const gPepinoTorcido: Gerador = (k) => fatiaTorcida(k, { casca: C('#28561f'), branco: C('#c8dca0'), polpa: C('#dfe9c0'), sem: C('#f2f4e4') }, 0, 0.6);

/** Fatia de gengibre em conserva: lâmina oval fina, rosada e translúcida, com as fibras. */
function laminaGengibre(L: number, W: number, s: number, curva = 0): THREE.BufferGeometry {
  const R1 = C('#f2a4a0'), R2 = C('#fad2c8');
  return chapa(16, 10, (u, v, lado) => {
    const w = (W / 2) * Math.sin(PI * clamp(u)) ** 0.5 * (1 + 0.08 * fbm(u * 4, 0, 0, s));
    const x = (u - 0.5) * L, z = v * w;
    const y = (lado ? 0.0006 : 0) + curva * (z * z) / Math.max(1e-4, W) + 0.0015 * Math.sin(u * PI * 3 + s) * 0.5;
    return [x, y, z];
  }, (x, y, z, u, v) => {
    const fibra = Math.abs(Math.sin(x * 900 + 2 * fbm(x * 80, 0, z * 80, s))) ** 4;
    return mix(mix(R1, R2, suave(0.5, 1, Math.abs(v)) * 0.6 + 0.2 * fbm(x * 100, 0, z * 100, s)), C('#e88a88'), fibra * 0.25);
  });
}

const gFatiaGengibre: Gerador = (k) => {
  const out: Parte[] = [];
  for (let i = 0; i < 4; i++) out.push(parte(tf(laminaGengibre(k.T, k.T * 0.62, k.s + i, 0.05), [i * 0.004, 0.0008 * i, i * 0.006], [0, i * 0.25, 0]), 'umido', i === 0));
  return out;
};

/** Rosa de gengibre: uma fatia enrolada no miolo e três pétalas em volta, abertas na borda. */
const gRosaGengibre: Gerador = (k) => {
  const { s } = k;
  const R1 = C('#f2a4a0'), R2 = C('#fbd8d0');
  const H = k.T * 0.75;
  const out: Parte[] = [];
  const petala = (r0: number, a0: number, a1: number, abre: number, hh: number, si: number) => chapa(18, 10, (u, v, lado) => {
    const a = lerp(a0, a1, u);
    const t = (v + 1) / 2;
    const r = r0 * (1 + abre * t ** 2) + (lado ? 0.0006 : 0);
    const h = hh * t * (1 - 0.15 * Math.abs(2 * u - 1) ** 2);
    return [r * Math.cos(a), h, r * Math.sin(a)];
  }, (x, y, z, u, v) => mix(mix(R1, R2, suave(0.3, 1, (v + 1) / 2) * 0.7), C('#e88a88'), Math.abs(Math.sin(y * 1200 + 2 * fbm(x * 90, y * 90, z * 90, s + si))) ** 4 * 0.2));
  // miolo enrolado em espiral
  out.push(parte(chapa(30, 8, (u, v, lado) => {
    const th = u * TAU * 1.6;
    const r = k.T * 0.04 + (k.T * 0.05 * th) / TAU + (lado ? 0.0006 : 0);
    const t = (v + 1) / 2;
    return [r * Math.cos(th), H * 0.85 * t, r * Math.sin(th)];
  }, (x, y, z, u, v) => mix(R1, R2, ((v + 1) / 2) * 0.6)), 'umido', true));
  for (let i = 0; i < 3; i++) {
    const a0 = (i * TAU) / 3;
    out.push(parte(petala(k.T * 0.16 + i * 0.002, a0, a0 + TAU * 0.45, 0.55, H * (0.95 - i * 0.04), i), 'umido'));
  }
  return out;
};

/** Cebolinha em cachos: tiras finas que enrolaram na água gelada. */
const gCebolinhaCachos: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const VE = C('#5a9a3a'), CL = C('#a8d080');
  for (let i = 0; i < 14; i++) {
    const L = r.f(0.03, 0.05), R = r.f(0.003, 0.006), voltas = r.f(1.2, 2.2);
    const a0 = r.f(0, TAU), x0 = r.f(-0.015, 0.015), z0 = r.f(-0.012, 0.012);
    const dir = r.f(0, TAU);
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      const th = a0 + t * voltas * TAU;
      const ax = (t - 0.5) * L;
      const rr = R * (0.6 + 0.8 * t);
      const lx = ax, ly = R * 1.2 + rr * Math.sin(th), lz = rr * Math.cos(th);
      pts.push(V(x0 + lx * Math.cos(dir) - lz * Math.sin(dir), ly + 0.0005, z0 + lx * Math.sin(dir) + lz * Math.cos(dir)));
    }
    out.push(parte(tubo(pts, {
      raio: 0.0011, achata: 0.3, m: 5, n: 34,
      cor: (x, y, z, t, a) => mix(mul(VE, 1 + 0.08 * fbm(x * 400, y * 400, z * 400, s)), CL, Math.cos(a) < 0 ? 0.5 : 0),
    }), 'acetinado', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Truta recheada, papel-alumínio e papel-manteiga                       */
/* ------------------------------------------------------------------ */

/** Truta assada de pé com as costas abertas mostrando o recheio de cogumelo. */
const gTrutaRecheadaDorso: Gerador = (k) => {
  const { s } = k;
  const T = TRUTA.t;
  const ps = peixe('truta', TRUTA);
  const xa = -T / 2 + 0.3 * T, xb = T / 2 - 0.25 * T;
  const out: Parte[] = [];
  for (const p of ps) {
    p.g.rotateX(-PI / 2); // de pé: dorso para cima
    if (!p.corpo && p.ac !== 'umido') {
      const g = cortar(p.g, (x, y) => !(x > xa - 0.01 && x < xb + 0.01 && y > 0));
      if (g) out.push(parte(g, p.ac));
    } else out.push(p);
  }
  const corp = out.filter((p) => p.corpo).map((p) => p.g);
  const b = caixaDe(corp);
  const CARNE = C('#f2e6dc');
  for (const g of corp) recolorir(g, (x, y, z, c) => {
    let f = mix(c, C('#8a7a5a'), 0.25); // pele assada
    const dentro = suave(xa, xa + 0.015, x) * (1 - suave(xb - 0.015, xb, x));
    const lab = (1 - suave(0.004, 0.01, Math.abs(z))) * suave(b.max.y * 0.7, b.max.y * 0.92, y);
    return mix(f, CARNE, lab * dentro);
  });
  // recheio em cordão ao longo das costas abertas
  out.push(parte(corpo({
    x0: xa, x1: xb, n: 30, m: 16,
    perfil: (t) => ({ ry: T * 0.022 * Math.sin(PI * t) ** 0.5 + 0.001, rz: T * 0.02 * Math.sin(PI * t) ** 0.5 + 0.001, cy: b.max.y * 0.88 }),
    mod: (t, a) => 1 + 0.15 * fbm(t * 9, Math.cos(a) * 2, Math.sin(a) * 2, s),
    cor: (x, y, z) => {
      let c = mix(C('#5a4430'), C('#8a6a48'), suave(0.1, 0.7, fbm(x * 400, y * 400, z * 400, s)) * 0.7);
      return mix(c, C('#4e7a2c'), (1 - suave(0.08, 0.15, celula(x * 700, y * 700, z * 700, s + 1))) * 0.7);
    },
  }), 'acetinado'));
  return out;
};

/** Truta embrulhada em papel-alumínio: pacote amassado com a dobra fechada por cima. */
const gTrutaAluminio: Gerador = (k) => {
  const { s } = k;
  const L = k.T, W = L * 0.32, H = L * 0.14;
  const AL = C('#a4a9ae');
  const amassa = (x: number, y: number, z: number) => fbm(x * 70, y * 70, z * 70, s);
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 44, m: 28, exp: 2.4,
    perfil: (t) => {
      const f = Math.sin(PI * clamp(0.03 + 0.94 * t)) ** 0.5;
      return { ry: (H / 2) * f + 0.001, rz: (W / 2) * f + 0.001, cy: H / 2 };
    },
    desloc: (p, t, a) => {
      if (p.y < 0) p.y *= 0.15;
      // vinco da dobra fechada por cima, em pregas
      const topoK = suave(0.75, 1, Math.cos(a));
      p.y += H * 0.35 * topoK * Math.sin(PI * t) ** 0.4 * (1 + 0.15 * Math.sin(t * 60));
      p.z *= 1 - 0.85 * topoK;
      const d = amassa(p.x, p.y, p.z) * H * 0.06;
      p.y += d; p.z += d * 0.5;
    },
    cor: (x, y, z) => {
      const v = amassa(x, y, z);
      const vinco = Math.abs(fbm(x * 160, y * 160, z * 160, s + 2));
      return mul(AL, 0.82 + 0.3 * v + 0.25 * suave(0.05, 0.0, vinco) - 0.1 * suave(0.3, 0.6, vinco));
    },
  }), 'brilhante', true)];
};

/** Pacote de alumínio aberto na mesa: bandeja amassada com a truta assada recheada dentro. */
const gPacoteAberto: Gerador = (k) => {
  const { s } = k;
  const T = TRUTA.t;
  const out: Parte[] = [];
  const ps = peixe('truta', TRUTA);
  const b = caixaDe(ps.map((p) => p.g));
  for (const p of ps) {
    p.corpo = false;
    if (p.ac !== 'umido') recolorir(p.g, (x, y, z, c) => mix(c, C('#8a7a5a'), 0.3));
    else recolorir(p.g, (x, y, z, c) => mix(c, C('#e6e2d8'), 0.75));
    p.g.translate(0, -b.min.y + 0.004, 0);
    out.push(p);
  }
  // ervas do recheio aparecendo pela barriga (-Z)
  const r = k.r;
  for (let i = 0; i < 10; i++) {
    const x = r.f(-0.08, 0.08);
    out.push(parte(tf(folha(0.02, 0.008, C('#4e7a2c'), C('#6a9a4a'), { n: 5, m: 5, curva: 0.2 }), [x, 0.012 + r.f(0, 0.01), b.min.z - 0.003], [0, r.f(0, TAU), 0.3]), 'acetinado'));
  }
  // bandeja de alumínio aberta com a borda amassada para cima
  const L = T * 1.25, W = T * 0.5;
  const AL = C('#a4a9ae');
  out.push(parte(chapa(28, 16, (u, v, lado) => {
    const x = (u - 0.5) * L, z = v * W / 2;
    const bx = Math.abs(2 * u - 1), bz = Math.abs(v);
    const borda = Math.max(suave(0.7, 1, bx), suave(0.6, 1, bz));
    let y = 0.0004 + borda * 0.03 + 0.004 * fbm(x * 40, 0, z * 40, s) * borda;
    if (!lado) y -= 0.0004;
    return [x * (1 - 0.06 * borda), y, z * (1 - 0.1 * borda)];
  }, (x, y, z) => {
    const vinco = Math.abs(fbm(x * 140, y * 140, z * 140, s + 2));
    return mul(AL, 0.85 + 0.25 * fbm(x * 60, y * 60, z * 60, s) + 0.2 * suave(0.05, 0, vinco));
  }), 'brilhante', true));
  return out;
};

/** Folha de papel-manteiga recortada em coração, com o vinco do meio. */
const gPapelCoracao: Gerador = (k) => {
  const { s } = k;
  const S = k.T / 34;
  const P = C('#efe6d0');
  return [parte(chapa(48, 12, (u, v, lado) => {
    const t = (u - 0.5) * TAU * 0.999;
    const hx = 16 * Math.sin(t) ** 3, hz = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const r = (v + 1) / 2;
    const x = hz * S * r, z = hx * S * r;
    const y = (lado ? 0.0003 : 0) + 0.0015 * (1 - suave(0, 0.02, Math.abs(z))) + 0.001 * fbm(x * 30, 0, z * 30, s);
    return [x, y, z];
  }, (x, y, z) => mix(mul(P, 1 + 0.03 * fbm(x * 200, 0, z * 200, s)), mul(P, 0.86), 1 - suave(0.0005, 0.002, Math.abs(z)))), 'fosco', true)];
};

/* ------------------------------------------------------------------ */
/* Peixe-anjo com bacon, arraia empanada, terrina inteira               */
/* ------------------------------------------------------------------ */

/** Filé de peixe-anjo envolto em bacon trançado, assado e dourado, com raminhos de tomilho. */
const gPeixeAnjoBacon: Gerador = (k) => {
  const { s } = k;
  const L = k.T, R = L * 0.13;
  const out: Parte[] = [];
  const CAR = C('#f2e8dc'), BAC = C('#9a3e26'), GOR = C('#ecc898');
  const raio = (t: number) => R * Math.sin(PI * clamp(0.06 + 0.88 * t)) ** 0.45 * (0.8 + 0.2 * t);
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 22,
    perfil: (t) => ({ ry: raio(t) * 0.85, rz: raio(t), cy: R * 0.85 }),
    desloc: (p) => { if (p.y < R * 0.1) p.y = R * 0.1 - (R * 0.1 - p.y) * 0.3; },
    cor: (x, y, z) => mix(CAR, C('#e8c8a0'), suave(0.2, 0.8, fbm(x * 90, y * 90, z * 90, s)) * 0.4),
  }), 'acetinado', true));
  // tiras de bacon em hélices cruzadas (trama)
  const nT = 5;
  for (const sent of [-1, 1]) for (let i = 0; i < nT; i++) {
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24;
      const x = lerp(-L * 0.42, L * 0.42, t);
      const tt = (x + L / 2) / L;
      const a = sent * (t * PI * 1.2) + (i * TAU) / nT;
      if (Math.sin(a) < -0.55) continue; // não passa por baixo da peça
      const rr = raio(tt) * (1.06 + 0.04 * Math.cos(a * 4 + (sent > 0 ? 0 : PI)));
      pts.push(V(x, R * 0.85 + rr * 0.85 * Math.sin(a), rr * Math.cos(a)));
    }
    if (pts.length < 4) continue;
    out.push(parte(tubo(pts, {
      raio: R * 0.2, achata: 0.18, m: 6, n: 30,
      cor: (x, y, z, t, a) => {
        const lst = Math.abs(Math.sin(a * 1.0 + 0.5)) ;
        let c = mix(BAC, GOR, suave(0.6, 0.9, lst) * 0.6);
        c = mix(c, C('#6a2a16'), suave(0.2, 0.7, fbm(x * 200, y * 200, z * 200, s + i)) * 0.4);
        return c;
      },
    }), 'brilhante'));
  }
  // tomilho por cima
  const TOM = C('#5a7a3a');
  for (let i = 0; i < 3; i++) {
    const x = lerp(-L * 0.25, L * 0.25, i / 2);
    out.push(parte(tubo([V(x - L * 0.06, R * 1.75, -R * 0.1), V(x, R * 1.82, 0), V(x + L * 0.06, R * 1.72, R * 0.12)], { raio: 0.0007, m: 3, n: 8, cor: () => C('#7a6a4a') }), 'fosco'));
    for (let j = 0; j < 6; j++) out.push(parte(tf(elipsoide(0.0025, 0.0007, 0.0012, tom(TOM, 0.1, 400, j), 3, 5), [x - L * 0.05 + j * L * 0.02, R * 1.8, (j % 2 ? 1 : -1) * 0.002], [0, j, 0]), 'fosco'));
  }
  return out;
};

/** Asa de arraia empanada e frita: leque grosso dourado com as estrias da cartilagem. */
const gArraiaEmpanada: Gerador = (k) => {
  const { s } = k;
  const R = k.T, H = R * 0.09;
  const OU = C('#a8601e'), CL = C('#d89a48');
  return [parte(chapa(30, 16, (u, v, lado) => {
    const a = lerp(-0.62, 0.62, u);
    const r = R * (v + 1) / 2;
    const bord = R * (1 - 0.06 * Math.abs(Math.sin(a * 9)) - 0.12 * (u ** 4));
    const rr = Math.min(r, bord);
    const t = rr / R;
    const esp = H * (1 - t ** 1.6) * (0.5 + 0.5 * Math.cos(a * 1.6)) + 0.001;
    const sulco = 0.12 * Math.abs(Math.sin(a * 24)) ** 4 * H;
    const y = lado ? esp - sulco * (1 - t) : 0;
    return [rr * Math.cos(a) - R * 0.5, y, rr * Math.sin(a)];
  }, (x, y, z, u, v, lado) => {
    const a = lerp(-0.62, 0.62, u);
    let c = mix(CL, OU, suave(0.0, 0.6, fbm(x * 120, y * 120, z * 120, s)) * 0.7);
    c = mix(c, C('#8a4e1a'), Math.abs(Math.sin(a * 24)) ** 10 * 0.35);
    c = mix(c, C('#7a4416'), (1 - suave(0.08, 0.15, celula(x * 600, y * 600, z * 600, s + 1))) * 0.4);
    return lado ? c : mul(c, 0.9);
  }), 'acetinado', true)];
};

/** Terrina de peixe desenformada inteira: bloco forrado de espinafre, pontas com as camadas. */
const gTerrinaInteira: Gerador = (k) => {
  const { s } = k;
  const L = k.T, W = L * 0.36, H = L * 0.3;
  const out: Parte[] = [];
  const ESP = C('#2e5a22'), ESP2 = C('#4e7a34');
  const corEsp: CorFn = (x, y, z) => {
    const veia = Math.abs(Math.sin((x * 0.7 + y + z * 0.5) * 260 + 3 * fbm(x * 40, y * 40, z * 40, s))) ** 10;
    return mul(mix(mix(ESP, ESP2, suave(0.2, 0.8, fbm(x * 50, y * 50, z * 50, s)) * 0.6), C('#6a9a4a'), veia * 0.4), 1);
  };
  out.push(parte(tf(caixa(L, H, W, corEsp, { m: 28, n: 12 }), [0, H / 2, 0]), 'acetinado', true));
  // pontas: seção com musse branca, camarões no espinafre e musse verde
  const MB = C('#f2ece2'), MV = C('#a8c87a'), CAM = C('#f08a6a');
  for (const sg of [-1, 1]) {
    out.push(parte(chapa(18, 16, (u, v, lado) => [sg * (L / 2 + 0.0004 + (lado ? 0.0003 : 0)), u * H * 0.94 + H * 0.03, v * (W / 2) * 0.94 * sg], (x, y, z, u, v) => {
      const yn = u, zn = v;
      if (Math.abs(zn) > 0.9 || yn < 0.06 || yn > 0.95) return corEsp(x, y, z, 0, 0);
      let c = yn < 0.42 ? MB : yn > 0.62 ? MV : MB;
      // fileira de camarões enrolados em espinafre no meio
      for (const cz of [-0.5, 0, 0.5]) {
        const d = Math.hypot((zn - cz) / 0.22, (yn - 0.52) / 0.1);
        if (d < 1) c = d < 0.65 ? mix(CAM, C('#fbe0d0'), Math.abs(Math.sin(d * 9)) * 0.5) : ESP;
      }
      return mul(c, 1 + 0.04 * fbm(x * 300, y * 300, z * 300, s));
    }), 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Lagosta                                                              */
/* ------------------------------------------------------------------ */

const LAG_V = C('#c8301a'), LAG_B = C('#f6f0e8');

/** Carne da cauda inteira, sem casca: curva, segmentada, branca com as estrias vermelhas no dorso. */
const gCaudaLagosta: Gerador = (k) => {
  const { s } = k;
  const L = k.T, R = L * 0.16;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const a = -0.5 + t * 1.3;
    pts.push(V(L * 0.55 * Math.sin(a), R + L * 0.25 * (1 - Math.cos(a)) * 0.5, 0));
  }
  return [parte(tubo(pts, {
    raio: (t) => R * (1 - 0.55 * t ** 1.3) * (1 - 0.06 * Math.abs(Math.sin(t * PI * 6)) ** 0.3) * Math.sqrt(suave(0, 0.06, t) * 0.8 + 0.2),
    achata: 1.15, m: 22, n: 48, cima: V(0, 1, 0),
    cor: (x, y, z, t, a) => {
      const dorso = suave(-0.1, 0.6, Math.cos(a));
      const estria = Math.abs(Math.sin(a * 7 + 2 * fbm(x * 60, y * 60, z * 60, s))) ** 3;
      let c = mix(LAG_B, mix(LAG_V, C('#f08a6a'), estria * 0.6), dorso * (0.55 + 0.45 * estria));
      c = mix(c, mul(c, 0.86), (1 - Math.abs(Math.sin(t * PI * 6))) ** 8 * 0.5);
      return mul(c, 1 + 0.04 * fbm(x * 300, y * 300, z * 300, s + 1));
    },
  }), 'umido', true)];
};

/** Medalhões grossos da cauda, sobrepostos em fila: carne branca em espiral e borda vermelha. */
const gMedalhoesGrossos: Gerador = (k) => {
  const { s } = k;
  const n = 5;
  const R = 0.016, E = 0.011;
  const out: Parte[] = [];
  for (let i = 0; i < n; i++) {
    const Ri = R * (1 - 0.06 * i);
    const g = torno({
      caminho: [[0, 0], [Ri * 0.92, 0], [Ri, E * 0.15], [Ri, E * 0.85], [Ri * 0.92, E], [0, E]],
      n: 10, m: 28, l: 0.82,
      cor: (x, y, z) => {
        const r = Math.hypot(x, z / 0.82) / Ri, a = Math.atan2(z, x);
        // borda vermelha do lado do dorso
        const dorso = suave(0.3, 0.8, Math.cos(a - 1.6));
        if (y > E * 0.12 && y < E * 0.88 && r > 0.95) return mix(LAG_B, LAG_V, 0.3 + 0.6 * dorso);
        let c = mix(LAG_B, C('#ece2d6'), Math.abs(Math.sin(a * 2 + r * 9)) ** 6 * 0.6);
        c = mix(c, LAG_V, suave(0.84, 0.98, r) * dorso * 0.9);
        return mul(c, 1 + 0.04 * fbm(x * 500, y * 500, z * 500, s + i));
      },
    });
    tf(g, [i * R * 1.25, E * 0.2 + (n - i) * 0.0012, 0], [0, 0, -0.35]);
    out.push(parte(g, 'umido', i === 0));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Caranguejo desmontado                                                */
/* ------------------------------------------------------------------ */

const CAR_V = C('#b8462a'), CAR_E = C('#7a2a18'), CAR_B = C('#f0e2c8');

/** Carapaça do caranguejo (sapateira cozida) em casca fina: domo oval com borda de massa de torta. */
function carapaca(L: number, W: number, H: number, s: number, aberta: boolean): THREE.BufferGeometry {
  const e = H * 0.08;
  const lob = (th: number) => 1 + 0.025 * Math.abs(Math.sin(th * 9)) ** 0.6 * suave(0.2, 0.7, Math.cos(th));
  return chapa(44, 18, (u, v, lado) => {
    const th = u * TAU;
    const ph = ((v + 1) / 2) * (aberta ? 0.93 : 1);
    const sp = Math.sin(ph * PI * 0.5), cp = Math.cos(ph * PI * 0.5);
    const k = lado ? 1 : 1 - e / H;
    const x = (L / 2) * sp * Math.cos(th) * lob(th) * (lado ? 1 : 1 - e / L * 2);
    const z = (W / 2) * sp * Math.sin(th) * lob(th) * (lado ? 1 : 1 - e / W * 2);
    const y = H * cp ** 0.45 * k - (lado ? 0 : e * 0.3);
    return [x, Math.max(0, y), z];
  }, (x, y, z, u, v, lado) => {
    if (!lado) return mul(mix(C('#e8d4b0'), C('#c8a070'), suave(0.1, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.7), 1);
    const th = u * TAU;
    let c = mix(CAR_V, CAR_E, suave(0.1, 0.6, fbm(x * 70, y * 70, z * 70, s)) * 0.55);
    c = mix(c, C('#d8724a'), (1 - suave(0.12, 0.22, celula(x * 300, y * 300, z * 300, s + 1))) * 0.35);
    c = mix(c, C('#e8a070'), suave(0.85, 1, (v + 1) / 2) * 0.5);
    c = mix(c, CAR_E, Math.abs(Math.sin(th * 9)) ** 10 * suave(0.85, 1, (v + 1) / 2) * 0.6);
    return c;
  });
}

/** Caranguejo cozido sem pernas nem garras: carapaça com os encaixes claros das patas. */
const gCaranguejoSemPernas: Gerador = (k) => {
  const { s } = k;
  const L = k.T * 0.72, W = k.T, H = k.T * 0.2;
  const out: Parte[] = [parte(carapaca(L, W, H, s, false), 'brilhante', true)];
  // barriga clara embaixo (fecha o domo)
  out.push(parte(tf(elipsoide(L * 0.46, H * 0.12, W * 0.46, tom(CAR_B, 0.06, 200, s), 10, 20), [0, H * 0.06, 0]), 'acetinado'));
  // encaixes das patas nas laterais: quatro de cada lado e as duas garras na frente
  for (const sg of [-1, 1]) for (let i = 0; i < 5; i++) {
    const a = sg * (0.9 + i * 0.32);
    const rr = i === 0 ? 0.012 : 0.008;
    const g = elipsoide(rr * 0.6, rr, rr, (x, y, z) => mix(CAR_B, C('#e8a088'), suave(0.6, 1, Math.hypot(y, z) / rr) * 0.6), 5, 10);
    out.push(parte(tf(g, [Math.cos(a) * L * 0.47, H * 0.18, Math.sin(a) * W * 0.47], [0, -a, 0]), 'acetinado'));
  }
  return out;
};

/** Garras e patas quebradas: a casca rachada com a carne branca aparecendo. */
const gGarrasQuebradas: Gerador = (k) => {
  const { s } = k;
  const out: Parte[] = [];
  const casca: CorFn = (x, y, z) => mix(mix(CAR_V, CAR_E, suave(0.1, 0.6, fbm(x * 90, y * 90, z * 90, s)) * 0.5), C('#e8b090'), suave(-0.003, 0.004, -y + 0.008) * 0.4);
  const garra = (px: number, pz: number, ang: number, si: number) => {
    const L = 0.085, R = 0.017;
    const gs: THREE.BufferGeometry[] = [];
    // palma rachada: casca com uma janela de carne
    gs.push(corpo({
      x0: 0, x1: L * 0.6, n: 18, m: 18,
      perfil: (t) => { const r = R * (0.55 + 0.45 * Math.sin(PI * (0.12 + 0.75 * t)) ** 0.7); return { ry: r * 0.65, rz: r, cy: r * 0.65 }; },
      cor: (x, y, z, t, a) => {
        const fenda = suave(0.25, 0.8, Math.cos(a)) * suave(0.2, 0.35, t) * (1 - suave(0.75, 0.9, t)) * suave(-0.2, 0.3, fbm(x * 200, y * 200, z * 200, s + si));
        return mix(casca(x, y, z, t, a), mul(CAR_B, 1 + 0.06 * ruido(x * 900, y * 900, z * 900, s)), fenda > 0.4 ? 1 : 0);
      },
      mod: (t, a) => 1 - 0.08 * suave(0.6, 0.9, Math.cos(a)) * suave(0.25, 0.4, t) * (1 - suave(0.7, 0.85, t)),
    }));
    // dedos com ponta preta
    for (const sg of [-1, 1]) gs.push(tubo([V(L * 0.55, R * 0.6, sg * R * 0.3), V(L * 0.75, R * 0.6, sg * R * 0.45), V(L, R * 0.5, sg * R * 0.1)], {
      raio: (t) => R * 0.32 * (1 - 0.8 * t), m: 8, n: 12,
      cor: (x, y, z, t, a) => mix(casca(x, y, z, t, a), C('#1a1410'), suave(0.6, 0.9, t)),
    }));
    for (const g of gs) out.push(parte(tf(g, [px, 0, pz], [0, ang, 0]), 'brilhante', si === 0));
    // lasca de casca solta e carne saindo
    out.push(parte(tf(elipsoide(R * 0.7, R * 0.35, R * 0.5, tom(CAR_B, 0.06, 300, s + si), 6, 9), [px + Math.cos(ang) * L * 0.3, R * 1.0, pz - Math.sin(ang) * L * 0.3]), 'umido'));
  };
  garra(-0.045, -0.02, 0.25, 0);
  garra(-0.03, 0.035, -0.35, 1);
  // pedaços de pata
  for (let i = 0; i < 3; i++) {
    const z = -0.04 + i * 0.03, x = 0.07;
    const g = tubo([V(x - 0.03, 0.005, z), V(x, 0.0055, z + 0.004), V(x + 0.03, 0.005, z)], { raio: 0.0048, m: 8, n: 14, cor: (xx, y, zz, t, a) => mix(casca(xx, y, zz, t, a), CAR_B, suave(0.92, 1, t)) });
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

/** Carapaça vazia e aparada pela linha natural: casca vermelha com o interior limpo. */
const gCarapacaVazia: Gerador = (k) => {
  const L = k.T * 0.72, W = k.T, H = k.T * 0.2;
  const g = carapaca(L, W, H, k.s, true);
  // de boca para cima, mostrando o interior limpo
  g.rotateX(PI);
  return [parte(g, 'brilhante', true)];
};

/** Corpo do caranguejo partido ao meio: câmaras ósseas com carne branca e as brânquias cinzentas. */
const gCorpoCaranguejo: Gerador = (k) => {
  const { s } = k;
  const L = k.T, W = L * 0.42, H = L * 0.26;
  const out: Parte[] = [];
  for (const sg of [-1, 1]) {
    const g = corpo({
      x0: -L * 0.45, x1: L * 0.45, n: 22, m: 20, exp: 3,
      perfil: (t) => { const f = Math.sin(PI * clamp(0.05 + 0.9 * t)) ** 0.5; return { ry: (H / 2) * f, rz: (W / 2) * f, cy: H / 2 }; },
      desloc: (p) => { if (p.z * -1 < 0) p.z *= 0.08; if (p.y < 0) p.y *= 0.3; },
      cor: (x, y, z) => {
        // face do corte (z perto de 0): câmaras em favo com a carne branca
        if (Math.abs(z) < W * 0.04) {
          const c = celula(x * 160, y * 160, 0, s);
          return mix(mul(CAR_B, 1.03), C('#a87850'), suave(0.62, 0.9, c));
        }
        return mix(C('#d8b890'), C('#a86a48'), suave(0.2, 0.8, fbm(x * 90, y * 90, z * 90, s)) * 0.6);
      },
    });
    g.translate(0, 0, 0);
    if (sg > 0) g.rotateY(PI);
    g.translate(0, 0, sg * W * 0.08);
    out.push(parte(g, 'acetinado', sg < 0));
    // brânquias em dedos ("dedos do morto") na lateral de fora
    for (let i = 0; i < 4; i++) {
      const x = -L * 0.3 + i * L * 0.14;
      out.push(parte(tubo([V(x, H * 0.5, sg * W * 0.5), V(x + L * 0.04, H * 0.6, sg * W * 0.72), V(x + L * 0.1, H * 0.45, sg * W * 0.82)], {
        raio: (t) => L * 0.04 * (1 - 0.6 * t), achata: 0.35, m: 6, n: 10,
        cor: (xx, y, z) => mul(mix(C('#9a9282'), C('#6a6458'), suave(0.2, 0.8, fbm(xx * 200, y * 200, z * 200, s + i)) * 0.5), 1),
      }), 'umido'));
    }
  }
  return out;
};

/** Carne de caranguejo separada em dois montes fartos: fios brancos com rosado e carne escura cremosa. */
const gCarneCaranguejoMontes: Gerador = (k) => {
  const { s } = k;
  const r = k.r;
  const out: Parte[] = [];
  const BR = C('#f6f0e4'), RO = C('#ec9a7a'), ES = C('#9a7044');
  const R = k.T * 0.26;
  // monte de carne escura, liso e cremoso
  out.push(parte(tf(torno({
    caminho: domo(R, R * 0.75),
    n: 12, m: 28, mod: (t, a) => 1 + 0.1 * fbm(t * 3, Math.cos(a) * 2, Math.sin(a) * 2, s),
    cor: (x, y, z) => mix(ES, C('#c8a070'), suave(0.1, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.6),
  }), [R * 1.1, 0, 0]), 'acetinado'));
  // monte branco: base e fios desfiados por cima
  out.push(parte(tf(torno({
    caminho: domo(R * 1.1, R * 0.95),
    n: 12, m: 28, mod: (t, a) => 1 + 0.12 * fbm(t * 3, Math.cos(a) * 2, Math.sin(a) * 2, s + 1),
    cor: (x, y, z) => mix(BR, RO, suave(0.4, 0.9, fbm(x * 90, y * 90, z * 90, s + 2)) * 0.5),
  }), [-R * 1.05, 0, 0]), 'acetinado', true));
  for (let i = 0; i < 26; i++) {
    const a = r.f(0, TAU), d = R * 0.9 * Math.sqrt(r.n());
    const h = R * 0.6 * Math.max(0.1, 1 - (d / (R * 1.1)) ** 2);
    const ang = r.f(0, TAU), Lf = r.f(0.012, 0.022);
    const p0 = V(-R * 1.05 + Math.cos(a) * d, h, Math.sin(a) * d);
    const dir = V(Math.cos(ang), r.f(-0.2, 0.2), Math.sin(ang));
    const rosado = r.n() < 0.3;
    out.push(parte(tubo([p0, p0.clone().addScaledVector(dir, Lf * 0.5).add(V(0, 0.001, 0)), p0.clone().addScaledVector(dir, Lf)], {
      raio: r.f(0.0012, 0.002), m: 4, n: 6,
      cor: (x, y, z, t, b) => mix(BR, RO, rosado ? suave(-0.2, 0.6, Math.cos(b)) * 0.8 : 0),
    }), 'acetinado'));
  }
  return out;
};

/** Caranguejo servido na própria casca: carne branca nas pontas, escura no meio e faixas de salsa, gema e clara. */
const gCaranguejoRecheado: Gerador = (k) => {
  const { s } = k;
  const L = k.T * 0.72, W = k.T, H = k.T * 0.2;
  const g = carapaca(L, W, H, s, true);
  g.rotateX(PI);
  const b = caixaDe([g]);
  g.translate(0, -b.min.y, 0);
  const topoY = b.max.y - b.min.y;
  const out: Parte[] = [parte(g, 'brilhante', true)];
  const BR = C('#f4ecdc'), ES = C('#a87c4a'), SA = C('#2e6a22'), GE = C('#f2c43a'), CL = C('#fbfaf4');
  // recheio: superfície levemente abaulada dentro da boca da casca, pintada em faixas ao longo de Z
  out.push(parte(chapa(30, 26, (u, v, lado) => {
    const x = (u - 0.5) * L * 0.84, z = v * W * 0.42;
    const f = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) ;
    const zz = z * f;
    const y = topoY - H * 0.06 + (lado ? H * 0.14 * (1 - (2 * u - 1) ** 2) * (1 - v * v) + 0.0008 : 0);
    return [x, y, zz];
  }, (x, y, z, u, v) => {
    const vv = Math.abs(v);
    const n = fbm(x * 400, y * 400, z * 400, s);
    if (vv < 0.2) return mix(ES, C('#c8a070'), suave(0.0, 0.8, n) * 0.5);
    if (vv < 0.3) return mix(SA, C('#4e8a34'), suave(0.0, 0.8, n) * 0.6);
    if (vv < 0.4) return mix(GE, C('#e8a820'), suave(0.0, 0.8, n) * 0.4);
    if (vv < 0.5) return mix(CL, C('#e8e4d4'), suave(0.0, 0.8, n) * 0.5);
    return mix(BR, C('#ec9a7a'), suave(0.3, 0.9, fbm(x * 150, y * 150, z * 150, s + 1)) * 0.4);
  }), 'acetinado'));
  return out;
};

/* ------------------------------------------------------------------ */
/* Registro                                                             */
/* ------------------------------------------------------------------ */

const vis = (f: Visual['f'], v: string, t: number, cores: string, x: Partial<Visual> = {}): Visual => {
  const [c1, c2, ci, cc, c3] = cores.split(' ').map((c) => '#' + c);
  return { f, v, t, c1, c2, ci, cc, c3, ...x };
};

export const LOTE: Lote = {
  // caldos
  'c1-carcaca-frango': { visual: vis('peca_ave', 'carcaca-ossos', 0.2, 'eadcc4 d48f86 d48f86 c89060'), gerar: gCarcacaFrango },
  'c1-aparas-peixe': { visual: vis('file_peixe', 'aparas', 0.13, 'f4efe6 9aa2aa f4efe6 fbf8f2', { a: 0.15, l: 0.8 }), gerar: gAparasPeixe },
  'c1-cabeca-peixe': { visual: vis('file_peixe', 'cabeca', 0.14, '8c949c e5e8ea f4f0ea fbf8f2', { a: 0.4, l: 0.6, ac: 'umido' }), gerar: gCabecaPeixe },
  'c1-bonito-seco': { visual: vis('monte', 'katsuobushi', 0.07, 'd9a184 a8604a e8c0a0 c89070', { a: 0.3, ac: 'fosco' }), gerar: gBonitoSeco },
  // ovos e queijos
  'c1-gema-limpa': { visual: vis('esferoide', 'gema-limpa', 0.034, 'f2a414 e88a10 f2a414 f6c040', { a: 0.4, ac: 'brilhante' }), gerar: gGemaLimpa },
  'c1-omelete-rolo': { visual: vis('pao_chato', 'omelete-rolo', 0.17, 'f2cc4a c8902e f6dc70 c8903a', { a: 0.28, l: 0.28, ac: 'acetinado' }), gerar: gOmeleteRolo },
  'c1-queijo-fresco': { visual: vis('queijo', 'fresco-disco', 0.08, 'f7f5ee e8e2d0 f8f6ef e8dcc0', { a: 0.55, l: 1, ac: 'umido' }), gerar: gQueijoFrescoDisco },
  'c1-crottin': { visual: vis('queijo', 'crottin', 0.048, 'ece4cc b8b8a8 f6f2e8 e0c890', { a: 0.75, l: 1, ac: 'fosco' }), gerar: gCrottin },
  'c1-tomate-recheado': { visual: vis('esferoide', 'tomate-recheado', 0.03, 'd4261c c8401e e8604a a8321e', { a: 1.1, ac: 'brilhante' }), gerar: gTomateRecheado },
  'c1-abobrinha-recheada': { visual: vis('fuso', 'abobrinha-recheada', 0.034, '2e5a22 a8c87a e8eccc a8a060', { a: 1.2, l: 1 }), gerar: gAbobrinhaRecheada },
  'c1-ervilha-recheada': { visual: vis('vagem', 'ervilha-recheada', 0.075, '6aa83c a8d07a c8e8a0 6a8a3a', { a: 0.2, l: 0.24 }), gerar: gErvilhaRecheada },
  'c1-crosta-creme': { visual: vis('placa', 'crosta-creme', 0.07, 'ecc860 fbf3d8 fbf3d8 d8a440', { a: 0.12, l: 0.7 }), gerar: gCrostaCreme },
  // ervas
  'c1-fios-acafrao': { visual: vis('monte', 'acafrao', 0.03, 'c8260c e85a14 c8260c a81e0a', { a: 0.15 }), gerar: gFiosAcafrao },
  'c1-zimbro': { visual: vis('baga', 'zimbro', 0.025, '2e2a48 8a8aa8 a89a60 2e2a48', { a: 0.5, ac: 'acetinado' }), gerar: gZimbro },
  'c1-casca-limao-picada': { visual: vis('monte', 'casca-picada', 0.05, 'f2d82a f6f0d0 f6f0d0 e8c830', { a: 0.3 }), gerar: gCascaLimaoPicada },
  'c1-ossobuco-osso': { visual: vis('carne_osso', 'ossobuco-braseado', 0.12, '7a3a1e e8dcc0 8e4a2e 7a3a1e', { a: 0.4, ac: 'brilhante' }), gerar: gOssobuco },
  // peixes
  'c1-sardinha-borboleta': { visual: vis('peixe', 'borboleta', 0.13, '2e4f7a d8dfe6 b5695a d8b49a', { a: 0.17, l: 0.35 }), gerar: gSardinhaBorboleta },
  'c1-salmao-borboleta': { visual: vis('peixe', 'borboleta', 0.7, '4a5a6a d9dde0 f08a5d f4c4a3', { a: 0.15, l: 0.3 }), gerar: gSalmaoBorboleta },
  'c1-truta-borboleta': { visual: vis('peixe', 'borboleta', 0.35, '6f7a5a e0d9c8 f2a37f f3d0b8', { a: 0.15, l: 0.3 }), gerar: gTrutaBorboleta },
  'c1-carcaca-salmao': { visual: vis('peixe', 'carcaca', 0.7, '4a5a6a d9dde0 f08a5d f4c4a3', { a: 0.12, l: 0.25 }), gerar: gCabecaCarcacaSalmao },
  'c1-salmao-pelado': { visual: vis('peixe', 'pelado', 0.7, 'f2a08a d9dde0 f2a08a f2a08a', { a: 0.12, l: 0.25 }), gerar: gSalmaoPelado },
  'c1-linguado-pelado': { visual: vis('peixe_chato', 'pelado', 0.35, 'f4e6e0 e2c4bc f4e6e0 fbf8f2', { a: 0.05, l: 0.45 }), gerar: gLinguadoPelado },
  'c1-rodovalho': { visual: vis('peixe_chato', 'oval', 0.5, '7a6a50 5a4c38 f6f2ec fbf8f2', { a: 0.07, l: 0.85, d: 'tuberculos redondo', ac: 'acetinado' }), gerar: gRodovalho },
  'c1-peixe-no-pano': { visual: vis('peixe', 'no-pano', 0.36, 'e4e2da b8bcc0 f2a37f f3d0b8', { a: 0.12, l: 0.25, ac: 'acetinado' }), gerar: gPeixeNoPano },
  'c1-file-salmao-endro': { visual: vis('file_peixe', 'lado-endro', 0.3, 'f08a5d b8b8b8 f08a5d f4c4a3', { a: 0.08, l: 0.3, ac: 'brilhante' }), gerar: gFileSalmaoEndro },
  'c1-files-salmao-empilhados': { visual: vis('file_peixe', 'lado-duplo', 0.3, '9aa4ae b8b8b8 f08a5d f4c4a3', { a: 0.16, l: 0.3, ac: 'brilhante' }), gerar: gFilesEmpilhados },
  'c1-file-tainha': { visual: FILE_TAINHA, gerar: gFilePeixe },
  'c1-laco-anchova': { visual: vis('file_peixe', 'laco', 0.05, '7a3a2e c8c4c0 8a4a3a 9a5a48', { a: 0.35, l: 0.6, ac: 'brilhante' }), gerar: gLacoAnchova },
  'c1-borboleta-lima': { visual: vis('citrico', 'borboleta', 0.05, '4a8a1e f0f4dc 9ac83a 6a8a2a', { a: 0.1, l: 1, ac: 'brilhante' }), gerar: gBorboletaLima },
  'c1-limao-trancado': { visual: vis('citrico', 'trancado', 0.075, 'ecd62a f6f0c8 f2ea9a c8b830', { a: 0.8, l: 0.75 }), gerar: gLimaoTrancado },
  'c1-limao-alado': { visual: vis('citrico', 'alado', 0.055, 'ecd62a f6f2d8 f2e870 c8b830', { a: 0.4, l: 1, ac: 'brilhante' }), gerar: gLimaoAlado },
  'c1-pepino-torcido': { visual: vis('fuso', 'torcido', 0.042, '28561f c8dca0 dfe9c0 8a9a5a', { a: 0.4, l: 1, ac: 'brilhante' }), gerar: gPepinoTorcido },
  'c1-fatia-gengibre': { visual: vis('placa', 'gengibre-rosado', 0.045, 'f2a4a0 fad2c8 f2a4a0 e8a898', { a: 0.1, l: 0.75, ac: 'umido' }), gerar: gFatiaGengibre },
  'c1-rosa-gengibre': { visual: vis('placa', 'rosa-gengibre', 0.045, 'f2a4a0 fbd8d0 f2a4a0 e8a898', { a: 0.75, l: 1, ac: 'umido' }), gerar: gRosaGengibre },
  'c1-cebolinha-cachos': { visual: vis('talo', 'cachos', 0.05, '5a9a3a a8d080 8ac06a 6a8a3a', { a: 0.3, l: 0.6 }), gerar: gCebolinhaCachos },
  'c1-truta-recheada-dorso': { visual: vis('peixe', 'recheada-dorso', 0.35, '6f7a5a e0d9c8 f2e6dc f3d0b8', { a: 0.2, l: 0.1 }), gerar: gTrutaRecheadaDorso },
  'c1-truta-aluminio': { visual: vis('placa', 'pacote-aluminio', 0.38, 'c8ccd0 9aa0a6 f2a37f f3d0b8', { a: 0.2, l: 0.32, ac: 'brilhante' }), gerar: gTrutaAluminio },
  'c1-pacote-aberto': { visual: vis('peixe', 'pacote-aberto', 0.44, 'c4c8cc 6f7a5a f2e6dc f3d0b8', { a: 0.15, l: 0.45 }), gerar: gPacoteAberto },
  'c1-papel-coracao': { visual: vis('placa', 'papel-coracao', 0.3, 'efe6d0 d8ccb0 efe6d0 e0c890', { a: 0.01, l: 1, ac: 'fosco' }), gerar: gPapelCoracao },
  'c1-peixe-anjo-bacon': { visual: vis('file_peixe', 'bacon-trancado', 0.2, '9a3e26 ecc898 f2e8dc c8803a', { a: 0.3, l: 0.3, ac: 'brilhante' }), gerar: gPeixeAnjoBacon },
  'c1-arraia-empanada': { visual: vis('file_peixe', 'asa-empanada', 0.17, 'c8862e e8b866 f0dcd0 c8862e', { a: 0.12, l: 1.1 }), gerar: gArraiaEmpanada },
  'c1-terrina-peixe': { visual: vis('barra', 'terrina-peixe-inteira', 0.25, '2e5a22 4e7a34 f2ece2 a8c87a', { a: 0.3, l: 0.36 }), gerar: gTerrinaInteira },
  // frutos do mar
  'c1-cauda-lagosta': { visual: vis('crustaceo', 'cauda-limpa', 0.15, 'd0401e f6f0e8 f6f0e8 f2e4dc', { a: 0.35, l: 0.35, ac: 'umido' }), gerar: gCaudaLagosta },
  'c1-medalhoes-lagosta': { visual: vis('crustaceo', 'medalhoes-grossos', 0.11, 'd0401e f6f0e8 f6f0e8 f2e4dc', { a: 0.2, l: 0.3, ac: 'umido' }), gerar: gMedalhoesGrossos },
  'c1-caranguejo-sem-pernas': { visual: vis('crustaceo', 'sem-pernas', 0.16, 'b8462a 7a2a18 f0e2c8 b8462a', { a: 0.3, l: 1 }), gerar: gCaranguejoSemPernas },
  'c1-garras-caranguejo': { visual: vis('crustaceo', 'garras-quebradas', 0.17, 'b8462a 7a2a18 f0e2c8 b8462a', { a: 0.15, l: 0.6 }), gerar: gGarrasQuebradas },
  'c1-carapaca-caranguejo': { visual: vis('crustaceo', 'carapaca-vazia', 0.16, 'b8462a 7a2a18 f0e2c8 b8462a', { a: 0.3, l: 1 }), gerar: gCarapacaVazia },
  'c1-corpo-caranguejo': { visual: vis('crustaceo', 'corpo-meio', 0.1, 'f0e2c8 b8b0a0 f0e2c8 e8d0b8', { a: 0.3, l: 0.6, ac: 'acetinado' }), gerar: gCorpoCaranguejo },
  'c1-carne-caranguejo': { visual: vis('crustaceo', 'carne-montes', 0.14, 'f6f0e4 9a7044 f6f0e4 f2e8da', { a: 0.2, l: 0.5, ac: 'acetinado' }), gerar: gCarneCaranguejoMontes },
  'c1-caranguejo-recheado': { visual: vis('crustaceo', 'recheado-casca', 0.16, 'b8462a f4ecdc f4ecdc b8462a', { a: 0.3, l: 1 }), gerar: gCaranguejoRecheado },
};
