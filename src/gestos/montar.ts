// Montar (amarrar, enrolar, trançar, rechear, dobrar, decorar, virar, forrar, moldar),
// confeitar com saco, testar o ponto e separar partes.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar } from './base';
import { anguloDaEstacao, aoLado, ehLiquido } from './mesa';
import { criarFormaAlimento, criarFormaGenerica, familiaDe, textoReconhecido } from '../modelos/alimentos';
import { estadoInicial } from '../pecas/conteudo';
import { criarUtensilio } from '../modelos/utensilios';
import { Peca } from '../pecas/peca';
import { audio } from '../motor/audio';
import { gestoTempo } from './tempo_verter';

const VASO_NO_FOGO = /frigideira|wok|panela|caçarola|chapa|^aro$/i;
const matFio = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9 });
const matFantasma = new THREE.MeshBasicMaterial({ color: '#8fdcff', transparent: true, opacity: 0.45, depthWrite: false });
const geoMarca = new THREE.SphereGeometry(1, 14, 10);

/**
 * A guarnição do passo: a da ficha, ervas quando o texto fala de ervas, ou o alimento que o texto
 * nomeia. Sem nada reconhecível, nada entra (antes entrava uma bolinha branca genérica).
 */
function guarnicao(lista: string[], i: number, alvo: string) {
  if (lista.length) return criarFormaAlimento(lista[i % lista.length]);
  if (/erva|salsa|folha|cerefólio|ciboulette|cebolinha|coentro|endro/.test(alvo)) return criarFormaGenerica('folha de salsa');
  return alvo && textoReconhecido(alvo) ? criarFormaGenerica(alvo) : null;
}

function prepararPeca(ctx: ContextoGesto) {
  const { passo, mesa, estacao } = ctx;
  const chave = passo.alimento ?? passo.alvo;
  // forrar e amarrar seguem o fluxo próprio; os outros gestos montam dentro do vaso que o livro manda
  const naBancada = !['forrar', 'amarrar', 'enrolar', 'trancar'].includes(passo.variante);
  if (!ctx.vaso || !(VASO_NO_FOGO.test(ctx.vaso) || naBancada)) mesa.removerRecipiente(true);
  const peca = mesa.garantirPeca(chave, estacao.superficie.clone());
  peca.rotation.y = anguloDaEstacao(estacao);
  // no vaso que o livro manda (virar a crêpe na frigideira, rechear as forminhas, montar no aro); senão na bancada
  if (!mesa.colocarNoVaso(peca, ctx.vaso, estacao.superficie.clone(), naBancada)) {
    if (ctx.vaso && !VASO_NO_FOGO.test(ctx.vaso)) mesa.removerRecipiente(true);
    peca.position.copy(estacao.superficie);
  }
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

/** Louça em que o prato vai à mesa, pela ficha do livro, para os passos de servir e decorar. */
function loucaDoServir(servir?: string): string {
  if (!servir) return 'prato';
  if (/tigela|cumbuca|tigelinha/.test(servir)) return 'tigela';
  if (/xicara/.test(servir)) return 'tigelinha';
  if (/taca|copo/.test(servir)) return 'taça';
  if (/ramequim/.test(servir)) return 'ramequim';
  return 'prato';
}

/**
 * Decorar ou servir sem peça sólida: o livro põe a guarnição sobre a sopa, o creme ou o molho
 * já na louça. Mostra a louça com o conteúdo e cada clique deposita um elemento por cima.
 */
function decorarServido(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, tecnica } = ctx;
  const ficha = tecnica.prato;
  mesa.removerPeca();
  mesa.garantirRecipiente(loucaDoServir(ficha?.servir), estacao.superficie.clone(), 'prato');
  const conteudo = mesa.garantirConteudo(passo.meio ?? (ficha?.liquido ? tecnica.nome : passo.alvo), 0.55);
  if (ficha?.liquido) conteudo.estado.cor.set(ficha.liquido);
  const topo = (conteudo.position?.y ?? mesa.fundoY) + conteudo.estado.nivel + 0.003;
  const r = mesa.bocaRaio * 0.45;
  const pontos = [0, 1.25, 2.5, 3.75, 5].map((a) => new THREE.Vector3(mesa.centro.x + Math.cos(a) * r * (a === 0 ? 0 : 1), topo, mesa.centro.z + Math.sin(a) * r * (a === 0 ? 0 : 1)));
  const lista = passo.adicionar?.length ? passo.adicionar : (ficha?.acompanhamentos ?? []);
  return sequencia(
    ctx,
    pontos,
    'Clique nos pontos marcados para pôr a guarnição sobre o prato.',
    (i) => {
      const forma = guarnicao(lista, i, passo.alvo);
      if (!forma) return;
      const g = new Peca(forma);
      g.scale.setScalar(Math.min(1, 0.028 / Math.max(g.comprimento, g.largura, 1e-3)));
      g.position.copy(pontos[i]);
      g.rotation.y = i * 1.7;
      mesa.adicionarExtra(g);
    },
    (n) => comentar(n, 'Apresentação caprichada.', 'Bonito.', 'Ficou meio torto, mas gostoso.'),
  );
}

export function gestoMontar(ctx: ContextoGesto): Execucao {
  const v = ctx.passo.variante;
  // servir ou decorar o que já está na louça (sopa, creme, molho): a louça com o conteúdo em cena
  if (!ctx.passo.alimento && (v === 'decorar' || /^servir/.test(ctx.passo.acao))) return decorarServido(ctx);
  const peca = prepararPeca(ctx);
  const { passo, mesa, entrada, camera, hud, estacao } = ctx;
  const L = peca.comprimento;
  const s = peca.scale.x;
  const topo = (lx: number, lz = 0) => {
    const sec = peca.forma.secao(lx);
    return peca.localToWorld(new THREE.Vector3(lx, sec.centroY + sec.raioY * Math.sqrt(Math.max(0, 1 - (lz / Math.max(sec.raioZ, 1e-4)) ** 2)), lz));
  };

  // folha, massa, bacon, alho-poró ou papel que entra neste passo
  const textoPasso = `${passo.alvo} ${passo.parametro} ${passo.utensilio}`;
  // pacote já envolvido: amarrar fecha a folha de vez
  if (v === 'amarrar' && mesa.capa && mesa.capa.enrolado < 1) {
    mesa.capa.enrolado = 1;
    mesa.capa.aplicar();
  }
  if (['enrolar', 'moldar', 'forrar', 'dobrar', 'rechear', 'amarrar'].includes(v) && /folha|massa|filo|bacon|toucinho|presunto|alho[- ]?por|papel|alum[ií]nio|nori|repolho|couve|crepe|tortilha/i.test(passo.alvo + ' ' + passo.parametro)) {
    const c = mesa.garantirCapa(textoPasso, ctx.tecnica.ingredientes.join(' '));
    if (c && v === 'amarrar' && c.enrolado < 1) {
      c.enrolado = 1;
      c.aplicar();
    }
  }
  if (v === 'amarrar') {
    const xs = [-0.3, -0.1, 0.1, 0.3].map((f) => f * L);
    // a amarração usa a fibra que o passo pede: alho-poró e cebolinha ficam verdes
    const fibra = /alho[- ]?por|cebolinha|ciboulette/i.test(textoPasso + ' ' + ctx.tecnica.ingredientes.join(' ')) && !/barbante/i.test(textoPasso) ? '#8dbb5e' : /bacon|toucinho/i.test(textoPasso) ? '#e9a3a0' : '#efe6d2';
    const matAmarra = fibra === '#efe6d2' ? matFio : new THREE.MeshStandardMaterial({ color: fibra, roughness: 0.7 });
    const folga = mesa.capa ? 1.12 : 1.03;
    return sequencia(
      ctx,
      xs.map((x) => topo(x)),
      'Clique nos pontos para passar o barbante e dar o nó em cada um, firme sem apertar demais.',
      (i) => {
        const x = xs[i];
        const sec = peca.forma.secao(x);
        const anel = new THREE.Mesh(new THREE.TorusGeometry(1, fibra === '#efe6d2' ? 0.04 : 0.09, 6, 32), matAmarra);
        anel.rotation.y = Math.PI / 2;
        // o toro nasce no plano XY; girado em Y, o X local vira o Z do mundo
        // a espessura do fio acompanha o tamanho da peça (com 1 no eixo do fio, cada volta virava uma faixa larga)
        anel.scale.set(sec.raioZ * folga, sec.raioY * folga, Math.min(sec.raioZ, sec.raioY) * folga);
        anel.position.set(x, mesa.capa ? Math.max(sec.centroY, sec.raioY * folga) : sec.centroY, 0);
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
        // a guarnição revisada (pepino, gengibre, ervas) ou um palpite pelo texto
        const lista = passo.adicionar?.length ? passo.adicionar : null;
        const forma = guarnicao(lista ?? [], i, passo.alvo);
        if (!forma) return;
        const g = new Peca(forma);
        const maior = Math.max(g.comprimento, g.largura);
        g.scale.setScalar(Math.min(1, 0.035 / maior) / peca.scale.x);
        // fica preso à peça: vai junto para o prato
        g.position.copy(peca.worldToLocal(pontos[i].clone()));
        g.rotation.y = i * 1.9;
        peca.add(g);
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
  // recheio: um montinho do tamanho da colher pedida, no lugar e na cor certos
  let recheioRaio = 0.02;
  if (v === 'rechear') {
    const txt = `${passo.alvo} ${passo.parametro} ${ctx.tecnica.ingredientes.join(' ')}`.toLowerCase();
    const cores: [RegExp, string][] = [
      [/chocolate|ganache/, '#4a2a18'],
      [/espinafre|pesto|ervas|erva|verde|acelga/, '#5d8a3a'],
      [/queijo|ricota|requeij|mussarela|parmes/, '#f3ead2'],
      [/cogumelo|duxelles/, '#7a6450'],
      [/camar|peixe|salm|caranguejo|lagost/, '#f0c8b0'],
      [/carne|lingui|frango|porco|cordeiro|vitela|moída|moida|salsicha/, '#8a5a3c'],
      [/maç|maca|frutas? vermelh|geleia|framboesa|morango|cereja|ameixa/, '#b8423b'],
      [/creme de confeiteiro|creme|custard/, '#f2d98a'],
      [/arroz|risoto/, '#efe6cf'],
    ];
    const cor = cores.find(([re]) => re.test(txt))?.[1] ?? '#c9a36b';
    const maximo = Math.min(peca.comprimento, peca.largura) * s * 0.22;
    recheioRaio = /colher(es)? \(?ch[aá]/.test(txt) ? 0.011 : /colher(es)? \(?sopa/.test(txt) ? 0.016 : 0.022;
    recheioRaio = Math.max(0.006, Math.min(recheioRaio, maximo, 0.035));
    const geo = new THREE.SphereGeometry(1, 20, 14);
    geo.scale(1, 0.55, 1);
    // a cor vem do ingrediente revisado do recheio, quando houver
    const corRecheio = passo.adicionar?.[0] ? (() => { try { return new Peca(criarFormaAlimento(passo.adicionar![0])).corInterna.getStyle(); } catch { return cor; } })() : cor;
    recheio = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: corRecheio, roughness: 0.75 }));
    const canto = /canto|ponta|beirada|extremidade/.test(txt);
    recheio.position.copy(canto ? topo(-L * 0.28, -peca.largura * 0.22) : topo(0));
    recheio.scale.setScalar(0.0001);
    recheio.castShadow = true;
    mesa.adicionarExtra(recheio);
  }
  if (v === 'forrar') {
    // pouco maior que a fôrma; papel-manteiga e vegetal são translúcidos e deixam ver a massa embaixo
    const deMassa = /massa/.test(passo.alvo) && !/papel|alum[ií]nio|filme/i.test(passo.utensilio);
    folha = new THREE.Mesh(new THREE.PlaneGeometry(L * s * 1.18, peca.largura * s * 1.18, 8, 8), new THREE.MeshStandardMaterial({ color: deMassa ? '#efd9a8' : /alum/i.test(passo.utensilio) ? '#d8dde2' : '#f4efe4', roughness: 0.8, metalness: /alum/i.test(passo.utensilio) ? 0.6 : 0, transparent: !deMassa, opacity: deMassa ? 1 : 0.72, side: THREE.DoubleSide }));
    folha.rotation.x = -Math.PI / 2;
    // a folha começa ao lado, logo acima da bancada: no alto ela ficaria colada na câmera
    folha.position.copy(peca.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(L * s * 1.1, peca.altura * s + 0.02, 0));
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
        if (mesa.capa) {
          // a folha sobe pelos lados e fecha em volta da peça
          mesa.capa.enrolado = k;
          mesa.capa.aplicar();
        } else {
          peca.scale.set(escala0.x * (1 - 0.15 * k), escala0.y * (1 + 0.5 * k), escala0.z * (1 - 0.35 * k));
          peca.rotation.x = rot0.x + k * Math.PI * 0.12;
        }
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
        recheio!.scale.setScalar(0.0001 + (enchimento / 0.85) * recheioRaio);
        hud.medidores([{ rotulo: 'Recheio', valor: enchimento / 1.3, faixa: [0.75 / 1.3, 0.95 / 1.3] }]);
        if (!entrada.pressionado && enchimento > 0.3 && hud.botao('Pronto')) {
          nota = clamp(1 - Math.abs(enchimento - 0.85) * 3);
          progresso = 1;
          // o recheio passa a fazer parte da peça (vai junto para o forno e o prato)
          const i = mesa.extras.indexOf(recheio!);
          if (i >= 0) mesa.extras.splice(i, 1);
          peca.attach(recheio!);
          // o que a ficha diz que vai no recheio aparece por cima dele (cogumelo, ervas, frutas)
          if (passo.adicionar?.length) mesa.adicionarSobre(passo.adicionar, 'espalhado');
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
        const centroPeca = peca.getWorldPosition(new THREE.Vector3());
        const yFolha = centroPeca.y + peca.altura * s + 0.004;
        const ponto = entrada.noPlano(camera, yFolha);
        if (entrada.pressionado && ponto && folha) folha.position.lerp(ponto.clone().setY(yFolha), Math.min(1, dt * 12));
        if (folha) {
          const d = folha.position.clone().setY(0).distanceTo(centroPeca.clone().setY(0));
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
  const texto = `${passo.alvo} ${passo.parametro}`;
  const onde = `${texto} ${passo.utensilio} ${ctx.vaso ?? ''}`.toLowerCase();
  // a base é onde o livro confeita: sobre o bolo, na assadeira, na taça ou num prato
  let y = estacao.superficie.y + 0.013;
  const famBase = passo.alimento ? familiaDe(passo.alimento) : undefined;
  if (passo.alimento && famBase && ['bolo', 'torta', 'pao', 'massa_bola', 'legume', 'raiz', 'bulbo', 'fuso', 'esferoide', 'cone'].includes(famBase) && !/assadeira|papel|tabuleiro/.test(onde)) {
    mesa.removerRecipiente(true);
    const bolo = mesa.garantirPeca(passo.alimento, estacao.superficie.clone());
    bolo.position.copy(estacao.superficie);
    bolo.updateMatrixWorld(true);
    y = new THREE.Box3().setFromObject(bolo).max.y + 0.002;
  } else if (/ta[cç]a|copo/.test(onde)) {
    mesa.removerPeca();
    const taca = mesa.garantirRecipiente('taça', estacao.superficie.clone(), 'tigela');
    y = new THREE.Box3().setFromObject(taca).max.y - 0.02;
  } else {
    mesa.removerPeca();
    mesa.removerRecipiente(true);
    const assadeira = /assadeira|papel|tabuleiro|[eé]clair|bomba|choux|biscoito|suspiro|merengue|palito|desenhos|enfeite/.test(onde);
    const base = assadeira
      ? new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, 0.24), new THREE.MeshStandardMaterial({ color: '#f1e6cc', roughness: 0.9 }))
      : new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.012, 48), new THREE.MeshStandardMaterial({ color: '#f7f7fb', roughness: 0.35 }));
    base.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.006, 0));
    base.rotation.y = anguloDaEstacao(estacao);
    base.receiveShadow = true;
    mesa.adicionarExtra(base);
    if (assadeira) {
      // a assadeira de metal por baixo do papel
      const metal = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.008, 0.26), new THREE.MeshStandardMaterial({ color: '#8f959c', roughness: 0.4, metalness: 0.7 }));
      metal.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.002, 0));
      metal.rotation.y = base.rotation.y;
      mesa.adicionarExtra(metal);
    }
  }
  // desenho a seguir: linhas para bombas e éclairs, espiral para rosetas, círculo para bordas
  const caminho: THREE.Vector3[] = [];
  const c = estacao.superficie.clone().setY(y);
  const ang = anguloDaEstacao(estacao);
  const rot = (x: number, z: number) => new THREE.Vector3(x * Math.cos(ang) + z * Math.sin(ang), 0, -x * Math.sin(ang) + z * Math.cos(ang)).add(c);
  // montinhos (choux, suspiros, conchas, macarons, biscoitos pingados): o creme cresce parado no ponto
  const montinhos = /bolinha|montinho|gota|choux|profiterol|suspiro|concha|macaron|pingad|pingar|pontinho|carolina/i.test(texto) && !/[eé]clair|bast[aã]o/i.test(texto);
  if (montinhos) {
    for (const cz of [-0.06, 0, 0.06]) for (const cx of [-0.09, -0.03, 0.03, 0.09]) caminho.push(rot(cx, cz));
  } else if (/disco|espiral|base de merengue|fundo/i.test(texto)) {
    // disco em espiral, do centro para fora
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 4.5;
      const r = 0.012 + (i / 60) * 0.085;
      caminho.push(rot(Math.cos(a) * r, Math.sin(a) * r));
    }
  } else if (/[eé]clair|bomba|bast[aã]o|tira|linha|palito|dedo/.test(texto)) {
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
        // o bico saiu de cima do montinho: o próximo aperto começa outro
        if (montinhos && ultimo && ponto.distanceTo(ultimo) > 0.012) ultimo = null;
        if (montinhos && ultimo && creme.count > 0) {
          // apertando parado, o montinho cresce e sobe
          creme.getMatrixAt(creme.count - 1, aux.matrix);
          aux.matrix.decompose(aux.position, aux.quaternion, aux.scale);
          const tam = Math.min(0.016, aux.scale.x + dt * 0.02 * pressao);
          aux.scale.set(tam, tam * 0.8, tam);
          aux.position.setY(y + tam * 0.6);
          aux.updateMatrix();
          creme.setMatrixAt(creme.count - 1, aux.matrix);
          creme.instanceMatrix.needsUpdate = true;
          // o ponto só conta quando o montinho já tem tamanho
          if (tam >= 0.011) caminho.forEach((p, i) => { if (p.distanceTo(aux.position.clone().setY(p.y)) < 0.013) coberto[i] = true; });
        } else if (dist > 0.0025 && !(montinhos && (ultimo || !caminho.some((p) => p.distanceTo(ponto) < 0.012)))) {
          // nos montinhos, cada aperto nasce sobre um ponto marcado e não deixa rastro pelo caminho
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
              if (!montinhos) coberto[i] = true;
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

/** Tigela de água gelada ao lado da panela, com a gota de calda que virou fio ou bolinha. */
function amostraNaAguaGelada(ctx: ContextoGesto, forma: 'fio' | 'bolinha') {
  const { mesa, estacao } = ctx;
  const pos = aoLado(estacao, 0.17);
  const tigela = criarUtensilio('tigela pequena') ?? criarUtensilio('tigela') ?? new THREE.Group();
  tigela.position.copy(pos);
  tigela.scale.setScalar(0.7);
  mesa.adicionarExtra(tigela);
  tigela.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(tigela);
  const r = Math.min(caixa.max.x - caixa.min.x, caixa.max.z - caixa.min.z) * 0.4;
  const yAgua = caixa.min.y + (caixa.max.y - caixa.min.y) * 0.6;
  const agua = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ color: '#bcd8e6', roughness: 0.05, transparent: true, opacity: 0.6 }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(pos.x, yAgua, pos.z);
  mesa.adicionarExtra(agua);
  const gelo = new THREE.MeshStandardMaterial({ color: '#eef8ff', roughness: 0.08, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 4; i++) {
    const cubo = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.016), gelo);
    cubo.position.set(pos.x + Math.cos(i * 1.6) * r * 0.6, yAgua, pos.z + Math.sin(i * 1.6) * r * 0.6);
    cubo.rotation.set(i, i * 2, 0);
    mesa.adicionarExtra(cubo);
  }
  const calda = new THREE.MeshStandardMaterial({ color: '#e9c46a', roughness: 0.1, transparent: true, opacity: 0.85 });
  const amostra = forma === 'bolinha'
    ? new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), calda)
    : new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0025, 8, 32, Math.PI * 1.5), calda);
  amostra.position.set(pos.x, yAgua + 0.004, pos.z);
  if (forma === 'fio') amostra.rotation.x = -Math.PI / 2;
  mesa.adicionarExtra(amostra);
}

/** Observar e decidir: o jogador vê a peça num estado e diz se está no ponto. */
export function gestoTestar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, hud, tecnica, camera } = ctx;
  // havendo uma peça de verdade na técnica, ela aparece; só preparos líquidos vão para a tigela
  const fam = passo.alimento ? familiaDe(passo.alimento) : undefined;
  const solido = !!passo.alimento && !!fam && !['recipiente', 'monte', 'pasta'].includes(fam);
  const revisada = !!passo.opcoes?.length;
  const caldinho = solido && !revisada && ehLiquido(passo.alvo);
  const estados = [0.55, 1, 1.4];
  const sorteio = (tecnica.id.length * 7 + passo.alvo.length * 3) % 3;
  const estado = estados[sorteio];
  let peca: Peca | null = null;
  if (solido) {
    peca = mesa.garantirPeca(passo.alimento!, estacao.superficie.clone());
    if (!mesa.recipiente) {
      peca.position.copy(estacao.superficie);
      peca.rotation.y = anguloDaEstacao(estacao);
    }
    // com pergunta revisada, a peça fica como está (o visual não entrega nem contradiz a resposta)
    if (!revisada) peca.definirCozimento(Math.max(peca.cozimento, 0) > 0.2 ? estado : estado * 0.6);
    if (caldinho) {
      // o suco ou caldo que escorre aparece numa pocinha ao lado da peça
      const cor = new THREE.Color(estadoInicial(passo.alvo + ' ' + passo.parametro).cor);
      const turvo = [new THREE.Color('#d98c8c'), cor, new THREE.Color('#e8d9a8')][sorteio];
      const poca = new THREE.Mesh(new THREE.CircleGeometry(0.035, 28), new THREE.MeshStandardMaterial({ color: turvo, roughness: 0.15, transparent: true, opacity: 0.85 }));
      poca.rotation.x = -Math.PI / 2;
      poca.scale.set(1.4, 0.8, 1);
      poca.position.copy(peca.position).add(new THREE.Vector3(peca.comprimento * peca.scale.x * 0.55, 0.002, 0.02));
      mesa.adicionarExtra(poca);
    }
  } else {
    // ponto de calda: a panela de calda e, ao lado, a tigela de água gelada com a amostra (fio ou bolinha)
    const testeCalda = /[aá]gua gelada/i.test(`${passo.utensilio} ${passo.alvo}`) && /calda|fio|bolinha|bala|caramelo|glac/i.test(`${passo.alvo} ${tecnica.nome}`);
    if (testeCalda) {
      mesa.garantirRecipiente('panela', aoLado(estacao, -0.11), 'panela');
      mesa.garantirConteudo('calda de açúcar', 0.4);
      amostraNaAguaGelada(ctx, /fio/i.test(passo.alvo) ? 'fio' : 'bolinha');
    }
    if (!mesa.recipiente) mesa.garantirRecipiente('tigela', estacao.superficie.clone(), 'tigela');
    const c = mesa.garantirConteudo(passo.meio ?? passo.alvo, 0.45);
    if (!revisada) {
      c.estado.espessura = [0.15, 0.55, 0.95][sorteio];
      c.estado.picos = /clara|neve|creme|chantilly/.test(passo.alvo) ? [0.1, 0.8, 1][sorteio] : 0;
    }
  }
  // objetos do teste: bandeja com filme, termômetro, palito, copo d'água...
  const base = peca ? peca.position.clone() : estacao.superficie.clone();
  const tam = peca ? Math.max(peca.comprimento, peca.largura) * peca.scale.x : 0.12;
  for (const o of passo.objetos ?? []) {
    if (o === 'embalagem' && peca) {
      const bandeja = new THREE.Mesh(new THREE.BoxGeometry(tam * 1.25, 0.012, tam * 0.85), new THREE.MeshStandardMaterial({ color: '#f3f3ee', roughness: 0.9 }));
      bandeja.position.copy(base).add(new THREE.Vector3(0, 0.006, 0));
      bandeja.rotation.y = peca.rotation.y;
      bandeja.receiveShadow = true;
      mesa.adicionarExtra(bandeja);
      peca.position.y += 0.012;
      const filme = new THREE.Mesh(new THREE.BoxGeometry(tam * 1.25, peca.altura * peca.scale.y + 0.01, tam * 0.85), new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false }));
      filme.position.copy(base).add(new THREE.Vector3(0, 0.012 + (peca.altura * peca.scale.y + 0.01) / 2, 0));
      filme.rotation.y = peca.rotation.y;
      mesa.adicionarExtra(filme);
    } else if (o === 'copo-agua') {
      const copo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.12, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
      const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 0.09, 32), new THREE.MeshStandardMaterial({ color: '#bfe0f2', roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }));
      const pos = base.clone().add(new THREE.Vector3(-tam * 0.9 - 0.05, 0, 0));
      copo.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
      agua.position.copy(pos).add(new THREE.Vector3(0, 0.046, 0));
      mesa.adicionarExtra(copo);
      mesa.adicionarExtra(agua);
    } else {
      const nomes: Record<string, string> = { termometro: 'termômetro de espeto', palito: 'palito', faca: 'faca de legumes', garfo: 'garfo', colher: 'colher' };
      const u = criarUtensilio(nomes[o] ?? o);
      if (u) {
        u.position.copy(base).add(new THREE.Vector3(tam * 0.7 + 0.04, 0, 0.06));
        u.rotation.y = -0.6;
        mesa.adicionarExtra(u);
      }
    }
  }
  // opções: as revisadas (embaralhadas sempre do mesmo jeito para a mesma técnica) ou o ponto genérico
  let opcoes = ['Ainda não', 'No ponto', 'Passou do ponto'];
  let certa = sorteio;
  if (revisada) {
    const ordem = passo.opcoes!.map((_, i) => i);
    let semente = [...(tecnica.id + passo.alvo)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
    for (let i = ordem.length - 1; i > 0; i--) {
      semente = (semente * 9301 + 49297) % 233280;
      const j = semente % (i + 1);
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
    opcoes = ordem.map((i) => passo.opcoes![i]);
    certa = ordem.indexOf(passo.correta ?? 0);
  }
  const pergunta = passo.pergunta ?? `${passo.alvo}: como está?`;
  // cheirar: a peça sobe até perto do rosto e volta
  let t = 0;
  const origem = peca?.position.clone();
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      t += dt;
      if (passo.cheirar && peca && origem) {
        const k = t < 0.9 ? suaveCurva(t / 0.9) : t < 2 ? 1 : Math.max(0, 1 - (t - 2) / 0.7);
        const perto = camera.position.clone().add(new THREE.Vector3(0, -0.12, 0).applyQuaternion(camera.quaternion)).lerp(origem, 0.55);
        peca.position.lerpVectors(origem, perto, k);
        hud.dica(t < 2 ? 'Aproxime e sinta o cheiro...' : 'Agora responda.');
      } else hud.dica(revisada ? 'Observe com atenção e escolha.' : `Observe com atenção. ${passo.parametro ? 'Referência: ' + passo.parametro + '.' : ''}`);
      hud.medidores([]);
      if (passo.cheirar && t < 1.2) return;
      const r = hud.escolha(pergunta, opcoes);
      if (r >= 0) {
        hud.escolha(null);
        const certo = r === certa;
        exec.nota = certo ? 1 : 0.35;
        const porque = passo.explicacao ?? tecnica.ponto_critico;
        exec.comentario = certo ? `Isso. ${porque}` : `A resposta era "${opcoes[certa]}". ${porque}`;
        if (certo) audio.acerto(1);
        exec.concluido = true;
      }
    },
    descartar() {
      hud.escolha(null);
      if (peca && origem) peca.position.copy(origem);
      mesa.limparExtras();
    },
  };
  return exec;
}

const suaveCurva = (x: number) => x * x * (3 - 2 * x);

/** Separar: puxar uma parte para longe da outra com calma. */
/**
 * Como o livro usa "separar": tirar uma parte do alimento (filés, metades), tirar algo que está
 * nele (papel, barbante, espinhas, pele, tripa) ou tirar o alimento inteiro de onde está
 * (da água, do cesto, escolher os bons).
 */
export type ModoSeparar = 'partes' | 'retirar' | 'inteira';

const RE_RETIRAR = /papel|filme|barbante|^fio|palito|espeto|espinha|f[uú]rcula|esc[aá]pula|costela|carca[cç]a|pele|membrana|crosta|semente|miolo|tripa|barba|bico|pena|est[oô]mago|br[aâ]nquia|f[ií]gado|anel escuro|cord[aã]o|tend|toucinho|embalagem|raiz|talo duro|cone central|tutano|saco de tinta|m[uú]sculo|erva-cidreira|excesso|^aro|musselina|^bordas|^sementes|polpa das vagens|^miúdos|f[oô]rma de cima|fecho|toalhinha|colarinho|folha natural/i;
const RE_INTEIRA = /escolh|firmes|[uú]midos|compactos|rol[ií]ço|cheias|da [aá]gua|[aá]gua fria|[aá]gua acidulada|[aá]gua com|no cesto|cesto de bambu|escorr|desenform|^mexilh[oõ]es|^b[uú]zios|^ovos$|forminhas|sobre a f[oô]rma|lado a lado|recipiente fechado|alguns fios|vasilha firmada|legumes firmes|gr[aã]os soltos|no buraco|encostado|^peixes|escolha do corte|^folhas de|na toalha|da musselina|casca seca|casca lisa|submerso|do l[ií]quido|no pano|na palma|dorso para cima|no moedor|^frutas$|^choux$|gema na cova/i;

export function modoSeparar(alvo: string): ModoSeparar {
  if (RE_INTEIRA.test(alvo)) return 'inteira';
  if (RE_RETIRAR.test(alvo)) return 'retirar';
  return 'partes';
}

/** O que sai do alimento no modo "retirar", com a forma do que é. */
function objetoRetirado(alvo: string, peca: Peca): THREE.Object3D {
  const L = peca.comprimento;
  const W = Math.max(peca.largura, L * 0.4);
  const H = peca.altura;
  const g = new THREE.Group();
  const mat = (cor: string, rough = 0.7, opts: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rough, ...opts });
  const a = alvo.toLowerCase();
  if (/papel|filme|musselina|embalagem|toalhinha|colarinho/.test(a)) {
    // folha por baixo do alimento, sobrando para o lado de puxar
    const filme = /filme/.test(a);
    const folha = new THREE.Mesh(new THREE.BoxGeometry(L * 1.5, 0.0008, W * 1.35), mat(filme ? '#e8f4ff' : /musselina/.test(a) ? '#f4efe2' : '#efe2c0', 0.85, filme ? { transparent: true, opacity: 0.5 } : {}));
    folha.position.set(L * 0.2, filme ? H + 0.001 : 0.0005, 0);
    g.add(folha);
  } else if (/barbante|^fio|cord[aã]o|^aro|f[oô]rma de cima|fecho/.test(a)) {
    // voltas de barbante em torno da peça
    const metal = /^aro|f[oô]rma|fecho/.test(a);
    const n = metal ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const anel = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 28), metal ? mat('#c9ccd0', 0.3, { metalness: 0.9 }) : matFio);
      anel.scale.set(W * 0.55, H * 0.6, 1);
      anel.rotation.y = Math.PI / 2;
      anel.position.set((i - (n - 1) / 2) * L * 0.25, H * 0.5, 0);
      g.add(anel);
    }
  } else if (/palito|espeto/.test(a)) {
    for (let i = 0; i < 2; i++) {
      const pal = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, W * 1.4, 6), mat('#d8b884', 0.8));
      pal.rotation.x = Math.PI / 2;
      pal.position.set((i - 0.5) * L * 0.4, H * 0.55, 0);
      g.add(pal);
    }
  } else if (/espinha|f[uú]rcula|esc[aá]pula|costela|carca[cç]a|tutano/.test(a)) {
    // ossos claros: espinha central com espinhas finas, ou osso em V
    const osso = mat('#f1ead8', 0.5);
    const fina = /espinha/.test(a);
    const eixo = new THREE.Mesh(new THREE.CylinderGeometry(fina ? 0.0012 : 0.003, fina ? 0.0012 : 0.003, L * 0.8, 6), osso);
    eixo.rotation.z = Math.PI / 2;
    eixo.position.y = H + 0.002;
    g.add(eixo);
    for (let i = 0; i < (fina ? 9 : 4); i++) {
      for (const lado of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(fina ? 0.0006 : 0.002, fina ? 0.0006 : 0.002, W * (fina ? 0.32 : 0.4), 5), osso);
        r.rotation.x = Math.PI / 2 - lado * 0.5;
        r.position.set(-L * 0.35 + (i * L * 0.7) / ((fina ? 9 : 4) - 1), H + 0.002, lado * W * 0.14);
        g.add(r);
      }
    }
  } else if (/pele|membrana|crosta|^bordas|toucinho/.test(a)) {
    // camada fina por cima, na cor da casca
    const cor = /crosta|bordas/.test(a) ? '#d9a75a' : /toucinho/.test(a) ? '#f3e6dc' : /membrana/.test(a) ? '#efe4dc' : '#e9c9a8';
    const capa = new THREE.Mesh(new THREE.BoxGeometry(L * 0.85, 0.0015, W * 0.75), mat(cor, 0.6, /membrana/.test(a) ? { transparent: true, opacity: 0.75 } : {}));
    capa.position.y = H + 0.001;
    g.add(capa);
  } else {
    // pedacinho escuro ou miúdo: tripa, barbas, bico, sementes, miolo, fígado, músculo...
    const cor = /tripa|bico|barba|anel/.test(a) ? '#3a2a22' : /f[ií]gado|coral/.test(a) ? '#5a7a3a' : /semente|polpa/.test(a) ? '#2a1a12' : /tinta/.test(a) ? '#111111' : /m[uú]sculo/.test(a) ? '#f2e8dc' : /miolo|cone|talo|raiz/.test(a) ? '#c8d8a0' : /erva|folha/.test(a) ? '#4f7a3a' : '#8a5a40';
    const n = /semente/.test(a) ? 14 : /barba|tripa/.test(a) ? 6 : 1;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(n > 1 ? new THREE.SphereGeometry(Math.min(0.003, L * 0.03), 6, 5) : new THREE.SphereGeometry(1, 10, 8), mat(cor, 0.5));
      if (n === 1) b.scale.set(L * 0.18, Math.max(H * 0.18, 0.004), W * 0.18);
      b.position.set(n > 1 ? (i / n - 0.5) * L * 0.5 : 0, H + 0.002, n > 1 ? Math.sin(i * 2.3) * W * 0.08 : 0);
      g.add(b);
    }
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

export function gestoSeparar(ctx: ContextoGesto): Execucao {
  // "palitos em água fria", "pedaços em água com limão": é deixar de molho no recipiente, não puxar uma parte
  if (ctx.vaso && ctx.passo.meio && ctx.passo.alimento && /[aá]gua|lim[aã]o|vinagre|leite|salmoura/i.test(ctx.passo.meio)) return gestoTempo(ctx);
  const { passo, estacao, entrada, camera, hud } = ctx;
  const peca = prepararPeca(ctx);
  const modo = modoSeparar(passo.alvo);
  let lado = peca.fragmentos;
  let retirado: THREE.Object3D | null = null;
  if (modo === 'partes') {
    if (peca.fragmentos.length < 2) peca.cortar('x', 0);
    lado = peca.fragmentos.filter((f) => f.x0 >= -1e-4);
  } else if (modo === 'retirar') {
    lado = [];
    retirado = objetoRetirado(passo.alvo, peca);
    retirado.scale.setScalar(1);
    peca.add(retirado);
  }
  const alvoDist = 0.12 / Math.max(peca.scale.x, 0.01);
  let dist = 0;
  let pressa = 0;
  let segurando = false;
  const inicio = new THREE.Vector3();
  const dica = modo === 'retirar' ? `Segure e puxe com calma para a direita, até a marca: ${passo.alvo}.` : modo === 'inteira' ? 'Segure e leve com calma para a direita, até a marca.' : 'Segure a parte da direita e puxe com calma para longe, até a marca.';
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica(dica);
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
      const prog = clamp(dist / alvoDist);
      if (retirado) {
        // o que sai sobe um pouco e vai embora para o lado
        retirado.position.set(dist, Math.sin(prog * Math.PI) * 0.03 / Math.max(peca.scale.x, 0.01), 0);
        retirado.visible = prog < 0.98;
      } else {
        for (const f of lado) peca.moverFragmento(f, new THREE.Vector3(dist + (modo === 'partes' ? 0.004 : 0), dist > 0.01 ? 0.002 : 0, 0));
      }
      hud.medidores([{ rotulo: modo === 'retirar' ? 'Retirado' : 'Separado', valor: prog }]);
      if (prog >= 1) {
        exec.nota = clamp(1 - pressa * 0.8);
        exec.comentario = modo === 'retirar'
          ? comentar(exec.nota, 'Saiu inteiro, sem estragar o alimento.', 'Saiu, com um puxão mais forte.', 'Puxou rápido demais; pode rasgar o alimento.')
          : comentar(exec.nota, 'Separado limpo, sem rasgar.', 'Separado, com um puxão mais forte.', 'Puxou rápido demais; pode romper.');
        exec.concluido = true;
      }
    },
    descartar() {
      if (retirado) {
        retirado.removeFromParent();
        retirado.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material !== matFio) (o.material as THREE.Material).dispose(); } });
      }
      // o alimento inteiro volta para o lugar dele
      if (modo === 'inteira') for (const f of peca.fragmentos) peca.moverFragmento(f, new THREE.Vector3(0, 0, 0));
    },
  };
  return exec;
}
