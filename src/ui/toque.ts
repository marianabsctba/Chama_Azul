// Controles de toque para celular e tablet: joystick para andar, botão do caderno,
// e no trabalho os botões − e + (no lugar da roda do mouse) e ⏩ (no lugar do Espaço).
import type { Entrada } from '../motor/entrada';

export const ehToque = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

/** Repete uma ação enquanto o dedo segura o botão. */
function segurar(b: HTMLElement, aoApertar: () => void, aoSoltar?: () => void, repetir = 0) {
  let t: number | undefined;
  const parar = (e?: Event) => {
    e?.preventDefault();
    if (t) clearInterval(t);
    t = undefined;
    b.classList.remove('ativo');
    aoSoltar?.();
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    b.classList.add('ativo');
    aoApertar();
    if (repetir) t = window.setInterval(aoApertar, repetir);
  });
  b.addEventListener('pointerup', parar);
  b.addEventListener('pointercancel', parar);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

export class ControlesToque {
  readonly andar: HTMLElement;
  readonly trabalho: HTMLElement;
  readonly btnCaderno: HTMLButtonElement;

  constructor(pai: HTMLElement, entrada: Entrada, abrirCaderno: () => void) {
    // joystick
    this.andar = el('div', 'toque-andar oculto');
    const base = el('div', 'joystick');
    const pino = el('div', 'joystick-pino');
    base.append(pino);
    let id = -1;
    let centro = { x: 0, y: 0 };
    const raio = 48;
    const mover = (x: number, y: number) => {
      let dx = x - centro.x;
      let dy = y - centro.y;
      const d = Math.hypot(dx, dy);
      if (d > raio) {
        dx = (dx / d) * raio;
        dy = (dy / d) * raio;
      }
      pino.style.transform = `translate(${dx}px, ${dy}px)`;
      entrada.analogico.set(dx / raio, dy / raio);
    };
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      const r = base.getBoundingClientRect();
      centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      mover(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) mover(e.clientX, e.clientY);
    });
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      pino.style.transform = '';
      entrada.analogico.set(0, 0);
    };
    base.addEventListener('pointerup', soltar);
    base.addEventListener('pointercancel', soltar);
    this.btnCaderno = el('button', 'botao principal toque-caderno', 'Caderno');
    this.btnCaderno.addEventListener('click', abrirCaderno);
    this.andar.append(base, this.btnCaderno);

    // trabalho: − + e acelerar o tempo
    this.trabalho = el('div', 'toque-trabalho oculto');
    const menos = el('button', 'toque-btn', '−');
    const mais = el('button', 'toque-btn', '+');
    const rapido = el('button', 'toque-btn largo', '⏩ Acelerar');
    menos.setAttribute('aria-label', 'Diminuir');
    mais.setAttribute('aria-label', 'Aumentar');
    segurar(menos, () => {
      entrada.roda += 1;
    }, undefined, 140);
    segurar(mais, () => {
      entrada.roda -= 1;
    }, undefined, 140);
    segurar(rapido, () => entrada.teclas.add(' '), () => entrada.teclas.delete(' '));
    this.trabalho.append(menos, mais, rapido);
    pai.append(this.andar, this.trabalho);
  }

  mostrar(modo: 'nada' | 'andar' | 'trabalho') {
    this.andar.classList.toggle('oculto', modo !== 'andar');
    this.trabalho.classList.toggle('oculto', modo !== 'trabalho');
  }
}

/** Troca as instruções de mouse e teclado por instruções de toque. */
export function textoParaToque(t: string): string {
  return t
    .replace(/com a roda do mouse \(ou Q e E\)/g, 'com os botões − e +')
    .replace(/com a roda do mouse \(ou Q e E, ou arrastando para cima e para baixo\)/g, 'com os botões − e +, ou arrastando para cima e para baixo')
    .replace(/a roda do mouse \(ou Q e E\)/g, 'os botões − e +')
    .replace(/[Rr]oda do mouse gira a peça\.?/g, 'Arraste com dois dedos para girar a peça.')
    .replace(/[Rr]oda do mouse controla a chama/g, 'Os botões − e + controlam a chama')
    .replace(/girando a massa às vezes com a roda do mouse/g, 'girando a massa às vezes')
    .replace(/Segure Espaço/g, 'Segure ⏩')
    .replace(/Segure o botão/g, 'Encoste e segure o dedo')
    .replace(/Segure e /g, 'Encoste, segure e ')
    .replace(/suba o mouse/g, 'suba o dedo')
    .replace(/puxe o mouse/g, 'puxe o dedo')
    .replace(/sacuda o mouse/g, 'sacuda o dedo')
    .replace(/leve o mouse/g, 'leve o dedo')
    .replace(/o mouse/g, 'o dedo')
    .replace(/Clique/g, 'Toque')
    .replace(/clique/g, 'toque');
}
