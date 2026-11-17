// Fogo e forno: termômetro de verdade, tempo que pode ser acelerado (o "4D") e ponto pelo livro.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar, formatarTempo, minutos, temperaturas } from './base';
import { ehLiquido, temPeca, textoConteudo } from './mesa';
import { Particulas } from '../pecas/particulas';
import { audio } from '../motor/audio';

interface Perfil {
  meio: 'agua' | 'oleo' | 'acucar' | 'chocolate' | 'seco' | 'forno';
  alvos: number[];        // temperaturas do meio a alcançar em sequência
  tolerancia: number;
  tempoMin: number;       // minutos de cozinha no ponto
  interno?: number;       // temperatura interna (assados)
  reduzir?: boolean;
  flambar?: boolean;
  rotulo: string;
}

function perfil(ctx: ContextoGesto): Perfil {
  const { passo } = ctx;
  const a = passo.acao;
  const texto = `${passo.alvo} ${passo.parametro} ${passo.meio ?? ''}`;
  const temps = temperaturas(passo.parametro).filter((t) => t >= 20 && t <= 300);
  const tempo = minutos(passo.parametro);
  const base = (p: Omit<Perfil, 'tempoMin'>, padraoMin: number): Perfil => ({ ...p, tempoMin: tempo ?? padraoMin });
  if (passo.variante === 'forno') {
    const forno = temps.filter((t) => t >= 90);
    const interno = temps.find((t) => t < 90);
    const padrao = a === 'gratinar' ? 220 : a === 'tostar' ? 180 : /merengue|suspiro/.test(texto) ? 110 : 180;
    return base({ meio: 'forno', alvos: [forno[0] ?? padrao], tolerancia: 10, interno, rotulo: 'Forno' }, a === 'gratinar' ? 8 : a === 'tostar' ? 10 : a === 'assar-as-cegas' ? 15 : 35);
  }
  if (a === 'temperar-chocolate' || /temperagem|temperar o chocolate/.test(texto)) {
    return base({ meio: 'chocolate', alvos: temps.length >= 2 ? temps : [45, 27, 31], tolerancia: 1.5, rotulo: 'Chocolate' }, 0.5);
  }
  if (a === 'caramelizar' || /caramelo|calda|ponto de|a[cç][uú]car/.test(texto) && temps.some((t) => t > 105)) {
    return base({ meio: 'acucar', alvos: [temps[0] ?? 170], tolerancia: 3, rotulo: 'Calda' }, 0.5);
  }
  if (a === 'fritar' || /fritura|imers|[oó]leo quente/.test(texto)) {
    return base({ meio: 'oleo', alvos: [temps[0] ?? 175], tolerancia: 6, rotulo: 'Óleo' }, 4);
  }
  if (a === 'saltear' || a === 'grelhar' || a === 'tostar') {
    return base({ meio: 'seco', alvos: [temps[0] ?? 200], tolerancia: 15, rotulo: 'Frigideira' }, 3);
  }
  if (a === 'flambar') return base({ meio: 'seco', alvos: [80], tolerancia: 15, flambar: true, rotulo: 'Frigideira' }, 0.3);
  if (a === 'reduzir') return base({ meio: 'agua', alvos: [100], tolerancia: 2, reduzir: true, rotulo: 'Líquido' }, 10);
  if (a === 'cozinhar-lento' || a === 'pochê' || a === 'clarificar' || /fervura branda|sem ferver|fogo baixo|brando|tremul/.test(texto)) {
    return base({ meio: 'agua', alvos: [temps[0] !== undefined && temps[0] < 100 ? temps[0] : 88], tolerancia: 8, rotulo: 'Líquido' }, a === 'pochê' ? 8 : 25);
  }
  if (a === 'aquecer' && temps.length) return base({ meio: temps[0] > 100 ? 'oleo' : 'agua', alvos: [temps[0]], tolerancia: 4, rotulo: 'Temperatura' }, 1);
  if (a === 'aquecer') return base({ meio: 'agua', alvos: [70], tolerancia: 12, rotulo: 'Temperatura' }, 1);
  return base({ meio: 'agua', alvos: [100], tolerancia: 1.5, rotulo: 'Água' }, a === 'branquear' || a === 'escaldar' ? 1.5 : a === 'vapor' ? 8 : 6);
}

// cores em sRGB (setRGB trabalharia no espaço linear e a calda sairia pálida)
const CALDA_CLARA = new THREE.Color('#d39a3c');
const CALDA_AMBAR = new THREE.Color('#a4560f');
const MAX_MEIO = { agua: 100, oleo: 240, acucar: 200, chocolate: 70, seco: 260, forno: 260 };
const TAU = { agua: 45, oleo: 30, acucar: 35, chocolate: 25, seco: 15, forno: 90 };

export function gestoCalor(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, hud, cozinha, cena, relogio } = ctx;
  const p = perfil(ctx);
  const noForno = p.meio === 'forno';
  const solido = temPeca(passo);
  const liquido = !solido || (!passo.meio && ehLiquido(passo.alvo));
  const gordura = /azeite|[oó]leo|manteiga|gordura|banha/i.test(passo.meio ?? '');
  // recipiente certo para o meio (o revisado vale mais que o palpite)
  const recipienteTexto = passo.recipiente
    ? passo.recipiente
    : noForno
    ? /forma|assadeira|travessa|ramequim|tabuleiro/i.test(passo.utensilio) ? passo.utensilio : 'assadeira'
    : /panela|frigideira|wok|caçarola|sauteuse|cuscuzeira|vapor|bambu|tacho|banho/i.test(passo.utensilio)
      ? passo.utensilio
      : p.meio === 'seco' || p.meio === 'oleo' && !liquido ? 'frigideira' : 'panela';
  const onde = estacao.superficie.clone();
  // chapa sulcada, bifeteira, grelha canelada: é a chapa de ferro, não a grade de arame
  const naChapa = !noForno && /chapa|bifeteira|canelad|sulcad|riscad/i.test(`${passo.utensilio} ${passo.alvo} ${passo.parametro} ${passo.recipiente ?? ''}`);
  const rec = mesa.garantirRecipiente(naChapa ? 'chapa' : recipienteTexto, onde, noForno ? 'assadeira' : 'panela');
  void rec;
  let conteudo = null as ReturnType<typeof mesa.garantirConteudo> | null;
  // no micro-ondas e na churrasqueira a peça vai sozinha, sem banho de água ou óleo
  const aparelho = /micro|churrasqueira|brasa/i.test(recipienteTexto);
  if (!noForno && !(aparelho && solido && !passo.meio) && (p.meio !== 'seco' || liquido || passo.meio)) {
    // o meio revisado (azeite, água, caldo) entra como líquido no recipiente, nunca como garrafa
    const meioTexto = passo.meio ?? (p.meio === 'oleo' ? 'óleo' : p.meio === 'acucar' ? 'calda de açúcar' : p.meio === 'chocolate' ? 'chocolate' : liquido ? textoConteudo(passo) : 'água');
    conteudo = mesa.garantirConteudo(meioTexto, gordura && solido ? 0.12 : p.meio === 'oleo' && !liquido ? 0.35 : 0.55);
  }
  // a peça vai junto, menor para caber
  let peca = null as ReturnType<typeof mesa.garantirPeca> | null;
  if (solido) {
    const ant = mesa.peca && mesa.pecaChave === passo.alimento ? mesa.peca : null;
    peca = ant ?? mesa.garantirPeca(passo.alimento!, onde.clone());
    const maior = Math.max(peca.comprimento, peca.largura);
    const caber = (mesa.bocaRaio * 1.6) / maior;
    if (peca.scale.x > caber) peca.scale.setScalar(caber);
    const y = conteudo ? mesa.fundoY + 0.002 : mesa.fundoY + 0.004;
    peca.position.set(mesa.centro.x, y, mesa.centro.z);
  }
  const vapor = new Particulas('#ffffff', 90, 'esfera', 0.1);
  const respingo = new Particulas(p.meio === 'oleo' ? '#ffe9a0' : '#e8f4ff', 60, 'esfera', 0.9);
  const fogo = new Particulas('#ffb347', 80, 'esfera', 0.8);
  cena.add(vapor, respingo, fogo);

  let chama = noForno ? 0 : 0.2;     // 0 a 1
  let ajusteForno = noForno ? 0 : 0; // temperatura escolhida no forno
  let T = noForno ? 25 : 22;         // meio
  let Ti = 8;                        // interno da peça
  let fase = 0;                      // índice do alvo atual
  let noPonto = 0;                   // segundos de cozinha no ponto (fase final)
  let foraDoPonto = 0;
  let total = 0;
  let cozimento = peca?.cozimento ?? 0;
  const nivel0 = conteudo?.estado.nivel ?? 0;
  let flambou = false;
  let pronto = false;
  const tempoAlvo = Math.max(0.2, p.tempoMin) * 60;
  const exigeTempo = p.meio !== 'chocolate' && p.meio !== 'acucar';
  const alvoForno = p.alvos[0];

  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      // 4D: segure Espaço para o tempo correr rápido
      const rapido = entrada.teclas.has(' ');
      // qualquer cozimento passa em uns 20 s reais segurando Espaço, mesmo os de horas
      relogio.escala = rapido ? Math.max(40, tempoAlvo / 20) : Math.max(4, tempoAlvo / 240);
      const dtc = dt * relogio.escala;
      relogio.decorrido += dtc;
      total += dtc;
      // controles
      const passoRoda = entrada.roda ? -entrada.roda : 0;
      const mais = entrada.teclas.has('+') || entrada.teclas.has('=') || entrada.teclas.has('e');
      const menos = entrada.teclas.has('-') || entrada.teclas.has('q');
      if (noForno) {
        ajusteForno = clamp(ajusteForno + passoRoda * 5 + (mais ? dt * 60 : 0) - (menos ? dt * 60 : 0), 0, 260);
        if (entrada.pressionado) ajusteForno = clamp(ajusteForno - entrada.deltaPx.y * 0.6, 0, 260);
        ajusteForno = Math.round(ajusteForno);
      } else {
        chama = clamp(chama + passoRoda * 0.05 + (mais ? dt * 0.5 : 0) - (menos ? dt * 0.5 : 0));
        if (entrada.pressionado) chama = clamp(chama - entrada.deltaPx.y * 0.003);
      }
      // física simples
      const max = MAX_MEIO[p.meio];
      const Teq = noForno ? Math.max(22, ajusteForno) : 22 + chama * (p.meio === 'agua' ? 140 : (max - 22) * 1.05);
      T += (Teq - T) * (1 - Math.exp(-dtc / TAU[p.meio]));
      if (p.meio === 'agua') T = Math.min(T, 100);
      const tamanho = peca ? Math.max(0.02, Math.min(peca.comprimento, peca.largura) * peca.scale.x) : 0.05;
      const tauInterno = 400 * (tamanho / 0.06) ** 1.6;
      Ti += (T - Ti) * (1 - Math.exp(-dtc / Math.max(30, tauInterno)));
      cozinha.definirChama(noForno ? 0 : chama);
      cozinha.definirForno(noForno ? clamp(ajusteForno / 220) : 0);
      // alvo da fase atual
      const alvo = p.alvos[Math.min(fase, p.alvos.length - 1)];
      const tol = p.tolerancia;
      const dentro = Math.abs(T - alvo) <= tol || (p.meio === 'agua' && alvo >= 99 && T >= 98.8 && chama >= 0.55);
      const ultimaFase = fase >= p.alvos.length - 1;
      if (!ultimaFase && Math.abs(T - alvo) <= tol) {
        noPonto += dtc;
        if (noPonto > 15) {
          fase++;
          noPonto = 0;
          audio.acerto(0.5);
          hud.aviso(`Agora leve a ${p.alvos[fase]} °C.`, 'bom');
        }
      } else if (ultimaFase) {
        if (p.interno !== undefined) {
          if (Ti >= p.interno - 1.5) noPonto += dtc;
        } else if (dentro) noPonto += dtc;
        else if (noPonto > 0 || T > alvo + tol) foraDoPonto += dtc;
      }
      // cozimento da peça: só progride com o meio quente
      const calorUtil = clamp((T - 60) / Math.max(10, alvo - 60));
      const necessario = p.interno !== undefined ? 1 : tempoAlvo;
      const ganho = p.interno !== undefined ? clamp((Ti - 20) / Math.max(1, p.interno - 20)) - cozimento : (dtc * calorUtil) / necessario;
      if (p.interno !== undefined) cozimento = Math.max(cozimento, clamp((Ti - 20) / Math.max(1, p.interno - 20), 0, 1.6));
      else cozimento += ganho * (T > alvo + tol * 3 ? 2.2 : 1);
      if (ctx.modo === 'zen') cozimento = Math.min(cozimento, 1.08);
      peca?.definirCozimento(cozimento);
      // visual do meio
      if (conteudo) {
        const e = conteudo.estado;
        if (p.meio === 'agua') e.ondas = clamp((T - 80) / 20) * (0.3 + chama * 0.9);
        else if (p.meio === 'oleo') e.ondas = clamp((T - 140) / 60) * 0.35;
        else if (p.meio === 'acucar' && !/chocolate|cacau|ganache/i.test(`${passo.alvo} ${passo.meio ?? ''} ${mesa.contexto}`)) {
          // calda clara e translúcida até uns 150 °C; depois doura até o âmbar do caramelo (170 a 180 °C)
          const c = clamp((T - 145) / 35);
          e.cor.copy(CALDA_CLARA).lerp(CALDA_AMBAR, c);
          e.espessura = 0.13 + c * 0.2;
          e.ondas = clamp((T - 105) / 40) * 0.4;
        } else e.ondas = clamp((T - 40) / 30) * 0.1;
        if (p.reduzir) e.nivel = nivel0 * (1 - 0.5 * clamp(noPonto / tempoAlvo));
        // o vapor nasce acima da superfície e é ralo: dentro do líquido ele parecia leite ou espuma
        if (T > 75 && Math.random() < dt * 14 * clamp((T - 75) / 25)) {
          const o = conteudo.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * mesa.bocaRaio, e.nivel + 0.03, (Math.random() - 0.5) * mesa.bocaRaio));
          vapor.emitir(o, new THREE.Vector3(0, 0.3, 0), { vida: 1.6, tam: 0.008, gravidade: 0.05, cresce: 2.5, espalhar: 0.5 });
        }
        if (p.meio === 'oleo' && T > 150 && peca && Math.random() < dt * 20) {
          respingo.emitir(peca.position.clone().add(new THREE.Vector3(0, 0.01, 0)), new THREE.Vector3(0, 0.8, 0), { vida: 0.5, tam: 0.0022, gravidade: -6, espalhar: 1.5 });
        }
      } else if (noForno && T > 120 && peca && Math.random() < dt * 4) {
        vapor.emitir(peca.position.clone().add(new THREE.Vector3(0, peca.altura * peca.scale.y, 0)), new THREE.Vector3(0, 0.15, 0), { vida: 1.5, tam: 0.008, gravidade: 0.04, cresce: 2 });
      }
      // flambar

      if (flambou) {
        for (let i = 0; i < 6; i++) fogo.emitir(mesa.centro.clone().add(new THREE.Vector3((Math.random() - 0.5) * mesa.bocaRaio, mesa.fundoY - mesa.centro.y + 0.03, (Math.random() - 0.5) * mesa.bocaRaio)), new THREE.Vector3(0, 0.9, 0), { vida: 0.5, tam: 0.015, gravidade: 1, cresce: 1.2, espalhar: 0.4 });
        noPonto += dtc;
      }
      vapor.atualizar(dt);
      respingo.atualizar(dt);
      fogo.atualizar(dt);
      // som
      audio.fervura(p.meio === 'agua' ? clamp((T - 85) / 15) : 0);
      audio.fritura(p.meio === 'oleo' || p.meio === 'seco' ? clamp((T - 120) / 80) * (peca ? 1 : 0.4) : 0);
      // pronto?
      const metaTempo = p.interno !== undefined ? 30 : exigeTempo ? tempoAlvo : 20;
      pronto = ultimaFase && (p.flambar ? flambou && noPonto > 8 : noPonto >= metaTempo);
      // hud
      const termo = noForno ? `Forno ${Math.round(T)} °C (ajuste ${ajusteForno} °C)` : `${p.rotulo} ${Math.round(T)} °C`;
      const faixaT: [number, number] = [clamp((alvo - tol) / (max + 20)), clamp((alvo + tol) / (max + 20))];
      const lista = [
        { rotulo: noForno ? 'Forno' : 'Chama', valor: noForno ? ajusteForno / 260 : chama, texto: noForno ? `${ajusteForno} °C` : chama < 0.05 ? 'apagada' : chama < 0.35 ? 'baixa' : chama < 0.7 ? 'média' : 'alta' },
        { rotulo: 'Termômetro', valor: clamp(T / (max + 20)), texto: termo, faixa: faixaT },
      ];
      if (p.interno !== undefined) lista.push({ rotulo: 'Interno', valor: clamp(Ti / (p.interno * 1.3)), texto: `${Math.round(Ti)} °C de ${p.interno} °C`, faixa: [clamp((p.interno - 1.5) / (p.interno * 1.3)), clamp((p.interno + 4) / (p.interno * 1.3))] });
      lista.push({ rotulo: 'No ponto', valor: clamp(noPonto / metaTempo), texto: `${formatarTempo(noPonto / 60)} de ${formatarTempo(metaTempo / 60)}` });
      if (peca) lista.push({ rotulo: 'Cozimento', valor: clamp(cozimento / 1.4), texto: cozimento < 0.8 ? 'cru' : cozimento < 1.12 ? 'no ponto' : 'passando', faixa: [0.8 / 1.4, 1.12 / 1.4] });
      hud.medidores(lista);
      const instr = noForno
        ? `Ajuste o forno para ${alvoForno} °C com os botões − e + (ou a roda do mouse).`
        : p.meio === 'chocolate'
          ? `Derreta e ajuste a temperatura: agora ${alvo} °C. Roda do mouse controla a chama; chama apagada esfria.`
          : `Leve a ${p.meio === 'agua' && alvo >= 99 ? 'fervura forte' : alvo + ' °C'} com os botões − e + (ou a roda do mouse).`;
      hud.dica(`${instr} Segure Espaço para acelerar o tempo.${pronto ? ' Está no ponto: retire quando quiser.' : ''}`);
      const podeFlambar = p.flambar && !flambou && T >= 70;
      const clicou = hud.botao(podeFlambar ? 'Flambar' : pronto ? (noForno ? 'Tirar do forno' : 'Tirar do fogo') : null);
      if (podeFlambar && (clicou || entrada.apertou('enter'))) {
        flambou = true;
        audio.acerto(1);
      } else if (pronto && (clicou || entrada.apertou('enter'))) {
        const pontoNota = peca ? clamp(1 - Math.abs(cozimento - 1) * 1.8) : 1;
        const foraNota = clamp(1 - foraDoPonto / Math.max(60, metaTempo * 1.5));
        exec.nota = clamp(pontoNota * 0.6 + foraNota * 0.4);
        exec.comentario = comentar(exec.nota, 'Temperatura estável e ponto exato.', 'Chegou ao ponto, com a temperatura oscilando um pouco.', cozimento > 1.12 ? 'Passou do ponto: o calor ficou alto ou tempo demais.' : 'A temperatura fugiu bastante da faixa.');
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(vapor, respingo, fogo);
      vapor.descartar();
      respingo.descartar();
      fogo.descartar();
      cozinha.definirChama(0);
      cozinha.definirForno(0);
      audio.calar();
      relogio.escala = 1;
      hud.botao(null);
    },
  };
  return exec;
}
