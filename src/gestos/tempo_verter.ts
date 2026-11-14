// Tempo (descansar, fermentar, gelar, marinar), verter (coar, despejar, escumar, peneirar) e medir.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar, formatarTempo, minutos } from './base';
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
  if (peca) {
    peca.position.copy(estacao.superficie);
    peca.rotation.y = anguloDaEstacao(estacao);
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

export function gestoVerter(ctx: ContextoGesto): Execucao {
  if (ctx.passo.variante === 'escumar') return gestoEscumar(ctx);
  if (ctx.passo.variante === 'peneirar') return gestoPeneirar(ctx);
  const { passo, mesa, estacao, entrada, hud, cena } = ctx;
  // origem: o recipiente atual ou uma panela; destino: tigela ao lado (com peneira se coar)
  const origemTexto = /panela|tigela|jarra|frigideira|caçarola|liquidificador|vasilha/i.test(passo.alvo + passo.utensilio) ? passo.alvo + ' ' + passo.utensilio : 'panela';
  mesa.removerPeca();
  const origem = mesa.garantirRecipiente(origemTexto.includes('panela') ? 'panela' : 'tigela', aoLado(estacao, -0.17), 'panela');
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.6);
  const destinoPos = aoLado(estacao, 0.17);
  const destino = criarUtensilio('tigela grande') ?? new THREE.Group();
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
  const fluxo = new Particulas(conteudo.estado.cor, 220, 'esfera', 0.95);
  cena.add(fluxo);
  const nivel0 = conteudo.estado.nivel;
  const origemPos0 = origem.position.clone();
  // o conteúdo fica no centro da boca, que não é a origem do modelo quando há cabo
  const desloc = mesa.centro.clone().sub(origemPos0).setY(mesa.fundoY - origemPos0.y);
  let inclinacao = 0;
  let transferido = 0;
  let derramado = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      hud.dica('Segure o botão e suba o mouse para inclinar o recipiente. Despeje num fio constante, sem transbordar.');
      if (entrada.pressionado) inclinacao = clamp(inclinacao - entrada.deltaPx.y * 0.004, 0, 1.4);
      else inclinacao = Math.max(0, inclinacao - dt * 1.2);
      // inclina na direção do destino
      const dir = destinoPos.clone().sub(origemPos0).setY(0).normalize();
      const eixo = new THREE.Vector3(-dir.z, 0, dir.x);
      origem.quaternion.setFromAxisAngle(eixo, -inclinacao);
      origem.position.copy(origemPos0).addScaledVector(dir, Math.sin(inclinacao) * 0.06).add(new THREE.Vector3(0, Math.sin(inclinacao) * 0.08, 0));
      conteudo.position.copy(origem.position).add(desloc.clone().applyQuaternion(origem.quaternion));
      conteudo.quaternion.copy(origem.quaternion);
      // fluxo depende da inclinação contra o nível restante
      const restante = 1 - transferido;
      const limiar = 1.15 - restante * 0.85;
      const vazao = clamp((inclinacao - limiar) * 1.6);
      if (vazao > 0 && restante > 0) {
        const q = vazao * dt * 0.22;
        transferido = Math.min(1, transferido + q);
        if (vazao > 0.75) derramado += q;
        const bico = conteudo.position.clone().addScaledVector(dir, mesa.bocaRaio * 1.05).setY(caixaDest.max.y + 0.12);
        for (let i = 0; i < 3; i++) fluxo.emitir(bico, dir.clone().multiplyScalar(0.25 + vazao * 0.3), { vida: 0.6, tam: 0.004 + vazao * 0.003, gravidade: -6, espalhar: vazao > 0.75 ? 0.9 : 0.12 });
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
  const conteudo = mesa.garantirConteudo('farinha', 0.05);
  conteudo.estado.nivel = 0.004;
  const peneira = mesa.pegarFerramenta(/peneira|tamis|coador/i.test(passo.utensilio) ? passo.utensilio : 'peneira', 'peneirar');
  const po = new Particulas('#fbf7ee', 300, 'esfera', 1);
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
      const ponto = entrada.noPlano(camera, y) ?? estacao.superficie.clone().setY(y);
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

export function gestoMedir(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud, cena } = ctx;
  const m = passo.meta;
  const balanca = passo.variante === 'balanca';
  let alvo = 100;
  let unidade = balanca ? 'g' : 'ml';
  if (m && ['g', 'kg', 'ml', 'l'].includes(m.unidade)) {
    alvo = m.unidade === 'kg' || m.unidade === 'l' ? m.valor * 1000 : m.valor;
    unidade = m.unidade === 'kg' ? 'g' : m.unidade === 'l' ? 'ml' : m.unidade;
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
