// @vitest-environment node
// Gera todos os alimentos do catálogo e confere a sanidade das malhas e da seção.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import catalogo from '../../dados/catalogo.json';
import { criarFormaAlimento, criarFormaGenerica, listarAlimentos, VISUAIS } from './index';
import { materiaisAlimento } from './material';

const ids = (catalogo as { alimentos: { id: string }[] }).alimentos.map((a) => a.id);

function caixaDe(malhas: THREE.Mesh[]): THREE.Box3 {
  const b = new THREE.Box3();
  for (const m of malhas) {
    m.geometry.computeBoundingBox();
    b.union(m.geometry.boundingBox!);
  }
  return b;
}

describe('tabela visual', () => {
  it('cobre exatamente os ids do catálogo', () => {
    const lista = listarAlimentos();
    expect(lista.length).toBe(ids.length);
    for (const id of ids) expect(VISUAIS[id], id).toBeDefined();
  });

  it('usa no máximo 4 materiais compartilhados', () => {
    expect(materiaisAlimento().length).toBeLessThanOrEqual(4);
  });
});

describe('geração de todos os alimentos', () => {
  const mats = new Set(materiaisAlimento());
  for (const id of ids) {
    it(id, () => {
      const f = criarFormaAlimento(id);
      expect(f.malhas.length).toBeGreaterThan(0);
      expect(f.malhas.length).toBeLessThanOrEqual(4);
      let tris = 0;
      for (const m of f.malhas) {
        const g = m.geometry;
        const pos = g.getAttribute('position');
        expect(pos.count).toBeGreaterThan(0);
        expect(g.getAttribute('color'), 'cor por vértice').toBeDefined();
        expect(g.getAttribute('normal')).toBeDefined();
        expect(mats.has(m.material as THREE.MeshStandardMaterial), 'material compartilhado').toBe(true);
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) throw new Error(`NaN em ${id}`);
        const nor = g.getAttribute('normal').array as Float32Array;
        for (let i = 0; i < nor.length; i++) if (!Number.isFinite(nor[i])) throw new Error(`normal NaN em ${id}`);
        const col = g.getAttribute('color').array as Float32Array;
        for (let i = 0; i < col.length; i++) if (!(col[i] >= 0 && col[i] <= 1)) throw new Error(`cor fora de faixa em ${id}`);
        tris += (g.getIndex()?.count ?? pos.count) / 3;
      }
      const ave = ['ave', 'peixe', 'crustaceo'].includes(VISUAIS[id].f) || id === 'croquembouche';
      expect(tris, 'triângulos').toBeLessThanOrEqual(ave ? 15000 : 7000);

      const b = caixaDe(f.malhas);
      const tam = new THREE.Vector3();
      b.getSize(tam);
      // tamanho plausível: entre 5 mm e 1 m em cada eixo principal
      expect(tam.x).toBeGreaterThan(0.005);
      expect(Math.max(tam.x, tam.y, tam.z)).toBeLessThan(1.05);
      expect(tam.y).toBeGreaterThan(0.0005);
      // comprimento coerente com a caixa em X
      expect(Math.abs(tam.x - f.comprimento)).toBeLessThan(f.comprimento * 0.02 + 1e-4);
      // apoiada em y=0, centrada em x e z
      expect(Math.abs(b.min.y)).toBeLessThan(1e-4);
      expect(Math.abs(b.min.x + b.max.x) / 2).toBeLessThan(1e-4);
      expect(Math.abs(b.min.z + b.max.z) / 2).toBeLessThan(1e-4);
      // tamanho próximo do tamanho real declarado
      expect(f.comprimento).toBeGreaterThan(VISUAIS[id].t * 0.5);
      expect(f.comprimento).toBeLessThan(VISUAIS[id].t * 2.6);

      // seção no meio positiva e dentro da caixa
      const s = f.secao(0);
      expect(s.raioY).toBeGreaterThan(0);
      expect(s.raioZ).toBeGreaterThan(0);
      expect(Number.isFinite(s.centroY)).toBe(true);
      expect(s.centroY - s.raioY).toBeGreaterThan(-1e-3);
      expect(s.centroY + s.raioY).toBeLessThan(tam.y + 1e-3);
      expect(s.raioZ * 2).toBeLessThan(tam.z + 1e-3);
      for (const fr of [-0.45, -0.25, 0.25, 0.45]) {
        const q = f.secao(fr * f.comprimento);
        expect(q.raioY > 0 && q.raioZ > 0 && Number.isFinite(q.centroY)).toBe(true);
      }
      expect(typeof f.corInterna).toBe('string');
      expect(typeof f.corCozida).toBe('string');
    });
  }
});

describe('forma genérica', () => {
  const textos = ['peixe', 'filé de peixe', 'filé mignon em cubos', 'carne', 'frango', 'massa', 'farinha', 'fruta', 'folhas', 'queijo ralado', 'guarnição', 'folha de salsa', 'cenoura', 'xyz desconhecido', '', '2 colheres de açúcar'];
  for (const t of textos) {
    it(t || '(vazio)', () => {
      const f = criarFormaGenerica(t);
      expect(f.malhas.length).toBeGreaterThan(0);
      expect(f.comprimento).toBeGreaterThan(0.005);
      expect(f.secao(0).raioY).toBeGreaterThan(0);
    });
  }
  it('id desconhecido cai na genérica', () => {
    expect(criarFormaAlimento('nao-existe').malhas.length).toBeGreaterThan(0);
  });
});
