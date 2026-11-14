// Chama Azul: ponto de entrada. Monta a cozinha, o jogador e as telas, e roda o laço do jogo.
import * as THREE from 'three';
import './ui/estilo.css';
import catalogoBruto from './dados/catalogo.json';
import type { Catalogo, Tecnica } from './tipos';
import { criarCozinha } from './cena/cozinha';
import { Jogador } from './motor/jogador';
import { Entrada } from './motor/entrada';
import { audio } from './motor/audio';
import { HudHtml } from './ui/hud';
import { Telas } from './ui/telas';
import { Missao, estrelas } from './missao';
import { NOME_GESTO } from './gestos';
import { carregar, registrar, salvar } from './progresso';
import { Peca } from './pecas/peca';
import { criarFormaGenerica } from './modelos/alimentos';
import { formatarTempo } from './gestos/base';
import { ControlesToque, ehToque, textoParaToque } from './ui/toque';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const catalogo = catalogoBruto as unknown as Catalogo;
const frases = [
  'Acendendo o fogão...',
  'Afiando as facas...',
  'Lavando as ervas...',
  'Separando as claras...',
  'Abrindo a janela para a chuva...',
  'Esquentando a frigideira...',
];

type Estado = 'menu' | 'andar' | 'caderno' | 'missao' | 'resultado';

async function iniciar() {
  const fraseEl = document.getElementById('frase')!;
  let fi = 0;
  const trocaFrase = setInterval(() => (fraseEl.textContent = frases[++fi % frases.length]), 900);
  await new Promise((r) => setTimeout(r, 30));

  const canvas = document.getElementById('jogo') as HTMLCanvasElement;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    fraseEl.textContent = 'Seu navegador não liberou o WebGL. Tente outro navegador ou ative a aceleração de hardware.';
    clearInterval(trocaFrase);
    return;
  }
  const celular = ehToque();
  // no celular, menos pixels por quadro: fica leve e ainda nítido
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.02, 60);
  // reflexos suaves para tudo (inox, esmalte, alimentos úmidos), não só para a cozinha
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.45;
  pmrem.dispose();
  const cozinha = criarCozinha();
  cena.add(cozinha.grupo);

  const jogador = new Jogador(camera);
  jogador.definirColisores(cozinha.colisores);
  const entrada = new Entrada(canvas);
  const progresso = carregar();
  jogador.sensibilidade = 0.0022 * progresso.sensibilidade;
  audio.ligado = progresso.som;
  audio.volumeMusica = progresso.musica;
  audio.volumeChuva = progresso.chuva;
  // o navegador só libera som depois de um gesto: o primeiro clique, toque ou tecla em qualquer lugar liga tudo
  const liberarSom = () => {
    if (progresso.som) audio.iniciar();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, liberarSom, { capture: true, passive: true });

  const ui = document.getElementById('ui')!;
  const hud = new HudHtml(ui);
  if (celular) hud.transformar = textoParaToque;
  if (celular) hud.btnSair.textContent = 'Sair';
  let estado: Estado = 'menu';
  let missao: Missao | null = null;

  const telas = new Telas(ui, catalogo, progresso, {
    entrar: () => entrar(),
    comecar: (t) => comecar(t),
    fecharCaderno: () => fecharCaderno(),
    alternarModo: () => {
      progresso.modo = progresso.modo === 'zen' ? 'prova' : 'zen';
      salvar(progresso);
    },
    alternarSom: () => {
      progresso.som = !progresso.som;
      audio.definirLigado(progresso.som);
      if (progresso.som) audio.iniciar();
      salvar(progresso);
    },
    volume: (qual, v) => {
      if (qual === 'musica') {
        progresso.musica = v;
        audio.definirMusica(v);
      } else {
        progresso.chuva = v;
        audio.definirChuva(v);
      }
      salvar(progresso);
    },
  });

  // pré-compila os materiais (inclusive os com planos de recorte) para não travar no primeiro corte
  const amostra = new Peca(criarFormaGenerica('cenoura'));
  amostra.position.set(0, -5, 0);
  amostra.cortar('x', 0);
  amostra.cortar('z', 0);
  cena.add(amostra);
  amostra.atualizar(0);
  const caderno = cozinha.estacoes.caderno;
  camera.position.copy(cozinha.inicio.posicao);
  camera.lookAt(cozinha.inicio.olhar);
  try {
    await (renderer as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void> }).compileAsync?.(cena, camera);
  } catch {
    renderer.compile(cena, camera);
  }
  renderer.render(cena, camera);
  cena.remove(amostra);
  amostra.descartar();

  // vitrine do menu: câmera passeando devagar pela cozinha
  let tVitrine = 0;
  const centroVitrine = cozinha.estacoes.corte.superficie.clone();
  const vitrine = (dt: number) => {
    tVitrine += dt * 0.05;
    const r = 2.6;
    const p = new THREE.Vector3(centroVitrine.x + Math.cos(tVitrine) * r, 1.9 + Math.sin(tVitrine * 0.7) * 0.15, centroVitrine.z + Math.sin(tVitrine) * r);
    camera.position.lerp(p, Math.min(1, dt * 2));
    camera.lookAt(centroVitrine.x, centroVitrine.y + 0.1, centroVitrine.z);
  };

  function entrar() {
    audio.iniciar();
    audio.definirMusica(progresso.musica);
    telas.mostrar(telas.menu, false);
    jogador.modo = 'livre';
    jogador.voar(cozinha.inicio.posicao.clone().setY(1.65), cozinha.inicio.olhar, 1.6, () => {
      jogador.posicionar(cozinha.inicio.posicao, cozinha.inicio.olhar);
      jogador.modo = 'andar';
    });
    estado = 'andar';
    telas.mostrar(telas.mira, true);
    telas.mostrar(telas.dicaAndar, true);
  }

  function abrirCaderno() {
    if (document.pointerLockElement) document.exitPointerLock();
    estado = 'caderno';
    telas.abrirCaderno();
    telas.mostrar(telas.mira, false);
    telas.mostrar(telas.dicaAndar, false);
  }

  function fecharCaderno() {
    telas.mostrar(telas.caderno, false);
    estado = 'andar';
    telas.mostrar(telas.mira, true);
    telas.mostrar(telas.dicaAndar, true);
  }

  function comecar(t: Tecnica) {
    telas.mostrar(telas.caderno, false);
    telas.mostrar(telas.resultado, false);
    telas.mostrar(telas.mira, false);
    telas.mostrar(telas.dicaAndar, false);
    if (document.pointerLockElement) document.exitPointerLock();
    missao?.encerrar();
    hud.limpar();
    hud.definirTecnica(t.nome, t.passos.length);
    hud.mostrar(true);
    estado = 'missao';
    audio.iniciar();
    missao = new Missao(t, cena, cozinha, jogador, entrada, hud, progresso.modo, {
      aoPasso(i, total) {
        const p = t.passos[i];
        hud.marcarPasso(i, 'atual');
        hud.definirPasso(i, total, NOME_GESTO[p.gesto], p.alvo, p.parametro, p.acao);
        hud.medidores([]);
        hud.dica('');
      },
      aoResultadoPasso(i, r) {
        hud.marcarPasso(i, r.nota >= 0.85 ? 'bom' : r.nota >= 0.6 ? 'medio' : 'fraco');
        if (r.comentario && !r.pulado) hud.aviso(r.comentario, r.nota >= 0.6 ? 'bom' : 'neutro');
        hud.medidores([]);
        hud.botao(null);
      },
      aoFim(resultados) {
        const e = estrelas(resultados);
        registrar(progresso, t.id, e);
        audio.conclusao(e);
        hud.mostrar(false);
        estado = 'resultado';
        const prox = proximaDe(t);
        telas.mostrarResultado(
          t,
          resultados,
          e,
          () => comecar(t),
          prox ? () => comecar(prox) : null,
          () => {
            telas.mostrar(telas.resultado, false);
            sairDaMissao();
            abrirCaderno();
          },
        );
      },
    });
    missao.iniciar();
  }

  function proximaDe(t: Tecnica): Tecnica | null {
    const mesmas = catalogo.tecnicas.filter((x) => x.bancada === t.bancada);
    const i = mesmas.indexOf(t);
    for (let k = 1; k <= mesmas.length; k++) {
      const c = mesmas[(i + k) % mesmas.length];
      if (!progresso.feitas[c.id]) return c;
    }
    const resto = catalogo.tecnicas.find((x) => !progresso.feitas[x.id]);
    return resto ?? null;
  }

  function sairDaMissao() {
    missao?.encerrar();
    missao = null;
    hud.mostrar(false);
    hud.limpar();
    estado = 'andar';
    const recuo = jogador.direcao().setY(0).normalize().multiplyScalar(-0.5);
    jogador.voltarAAndar(recuo);
    telas.mostrar(telas.mira, true);
    telas.mostrar(telas.dicaAndar, true);
  }

  const toque = celular ? new ControlesToque(ui, entrada, () => estado === 'andar' && abrirCaderno()) : null;
  hud.btnPular.addEventListener('click', () => missao?.pular());
  hud.btnSair.addEventListener('click', () => sairDaMissao());

  canvas.addEventListener('click', () => {
    if (estado !== 'andar' || jogador.voando) return;
    if (olhandoCaderno()) {
      abrirCaderno();
      return;
    }
    if (!document.pointerLockElement && !entrada.toque && !celular) canvas.requestPointerLock?.();
  });

  function olhandoCaderno() {
    const d = caderno.superficie.clone().sub(camera.position);
    const dist = d.length();
    return dist < 2.8 && d.normalize().dot(jogador.direcao()) > 0.93;
  }

  const ajustarTamanho = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    // tela em pé: abre a lente para manter a largura de visão de uma tela deitada
    const graus = Math.PI / 180;
    camera.fov = camera.aspect < 1 ? Math.min(92, (2 * Math.atan(Math.tan(31 * graus) * (1.3 / Math.max(camera.aspect, 0.35)) * 0.62)) / graus) : 62;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', ajustarTamanho);
  new ResizeObserver(ajustarTamanho).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.ctx?.suspend();
    else audio.ctx?.resume();
  });

  clearInterval(trocaFrase);
  const carregando = document.getElementById('carregando')!;
  carregando.classList.add('sai');
  setTimeout(() => carregando.remove(), 700);

  // atalho: ?tecnica=<id> abre direto uma técnica (para compartilhar ou testar)
  const pedida = new URLSearchParams(location.search).get('tecnica');
  const tPedida = pedida ? catalogo.tecnicas.find((t) => t.id === pedida) : undefined;
  if (tPedida) {
    telas.mostrar(telas.menu, false);
    jogador.posicionar(cozinha.inicio.posicao, cozinha.inicio.olhar);
    comecar(tPedida);
  }
  (window as unknown as Record<string, unknown>).chamaAzul = {
    comecar: (id: string) => {
      const t = catalogo.tecnicas.find((x) => x.id === id);
      if (t) comecar(t);
    },
    catalogo,
    audio,
    camera,
    canvas,
    THREE,
    get missao() {
      return missao;
    },
    get estado() {
      return estado;
    },
  };

  const relogio = new THREE.Clock();
  let tempo = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, relogio.getDelta());
    tempo += dt;
    // teclas globais
    if (entrada.apertou('escape')) {
      if (estado === 'caderno') fecharCaderno();
      else if (estado === 'missao') sairDaMissao();
    }
    if (entrada.apertou('c') && estado === 'andar') abrirCaderno();
    if (estado === 'menu') vitrine(dt);
    else jogador.atualizar(dt, entrada, document.pointerLockElement === canvas);
    if (estado === 'andar') {
      const alvo = olhandoCaderno();
      telas.mira.classList.toggle('alvo', alvo);
      telas.dicaAndar.innerHTML = alvo
        ? `${celular ? 'Toque' : 'Clique'} para abrir o <b>caderno de técnicas</b>`
        : celular
          ? 'Joystick para andar · arraste para olhar · <b>Caderno</b> para escolher uma técnica'
          : document.pointerLockElement
          ? '<b>WASD</b> para andar · vá até o caderno no púlpito ou aperte <b>C</b>'
          : 'Clique para olhar em volta · <b>C</b> abre o caderno de técnicas';
    }
    if (missao && estado === 'missao') {
      missao.atualizar(dt);
      const esc = missao.relogio.escala;
      hud.definirTempo(esc > 1 ? `Relógio da cozinha ×${esc} · ${formatarTempo(missao.relogio.decorrido / 60)}` : '');
    }
    toque?.mostrar(estado === 'andar' && !jogador.voando ? 'andar' : estado === 'missao' ? 'trabalho' : 'nada');
    cozinha.atualizar(dt, tempo);
    audio.atualizar();
    renderer.render(cena, camera);
    entrada.fimDoQuadro();
  });
}

iniciar();
