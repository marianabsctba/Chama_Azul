// Som 100% sintetizado na hora: chuva com gotas na janela, música calma de piano elétrico
// com reverb, e os ruídos da cozinha. Nenhum arquivo de áudio.
type Ruido = { fonte: AudioBufferSourceNode; filtro: BiquadFilterNode; ganho: GainNode };

/** Ré maior, sem pressa: Dmaj9, Bm9, Gmaj9, A6/9 (frequências da raiz no grave). */
const PROGRESSAO: { raiz: number; notas: number[] }[] = [
  { raiz: 73.42, notas: [293.66, 369.99, 440.0, 554.37, 659.25] }, // D: D F# A C# E
  { raiz: 61.74, notas: [246.94, 293.66, 369.99, 440.0, 554.37] }, // Bm: B D F# A C#
  { raiz: 98.0, notas: [293.66, 392.0, 493.88, 587.33, 739.99] }, // G: D G B D F#
  { raiz: 55.0, notas: [277.18, 369.99, 440.0, 493.88, 659.25] }, // A: C# F# A B E
];
const MELODIA = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];

export class Audio {
  ctx: AudioContext | null = null;
  private mestre!: GainNode;
  private musica!: GainNode;
  private ambiente!: GainNode;
  private salaReverb!: ConvolverNode;
  private chuva?: Ruido;
  private chuvaGrave?: Ruido;
  private chiado?: Ruido; // fritura
  private borbulha?: Ruido; // fervura
  private bater?: Ruido; // batedor, mexer
  private jorro?: Ruido; // despejar
  private bufferRuido!: AudioBuffer;
  private proximoAcorde = 0;
  private proximaGota = 0;
  private compasso = 0;
  private silencio: HTMLAudioElement | null = null;
  private analisador: AnalyserNode | null = null;
  ligado = true;
  volumeMusica = 0.6;
  volumeChuva = 0.35;

  /** Cria ou retoma o som. Precisa ser chamado dentro de um toque ou clique (regra dos navegadores). */
  iniciar() {
    this.liberarNoIphone();
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.mestre = ctx.createGain();
    this.mestre.gain.value = this.ligado ? 0.9 : 0;
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -10;
    limitador.ratio.value = 4;
    this.mestre.connect(limitador);
    limitador.connect(ctx.destination);
    this.analisador = ctx.createAnalyser();
    this.analisador.fftSize = 2048;
    limitador.connect(this.analisador);

    // sala: reverb gerado (ruído com decaimento) para a música soar num lugar aconchegante
    this.salaReverb = ctx.createConvolver();
    this.salaReverb.buffer = this.impulso(3.2, 2.6);
    const retornoSala = ctx.createGain();
    retornoSala.gain.value = 0.55;
    this.salaReverb.connect(retornoSala);
    retornoSala.connect(this.mestre);

    this.musica = ctx.createGain();
    this.musica.gain.value = this.volumeMusica;
    const tom = ctx.createBiquadFilter();
    tom.type = 'lowpass';
    tom.frequency.value = 2600;
    this.musica.connect(tom);
    tom.connect(this.mestre);
    tom.connect(this.salaReverb);

    this.ambiente = ctx.createGain();
    this.ambiente.gain.value = this.volumeChuva * 0.5;
    this.ambiente.connect(this.mestre);

    const n = ctx.sampleRate * 3;
    this.bufferRuido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.bufferRuido.getChannelData(0);
    // ruído rosa (Paul Kellet), mais macio que o branco
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // chuva: chiado suave lá fora e um ronco grave do temporal
    // chuva abafada, vista de dentro de casa: só os graves e médios, sem chiado agudo
    this.chuva = this.ruido('lowpass', 520, 0.045, this.ambiente, 0.4);
    this.chuvaGrave = this.ruido('lowpass', 220, 0.1, this.ambiente);
    this.chiado = this.ruido('highpass', 3500, 0);
    this.borbulha = this.ruido('bandpass', 400, 0);
    this.bater = this.ruido('bandpass', 2500, 0);
    this.jorro = this.ruido('bandpass', 900, 0);
    this.proximoAcorde = ctx.currentTime + 0.6;
  }

  /** O iPhone silencia o Web Audio na chave de silencioso, a menos que um áudio HTML esteja tocando. */
  private liberarNoIphone() {
    if (this.silencio || typeof document === 'undefined') return;
    try {
      // meio segundo de silêncio em WAV, em laço
      const taxa = 8000;
      const amostras = taxa / 2;
      const buf = new ArrayBuffer(44 + amostras);
      const v = new DataView(buf);
      const escrever = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      escrever(0, 'RIFF');
      v.setUint32(4, 36 + amostras, true);
      escrever(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, taxa, true);
      v.setUint32(28, taxa, true);
      v.setUint16(32, 1, true);
      v.setUint16(34, 8, true);
      escrever(36, 'data');
      v.setUint32(40, amostras, true);
      for (let i = 0; i < amostras; i++) v.setUint8(44 + i, 128);
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      const a = new window.Audio(url);
      a.loop = true;
      a.setAttribute('playsinline', '');
      a.volume = 0.01;
      a.play().catch(() => {});
      this.silencio = a;
    } catch {
      /* sem problema: segue sem o truque */
    }
  }

  private impulso(seg: number, decai: number) {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * seg);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decai);
    }
    return b;
  }

  private ruido(tipo: BiquadFilterType, freq: number, vol: number, destino?: AudioNode, q = 1): Ruido {
    const ctx = this.ctx!;
    const fonte = ctx.createBufferSource();
    fonte.buffer = this.bufferRuido;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = freq;
    filtro.Q.value = q;
    const ganho = ctx.createGain();
    ganho.gain.value = vol;
    fonte.connect(filtro);
    filtro.connect(ganho);
    ganho.connect(destino ?? this.mestre);
    fonte.start(0, Math.random() * 2);
    return { fonte, filtro, ganho };
  }

  /** Volume de saída agora (RMS de 0 a 1), para conferir que o som está tocando. */
  nivelSaida(): number {
    if (!this.analisador) return 0;
    const d = new Float32Array(this.analisador.fftSize);
    this.analisador.getFloatTimeDomainData(d);
    let s = 0;
    for (const x of d) s += x * x;
    return Math.sqrt(s / d.length);
  }

  definirLigado(v: boolean) {
    this.ligado = v;
    if (this.ctx) this.mestre.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.2);
  }

  definirMusica(v: number) {
    this.volumeMusica = v;
    if (this.ctx) this.musica.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  definirChuva(v: number) {
    this.volumeChuva = v;
    if (this.ctx) this.ambiente.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.3);
  }

  private nivel(r: Ruido | undefined, v: number, freq?: number) {
    if (!r || !this.ctx) return;
    r.ganho.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
    if (freq) r.filtro.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }

  fritura(v: number) { this.nivel(this.chiado, v * 0.35); }
  fervura(v: number) { this.nivel(this.borbulha, v * 0.6, 250 + v * 300); }
  batedor(v: number) { this.nivel(this.bater, v * 0.25, 1800 + v * 1500); }
  despejo(v: number) { this.nivel(this.jorro, v * 0.4, 600 + v * 600); }

  /** Silencia os ruídos de trabalho (fim de passo). */
  calar() {
    this.fritura(0);
    this.fervura(0);
    this.batedor(0);
    this.despejo(0);
  }

  /** Nota de piano elétrico: duas senoides levemente desafinadas e um brilho que some rápido. */
  private piano(freq: number, inicio: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(vol, inicio + 0.015);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, inicio + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    g.connect(this.musica);
    for (const [mult, det, v] of [[1, -3, 1], [1, 3, 0.8], [2, 0, 0.18], [3.01, 0, 0.06]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = v;
      if (mult > 1) {
        og.gain.setValueAtTime(v, inicio);
        og.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.5);
      }
      o.connect(og);
      og.connect(g);
      o.start(inicio);
      o.stop(inicio + dur + 0.05);
    }
  }

  private tom(freq: number, inicio: number, dur: number, vol: number, tipo: OscillatorType = 'sine', destino?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(vol, inicio + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g);
    g.connect(destino ?? this.mestre);
    o.start(inicio);
    o.stop(inicio + dur + 0.05);
  }

  /** Gota batendo no vidro: estalinho agudo e curto. */
  private gota(inicio: number) {
    const ctx = this.ctx!;
    const f = ctx.createBufferSource();
    f.buffer = this.bufferRuido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1600 + Math.random() * 1800;
    filtro.Q.value = 6;
    const g = ctx.createGain();
    const v = 0.008 + Math.random() * 0.022;
    g.gain.setValueAtTime(v, inicio);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.035);
    f.connect(filtro);
    filtro.connect(g);
    g.connect(this.ambiente);
    f.start(inicio, Math.random() * 2);
    f.stop(inicio + 0.05);
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
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    f.connect(filtro);
    filtro.connect(g);
    g.connect(this.mestre);
    f.start(t, Math.random());
    f.stop(t + 0.1);
    this.tom(170, t, 0.08, 0.25, 'triangle');
  }

  /** Toque curto e doce de acerto. */
  acerto(nivel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 587.33;
    const notas = nivel >= 1 ? [1, 1.26, 1.5] : [1, 1.26];
    notas.forEach((m, i) => this.piano(base * m, t + i * 0.07, 1.2, 0.12));
  }

  /** Arpejo de técnica concluída. */
  conclusao(estrelas: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const escala = [392, 493.88, 587.33, 739.99, 987.77];
    for (let i = 0; i < 2 + estrelas; i++) this.piano(escala[i], t + i * 0.13, 2.2, 0.14);
  }

  clique() {
    if (!this.ctx) return;
    this.tom(1200, this.ctx.currentTime, 0.04, 0.05, 'sine');
  }

  /** Chamar a cada quadro: agenda acordes, melodia, baixo e gotas um pouco à frente. */
  atualizar() {
    const ctx = this.ctx;
    if (!ctx || !this.ligado || ctx.state !== 'running') return;
    const agora = ctx.currentTime;
    // gotas na janela: de 2 a 6 por segundo, ao acaso
    while (this.proximaGota < agora + 0.2) {
      if (this.proximaGota < agora) this.proximaGota = agora;
      this.gota(this.proximaGota);
      this.proximaGota += 0.25 + Math.random() * 0.7;
    }
    if (agora + 0.3 < this.proximoAcorde) return;
    const t0 = Math.max(agora, this.proximoAcorde);
    const c = PROGRESSAO[this.compasso % PROGRESSAO.length];
    const dur = 4.2;
    // baixo bem macio
    this.tom(c.raiz, t0, dur * 0.95, 0.09, 'sine', this.musica);
    // acorde quebrado devagar, como quem toca sem pressa
    c.notas.forEach((f, i) => {
      if (i > 2 && Math.random() < 0.3) return;
      this.piano(f, t0 + i * 0.11 + Math.random() * 0.03, dur, 0.07);
    });
    // melodia ocasional por cima
    if (this.compasso % 2 === 1 || Math.random() < 0.4) {
      let t = t0 + 1.2;
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.7) this.piano(MELODIA[Math.floor(Math.random() * MELODIA.length)], t, 2.6, 0.055);
        t += 0.6 + Math.random() * 0.5;
      }
    }
    this.compasso++;
    this.proximoAcorde = t0 + dur;
  }
}

export const audio = new Audio();
