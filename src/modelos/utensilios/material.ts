// Materiais compartilhados por todos os utensílios. São só oito, criados uma
// única vez: cada variação de material custa uma compilação de shader na web.
// A cor de cada peça vem por vértice (atributo "color"), então o material só
// define o "comportamento" da superfície (metal, esmalte, madeira, vidro...).
import * as THREE from 'three';

export type ChaveMaterial =
  | 'inox'
  | 'inoxEscuro'
  | 'cobalto'
  | 'petroleo'
  | 'madeira'
  | 'silicone'
  | 'ceramica'
  | 'vidro';

/** Paleta da cozinha azul. Cores em sRGB hexadecimal. */
export const COR = {
  inox: 0xc9d2da,
  inoxClaro: 0xe3e9ee,
  inoxEscuro: 0x3b424c,
  ferro: 0x2a2f36,
  antiaderente: 0x262b33,
  cobalto: 0x1f4fb0,
  cobaltoClaro: 0x3f74d6,
  petroleo: 0x1b5d6e,
  petroleoClaro: 0x2f8095,
  creme: 0xf1e8d4,
  madeira: 0xd9b98b,
  madeiraEscura: 0xb58d5e,
  bambu: 0xd8c27e,
  marinho: 0x1b2a4c,
  silicone: 0x8cc4ec,
  siliconeEscuro: 0x5a9fd6,
  ceramica: 0xf5f2ea,
  filete: 0x2357b8,
  barro: 0xb7653f,
  vidro: 0xe2f1f8,
  plastico: 0xcfe6f5,
  papel: 0xf2ead8,
  papelao: 0xc9a77a,
  tecido: 0xf3efe6,
  tecidoAzul: 0x5d8fc9,
  barbante: 0xe9dcc0,
  verde: 0x3f8a3a,
  preto: 0x1a1d22,
  vermelho: 0xc8423a,
} as const;

function criar(): Record<ChaveMaterial, THREE.MeshStandardMaterial> {
  const base = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, ...p });
  return {
    // Inox escovado: metal claro de reflexo espalhado.
    inox: base({ metalness: 0.85, roughness: 0.32 }),
    // Ferro fundido, antiaderente, lâminas escurecidas.
    inoxEscuro: base({ metalness: 0.6, roughness: 0.55 }),
    // Esmalte vitrificado brilhante (panelas, tigelas, eletroportáteis).
    cobalto: base({ metalness: 0.05, roughness: 0.18 }),
    // Esmalte acetinado, um pouco menos brilhante.
    petroleo: base({ metalness: 0.08, roughness: 0.34 }),
    // Madeira, bambu, papel, tecido: superfícies foscas sem metal.
    madeira: base({ metalness: 0, roughness: 0.78 }),
    // Silicone e borracha: fosco macio.
    silicone: base({ metalness: 0, roughness: 0.55 }),
    // Cerâmica e porcelana vitrificadas.
    ceramica: base({ metalness: 0, roughness: 0.22 }),
    // Vidro e plástico translúcido.
    vidro: base({ metalness: 0, roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false }),
  };
}

let cache: Record<ChaveMaterial, THREE.MeshStandardMaterial> | null = null;

/** Os oito materiais, criados na primeira chamada e reaproveitados depois. */
export function materiais(): Record<ChaveMaterial, THREE.MeshStandardMaterial> {
  if (!cache) cache = criar();
  return cache;
}

export function material(chave: ChaveMaterial): THREE.MeshStandardMaterial {
  return materiais()[chave];
}
