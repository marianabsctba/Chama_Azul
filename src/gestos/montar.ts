// Montar (amarrar, enrolar, trançar, rechear, dobrar, decorar, virar, forrar, moldar),
// confeitar com saco, testar o ponto e separar partes.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar } from './base';
import { anguloDaEstacao, ehLiquido } from './mesa';
import { criarFormaGenerica } from '../modelos/alimentos';
import { Peca } from '../pecas/peca';
import { audio } from '../motor/audio';

const matFio = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9 });
const matFantasma = new THREE.MeshBasicMaterial({ color: '#8fdcff', transparent: true, opacity: 0.45, depthWrite: false });
const geoMarca = new THREE.SphereGeometry(1, 14, 10);

function prepararPeca(ctx: ContextoGesto) {
  const { passo, mesa, estacao } = ctx;
  const chave = passo.alimento ?? passo.alvo;
  mesa.removerRecipiente(true);
  const peca = mesa.garantirPeca(chave, estacao.superficie.clone());
  peca.rotation.y = anguloDaEstacao(estacao);
  peca.position.copy(estacao.superficie);
  peca.updateMatrixWorld(true);
  return peca;
}

function marca(ctx: ContextoGesto, pos: THREE.Vector3, tam = 0.008) {
  const m = new THREE.Mesh(geoMarca, matFantasma);
  m.scale.setScalar(tam);
  m.position.copy(pos);
  m.renderOrder = 6;
  ctx.mesa.adicionarExtra(m);
  return m;
}

/** Sequência de pontos para clicar em ordem; cada clique chama aoAcertar. */
function sequencia(ctx: ContextoGesto, pontos: THREE.Vector3[], dica: string, aoAcertar: (i: number) => void, fim: (nota: number) => string): Execucao {
  const { entrada, camera, hud } = ctx;
  const marcas = pontos.map((p) => marca(ctx, p));
  let i = 0;
  const erros: number[] = [];
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar() {
      hud.dica(dica);
      hud.medidores([{ rotulo: 'Progresso', valor: i / pontos.length, texto: `${i} de ${pontos.length}` }]);
      marcas.forEach((m, k) => {
        m.visible = k >= i;
        m.scale.setScalar(k === i ? 0.011 : 0.007);
      });
      if (!entrada.cliqueNovo || i >= pontos.length) return;
      const r = entrada.raio(camera);
      const d = r.ray.distanceToPoint(pontos[i]);
      const tol = 0.03 * (ctx.modo === 'zen' ? 1.5 : 1);
      if (d < tol) {
        erros.push(d / tol);
        aoAcertar(i);
        i++;
        audio.acerto(0.5);
        if (i >= pontos.length) {
          exec.nota = clamp(1 - (erros.reduce((s, x) => s + x, 0) / erros.length) * 0.5);
          exec.comentario = fim(exec.nota);
          exec.concluido = true;
        }
      }
    },
    descartar() {
      ctx.mesa.limparExtras();
    },
  };
  return exec;
}

export function gestoMontar(ctx: ContextoGesto): Execucao {
  const v = ctx.passo.variante;
  const peca = prepararPeca(ctx);
  const { passo, mesa, entrada, camera, hud, estacao } = ctx;
  const L = peca.comprimento;
  const s = peca.scale.x;
  const topo = (lx: number, lz = 0) => {
    const sec = peca.forma.secao(lx);
    return peca.localToWorld(new THREE.Vector3(lx, sec.centroY + sec.raioY * Math.sqrt(Math.max(0, 1 - (lz / Math.max(sec.raioZ, 1e-4)) ** 2)), lz));
  };

  if (v === 'amarrar') {
    const xs = [-0.3, -0.1, 0.1, 0.3].map((f) => f * L);
    return sequencia(
      ctx,
      xs.map((x) => topo(x)),
      'Clique nos pontos para passar o barbante e dar o nó em cada um, firme sem apertar demais.',
      (i) => {
        const x = xs[i];
        const sec = peca.forma.secao(x);
        const anel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 32), matFio);
        anel.rotation.y = Math.PI / 2;
        // o toro nasce no plano XY; girado em Y, o X local vira o Z do mundo
        anel.scale.set(sec.raioZ * 1.03, sec.raioY * 1.03, 1);
        anel.position.set(x, sec.centroY, 0);
        anel.castShadow = true;
        // aperto leve da carne
        peca.add(anel);
        ctx.mesa.adicionarExtra(new THREE.Object3D()); // mantém a contagem de extras consistente
        (peca.userData.fios ??= []).push(anel);
      },
      (n) => comentar(n, 'Amarrado por igual, vai manter a forma no cozimento.', 'Bem amarrado.', 'Fios fora do lugar deixam a peça torta.'),
    );
  }

  if (v === 'decorar' || v === 'rechear' && /colocar|distribuir/.test(passo.parametro)) {
    const pontos = [-0.3, 0, 0.3].flatMap((fx) => [-0.18, 0.18].map((fz) => topo(fx * L, fz * peca.largura)));
    return sequencia(
      ctx,
      pontos,
      'Clique nos pontos marcados para dispor a guarnição com capricho.',
      (i) => {
        const g = new Peca(criarFormaGenerica(/erva|salsa|folha|cerefólio|ciboulette|cebolinha/.test(passo.alvo) ? 'folha de salsa' : passo.alvo || 'guarnição'));
        const maior = Math.max(g.comprimento, g.largura);
        g.scale.setScalar(Math.min(1, (0.035 / maior)));
        g.position.copy(pontos[i]);
        g.rotation.y = Math.random() * Math.PI;
        ctx.mesa.adicionarExtra(g);
      },
      (n) => comentar(n, 'Apresentação caprichada.', 'Bonito.', 'Ficou meio torto, mas gostoso.'),
    );
  }

  // gestos contínuos
  const escala0 = peca.scale.clone();
  const rot0 = peca.rotation.clone();
  let progresso = 0;
  let direcao = 0;
  let acum = 0;
  let movimentos = 0;
  let enchimento = 0;
  let dobras = 0;
  const alvoDobras = Math.max(1, Math.min(6, passo.meta?.unidade === undefined ? (/tr[eê]s|3/.test(passo.parametro) ? 3 : 2) : 2));
  let virando = 0;
  let recheio: THREE.Mesh | null = null;
  let folha: THREE.Mesh | null = null;
  const fios: THREE.Mesh[] = [];
  if (v === 'rechear') {
    recheio = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: ehLiquido(passo.alvo) ? '#f1e2b8' : '#a8794d', roughness: 0.7 }));
    recheio.position.copy(topo(0));
    recheio.scale.setScalar(0.0001);
    mesa.adicionarExtra(recheio);
  }
  if (v === 'forrar') {
    folha = new THREE.Mesh(new THREE.PlaneGeometry(L * s * 1.5, peca.largura * s * 1.6, 8, 8), new THREE.MeshStandardMaterial({ color: /massa/.test(passo.alvo) ? '#efd9a8' : '#f4efe4', roughness: 0.8, side: THREE.DoubleSide }));
    folha.rotation.x = -Math.PI / 2;
    folha.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.25, 0));
    mesa.adicionarExtra(folha);
  }
  if (v === 'trancar') {
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, L * s * 0.9, 6, 12), new THREE.MeshStandardMaterial({ color: '#ecd3a0', roughness: 0.7 }));
      f.rotation.z = Math.PI / 2;
      f.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.014, (k - 1) * 0.03));
      f.castShadow = true;
      mesa.adicionarExtra(f);
      fios.push(f);
    }
    peca.visible = false;
  }
  const dica: Record<string, string> = {
    enrolar: 'Segure o botão e arraste para cima na tela, enrolando a peça por igual e bem justa.',
    trancar: 'Clique alternando: a mecha de fora passa por cima da do meio, de um lado e depois do outro.',
    rechear: 'Segure o botão para pôr o recheio. Solte quando a medida estiver na faixa azul: sem transbordar.',
    dobrar: 'Arraste da direita para a esquerda para dobrar a massa sobre si mesma.',
    virar: 'Segure, puxe o mouse para cima com decisão e solte para virar ou desenformar.',
    forrar: 'Arraste a folha até cobrir a forma e solte; depois ajuste as bordas.',
    moldar: 'Segure e faça círculos pequenos sobre a peça para dar forma, como quem boleia.',
  };
  let ladoTranca = 0;
  let inicioArraste: THREE.Vector2 | null = null;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica(dica[v] ?? dica.moldar);
      let nota = 0.92;
      if (v === 'enrolar') {
        if (entrada.pressionado) progresso = clamp(progresso + Math.max(0, -entrada.deltaPx.y) / 500);
        const k = progresso;
        peca.scale.set(escala0.x * (1 - 0.15 * k), escala0.y * (1 + 0.5 * k), escala0.z * (1 - 0.35 * k));
        peca.rotation.x = rot0.x + k * Math.PI * 0.12;
        hud.medidores([{ rotulo: 'Enrolado', valor: progresso }]);
      } else if (v === 'trancar') {
        if (entrada.cliqueNovo) {
          const a = ladoTranca % 2 === 0 ? 0 : 2;
          const p0 = fios[a].position.z;
          fios[a].position.z = fios[1].position.z;
          fios[1].position.z = p0;
          [fios[a], fios[1]] = [fios[1], fios[a]];
          fios.forEach((f, k) => (f.position.y = estacao.superficie.y + 0.014 + (k === 1 ? 0.006 : 0)));
          ladoTranca++;
          audio.clique();
        }
        progresso = clamp(ladoTranca / 8);
        fios.forEach((f) => (f.scale.y = 1 - progresso * 0.2));
        hud.medidores([{ rotulo: 'Trança', valor: progresso, texto: `${ladoTranca} de 8` }]);
      } else if (v === 'rechear') {
        if (entrada.pressionado) enchimento = Math.min(1.3, enchimento + dt * 0.35);
        recheio!.scale.setScalar(0.0001 + enchimento * peca.largura * s * 0.35);
        hud.medidores([{ rotulo: 'Recheio', valor: enchimento / 1.3, faixa: [0.75 / 1.3, 0.95 / 1.3] }]);
        if (!entrada.pressionado && enchimento > 0.3 && hud.botao('Pronto')) {
          nota = clamp(1 - Math.abs(enchimento - 0.85) * 3);
          progresso = 1;
        }
      } else if (v === 'dobrar') {
        if (entrada.cliqueNovo) inicioArraste = entrada.px.clone();
        if (entrada.soltouNovo && inicioArraste) {
          const dx = entrada.px.x - inicioArraste.x;
          if (dx < -60) {
            dobras++;
            peca.scale.set(peca.scale.x * 0.62, peca.scale.y * 1.5, peca.scale.z);
            audio.acerto(0.5);
          }
          inicioArraste = null;
        }
        progresso = clamp(dobras / alvoDobras);
        hud.medidores([{ rotulo: 'Dobras', valor: progresso, texto: `${dobras} de ${alvoDobras}` }]);
      } else if (v === 'virar') {
        if (entrada.pressionado) virando = clamp(virando + Math.max(0, -entrada.deltaPx.y) / 220);
        else if (virando < 0.6) virando = Math.max(0, virando - dt * 2);
        else virando = Math.min(1, virando + dt * 3);
        peca.rotation.x = rot0.x + virando * Math.PI;
        peca.position.y = estacao.superficie.y + Math.sin(virando * Math.PI) * 0.12 + (virando > 0.5 ? peca.altura * s : 0) * clamp((virando - 0.5) * 2);
        progresso = virando >= 1 ? 1 : 0;
        hud.medidores([{ rotulo: 'Virada', valor: virando }]);
      } else if (v === 'forrar') {
        const yFolha = estacao.superficie.y + peca.altura * s + 0.004;
        const ponto = entrada.noPlano(camera, yFolha);
        if (entrada.pressionado && ponto && folha) folha.position.lerp(ponto.clone().setY(yFolha), Math.min(1, dt * 12));
        if (folha) {
          const d = folha.position.clone().setY(0).distanceTo(estacao.superficie.clone().setY(0));
          if (!entrada.pressionado && d < 0.05) {
            progresso = 1;
            nota = clamp(1 - d * 15);
          }
          hud.medidores([{ rotulo: 'Encaixe', valor: clamp(1 - d * 6) }]);
        }
      } else {
        // moldar
        if (entrada.pressionado) {
          const d = entrada.deltaPx.length();
          acum += d;
          if (acum > 140) {
            movimentos++;
            acum = 0;
          }
        }
        progresso = clamp(movimentos / 10);
        const k = progresso;
        const r = Math.cbrt(escala0.x * escala0.y * escala0.z);
        peca.scale.set(escala0.x + (r - escala0.x) * k, escala0.y + (r - escala0.y) * k, escala0.z + (r - escala0.z) * k);
        peca.rotation.y += entrada.pressionado ? dt * 2 : 0;
        hud.medidores([{ rotulo: 'Forma', valor: progresso }]);
      }
      void direcao;
      if (progresso >= 1) {
        exec.nota = nota;
        exec.comentario = comentar(nota, 'Montagem bonita e firme.', 'Montado direitinho.', 'Montado, mas dá para caprichar mais.');
        exec.concluido = true;
      }
    },
    descartar() {
      peca.visible = true;
      mesa.limparExtras();
      hud.botao(null);
    },
  };
  return exec;
}

/** Cor do creme a confeitar. */
function corDoCreme(texto: string) {
  const t = texto.toLowerCase();
  if (/chocolate|ganache/.test(t)) return '#5a3420';
  if (/caf[eé]|mocha/.test(t)) return '#a77a52';
  if (/morango|framboesa|rosa/.test(t)) return '#f1a7b8';
  if (/choux|massa|bomba|[eé]clair|biscoito|palito/.test(t)) return '#efd29a';
  if (/pur[eê]|batata/.test(t)) return '#f2dea0';
  if (/limão|amarelo|gema/.test(t)) return '#f6e27a';
  return '#fcfaf3';
}

export function gestoConfeitar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud, cena } = ctx;
  mesa.removerPeca();
  mesa.removerRecipiente(true);
  // prato de base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.012, 48), new THREE.MeshStandardMaterial({ color: '#f7f7fb', roughness: 0.35 }));
  base.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.006, 0));
  base.receiveShadow = true;
  mesa.adicionarExtra(base);
  const y = estacao.superficie.y + 0.013;
  const texto = `${passo.alvo} ${passo.parametro}`;
  // desenho a seguir: linhas para bombas e éclairs, espiral para rosetas, círculo para bordas
  const caminho: THREE.Vector3[] = [];
  const c = estacao.superficie.clone().setY(y);
  const ang = anguloDaEstacao(estacao);
  const rot = (x: number, z: number) => new THREE.Vector3(x * Math.cos(ang) + z * Math.sin(ang), 0, -x * Math.sin(ang) + z * Math.cos(ang)).add(c);
  if (/[eé]clair|bomba|bast[aã]o|tira|linha|palito|dedo/.test(texto)) {
    for (let l = 0; l < 3; l++) for (let i = 0; i <= 8; i++) caminho.push(rot(-0.08 + (0.16 * i) / 8, -0.06 + l * 0.06));
  } else if (/borda|coroa|anel|c[ií]rculo|ninho|savarin/.test(texto)) {
    for (let i = 0; i <= 28; i++) caminho.push(rot(Math.cos((i / 28) * Math.PI * 2) * 0.09, Math.sin((i / 28) * Math.PI * 2) * 0.09));
  } else {
    // rosetas em espiral
    for (const [cx, cz] of [[-0.06, -0.04], [0.06, -0.04], [-0.06, 0.05], [0.06, 0.05]]) {
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 3;
        const r = 0.022 * (1 - i / 12);
        caminho.push(rot(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
      }
    }
  }
  const guias = caminho.map((p) => {
    const m = new THREE.Mesh(geoMarca, matFantasma);
    m.scale.setScalar(0.003);
    m.position.copy(p);
    mesa.adicionarExtra(m);
    return m;
  });
  const coberto = caminho.map(() => false);
  const max = 900;
  const creme = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: corDoCreme(texto), roughness: 0.45 }), max);
  creme.count = 0;
  creme.castShadow = true;
  cena.add(creme);
  const aux = new THREE.Object3D();
  const saco = mesa.pegarFerramenta(/saco|bico|seringa|cone/i.test(passo.utensilio) ? passo.utensilio : '', 'confeitar');
  let fora = 0;
  let ultimo: THREE.Vector3 | null = null;
  let pressao = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica('Segure o botão para apertar o saco e siga os pontinhos claros. Velocidade constante deixa o creme uniforme.');
      const ponto = entrada.noPlano(camera, y);
      if (ponto && saco) mesa.ferramentaEm(ponto.clone().setY(y + 0.012), 0, Math.PI / 2 - 0.15, 0);
      pressao = entrada.pressionado ? Math.min(1, pressao + dt * 4) : Math.max(0, pressao - dt * 6);
      if (ponto && pressao > 0.2 && creme.count < max) {
        const dist = ultimo ? ponto.distanceTo(ultimo) : 1;
        if (dist > 0.0025) {
          const tam = 0.0045 + 0.004 * pressao - Math.min(0.003, dist * 0.08);
          aux.position.copy(ponto).setY(y + tam * 0.6);
          aux.scale.set(tam, tam * 0.75, tam);
          aux.updateMatrix();
          creme.setMatrixAt(creme.count++, aux.matrix);
          creme.instanceMatrix.needsUpdate = true;
          ultimo = ponto.clone();
          let perto = false;
          caminho.forEach((p, i) => {
            if (p.distanceTo(ponto) < 0.011) {
              coberto[i] = true;
              perto = true;
            }
          });
          if (!perto) fora++;
        }
      } else if (!entrada.pressionado) ultimo = null;
      guias.forEach((g, i) => (g.visible = !coberto[i]));
      const prog = coberto.filter(Boolean).length / coberto.length;
      hud.medidores([
        { rotulo: 'Desenho', valor: prog, texto: `${Math.round(prog * 100)}%` },
        { rotulo: 'Pressão', valor: pressao },
      ]);
      if (prog >= 0.95 || (prog >= 0.8 && hud.botao('Pronto'))) {
        const total = Math.max(1, creme.count);
        exec.nota = clamp(prog - (fora / total) * 0.8 + 0.05);
        exec.comentario = comentar(exec.nota, 'Desenho limpo e uniforme.', 'Bonito, com uns respingos fora.', 'Saiu do desenho em vários pontos.');
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(creme);
      creme.geometry.dispose();
      (creme.material as THREE.Material).dispose();
      mesa.soltarFerramenta();
      mesa.limparExtras();
      hud.botao(null);
    },
  };
  return exec;
}

/** Observar e decidir: o jogador vê a peça num estado e diz se está no ponto. */
export function gestoTestar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, hud, tecnica } = ctx;
  const solido = passo.alimento && !ehLiquido(passo.alvo);
  const estados = [0.55, 1, 1.4];
  const sorteio = (tecnica.id.length * 7 + passo.alvo.length * 3) % 3;
  const estado = estados[sorteio];
  if (solido) {
    const peca = mesa.garantirPeca(passo.alimento!, estacao.superficie.clone());
    if (!mesa.recipiente) {
      peca.position.copy(estacao.superficie);
      peca.rotation.y = anguloDaEstacao(estacao);
    }
    peca.definirCozimento(Math.max(peca.cozimento, 0) > 0.2 ? estado : estado * 0.6);
  } else {
    if (!mesa.recipiente) mesa.garantirRecipiente('tigela', estacao.superficie.clone(), 'tigela');
    const c = mesa.garantirConteudo(passo.alvo, 0.45);
    c.estado.espessura = [0.15, 0.55, 0.95][sorteio];
    c.estado.picos = /clara|neve|creme|chantilly/.test(passo.alvo) ? [0.1, 0.8, 1][sorteio] : 0;
  }
  const opcoes = ['Ainda não', 'No ponto', 'Passou do ponto'];
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar() {
      hud.dica(`Observe com atenção. ${passo.parametro ? 'Referência: ' + passo.parametro + '.' : ''}`);
      hud.medidores([]);
      const r = hud.escolha(`${passo.alvo}: como está?`, opcoes);
      if (r >= 0) {
        hud.escolha(null);
        const certo = r === sorteio;
        exec.nota = certo ? 1 : 0.35;
        exec.comentario = certo ? `Isso. ${tecnica.ponto_critico}` : `Na verdade estava "${opcoes[sorteio].toLowerCase()}". ${tecnica.ponto_critico}`;
        if (certo) audio.acerto(1);
        exec.concluido = true;
      }
    },
    descartar() {
      hud.escolha(null);
    },
  };
  return exec;
}

/** Separar: puxar uma parte para longe da outra com calma. */
export function gestoSeparar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const peca = prepararPeca(ctx);
  if (peca.fragmentos.length < 2) peca.cortar('x', 0);
  const lado = peca.fragmentos.filter((f) => f.x0 >= -1e-4);
  const alvoDist = 0.12 / Math.max(peca.scale.x, 0.01);
  let dist = 0;
  let pressa = 0;
  let segurando = false;
  const inicio = new THREE.Vector3();
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica('Segure a parte da direita e puxe com calma para longe, até a marca.');
      const ponto = entrada.noPlano(camera, estacao.superficie.y + 0.02);
      if (entrada.cliqueNovo && ponto) {
        segurando = true;
        inicio.copy(ponto);
      }
      if (!entrada.pressionado) segurando = false;
      if (segurando && ponto) {
        const local = peca.worldToLocal(ponto.clone()).sub(peca.worldToLocal(inicio.clone()));
        const novo = clamp(local.x, 0, alvoDist * 1.1);
        const vel = Math.abs(novo - dist) / Math.max(dt, 1e-3) * peca.scale.x;
        if (vel > 0.6) pressa += dt;
        dist = novo;
      }
      for (const f of lado) peca.moverFragmento(f, new THREE.Vector3(dist + 0.004, dist > 0.01 ? 0.002 : 0, 0));
      const prog = clamp(dist / alvoDist);
      hud.medidores([{ rotulo: 'Separado', valor: prog }]);
      if (prog >= 1) {
        exec.nota = clamp(1 - pressa * 0.8);
        exec.comentario = comentar(exec.nota, 'Separado limpo, sem rasgar.', 'Separado, com um puxão mais forte.', 'Puxou rápido demais; pode romper.');
        exec.concluido = true;
      }
    },
    descartar() {
      void passo;
    },
  };
  return exec;
}
