// Corte com faca: guias sobre a peça, o jogador risca o corte com o mouse e a peça se divide.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar } from './base';
import { anguloDaEstacao } from './mesa';
import { audio } from '../motor/audio';

const matGuia = new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const matGuiaAtiva = new THREE.MeshBasicMaterial({ color: '#d6f3ff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
const matPonto = new THREE.MeshBasicMaterial({ color: '#9fe0ff', transparent: true, opacity: 0.85, depthWrite: false });
const geoPonto = new THREE.SphereGeometry(1, 12, 8);

interface Guia {
  eixo: 'x' | 'z';
  pos: number; // local da peça
  feito: boolean;
  malha: THREE.Mesh;
}

/** Espaçamento real pedido, em metros. */
function espacamento(ctx: ContextoGesto, padrao: number) {
  const m = ctx.passo.meta;
  if (m?.unidade === 'mm') return ((m.valor + (m.max ?? m.valor)) / 2) / 1000;
  if (m?.unidade === 'cm') return ((m.valor + (m.max ?? m.valor)) / 2) / 100;
  return padrao;
}

export function gestoCortar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const chave = passo.alimento ?? passo.alvo;
  const peca = mesa.garantirPeca(chave, estacao.superficie.clone());
  peca.rotation.y = anguloDaEstacao(estacao);
  peca.position.copy(estacao.superficie);
  const v = passo.variante;
  if (v === 'contorno' || v === 'pontos' || v === 'desfiar') return gestoTracar(ctx);
  if (v === 'deitado') return cortarDeitado(ctx);

  const L = peca.comprimento;
  const W = peca.largura;
  const H = peca.altura;
  const escala = peca.scale.x;
  const real = espacamento(ctx, v === 'picar' ? L / 10 : L / 8);
  // espaçamento visual jogável: nunca menor que 1,2 cm no mundo
  const passoVisual = Math.max(real, 0.012 / escala, L / 14);
  const guias: Guia[] = [];
  const criarGuia = (eixo: 'x' | 'z', pos: number) => {
    const g = eixo === 'x' ? new THREE.PlaneGeometry(W * 1.25, H * 1.3) : new THREE.PlaneGeometry(L * 1.1, H * 1.3);
    if (eixo === 'x') g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, matGuia);
    m.renderOrder = 5;
    if (eixo === 'x') m.position.set(pos, H * 0.6, 0);
    else m.position.set(0, H * 0.6, pos);
    peca.add(m);
    guias.push({ eixo, pos, feito: false, malha: m });
  };
  // cortes longitudinais primeiro (tiras, cubos, picar)
  if (v === 'tiras' || v === 'cubos' || v === 'picar') {
    const nz = Math.max(1, Math.min(3, Math.round(W / passoVisual) - 1));
    for (let i = 1; i <= nz; i++) criarGuia('z', -W / 2 + (W * i) / (nz + 1));
  }
  const maxX = v === 'picar' ? 8 : 6;
  const nx = Math.max(2, Math.min(maxX, Math.floor((L * 0.8) / passoVisual)));
  // começa pela ponta direita, como quem fatia de verdade
  for (let i = 1; i <= nx; i++) criarGuia('x', L / 2 - L * 0.08 - passoVisual * i + passoVisual * 0.5);

  const faca = mesa.pegarFerramenta(passo.utensilio, 'cortar');
  const notas: number[] = [];
  let inicio: THREE.Vector3 | null = null;
  let descida = 0;
  const alturaPlano = estacao.superficie.y + H * escala * 0.6;
  const rotPeca = peca.rotation.y;
  // a faca gira 90 graus com R (ou o botão no celular) e, durante o corte, segue a direção do arraste
  let giroManual = 0;
  const textoMedida = passo.meta && (passo.meta.unidade === 'mm' || passo.meta.unidade === 'cm') ? ` de ${passo.meta.valor}${passo.meta.max ? ' a ' + passo.meta.max : ''} ${passo.meta.unidade}` : '';

  const proxima = () => guias.find((g) => !g.feito);
  const marcar = () => {
    const p = proxima();
    for (const g of guias) g.malha.material = g === p ? matGuiaAtiva : matGuia;
    g_visivel();
  };
  const g_visivel = () => {
    for (const g of guias) g.malha.visible = !g.feito;
  };
  marcar();

  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      const p = proxima();
      const ponto = entrada.noPlano(camera, alturaPlano);
      if (p) {
        hud.dica(
          p.eixo === 'z'
            ? `Arraste a faca no sentido do comprimento, sobre a guia clara${textoMedida}.`
            : `Risque o corte de cima para baixo na tela, sobre a guia clara${textoMedida}. A faca segue o seu risco; R gira a faca.`,
        );
      }
      hud.medidores([{ rotulo: 'Cortes', valor: guias.filter((g) => g.feito).length / guias.length, texto: `${guias.filter((g) => g.feito).length} de ${guias.length}` }]);
      // faca acompanha o mouse
      if (entrada.apertou('r')) giroManual += Math.PI / 2;
      if (ponto && faca) {
        descida = Math.max(0, descida - dt * 3);
        const alvo = ponto.clone();
        alvo.y = estacao.superficie.y + H * escala * (0.9 - descida * 0.9) + 0.01;
        let giro = (p?.eixo === 'z' ? rotPeca : rotPeca + Math.PI / 2) + giroManual;
        if (entrada.pressionado && inicio && ponto.distanceTo(inicio) > 0.012) {
          const d = ponto.clone().sub(inicio);
          giro = Math.atan2(-d.z, d.x);
        }
        mesa.ferramentaEm(alvo, giro, -0.08, 0);
      }
      if (entrada.cliqueNovo && ponto) inicio = ponto.clone();
      if (entrada.soltouNovo && inicio && ponto && p) {
        const a = peca.worldToLocal(inicio.clone());
        const b = peca.worldToLocal(ponto.clone());
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const comp = Math.hypot(dx, dz);
        inicio = null;
        const transversal = Math.abs(dz) > Math.abs(dx) * 1.1;
        const eixoRiscado: 'x' | 'z' = transversal ? 'x' : 'z';
        const extensao = eixoRiscado === 'x' ? W : L;
        if (comp < extensao * 0.45) {
          hud.aviso('Risque o corte inteiro, de ponta a ponta.', 'ajuste');
          return;
        }
        if (eixoRiscado !== p.eixo) {
          hud.aviso(p.eixo === 'x' ? 'Esse corte é atravessado: de cima para baixo na tela.' : 'Esse corte é no comprimento: da esquerda para a direita.', 'ajuste');
          return;
        }
        const pos = eixoRiscado === 'x' ? (a.x + b.x) / 2 : (a.z + b.z) / 2;
        // tolerância: meio espaçamento; angulação torta pesa um pouco
        const esp = eixoRiscado === 'x' ? passoVisual : W / 4;
        const erro = Math.abs(pos - p.pos) / esp;
        const torto = eixoRiscado === 'x' ? Math.abs(dx) / Math.max(1e-4, Math.abs(dz)) : Math.abs(dz) / Math.max(1e-4, Math.abs(dx));
        if (erro > 0.9 && ctx.modo === 'prova') {
          hud.aviso('Longe da guia. Tente de novo mais perto da linha clara.', 'ajuste');
          return;
        }
        const nota = clamp(1 - erro * 1.3 - Math.max(0, torto - 0.15) * 0.8);
        notas.push(nota);
        const onde = ctx.modo === 'zen' ? p.pos : pos;
        peca.cortar(p.eixo, onde);
        p.feito = true;
        descida = 1;
        audio.corte();
        hud.aviso(nota >= 0.85 ? 'Corte preciso!' : nota >= 0.6 ? 'Bom corte.' : 'Saiu, mas irregular.', nota >= 0.6 ? 'bom' : 'neutro');
        marcar();
        if (!proxima()) {
          exec.nota = notas.reduce((s, n) => s + n, 0) / notas.length;
          exec.comentario = comentar(exec.nota, 'Peças do mesmo tamanho, como manda a técnica.', 'Quase todas iguais; a regularidade garante cozimento por igual.', 'Tamanhos variados cozinham em tempos diferentes. Vale treinar de novo.');
          exec.concluido = true;
        }
      }
    },
    descartar() {
      for (const g of guias) {
        peca.remove(g.malha);
        g.malha.geometry.dispose();
      }
      mesa.soltarFerramenta();
    },
  };
  return exec;
}

/** Incisões que seguem um caminho (desossar, eviscerar, abrir), pontos (perfurar, lardear) ou fios (desfiar). */
function gestoTracar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const peca = mesa.peca!;
  const v = passo.variante;
  const L = peca.comprimento;
  const W = peca.largura;
  const escala = peca.scale.x;
  peca.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  // projeta pontos de cima para baixo para achar a superfície
  const naSuperficie = (lx: number, lz: number): THREE.Vector3 | null => {
    const topo = peca.localToWorld(new THREE.Vector3(lx, peca.altura * 2 + 0.05, lz));
    raycaster.set(topo, new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(peca.malhas(), false)[0];
    return hit ? hit.point.clone() : null;
  };
  const alvos: THREE.Vector3[] = [];
  if (v === 'contorno') {
    for (let i = 0; i <= 10; i++) {
      const p = naSuperficie(-L * 0.4 + (L * 0.8 * i) / 10, 0);
      if (p) alvos.push(p);
    }
  } else if (v === 'pontos') {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const p = naSuperficie(-L * 0.35 + (L * 0.7 * (i % 3)) / 2, (i < 3 ? -1 : 1) * W * 0.18);
      if (p) alvos.push(p);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const p = naSuperficie(-L * 0.38, -W * 0.3 + (W * 0.6 * i) / 4);
      const q = naSuperficie(L * 0.38, -W * 0.3 + (W * 0.6 * i) / 4);
      if (p && q) alvos.push(p, q);
    }
  }
  if (!alvos.length) alvos.push(peca.localToWorld(new THREE.Vector3(0, peca.altura, 0)));
  const marcas = alvos.map((p) => {
    const m = new THREE.Mesh(geoPonto, matPonto);
    m.scale.setScalar(0.004 + 0.004 * Math.min(1, escala));
    m.position.copy(p);
    m.renderOrder = 6;
    mesa.adicionarExtra(m);
    return m;
  });
  const faca = mesa.pegarFerramenta(passo.utensilio, 'cortar');
  let indice = 0;
  let desvios: number[] = [];
  const tol = Math.max(0.015, L * escala * 0.06);
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar() {
      hud.dica(
        v === 'contorno'
          ? 'Segure o botão e guie a ponta da faca pelos pontos, sem pressa, colada ao osso.'
          : v === 'pontos'
            ? 'Clique em cada ponto marcado para furar ou marcar.'
            : 'Segure e puxe de um ponto ao outro, no sentido das fibras.',
      );
      hud.medidores([{ rotulo: 'Progresso', valor: indice / alvos.length }]);
      const hit = entrada.raio(camera).intersectObjects(peca.malhas(), false)[0];
      const ponto = hit?.point ?? entrada.noPlano(camera, estacao.superficie.y + peca.altura * escala);
      if (ponto && faca) mesa.ferramentaEm(ponto.clone().add(new THREE.Vector3(0, 0.004, 0)), peca.rotation.y + Math.PI / 2, -1.1, 0);
      marcas.forEach((m, i) => (m.material = i === indice ? matGuiaAtiva : matPonto, (m.visible = i >= indice)));
      if (!ponto || indice >= alvos.length) return;
      const alvo = alvos[indice];
      const d = entrada.raio(camera).ray.distanceToPoint(alvo);
      const ativo = v === 'pontos' ? entrada.cliqueNovo : entrada.pressionado;
      if (ativo && hit && v !== 'pontos') peca.pintar(hit.point, 0.006, 'remover', undefined, 0.6);
      if (ativo && d < tol * (ctx.modo === 'zen' ? 1.6 : 1)) {
        desvios.push(d / tol);
        if (v === 'pontos') {
          peca.pintar(alvo, 0.008, 'remover', undefined, 1);
          audio.corte();
        }
        indice++;
        if (indice % 2 === 0) audio.clique();
        if (indice >= alvos.length) {
          exec.nota = clamp(1 - (desvios.reduce((s, x) => s + x, 0) / desvios.length) * 0.6);
          exec.comentario = comentar(exec.nota, 'Traço firme e limpo.', 'Bom traço, com pequenas saídas.', 'O traço escapou da linha; vá mais devagar.');
          exec.concluido = true;
        }
      }
    },
    descartar() {
      mesa.limparExtras();
      mesa.soltarFerramenta();
      desvios = [];
    },
  };
  return exec;
}

/** Corte deitado (borboleta, escalope, bolso): faca paralela à tábua, altura escolhida com o mouse. */
function cortarDeitado(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const peca = mesa.peca!;
  const L = peca.comprimento;
  const W = peca.largura;
  const H = peca.altura;
  const camadas = /tr[eê]s|3 ou mais|terç/.test(`${passo.alvo} ${passo.parametro}`) ? 2 : 1;
  const guias: Guia[] = [];
  for (let i = 1; i <= camadas; i++) {
    const y = (H * i) / (camadas + 1);
    const g = new THREE.PlaneGeometry(L * 1.15, W * 1.25);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, matGuia);
    m.renderOrder = 5;
    m.position.set(0, y, 0);
    peca.add(m);
    guias.push({ eixo: 'x', pos: y, feito: false, malha: m });
  }
  const faca = mesa.pegarFerramenta(passo.utensilio, 'cortar');
  const notas: number[] = [];
  let inicioX: number | null = null;
  let somaY = 0;
  let nY = 0;
  const proxima = () => guias.find((g) => !g.feito);
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar() {
      const p = proxima();
      guias.forEach((g) => {
        g.malha.visible = !g.feito;
        g.malha.material = g === p ? matGuiaAtiva : matGuia;
      });
      hud.dica('Faca deitada, paralela à tábua: suba ou desça o mouse até a guia e arraste de um lado ao outro para cortar.');
      hud.medidores([{ rotulo: 'Cortes', valor: guias.filter((g) => g.feito).length / guias.length, texto: `${guias.filter((g) => g.feito).length} de ${guias.length}` }]);
      // o mouse anda num plano em pé que passa pelo meio da peça, de frente para quem corta
      peca.updateMatrixWorld(true);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(peca.matrixWorld);
      const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, peca.getWorldPosition(new THREE.Vector3()));
      const ponto = entrada.noPlanoQualquer(camera, plano);
      if (!ponto || !p) return;
      const local = peca.worldToLocal(ponto.clone());
      const h = THREE.MathUtils.clamp(local.y, 0.002, H * 1.05);
      if (faca) {
        const naAltura = peca.localToWorld(new THREE.Vector3(local.x, h, 0));
        mesa.ferramentaEm(naAltura, peca.rotation.y, 0, Math.PI / 2);
      }
      if (entrada.cliqueNovo) {
        inicioX = local.x;
        somaY = 0;
        nY = 0;
      }
      if (entrada.pressionado && inicioX !== null) {
        somaY += h;
        nY++;
      }
      if (entrada.soltouNovo && inicioX !== null) {
        const percorrido = Math.abs(local.x - inicioX);
        const altura = nY ? somaY / nY : h;
        inicioX = null;
        if (percorrido < L * 0.45) {
          hud.aviso('Leve a faca de um lado ao outro da peça.', 'ajuste');
          return;
        }
        const erro = Math.abs(altura - p.pos) / Math.max(H * 0.25, 1e-3);
        if (erro > 1 && ctx.modo === 'prova') {
          hud.aviso('Longe da guia: ajuste a altura da faca.', 'ajuste');
          return;
        }
        const nota = clamp(1 - erro * 0.9);
        notas.push(nota);
        peca.cortar('y', ctx.modo === 'zen' ? p.pos : altura);
        p.feito = true;
        audio.corte();
        hud.aviso(nota >= 0.85 ? 'Camadas por igual!' : nota >= 0.6 ? 'Bom corte.' : 'Saiu torto, mas abriu.', nota >= 0.6 ? 'bom' : 'neutro');
        if (!proxima()) {
          exec.nota = notas.reduce((s2, n) => s2 + n, 0) / notas.length;
          exec.comentario = comentar(exec.nota, 'Espessura igual nas duas partes: cozinha por igual.', 'Quase igual; uma parte ficou um pouco mais grossa.', 'Partes desiguais cozinham em tempos diferentes.');
          exec.concluido = true;
        }
      }
    },
    descartar() {
      for (const g of guias) {
        peca.remove(g.malha);
        g.malha.geometry.dispose();
      }
      mesa.soltarFerramenta();
    },
  };
  return exec;
}
