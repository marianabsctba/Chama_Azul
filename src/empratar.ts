// Empratamento: no fim da técnica, a peça vai para um prato bonito com molho e guarnições,
// e a câmera passeia em volta enquanto aparecem as estrelas.
import * as THREE from 'three';
import type { Cozinha, Tecnica } from './tipos';
import type { Mesa } from './gestos/mesa';
import { criarFormaAlimento, familiaDe } from './modelos/alimentos';
import { Peca } from './pecas/peca';
import { estadoInicial } from './pecas/conteudo';

const DOCE = new Set(['sobremesas', 'pastelaria', 'bolos']);
const SOPA = new Set(['caldos']);

export interface Prato {
  grupo: THREE.Group;
  centro: THREE.Vector3;
  raio: number;
  limpar(): void;
  atualizar(dt: number): void;
}

function louca(raio: number, fundo: boolean): THREE.Group {
  const g = new THREE.Group();
  const porcelana = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.18, metalness: 0 });
  const azul = new THREE.MeshStandardMaterial({ color: '#1f4fa8', roughness: 0.25 });
  // perfil do prato (aba larga) ou da tigela funda, torneado
  const perfil = fundo
    ? [[0, 0], [raio * 0.45, 0], [raio * 0.5, 0.008], [raio * 0.78, 0.035], [raio * 0.95, 0.07], [raio, 0.075], [raio * 0.97, 0.078], [raio * 0.9, 0.07], [raio * 0.72, 0.035], [raio * 0.45, 0.012], [0, 0.012]]
    : [[0, 0], [raio * 0.55, 0], [raio * 0.6, 0.006], [raio * 0.62, 0.012], [raio * 0.66, 0.016], [raio * 0.97, 0.024], [raio, 0.026], [raio * 0.98, 0.029], [raio * 0.66, 0.02], [raio * 0.6, 0.01], [0, 0.01]];
  const geo = new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 64);
  const m = new THREE.Mesh(geo, porcelana);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  // filete azul na borda, como a louça das prateleiras
  const filete = new THREE.Mesh(new THREE.TorusGeometry(fundo ? raio * 0.985 : raio * 0.9, 0.0022, 6, 96), azul);
  filete.rotation.x = Math.PI / 2;
  filete.position.y = fundo ? 0.077 : 0.0262;
  g.add(filete);
  return g;
}

/** Poça de molho levemente irregular. */
function poca(raio: number, cor: THREE.Color, brilho: number): THREE.Mesh {
  const forma = new THREE.Shape();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = raio * (1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i === 0) forma.moveTo(x, z);
    else forma.lineTo(x, z);
  }
  const geo = new THREE.ShapeGeometry(forma, 6);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cor, roughness: 1 - brilho * 0.8, emissive: cor.clone().multiplyScalar(0.12) }));
  m.receiveShadow = true;
  return m;
}

export function empratar(cena: THREE.Scene, cozinha: Cozinha, mesa: Mesa, tecnica: Tecnica): Prato {
  const doce = DOCE.has(tecnica.bancada);
  const servir = tecnica.prato?.servir;
  const ehPreparo = (id?: string) => !id || ['recipiente', 'monte', 'pasta'].includes(familiaDe(id) ?? 'recipiente');
  // o prato revisado manda: se a peça na mesa não é a principal, a principal entra no lugar
  const principalRev = tecnica.prato?.principal;
  if (principalRev && !ehPreparo(principalRev) && mesa.pecaChave !== principalRev) {
    mesa.removerPeca();
    mesa.garantirPeca(principalRev, new THREE.Vector3());
  }
  const preparoPrincipal = principalRev && ehPreparo(principalRev) ? principalRev : undefined;
  const sopa = servir === 'tigela' || servir === 'taca' || (!servir && (SOPA.has(tecnica.bancada) || (!mesa.peca && !!mesa.conteudo))) || (!mesa.peca && !!preparoPrincipal);
  const estacao = doce ? cozinha.estacoes.confeitaria : cozinha.estacoes.corte;
  const centro = estacao.superficie.clone();
  const grupo = new THREE.Group();
  grupo.position.copy(centro);
  cena.add(grupo);
  grupo.updateMatrixWorld(true);
  // a louça se adapta à peça (tamanho real): prato raso, prato grande ou travessa
  const pecaAntes = mesa.peca;
  const real = pecaAntes ? Math.min(0.6, Math.max(pecaAntes.comprimento, pecaAntes.largura)) : 0.12;
  const raio = servir === 'taca' ? 0.07 : sopa ? 0.12 : servir === 'travessa' ? THREE.MathUtils.clamp(real * 0.7, 0.2, 0.32) : THREE.MathUtils.clamp(real * 0.66, 0.13, 0.3);
  if (servir === 'tabua') {
    // tábua de madeira para pães e frios
    const tabua = new THREE.Mesh(new THREE.BoxGeometry(raio * 2.3, 0.022, raio * 1.5), new THREE.MeshStandardMaterial({ color: '#b98a55', roughness: 0.75 }));
    tabua.position.y = 0.011;
    tabua.castShadow = true;
    tabua.receiveShadow = true;
    grupo.add(tabua);
  } else if (servir === 'taca') {
    // taça de vidro com pé, para sobremesas de taça
    const perfil = [[0, 0], [0.045, 0], [0.045, 0.006], [0.006, 0.012], [0.006, 0.07], [0.03, 0.08], [0.068, 0.13], [0.07, 0.135], [0.066, 0.132], [0.028, 0.084], [0, 0.078]].map(([x, y]) => new THREE.Vector2(x, y));
    const taca = new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    grupo.add(taca);
  } else {
    const l = louca(raio, sopa);
    if (servir === 'travessa') l.scale.z = 0.72;
    grupo.add(l);
  }
  const piso = sopa ? 0.016 : 0.012;

  // o que sobrou na mesa entra no prato
  const corConteudo = mesa.conteudo?.estado.cor.clone() ?? (preparoPrincipal ? new THREE.Color(estadoInicial(preparoPrincipal.replace(/[-_]/g, ' ')).cor) : undefined);
  const brilho = mesa.conteudo?.estado.brilho ?? 0.6;
  const peca = mesa.peca;
  const capa = mesa.capa;
  mesa.soltarFerramenta();
  mesa.limparExtras();
  mesa.removerRecipiente(true);
  if (sopa && corConteudo) {
    // sopa: a tigela cheia (ou a taça)
    const caldo = poca(raio * (servir === 'taca' ? 0.9 : 0.82), corConteudo, brilho);
    caldo.position.y = servir === 'taca' ? 0.122 : 0.05;
    grupo.add(caldo);
  } else if (corConteudo) {
    const molho = poca(raio * 0.55, corConteudo, brilho);
    molho.position.set(-0.01, piso + 0.0015, 0.01);
    grupo.add(molho);
  }
  if (peca) {
    // a peça (cortada, dourada, enrolada) vem inteira para o prato, do tamanho certo
    mesa.peca = null;
    mesa.pecaChave = '';
    mesa.capa = null;
    peca.removeFromParent();
    // de volta ao tamanho real (a panela pode ter encolhido a peça para caber)
    const natural = Math.max(peca.comprimento, peca.largura);
    const alvo = sopa ? raio * 0.9 : raio * 1.5;
    peca.scale.setScalar(natural > alvo ? alvo / natural : natural < 0.03 ? 0.04 / Math.max(natural, 1e-3) : 1);
    peca.rotation.set(0, -0.35, 0);
    peca.position.set(0, (sopa ? 0.045 : piso), 0);
    grupo.add(peca);
    // centraliza no prato
    grupo.updateMatrixWorld(true);
    const c2 = new THREE.Box3();
    for (const m of peca.malhas()) c2.expandByObject(m);
    const meio = c2.getCenter(new THREE.Vector3());
    grupo.worldToLocal(meio);
    peca.position.x -= meio.x;
    peca.position.z -= meio.z;
    void capa;
  }

  // guarnições: os outros ingredientes da técnica, pequenos e arrumados em volta
  const principal = principalRev ?? tecnica.passos.find((p) => p.alimento)?.alimento;
  const guarnicoes = (tecnica.prato?.acompanhamentos ?? tecnica.alimentos)
    .filter((id) => id !== principal && familiaDe(id) && !['recipiente', 'monte', 'pasta'].includes(familiaDe(id)!))
    .slice(0, 3);
  // todo prato sai com um toque final: salsa nos salgados, hortelã e frutinha nos doces
  const toque = doce ? ['hortela', 'framboesa'] : ['salsa'];
  for (const id of toque) if (guarnicoes.length < 3 && familiaDe(id) && !guarnicoes.includes(id)) guarnicoes.push(id);
  guarnicoes.forEach((id, i) => {
    try {
      const g = new Peca(criarFormaAlimento(id));
      const ervas = familiaDe(id) === 'erva';
      const tam = Math.max(g.comprimento, g.largura);
      g.scale.setScalar(Math.min(1, (ervas ? 0.035 : 0.045) / tam));
      const a = -0.9 + i * 0.75;
      const r = raio * (sopa ? 0.55 : 0.72);
      g.position.set(Math.cos(a) * r, sopa ? 0.055 : piso, Math.sin(a) * r);
      g.rotation.y = a * 2.3;
      g.atualizar(0);
      grupo.add(g);
      // ervas viram um raminho de três folhinhas
      if (ervas) {
        for (let k = 1; k < 3; k++) {
          const g2 = new Peca(criarFormaAlimento(id));
          g2.scale.copy(g.scale);
          g2.position.copy(g.position).add(new THREE.Vector3(0.008 * k, 0.001 * k, -0.006 * k));
          g2.rotation.y = g.rotation.y + k * 0.9;
          g2.atualizar(0);
          grupo.add(g2);
        }
      }
    } catch {
      /* sem guarnição */
    }
  });
  grupo.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  const limpar = () => {
    cena.remove(grupo);
    grupo.traverse((o) => {
      if (o instanceof Peca) o.descartar();
    });
  };
  const atualizar = (dt: number) => {
    for (const o of grupo.children) if (o instanceof Peca) o.atualizar(dt);
  };
  return { grupo, centro: centro.clone().add(new THREE.Vector3(0, 0.03, 0)), raio, limpar, atualizar };
}
