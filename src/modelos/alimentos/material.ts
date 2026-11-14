// Materiais compartilhados dos alimentos. Todos usam cor por vértice; o que muda
// entre eles é só a aspereza. Cada material novo custa uma compilação de shader
// na web, então existem exatamente quatro e todas as peças reaproveitam estes.
import * as THREE from 'three';

export type Acabamento = 'fosco' | 'acetinado' | 'brilhante' | 'umido';

const ASPEREZA: Record<Acabamento, number> = {
  fosco: 0.9, // casca seca, pão, farinha, cogumelo
  acetinado: 0.62, // carne, massa crua, queijo, maioria das frutas
  brilhante: 0.36, // tomate, berinjela, pimentão, chocolate
  umido: 0.18, // peixe cru, fígado, caldas, gelatina
};

const cache = new Map<Acabamento, THREE.MeshStandardMaterial>();

/** Devolve o material compartilhado do acabamento pedido (sempre a mesma instância). */
export function materialAlimento(ac: Acabamento): THREE.MeshStandardMaterial {
  let m = cache.get(ac);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ASPEREZA[ac], metalness: 0 });
    m.name = 'alimento-' + ac;
    cache.set(ac, m);
  }
  return m;
}

/** Os quatro materiais, para pré-compilar no carregamento se o jogo quiser. */
export function materiaisAlimento(): THREE.MeshStandardMaterial[] {
  return (Object.keys(ASPEREZA) as Acabamento[]).map(materialAlimento);
}
