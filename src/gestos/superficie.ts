// Gestos sobre a superfície: descascar, escamar, ralar, pincelar, polvilhar, temperar, limpar, secar.
import * as THREE from 'three';
import type { ContextoGesto, Execucao } from './base';
import { clamp, comentar } from './base';
import { anguloDaEstacao } from './mesa';
import { Particulas } from '../pecas/particulas';
import { audio } from '../motor/audio';

/**
 * Como o livro limpa em cada passo: com a faca rente (gordura, pele, nervos), sob água,
 * com escova, com os dedos, ou com pano e papel.
 */
export type ModoLimpar = 'lamina' | 'agua' | 'escova' | 'mao' | 'pano' | 'utensilio';

export function modoLimpar(acao: string, alvo: string, utensilio: string, parametro: string): ModoLimpar {
  const u = (utensilio || '').toLowerCase();
  const t = `${acao} ${alvo} ${parametro}`.toLowerCase();
  if (/faca|faquinha|cutelo|descascador|tesoura/.test(u)) return 'lamina';
  if (/escova/.test(u)) return 'escova';
  if (/papel|pano|toalha|centr[ií]fuga/.test(u)) return 'pano';
  if (/m[aã]o|dedo|palma|polegar/.test(u)) return /[aá]gua/.test(u) ? 'agua' : 'mao';
  if (/[aá]gua|torneira|escorredor/.test(u)) return 'agua';
  if (u) return 'utensilio';
  // sem utensílio no livro: o texto diz
  if (/gordura|nervo|tend[aã]o|membrana|cartilag|aparas|bordas/.test(t)) return 'lamina';
  if (/lavar|enxagu|[aá]gua|molho/.test(t)) return 'agua';
  if (/semente|folhas|cabelos|talo|caule|peles|dedo|casca|puxad/.test(t)) return 'mao';
  return 'pano';
}

/** Cor do que sai na limpeza: gordura e pele claras, terra escura, umidade azulada. */
function corDaSujeira(modo: ModoLimpar, texto: string): THREE.Color {
  const t = texto.toLowerCase();
  if (/secar|umidade|escorrer/.test(t)) return new THREE.Color('#a9cfe0');
  if (modo === 'lamina' || /gordura|pele|nervo|membrana|tend/.test(t)) {
    if (/gordura|toucinho/.test(t)) return new THREE.Color('#f3ead8');
    if (/pele/.test(t)) return new THREE.Color('#e9cfb4');
    if (/escur|sangue|b[ií]lis/.test(t)) return new THREE.Color('#5a2a26');
    return new THREE.Color('#efe6dc');
  }
  if (/semente/.test(t)) return new THREE.Color('#f2e6b0');
  if (/sal\b|a[cç][uú]car|farinha/.test(t)) return new THREE.Color('#fbf8f0');
  if (/folha|talo|caule/.test(t)) return new THREE.Color('#a8a060');
  return new THREE.Color('#6d5a3a');
}

/** Cor da cobertura conforme o que se passa na peça. */
function corDaCobertura(texto: string): THREE.Color {
  const t = texto.toLowerCase();
  if (/gema|ovo batido|dourar|glac[eê] de ovo|egg/.test(t)) return new THREE.Color('#f0b43c');
  if (/a[cç][uú]car|farinha|polvilh|confeiteiro|sal grosso|sal\b/.test(t)) return new THREE.Color('#fbf8f0');
  if (/pimenta|tempero|especiaria|p[aá]prica|cominho/.test(t)) return new THREE.Color('#7a3b1c');
  if (/ervas|salsa|cebolinha|tomilho/.test(t)) return new THREE.Color('#4c7a2a');
  if (/manteiga|[oó]leo|azeite|gordura/.test(t)) return new THREE.Color('#f6df8a');
  if (/geleia|calda|brilho|glacear|glaçar|nappar/.test(t)) return new THREE.Color('#e8a24a');
  if (/chocolate/.test(t)) return new THREE.Color('#4a2a18');
  if (/farinha de rosca|empan|p[aã]o ralado|migalha/.test(t)) return new THREE.Color('#d9a35a');
  if (/mel/.test(t)) return new THREE.Color('#e0a020');
  if (/molho|marinada/.test(t)) return new THREE.Color('#8a3b1a');
  return new THREE.Color('#f2c46a');
}

export function gestoSuperficie(ctx: ContextoGesto): Execucao {
  const { passo, mesa, estacao, entrada, camera, hud, cena } = ctx;
  const chave = passo.alimento ?? passo.alvo;
  const peca = mesa.garantirPeca(chave, estacao.superficie.clone());
  peca.rotation.y = anguloDaEstacao(estacao);
  peca.position.copy(estacao.superficie);
  const v = passo.variante; // remover | cobrir | limpar
  const texto = `${passo.acao} ${passo.alvo} ${passo.utensilio} ${passo.parametro}`;
  const corCobrir = corDaCobertura(texto);
  peca.zerarCobertura();
  peca.definirElegiveis(ctx.camera);
  const modo: ModoLimpar | null = v === 'limpar' ? modoLimpar(passo.acao, passo.alvo, passo.utensilio, passo.parametro) : null;
  const sujeira = modo ? corDaSujeira(modo, texto) : null;
  if (sujeira) peca.salpicar(sujeira, 0.12, ctx.tecnica.id.length);
  const padrao = v === 'remover' ? 'remover' : v === 'limpar' ? 'limpar' : 'cobrir';
  // na água e com os dedos não há utensílio na mão; sem utensílio no livro e com faca no texto, a faca
  const ferramenta = modo === 'agua' || modo === 'mao' ? (mesa.soltarFerramenta(), null) : mesa.pegarFerramenta(modo === 'lamina' && !/faca|faquinha|cutelo|descascador|tesoura/i.test(passo.utensilio) ? 'faca' : modo === 'pano' && !passo.utensilio ? 'pano' : passo.utensilio, padrao);
  const cor = v === 'remover' ? peca.corInterna : corCobrir;
  const corParticula = modo === 'agua' ? '#bfe4ff' : modo && sujeira ? sujeira : v === 'remover' ? '#c9b48a' : corCobrir;
  const lascas = new Particulas(corParticula, modo === 'agua' ? 200 : 120, v === 'remover' || modo === 'lamina' ? 'lasca' : 'esfera');
  cena.add(lascas);
  const escala = peca.scale.x;
  const raio = Math.max(0.016, Math.max(peca.comprimento, peca.largura) * escala * 0.08, Math.min(peca.comprimento, peca.largura) * escala * 0.3);
  const meta = v === 'cobrir' && /polvilh|salpic|temperar/.test(texto) ? 0.55 : 0.72;
  let progresso = 0;
  let ultimo: THREE.Vector3 | null = null;
  let excesso = 0;
  let girar = 0;
  const verboLimpar: Record<ModoLimpar, string> = {
    lamina: `Passe a faca rente à peça, em faixas, tirando ${passo.alvo}.`,
    agua: 'Passe a peça sob a água, por todos os lados, até ficar limpa.',
    escova: 'Esfregue com a escova, por todos os lados, até sair a sujeira.',
    mao: `Com os dedos, tire ${passo.alvo}, por toda a peça.`,
    pano: /secar/.test(passo.acao) ? 'Passe o pano por toda a peça até secar.' : 'Passe por toda a peça até ficar limpa.',
    utensilio: `Passe o utensílio por toda a peça, tirando ${passo.alvo}.`,
  };
  const verbo = modo ? verboLimpar[modo] : { remover: 'Passe o utensílio sobre a peça, em faixas, até tirar tudo.', cobrir: 'Passe por toda a superfície de forma uniforme.' }[v as 'remover'] ?? 'Passe por toda a superfície.';

  const exec: Execucao = {
    concluido: false,
    nota: 0,
    comentario: '',
    atualizar(dt) {
      lascas.atualizar(dt);
      hud.dica(`${verbo} Segure o botão e arraste. Roda do mouse gira a peça.`);
      if (entrada.roda) girar += entrada.roda * 0.35;
      peca.rotation.y += (anguloDaEstacao(estacao) + girar - peca.rotation.y) * Math.min(1, dt * 8);
      const hit = entrada.raio(camera).intersectObjects(peca.malhas(), false)[0];
      const ponto = hit?.point ?? entrada.noPlano(camera, estacao.superficie.y + peca.altura * escala * 0.8);
      if (ponto && ferramenta) {
        const n = hit?.face?.normal.clone().transformDirection(hit.object.matrixWorld) ?? new THREE.Vector3(0, 1, 0);
        // cabo vindo da direita, de quem segura com a mão direita
        // a faca entra quase deitada, rente à carne
        mesa.ferramentaEm(ponto.clone().addScaledVector(n, 0.003), peca.rotation.y + Math.PI * 0.85, modo === 'lamina' ? -0.18 : -0.6, 0);
      }
      if (entrada.pressionado && hit) {
        const mov = ultimo ? hit.point.distanceTo(ultimo) : 0;
        ultimo = hit.point.clone();
        if (mov > 0.0004 || v === 'cobrir') {
          const ganho = peca.pintar(hit.point, raio, v === 'limpar' ? 'restaurar' : v === 'remover' ? 'remover' : 'cobrir', cor, 0.22 + mov * 20);
          if (ganho < 0.05) excesso += dt; // insistindo onde já está pronto
          if (modo === 'agua') {
            // fio de água caindo de cima sobre o ponto
            for (let k = 0; k < 3; k++) lascas.emitir(hit.point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.01, 0.16 + Math.random() * 0.04, (Math.random() - 0.5) * 0.01)), new THREE.Vector3(0, -1.2, 0), { vida: 0.35, tam: 0.0025, gravidade: -6 });
          } else if (Math.random() < 0.6) {
            const vel = v === 'remover' || modo === 'lamina' ? new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4) : new THREE.Vector3(0, -0.2, 0);
            lascas.emitir(hit.point.clone().add(new THREE.Vector3(0, v === 'cobrir' ? 0.05 : 0.004, 0)), vel, { vida: 0.9, tam: v === 'remover' || modo === 'lamina' ? 0.006 : 0.0025, gravidade: -4 });
          }
          audio.batedor(Math.min(1, mov * 400) * (modo === 'agua' || modo === 'mao' ? 0.15 : 0.5));
        }
      } else {
        // escapar da borda por um instante não zera o arraste; só soltar o botão zera
        if (!entrada.pressionado) ultimo = null;
        audio.batedor(0);
      }
      progresso = peca.fracaoCoberta(0.5);
      hud.medidores([{ rotulo: v === 'remover' ? 'Retirado' : v === 'limpar' ? 'Limpo' : 'Coberto', valor: clamp(progresso / meta), texto: `${Math.round(clamp(progresso / meta) * 100)}%` }]);
      if (progresso >= meta || (ctx.modo === 'zen' && progresso >= meta * 0.8 && hud.botao('Pronto'))) {
        exec.nota = clamp(1 - excesso * 0.04 + (progresso - meta) * 0.2);
        exec.comentario = comentar(exec.nota, 'Uniforme e sem desperdício.', 'Bem coberto, com algum vai e vem extra.', 'Passou muitas vezes no mesmo lugar; isso machuca a peça.');
        exec.concluido = true;
      }
    },
    descartar() {
      cena.remove(lascas);
      lascas.descartar();
      mesa.soltarFerramenta();
      audio.batedor(0);
      hud.botao(null);
    },
  };
  return exec;
}
