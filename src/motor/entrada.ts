// Mouse, toque e teclado num só lugar.
import * as THREE from 'three';

export class Entrada {
  readonly ndc = new THREE.Vector2();
  readonly px = new THREE.Vector2();
  readonly deltaPx = new THREE.Vector2();
  /** Deslocamento do mouse com o ponteiro travado (olhar em primeira pessoa). */
  readonly olhar = new THREE.Vector2();
  pressionado = false;
  cliqueNovo = false;
  /** Joystick virtual (x para os lados, y para trás), de -1 a 1. */
  readonly analogico = new THREE.Vector2();
  /** Verdadeiro depois do primeiro toque na tela. */
  toque = false;
  soltouNovo = false;
  roda = 0;
  readonly teclas = new Set<string>();
  readonly teclasNovas = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    // dedos na tela: um dedo é a mão; dois dedos arrastando de lado giram a peça (como a roda do mouse)
    const dedos = new Map<number, { x: number; y: number }>();
    let giroDedos = 0;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && dedos.has(e.pointerId)) {
        const ant = dedos.get(e.pointerId)!;
        if (dedos.size >= 2) {
          giroDedos += (e.clientX - ant.x) / dedos.size;
          while (Math.abs(giroDedos) > 36) {
            this.roda += giroDedos > 0 ? 1 : -1;
            giroDedos -= Math.sign(giroDedos) * 36;
          }
        }
        dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (dedos.size >= 2) return;
      }
      this.atualizarPos(e.clientX, e.clientY);
      if (document.pointerLockElement === el) this.olhar.x += e.movementX, this.olhar.y += e.movementY;
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch') {
        this.toque = true;
        dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (dedos.size >= 2) {
          // segundo dedo: cancela a mão para não riscar sem querer
          if (this.pressionado) this.soltouNovo = true;
          this.pressionado = false;
          giroDedos = 0;
          return;
        }
      }
      this.atualizarPos(e.clientX, e.clientY);
      this.deltaPx.set(0, 0);
      this.pressionado = true;
      this.cliqueNovo = true;
      el.setPointerCapture?.(e.pointerId);
    });
    const soltar = (e: PointerEvent) => {
      const eraGiro = dedos.size >= 2;
      dedos.delete(e.pointerId);
      if (eraGiro) return;
      if (this.pressionado) this.soltouNovo = true;
      this.pressionado = false;
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('wheel', (e) => {
      this.roda += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!this.teclas.has(k)) this.teclasNovas.add(k);
      this.teclas.add(k);
      if (k === ' ' || k === 'tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.teclas.clear();
      this.pressionado = false;
    });
  }

  private atualizarPos(x: number, y: number) {
    const r = this.el.getBoundingClientRect();
    const nx = x - r.left;
    const ny = y - r.top;
    this.deltaPx.x += nx - this.px.x;
    this.deltaPx.y += ny - this.px.y;
    this.px.set(nx, ny);
    this.ndc.set((nx / r.width) * 2 - 1, -(ny / r.height) * 2 + 1);
  }

  /** Limpa os eventos de borda; chamar no fim de cada quadro. */
  fimDoQuadro() {
    this.cliqueNovo = false;
    this.soltouNovo = false;
    this.roda = 0;
    this.deltaPx.set(0, 0);
    this.olhar.set(0, 0);
    this.teclasNovas.clear();
  }

  apertou(k: string) {
    return this.teclasNovas.has(k);
  }

  raio(camera: THREE.Camera) {
    this.raycaster.setFromCamera(this.ndc, camera);
    return this.raycaster;
  }

  /** Ponto onde o raio do mouse cruza o plano horizontal y. */
  noPlano(camera: THREE.Camera, y: number, alvo = new THREE.Vector3()): THREE.Vector3 | null {
    const r = this.raio(camera);
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    return r.ray.intersectPlane(plano, alvo);
  }

  /** Ponto onde o raio cruza um plano qualquer. */
  noPlanoQualquer(camera: THREE.Camera, plano: THREE.Plane, alvo = new THREE.Vector3()) {
    return this.raio(camera).ray.intersectPlane(plano, alvo);
  }

  tamanho() {
    const r = this.el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
}
