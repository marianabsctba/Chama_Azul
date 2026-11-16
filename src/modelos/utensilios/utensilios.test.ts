// Testes dos utensílios: reconhecimento de todas as grafias do catálogo e
// sanidade geométrica de cada família.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import catalogo from '../../dados/catalogo.json';
import { criarFamilia, criarUtensilio, familiaUtensilio, listarFamilias, pontosDoUtensilio } from './index';
import { materiais } from './material';

interface TecnicaJson {
  utensilios?: string[];
  passos?: { utensilio?: string }[];
}

/** Grafias que de propósito não têm modelo: corpo, aparelhos fixos e ingredientes. */
const SEM_MODELO = new Set<string>([
  '',
  'Fogão', 'fogão', 'Forno', 'forno', 'forno desligado', 'forno micro-ondas 600 a 700 W', 'mãos e água gelada', 'temperatura ambiente',
  'chama direta ou forno', 'fogo', 'geladeira', 'geladeira ou congelador', 'congelador', 'freezer',
  'gratinador', 'dourador', 'torneira',
  'bancada-enfarinhada', 'superfície enfarinhada', 'superfície fria', 'superfície untada', 'superfície untada (mármore)',
  'mão', 'mãos', 'mão em concha', 'mãos enfarinhadas', 'mãos molhadas', 'mãos sob água fria', 'mãos úmidas',
  'dedo', 'dedos', 'dedo enfarinhado', 'dedo indicador', 'dedo molhado', 'dedos e água gelada', 'dedos enfarinhados',
  'dedos molhados em água com vinagre', 'ponta dos dedos', 'polegares', 'palma da mão', 'palmas das mãos', 'dorso da mão',
  'punho', 'olhos', 'boca',
  'água', 'água fria', 'água fria corrente', 'água gelada', 'azeite', 'óleo', 'sal', 'licor', 'manteiga ou óleo',
  'farinha temperada', 'calda fina', 'gelo picado', 'salsinha', 'maço de ervas', 'maço de tomilho ou alecrim',
  'tira de alho-poró escaldado', 'tira de cebolinha', 'tirinha de pimentão', 'fondant afinado ou couverture',
  'aspic ou maionese', 'bolinha de massa',
]);

function grafias(): string[] {
  const s = new Set<string>();
  for (const t of (catalogo as { tecnicas: TecnicaJson[] }).tecnicas) {
    for (const u of t.utensilios ?? []) s.add(u);
    for (const p of t.passos ?? []) s.add(p.utensilio ?? '');
  }
  return [...s].sort();
}

describe('familiaUtensilio', () => {
  const todas = grafias();
  const familias = new Set(listarFamilias());

  it('reconhece todas as grafias do catálogo', () => {
    const faltando = todas.filter((g) => familiaUtensilio(g) === null && !SEM_MODELO.has(g));
    expect(faltando, `grafias sem família: ${JSON.stringify(faltando)}`).toEqual([]);
  });

  it('não dá modelo ao que está na lista sem modelo', () => {
    const errados = [...SEM_MODELO].filter((g) => familiaUtensilio(g) !== null);
    expect(errados).toEqual([]);
  });

  it('só devolve famílias que existem', () => {
    const invalidas = todas.map((g) => familiaUtensilio(g)).filter((f): f is string => f !== null && !familias.has(f));
    expect(invalidas).toEqual([]);
  });

  it('acerta casos conhecidos', () => {
    const casos: [string, string | null][] = [
      ['faca', 'faca_chef'],
      ['Faca do chef', 'faca_chef'],
      ['faca-de-cozinha', 'faca_chef'],
      ['faca de pão', 'faca_pao'],
      ['faquinha', 'faca_legumes'],
      ['panela pesada', 'panela_pesada'],
      ['Batedor de arame', 'batedor'],
      ['batedeira com batedor balão', 'batedeira'],
      ['colheres', 'colher'],
      ['duas peneiras', 'peneira'],
      ['costas da faca pequena', 'faca_legumes'],
      ['cabo de colher de pau', 'colher_pau'],
      ['faca ou dedos', 'faca_chef'],
      ['pés da fôrma ou gargalo', 'forma_bolo'],
      ['saco com bico de rechear ou colher', 'saco_confeitar'],
      ['panela funda com termômetro', 'panela_funda'],
      ['termômetro de açúcar', 'termometro_acucar'],
      ['Moedor de legumes (mouli)', 'mouli'],
      ['mãos', null],
      ['forno', null],
      ['', null],
    ];
    for (const [t, f] of casos) expect(familiaUtensilio(t), t).toBe(f);
  });
});

describe('modelos', () => {
  const box = new THREE.Box3();

  for (const fam of listarFamilias()) {
    it(`gera ${fam}`, () => {
      const g = criarFamilia(fam)!;
      expect(g).toBeTruthy();
      g.updateMatrixWorld(true);
      box.setFromObject(g);
      const t = box.getSize(new THREE.Vector3());
      // tamanho plausível: entre 5 mm e 1,2 m em cada eixo maior
      const maior = Math.max(t.x, t.y, t.z);
      expect(maior, `${fam} maior medida`).toBeGreaterThan(0.02);
      expect(maior, `${fam} maior medida`).toBeLessThan(1.2);
      for (const v of [t.x, t.y, t.z]) expect(Number.isFinite(v)).toBe(true);
      // apoiado em y=0 e centrado em x e z
      expect(Math.abs(box.min.y), `${fam} base`).toBeLessThan(1e-4);
      expect(Math.abs((box.min.x + box.max.x) / 2), `${fam} centro x`).toBeLessThan(1e-4);
      expect(Math.abs((box.min.z + box.max.z) / 2), `${fam} centro z`).toBeLessThan(1e-4);
      // pontos de pega e de ponta
      const { pega, ponta } = pontosDoUtensilio(g);
      for (const p of [pega, ponta]) {
        for (const c of [p.x, p.y, p.z]) expect(Number.isNaN(c)).toBe(false);
        expect(box.clone().expandByScalar(0.03).containsPoint(p), `${fam} ponto dentro da caixa`).toBe(true);
      }
      expect(g.userData.pega).toBeInstanceOf(THREE.Vector3);
      expect(g.userData.ponta).toBeInstanceOf(THREE.Vector3);
      // poucas malhas, só materiais compartilhados, geometria sem NaN e no orçamento
      expect(g.children.length).toBeLessThanOrEqual(8);
      const compartilhados = new Set(Object.values(materiais()));
      let tris = 0;
      for (const filho of g.children) {
        const malha = filho as THREE.Mesh;
        expect(compartilhados.has(malha.material as THREE.MeshStandardMaterial)).toBe(true);
        const pos = malha.geometry.getAttribute('position');
        tris += pos.count / 3;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i++) if (Number.isNaN(arr[i])) throw new Error(`${fam}: NaN na posição`);
        const nor = malha.geometry.getAttribute('normal').array as Float32Array;
        for (let i = 0; i < nor.length; i++) if (Number.isNaN(nor[i])) throw new Error(`${fam}: NaN na normal`);
        expect(malha.geometry.getAttribute('color')).toBeTruthy();
      }
      expect(tris, `${fam} triângulos`).toBeLessThanOrEqual(4000);
    });
  }

  it('itens longos ficam ao longo de X com a ponta em +X', () => {
    const longos = ['faca_chef', 'faca_legumes', 'faca_desossar', 'faca_file', 'faca_pao', 'cutelo', 'colher_pau', 'colher',
      'concha', 'escumadeira', 'espatula_silicone', 'espatula_reta', 'espatula_angulada', 'espatula_peixe', 'espatula_bolo',
      'pincel', 'batedor', 'rolo', 'garfo_cozinha', 'pinca', 'pegador', 'hashi', 'espeto_metal', 'termometro_espeto'];
    for (const fam of longos) {
      const g = criarFamilia(fam)!;
      const t = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      expect(t.x, `${fam} comprimento em X`).toBeGreaterThan(Math.max(t.y, t.z));
      const { pega, ponta } = pontosDoUtensilio(g);
      if (fam !== 'rolo') expect(ponta.x, `${fam} ponta em +X`).toBeGreaterThan(pega.x);
    }
  });

  it('faca do chef tem 33 cm e panela média 22 cm', () => {
    const faca = new THREE.Box3().setFromObject(criarFamilia('faca_chef')!).getSize(new THREE.Vector3());
    expect(faca.x).toBeGreaterThan(0.32);
    expect(faca.x).toBeLessThan(0.34);
    const p = criarFamilia('panela')!;
    const corpo = p.children.find((c) => c.name.endsWith(':cobalto')) as THREE.Mesh;
    corpo.geometry.computeBoundingBox();
    const bb = corpo.geometry.boundingBox!;
    expect(bb.max.z - bb.min.z).toBeGreaterThan(0.215);
    expect(bb.max.z - bb.min.z).toBeLessThan(0.235);
  });

  it('criarUtensilio reaproveita o cache e devolve clones independentes', () => {
    const a = criarUtensilio('Faca do chef')!;
    const b = criarUtensilio('faca-do-chef')!;
    expect(a).not.toBe(b);
    expect((a.children[0] as THREE.Mesh).geometry).toBe((b.children[0] as THREE.Mesh).geometry);
    a.userData.pega.x += 1;
    expect(b.userData.pega.x).not.toBe(a.userData.pega.x);
    expect(criarUtensilio('mãos')).toBeNull();
  });

  it('usa no máximo 8 materiais no total', () => {
    expect(Object.keys(materiais()).length).toBeLessThanOrEqual(8);
  });
});
