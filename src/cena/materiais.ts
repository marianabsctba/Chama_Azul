// Materiais compartilhados da cozinha. Quase tudo usa cor por vértice, então poucos
// materiais cobrem a cena inteira.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  texturaAtlas,
  texturaAzulejoCeleste,
  texturaAzulejoPortugues,
  texturaMarmore,
  texturaPiso,
} from './texturas';

export interface MateriaisCozinha {
  porChave: Record<string, THREE.Material>;
  forno: THREE.MeshStandardMaterial;
  /** Gera o mapa de reflexos (uma vez só) com o renderer da página. */
  aplicarAmbiente: (renderer: THREE.WebGLRenderer) => void;
}

export function criarMateriais(): MateriaisCozinha {
  const padrao = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  // Interior do forno: a cor por vértice também modula o brilho, para o fundo
  // acender mais que as laterais e o teto.
  const forno = padrao({ color: '#3a2a20', roughness: 0.55, emissive: '#ff6a1c', emissiveIntensity: 0, vertexColors: true });
  forno.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;',
    );
  };
  const porChave: Record<string, THREE.Material> = {
    parede: padrao({ vertexColors: true, roughness: 0.92 }),
    azulejoPt: padrao({ map: texturaAzulejoPortugues(), roughness: 0.22 }),
    celeste: padrao({ map: texturaAzulejoCeleste(), roughness: 0.25 }),
    piso: padrao({ map: texturaPiso(), roughness: 0.62 }),
    fosco: padrao({ vertexColors: true, roughness: 0.78 }),
    brilho: padrao({ vertexColors: true, roughness: 0.3 }),
    metal: padrao({ vertexColors: true, metalness: 0.85, roughness: 0.3 }),
    vidro: padrao({ vertexColors: true, roughness: 0.06, transparent: true, opacity: 0.32, depthWrite: false }),
    emissivo: new THREE.MeshBasicMaterial({ vertexColors: true }),
    marmore: padrao({ map: texturaMarmore(), roughness: 0.2 }),
    atlas: padrao({ map: texturaAtlas(), roughness: 0.85 }),
    forno,
  };
  const alvos = Object.values(porChave).filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial);
  let feito = false;
  const aplicarAmbiente = (renderer: THREE.WebGLRenderer) => {
    if (feito) return;
    feito = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    for (const m of alvos) {
      m.envMap = env;
      m.envMapIntensity = m.metalness > 0.5 ? 0.7 : 0.12;
      m.needsUpdate = true;
    }
  };
  return { porChave, forno, aplicarAmbiente };
}
