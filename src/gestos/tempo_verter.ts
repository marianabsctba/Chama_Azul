// Tempo (descansar, fermentar, gelar, marinar), verter (coar, despejar, escumar, peneirar) e medir.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar, formatarTempo, minutos, suave } from './base';
import { anguloDaEstacao, aoLado, temPeca, textoConteudo } from './mesa';
import { Particulas } from '../pecas/particulas';
import { audio } from '../motor/audio';
import { criarUtensilio } from '../modelos/utensilios';

const PADRAO_MIN: Record<string, number> = {
  descansar: 30, fermentar: 60, resfriar: 30, congelar: 120, marinar: 60, hidratar: 30, 'deixar-de-molho': 60,
  demolhar: 480, descongelar: 240, embeber: 10, infusionar: 15, armazenar: 60,
};

export function gestoTempo(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud, relogio } = ctx;
  const alvo = minutos(passo.parametro) ?? PADRAO_MIN[passo.acao] ?? 20;
  const solido = temPeca(passo);
  const peca = solido ? mesa.garantirPeca(passo.alimento!, estacao.superficie.clone()) : null;
  const texto = `${passo.alvo} ${passo.utensilio} ${passo.parametro}`.toLowerCase();
  // em água gelada, água fria ou com gelo: a peça vai para a tigela com água e cubos de gelo
  const banhoFrio = passo.variante === 'frio' && /gelad|gelo|[aá]gua fria/.test(texto) && !/geladeira|freezer/.test(texto);
  if (peca && banhoFrio) {
    mesa.garantirRecipiente('tigela grande', estacao.superficie.clone(), 'tigela');
    mesa.garantirConteudo('água gelada', 0.6);
    peca.position.set(mesa.centro.x, mesa.fundoY, mesa.centro.z);
    peca.rotation.y = anguloDaEstacao(estacao);
    const gelo = new THREE.MeshStandardMaterial({ color: '#eef8ff', roughness: 0.08, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 7; i++) {
      const cubo = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.018), gelo);
      const a = i * 0.9;
      const r = mesa.bocaRaio * (0.35 + (i % 3) * 0.18);
      cubo.position.set(mesa.centro.x + Math.cos(a) * r, (mesa.conteudo?.position.y ?? mesa.fundoY) + (mesa.conteudo?.estado.nivel ?? 0.03), mesa.centro.z + Math.sin(a) * r);
      cubo.rotation.set(i, i * 2, 0);
      mesa.adicionarExtra(cubo);
    }
  } else if (peca) {
    // no recipiente da ficha (de molho na tigela, na fôrma, no pote); senão sobre a bancada
    peca.rotation.y = anguloDaEstacao(estacao);
    if (!mesa.colocarNoVaso(peca, ctx.vaso, estacao.superficie.clone(), true)) peca.position.copy(estacao.superficie);
  } else {
    mesa.garantirRecipiente('tigela', estacao.superficie.clone(), 'tigela');
    mesa.garantirConteudo(textoConteudo(passo), 0.45);
  }
  const escala0 = peca?.scale.clone();
  const fermenta = passo.variante === 'fermentar' || /dobr|cres/.test(passo.parametro);
  const frio = passo.variante === 'frio';
  const tingir = passo.acao === 'marinar' ? new THREE.Color('#8a3b1a') : passo.acao === 'embeber' ? new THREE.Color('#d98c3a') : null;
  // escala do mostrador: passos de 1, 5, 15 ou 60 min conforme o alvo
  const passoMin = alvo <= 10 ? 1 : alvo <= 60 ? 5 : alvo <= 240 ? 15 : 60;
  let ajuste = 0;
  let iniciado = false;
  let corrido = 0;
  let nota = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      if (!iniciado) {
        if (entrada.roda) ajuste = Math.max(0, ajuste - entrada.roda * passoMin);
        if (entrada.apertou('e') || entrada.apertou('+') || entrada.apertou('=')) ajuste += passoMin;
        if (entrada.apertou('q') || entrada.apertou('-')) ajuste = Math.max(0, ajuste - passoMin);
        hud.dica(`${frio ? 'Leve à geladeira' : fermenta ? 'Cubra e deixe crescer' : 'Deixe descansar'}: gire o timer com os botões − e + (ou a roda do mouse) até o tempo certo e clique em Iniciar.`);
        hud.medidores([{ rotulo: 'Timer', valor: clamp(ajuste / (alvo * 2)), texto: formatarTempo(ajuste) }]);
        const clicouIniciar = hud.botao('Iniciar');
        if (clicouIniciar && ajuste <= 0) hud.aviso('Gire o timer primeiro: botões − e + (ou a roda do mouse).', 'ajuste');
        if (clicouIniciar && ajuste > 0) {
          iniciado = true;
          const erro = Math.abs(ajuste - alvo) / Math.max(alvo, 1);
          nota = clamp(1 - erro * 1.5);
          audio.clique();
          hud.aviso(erro < 0.1 ? 'Tempo certinho.' : `O livro pede cerca de ${formatarTempo(alvo)}.`, erro < 0.1 ? 'bom' : 'neutro');
        }
        return;
      }
      // o tempo corre rápido, e mais ainda com Espaço
      relogio.escala = entrada.teclas.has(' ') ? 3600 : 600;
      const dtc = (dt * relogio.escala) / 60; // minutos
      corrido = Math.min(ajuste, corrido + dtc);
      const k = clamp(corrido / Math.max(ajuste, 1e-3));
      if (peca && escala0) {
        if (fermenta) peca.scale.copy(escala0).multiplyScalar(1 + 0.26 * k);
        if (tingir) peca.salpicar(tingir, dt * 0.05, Math.floor(corrido));
      }
      if (mesa.conteudo && fermenta) mesa.conteudo.estado.nivel *= 1 + dt * 0.08 * (1 - k);
      hud.dica('O tempo passa sozinho. Segure Espaço para acelerar ainda mais.');
      hud.medidores([{ rotulo: 'Tempo', valor: k, texto: `${formatarTempo(corrido)} de ${formatarTempo(ajuste)}` }]);
      hud.botao(null);
      if (k >= 1) {
        exec.nota = nota;
        exec.comentario = comentar(nota, 'Tempo exato.', 'Tempo próximo do ideal.', `Tempo bem diferente do ideal (${formatarTempo(alvo)}).`);
        exec.concluido = true;
      }
    },
    descartar() {
      relogio.escala = 1;
      hud.botao(null);
    },
  };
  return exec;
}

/**
 * Mergulhar: a peça (ou a ponta dela) desce no conteúdo da tigela e volta coberta. Segurar o botão
 * desce, soltar sobe; vale quando afunda até a marca e sai sem pressa.
 */
function gestoMergulhar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud } = ctx;
  mesa.garantirRecipiente(/panela|caçarola/i.test(passo.utensilio + passo.alvo) ? 'panela' : 'tigela', estacao.superficie.clone(), 'tigela');
  const meio = passo.meio ?? (/caramelo/i.test(passo.alvo + passo.parametro) ? 'caramelo' : /chocolate|ganache/i.test(passo.alvo + passo.parametro) ? 'chocolate' : /massa/i.test(passo.alvo + passo.parametro) ? 'massa mole' : textoConteudo(passo));
  const conteudo = mesa.garantirConteudo(meio, 0.6);
  const superficieY = conteudo.position.y + conteudo.estado.nivel;
  const peca = passo.alimento ? mesa.garantirPeca(passo.alimento, estacao.superficie.clone()) : null;
  const ferramenta = peca ? null : mesa.pegarFerramenta(passo.utensilio || 'colher', 'circular');
  let alto = 0.06;
  if (peca) {
    const maior = Math.max(peca.comprimento, peca.largura);
    if (maior * peca.scale.x > mesa.bocaRaio * 1.2) peca.scale.setScalar((mesa.bocaRaio * 1.2) / maior);
    peca.rotation.set(0, anguloDaEstacao(estacao), 0);
    alto = peca.altura * peca.scale.x;
  }
  // só a ponta ou o topo mergulha (bomba no caramelo, fruta na massa): uns 60% da altura
  const fundoAlvo = superficieY - alto * 0.6;
  const acima = superficieY + 0.06;
  let prof = 0;
  let mergulhou = false;
  let pressa = 0;
  let coberto = false;
  const cor = conteudo.estado.cor.clone();
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica(mergulhou ? 'Agora solte para tirar com calma e escorrer o excesso.' : 'Segure para mergulhar até a marca.');
      const antes = prof;
      prof = clamp(prof + (entrada.pressionado ? dt * 1.2 : -dt * 0.9));
      if (Math.abs(prof - antes) / Math.max(dt, 1e-3) > 1.6) pressa += dt;
      const y = acima + (fundoAlvo - acima) * prof;
      if (peca) peca.position.set(mesa.centro.x, y, mesa.centro.z);
      else if (ferramenta) mesa.ferramentaEm(new THREE.Vector3(mesa.centro.x, y, mesa.centro.z), 0, -1.3, 0);
      if (prof > 0.9) mergulhou = true;
      if (peca && mergulhou && !coberto) {
        // a parte que entrou sai coberta da calda, do caramelo ou da massa
        coberto = true;
        const base = peca.getWorldPosition(new THREE.Vector3());
        for (const dx of [-0.3, 0, 0.3]) peca.pintar(base.clone().add(new THREE.Vector3(dx * peca.comprimento * peca.scale.x, 0.002, 0)), Math.max(0.02, alto * 0.9), 'cobrir', cor, 1);
      }
      hud.medidores([{ rotulo: 'Mergulho', valor: prof, faixa: [0.9, 1] }]);
      if (mergulhou && prof <= 0.02) {
        exec.nota = clamp(1 - pressa * 0.6);
        exec.comentario = comentar(exec.nota, 'Mergulhou por igual e escorreu o excesso.', 'Coberto, com um pouco de pressa.', 'Rápido demais: a cobertura fica irregular.');
        exec.concluido = true;
      }
    },
    descartar() {
      hud.medidores([]);
    },
  };
  return exec;
}

export function gestoVerter(ctx: ContextoGesto): Execucao {
  if (ctx.passo.variante === 'mergulhar') return gestoMergulhar(ctx);
  if (ctx.passo.variante === 'escumar') return gestoEscumar(ctx);
  if (ctx.passo.variante === 'peneirar') return gestoPeneirar(ctx);
  const { passo, mesa, estacao, entrada, hud, cena } = ctx;
  // origem: o recipiente atual ou uma panela; destino: tigela ao lado (com peneira se coar)
  const origemTexto = /panela|tigela|jarra|frigideira|caçarola|liquidificador|vasilha/i.test(passo.alvo + passo.utensilio) ? passo.alvo + ' ' + passo.utensilio : 'panela';
  mesa.removerPeca();
  const origem = mesa.garantirRecipiente(origemTexto.includes('panela') ? 'panela' : 'tigela', aoLado(estacao, -0.17), 'panela');
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.6);
  const destinoPos = aoLado(estacao, 0.17);
  const destino = criarUtensilio(ctx.vaso && !/escorr|coar|peneir/i.test(passo.acao) ? ctx.vaso : 'tigela grande') ?? criarUtensilio('tigela grande') ?? new THREE.Group();
  destino.position.copy(destinoPos);
  mesa.adicionarExtra(destino);
  const coar = /coar|escorrer/.test(passo.acao) || /peneira|chinois|coador|escorredor|musselina/i.test(passo.utensilio);
  if (coar) {
    const peneira = criarUtensilio(/chinois|coador|musselina|escorredor/i.test(passo.utensilio) ? passo.utensilio : 'peneira') ?? new THREE.Group();
    const caixa = new THREE.Box3().setFromObject(destino);
    peneira.position.set(destinoPos.x, caixa.max.y + 0.005, destinoPos.z);
    mesa.adicionarExtra(peneira);
  }
  const caixaDest = new THREE.Box3().setFromObject(destino);
  // topo do destino, contando a peneira por cima
  let topoDest = caixaDest.max.y;
  for (const o of mesa.extras) topoDest = Math.max(topoDest, new THREE.Box3().setFromObject(o).max.y);
  const caixaOrigem = new THREE.Box3().setFromObject(origem);
  const fluxo = new Particulas(conteudo.estado.cor, 220, 'esfera', 0.95);
  cena.add(fluxo);
  const nivel0 = conteudo.estado.nivel;
  const origemPos0 = origem.position.clone();
  // o conteúdo fica no centro da boca, que não é a origem do modelo quando há cabo
  const desloc = mesa.centro.clone().sub(origemPos0).setY(mesa.fundoY - origemPos0.y);
  const dir0 = destinoPos.clone().sub(origemPos0).setY(0).normalize();
  // o bico: a borda da boca do lado do destino, guardada no espaço do modelo
  origem.updateMatrixWorld(true);
  const bicoLocal = origem.worldToLocal(new THREE.Vector3(mesa.centro.x, caixaOrigem.max.y, mesa.centro.z).addScaledVector(dir0, mesa.bocaRaio * 1.02));
  // onde a panela vai: levantada acima do destino, com o bico sobre o centro dele
  const alturaPanela = caixaOrigem.max.y - caixaOrigem.min.y;
  const subida = Math.max(0, topoDest + 0.03 - origemPos0.y);
  const avanco = Math.max(0, destinoPos.clone().sub(new THREE.Vector3(mesa.centro.x, destinoPos.y, mesa.centro.z)).length() - mesa.bocaRaio * 2.1);
  void alturaPanela;
  let inclinacao = 0;
  let alvoInclinacao = 0;
  let yInicio: number | null = null;
  let base = 0;
  let transferido = 0;
  let derramado = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica('Clique e suba o mouse para inclinar (ou use os botões − e +). A panela fica na inclinação em que você soltar. Despeje num fio constante, sem transbordar.');
      // arrasto curto: a inclinação segue a altura do mouse desde o clique, e fica onde você soltar
      if (entrada.pressionado) {
        if (yInicio === null) {
          yInicio = entrada.px.y;
          base = alvoInclinacao;
        }
        alvoInclinacao = clamp(base + (yInicio - entrada.px.y) / 140, 0, 1.4);
      } else yInicio = null;
      if (entrada.roda) alvoInclinacao = clamp(alvoInclinacao - entrada.roda * 0.07, 0, 1.4);
      inclinacao += (alvoInclinacao - inclinacao) * Math.min(1, dt * 8);
      // primeiro a panela sobe e vai para cima do destino; depois inclina sobre ele
      const dir = dir0;
      const eixo = new THREE.Vector3(-dir.z, 0, dir.x);
      const levantar = suave(clamp(inclinacao / 0.35));
      const giro = Math.max(0, inclinacao - 0.15);
      origem.quaternion.setFromAxisAngle(eixo, -giro);
      const pivo = new THREE.Vector3(mesa.centro.x, origemPos0.y, mesa.centro.z).addScaledVector(dir, mesa.bocaRaio);
      origem.position.copy(origemPos0).sub(pivo).applyQuaternion(origem.quaternion).add(pivo)
        .add(new THREE.Vector3(0, subida * levantar, 0)).addScaledVector(dir, avanco * levantar);
      conteudo.position.copy(origem.position).add(desloc.clone().applyQuaternion(origem.quaternion));
      conteudo.quaternion.copy(origem.quaternion);
      // fluxo depende da inclinação contra o nível restante
      const restante = 1 - transferido;
      // o líquido começa a sair cedo e o limiar sobe pouco conforme esvazia
      const limiar = 0.25 + (1 - restante) * 0.55;
      let vazao = clamp((inclinacao - limiar) * 1.6);
      // no Zen o fio nunca passa do ponto de respingar
      if (ctx.modo === 'zen') vazao = Math.min(vazao, 0.72);
      if (vazao > 0 && restante > 0) {
        const q = vazao * dt * 0.22;
        transferido = Math.min(1, transferido + q);
        if (vazao > 0.75) derramado += q;
        origem.updateMatrixWorld(true);
        const bico = origem.localToWorld(bicoLocal.clone());
        for (let i = 0; i < 3; i++) fluxo.emitir(bico, dir.clone().multiplyScalar(0.06 + vazao * 0.08), { vida: 0.6, tam: 0.004 + vazao * 0.003, gravidade: -6, espalhar: vazao > 0.75 ? 0.9 : 0.12 });
      }
      conteudo.estado.nivel = Math.max(0.002, nivel0 * (1 - transferido));
      fluxo.atualizar(dt);
      audio.despejo(vazao);
      hud.medidores([
        { rotulo: 'Fio', valor: vazao, faixa: [0.15, 0.75] },
        { rotulo: 'Transferido', valor: transferido, texto: `${Math.round(transferido * 100)}%` },
      ]);
      if (transferido >= 0.97) {
        exec.nota = clamp(1 - (derramado / Math.max(transferido, 0.01)) * 1.5);
        exec.comentario = comentar(exec.nota, 'Fio constante, nenhuma gota fora.', 'Bom, com alguns momentos de pressa.', 'Despejou rápido demais e respingou.');
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(fluxo);
      fluxo.descartar();
      origem.quaternion.identity();
      origem.position.copy(origemPos0);
      conteudo.quaternion.identity();
      conteudo.position.copy(origemPos0).add(desloc);
      conteudo.estado.nivel = nivel0 * 0.6 + 0.004;
      mesa.limparExtras();
      audio.despejo(0);
    },
  };
  return exec;
}

function gestoEscumar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud, cena } = ctx;
  mesa.removerPeca();
  const rec = mesa.garantirRecipiente(/panela|caçarola/i.test(passo.utensilio) ? passo.utensilio : 'panela', estacao.superficie.clone(), 'panela');
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.6);
  conteudo.estado.ondas = 0.25;
  const espuma = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: /gordura|desengord/.test(passo.acao + passo.alvo) ? '#f2d46a' : '#efe4c8', roughness: 0.8 }), 26);
  const posicoes: (THREE.Vector3 | null)[] = [];
  const aux = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * mesa.bocaRaio * 0.8;
    posicoes.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  cena.add(espuma);
  const ferramenta = mesa.pegarFerramenta(/escumadeira|concha|colher/i.test(passo.utensilio) ? passo.utensilio : '', 'escumar');
  let tirados = 0;
  let t = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      t += dt;
      hud.dica('Segure o botão e passe a escumadeira rente à superfície, recolhendo a espuma e as impurezas.');
      const y = conteudo.position.y + conteudo.estado.nivel;
      const ponto = entrada.noPlano(camera, y);
      if (ponto && ferramenta) mesa.ferramentaEm(ponto.clone().setY(y + 0.004), 0, -1.3, 0);
      posicoes.forEach((p, i) => {
        if (p) {
          p.x += Math.sin(t * 0.7 + i) * dt * 0.004;
          p.z += Math.cos(t * 0.6 + i * 2) * dt * 0.004;
          if (entrada.pressionado && ponto && ponto.clone().sub(mesa.centro).setY(0).distanceTo(p) < 0.03) {
            posicoes[i] = null;
            tirados++;
            audio.clique();
          }
        }
        const q = posicoes[i];
        aux.position.set(mesa.centro.x + (q?.x ?? 0), y + 0.002, mesa.centro.z + (q?.z ?? 0));
        aux.scale.set(q ? 0.012 : 0, q ? 0.004 : 0, q ? 0.012 : 0);
        aux.updateMatrix();
        espuma.setMatrixAt(i, aux.matrix);
      });
      espuma.instanceMatrix.needsUpdate = true;
      hud.medidores([{ rotulo: 'Superfície limpa', valor: tirados / posicoes.length }]);
      if (tirados >= posicoes.length) {
        exec.nota = 0.95;
        exec.comentario = 'Superfície limpa, o caldo vai ficar claro.';
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(espuma);
      espuma.geometry.dispose();
      (espuma.material as THREE.Material).dispose();
      mesa.soltarFerramenta();
    },
  };
  return exec;
}

function gestoPeneirar(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud, cena } = ctx;
  mesa.removerPeca();
  mesa.garantirRecipiente('tigela grande', estacao.superficie.clone(), 'tigela');
  // o que passa pela peneira: farinha, açúcar, purê, claras, o que o passo disser
  const conteudo = mesa.garantirConteudo(/farinha|a[cç][uú]car|cacau|fermento|sal/i.test(passo.alvo) ? passo.alvo : textoConteudo(passo), 0.05);
  conteudo.estado.nivel = 0.004;
  const peneira = mesa.pegarFerramenta(/peneira|tamis|coador/i.test(passo.utensilio) ? passo.utensilio : 'peneira', 'peneirar');
  const po = new Particulas(conteudo.estado.cor.clone(), 300, 'esfera', 1);
  cena.add(po);
  let direcao = 0;
  let acum = 0;
  let sacudidas = 0;
  const alvo = 14;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica('Segure e sacuda o mouse de um lado para o outro sobre a tigela.');
      const y = estacao.superficie.y + 0.2;
      const mouse = entrada.noPlano(camera, y) ?? estacao.superficie.clone().setY(y);
      // a peneira fica sobre a tigela: o mouse só a balança dentro da boca
      const desvio = mouse.clone().sub(mesa.centro).setY(0);
      if (desvio.length() > mesa.bocaRaio * 0.5) desvio.setLength(mesa.bocaRaio * 0.5);
      const ponto = mesa.centro.clone().add(desvio).setY(y);
      if (peneira) mesa.ferramentaEm(ponto, 0, 0, 0);
      if (entrada.pressionado) {
        const dx = entrada.deltaPx.x;
        acum += Math.abs(dx);
        const s = Math.sign(dx);
        if (s && s !== direcao && acum > 30) {
          sacudidas++;
          direcao = s;
          acum = 0;
          for (let i = 0; i < 25; i++) po.emitir(ponto.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.12, -0.02, (Math.random() - 0.5) * 0.12)), new THREE.Vector3(0, -0.1, 0), { vida: 0.7, tam: 0.0016, gravidade: -2.5, espalhar: 0.2 });
        }
      }
      po.atualizar(dt);
      conteudo.estado.nivel = 0.004 + 0.03 * clamp(sacudidas / alvo);
      conteudo.estado.picos = 0.3;
      hud.medidores([{ rotulo: 'Peneirado', valor: clamp(sacudidas / alvo) }]);
      if (sacudidas >= alvo) {
        exec.nota = 0.95;
        exec.comentario = 'Fino e aerado, sem grumos.';
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(po);
      po.descartar();
      mesa.soltarFerramenta();
    },
  };
  return exec;
}

/**
 * Medir comprimento ou espessura (régua no peixe, lâmina da mandolina, marcas de 2,5 cm): a régua ao
 * lado da peça e um marcador que corre enquanto segura; soltar na medida do livro.
 */
function gestoMedirComprimento(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud } = ctx;
  const m = passo.meta;
  const alvoCm = m && (m.unidade === 'cm' || m.unidade === 'mm') ? (m.unidade === 'mm' ? m.valor / 10 : m.valor) : 2.5;
  const fino = alvoCm < 1.5;
  mesa.removerRecipiente(true);
  const peca = passo.alimento ? mesa.garantirPeca(passo.alimento, estacao.superficie.clone()) : null;
  if (peca) {
    peca.position.copy(estacao.superficie);
    peca.rotation.y = anguloDaEstacao(estacao);
  }
  // régua de aço com riscos a cada centímetro (e meio centímetro quando a medida é fina)
  const compr = fino ? 0.06 : Math.max(0.12, alvoCm / 100 * 2.2);
  const regua = new THREE.Group();
  const aco = new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.3, metalness: 0.8 });
  const barra = new THREE.Mesh(new THREE.BoxGeometry(compr, 0.002, 0.022), aco);
  regua.add(barra);
  const risco = new THREE.MeshBasicMaterial({ color: '#2a2e33' });
  const passoRisco = fino ? 0.001 : 0.01;
  for (let x = 0, i = 0; x <= compr + 1e-6; x += passoRisco, i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.0005, i % (fino ? 5 : 1) === 0 ? 0.01 : 0.005), risco);
    r.position.set(-compr / 2 + x, 0.0013, -0.006);
    regua.add(r);
  }
  const marcador = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.004, 0.024), new THREE.MeshBasicMaterial({ color: '#ff7a3a' }));
  regua.add(marcador);
  const ang = anguloDaEstacao(estacao);
  regua.rotation.y = ang;
  regua.position.copy(estacao.superficie).add(new THREE.Vector3(0, 0.002, 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang));
  mesa.adicionarExtra(regua);
  let medidoCm = 0;
  const maxCm = compr * 100;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica(`Segure para correr o marcador pela régua e solte em ${alvoCm.toLocaleString('pt-BR')} cm.`);
      if (entrada.pressionado) medidoCm = Math.min(maxCm, medidoCm + dt * Math.max(0.4, alvoCm * 0.6));
      marcador.position.x = -compr / 2 + medidoCm / 100;
      hud.medidores([{ rotulo: 'Régua', valor: clamp(medidoCm / maxCm), texto: `${medidoCm.toFixed(1)} cm`, faixa: [(alvoCm * 0.95) / maxCm, (alvoCm * 1.05) / maxCm] }]);
      if (!entrada.pressionado && medidoCm > 0 && hud.botao('Pronto')) {
        const erro = Math.abs(medidoCm - alvoCm) / alvoCm;
        exec.nota = clamp(1 - erro * 4);
        exec.comentario = comentar(exec.nota, 'Medida exata.', `Perto: ${medidoCm.toFixed(1)} cm para ${alvoCm} cm.`, `Longe: ${medidoCm.toFixed(1)} cm para ${alvoCm} cm.`);
        exec.concluido = true;
      }
    },
    descartar() {
      hud.botao(null);
    },
  };
  return exec;
}

export function gestoMedir(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud, cena } = ctx;
  const m = passo.meta;
  const textoMedir = `${passo.alvo} ${passo.utensilio} ${passo.parametro}`.toLowerCase();
  if ((m && (m.unidade === 'cm' || m.unidade === 'mm')) || /r[eé]gua|espessura|l[aâ]mina|grade|marca|calibre|mandolina/.test(textoMedir)) return gestoMedirComprimento(ctx);
  const balanca = passo.variante === 'balanca';
  let alvo = 100;
  let unidade = balanca ? 'g' : 'ml';
  if (m && ['g', 'kg', 'ml', 'l'].includes(m.unidade)) {
    alvo = m.unidade === 'kg' || m.unidade === 'l' ? m.valor * 1000 : m.valor;
    unidade = m.unidade === 'kg' ? 'g' : m.unidade === 'l' ? 'ml' : m.unidade;
  }
  // pesar uma peça (a ave, a ballotine): a própria peça vai ao prato da balança
  if (balanca && passo.alimento) {
    mesa.removerRecipiente(true);
    const peca = mesa.garantirPeca(passo.alimento, estacao.superficie.clone());
    peca.position.copy(estacao.superficie);
    peca.rotation.y = anguloDaEstacao(estacao);
    const pesoAlvo = m && ['g', 'kg'].includes(m.unidade) ? (m.unidade === 'kg' ? m.valor * 1000 : m.valor) : Math.round(peca.comprimento * peca.largura * peca.altura * 600000) || 500;
    let lido = 0;
    const exec: Execucao = {
      concluido: false,
      nota: 0,
      comentario: '',
      atualizar(dt) {
        hud.dica('Espere o ponteiro da balança assentar e confirme o peso.');
        lido += (pesoAlvo - lido) * Math.min(1, dt * 2.5);
        hud.medidores([{ rotulo: 'Balança', valor: clamp(lido / (pesoAlvo * 1.5)), texto: `${Math.round(lido)} g`, faixa: [0.6, 0.7] }]);
        if (Math.abs(lido - pesoAlvo) < pesoAlvo * 0.01 && hud.botao('Pronto')) {
          exec.nota = 1;
          exec.comentario = comentar(1, `${Math.round(pesoAlvo)} g na balança.`, '', '');
          exec.concluido = true;
        }
      },
      descartar() {
        hud.botao(null);
      },
    };
    return exec;
  }
  mesa.removerPeca();
  mesa.garantirRecipiente(balanca ? 'tigela' : 'jarra medidora', estacao.superficie.clone(), 'tigela');
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.02);
  conteudo.estado.nivel = 0.002;
  const fluxo = new Particulas(conteudo.estado.cor, 200, 'esfera', 1);
  cena.add(fluxo);
  let medido = 0;
  let vel = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica(`Segure o botão para despejar e solte na marca de ${alvo} ${unidade}. Quanto mais tempo segura, mais rápido cai.`);
      if (entrada.pressionado) vel = Math.min(alvo * 0.6, vel + alvo * dt * 0.35);
      else vel = 0;
      medido += vel * dt;
      if (vel > 0) {
        const o = mesa.centro.clone().add(new THREE.Vector3(0, 0.25, 0));
        for (let i = 0; i < 2; i++) fluxo.emitir(o, new THREE.Vector3(0, -0.5, 0), { vida: 0.5, tam: 0.003, gravidade: -8, espalhar: 0.1 });
      }
      fluxo.atualizar(dt);
      audio.despejo(vel > 0 ? 0.5 : 0);
      conteudo.estado.nivel = 0.002 + 0.05 * clamp(medido / (alvo * 1.4));
      hud.medidores([{ rotulo: balanca ? 'Balança' : 'Jarra', valor: clamp(medido / (alvo * 1.5)), texto: `${Math.round(medido)} ${unidade}`, faixa: [alvo * 0.97 / (alvo * 1.5), alvo * 1.03 / (alvo * 1.5)] }]);
      if (!entrada.pressionado && medido > 0 && hud.botao('Pronto')) {
        const erro = Math.abs(medido - alvo) / alvo;
        exec.nota = clamp(1 - erro * 5);
        exec.comentario = comentar(exec.nota, 'Medida exata.', `Perto: ${Math.round(medido)} ${unidade} para ${alvo}.`, `Longe da medida: ${Math.round(medido)} ${unidade} para ${alvo}.`);
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(fluxo);
      fluxo.descartar();
      audio.despejo(0);
      hud.botao(null);
    },
  };
  return exec;
}
