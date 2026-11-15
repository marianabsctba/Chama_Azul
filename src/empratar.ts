// Empratamento gourmet: no fim da técnica, a peça vai para a louça certa e o prato é montado
// como em restaurante (molho em pincelada e pontos, base em quenelle, fatias em leque,
// microverdes, guarnição em número ímpar, flor de sal), e a câmera passeia em volta.
import * as THREE from 'three';
import type { Cozinha, Tecnica } from './tipos';
import type { Mesa } from './gestos/mesa';
import { criarFormaAlimento, familiaDe } from './modelos/alimentos';
import { Peca } from './pecas/peca';
import { estadoInicial } from './pecas/conteudo';

const DOCE = new Set(['sobremesas', 'pastelaria', 'bolos']);
const SOPA = new Set(['caldos']);
const PROTEINA = new Set(['carnes', 'aves', 'peixes']);

export interface Prato {
  grupo: THREE.Group;
  centro: THREE.Vector3;
  raio: number;
  limpar(): void;
  atualizar(dt: number): void;
}

type Louca = 'prato' | 'tigela' | 'travessa' | 'taca' | 'tabua';

const porcelana = () => new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.16, metalness: 0 });
const filete = () => new THREE.MeshStandardMaterial({ color: '#1f4fa8', roughness: 0.25 });

/** Louça de restaurante: aba larga e poço central (prato) ou poço fundo (prato de sopa). */
function criarLouca(tipo: Louca, R: number): { g: THREE.Group; poco: number; piso: number } {
  const g = new THREE.Group();
  if (tipo === 'tabua') {
    const tabua = new THREE.Mesh(new THREE.BoxGeometry(R * 2.4, 0.022, R * 1.5, 4, 1, 4), new THREE.MeshStandardMaterial({ color: '#b98a55', roughness: 0.75 }));
    tabua.position.y = 0.011;
    const papel = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.6, R * 1.1), new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.95 }));
    papel.rotation.x = -Math.PI / 2;
    papel.rotation.z = 0.12;
    papel.position.y = 0.0225;
    g.add(tabua, papel);
    return { g, poco: R * 0.75, piso: 0.023 };
  }
  if (tipo === 'taca') {
    const perfil = [[0, 0], [0.045, 0], [0.045, 0.006], [0.006, 0.012], [0.006, 0.07], [0.03, 0.08], [0.068, 0.13], [0.07, 0.135], [0.066, 0.132], [0.028, 0.084], [0, 0.078]].map(([x, y]) => new THREE.Vector2(x, y));
    const taca = new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    g.add(taca);
    return { g, poco: 0.06, piso: 0.12 };
  }
  const sopa = tipo === 'tigela';
  const w = sopa ? R * 0.55 : R * 0.64; // raio do poço
  const perfil = sopa
    ? [[0, 0], [w * 0.8, 0], [w, 0.006], [w * 1.08, 0.03], [w * 1.2, 0.042], [R * 0.97, 0.046], [R, 0.05], [R * 0.985, 0.053], [w * 1.18, 0.046], [w * 1.04, 0.032], [w * 0.95, 0.01], [0, 0.008]]
    : [[0, 0], [w * 0.9, 0], [w, 0.004], [w * 1.06, 0.012], [w * 1.16, 0.016], [R * 0.97, 0.02], [R, 0.022], [R * 0.985, 0.025], [w * 1.14, 0.0195], [w * 1.03, 0.012], [w * 0.97, 0.0075], [0, 0.0075]];
  const geo = new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 96);
  const m = new THREE.Mesh(geo, porcelana());
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const linha = new THREE.Mesh(new THREE.TorusGeometry(R * 0.955, 0.0011, 5, 160), filete());
  linha.rotation.x = Math.PI / 2;
  linha.position.y = sopa ? 0.0478 : 0.0207;
  g.add(linha);
  if (tipo === 'travessa') g.scale.z = 0.7;
  return { g, poco: w, piso: sopa ? 0.009 : 0.0078 };
}

/** Pincelada de molho: um arco que afina nas pontas, brilhante. */
function pincelada(r: number, a0: number, a1: number, largura: number, cor: THREE.Color, brilho: number) {
  const n = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const w = largura * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * (1 - 0.55 * t);
    const rr = r + Math.sin(t * Math.PI) * r * 0.08;
    for (const s of [-1, 1]) pos.push(Math.cos(a) * (rr + s * w), 0, Math.sin(a) * (rr + s * w));
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cor, roughness: 1 - brilho * 0.85, side: THREE.DoubleSide, emissive: cor.clone().multiplyScalar(0.1) }));
  m.receiveShadow = true;
  return m;
}

/** Pontos de molho em arco, do maior ao menor. */
function pontos(r: number, a0: number, n: number, tam: number, cor: THREE.Color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.15, emissive: cor.clone().multiplyScalar(0.1) });
  for (let i = 0; i < n; i++) {
    const s = tam * (1 - i * 0.16);
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat);
    d.scale.set(s, s * 0.35, s);
    const a = a0 + i * 0.28;
    d.position.set(Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
    g.add(d);
  }
  return g;
}

/** Quenelle: o formato em gomo de purê, arroz ou creme feito com duas colheres. */
function quenelle(cor: string, comprimento = 0.05) {
  const geo = new THREE.SphereGeometry(1, 32, 18);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // três vincos de colher ao longo do gomo
    p.setY(i, y * (1 - 0.06 * Math.cos(Math.atan2(p.getZ(i), y) * 3)));
    p.setX(i, x * (1 - 0.12 * y * y));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.55 }));
  m.scale.set(comprimento / 2, comprimento * 0.2, comprimento * 0.3);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Flor de sal ou açúcar de confeiteiro: pontinhos espalhados numa área. */
function polvilho(n: number, raio: number, cor: string, tam: number, centro = new THREE.Vector2()) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 }), n);
  const o = new THREE.Object3D();
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * raio;
    o.position.set(centro.x + Math.cos(a) * r, 0.0005, centro.y + Math.sin(a) * r);
    o.scale.setScalar(tam * (0.6 + rnd() * 0.8));
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  }
  return inst;
}

/** Fio de creme em espiral sobre a sopa. */
function espiralCreme(r: number, cor = '#fbf7ee') {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const a = t * Math.PI * 5;
    pts.push(new THREE.Vector3(Math.cos(a) * r * t, 0, Math.sin(a) * r * t));
  }
  const tubo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0018, 6), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4 }));
  tubo.scale.y = 0.3;
  return tubo;
}

/**
 * Arruma as fatias como em restaurante: deitadas com o corte para cima, sobrepostas como telhas.
 * Devolve o comprimento ocupado (no espaço da peça) ou 0 se não havia fatias.
 */
function emTelhas(peca: Peca): number {
  const fs = [...peca.fragmentos].filter((f) => f.grupo.visible);
  // só fatias atravessadas (sem cortes no comprimento nem deitados)
  if (fs.length < 3 || fs.some((f) => f.planos.some((p) => p.eixo !== 'x'))) return 0;
  fs.sort((a, b) => a.x0 - b.x0);
  let diametro = 0;
  for (const f of fs) {
    const sec = peca.forma.secao((f.x0 + f.x1) / 2);
    diametro = Math.max(diametro, 2 * Math.max(sec.raioY, sec.raioZ));
  }
  const passo = diametro * 0.5;
  const n = fs.length;
  fs.forEach((f, i) => {
    const xc = (f.x0 + f.x1) / 2;
    const sec = peca.forma.secao(xc);
    const oc = new THREE.Vector3(xc, sec.centroY, 0);
    const esp = f.x1 - f.x0;
    // deitada (eixo da peça para cima) e um pouco encostada na anterior
    const giro = new THREE.Euler(0, 0, Math.PI / 2 - 0.22, 'XYZ');
    const q = new THREE.Quaternion().setFromEuler(giro);
    const destino = new THREE.Vector3((i - (n - 1) / 2) * passo, esp * 0.6 + Math.sin(0.22) * diametro * 0.5, 0);
    f.grupo.rotation.copy(giro);
    f.alvo.copy(destino.sub(oc.clone().applyQuaternion(q)));
  });
  return passo * (n - 1) + diametro;
}

/**
 * Palitos e cubos (cortes nos dois sentidos): arrumados num montinho bem feito, em duas camadas.
 * Devolve a largura ocupada (no espaço da peça) ou 0.
 */
function emMonte(peca: Peca): number {
  const fs = [...peca.fragmentos].filter((f) => f.grupo.visible);
  if (fs.length < 4 || !fs.some((f) => f.planos.some((p) => p.eixo !== 'x'))) return 0;
  fs.sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0));
  const tam = Math.max(...fs.map((f) => Math.max(f.x1 - f.x0, f.z1 - f.z0)));
  const embaixo = Math.ceil(fs.length * 0.65);
  const colunas = Math.ceil(Math.sqrt(embaixo));
  let s = 3;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  fs.forEach((f, i) => {
    const camada = i < embaixo ? 0 : 1;
    const j = camada ? i - embaixo : i;
    const cols = camada ? Math.max(1, colunas - 1) : colunas;
    const lin = Math.floor(j / cols);
    const col = j % cols;
    const oc = new THREE.Vector3((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, (f.z0 + f.z1) / 2);
    const dx = f.x1 - f.x0;
    const dy = f.y1 - f.y0;
    const dz = f.z1 - f.z0;
    // palito em pé (mais alto que largo) deita pelo lado comprido; cubo fica como está
    const deitar = dy > Math.max(dx, dz) * 1.3;
    const giro = (rnd() - 0.5) * 0.5 + (camada ? 0.6 : 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, deitar ? Math.PI / 2 : 0, 'YXZ'));
    const altura = deitar ? Math.min(dx, dz) : dy;
    const passo = (deitar ? Math.min(dx, dz) : tam) * 1.15;
    const destino = new THREE.Vector3((col - (cols - 1) / 2) * passo, altura / 2 + camada * altura, (lin - (Math.ceil((camada ? fs.length - embaixo : embaixo) / cols) - 1) / 2) * (deitar ? passo : passo));
    f.grupo.quaternion.copy(q);
    f.alvo.copy(destino.sub(oc.clone().applyQuaternion(q)));
  });
  return colunas * tam * 0.45 + tam;
}

/**
 * Apresentação de chef para cortes miúdos: feixe de palitinhos (julienne, tiras), montinho de
 * cubinhos (cubos, brunoise) ou de picadinho, na cor da polpa com alguns pedaços de casca.
 */
function corteApresentado(peca: Peca, tipo: 'tiras' | 'cubos' | 'picar'): THREE.Group {
  const g = new THREE.Group();
  const polpa = peca.corInterna.clone();
  const geoCasca = peca.forma.malhas[0]?.geometry.getAttribute('color');
  const casca = geoCasca ? new THREE.Color(geoCasca.getX(0), geoCasca.getY(0), geoCasca.getZ(0)) : polpa.clone().multiplyScalar(0.8);
  const n = tipo === 'tiras' ? 34 : tipo === 'cubos' ? 26 : 70;
  const geo = tipo === 'tiras' ? new THREE.BoxGeometry(0.055, 0.0032, 0.0032) : tipo === 'cubos' ? new THREE.BoxGeometry(0.009, 0.009, 0.009) : new THREE.BoxGeometry(0.0032, 0.0032, 0.0032);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const o = new THREE.Object3D();
  let s = 11;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cor = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (tipo === 'tiras') {
      // feixe: palitos quase paralelos, empilhados em pirâmide
      const camada = Math.floor(Math.sqrt(i * 0.9));
      o.position.set((rnd() - 0.5) * 0.006, 0.0016 + camada * 0.0029, (rnd() - 0.5) * (0.026 - camada * 0.004));
      o.rotation.set(0, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.1);
    } else {
      // montinho: mais alto no meio
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (tipo === 'cubos' ? 0.024 : 0.018);
      const tam = tipo === 'cubos' ? 0.009 : 0.0032;
      o.position.set(Math.cos(a) * r, tam / 2 + (1 - r / 0.026) * tam * (tipo === 'cubos' ? 1.6 : 3), Math.sin(a) * r);
      o.rotation.set(rnd() * 0.4, rnd() * 3, rnd() * 0.4);
    }
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
    inst.setColorAt(i, cor.copy(polpa).lerp(casca, rnd() < 0.18 ? 0.8 : rnd() * 0.12));
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  g.add(inst);
  return g;
}

/** Caixa (no mundo) só do que se vê da peça: cada fatia pelo seu pedaço, não pela geometria inteira. */
function caixaVisivel(peca: Peca): THREE.Box3 {
  const caixa = new THREE.Box3();
  peca.updateMatrixWorld(true);
  for (const f of peca.fragmentos) {
    if (!f.grupo.visible) continue;
    const local = new THREE.Box3(new THREE.Vector3(f.x0, f.y0, f.z0), new THREE.Vector3(f.x1, f.y1, f.z1));
    caixa.union(local.applyMatrix4(f.grupo.matrixWorld));
  }
  return caixa;
}

/** Cor do molho do prato: o que ficou na panela, ou o clássico da bancada. */
function corMolho(tecnica: Tecnica, mesa: Mesa, preparo?: string): { cor: THREE.Color; brilho: number } | null {
  if (mesa.conteudo) return { cor: mesa.conteudo.estado.cor.clone(), brilho: mesa.conteudo.estado.brilho };
  if (preparo) return { cor: new THREE.Color(estadoInicial(preparo.replace(/[-_]/g, ' ')).cor), brilho: 0.7 };
  const b = tecnica.bancada;
  if (b === 'carnes') return { cor: new THREE.Color('#5a2a14'), brilho: 0.85 }; // demi-glace
  if (b === 'aves') return { cor: new THREE.Color('#8a5a2a'), brilho: 0.8 }; // jus
  if (b === 'peixes') return { cor: new THREE.Color('#efe2b8'), brilho: 0.7 }; // beurre blanc
  if (b === 'legumes' || b === 'graos' || b === 'temperos') return { cor: new THREE.Color('#5f8f32'), brilho: 0.9 }; // azeite de ervas
  if (b === 'frutas' || b === 'sobremesas' || b === 'bolos' || b === 'pastelaria') return { cor: new THREE.Color('#b5203b'), brilho: 0.9 }; // coulis
  if (b === 'ovos') return { cor: new THREE.Color('#f1d27a'), brilho: 0.6 }; // hollandaise
  return null;
}

function pecaDe(id: string): Peca | null {
  try {
    return new Peca(criarFormaAlimento(id));
  } catch {
    return null;
  }
}

/** Coloca uma peça pequena com o maior lado do tamanho pedido. */
function miudo(id: string, tam: number, onde: THREE.Vector3, giro: number): Peca | null {
  const p = pecaDe(id);
  if (!p) return null;
  p.scale.setScalar(tam / Math.max(p.comprimento, p.largura, 1e-3));
  p.position.copy(onde);
  p.rotation.y = giro;
  p.atualizar(0);
  return p;
}

export function empratar(cena: THREE.Scene, cozinha: Cozinha, mesa: Mesa, tecnica: Tecnica): Prato {
  const doce = DOCE.has(tecnica.bancada);
  const ehPreparo = (id?: string) => !id || ['recipiente', 'monte', 'pasta'].includes(familiaDe(id) ?? 'recipiente');
  // o prato revisado manda: se a peça na mesa não é a principal, a principal entra no lugar
  const principalRev = tecnica.prato?.principal;
  if (principalRev && !ehPreparo(principalRev) && mesa.pecaChave !== principalRev) {
    mesa.removerPeca();
    mesa.garantirPeca(principalRev, new THREE.Vector3());
  }
  const preparoPrincipal = principalRev && ehPreparo(principalRev) ? principalRev : undefined;
  const real = mesa.peca ? Math.max(mesa.peca.comprimento, mesa.peca.largura) : 0.1;
  let tipo: Louca = tecnica.prato?.servir ?? (SOPA.has(tecnica.bancada) || (!mesa.peca && (!!mesa.conteudo || !!preparoPrincipal)) ? 'tigela' : 'prato');
  // proteína grande vira porção de restaurante: medalhões em leque num prato, não a peça inteira na travessa
  const porcionar = !!mesa.peca && PROTEINA.has(tecnica.bancada) && real > 0.2 && mesa.peca.fragmentos.length < 3 && familiaDe(mesa.pecaChave) !== 'ave' && !/peixe/.test(familiaDe(mesa.pecaChave) ?? '');
  if (porcionar) tipo = 'prato';
  if (tipo === 'prato' && real > 0.32 && !porcionar) tipo = 'travessa';
  const estacao = doce ? cozinha.estacoes.confeitaria : cozinha.estacoes.corte;
  const centro = estacao.superficie.clone();
  const grupo = new THREE.Group();
  grupo.position.copy(centro);
  // gira o prato para a frente de quem olha
  const frente = cozinha.inicio.posicao.clone().sub(centro).setY(0).normalize();
  grupo.rotation.y = Math.atan2(frente.x, frente.z);
  cena.add(grupo);
  grupo.updateMatrixWorld(true);
  const R = tipo === 'taca' ? 0.07 : tipo === 'travessa' ? THREE.MathUtils.clamp(real * 0.75, 0.22, 0.34) : tipo === 'tigela' ? 0.15 : porcionar ? 0.16 : THREE.MathUtils.clamp(real * (doce ? 0.8 : 0.62), 0.15, 0.2);
  const { g: louca, poco, piso } = criarLouca(tipo, R);
  grupo.add(louca);

  const molho = corMolho(tecnica, mesa, preparoPrincipal);
  const peca = mesa.peca;
  mesa.soltarFerramenta();
  mesa.limparExtras();
  mesa.removerRecipiente(true);

  // camada de baixo: molho
  if (tipo === 'tigela' || tipo === 'taca') {
    if (molho) {
      const nivel = tipo === 'taca' ? 0.118 : 0.03;
      const caldo = new THREE.Mesh(new THREE.CircleGeometry(tipo === 'taca' ? 0.058 : poco * 1.12, 64), new THREE.MeshStandardMaterial({ color: molho.cor, roughness: 1 - molho.brilho * 0.8, emissive: molho.cor.clone().multiplyScalar(0.1) }));
      caldo.rotation.x = -Math.PI / 2;
      caldo.position.y = nivel;
      grupo.add(caldo);
      if (tipo === 'tigela' && !doce) {
        const creme = espiralCreme(poco * 0.75);
        creme.position.y = nivel + 0.0008;
        grupo.add(creme);
      }
    }
  } else if (molho && tipo !== 'tabua') {
    const p = pincelada(poco * 0.62, 2.3, 4.4, poco * 0.16, molho.cor, molho.brilho);
    p.position.y = piso + 0.0008;
    grupo.add(p);
    const d = pontos(poco * 0.78, 5.1, 5, 0.0065, molho.cor);
    d.position.y = piso;
    grupo.add(d);
  }

  // base: quenelle de purê sob as proteínas (como nos pratos de restaurante)
  const nivelPrincipal = tipo === 'tigela' ? 0.032 : tipo === 'taca' ? 0.12 : piso;
  let alturaBase = 0;
  if (peca && PROTEINA.has(tecnica.bancada) && tipo !== 'tigela' && tipo !== 'tabua') {
    const q = quenelle('#f0dfa4', Math.min(0.07, poco * 0.75));
    q.position.set(-poco * 0.05, nivelPrincipal + 0.006, poco * 0.12);
    q.rotation.y = 0.5;
    grupo.add(q);
  }
  if (!peca && doce && tipo === 'prato') {
    // doce sem peça: quenelle do creme no centro
    const q = quenelle(molho?.cor.getStyle() ?? '#f2d98a', 0.06);
    q.position.set(0, nivelPrincipal + 0.006, 0);
    grupo.add(q);
    alturaBase = 0.012;
  }

  // a peça principal: tamanho real, um pouco fora do centro, fatias em leque
  if (peca) {
    mesa.peca = null;
    mesa.pecaChave = '';
    mesa.capa = null;
    peca.removeFromParent();
    if (porcionar) {
      // medalhões do miolo da peça: cinco cortes no meio, as pontas ficam de fora do prato
      const L = peca.comprimento;
      for (let i = 0; i <= 5; i++) peca.cortar('x', -L * 0.2 + (L * 0.4 * i) / 5);
      for (const f of [...peca.fragmentos]) if (f.x1 <= -L * 0.2 + 1e-4 || f.x0 >= L * 0.2 - 1e-4) f.grupo.visible = false;
    }
    const natural = porcionar ? peca.comprimento * 0.55 : Math.max(peca.comprimento, peca.largura);
    const alvo = tipo === 'tigela' ? poco * 1.1 : tipo === 'taca' ? 0.09 : tipo === 'travessa' ? R * 1.6 : doce ? poco * 1.4 : poco * 1.75;
    peca.scale.setScalar(natural > alvo ? alvo / natural : natural < 0.03 ? 0.04 / Math.max(natural, 1e-3) : 1);
    peca.rotation.set(0, -0.45, 0);
    peca.position.set(0, nivelPrincipal + alturaBase, 0);
    const telhas = emTelhas(peca);
    if (telhas) peca.scale.setScalar(Math.min(peca.scale.x, (poco * 1.5) / telhas));
    const ultimoCorte = [...tecnica.passos].reverse().find((p) => p.gesto === 'cortar')?.variante;
    const miudoCorte = ultimoCorte === 'tiras' || ultimoCorte === 'cubos' || ultimoCorte === 'picar' ? ultimoCorte : null;
    if (miudoCorte && peca.fragmentos.length >= 3 && !telhas) {
      for (const f of peca.fragmentos) f.grupo.visible = false;
      const apresentado = corteApresentado(peca, miudoCorte);
      apresentado.position.set(-poco * 0.05, nivelPrincipal, poco * 0.02);
      apresentado.rotation.y = -0.5;
      grupo.add(apresentado);
    }
    const monte = telhas || miudoCorte ? 0 : emMonte(peca);
    if (monte) peca.scale.setScalar(Math.min(peca.scale.x, (poco * 1.1) / monte));
    grupo.add(peca);
    for (let k = 0; k < 30; k++) peca.atualizar(1 / 30);
    grupo.updateMatrixWorld(true);
    const c2 = caixaVisivel(peca);
    const meio = grupo.worldToLocal(c2.getCenter(new THREE.Vector3()));
    peca.position.x -= meio.x + poco * 0.06;
    peca.position.z -= meio.z - poco * 0.04;
    // microverdes por cima da peça, em cinco folhinhas
    for (let k = 0; k < 4; k++) peca.atualizar(1 / 30);
    grupo.updateMatrixWorld(true);
    const topo = caixaVisivel(peca);
    const cTopo = grupo.worldToLocal(topo.getCenter(new THREE.Vector3()));
    const y = grupo.worldToLocal(topo.max.clone()).y;
    const erva = doce ? 'hortela' : 'cerefolio';
    for (let i = 0; i < (doce ? 2 : 5); i++) {
      const a = i * 1.26;
      const f = miudo(erva, doce ? 0.022 : 0.014, new THREE.Vector3(cTopo.x + Math.cos(a) * 0.008, y - 0.002, cTopo.z + Math.sin(a) * 0.008), a * 1.7);
      if (f) grupo.add(f);
    }
  }

  // guarnição em número ímpar, num arco do lado oposto aos pontos de molho
  const principal = principalRev ?? tecnica.passos.find((p) => p.alimento)?.alimento;
  // temperos e aromáticos inteiros não vão ao prato como guarnição
  const AROMATICOS = /^(alho|cebola|cebola-roxa|chalota|louro|cravo|anis|canela|pimenta|zimbro|cardamomo|noz-moscada|gengibre|galanga|limao-kaffir|capim)/;
  let guarnicoes = (tecnica.prato?.acompanhamentos ?? tecnica.alimentos).filter((id) => id !== principal && familiaDe(id) && !['recipiente', 'monte', 'pasta', 'bulbo'].includes(familiaDe(id)!) && !AROMATICOS.test(id)).slice(0, 3);
  if (!guarnicoes.length) guarnicoes = doce ? ['framboesa'] : ['tomate-cereja'].filter((id) => familiaDe(id));
  if (!guarnicoes.length && !doce) guarnicoes = ['salsa'];
  const lugares: string[] = guarnicoes.length === 1 ? [guarnicoes[0], guarnicoes[0], guarnicoes[0]] : guarnicoes.length === 2 ? [guarnicoes[0], guarnicoes[1], guarnicoes[0]] : guarnicoes;
  if (tipo !== 'tigela' && tipo !== 'taca') {
    lugares.forEach((id, i) => {
      const a = 0.35 + i * 0.36;
      const r = poco * 0.78;
      // guarnição no tamanho real, só limitada a uns 7 cm (cenoura baby, não minicenoura)
      const real = (() => {
        const t = pecaDe(id);
        if (!t) return 0.04;
        const v = Math.max(t.comprimento, t.largura);
        t.descartar();
        return v;
      })();
      const tam = familiaDe(id) === 'erva' ? 0.035 : THREE.MathUtils.clamp(real, 0.025, 0.07);
      const f = miudo(id, tam, new THREE.Vector3(Math.cos(a) * r, piso, Math.sin(a) * r), a * 2.1);
      if (f) grupo.add(f);
    });
  } else {
    // sopa e taça: um único detalhe no centro
    const id = doce ? 'hortela' : 'cerefolio';
    const f = miudo(id, 0.025, new THREE.Vector3(0.006, (tipo === 'taca' ? 0.12 : 0.031) + 0.001, -0.004), 0.7);
    if (f) grupo.add(f);
    if (doce && lugares[0]) {
      const fr = miudo(lugares[0], 0.02, new THREE.Vector3(-0.012, 0.122, 0.008), 0.2);
      if (fr) grupo.add(fr);
    }
  }

  // acabamento: flor de sal nos salgados, açúcar de confeiteiro nos doces
  if (tipo === 'prato' || tipo === 'travessa') {
    const pv = doce ? polvilho(140, poco * 0.5, '#fbfbf6', 0.0009, new THREE.Vector2(poco * 0.35, -poco * 0.3)) : polvilho(18, poco * 0.35, '#f7f7f2', 0.0011, new THREE.Vector2(-poco * 0.1, poco * 0.1));
    pv.position.y = piso;
    grupo.add(pv);
    if (!doce) {
      const pimenta = polvilho(10, poco * 0.3, '#2a2420', 0.0008, new THREE.Vector2(poco * 0.05, poco * 0.2));
      pimenta.position.y = piso;
      grupo.add(pimenta);
    }
  }

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
  return { grupo, centro: centro.clone().add(new THREE.Vector3(0, 0.02, 0)), raio: R, limpar, atualizar };
}
