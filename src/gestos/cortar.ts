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
  // espaçamento visual jogável: nunca menor que 1,2 cm no mundo, e sempre cabendo dois cortes na peça
  const passoVisual = Math.min(Math.max(real, 0.012 / escala, L / 14), L * 0.38);
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
  // aparar: só as duas pontas (talo, ponta, rabo, barbatana, gordura da borda)
  if (v === 'aparar') {
    criarGuia('x', L / 2 - L * 0.08);
    criarGuia('x', -L / 2 + L * 0.08);
  }
  // cortes longitudinais primeiro (tiras, cubos, picar)
  if (v === 'tiras' || v === 'cubos' || v === 'picar') {
    const nz = Math.max(1, Math.min(3, Math.round(W / passoVisual) - 1));
    for (let i = 1; i <= nz; i++) criarGuia('z', -W / 2 + (W * i) / (nz + 1));
  }
  const maxX = v === 'picar' ? 8 : 6;
  // ao meio (ou em quatro): um corte só no meio, como o livro manda
  const textoCorte = `${passo.alvo} ${passo.parametro}`.toLowerCase();
  const aoMeio = /ao meio|metades|em dois|em duas|pela metade/.test(textoCorte) && v !== 'tiras' && v !== 'cubos' && v !== 'picar';
  const emQuatro = /em quatro|em quartos|quartos/.test(textoCorte) && v !== 'tiras' && v !== 'cubos' && v !== 'picar';
  const nx = v === 'aparar' || aoMeio || emQuatro ? 0 : Math.max(2, Math.min(maxX, Math.floor((L * 0.8) / passoVisual)));
  if (aoMeio || emQuatro) criarGuia('x', 0);
  if (emQuatro) criarGuia('z', 0);
  // começa pela ponta direita, como quem fatia de verdade
  for (let i = 1; i <= nx; i++) criarGuia('x', L / 2 - L * 0.08 - passoVisual * i + passoVisual * 0.5);

  const faca = mesa.pegarFerramenta(passo.utensilio, 'cortar');
  const notas: number[] = [];
  let descida = 0;
  const alturaPlano = estacao.superficie.y + H * escala * 0.6;
  const rotPeca = peca.rotation.y;
  // golpe da faca: desce, corta no fundo e sobe
  let golpe: { pos: number; t: number; feito: boolean } | null = null;
  const linha = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.0025), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }));
  linha.geometry.rotateX(-Math.PI / 2);
  linha.renderOrder = 7;
  peca.add(linha);
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
          ctx.modo === 'zen'
            ? `Passe o mouse sobre a peça: a faca gruda na guia clara${textoMedida}. Clique para cortar.`
            : `Mire a faca sobre a guia clara${textoMedida} e clique para cortar. A precisão conta estrelas.`,
        );
      }
      hud.medidores([{ rotulo: 'Cortes', valor: guias.filter((g) => g.feito).length / guias.length, texto: `${guias.filter((g) => g.feito).length} de ${guias.length}` }]);
      if (!p) return;
      // onde a faca está, ao longo do eixo do corte (no espaço da peça)
      let pos = p.pos;
      let sobre = false;
      if (ponto) {
        const local = peca.worldToLocal(ponto.clone());
        const bruto = p.eixo === 'x' ? local.x : local.z;
        const limite = p.eixo === 'x' ? L / 2 : W / 2;
        sobre = Math.abs(local.x) < L * 0.7 && Math.abs(local.z) < Math.max(W, 0.03) * 1.2;
        const esp = p.eixo === 'x' ? passoVisual : W / 4;
        // no Zen a faca gruda na guia quando chega perto; na Prova vale a mira
        pos = ctx.modo === 'zen' && Math.abs(bruto - p.pos) < esp * 0.6 ? p.pos : THREE.MathUtils.clamp(bruto, -limite * 0.98, limite * 0.98);
      }
      // linha de prévia do corte
      linha.visible = sobre && !golpe;
      if (p.eixo === 'x') {
        linha.rotation.set(0, Math.PI / 2, 0);
        linha.position.set(pos, H * 1.02, 0);
        linha.scale.set(W * 1.15, 1, 1);
      } else {
        linha.rotation.set(0, 0, 0);
        linha.position.set(0, H * 1.02, pos);
        linha.scale.set(L * 1.05, 1, 1);
      }
      const noGuia = Math.abs(pos - p.pos) < 1e-6;
      (linha.material as THREE.MeshBasicMaterial).color.set(noGuia ? '#7fe0b4' : '#ffffff');
      // faca: lâmina em pé, atravessada à linha do corte, subindo e descendo no golpe
      if (golpe) {
        golpe.t += dt;
        descida = Math.min(1, golpe.t / 0.09);
        if (golpe.t >= 0.09 && !golpe.feito) {
          golpe.feito = true;
          const esp = p.eixo === 'x' ? passoVisual : W / 4;
          const erro = Math.abs(golpe.pos - p.pos) / esp;
          const nota = clamp(1 - erro * 1.4);
          notas.push(nota);
          peca.cortar(p.eixo, golpe.pos);
          p.feito = true;
          audio.corte();
          hud.aviso(nota >= 0.85 ? 'Corte preciso!' : nota >= 0.6 ? 'Bom corte.' : 'Saiu, mas irregular.', nota >= 0.6 ? 'bom' : 'neutro');
          marcar();
          if (!proxima()) {
            exec.nota = notas.reduce((s2, n) => s2 + n, 0) / notas.length;
            exec.comentario = comentar(exec.nota, 'Peças do mesmo tamanho, como manda a técnica.', 'Quase todas iguais; a regularidade garante cozimento por igual.', 'Tamanhos variados cozinham em tempos diferentes. Vale treinar de novo.');
            // terminado o corte, as partes se afastam: rodelas, quartos e cubos aparecem soltos, não só riscados
            peca.espalhar(Math.max(0.006, Math.max(peca.comprimento, peca.largura) * (peca.fragmentos.length <= 4 ? 0.1 : 0.035)));
            exec.concluido = true;
          }
        }
        if (golpe.t > 0.22) golpe = null;
      } else descida = Math.max(0, descida - dt * 5);
      if (faca) {
        const naPeca = peca.localToWorld(p.eixo === 'x' ? new THREE.Vector3(golpe ? golpe.pos : pos, 0, 0) : new THREE.Vector3(0, 0, golpe ? golpe.pos : pos));
        naPeca.y = estacao.superficie.y + H * escala * (1.15 - descida * 1.1) + 0.012;
        const giro = p.eixo === 'z' ? rotPeca : rotPeca + Math.PI / 2;
        mesa.ferramentaEm(naPeca, giro, -0.06, 0);
      }
      if (entrada.cliqueNovo && ponto && sobre && !golpe) {
        if (ctx.modo === 'prova' && Math.abs(pos - p.pos) > (p.eixo === 'x' ? passoVisual : W / 4) * 0.9) {
          hud.aviso('Longe da guia: mire mais perto da linha clara.', 'ajuste');
          return;
        }
        golpe = { pos, t: 0, feito: false };
      }
    },
    descartar() {
      for (const g of guias) {
        peca.remove(g.malha);
        g.malha.geometry.dispose();
      }
      peca.remove(linha);
      linha.geometry.dispose();
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
  let golpe: { h: number; t: number } | null = null;
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
      hud.dica(ctx.modo === 'zen' ? 'Faca deitada, paralela à tábua: suba ou desça o mouse; perto da guia a faca gruda. Clique para cortar.' : 'Faca deitada, paralela à tábua: suba ou desça o mouse até a guia e clique para cortar.');
      hud.medidores([{ rotulo: 'Cortes', valor: guias.filter((g) => g.feito).length / guias.length, texto: `${guias.filter((g) => g.feito).length} de ${guias.length}` }]);
      // o mouse anda num plano em pé que passa pelo meio da peça, de frente para quem corta
      peca.updateMatrixWorld(true);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(peca.matrixWorld);
      const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, peca.getWorldPosition(new THREE.Vector3()));
      const ponto = entrada.noPlanoQualquer(camera, plano);
      if (!p) return;
      let h = p.pos;
      if (ponto) {
        const local = peca.worldToLocal(ponto.clone());
        const bruto = THREE.MathUtils.clamp(local.y, 0.002, H * 1.05);
        h = ctx.modo === 'zen' && Math.abs(bruto - p.pos) < H * 0.18 ? p.pos : bruto;
      }
      // a faca desliza de um lado ao outro durante o golpe
      if (golpe) {
        golpe.t += 1 / 60;
        const k = Math.min(1, golpe.t / 0.3);
        if (faca) mesa.ferramentaEm(peca.localToWorld(new THREE.Vector3(L * (0.65 - 1.3 * k), golpe.h, 0)), peca.rotation.y, 0, Math.PI / 2);
        if (k >= 1) {
          const erro = Math.abs(golpe.h - p.pos) / Math.max(H * 0.25, 1e-3);
          const nota = clamp(1 - erro * 0.9);
          notas.push(nota);
          peca.cortar('y', golpe.h);
          p.feito = true;
          golpe = null;
          audio.corte();
          hud.aviso(nota >= 0.85 ? 'Camadas por igual!' : nota >= 0.6 ? 'Bom corte.' : 'Saiu torto, mas abriu.', nota >= 0.6 ? 'bom' : 'neutro');
          if (!proxima()) {
            exec.nota = notas.reduce((s2, n) => s2 + n, 0) / notas.length;
            exec.comentario = comentar(exec.nota, 'Espessura igual nas duas partes: cozinha por igual.', 'Quase igual; uma parte ficou um pouco mais grossa.', 'Partes desiguais cozinham em tempos diferentes.');
            exec.concluido = true;
          }
        }
        return;
      }
      if (faca) mesa.ferramentaEm(peca.localToWorld(new THREE.Vector3(L * 0.65, h, 0)), peca.rotation.y, 0, Math.PI / 2);
      if (entrada.cliqueNovo && ponto) {
        if (ctx.modo === 'prova' && Math.abs(h - p.pos) > H * 0.25) {
          hud.aviso('Longe da guia: ajuste a altura da faca.', 'ajuste');
          return;
        }
        golpe = { h, t: 0 };
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
