// Uma técnica do começo ao fim: passo a passo, voando entre as estações.
import * as THREE from 'three';
import type { CenaEstacao, Cozinha, Tecnica } from './tipos';
import type { ContextoGesto, Execucao, Hud, Modo, Relogio } from './gestos/base';
import { FABRICAS, estacaoDoPasso, vasoDoPasso } from './gestos';
import { Mesa } from './gestos/mesa';
import type { Jogador } from './motor/jogador';
import type { Entrada } from './motor/entrada';
import { audio } from './motor/audio';
import type { Peca } from './pecas/peca';
import type { EstadoPeca } from './tipos';

/**
 * Corta a peça no estado em que ela entra no passo (metades, fatias, tiras, cubos, picada), se ainda
 * estiver inteira: o passo de deixar de molho os palitos já começa com os palitos.
 */
export function prepararEstado(peca: Peca, estado: EstadoPeca) {
  if (estado === 'descascado') {
    peca.descascar();
    return;
  }
  if (estado === 'inteiro' || peca.fragmentos.length >= 2) return;
  if (estado === 'quartos') {
    peca.cortar('x', 0);
    peca.cortar('z', 0);
    return;
  }
  const L = peca.comprimento;
  const W = peca.largura;
  const H = peca.altura;
  const nx = { metades: 1, fatias: 6, tiras: 5, cubos: 4, picado: 7 }[estado as 'metades' | 'fatias' | 'tiras' | 'cubos' | 'picado'];
  const ini = estado === 'metades' ? 0 : -L * 0.42;
  const fim = estado === 'metades' ? 0 : L * 0.42;
  for (let i = 0; i <= nx; i++) {
    const x = estado === 'metades' ? 0 : ini + ((fim - ini) * i) / nx;
    peca.cortar('x', x);
    if (estado === 'metades') break;
  }
  if (estado === 'tiras' || estado === 'cubos' || estado === 'picado') {
    const nz = estado === 'picado' ? 4 : 3;
    for (let j = 1; j < nz; j++) peca.cortar('z', -W / 2 + (W * j) / nz);
  }
  if (estado === 'cubos' || estado === 'picado') peca.cortar('y', H * 0.5);
}

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
  /** Gesto que acabou: a cena dele (peneira, ferramenta, extras) fica à vista durante a pausa. */
  private terminado: Execucao | null = null;
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
    this.terminado?.descartar();
    this.terminado = null;
    this.indice++;
    if (this.indice >= this.tecnica.passos.length) {
      this.cozinha.abrirPorta('forno', false);
      this.cozinha.abrirPorta('geladeira', false);
      this.encerrada = true;
      this.eventos.aoFim(this.resultados);
      return;
    }
    const passo = this.tecnica.passos[this.indice];
    this.mesa.contexto = this.tecnica.nome;
    this.mesa.acao = `${passo.acao} ${passo.parametro}`;
    const vaso = vasoDoPasso(this.tecnica, this.indice);
    const est = estacaoDoPasso(passo, this.tecnica, this.estacaoAtual, vaso);
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
        vaso,
      };
      // ficha de cena: a peça entra no passo no estado e no ponto que o livro descreve
      if (passo.alimento && (passo.estadoPeca || passo.ponto)) {
        const peca = this.mesa.garantirPeca(passo.alimento, estacao.superficie.clone());
        if (passo.estadoPeca) prepararEstado(peca, passo.estadoPeca);
        if (passo.ponto) peca.definirCozimento({ cru: 0, cozido: 1, dourado: 1.08, tostado: 1.2 }[passo.ponto]);
      }
      try {
        this.exec = FABRICAS[passo.gesto](ctx);
        const proprio = passo.gesto === 'montar' && (passo.variante === 'decorar' || passo.variante === 'rechear');
        if (passo.adicionar?.length && !proprio) this.mesa.adicionarSobre(passo.adicionar, passo.gesto === 'calor' || passo.gesto === 'superficie' ? 'espalhado' : 'linha');
        // técnica que começa com a peça já assada ou cozida (trinchar, fatiar o assado): ela entra no ponto
        const est0 = this.tecnica.prato?.estado;
        const semFogo = !this.tecnica.passos.some((p) => p.gesto === 'calor') && /trinch|fatiar|desfiar|testar|cortar costelas|cozid|assad|servir|enfeitar|decorar|glacear|desenformar|apertar|al dente/i.test(this.tecnica.nome);
        if (est0 && est0 !== 'cru' && semFogo && this.mesa.peca && this.mesa.pecaChave === (this.tecnica.prato?.principal ?? this.mesa.pecaChave)) {
          const alvo = est0 === 'cozido' ? 1 : est0 === 'dourado' ? 1.08 : 1.2;
          if (this.mesa.peca.cozimento < alvo) this.mesa.peca.definirCozimento(alvo);
        }
        this.enquadrar(est, estacao);
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
    return !!this.exec && !this.esperando && this.pausaEntrePassos <= 0 && !this.jogador.voando;
  }

  /**
   * Enquadra o que está em cena no passo (alimento, recipiente, peneira, tigela de destino) pelo
   * tamanho real: a codorna não some na tábua e o peru não cola na tela.
   */
  private enquadrar(est: CenaEstacao, estacao: { superficie: THREE.Vector3; camera: THREE.Vector3 }) {
    if (est === 'forno' || est === 'geladeira' || est === 'balanca') return;
    const caixa = new THREE.Box3();
    // a peça e o recipiente; os extras (guias da faca, marcas) só entram quando são a outra vasilha do despejo
    const passo = this.tecnica.passos[this.indice];
    const extras = passo?.gesto === 'verter' ? this.mesa.extras.filter((o) => o instanceof THREE.Group) : [];
    for (const o of [this.mesa.recipiente, ...extras]) if (o) caixa.expandByObject(o);
    // a peça pelo próprio tamanho (as guias da faca e as marcas presas a ela não contam)
    const pc = this.mesa.peca;
    if (pc) {
      pc.updateMatrixWorld(true);
      const s = pc.scale.x;
      const meio = Math.max(pc.comprimento, pc.largura) * s * 0.5;
      const base = pc.getWorldPosition(new THREE.Vector3());
      caixa.expandByPoint(base.clone().add(new THREE.Vector3(-meio, 0, -meio)));
      caixa.expandByPoint(base.clone().add(new THREE.Vector3(meio, pc.altura * s, meio)));
    }
    if (caixa.isEmpty()) return;
    const centro = caixa.getCenter(new THREE.Vector3());
    const raio = THREE.MathUtils.clamp(caixa.getSize(new THREE.Vector3()).length() / 2, 0.05, 0.55);
    const fov = (this.jogador.camera.fov * Math.PI) / 180;
    const d = THREE.MathUtils.clamp((raio / Math.sin(fov / 2)) * 1.2, 0.26, 1.5);
    const dir = estacao.camera.clone().sub(estacao.superficie).normalize();
    this.jogador.voar(centro.clone().addScaledVector(dir, d), centro, 0.45);
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
      this.terminado = this.exec;
      this.exec = null;
      this.pausaEntrePassos = 1.1;
    }
  }

  encerrar() {
    this.cozinha.abrirPorta('forno', false);
    this.cozinha.abrirPorta('geladeira', false);
    this.exec?.descartar();
    this.exec = null;
    this.terminado?.descartar();
    this.terminado = null;
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
