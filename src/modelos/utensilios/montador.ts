// Ferramentas de construção dos utensílios: o Montador junta as partes por
// material (uma malha por material no fim) e as funções abaixo geram as formas
// básicas já no jeito que os geradores precisam (torno, loft retangular,
// lâmina de faca, tubos de arame, caneluras).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COR, material, type ChaveMaterial } from './material';

export type V3 = [number, number, number];

export interface Opcoes {
  /** Posição. */
  p?: V3;
  /** Rotação em radianos (ordem XYZ). */
  r?: V3;
  /** Escala (número ou por eixo). Nunca negativa. */
  s?: V3 | number;
  /** Cor sRGB da parte (cor por vértice). */
  cor?: number;
}

const COR_PADRAO: Record<ChaveMaterial, number> = {
  inox: COR.inox,
  inoxEscuro: COR.inoxEscuro,
  cobalto: COR.cobalto,
  petroleo: COR.petroleo,
  madeira: COR.madeira,
  silicone: COR.silicone,
  ceramica: COR.ceramica,
  vidro: COR.vidro,
};

const tmpCor = new THREE.Color();

/** Deixa a geometria só com posição, normal e cor, não indexada. */
function preparar(geo: THREE.BufferGeometry, cor: number): THREE.BufferGeometry {
  let g = geo;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  for (const nome of Object.keys(g.attributes)) {
    if (nome !== 'position' && nome !== 'normal') g.deleteAttribute(nome);
  }
  g.morphAttributes = {};
  const n = g.getAttribute('position').count;
  tmpCor.setHex(cor, THREE.SRGBColorSpace);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpCor.r;
    c[i * 3 + 1] = tmpCor.g;
    c[i * 3 + 2] = tmpCor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.clearGroups();
  return g;
}

export function matriz(o: Opcoes): THREE.Matrix4 {
  const p = o.p ?? [0, 0, 0];
  const r = o.r ?? [0, 0, 0];
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p[0], p[1], p[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
}

/** Junta partes por material e entrega o grupo final, apoiado em y=0 e centrado em x e z. */
export class Montador {
  private partes = new Map<ChaveMaterial, THREE.BufferGeometry[]>();

  add(mat: ChaveMaterial, geo: THREE.BufferGeometry, o: Opcoes = {}): this {
    const g = preparar(geo, o.cor ?? COR_PADRAO[mat]);
    g.applyMatrix4(matriz(o));
    this.addPronta(mat, g);
    return this;
  }

  /** Adiciona com uma matriz já composta (útil para encadear transformações). */
  addM(mat: ChaveMaterial, geo: THREE.BufferGeometry, m: THREE.Matrix4, cor?: number): this {
    const g = preparar(geo, cor ?? COR_PADRAO[mat]);
    g.applyMatrix4(m);
    this.addPronta(mat, g);
    return this;
  }

  private addPronta(mat: ChaveMaterial, g: THREE.BufferGeometry): void {
    const lista = this.partes.get(mat);
    if (lista) lista.push(g);
    else this.partes.set(mat, [g]);
  }

  /**
   * Fecha o modelo. `pega` e `ponta` são dados nas coordenadas de montagem e
   * acompanham a recentralização.
   */
  finalizar(nome: string, pega: V3, ponta: V3, extra: Record<string, V3> = {}): THREE.Group {
    const grupo = new THREE.Group();
    grupo.name = nome;
    const caixa = new THREE.Box3();
    const geos: [ChaveMaterial, THREE.BufferGeometry][] = [];
    for (const [mat, lista] of this.partes) {
      const g = lista.length === 1 ? lista[0] : mergeGeometries(lista, false);
      if (!g) throw new Error(`falha ao juntar geometrias de ${nome} (${mat})`);
      g.computeBoundingBox();
      caixa.union(g.boundingBox!);
      geos.push([mat, g]);
    }
    const centro = caixa.getCenter(new THREE.Vector3());
    const d = new THREE.Vector3(-centro.x, -caixa.min.y, -centro.z);
    for (const [mat, g] of geos) {
      g.translate(d.x, d.y, d.z);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const malha = new THREE.Mesh(g, material(mat));
      malha.name = `${nome}:${mat}`;
      malha.castShadow = true;
      malha.receiveShadow = true;
      grupo.add(malha);
    }
    const v = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]).add(d);
    grupo.userData.familia = nome;
    grupo.userData.pega = v(pega);
    grupo.userData.ponta = v(ponta);
    for (const [k, p] of Object.entries(extra)) grupo.userData[k] = v(p);
    return grupo;
  }
}

/* ------------------------------------------------------------------ */
/* Formas básicas                                                      */
/* ------------------------------------------------------------------ */

/** Cilindro com a base em y=0. */
export function cilindro(r: number, h: number, seg = 24, rTopo = r, aberto = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTopo, r, h, seg, 1, aberto).translate(0, h / 2, 0);
}

/** Cilindro deitado ao longo de X, de x=0 até x=comp. */
export function cilX(r: number, comp: number, seg = 12, rFim = r): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rFim, r, comp, seg).translate(0, comp / 2, 0).rotateZ(-Math.PI / 2);
}

/** Cilindro ao longo de Z, centrado. */
export function cilZ(r: number, comp: number, seg = 12): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r, r, comp, seg).rotateX(Math.PI / 2);
}

/** Caixa centrada. */
export function caixa(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** Caixa de cantos arredondados, centrada. */
export function caixaR(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

export function esfera(r: number, ws = 12, hs = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, ws, hs);
}

/** Metade de baixo de uma esfera unitária (cuia aberta para cima, de y=-1 a 0). */
export function cuia(ws = 20, hs = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
}

/** Torno ao redor de Y. Perfil em pares [raio, y]. */
export function torno(perfil: [number, number][], seg = 32): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    perfil.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)),
    seg,
  );
}

/** Torno ao redor de X. Perfil em pares [raio, x]. */
export function tornoX(perfil: [number, number][], seg = 14): THREE.BufferGeometry {
  return torno(perfil, seg).rotateZ(-Math.PI / 2);
}

/** Anel horizontal (toro deitado no plano XZ), centrado na origem. */
export function anel(R: number, r: number, seg = 32, rs = 6, arco = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.TorusGeometry(R, r, rs, seg, arco).rotateX(Math.PI / 2);
}

/** Tubo (arame, alça) por uma curva suave de pontos. */
export function tubo(pts: V3[], r: number, seg = 24, rs = 6, fechado = false): THREE.BufferGeometry {
  const curva = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), fechado);
  return new THREE.TubeGeometry(curva, seg, r, rs, fechado);
}

/** Alça em meia-volta presa na parede de um recipiente redondo, apontando para o ângulo dado. */
export function alcaLateral(R: number, r: number, distCentro: number, y: number, angulo: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, 6, 14, Math.PI);
  g.rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(distCentro, y, 0).rotateY(-angulo);
  return g;
}

/** Placa a partir de um THREE.Shape (no plano XY), com espessura em Z, centrada em Z. */
export function placa(shape: THREE.Shape, esp: number, curva = 6): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: esp, bevelEnabled: false, curveSegments: curva });
  return g.translate(0, 0, -esp / 2);
}

/** Placa deitada (plano XZ, espessura em Y, apoiada em y=0). O y do Shape vira -z. */
export function placaDeitada(shape: THREE.Shape, esp: number, curva = 6): THREE.BufferGeometry {
  return placa(shape, esp, curva).rotateX(-Math.PI / 2).translate(0, esp / 2, 0);
}

/** Retângulo de cantos arredondados centrado, como Shape. */
export function retR(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

export function circulo(r: number, cx = 0, cy = 0): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/**
 * Caneluras: modula o raio (no plano XZ) pelo ângulo. Só afeta vértices com
 * y entre y0 e y1. Recalcula as normais.
 */
export function canelar(geo: THREE.BufferGeometry, n: number, amp: number, y0 = -Infinity, y1 = Infinity, agudo = false): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < y0 || y > y1) continue;
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const a = Math.atan2(z, x);
    const onda = agudo ? 1 - 2 * Math.abs(((a * n) / (2 * Math.PI)) % 1 - 0.5) * 2 : Math.cos(a * n);
    const k = 1 + amp * onda;
    pos.setXYZ(i, x * k, y, z * k);
  }
  pos.needsUpdate = true;
  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Loft retangular: um "torno" ao redor de um retângulo arredondado     */
/* ------------------------------------------------------------------ */

function anelRet(a: number, b: number, rc: number, e: number, segCanto: number): [number, number][] {
  const r = Math.max(rc + e, 0.0004);
  const pts: [number, number][] = [];
  const cantos: [number, number, number][] = [
    [a, b, 0],
    [-a, b, Math.PI / 2],
    [-a, -b, Math.PI],
    [a, -b, (3 * Math.PI) / 2],
  ];
  for (const [cx, cz, a0] of cantos) {
    for (let k = 0; k <= segCanto; k++) {
      const t = a0 + (k / segCanto) * (Math.PI / 2);
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
  }
  return pts;
}

/**
 * Superfície de revolução retangular. `w` e `d` são as medidas externas na
 * expansão e=0; o perfil é [e, y] (e positivo afasta a parede para fora).
 */
export function loftRet(w: number, d: number, rc: number, perfil: [number, number][], segCanto = 4): THREE.BufferGeometry {
  const a = w / 2 - rc;
  const b = d / 2 - rc;
  const pos: number[] = [];
  let n = 0;
  for (const [e, y] of perfil) {
    const anelPts = anelRet(a, b, rc, e, segCanto);
    n = anelPts.length;
    for (const [x, z] of anelPts) pos.push(x, y, z);
  }
  const idx: number[] = [];
  for (let i = 0; i < perfil.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      const p0 = i * n + j;
      const p1 = i * n + j2;
      const p2 = (i + 1) * n + j;
      const p3 = (i + 1) * n + j2;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Fundo plano retangular arredondado (virado para cima), em y. */
export function fundoRet(w: number, d: number, rc: number, y: number): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(retR(w, d, rc), 4).rotateX(-Math.PI / 2).translate(0, y, 0);
}

/* ------------------------------------------------------------------ */
/* Lâmina de faca                                                      */
/* ------------------------------------------------------------------ */

export interface LaminaCfg {
  x0: number;
  x1: number;
  /** y do fio em função de u (0 no calcanhar, 1 na ponta). */
  fio: (u: number) => number;
  /** y do dorso em função de u. */
  dorso: (u: number) => number;
  esp: number;
  nx?: number;
  nv?: number;
  /** Fração da altura onde a lâmina atinge a espessura cheia. */
  chanfro?: number;
}

/** Lâmina no plano XY, espessura em Z, afinando até o fio (z=0). */
export function lamina(c: LaminaCfg): THREE.BufferGeometry {
  const nx = c.nx ?? 28;
  const nv = c.nv ?? 4;
  const ch = c.chanfro ?? 0.4;
  const pos: number[] = [];
  const idx: number[] = [];
  const por = nv + 1;
  // frente (z+) e verso (z-)
  for (const lado of [1, -1]) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const x = c.x0 + (c.x1 - c.x0) * u;
      const yf = c.fio(u);
      const yd = Math.max(c.dorso(u), yf);
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        const y = yf + (yd - yf) * v;
        const t = (c.esp / 2) * Math.min(1, 0.06 + v / ch) * (1 - 0.6 * u * u);
        pos.push(x, y, lado * t);
      }
    }
  }
  const base = (lado: number) => (lado === 1 ? 0 : (nx + 1) * por);
  for (const lado of [1, -1]) {
    const b0 = base(lado);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nv; j++) {
        const a = b0 + i * por + j;
        const b = b0 + (i + 1) * por + j;
        const c2 = a + 1;
        const d = b + 1;
        if (lado === 1) idx.push(a, b, c2, c2, b, d);
        else idx.push(a, c2, b, c2, d, b);
      }
    }
  }
  // dorso: liga a última fileira da frente à do verso
  for (let i = 0; i < nx; i++) {
    const fa = i * por + nv;
    const fb = (i + 1) * por + nv;
    const va = base(-1) + i * por + nv;
    const vb = base(-1) + (i + 1) * por + nv;
    idx.push(fa, va, fb, fb, va, vb);
  }
  // fio: liga a primeira fileira (quase cortante)
  for (let i = 0; i < nx; i++) {
    const fa = i * por;
    const fb = (i + 1) * por;
    const va = base(-1) + i * por;
    const vb = base(-1) + (i + 1) * por;
    idx.push(fa, fb, va, fb, vb, va);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Grade de pontinhos planos (furos sugeridos) sobre um plano local. */
export function pontos(
  lista: [number, number][],
  r: number,
  orient: 'cima' | 'frente' | 'lado',
  desloc: number,
  seg = 6,
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const [u, v] of lista) {
    const g = new THREE.CircleGeometry(r, seg);
    if (orient === 'cima') g.rotateX(-Math.PI / 2).translate(u, desloc, v);
    else if (orient === 'frente') g.translate(u, v, desloc);
    else g.rotateY(Math.PI / 2).translate(desloc, v, u);
    out.push(g);
  }
  return out;
}

/** Junta várias geometrias (todas indexadas ou não) em uma só, preparando atributos. */
export function juntar(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prontas = geos.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    for (const nome of Object.keys(x.attributes)) if (nome !== 'position' && nome !== 'normal') x.deleteAttribute(nome);
    x.clearGroups();
    return x;
  });
  const g = mergeGeometries(prontas, false);
  if (!g) throw new Error('falha ao juntar');
  return g;
}

/** Arco de pontos num plano: útil para arames curvos. */
export function arco(cx: number, cy: number, r: number, a0: number, a1: number, n: number, z = 0): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
  }
  return pts;
}

export const PI = Math.PI;
