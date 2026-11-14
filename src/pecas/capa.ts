// Capa que envolve a peça: folha de uva, de bananeira ou de repolho, massa, bacon, alho-poró,
// papel-manteiga, alumínio, nori. Começa esticada embaixo da peça e enrola em volta dela.
import * as THREE from 'three';
import type { Peca } from './peca';

const CAPAS: [RegExp, string, string, number][] = [
  // [texto, cor, segunda cor (veios/listras), metalness]
  [/alum[ií]nio/, '#c9ced6', '#aeb4bd', 0.8],
  [/papel[- ]manteiga|papel vegetal|papillote|papel/, '#f3efe4', '#e8e2d2', 0],
  [/nori|alga/, '#22331f', '#2f4529', 0],
  [/bacon|toucinho|presunto|panceta|pancetta|lardo/, '#e9a3a0', '#fbefe8', 0],
  [/alho[- ]?por[oó]|cebolinha/, '#a8c97a', '#e7f0c8', 0],
  [/bananeira/, '#3f7a35', '#5c9a48', 0],
  [/uva|parreira/, '#5f8a3a', '#7da452', 0],
  [/repolho|couve|acelga|alface|espinafre/, '#8fbf63', '#d4e8b0', 0],
  [/filo|folhada|massa|pastel|crepe|tortilha|wonton|ravi/, '#f1dcaa', '#e6c98c', 0],
  [/folha/, '#6c9a45', '#8db866', 0],
];

export function capaDoTexto(texto: string) {
  const t = texto.toLowerCase();
  for (const [re, cor, cor2, metal] of CAPAS) if (re.test(t)) return { cor, cor2, metal };
  return null;
}

export class Capa extends THREE.Mesh {
  private base: Float32Array;
  private raio: number;
  private centroY: number;
  /** 0 esticada, 1 enrolada por inteiro. */
  enrolado = 0;

  constructor(peca: Peca, cor: string, cor2: string, metal: number) {
    const L = peca.comprimento * 1.06;
    let r = 0.01;
    let cy = 0;
    for (let i = -8; i <= 8; i++) {
      const s = peca.forma.secao((i / 8) * peca.comprimento * 0.45);
      if (Math.max(s.raioY, s.raioZ) > r) {
        r = Math.max(s.raioY, s.raioZ);
        cy = s.centroY;
      }
    }
    const raio = r * 1.08;
    const perimetro = Math.PI * 2 * raio * 0.92;
    const geo = new THREE.PlaneGeometry(L, perimetro, 24, 40);
    geo.rotateX(-Math.PI / 2);
    // veios ou listras por vértice
    const pos = geo.getAttribute('position');
    const cores = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(cor);
    const c2 = new THREE.Color(cor2);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const veio = Math.abs(Math.sin(z * 90 + Math.sin(x * 40) * 2)) > 0.92 ? 1 : 0;
      c.copy(c1).lerp(c2, veio * 0.7 + 0.08 * Math.sin(x * 70 + z * 50));
      cores.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    super(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: metal > 0.5 ? 0.35 : 0.7, metalness: metal, side: THREE.DoubleSide }));
    this.base = (pos.array as Float32Array).slice();
    this.raio = raio;
    this.centroY = cy;
    this.castShadow = true;
    this.receiveShadow = true;
    this.aplicar();
  }

  /** Dobra a folha em volta do eixo X da peça: raio de curvatura R/k, preservando o comprimento. */
  aplicar() {
    const k = Math.max(0.001, Math.min(1, this.enrolado));
    const Rk = this.raio / k;
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = this.base[i * 3];
      const z = this.base[i * 3 + 2];
      const phi = z / Rk;
      arr[i * 3] = x;
      arr[i * 3 + 1] = 0.0015 + Rk * (1 - Math.cos(phi)) * (this.centroY > 0 ? 1 : 1);
      arr[i * 3 + 2] = Rk * Math.sin(phi);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  descartar() {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
  }
}
