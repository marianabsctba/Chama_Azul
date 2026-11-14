// Texturas desenhadas por código em CanvasTexture: azulejos, piso, mármore e um atlas
// com quadro-negro, páginas de livro, mostrador de relógio e de balança.
import * as THREE from 'three';

function tela(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponível');
  return [c, ctx];
}

/** Gerador pseudoaleatório determinístico para que a cozinha seja sempre igual. */
export function sorteador(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finalizar(c: HTMLCanvasElement, repetir: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Leve granulado para não parecer plástico. */
function granular(ctx: CanvasRenderingContext2D, w: number, h: number, forca: number, semente: number): void {
  const r = sorteador(semente);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * forca;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Azulejo português azul e branco. Um azulejo por textura; os quartos de motivo nos
 * cantos e nas bordas se completam com os vizinhos e formam o padrão maior.
 */
export function texturaAzulejoPortugues(): THREE.CanvasTexture {
  const T = 256;
  const [c, ctx] = tela(T, T);
  const azul = '#1d4796';
  const azulClaro = '#5b82c6';
  ctx.fillStyle = '#f3f0e6';
  ctx.fillRect(0, 0, T, T);
  const m = T / 2;

  // Aguada clara de fundo, como pincelada de cobalto diluído.
  ctx.fillStyle = 'rgba(91,130,198,0.16)';
  ctx.beginPath();
  ctx.arc(m, m, T * 0.36, 0, Math.PI * 2);
  ctx.fill();

  // Cantos: quartos de círculo que viram rosáceas com os vizinhos.
  for (const [cx, cy] of [[0, 0], [T, 0], [0, T], [T, T]]) {
    ctx.fillStyle = azul;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3f0e6';
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = azulClaro;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = azul;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * T * 0.1, cy + Math.sin(a) * T * 0.1, T * 0.05, T * 0.022, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f3f0e6';
    ctx.beginPath();
    ctx.arc(cx, cy, T * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }

  // Meio das bordas: meias folhas que formam losangos.
  ctx.fillStyle = azul;
  for (const [cx, cy, rot] of [[m, 0, 0], [m, T, 0], [0, m, Math.PI / 2], [T, m, Math.PI / 2]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-T * 0.08, 0);
    ctx.quadraticCurveTo(0, T * 0.09, T * 0.08, 0);
    ctx.quadraticCurveTo(0, -T * 0.09, -T * 0.08, 0);
    ctx.fill();
    ctx.restore();
  }

  // Volutas ligando os cantos ao centro.
  ctx.strokeStyle = azul;
  ctx.lineWidth = T * 0.022;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(m, m);
    ctx.rotate((k * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(T * 0.12, T * 0.12);
    ctx.bezierCurveTo(T * 0.18, T * 0.02, T * 0.3, T * 0.06, T * 0.27, T * 0.17);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(T * 0.24, T * 0.15, T * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Flor central de oito pétalas.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.fillStyle = k % 2 ? azul : azulClaro;
    ctx.beginPath();
    ctx.ellipse(m + Math.cos(a) * T * 0.09, m + Math.sin(a) * T * 0.09, T * 0.075, T * 0.03, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f3f0e6';
  ctx.beginPath();
  ctx.arc(m, m, T * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = azul;
  ctx.beginPath();
  ctx.arc(m, m, T * 0.018, 0, Math.PI * 2);
  ctx.fill();

  // Contas em volta da flor.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(m + Math.cos(a) * T * 0.2, m + Math.sin(a) * T * 0.2, T * 0.011, 0, Math.PI * 2);
    ctx.fill();
  }

  granular(ctx, T, T, 10, 11);

  // Vidrado mais escuro na borda e rejunte.
  const g = ctx.createRadialGradient(m, m, T * 0.3, m, m, T * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(40,50,80,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, T, T);
  ctx.strokeStyle = '#c9c6bd';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, T, T);
  return finalizar(c, true);
}

/** Azulejo liso azul-celeste em formato de tijolinho (15 x 7,5 cm). Textura cobre 0,6 x 0,6 m. */
export function texturaAzulejoCeleste(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = tela(S, S);
  ctx.fillStyle = '#f4f6f4';
  ctx.fillRect(0, 0, S, S);
  const r = sorteador(7);
  const cw = S / 4;
  const ch = S / 8;
  for (let lin = 0; lin < 8; lin++) {
    const desloc = lin % 2 ? cw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * cw + desloc;
      const y = lin * ch;
      const v = r();
      const l = 79 + v * 6;
      ctx.fillStyle = `hsl(${200 + v * 6}, ${62 + v * 10}%, ${l}%)`;
      ctx.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      const g = ctx.createLinearGradient(x, y, x, y + ch);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,30,60,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
    }
  }
  granular(ctx, S, S, 6, 3);
  return finalizar(c, true);
}

/** Ladrilho hidráulico 20 x 20 cm, quatro peças por textura (0,4 x 0,4 m). */
export function texturaPiso(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = tela(S, S);
  const T = S / 2;
  const creme = '#e8dfcb';
  const azul = '#6b88a6';
  const cinza = '#c3ccd0';
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.save();
      ctx.translate(i * T, j * T);
      ctx.fillStyle = creme;
      ctx.fillRect(0, 0, T, T);
      // Quartos de círculo nos cantos formando flor com os vizinhos.
      for (const [cx, cy] of [[0, 0], [T, 0], [0, T], [T, T]]) {
        ctx.fillStyle = azul;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = creme;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cinza;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Estrela de quatro pontas no centro.
      ctx.fillStyle = azul;
      ctx.beginPath();
      const m = T / 2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = k % 2 ? T * 0.07 : T * 0.2;
        const px = m + Math.cos(a) * rr;
        const py = m + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = creme;
      ctx.beginPath();
      ctx.arc(m, m, T * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  granular(ctx, S, S, 22, 5);
  // Desgaste suave e manchas.
  const r = sorteador(19);
  for (let k = 0; k < 40; k++) {
    ctx.fillStyle = `rgba(90,80,60,${0.02 + r() * 0.03})`;
    ctx.beginPath();
    ctx.arc(r() * S, r() * S, 10 + r() * 50, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#9d968a';
  ctx.lineWidth = 3;
  for (let k = 0; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(k * T, 0);
    ctx.lineTo(k * T, S);
    ctx.moveTo(0, k * T);
    ctx.lineTo(S, k * T);
    ctx.stroke();
  }
  return finalizar(c, true);
}

/** Mármore claro com veios cinza-azulados. */
export function texturaMarmore(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const [c, ctx] = tela(W, H);
  ctx.fillStyle = '#ecebe7';
  ctx.fillRect(0, 0, W, H);
  const r = sorteador(23);
  for (let k = 0; k < 60; k++) {
    ctx.fillStyle = `rgba(200,205,215,${0.08 + r() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(r() * W, r() * H, 40 + r() * 120, 20 + r() * 60, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Veios: curvas longas e suaves na diagonal, com ramificações finas.
  const veio = (x: number, y: number, ang: number, comp: number, larg: number, alfa: number, nivel: number) => {
    ctx.strokeStyle = `rgba(120,130,148,${alfa})`;
    ctx.lineWidth = larg;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let a = ang;
    const passo = 6;
    for (let d = 0; d < comp; d += passo) {
      a += (r() - 0.5) * 0.12;
      x += Math.cos(a) * passo;
      y += Math.sin(a) * passo;
      ctx.lineTo(x, y);
      if (nivel < 2 && r() < 0.012) veio(x, y, a + (r() - 0.5) * 1.4, comp * 0.35, larg * 0.5, alfa * 0.8, nivel + 1);
    }
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = 'blur(6px)';
  for (let k = 0; k < 5; k++) veio(r() * W, r() * H, 0.35 + (r() - 0.5) * 0.5, 900, 14, 0.06, 2);
  ctx.filter = 'blur(1px)';
  for (let k = 0; k < 9; k++) veio(-100 + r() * W, r() * H, 0.3 + (r() - 0.5) * 0.6, 500 + r() * 700, 0.8 + r() * 1.6, 0.25 + r() * 0.3, 0);
  ctx.filter = 'none';
  granular(ctx, W, H, 6, 29);
  return finalizar(c, false);
}

/** Regiões do atlas, em pixels do canvas de 1024 x 1024. */
export const ATLAS = {
  largura: 1024,
  altura: 1280,
  madeira: [0, 1024, 1024, 1280] as const,
  quadro: [0, 0, 1024, 512] as const,
  caderno: [0, 512, 512, 832] as const,
  relogio: [512, 512, 768, 768] as const,
  balanca: [768, 512, 1024, 768] as const,
  receita: [512, 768, 1024, 1024] as const,
  lombada: [0, 832, 512, 1024] as const,
};

function paginaLinhas(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, semente: number): void {
  const r = sorteador(semente);
  ctx.strokeStyle = 'rgba(40,55,90,0.55)';
  ctx.lineWidth = 2;
  let y = y0;
  while (y < y0 + h) {
    const comp = w * (0.55 + r() * 0.45);
    ctx.beginPath();
    let x = x0;
    ctx.moveTo(x, y);
    while (x < x0 + comp) {
      const p = 8 + r() * 26;
      ctx.lineTo(x + p, y + (r() - 0.5) * 1.5);
      x += p + 6;
      ctx.moveTo(x, y);
    }
    ctx.stroke();
    y += 16;
  }
}

function papel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#efe6d2');
  g.addColorStop(0.47, '#f8f2e4');
  g.addColorStop(0.5, '#d8ccb2');
  g.addColorStop(0.53, '#f8f2e4');
  g.addColorStop(1, '#efe6d2');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Atlas com quadro-negro, páginas, mostradores. */
export function texturaAtlas(): THREE.CanvasTexture {
  const [c, ctx] = tela(ATLAS.largura, ATLAS.altura);
  const fonteGiz = '"Segoe Print", "Comic Sans MS", "Bradley Hand", cursive';
  const fonteLivro = 'Georgia, "Times New Roman", serif';

  // Quadro-negro.
  ctx.fillStyle = '#26322f';
  ctx.fillRect(0, 0, 1024, 512);
  const r = sorteador(41);
  for (let k = 0; k < 50; k++) {
    ctx.fillStyle = `rgba(220,230,225,${0.015 + r() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(r() * 1024, r() * 512, 40 + r() * 160, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(245,245,238,0.94)';
  ctx.textAlign = 'center';
  ctx.font = `bold 128px ${fonteGiz}`;
  ctx.fillText('Chama Azul', 540, 190);
  ctx.font = `44px ${fonteGiz}`;
  ctx.fillStyle = 'rgba(200,225,245,0.9)';
  ctx.fillText('escola de cozinha', 540, 262);
  ctx.font = `36px ${fonteGiz}`;
  ctx.fillStyle = 'rgba(240,240,232,0.85)';
  ctx.fillText('hoje: devagar, com fogo baixo', 540, 360);
  ctx.fillText('e muito carinho', 540, 410);
  // Chaminha desenhada a giz azul.
  ctx.strokeStyle = 'rgba(120,180,255,0.95)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(130, 230);
  ctx.bezierCurveTo(70, 170, 120, 120, 125, 70);
  ctx.bezierCurveTo(160, 120, 200, 160, 170, 230);
  ctx.bezierCurveTo(160, 255, 140, 255, 130, 230);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(140, 215);
  ctx.bezierCurveTo(120, 190, 140, 160, 142, 140);
  ctx.bezierCurveTo(160, 170, 170, 195, 155, 215);
  ctx.stroke();
  // Pequenos traços de giz no canto.
  ctx.strokeStyle = 'rgba(240,240,232,0.6)';
  ctx.lineWidth = 4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(840 + k * 40, 460);
    ctx.lineTo(870 + k * 40, 470);
    ctx.stroke();
  }

  // Caderno de técnicas (duas páginas).
  {
    const [x0, y0, x1, y1] = ATLAS.caderno;
    const w = x1 - x0;
    const h = y1 - y0;
    papel(ctx, x0, y0, w, h);
    ctx.fillStyle = '#1f3f7a';
    ctx.textAlign = 'center';
    ctx.font = `bold 26px ${fonteLivro}`;
    ctx.fillText('Caderno de', x0 + w * 0.25, y0 + 46);
    ctx.fillText('Técnicas', x0 + w * 0.25, y0 + 78);
    ctx.font = `15px ${fonteLivro}`;
    ctx.fillStyle = '#3d4f70';
    const itens = ['Cortes', 'Fundos e caldos', 'Calor seco', 'Calor úmido', 'Massas', 'Confeitaria', 'Conservas'];
    ctx.textAlign = 'left';
    itens.forEach((it, i) => {
      const y = y0 + 118 + i * 25;
      ctx.fillText(it, x0 + 26, y);
      ctx.fillText(String(i + 1), x0 + w * 0.5 - 40, y);
      ctx.strokeStyle = 'rgba(60,80,120,0.35)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x0 + 30 + ctx.measureText(it).width, y);
      ctx.lineTo(x0 + w * 0.5 - 46, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // Página direita: desenho de uma faca e uma cebola, mais anotações.
    ctx.strokeStyle = '#1f3f7a';
    ctx.lineWidth = 2.5;
    const cx = x0 + w * 0.75;
    ctx.beginPath();
    ctx.arc(cx - 30, y0 + 80, 34, 0, Math.PI * 2);
    ctx.moveTo(cx - 30, y0 + 46);
    ctx.lineTo(cx - 30, y0 + 114);
    ctx.moveTo(cx - 52, y0 + 56);
    ctx.quadraticCurveTo(cx - 30, y0 + 80, cx - 52, y0 + 104);
    ctx.moveTo(cx - 8, y0 + 56);
    ctx.quadraticCurveTo(cx - 30, y0 + 80, cx - 8, y0 + 104);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 20, y0 + 120);
    ctx.lineTo(cx + 90, y0 + 50);
    ctx.lineTo(cx + 100, y0 + 60);
    ctx.lineTo(cx + 30, y0 + 125);
    ctx.closePath();
    ctx.stroke();
    paginaLinhas(ctx, x0 + w * 0.53, y0 + 160, w * 0.42, h - 190, 3);
    paginaLinhas(ctx, x0 + 26, y0 + 300, w * 0.42, h - 320, 9);
  }

  // Lombada e capa do livro (tecido azul-marinho com filete dourado).
  {
    const [x0, y0, x1, y1] = ATLAS.lombada;
    ctx.fillStyle = '#1c2f55';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#c9a54a';
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 14, y0 + 14, x1 - x0 - 28, y1 - y0 - 28);
  }

  // Relógio.
  {
    const [x0, y0, x1] = ATLAS.relogio;
    const R = (x1 - x0) / 2;
    const cx = x0 + R;
    const cy = y0 + R;
    ctx.fillStyle = '#1d3e74';
    ctx.fillRect(x0, y0, 2 * R, 2 * R);
    ctx.fillStyle = '#f6f2e8';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d3e74';
    ctx.font = `bold 26px ${fonteLivro}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 1; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(k), cx + Math.cos(a) * R * 0.74, cy + Math.sin(a) * R * 0.74);
    }
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      const l = k % 5 ? 0.86 : 0.82;
      ctx.lineWidth = k % 5 ? 1 : 3;
      ctx.strokeStyle = '#1d3e74';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * l, cy + Math.sin(a) * R * l);
      ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9);
      ctx.stroke();
    }
    ctx.font = `italic 13px ${fonteLivro}`;
    ctx.fillText('Chama Azul', cx, cy + R * 0.38);
    ctx.textBaseline = 'alphabetic';
  }

  // Mostrador da balança.
  {
    const [x0, y0, x1] = ATLAS.balanca;
    const R = (x1 - x0) / 2;
    const cx = x0 + R;
    const cy = y0 + R;
    ctx.fillStyle = '#8fc3df';
    ctx.fillRect(x0, y0, 2 * R, 2 * R);
    ctx.fillStyle = '#fbf7ea';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#223';
    ctx.fillStyle = '#223';
    ctx.font = `bold 20px ${fonteLivro}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k <= 50; k++) {
      const a = -Math.PI * 1.25 + (k / 50) * Math.PI * 1.5;
      ctx.lineWidth = k % 10 ? 1.2 : 3;
      const l = k % 10 ? 0.78 : 0.7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * l, cy + Math.sin(a) * R * l);
      ctx.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84);
      ctx.stroke();
      if (k % 10 === 0) ctx.fillText(String(k / 10), cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55);
    }
    ctx.font = `14px ${fonteLivro}`;
    ctx.fillText('kg', cx, cy + R * 0.45);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const a = -Math.PI * 1.25 + 0.02;
    ctx.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }

  // Livro de receitas pequeno (bolo de laranja).
  {
    const [x0, y0, x1, y1] = ATLAS.receita;
    const w = x1 - x0;
    const h = y1 - y0;
    papel(ctx, x0, y0, w, h);
    ctx.fillStyle = '#7a2f22';
    ctx.textAlign = 'center';
    ctx.font = `bold 22px ${fonteLivro}`;
    ctx.fillText('Bolo de laranja', x0 + w * 0.25, y0 + 36);
    ctx.font = `14px ${fonteLivro}`;
    ctx.fillStyle = '#4a3a30';
    ctx.textAlign = 'left';
    ['3 ovos', '2 xícaras de farinha', '1 xícara de açúcar', 'suco de 2 laranjas', '1/2 xícara de óleo'].forEach((s, i) => {
      ctx.fillText('. ' + s, x0 + 24, y0 + 70 + i * 22);
    });
    paginaLinhas(ctx, x0 + 24, y0 + 190, w * 0.4, h - 205, 13);
    // Desenho de um bolo na página direita.
    ctx.strokeStyle = '#7a2f22';
    ctx.lineWidth = 2.5;
    const bx = x0 + w * 0.75;
    ctx.beginPath();
    ctx.ellipse(bx, y0 + 70, 70, 18, 0, 0, Math.PI * 2);
    ctx.moveTo(bx - 70, y0 + 70);
    ctx.lineTo(bx - 70, y0 + 120);
    ctx.ellipse(bx, y0 + 120, 70, 18, 0, Math.PI, 0, true);
    ctx.lineTo(bx + 70, y0 + 70);
    ctx.stroke();
    paginaLinhas(ctx, x0 + w * 0.54, y0 + 160, w * 0.4, h - 175, 17);
  }

  // Veio de madeira (tábua de corte).
  {
    const [x0, y0, x1, y1] = ATLAS.madeira;
    const w = x1 - x0;
    const h = y1 - y0;
    ctx.fillStyle = '#c99c69';
    ctx.fillRect(x0, y0, w, h);
    const rv = sorteador(61);
    for (let k = 0; k < 70; k++) {
      const y = y0 + rv() * h;
      const amp = 2 + rv() * 6;
      const fase = rv() * 6;
      ctx.strokeStyle = rv() < 0.5 ? `rgba(120,78,40,${0.12 + rv() * 0.2})` : `rgba(235,200,150,${0.1 + rv() * 0.15})`;
      ctx.lineWidth = 0.6 + rv() * 2.2;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 16) {
        const yy = y + Math.sin(x * 0.006 + fase) * amp + Math.sin(x * 0.021 + fase * 2) * amp * 0.3;
        if (x === x0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Riscos de faca bem leves.
    for (let k = 0; k < 40; k++) {
      ctx.strokeStyle = `rgba(90,60,30,${0.05 + rv() * 0.07})`;
      ctx.lineWidth = 1;
      const x = x0 + 150 + rv() * (w - 300);
      const y = y0 + 40 + rv() * (h - 80);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rv() - 0.5) * 60, y + (rv() - 0.5) * 40);
      ctx.stroke();
    }
  }
  granular(ctx, ATLAS.largura, ATLAS.altura, 5, 31);
  return finalizar(c, false);
}
