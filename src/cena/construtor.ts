// Acumula geometria estática por material (com cor por vértice) e junta tudo no fim,
// para que a cozinha inteira saia em poucas chamadas de desenho.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Cor = THREE.ColorRepresentation | [number, number, number];

const ATRIBUTOS = ['position', 'normal', 'uv'];

export function M(
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
}

function paraCor(c: Cor): THREE.Color {
  if (Array.isArray(c)) return new THREE.Color(c[0], c[1], c[2]);
  return new THREE.Color(c);
}

export class Construtor {
  private grupos = new Map<string, THREE.BufferGeometry[]>();
  private pilha: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get base(): THREE.Matrix4 {
    return this.pilha[this.pilha.length - 1];
  }

  /** Executa `f` com a matriz `m` aplicada sobre a atual (montagem em espaço local). */
  com(m: THREE.Matrix4, f: () => void): void {
    this.pilha.push(this.base.clone().multiply(m));
    f();
    this.pilha.pop();
  }

  /** Adiciona uma geometria (é clonada) ao grupo do material `chave`. */
  add(chave: string, geo: THREE.BufferGeometry, cor: Cor = 0xffffff, m?: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const nome of Object.keys(g.attributes)) {
      if (!ATRIBUTOS.includes(nome)) g.deleteAttribute(nome);
    }
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const mat = this.base.clone();
    if (m) mat.multiply(m);
    g.applyMatrix4(mat);
    const c = paraCor(cor);
    const cores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cores[i * 3] = c.r;
      cores[i * 3 + 1] = c.g;
      cores[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    g.morphAttributes = {};
    let lista = this.grupos.get(chave);
    if (!lista) {
      lista = [];
      this.grupos.set(chave, lista);
    }
    lista.push(g);
  }

  caixa(chave: string, cor: Cor, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): void {
    this.add(chave, new THREE.BoxGeometry(sx, sy, sz), cor, M(x, y, z, 0, ry));
  }

  /** Caixa definida pelos cantos mínimo e máximo. */
  bloco(chave: string, cor: Cor, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.add(
      chave,
      new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
      cor,
      M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    );
  }

  cilindro(chave: string, cor: Cor, x: number, y: number, z: number, r: number, h: number, seg = 16, rTopo?: number, aberto = false): void {
    this.add(chave, new THREE.CylinderGeometry(rTopo ?? r, r, h, seg, 1, aberto), cor, M(x, y, z));
  }

  esfera(chave: string, cor: Cor, x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1, det = 1): void {
    this.add(chave, new THREE.IcosahedronGeometry(r, det), cor, M(x, y, z, 0, 0, 0, sx, sy, sz));
  }

  /**
   * Retângulo plano com UV em coordenadas de mundo divididas por `ladrilho`,
   * para texturas repetidas continuarem certinhas entre pedaços de parede.
   * `cantos` em ordem anti-horária vista pela frente.
   */
  retangulo(chave: string, cantos: THREE.Vector3[], normal: THREE.Vector3, uvs: [number, number][], cor: Cor = 0xffffff): void {
    const g = new THREE.BufferGeometry();
    const p = [cantos[0], cantos[1], cantos[2], cantos[0], cantos[2], cantos[3]];
    const u = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(p.flatMap(() => [normal.x, normal.y, normal.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u.flat(), 2));
    this.add(chave, g, cor);
  }

  /** Parede vertical no plano z = fixo (normal +z ou -z), de a0 a a1 em x e y0 a y1. */
  paredeZ(chave: string, z: number, sinal: 1 | -1, x0: number, x1: number, y0: number, y1: number, ladrilho = 1, cor: Cor = 0xffffff): void {
    const V = (x: number, y: number) => new THREE.Vector3(x, y, z);
    const uv = (x: number, y: number): [number, number] => [x / ladrilho, y / ladrilho];
    if (sinal > 0) {
      this.retangulo(chave, [V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)], new THREE.Vector3(0, 0, 1), [uv(x0, y0), uv(x1, y0), uv(x1, y1), uv(x0, y1)], cor);
    } else {
      this.retangulo(chave, [V(x1, y0), V(x0, y0), V(x0, y1), V(x1, y1)], new THREE.Vector3(0, 0, -1), [uv(-x1, y0), uv(-x0, y0), uv(-x0, y1), uv(-x1, y1)], cor);
    }
  }

  /** Parede vertical no plano x = fixo, de z0 a z1 e y0 a y1. */
  paredeX(chave: string, x: number, sinal: 1 | -1, z0: number, z1: number, y0: number, y1: number, ladrilho = 1, cor: Cor = 0xffffff): void {
    const V = (z: number, y: number) => new THREE.Vector3(x, y, z);
    const uv = (s: number, y: number): [number, number] => [s / ladrilho, y / ladrilho];
    if (sinal > 0) {
      this.retangulo(chave, [V(z1, y0), V(z0, y0), V(z0, y1), V(z1, y1)], new THREE.Vector3(1, 0, 0), [uv(-z1, y0), uv(-z0, y0), uv(-z0, y1), uv(-z1, y1)], cor);
    } else {
      this.retangulo(chave, [V(z0, y0), V(z1, y0), V(z1, y1), V(z0, y1)], new THREE.Vector3(-1, 0, 0), [uv(z0, y0), uv(z1, y0), uv(z1, y1), uv(z0, y1)], cor);
    }
  }

  /** Plano horizontal em y, voltado para cima (+1) ou para baixo (-1). */
  plano(chave: string, y: number, sinal: 1 | -1, x0: number, x1: number, z0: number, z1: number, ladrilho = 1, cor: Cor = 0xffffff): void {
    const V = (x: number, z: number) => new THREE.Vector3(x, y, z);
    const uv = (x: number, z: number): [number, number] => [x / ladrilho, -z / ladrilho];
    if (sinal > 0) {
      this.retangulo(chave, [V(x0, z1), V(x1, z1), V(x1, z0), V(x0, z0)], new THREE.Vector3(0, 1, 0), [uv(x0, z1), uv(x1, z1), uv(x1, z0), uv(x0, z0)], cor);
    } else {
      this.retangulo(chave, [V(x0, z0), V(x1, z0), V(x1, z1), V(x0, z1)], new THREE.Vector3(0, -1, 0), [uv(x0, z0), uv(x1, z0), uv(x1, z1), uv(x0, z1)], cor);
    }
  }

  /** Junta cada grupo numa única malha. */
  construir(materiais: Record<string, THREE.Material>): THREE.Mesh[] {
    const malhas: THREE.Mesh[] = [];
    for (const [chave, lista] of this.grupos) {
      const mat = materiais[chave];
      if (!mat) throw new Error('material ausente: ' + chave);
      const g = mergeGeometries(lista, false);
      if (!g) throw new Error('falha ao juntar ' + chave);
      lista.forEach((x) => x.dispose());
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat);
      m.name = 'cozinha_' + chave;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      malhas.push(m);
    }
    return malhas;
  }

  /** Junta só um grupo numa geometria (para malhas instanciadas). */
  geometria(chave: string): THREE.BufferGeometry {
    const lista = this.grupos.get(chave) ?? [];
    const g = mergeGeometries(lista, false);
    if (!g) throw new Error('falha ao juntar ' + chave);
    this.grupos.delete(chave);
    return g;
  }
}
