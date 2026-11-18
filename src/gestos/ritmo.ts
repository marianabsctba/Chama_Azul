// Gestos de ritmo: bater, mexer, incorporar, sovar, abrir com rolo, amaciar, espremer.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar } from './base';
import { anguloDaEstacao, ehLiquido, temPeca, textoConteudo } from './mesa';
import { audio } from '../motor/audio';
import { pontosDoUtensilio } from '../modelos/utensilios';

/** Estado final esperado do conteúdo, lido do texto do passo. */
function alvoDoConteudo(texto: string) {
  const t = texto.toLowerCase();
  if (/neve|picos?|merengue|chantilly|ponto de fita|firme|volume/.test(t)) return { picos: /mole|macio/.test(t) ? 0.55 : 1, cor: new THREE.Color('#fbfaf4'), espessura: 0.7, brilho: 0.55, cresce: 2.6 };
  if (/emuls|maionese|hollandaise|holand|engross|liga|cremos|nappe|napar/.test(t)) return { picos: 0.1, espessura: 0.75, brilho: 0.75, cresce: 1.1 };
  if (/esbranqui|clarear|fofo|creme|aerad/.test(t)) return { picos: 0.25, cor: new THREE.Color('#f7e7b4'), espessura: 0.6, brilho: 0.5, cresce: 1.3 };
  if (/massa|homog|lisa|uniforme/.test(t)) return { picos: 0.05, espessura: 0.7, brilho: 0.4, cresce: 1 };
  return { picos: 0.05, espessura: 0.4, brilho: 0.6, cresce: 1 };
}

/**
 * Bater ou dobrar clareia a base neutra (claras, creme, manteiga com açúcar). Quando o conteúdo já tem
 * a cor do sabor (musse de chocolate, ganache, purê de frutas), ele só clareia um pouco e não vira branco.
 */
function respeitarSabor(alvo: { cor?: THREE.Color }, inicial: THREE.Color, texto: string) {
  // gemas com açúcar batidas "até esbranquiçar" clareiam de verdade
  if (!alvo.cor || /esbranqui|clarear/i.test(texto)) return;
  const hsl = { h: 0, s: 0, l: 0 };
  inicial.getHSL(hsl);
  if (hsl.s > 0.35 || hsl.l < 0.55) alvo.cor = inicial.clone().lerp(alvo.cor, 0.18);
}

const ELETRO = /batedeira|processador|liquidificador|mixer|multiprocessador/i;

export function gestoRitmo(ctx: ContextoGesto): Execucao {
  const v = ctx.passo.variante;
  if (ELETRO.test(ctx.passo.utensilio) && v !== 'vaivem' && v !== 'golpes') return ritmoEletrico(ctx);
  if (v === 'circular' || v === 'circular-rapido' || v === 'dobrar') {
    if (v !== 'dobrar' || !temPeca(ctx.passo) || (!ctx.passo.meio && ehLiquido(ctx.passo.alvo))) return ritmoNaTigela(ctx);
  }
  return ritmoNaPeca(ctx);
}

function ritmoNaTigela(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const texto = `${passo.acao} ${passo.alvo} ${passo.parametro}`;
  const v = passo.variante;
  // pilão, mouli, centrífuga e moedor são o próprio recipiente do gesto (antes viravam tigela com batedor)
  const aparelho = /pil[aã]o|almofariz|mouli|passe.?vite|centr[ií]fuga|moedor/i.test(passo.utensilio ?? '') ? passo.utensilio : undefined;
  const recipienteTexto = aparelho ?? (ctx.vaso && /frigideira|wok|panela|caçarola|chapa|tigela|vasilha|assadeira|travessa|f[oô]rma|pil[aã]o|processador|liquidificador|banho|mouli|centr[ií]fuga/i.test(ctx.vaso) ? ctx.vaso : undefined) ?? (/tigela|vasilha|bowl|panela|caçarola|liquidificador|processador/i.test(passo.utensilio) ? passo.utensilio : 'tigela grande');
  mesa.removerPeca();
  mesa.garantirRecipiente(recipienteTexto, estacao.superficie.clone(), 'tigela grande');
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.4);
  // o ponto que se quer vem do passo e também do nome da técnica ("claras em neve", "chantilly")
  const alvo = alvoDoConteudo(`${texto} ${ctx.tecnica.nome}`);
  const inicial = { ...conteudo.estado, cor: conteudo.estado.cor.clone() };
  respeitarSabor(alvo, inicial.cor, texto);
  // mexer calda, caldo ou água não engrossa: o líquido continua translúcido
  if (inicial.espessura < 0.12 && !/engross|emuls|neve|picos|chantilly|maionese|creme/i.test(texto)) alvo.espessura = inicial.espessura;
  // grumos de carne continuam grumos ao misturar
  if (inicial.picos > 0.3) alvo.picos = inicial.picos;
  const nivel0 = conteudo.estado.nivel;
  // no pilão e nos aparelhos de manivela não vai batedor na mão: o próprio aparelho trabalha
  const ferramenta = aparelho ? (mesa.soltarFerramenta(), null) : mesa.pegarFerramenta(/batedor|colher|esp[aá]tula|garfo|fouet|amassador|martel|socador|^m[aã]os?$|^dedos?$/i.test(passo.utensilio.trim()) ? passo.utensilio.trim() : '', v === 'dobrar' ? 'dobrar' : v);
  const centro = mesa.centro.clone();
  const faixa: [number, number] = v === 'circular-rapido' ? [7, 22] : v === 'circular' ? [2.5, 9] : [0, 0];
  const duracao = v === 'circular-rapido' ? 7 : v === 'circular' ? 5 : 0;
  let progresso = 0;
  let noRitmo = 0;
  let total = 0;
  let angAnterior: number | null = null;
  let velAng = 0;
  // dobrar: contagem de movimentos verticais
  let direcao = 0;
  let movimentos = 0;
  let bruscos = 0;
  let acumY = 0;
  const alvoMov = 8;
  let fase = 0;

  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      const y = conteudo.position.y + conteudo.estado.nivel;
      const ponto = entrada.noPlano(camera, y);
      const r = mesa.bocaRaio * 0.75;
      let local = new THREE.Vector3();
      if (ponto) {
        local = ponto.clone().sub(centro).setY(0);
        if (local.length() > r) local.setLength(r);
      }
      if (v === 'dobrar') {
        hud.dica('Movimento de dobra: arraste para baixo devagar (cortando a mistura) e volte por cima. Sem pressa, para não perder o ar.');
        if (entrada.pressionado) {
          const dy = entrada.deltaPx.y;
          const sinal = Math.sign(dy);
          acumY += Math.abs(dy);
          if (sinal !== 0 && sinal !== direcao && acumY > 40) {
            movimentos++;
            if (Math.abs(dy) / Math.max(dt, 1e-3) > 1600) bruscos++;
            direcao = sinal;
            acumY = 0;
            audio.clique();
          }
        }
        progresso = clamp(movimentos / (alvoMov * 2));
        fase += dt * (entrada.pressionado ? 2 : 0);
        if (ferramenta) mesa.ferramentaEm(centro.clone().add(local).setY(y + 0.005), Math.atan2(local.x, local.z) + Math.PI / 2, -0.9 + Math.sin(fase) * 0.3, 0);
        hud.medidores([{ rotulo: 'Incorporado', valor: progresso, texto: `${Math.floor(movimentos / 2)} de ${alvoMov}` }]);
      } else {
        hud.dica(v === 'circular-rapido' ? 'Segure o botão e faça círculos rápidos dentro da tigela. Mantenha o ritmo na faixa azul.' : 'Segure o botão e mexa em círculos calmos, raspando as bordas.');
        if (entrada.pressionado && ponto) {
          const ang = Math.atan2(local.z, local.x);
          if (angAnterior !== null) {
            let d = ang - angAnterior;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            const inst = Math.abs(d) / Math.max(dt, 1e-3);
            velAng += (inst - velAng) * Math.min(1, dt * 6);
            conteudo.giro += d;
          }
          angAnterior = ang;
        } else {
          velAng *= Math.max(0, 1 - dt * 4);
          angAnterior = null;
        }
        total += entrada.pressionado ? dt : 0;
        const dentro = velAng >= faixa[0] && velAng <= faixa[1];
        if (dentro) {
          progresso = clamp(progresso + dt / duracao);
          noRitmo += dt;
        } else if (velAng > faixa[0] * 0.5 && ctx.modo === 'zen') {
          progresso = clamp(progresso + (dt / duracao) * 0.5);
        }
        audio.batedor(clamp(velAng / 20));
        if (ferramenta && ponto) mesa.ferramentaEm(centro.clone().add(local).setY(y + 0.01), -Math.atan2(local.z, local.x), -1.2, 0);
        const escalaBarra = faixa[1] * 1.4;
        hud.medidores([
          { rotulo: 'Ritmo', valor: clamp(velAng / escalaBarra), faixa: [faixa[0] / escalaBarra, faixa[1] / escalaBarra] },
          { rotulo: 'Ponto', valor: progresso, texto: `${Math.round(progresso * 100)}%` },
        ]);
      }
      // o conteúdo muda conforme o progresso
      const k = progresso;
      conteudo.estado.picos = inicial.picos + (alvo.picos - inicial.picos) * k;
      conteudo.estado.espessura = inicial.espessura + (alvo.espessura - inicial.espessura) * k;
      conteudo.estado.brilho = inicial.brilho + (alvo.brilho - inicial.brilho) * k;
      if (alvo.cor) conteudo.estado.cor.copy(inicial.cor).lerp(alvo.cor, k);
      conteudo.estado.nivel = nivel0 * (1 + (alvo.cresce - 1) * k);
      if (progresso >= 1) {
        if (v === 'dobrar') {
          exec.nota = clamp(1 - bruscos * 0.12);
          exec.comentario = comentar(exec.nota, 'Incorporado com delicadeza, a mistura manteve o ar.', 'Bem incorporado; alguns movimentos foram bruscos.', 'Movimentos fortes demais tiram o ar da mistura.');
        } else {
          exec.nota = clamp(noRitmo / Math.max(duracao, total * 0.85));
          exec.comentario = comentar(exec.nota, 'Ritmo constante do começo ao fim.', 'Chegou ao ponto, com algumas paradas no ritmo.', 'O ritmo oscilou bastante; a textura pode ficar irregular.');
        }
        exec.concluido = true;
      }
    },
    descartar() {
      audio.batedor(0);
      mesa.soltarFerramenta();
    },
  };
  return exec;
}

function ritmoNaPeca(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud } = ctx;
  const v = passo.variante;
  const chave = passo.alimento ?? passo.alvo;
  if (!ctx.vaso) mesa.removerRecipiente(true);
  const peca = mesa.garantirPeca(chave, estacao.superficie.clone());
  peca.rotation.y = anguloDaEstacao(estacao);
  if (!mesa.colocarNoVaso(peca, ctx.vaso, estacao.superficie.clone(), true)) {
    mesa.removerRecipiente(true);
    peca.position.copy(estacao.superficie);
  }
  const ferramenta = mesa.pegarFerramenta(passo.utensilio, v);
  // o rolo fica deitado atravessado na frente de quem abre a massa, não apontado para a câmera
  const giroFerr = ferramenta?.name === 'rolo' ? 0 : Math.PI / 2;
  const escala0 = peca.scale.clone();
  // abrir com rolo: espessura pedida
  const alvoEspessura = passo.meta?.unidade === 'mm' ? passo.meta.valor / 1000 : passo.meta?.unidade === 'cm' ? passo.meta.valor / 100 : null;
  const achatarAte = v === 'vaivem' && /abrir|esticar|laminar/.test(passo.acao) ? clamp((alvoEspessura ?? peca.altura * 0.25) / Math.max(1e-3, peca.altura * escala0.y), 0.08, 0.8) : v === 'golpes' ? 0.7 : 1;
  const alvoMov = v === 'golpes' ? 10 : v === 'pressionar' ? 1 : 12;
  let movimentos = 0;
  let direcao = 0;
  let acum = 0;
  let pressao = 0;
  let tempoNaFaixa = 0;
  let ultimoGolpe = -1;
  let t = 0;
  const intervalos: number[] = [];
  let descida = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      t += dt;
      const topo = estacao.superficie.y + peca.altura * peca.scale.y;
      const ponto = entrada.noPlano(camera, topo) ?? estacao.superficie.clone();
      let progresso = 0;
      if (v === 'vaivem' || v === 'dobrar') {
        hud.dica(v === 'dobrar' ? 'Segure e leve o mouse para cima e para baixo, dobrando e envolvendo com delicadeza.' : /sovar/.test(passo.acao) ? 'Segure e empurre a massa para longe e traga de volta, em ritmo. Repita até ficar lisa e elástica.' : 'Segure e passe o rolo para a frente e para trás, girando a massa às vezes com a roda do mouse.');
        if (entrada.pressionado) {
          const dy = entrada.deltaPx.y;
          acum += Math.abs(dy);
          const s = Math.sign(dy);
          if (s && s !== direcao && acum > 50) {
            movimentos++;
            direcao = s;
            acum = 0;
            audio.clique();
          }
        }
        if (entrada.roda) peca.rotation.y += entrada.roda * 0.3;
        progresso = clamp(movimentos / alvoMov);
        const ach = 1 - (1 - achatarAte) * progresso;
        const sova = /sovar/.test(passo.acao) ? 1 + Math.sin(t * 6) * 0.04 * (entrada.pressionado ? 1 : 0) : 1;
        peca.scale.set(escala0.x / Math.sqrt(ach) * sova, escala0.y * ach, escala0.z / Math.sqrt(ach));
        if (ferramenta) mesa.ferramentaEm(ponto.clone().setY(topo + 0.012), peca.rotation.y + giroFerr, 0, 0);
        hud.medidores([{ rotulo: /sovar/.test(passo.acao) ? 'Elasticidade' : 'Espessura', valor: progresso, texto: alvoEspessura ? `${Math.max(alvoEspessura * 1000, Math.round(peca.altura * peca.scale.y * 1000))} mm` : `${Math.round(progresso * 100)}%` }]);
        if (progresso >= 1) {
          exec.nota = 0.95;
          exec.comentario = 'Massa trabalhada por igual.';
          exec.concluido = true;
        }
      } else if (v === 'golpes') {
        hud.dica('Clique para golpear, num ritmo regular, como um metrônomo.');
        descida = Math.max(0, descida - dt * 6);
        if (ferramenta) mesa.ferramentaEm(ponto.clone().setY(topo + 0.05 - descida * 0.045), peca.rotation.y + giroFerr, ferramenta?.name === 'rolo' ? 0 : -0.2 - descida * 0.4, 0);
        if (entrada.cliqueNovo) {
          if (ultimoGolpe >= 0) intervalos.push(t - ultimoGolpe);
          ultimoGolpe = t;
          movimentos++;
          descida = 1;
          audio.corte();
          const ach = 1 - (1 - achatarAte) * clamp(movimentos / alvoMov);
          peca.scale.set(escala0.x / Math.sqrt(ach), escala0.y * ach, escala0.z / Math.sqrt(ach));
        }
        progresso = clamp(movimentos / alvoMov);
        hud.medidores([{ rotulo: 'Golpes', valor: progresso, texto: `${movimentos} de ${alvoMov}` }]);
        if (progresso >= 1) {
          const media = intervalos.reduce((s, x) => s + x, 0) / Math.max(1, intervalos.length);
          const desvio = Math.sqrt(intervalos.reduce((s, x) => s + (x - media) ** 2, 0) / Math.max(1, intervalos.length));
          exec.nota = clamp(1 - (desvio / Math.max(0.05, media)) * 1.2);
          exec.comentario = comentar(exec.nota, 'Golpes regulares, espessura por igual.', 'Bom, com um ritmo meio solto.', 'Golpes irregulares deixam partes mais finas que outras.');
          exec.concluido = true;
        }
      } else {
        // pressionar: segurar e arrastar para baixo, mantendo a força na faixa
        hud.dica('Segure o botão e puxe o mouse para baixo para fazer força. Mantenha a pressão na faixa azul até completar.');
        if (entrada.pressionado) pressao = clamp(pressao + entrada.deltaPx.y / 260);
        else pressao = Math.max(0, pressao - dt * 1.5);
        const dentro = pressao > 0.45 && pressao < 0.8;
        if (dentro) tempoNaFaixa += dt;
        progresso = clamp(tempoNaFaixa / 2.5);
        const ach = 1 - 0.35 * progresso;
        peca.scale.set(escala0.x / Math.sqrt(ach), escala0.y * ach, escala0.z / Math.sqrt(ach));
        if (ferramenta) mesa.ferramentaEm(ponto.clone().setY(topo + 0.03 - pressao * 0.025), peca.rotation.y + giroFerr, ferramenta?.name === 'rolo' ? 0 : -0.4, 0);
        audio.despejo(dentro ? 0.3 : 0);
        hud.medidores([
          { rotulo: 'Força', valor: pressao, faixa: [0.45, 0.8] },
          { rotulo: 'Progresso', valor: progresso },
        ]);
        if (progresso >= 1) {
          exec.nota = 0.9;
          exec.comentario = 'Força na medida certa.';
          exec.concluido = true;
        }
      }
    },
    descartar() {
      mesa.soltarFerramenta();
      audio.despejo(0);
    },
  };
  return exec;
}

/** Batedeira, processador, liquidificador: o aparelho bate; o jogador escolhe a velocidade certa. */
function ritmoEletrico(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud } = ctx;
  const texto = `${passo.acao} ${passo.alvo} ${passo.parametro}`;
  mesa.removerPeca();
  const aparelho = mesa.garantirRecipiente(passo.utensilio, estacao.superficie.clone(), 'batedeira');
  // o aparelho fica de frente para quem trabalha (na confeitaria a câmera está do outro lado da bancada)
  const paraCamera = estacao.camera.clone().sub(estacao.superficie);
  aparelho.rotation.y = Math.atan2(paraCamera.x, paraCamera.z);
  aparelho.updateMatrixWorld(true);
  // a ponta do aparelho é o fundo da tigela (ou do copo): o conteúdo vai ali
  const fundo = pontosDoUtensilio(aparelho).ponta.clone().applyMatrix4(aparelho.matrixWorld);
  // o centro da tigela muda com o giro do aparelho: o conteúdo acompanha
  mesa.centro.set(fundo.x, aparelho.position.y, fundo.z);
  if (mesa.conteudo) mesa.conteudo.position.set(fundo.x, mesa.conteudo.position.y, fundo.z);
  const liquidificador = /liquidificador|mixer/i.test(passo.utensilio);
  mesa.bocaRaio = liquidificador ? 0.045 : 0.07;
  mesa.fundoY = fundo.y - 0.012;
  const conteudo = mesa.garantirConteudo(textoConteudo(passo), 0.3);
  conteudo.position.set(fundo.x, mesa.fundoY, fundo.z);
  conteudo.estado.nivel = liquidificador ? 0.05 : 0.03;
  // o ponto que se quer vem do passo e também do nome da técnica ("claras em neve", "chantilly")
  const alvo = alvoDoConteudo(`${texto} ${ctx.tecnica.nome}`);
  const inicial = { ...conteudo.estado, cor: conteudo.estado.cor.clone() };
  respeitarSabor(alvo, inicial.cor, texto);
  // mexer calda, caldo ou água não engrossa: o líquido continua translúcido
  if (inicial.espessura < 0.12 && !/engross|emuls|neve|picos|chantilly|maionese|creme/i.test(texto)) alvo.espessura = inicial.espessura;
  // grumos de carne continuam grumos ao misturar
  if (inicial.picos > 0.3) alvo.picos = inicial.picos;
  const nivel0 = conteudo.estado.nivel;
  const base = aparelho.position.clone();
  // velocidades de 0 a 10; bater claras e emulsões pede velocidade alta, misturar pede baixa
  const rapido = passo.variante === 'circular-rapido' || /neve|picos|chantilly|merengue|emuls/.test(texto);
  const faixa: [number, number] = rapido ? [6, 9] : /liso|purê|pur[eê]|homog|liquidific/.test(texto) ? [5, 8] : [2, 4];
  const duracao = rapido ? 8 : 6;
  let vel = 0;
  let progresso = 0;
  let noRitmo = 0;
  let total = 0;
  let respingou = 0;
  let t = 0;
  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      t += dt;
      hud.dica(`Ajuste a velocidade com os botões − e + (ou a roda do mouse). Velocidade ${faixa[0]} a ${faixa[1]} para este ponto.`);
      if (entrada.roda) vel -= entrada.roda;
      if (entrada.apertou('e') || entrada.apertou('+') || entrada.apertou('=')) vel += 1;
      if (entrada.apertou('q') || entrada.apertou('-')) vel -= 1;
      if (entrada.pressionado) vel -= entrada.deltaPx.y * 0.03;
      vel = clamp(vel, 0, 10);
      const marcha = Math.round(vel);
      total += marcha > 0 ? dt : 0;
      const dentro = marcha >= faixa[0] && marcha <= faixa[1];
      if (dentro) {
        progresso = clamp(progresso + dt / duracao);
        noRitmo += dt;
      } else if (marcha > faixa[1]) {
        respingou += dt;
        progresso = clamp(progresso + dt / (duracao * 1.5));
      } else if (marcha > 0 && ctx.modo === 'zen') progresso = clamp(progresso + dt / (duracao * 2.5));
      // o aparelho vibra e o conteúdo gira
      const tremor = marcha * 0.00025;
      aparelho.position.set(base.x + Math.sin(t * 90) * tremor, base.y, base.z + Math.cos(t * 77) * tremor);
      conteudo.giro += marcha * dt * 3;
      conteudo.estado.ondas = marcha / 25;
      audio.batedor(marcha / 10);
      const k = progresso;
      conteudo.estado.picos = inicial.picos + (alvo.picos - inicial.picos) * k;
      conteudo.estado.espessura = inicial.espessura + (alvo.espessura - inicial.espessura) * k;
      conteudo.estado.brilho = inicial.brilho + (alvo.brilho - inicial.brilho) * k;
      if (alvo.cor) conteudo.estado.cor.copy(inicial.cor).lerp(alvo.cor, k);
      conteudo.estado.nivel = nivel0 * (1 + (alvo.cresce - 1) * k * 0.8);
      hud.medidores([
        { rotulo: 'Velocidade', valor: marcha / 10, texto: marcha === 0 ? 'desligada' : `${marcha}`, faixa: [faixa[0] / 10 - 0.02, faixa[1] / 10 + 0.02] },
        { rotulo: 'Ponto', valor: progresso, texto: `${Math.round(progresso * 100)}%` },
      ]);
      if (progresso >= 1) {
        exec.nota = clamp(noRitmo / Math.max(duracao, total * 0.9) - respingou * 0.05);
        exec.comentario = comentar(exec.nota, 'Velocidade certa do começo ao fim.', 'Chegou ao ponto; a velocidade variou um pouco.', respingou > 1 ? 'Rápido demais: respingou e pode passar do ponto.' : 'Velocidade fora da faixa boa a maior parte do tempo.');
        exec.concluido = true;
      }
    },
    descartar() {
      aparelho.position.copy(base);
      audio.batedor(0);
    },
  };
  return exec;
}
