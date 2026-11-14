// Peças finas dos pescados: lâmina com espessura (nadadeiras, leque de cauda,
// patas achatadas), olho de peixe com íris, pupila e brilho, e um ruído por
// vértice que sugere escamas e grânulos sem pesar na malha.
import * as THREE from 'three';
import { torno, mix, clamp, suave, ruido, PI, type RGB } from './nucleo';

/* ------------------------------------------------------------------ */
/* Lâmina: grade (s ao longo da raiz, r da raiz até a borda) com duas   */
/* faces separadas pela espessura e uma tira fechando a borda           */
/* ------------------------------------------------------------------ */

export interface OpcLamina {
  /** Divisões ao longo da raiz (s) e da raiz para a borda (r). */
  ns: number;
  nr: number;
  /** Ponto da superfície média. */
  P: (s: number, r: number) => THREE.Vector3;
  /** Normal unitária do plano da lâmina. */
  N: (s: number, r: number) => THREE.Vector3;
  /** Espessura total no ponto. */
  esp: (s: number, r: number) => number;
  /** Cor no ponto; f = 1 na face do lado +N, -1 na do lado -N. */
  cor: (s: number, r: number, p: THREE.Vector3, f: number) => RGB;
  /** Amplitude das pregas entre raios (sanfona das nadadeiras). */
  pregas?: number;
  /** Número de raios (uma prega por raio). */
  raios?: number;
  /** Fecha também a raiz (quando ela não fica enterrada no corpo). */
  fecharRaiz?: boolean;
}

export function lamina(o: OpcLamina): THREE.BufferGeometry {
  const { ns, nr } = o;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const nv = (ns + 1) * (nr + 1);
  const q = new THREE.Vector3();
  for (const f of [1, -1]) {
    for (let i = 0; i <= ns; i++) {
      for (let j = 0; j <= nr; j++) {
        const s = i / ns, r = j / nr;
        const p = o.P(s, r);
        const n = o.N(s, r);
        const pl = o.pregas && o.raios ? o.pregas * Math.sin(2 * PI * s * o.raios) * r ** 0.7 : 0;
        q.copy(p).addScaledVector(n, pl + (f * o.esp(s, r)) / 2);
        const c = o.cor(s, r, q, f);
        pos.push(q.x, q.y, q.z);
        col.push(clamp(c[0]), clamp(c[1]), clamp(c[2]));
      }
    }
  }
  // orientação: ds x dr deve apontar para +N na face da frente
  const a = o.P(0.5, 0.5), b = o.P(0.56, 0.5), c = o.P(0.5, 0.56);
  const cr = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a));
  const vira = cr.dot(o.N(0.5, 0.5)) < 0;
  const id = (i: number, j: number, f: number) => f * nv + i * (nr + 1) + j;
  const tri = (x: number, y: number, z: number, inv: boolean) => (inv ? idx.push(x, z, y) : idx.push(x, y, z));
  for (let f = 0; f < 2; f++) {
    const inv = vira !== (f === 1);
    for (let i = 0; i < ns; i++) {
      for (let j = 0; j < nr; j++) {
        const A = id(i, j, f), B = id(i + 1, j, f), C = id(i, j + 1, f), D = id(i + 1, j + 1, f);
        tri(A, B, D, inv);
        tri(A, D, C, inv);
      }
    }
  }
  // borda: s = 0, r = 1, s = 1 (e a raiz, se pedido), virada para fora
  const laco: [number, number][] = [];
  for (let j = 0; j <= nr; j++) laco.push([0, j]);
  for (let i = 1; i <= ns; i++) laco.push([i, nr]);
  for (let j = nr - 1; j >= 0; j--) laco.push([ns, j]);
  if (o.fecharRaiz) for (let i = ns - 1; i >= 0; i--) laco.push([i, 0]);
  for (let k = 0; k < laco.length - 1; k++) {
    const [i1, j1] = laco[k], [i2, j2] = laco[k + 1];
    const F1 = id(i1, j1, 0), F2 = id(i2, j2, 0), B1 = id(i1, j1, 1), B2 = id(i2, j2, 1);
    if (vira) idx.push(F1, B2, F2, F1, B1, B2);
    else idx.push(F1, F2, B2, F1, B2, B1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Olho de peixe: cúpula com anéis concêntricos (aro, íris, pupila)     */
/* e um ponto de brilho; olha para +Z antes de orientar                 */
/* ------------------------------------------------------------------ */

export function olhoPeixe(r: number, iris: RGB, aro: RGB, o: { pupila?: number; n?: number; m?: number } = {}): THREE.BufferGeometry {
  const pup = o.pupila ?? 0.6;
  const PUP: RGB = [0.008, 0.01, 0.014];
  const BR: RGB = [0.95, 0.95, 0.95];
  const g = torno({
    n: o.n ?? 10, m: o.m ?? 18,
    caminho: (s) => {
      const th = s * PI;
      return [r * Math.sin(th), -Math.cos(th) * (th < PI / 2 ? r * 0.6 : r * 0.42)];
    },
    cor: (x, y, z) => {
      if (y < 0) return aro;
      const d = Math.hypot(x, z) / r;
      let c = mix(PUP, iris, suave(pup - 0.04, pup + 0.04, d));
      // íris com raias radiais e escurecendo para fora
      c = mix(c, mix(iris, aro, 0.5), suave(0.72, 0.9, d));
      c = mix(c, aro, suave(0.9, 0.98, d));
      // brilho da córnea
      const hb = Math.hypot(x / r - 0.22, z / r + 0.24);
      return mix(c, BR, (1 - suave(0.05, 0.24, hb)) * 0.55);
    },
  });
  g.rotateX(PI / 2);
  return g;
}

/** Orienta uma geometria que olha para +Z para olhar na direção n e a põe em p. */
export function apontar(g: THREE.BufferGeometry, n: THREE.Vector3, p: THREE.Vector3): THREE.BufferGeometry {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize());
  g.applyQuaternion(q);
  g.translate(p.x, p.y, p.z);
  return g;
}

/** Ruído quase independente por vértice (frequência acima da malha): brilho de escama. */
export function cintila(x: number, y: number, z: number, f: number, s = 0): number {
  return ruido(x * f + 0.31, y * f + 0.17, z * f + 0.73, s + 101);
}
