// Som 100% sintetizado: chuva, acordes calmos e ruídos de cozinha. Nenhum arquivo de áudio.
type Ruido = { fonte: AudioBufferSourceNode; filtro: BiquadFilterNode; ganho: GainNode };

export class Audio {
  ctx: AudioContext | null = null;
  private mestre!: GainNode;
  private musica!: GainNode;
  private chuva?: Ruido;
  private chiado?: Ruido;   // fritura
  private borbulha?: Ruido; // fervura
  private bater?: Ruido;    // batedor, mexer
  private jorro?: Ruido;    // despejar
  private bufferRuido!: AudioBuffer;
  private proximoAcorde = 0;
  private grau = 0;
  ligado = true;
  volumeMusica = 0.5;

  iniciar() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.ligado ? 0.8 : 0;
    this.mestre.connect(this.ctx.destination);
    this.musica = this.ctx.createGain();
    this.musica.gain.value = this.volumeMusica * 0.35;
    // eco suave para a música
    const atraso = this.ctx.createDelay(1);
    atraso.delayTime.value = 0.42;
    const retorno = this.ctx.createGain();
    retorno.gain.value = 0.35;
    const filtroEco = this.ctx.createBiquadFilter();
    filtroEco.type = 'lowpass';
    filtroEco.frequency.value = 1800;
    this.musica.connect(this.mestre);
    this.musica.connect(atraso);
    atraso.connect(filtroEco);
    filtroEco.connect(retorno);
    retorno.connect(atraso);
    retorno.connect(this.mestre);

    const n = this.ctx.sampleRate * 2;
    this.bufferRuido = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.bufferRuido.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < n; i++) {
      const b = Math.random() * 2 - 1;
      ultimo = (ultimo + 0.02 * b) / 1.02; // ruído marrom
      d[i] = ultimo * 3.5 * 0.5 + b * 0.5;
    }
    this.chuva = this.ruido('lowpass', 1200, 0.18);
    this.chiado = this.ruido('highpass', 3500, 0);
    this.borbulha = this.ruido('bandpass', 400, 0);
    this.bater = this.ruido('bandpass', 2500, 0);
    this.jorro = this.ruido('bandpass', 900, 0);
  }

  private ruido(tipo: BiquadFilterType, freq: number, vol: number): Ruido {
    const ctx = this.ctx!;
    const fonte = ctx.createBufferSource();
    fonte.buffer = this.bufferRuido;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = freq;
    const ganho = ctx.createGain();
    ganho.gain.value = vol;
    fonte.connect(filtro);
    filtro.connect(ganho);
    ganho.connect(this.mestre);
    fonte.start();
    return { fonte, filtro, ganho };
  }

  definirLigado(v: boolean) {
    this.ligado = v;
    if (this.ctx) this.mestre.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.2);
  }

  definirMusica(v: number) {
    this.volumeMusica = v;
    if (this.ctx) this.musica.gain.setTargetAtTime(v * 0.35, this.ctx.currentTime, 0.3);
  }

  private nivel(r: Ruido | undefined, v: number, freq?: number) {
    if (!r || !this.ctx) return;
    r.ganho.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
    if (freq) r.filtro.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }

  fritura(v: number) { this.nivel(this.chiado, v * 0.12); }
  fervura(v: number) { this.nivel(this.borbulha, v * 0.25, 250 + v * 300); }
  batedor(v: number) { this.nivel(this.bater, v * 0.08, 1800 + v * 1500); }
  despejo(v: number) { this.nivel(this.jorro, v * 0.15, 600 + v * 600); }

  /** Silencia os ruídos de trabalho (fim de passo). */
  calar() {
    this.fritura(0);
    this.fervura(0);
    this.batedor(0);
    this.despejo(0);
  }

  private tom(freq: number, inicio: number, dur: number, vol: number, tipo: OscillatorType = 'sine', destino?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(vol, inicio + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g);
    g.connect(destino ?? this.mestre);
    o.start(inicio);
    o.stop(inicio + dur + 0.05);
  }

  /** Batida de faca na tábua. */
  corte() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = this.ctx.createBufferSource();
    f.buffer = this.bufferRuido;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1400 + Math.random() * 600;
    filtro.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    f.connect(filtro);
    filtro.connect(g);
    g.connect(this.mestre);
    f.start(t, Math.random());
    f.stop(t + 0.1);
    this.tom(180, t, 0.07, 0.15, 'triangle');
  }

  /** Toque curto e doce de acerto. */
  acerto(nivel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 523.25;
    const notas = nivel >= 1 ? [1, 1.25, 1.5] : [1, 1.25];
    notas.forEach((m, i) => this.tom(base * m, t + i * 0.07, 0.5, 0.09, 'sine'));
  }

  /** Arpejo de técnica concluída. */
  conclusao(estrelas: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const escala = [392, 493.88, 587.33, 783.99, 987.77];
    for (let i = 0; i < 2 + estrelas; i++) this.tom(escala[i], t + i * 0.12, 1.2, 0.08, 'triangle');
  }

  clique() {
    if (!this.ctx) return;
    this.tom(880, this.ctx.currentTime, 0.05, 0.04, 'square');
  }

  /** Chamar a cada quadro: chuva constante e acordes lentos e aleatórios (pentatônica). */
  atualizar() {
    if (!this.ctx || !this.ligado) return;
    const agora = this.ctx.currentTime;
    if (agora < this.proximoAcorde) return;
    // progressão calma em ré maior pentatônica, notas longas
    const raizes = [146.83, 164.81, 196.0, 220.0, 123.47];
    const passo = [0, 3, 1, 4, 2][this.grau % 5];
    this.grau++;
    const r = raizes[passo];
    const acorde = [1, 1.5, 2, 2.5198, 3];
    acorde.forEach((m, i) => {
      if (Math.random() < 0.25 && i > 1) return;
      this.tom(r * m, agora + i * 0.18 + Math.random() * 0.05, 5.5, 0.05, 'sine', this.musica);
    });
    // melodia ocasional
    if (Math.random() < 0.6) {
      const pent = [587.33, 659.25, 739.99, 880, 987.77];
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.5) this.tom(pent[Math.floor(Math.random() * 5)], agora + 1.2 + k * 0.9, 2.2, 0.03, 'triangle', this.musica);
      }
    }
    this.proximoAcorde = agora + 6 + Math.random() * 2;
  }
}

export const audio = new Audio();
