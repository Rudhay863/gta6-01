// audio.js — all sound is synthesized with WebAudio; no audio files, no network.
// Engine hum follows the driven car's speed, the siren wails while the police
// chase, and a tiny bass sequencer plays a laid-back groove while free-roaming.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  // Must be called from a user gesture at least once; safe to call repeatedly.
  ensure() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.started = true;
      this._startEngine();
      this._startMusic();
    } catch (e) {
      this.ctx = null; // headless / no audio device: the game stays silent
    }
  }

  _startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();
  }

  // speed 0..1 of the driven car's top speed; 0 silences the engine.
  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = this.muted || !driving ? 0 : 0.03 + speedRatio * 0.05;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
        this.sirenOsc.start();
      }
      this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.025, this.ctx.currentTime, 0.3);
      // Two-tone wail, alternating every 0.45 s.
      let high = true;
      const wail = () => {
        if (!this.sirenOn || !this.sirenOsc) return;
        this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, this.ctx.currentTime, 0.05);
        high = !high;
        this._sirenTimer = setTimeout(wail, 450);
      };
      wail();
    } else {
      clearTimeout(this._sirenTimer);
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  _blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  _noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  gunshot() { this._noise(0.14, 0.25, 2400); }
  crash() { this._noise(0.25, 0.3, 500); }
  pickup() { this._blip(880, 0.12, 'sine', 0.1); setTimeout(() => this._blip(1320, 0.15, 'sine', 0.1), 90); }
  denied() { this._blip(160, 0.2, 'square', 0.06); }
  door() { this._noise(0.08, 0.12, 900); }

  missionComplete() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.25, 'triangle', 0.12), i * 130));
  }

  missionFailed() {
    if (!this.ctx || this.muted) return;
    [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'triangle', 0.1), i * 160));
  }

  // Simple 8-step bass groove in A minor, scheduled ahead of time.
  _startMusic() {
    const bass = [55, 0, 55, 65.41, 55, 0, 49, 61.74];
    const tick = () => {
      if (!this.musicOn || this.muted || !this.ctx) {
        this.musicTimer = setTimeout(tick, 240);
        return;
      }
      const f = bass[this.musicStep % bass.length];
      if (f > 0) this._blip(f, 0.22, 'triangle', 0.035);
      if (this.musicStep % 2 === 0) this._blip(220, 0.05, 'sine', 0.012);
      this.musicStep++;
      this.musicTimer = setTimeout(tick, 240);
    };
    this.musicTimer = setTimeout(tick, 240);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain && !this.sirenOn) this.sirenGain.gain.value = 0;
    return this.muted;
  }
}
