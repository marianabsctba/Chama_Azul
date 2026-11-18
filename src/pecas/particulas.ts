// Partículas leves com InstancedMesh: vapor, bolhas, lascas de casca, pó, respingos.
import * as THREE from 'three';

interface P {
  vivo: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  vida: number;
  total: number;
  tam: number;
  gravidade: number;
  cresce: number;
}

const geoEsfera = new THREE.IcosahedronGeometry(1, 1);
const geoLasca = new THREE.BoxGeometry(1, 0.15, 0.5);

export class Particulas extends THREE.InstancedMesh {
  private ps: P[] = [];
  private proxima = 0;
  private aux = new THREE.Object3D();

  constructor(cor: THREE.ColorRepresentation, max = 160, tipo: 'esfera' | 'lasca' = 'esfera', opacidade = 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: cor,
      roughness: 0.6,
      transparent: opacidade < 1,
      opacity: opacidade,
      depthWrite: opacidade >= 1,
    });
    super(tipo === 'esfera' ? geoEsfera : geoLasca, mat, max);
    this.frustumCulled = false;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) {
      this.ps.push({ vivo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0, total: 1, tam: 0.01, gravidade: 0, cresce: 0 });
    }
    this.count = max;
    this.atualizar(0);
  }

  definirCor(c: THREE.ColorRepresentation) {
    (this.material as THREE.MeshStandardMaterial).color.set(c);
  }

  emitir(pos: THREE.Vector3, vel: THREE.Vector3, opcoes: { vida?: number; tam?: number; gravidade?: number; espalhar?: number; cresce?: number } = {}) {
    const p = this.ps[this.proxima];
    this.proxima = (this.proxima + 1) % this.ps.length;
    const e = opcoes.espalhar ?? 0.3;
    p.vivo = true;
    p.pos.copy(pos);
    p.vel.copy(vel).add(new THREE.Vector3((Math.random() - 0.5) * e, (Math.random() - 0.5) * e, (Math.random() - 0.5) * e).multiplyScalar(vel.length() + 0.05));
    p.total = p.vida = opcoes.vida ?? 1;
    p.tam = (opcoes.tam ?? 0.006) * (0.7 + Math.random() * 0.6);
    p.gravidade = opcoes.gravidade ?? -9.8;
    p.cresce = opcoes.cresce ?? 0;
  }

  atualizar(dt: number) {
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      if (p.vivo) {
        p.vida -= dt;
        if (p.vida <= 0) p.vivo = false;
        p.vel.y += p.gravidade * dt;
        p.vel.multiplyScalar(1 - Math.min(1, dt * 0.8));
        p.pos.addScaledVector(p.vel, dt);
      }
      const f = p.vivo ? p.vida / p.total : 0;
      const s = p.vivo ? p.tam * (1 + p.cresce * (1 - f)) * Math.min(1, f * 4) : 0;
      this.aux.position.copy(p.pos);
      this.aux.rotation.set(p.pos.x * 50, p.pos.z * 40, 0);
      this.aux.scale.setScalar(s);
      this.aux.updateMatrix();
      this.setMatrixAt(i, this.aux.matrix);
    }
    this.instanceMatrix.needsUpdate = true;
  }

  descartar() {
    this.removeFromParent();
    (this.material as THREE.Material).dispose();
    this.dispose();
  }
}
