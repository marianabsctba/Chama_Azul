// Uma técnica do começo ao fim: passo a passo, voando entre as estações.
import * as THREE from 'three';
import type { CenaEstacao, Cozinha, Tecnica } from './tipos';
import type { ContextoGesto, Execucao, Hud, Modo, Relogio } from './gestos/base';
import { FABRICAS, estacaoDoPasso } from './gestos';
import { Mesa } from './gestos/mesa';
import type { Jogador } from './motor/jogador';
import type { Entrada } from './motor/entrada';
import { audio } from './motor/audio';

export interface ResultadoPasso {
  nota: number;
  comentario: string;
  pulado: boolean;
}

export interface EventosMissao {
  aoPasso(i: number, total: number): void;
  aoResultadoPasso(i: number, r: ResultadoPasso): void;
  aoFim(resultados: ResultadoPasso[]): void;
}

export class Missao {
  readonly tecnica: Tecnica;
  readonly resultados: ResultadoPasso[] = [];
  indice = -1;
  private exec: Execucao | null = null;
  private estacaoAtual: CenaEstacao | null = null;
  private esperando = false;
  private pausaEntrePassos = 0;
  readonly mesa: Mesa;
  readonly relogio: Relogio = { escala: 1, decorrido: 0 };
  encerrada = false;

  constructor(
    tecnica: Tecnica,
    private cena: THREE.Scene,
    private cozinha: Cozinha,
    private jogador: Jogador,
    private entrada: Entrada,
    private hud: Hud,
    private modo: Modo,
    private eventos: EventosMissao,
  ) {
    this.tecnica = tecnica;
    this.mesa = new Mesa(cena);
  }

  iniciar() {
    this.proximo();
  }

  private proximo() {
    this.exec?.descartar();
    this.exec = null;
    this.indice++;
    if (this.indice >= this.tecnica.passos.length) {
      this.cozinha.abrirPorta('forno', false);
      this.cozinha.abrirPorta('geladeira', false);
      this.encerrada = true;
      this.eventos.aoFim(this.resultados);
      return;
    }
    const passo = this.tecnica.passos[this.indice];
    const est = estacaoDoPasso(passo, this.tecnica, this.estacaoAtual);
    this.eventos.aoPasso(this.indice, this.tecnica.passos.length);
    const comecar = () => {
      const estacao = this.cozinha.estacoes[est];
      // ao trocar de estação, o que estava na mão fica para trás; a peça segue junto
      if (this.estacaoAtual !== est) {
        this.mesa.soltarFerramenta();
        this.mesa.limparExtras();
        if (this.mesa.peca) this.mesa.peca.position.copy(estacao.superficie);
        if (this.mesa.recipiente && passo.gesto !== 'calor' && passo.gesto !== 'testar') this.mesa.removerRecipiente(true);
      }
      this.estacaoAtual = est;
      this.relogio.decorrido = 0;
      // miúdos em punhado quando o passo trata do conjunto (panela, forno, descanso, tempero, ponto)
      this.mesa.mostrarPunhado = passo.gesto === 'calor' || passo.gesto === 'tempo' || passo.gesto === 'testar' || (passo.gesto === 'superficie' && passo.variante === 'cobrir');
      const ctx: ContextoGesto = {
        cena: this.cena,
        camera: this.jogador.camera,
        entrada: this.entrada,
        cozinha: this.cozinha,
        estacao,
        passo,
        tecnica: this.tecnica,
        modo: this.modo,
        hud: this.hud,
        mesa: this.mesa,
        relogio: this.relogio,
      };
      try {
        this.exec = FABRICAS[passo.gesto](ctx);
        const proprio = passo.gesto === 'montar' && (passo.variante === 'decorar' || passo.variante === 'rechear');
        if (passo.adicionar?.length && !proprio) this.mesa.adicionarSobre(passo.adicionar, passo.gesto === 'calor' || passo.gesto === 'superficie' ? 'espalhado' : 'linha');
      } catch (e) {
        console.error('falha ao iniciar gesto', passo, e);
        this.resultados.push({ nota: 1, comentario: '', pulado: true });
        this.proximo();
        return;
      }
      this.esperando = false;
    };
    const estacao = this.cozinha.estacoes[est];
    this.esperando = true;
    // a porta abre enquanto a câmera chega e fecha quando o trabalho vai para outro lugar
    this.cozinha.abrirPorta('forno', est === 'forno');
    this.cozinha.abrirPorta('geladeira', est === 'geladeira');
    this.jogador.modo = 'trabalho';
    if (this.estacaoAtual !== est || this.indice === 0) {
      // aproxima a câmera da superfície: trabalho fino pede olho perto
      let perto = { corte: 0.55, confeitaria: 0.55, balanca: 0.6, fogao: 0.75, pia: 0.7, geladeira: 0.85, forno: 0.85, caderno: 1 }[est] ?? 0.7;
      // aparelhos altos (batedeira, processador) pedem um passo atrás
      if (passo.gesto === 'ritmo' && /batedeira|processador|liquidificador|mixer/i.test(passo.utensilio)) perto = 1.05;
      // despejar: as duas vasilhas inteiras em cena
      if (passo.gesto === 'verter' && passo.variante === 'despejar') perto = 1.15;
      const cam = estacao.superficie.clone().add(estacao.camera.clone().sub(estacao.superficie).multiplyScalar(perto));
      this.jogador.voar(cam, estacao.superficie, this.indice === 0 ? 1.4 : 0.9, comecar);
    } else {
      comecar();
    }
  }

  /** O gesto do passo atual já está em cena e recebendo a mão? */
  get pronto() {
    return !!this.exec && !this.esperando && this.pausaEntrePassos <= 0;
  }

  /** Pula o passo atual (conta como feito no modo zen, nota zero no modo prova). */
  pular() {
    if (!this.exec || this.esperando) return;
    this.resultados.push({ nota: this.modo === 'zen' ? 0.6 : 0, comentario: 'Passo pulado.', pulado: true });
    this.eventos.aoResultadoPasso(this.indice, this.resultados[this.resultados.length - 1]);
    this.proximo();
  }

  atualizar(dt: number) {
    this.mesa.atualizar(dt);
    if (this.pausaEntrePassos > 0) {
      this.pausaEntrePassos -= dt;
      if (this.pausaEntrePassos <= 0) this.proximo();
      return;
    }
    if (!this.exec || this.esperando) return;
    try {
      this.exec.atualizar(dt);
    } catch (e) {
      console.error('falha no gesto', this.tecnica.passos[this.indice], e);
      this.exec.concluido = true;
      this.exec.nota = 1;
      this.exec.comentario = '';
    }
    if (this.exec.concluido) {
      const r = { nota: this.exec.nota, comentario: this.exec.comentario, pulado: false };
      this.resultados.push(r);
      audio.acerto(r.nota >= 0.85 ? 1 : 0.5);
      audio.calar();
      this.eventos.aoResultadoPasso(this.indice, r);
      this.exec.descartar();
      this.exec = null;
      this.pausaEntrePassos = 1.1;
    }
  }

  encerrar() {
    this.cozinha.abrirPorta('forno', false);
    this.cozinha.abrirPorta('geladeira', false);
    this.exec?.descartar();
    this.exec = null;
    this.mesa.limparTudo();
    audio.calar();
    this.encerrada = true;
  }
}

/** Média das notas em estrelas (1 a 3). */
export function estrelas(resultados: ResultadoPasso[]) {
  if (!resultados.length) return 1;
  const m = resultados.reduce((s, r) => s + r.nota, 0) / resultados.length;
  return m >= 0.85 ? 3 : m >= 0.6 ? 2 : 1;
}

export function media(resultados: ResultadoPasso[]) {
  return resultados.length ? resultados.reduce((s, r) => s + r.nota, 0) / resultados.length : 0;
}
