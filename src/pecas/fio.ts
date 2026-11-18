// Fio contínuo de líquido (água, caldo, calda, clara) caindo de um ponto até outro, no lugar de gotinhas soltas.
import * as THREE from 'three';

/**
 * Um tubo que desce da boca do recipiente até a superfície de destino, curvando um pouco com a velocidade
 * de saída, mais grosso em cima e afinando embaixo, com leve ondulação para parecer líquido escorrendo.
 */
export class Fio extends THREE.Mesh {
  private t = 0;
  private readonly segs = 16;
  constructor(cor: THREE.ColorRepresentation, translucido = true) {
    super(
      new THREE.CylinderGeometry(1, 1, 1, 10, 16, true),
      new THREE.MeshStandardMaterial({ color: cor, roughness: 0.08, metalness: 0, transparent: translucido, opacity: translucido ? 0.78 : 1, side: THREE.DoubleSide, depthWrite: !translucido }),
    );
    this.visible = false;
    this.frustumCulled = false;
  }

  /** Mostra o fio de `de` até `ate`, com espessura `raio` (0 esconde). `saida` empurra a curva para o lado. */
  atualizar(de: THREE.Vector3, ate: THREE.Vector3, raio: number, dt: number, saida = new THREE.Vector3()) {
    this.t += dt;
    if (raio <= 0.0002 || de.y <= ate.y) {
      this.visible = false;
      return;
    }
    this.visible = true;
    const geo = this.geometry as THREE.CylinderGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const base = (geo.userData.base as Float32Array | undefined) ?? (geo.userData.base = (pos.array as Float32Array).slice());
    const altura = de.y - ate.y;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      // by vai de 0,5 (em cima) a -0,5 (embaixo)
      const u = 0.5 - by;
      // trajetória: sai com a velocidade de saída e cai em parábola
      const centro = new THREE.Vector3().lerpVectors(de, ate, u);
      centro.addScaledVector(saida, Math.sin(u * Math.PI) * 0.6 * (1 - u));
      // afina descendo (o líquido acelera) e ondula de leve
      const r = raio * (1 - 0.45 * u) * (1 + 0.08 * Math.sin(this.t * 18 + u * 25));
      pos.setXYZ(i, centro.x + bx * r, de.y - u * altura, centro.z + bz * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // a geometria já está em coordenadas do mundo
    this.position.set(0, 0, 0);
    void this.segs;
  }

  descartar() {
    this.removeFromParent();
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
  }
}
