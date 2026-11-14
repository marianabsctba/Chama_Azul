// Primeira pessoa: andar pela cozinha (WASD + mouse) e voo suave até a estação de trabalho.
import * as THREE from 'three';
import type { Entrada } from './entrada';

export type ModoCamera = 'andar' | 'trabalho' | 'vitrine' | 'livre';

export class Jogador {
  readonly camera: THREE.PerspectiveCamera;
  modo: ModoCamera = 'vitrine';
  private yaw = 0;
  private pitch = 0;
  private colisores: THREE.Box3[] = [];
  private altura = 1.65;
  private raioCorpo = 0.28;
  sensibilidade = 0.0022;
  // voo da câmera
  private vooDe = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private vooPara = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private vooT = 1;
  private vooDur = 1.1;
  private aoChegar: (() => void) | null = null;
  /** Leve deslocamento do olhar no modo trabalho, seguindo o mouse (sensação de cabeça viva). */
  private olharBase = new THREE.Quaternion();
  private balanco = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  definirColisores(c: THREE.Box3[]) {
    this.colisores = c;
  }

  posicionar(pos: THREE.Vector3, olhar: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.camera.position.y = this.altura;
    const d = olhar.clone().sub(pos);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.aplicarRotacao();
  }

  private aplicarRotacao() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  /** Voa até um ponto olhando para outro. */
  voar(pos: THREE.Vector3, olhar: THREE.Vector3, dur = 1.1, aoChegar?: () => void) {
    this.vooDe.pos.copy(this.camera.position);
    this.vooDe.quat.copy(this.camera.quaternion);
    this.vooPara.pos.copy(pos);
    const m = new THREE.Matrix4().lookAt(pos, olhar, new THREE.Vector3(0, 1, 0));
    this.vooPara.quat.setFromRotationMatrix(m);
    this.vooT = 0;
    this.vooDur = dur;
    this.aoChegar = aoChegar ?? null;
  }

  get voando() {
    return this.vooT < 1;
  }

  /** Volta ao modo andar a partir da posição atual, recuando um pouco da bancada. */
  voltarAAndar(recuo: THREE.Vector3) {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y;
    this.pitch = Math.max(-0.6, Math.min(0.3, e.x));
    const destino = this.camera.position.clone().add(recuo);
    destino.y = this.altura;
    const olhar = destino.clone().add(new THREE.Vector3(-Math.sin(this.yaw), Math.tan(this.pitch), -Math.cos(this.yaw)));
    this.voar(destino, olhar, 0.7, () => {
      this.modo = 'andar';
      const e2 = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = e2.y;
      this.pitch = e2.x;
    });
  }

  atualizar(dt: number, entrada: Entrada, travado: boolean) {
    if (this.vooT < 1) {
      this.vooT = Math.min(1, this.vooT + dt / this.vooDur);
      const k = this.vooT < 0.5 ? 4 * this.vooT ** 3 : 1 - (-2 * this.vooT + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.vooDe.pos, this.vooPara.pos, k);
      // arco leve no meio do voo
      this.camera.position.y += Math.sin(k * Math.PI) * 0.12;
      this.camera.quaternion.slerpQuaternions(this.vooDe.quat, this.vooPara.quat, k);
      if (this.vooT >= 1) {
        this.olharBase.copy(this.camera.quaternion);
        const f = this.aoChegar;
        this.aoChegar = null;
        f?.();
      }
      return;
    }
    if (this.modo === 'andar') {
      if (travado) {
        this.yaw -= entrada.olhar.x * this.sensibilidade;
        this.pitch -= entrada.olhar.y * this.sensibilidade;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
      }
      // no toque, arrastar o dedo na tela olha em volta
      if (!travado && entrada.toque && entrada.pressionado) {
        this.yaw -= entrada.deltaPx.x * 0.005;
        this.pitch -= entrada.deltaPx.y * 0.005;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
      }
      // setas também giram (acessibilidade e quem não quer travar o mouse)
      if (entrada.teclas.has('arrowleft')) this.yaw += dt * 1.8;
      if (entrada.teclas.has('arrowright')) this.yaw -= dt * 1.8;
      this.aplicarRotacao();
      const frente = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const lado = new THREE.Vector3(-frente.z, 0, frente.x);
      const mov = new THREE.Vector3();
      if (entrada.teclas.has('w') || entrada.teclas.has('arrowup')) mov.add(frente);
      if (entrada.teclas.has('s') || entrada.teclas.has('arrowdown')) mov.sub(frente);
      if (entrada.teclas.has('d')) mov.add(lado);
      if (entrada.teclas.has('a')) mov.sub(lado);
      // joystick virtual
      if (entrada.analogico.lengthSq() > 0.01) mov.addScaledVector(frente, -entrada.analogico.y).addScaledVector(lado, entrada.analogico.x);
      if (mov.lengthSq() > 0) {
        const forca = Math.min(1, mov.length());
        mov.normalize().multiplyScalar(dt * (entrada.teclas.has('shift') ? 2.6 : 1.6) * (entrada.analogico.lengthSq() > 0.01 ? forca : 1));
        this.balanco += dt * 9;
        this.mover(mov);
      }
      this.camera.position.y = this.altura + Math.sin(this.balanco) * 0.012;
    } else if (this.modo === 'trabalho') {
      // a cabeça acompanha o mouse um tiquinho
      const alvo = this.olharBase.clone().multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(entrada.ndc.y * 0.025, -entrada.ndc.x * 0.035, 0, 'YXZ')),
      );
      this.camera.quaternion.slerp(alvo, 1 - Math.exp(-dt * 4));
    }
  }

  private mover(d: THREE.Vector3) {
    const p = this.camera.position;
    for (const eixo of ['x', 'z'] as const) {
      const novo = p.clone();
      novo[eixo] += d[eixo];
      if (!this.colide(novo)) p[eixo] = novo[eixo];
    }
  }

  private colide(p: THREE.Vector3) {
    for (const b of this.colisores) {
      if (p.x > b.min.x - this.raioCorpo && p.x < b.max.x + this.raioCorpo && p.z > b.min.z - this.raioCorpo && p.z < b.max.z + this.raioCorpo && b.max.y > 0.3) return true;
    }
    return false;
  }

  /** Para onde o jogador está olhando (raio do centro da tela). */
  direcao() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }
}
