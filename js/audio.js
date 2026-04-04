// Audio engine (procedural SFX + music).
// Loaded before app.js so the UI can call these helpers.

(() => {
const { clamp, rand, randomChoice } = window.AppUtils || {};

const getAudioState = () => (typeof window.getGameState === 'function' ? window.getGameState() : null);

const DRUMS_BASIC = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
};
const DRUMS_DRIVE = {
  kick: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
  hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
};
const DRUMS_CHILL = {
  kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
};

const MUSIC_TRACKS = [
  {
    id: 'skyline',
    name: 'Skyline Drive',
    vibe: 'Noite urbana',
    tempo: 94,
    rootMidi: 48,
    scale: [0, 2, 3, 5, 7, 10],
    melody: [0, 2, 4, 2, 0, 2, 4, 5, 4, 2, 0, 2, 4, 2, 1, 0],
    bass: [0, 0, 3, 5],
    chords: [[0, 2, 4], [3, 5, 7]]
  },
  {
    id: 'midcourt',
    name: 'Midcourt Neon',
    vibe: 'Neon suave',
    tempo: 102,
    rootMidi: 50,
    scale: [0, 2, 4, 5, 7, 9, 11],
    melody: [0, 4, 5, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2, 4, 5, 2],
    bass: [0, 0, 5, 3],
    chords: [[0, 2, 4], [5, 7, 9]]
  },
  {
    id: 'baseline',
    name: 'Baseline Pulse',
    vibe: 'Ritmo médio',
    tempo: 88,
    rootMidi: 45,
    scale: [0, 3, 5, 7, 10],
    melody: [0, 3, 0, 5, 0, 3, 7, 5, 0, 3, 0, 5, 7, 5, 3, 0],
    bass: [0, 0, 2, 3],
    chords: [[0, 2, 4], [0, 3, 5]]
  },
  {
    id: 'fastbreak',
    name: 'Fastbreak Voltage',
    vibe: 'Aceleração',
    tempo: 112,
    rootMidi: 52,
    scale: [0, 2, 3, 5, 7, 9, 10],
    melody: [0, 2, 5, 4, 2, 7, 5, 2, 0, 2, 5, 7, 5, 4, 2, 0],
    bass: [0, 5, 3, 2],
    chords: [[0, 3, 5], [2, 5, 7]],
    wave: { melody: 'sawtooth', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_DRIVE
  },
  {
    id: 'paint',
    name: 'Paint Echoes',
    vibe: 'Profundo',
    tempo: 76,
    rootMidi: 43,
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, null, 2, null, 3, null, 5, null, 7, null, 5, null, 3, null, 2, null],
    bass: [0, 0, 4, 3],
    chords: [[0, 2, 4], [0, 3, 5]],
    wave: { melody: 'sine', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_CHILL
  },
  {
    id: 'cross',
    name: 'Cross Court',
    vibe: 'Movimento',
    tempo: 98,
    rootMidi: 47,
    scale: [0, 2, 3, 5, 7, 9, 10],
    melody: [0, 2, 3, 5, 7, 5, 3, 2, 0, 2, 3, 5, 7, 9, 7, 5],
    bass: [0, 0, 3, 5],
    chords: [[0, 3, 5], [2, 5, 7]]
  },
  {
    id: 'overtime',
    name: 'Overtime Glow',
    vibe: 'Clutch',
    tempo: 84,
    rootMidi: 46,
    scale: [0, 2, 5, 7, 9],
    melody: [0, 2, 4, 2, 0, 2, 4, 5, 4, 2, 0, 2, 4, 2, 1, 0],
    bass: [0, 0, 2, 4],
    chords: [[0, 2, 4], [0, 3, 4]]
  },
  {
    id: 'arena',
    name: 'Arena Lights',
    vibe: 'Showtime',
    tempo: 106,
    rootMidi: 50,
    scale: [0, 2, 4, 7, 9],
    melody: [0, 4, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0, 2],
    bass: [0, 0, 3, 4],
    chords: [[0, 2, 4], [2, 4, 7]]
  },
  {
    id: 'rally',
    name: 'Rally Point',
    vibe: 'Explosivo',
    tempo: 120,
    rootMidi: 55,
    scale: [0, 2, 3, 5, 7, 10],
    melody: [0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 0],
    bass: [0, 3, 5, 0],
    chords: [[0, 2, 4], [3, 5, 7]],
    wave: { melody: 'sawtooth', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_DRIVE
  },
  {
    id: 'crowd',
    name: 'Crowd Waves',
    vibe: 'Ambiental',
    tempo: 90,
    rootMidi: 44,
    scale: [0, 2, 4, 5, 7, 9, 11],
    melody: [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2],
    bass: [0, 0, 4, 5],
    chords: [[0, 2, 4], [4, 7, 9]],
    wave: { melody: 'sine', bass: 'sine', chord: 'triangle' },
    drums: DRUMS_CHILL
  },
  {
    id: 'drive',
    name: 'Drive Lane',
    vibe: 'Estrada',
    tempo: 100,
    rootMidi: 49,
    scale: [0, 3, 5, 7, 10],
    melody: [0, 3, 5, 7, 5, 3, 0, 3, 5, 7, 10, 7, 5, 3, 0, 3],
    bass: [0, 2, 3, 4],
    chords: [[0, 2, 4], [0, 3, 5]],
    wave: { melody: 'square', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_BASIC
  },
  {
    id: 'finals',
    name: 'Finals Night',
    vibe: 'Finals',
    tempo: 86,
    rootMidi: 46,
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, 2, 3, 5, 7, 5, 3, 2, 0, 2, 3, 5, 7, 8, 7, 5],
    bass: [0, 0, 3, 5],
    chords: [[0, 2, 4], [3, 5, 7]],
    wave: { melody: 'triangle', bass: 'sine', chord: 'sine' },
    drums: DRUMS_CHILL
  },
  {
    id: 'citynight',
    name: 'City Night Run',
    vibe: 'Neon fast',
    tempo: 108,
    rootMidi: 51,
    scale: [0, 2, 3, 5, 7, 8, 10],
    melody: [0, 3, 5, 7, 5, 3, 2, 0, 2, 3, 5, 7, 8, 7, 5, 3],
    bass: [0, 3, 5, 3],
    chords: [[0, 3, 5], [2, 5, 7]],
    wave: { melody: 'sawtooth', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_DRIVE
  },
  {
    id: 'backboard',
    name: 'Backboard Glow',
    vibe: 'Armação',
    tempo: 92,
    rootMidi: 47,
    scale: [0, 2, 4, 7, 9],
    melody: [0, 2, 4, 2, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0, 2],
    bass: [0, 0, 4, 2],
    chords: [[0, 2, 4], [4, 7, 9]],
    wave: { melody: 'sine', bass: 'triangle', chord: 'triangle' },
    drums: DRUMS_BASIC
  },
  {
    id: 'coastline',
    name: 'Coastline Breeze',
    vibe: 'Chill',
    tempo: 80,
    rootMidi: 45,
    scale: [0, 2, 5, 7, 9],
    melody: [0, null, 2, null, 4, null, 2, null, 0, null, 2, null, 4, null, 5, null],
    bass: [0, 0, 2, 3],
    chords: [[0, 2, 4], [0, 3, 4]],
    wave: { melody: 'sine', bass: 'sine', chord: 'triangle' },
    drums: DRUMS_CHILL
  },
  {
    id: 'uptempo',
    name: 'Uptempo Circuit',
    vibe: 'Velocidade',
    tempo: 126,
    rootMidi: 53,
    scale: [0, 2, 3, 5, 7, 10],
    melody: [0, 2, 5, 7, 5, 2, 0, 2, 5, 7, 10, 7, 5, 2, 0, 2],
    bass: [0, 5, 3, 2],
    chords: [[0, 3, 5], [2, 5, 7]],
    wave: { melody: 'square', bass: 'triangle', chord: 'sine' },
    drums: DRUMS_DRIVE
  }
];

let audioCtx = null;
let musicGain = null;
let sfxGain = null;
let ambientGain = null;
let ambientSource = null;
let ambientFilter = null;
let musicInterval = null;
let musicStep = 0;
let currentMusicTrack = null;
let noiseBuffer = null;

const ensureAudioContext = () => {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = AudioContext ? new AudioContext() : null;
    if (audioCtx) {
      musicGain = audioCtx.createGain();
      sfxGain = audioCtx.createGain();
      ambientGain = audioCtx.createGain();
      musicGain.connect(audioCtx.destination);
      sfxGain.connect(audioCtx.destination);
      ambientGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (audioCtx) {
    window.audioCtx = audioCtx;
  }
};

const setMusicVolume = (value) => {
  if (!musicGain) return;
  musicGain.gain.value = clamp(value, 0, 1);
};

const setSfxVolume = (value) => {
  if (!sfxGain) return;
  sfxGain.gain.value = clamp(value, 0, 1);
};

const setAmbientVolume = (value) => {
  if (!ambientGain) return;
  ambientGain.gain.value = clamp(value, 0, 1);
};

const playTone = (freq, duration, type, gainNode, volume = 0.2) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(gainNode);
  osc.start(now);
  osc.stop(now + duration + 0.05);
};

const getNoiseBuffer = () => {
  if (!audioCtx) return null;
  if (!noiseBuffer) {
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 1, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
  }
  return noiseBuffer;
};

const playNoise = (duration, filterType, freq, volume) => {
  if (!audioCtx || !sfxGain) return;
  const source = audioCtx.createBufferSource();
  source.buffer = getNoiseBuffer();
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  source.start(now);
  source.stop(now + duration + 0.05);
};

const playNoiseToGain = (duration, filterType, freq, volume, gainNode) => {
  if (!audioCtx || !gainNode) return;
  const source = audioCtx.createBufferSource();
  source.buffer = getNoiseBuffer();
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(gainNode);
  source.start(now);
  source.stop(now + duration + 0.05);
};

const startAmbientCrowd = () => {
  if (!audioCtx || !ambientGain) return;
  if (ambientSource) return;
  ambientSource = audioCtx.createBufferSource();
  ambientSource.buffer = getNoiseBuffer();
  ambientSource.loop = true;
  ambientFilter = audioCtx.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = 520;
  ambientSource.connect(ambientFilter);
  ambientFilter.connect(ambientGain);
  ambientSource.start();
};

const stopAmbientCrowd = () => {
  if (ambientSource) {
    ambientSource.stop();
    ambientSource.disconnect();
    ambientSource = null;
  }
  if (ambientFilter) {
    ambientFilter.disconnect();
    ambientFilter = null;
  }
};

const playBounceSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.22);
};

const playSwishSfx = () => {
  playNoise(0.25, 'highpass', 1200, 0.25);
};

const playCrowdSfx = () => {
  playNoise(0.7, 'lowpass', 700, 0.18);
};

const playCheerSfx = () => {
  playNoise(0.5, 'highpass', 900, 0.16);
};

const playGroanSfx = () => {
  playNoise(0.45, 'lowpass', 420, 0.14);
};

const playChantSfx = () => {
  playNoise(0.6, 'bandpass', 880, 0.14);
};

const playStompSfx = () => {
  playThudSfx();
  setTimeout(() => playThudSfx(), 80);
};

const playCrowdVariant = () => {
  const variants = [playCrowdSfx, playCheerSfx, playChantSfx, playClapSfx];
  randomChoice(variants)();
};

const playWhistleSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.24);
};

const playRimSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.22);
};

const playSneakerSfx = () => {
  playNoise(0.08, 'highpass', 1800, 0.12);
};

const playClapSfx = () => {
  playNoise(0.12, 'bandpass', 1200, 0.18);
};

const playThudSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.2);
};

const playShortBuzzerSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(210, now + 0.25);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.3);
};

const playDunkSfx = () => {
  playThudSfx();
  setTimeout(() => playRimSfx(), 40);
};

const playBuzzerSfx = () => {
  if (!audioCtx || !sfxGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(170, now + 0.6);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.75);
};

const playSplashJingle = () => {
  ensureAudioContext();
  if (!audioCtx || !sfxGain) return;
  const now = audioCtx.currentTime;
  const tones = [
    { freq: 523.25, time: 0.0, dur: 0.16 },
    { freq: 659.25, time: 0.18, dur: 0.16 },
    { freq: 783.99, time: 0.36, dur: 0.18 },
    { freq: 659.25, time: 0.56, dur: 0.2 }
  ];
  tones.forEach((tone) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = tone.freq;
    osc.connect(gain);
    gain.connect(sfxGain);
    gain.gain.setValueAtTime(0, now + tone.time);
    gain.gain.linearRampToValueAtTime(0.18, now + tone.time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tone.time + tone.dur);
    osc.start(now + tone.time);
    osc.stop(now + tone.time + tone.dur);
  });
};

const shouldPlayAudio = (type) => {
  const state = getAudioState();
  if (!state || !state.settings) return false;
  if (type === 'music') return !!state.settings.musicOn;
  return !!state.settings.sfxOn;
};

const degreeToMidi = (track, degree, octave = 4) => {
  const scale = track.scale;
  const oct = Math.floor(degree / scale.length);
  const idx = degree % scale.length;
  return track.rootMidi + scale[idx] + (octave - 4 + oct) * 12;
};

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const playChord = (track, chord, duration) => {
  chord.forEach((degree) => {
    const midi = degreeToMidi(track, degree, 4);
    const wave = track.wave && track.wave.chord ? track.wave.chord : 'triangle';
    playTone(midiToFreq(midi), duration, wave, musicGain, 0.08);
  });
};

const scheduleMusicStep = (track) => {
  if (!audioCtx || !musicGain) return;
  const wave = track.wave || { melody: 'triangle', bass: 'sine', chord: 'triangle' };
  const step = musicStep % track.melody.length;
  const degree = track.melody[step];
  const stepDuration = (60 / track.tempo) / 4;
  const accent = step % 4 === 0 ? 1.15 : 1;
  if (degree !== null && typeof degree !== 'undefined') {
    const midi = degreeToMidi(track, degree, 5);
    const volume = 0.1 + Math.random() * 0.05;
    playTone(midiToFreq(midi), stepDuration * 0.9, wave.melody || 'triangle', musicGain, volume * accent);
  }
  if (step % 4 === 0) {
    const bassDegree = track.bass[(step / 4) % track.bass.length];
    if (bassDegree !== null && typeof bassDegree !== 'undefined') {
      const midi = degreeToMidi(track, bassDegree, 3);
      playTone(midiToFreq(midi), stepDuration * 2.2, wave.bass || 'sine', musicGain, 0.18 * accent);
    }
  }
  if (step % 16 === 0) {
    const chord = track.chords[(step / 16) % track.chords.length];
    if (chord) playChord(track, chord, stepDuration * 6);
  }
  const drums = track.drums || DRUMS_BASIC;
  if (drums) {
    const index = step % drums.kick.length;
    if (drums.kick[index]) {
      playTone(90, stepDuration * 0.5, 'sine', musicGain, 0.12);
    }
    if (drums.clap && drums.clap[index]) {
      playNoiseToGain(stepDuration * 0.25, 'bandpass', 1300, 0.08, musicGain);
    }
    if (drums.hat && drums.hat[index]) {
      playNoiseToGain(stepDuration * 0.18, 'highpass', 2600, 0.04, musicGain);
    }
  }
  musicStep += 1;
};

const stopMusic = () => {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = null;
  currentMusicTrack = null;
  musicStep = 0;
};

const startMusicTrack = (index) => {
  if (!shouldPlayAudio('music')) return;
  ensureAudioContext();
  if (!audioCtx) return;
  const safeIndex = index % MUSIC_TRACKS.length;
  if (currentMusicTrack === safeIndex && musicInterval) return;
  stopMusic();
  currentMusicTrack = safeIndex;
  musicStep = 0;
  const track = MUSIC_TRACKS[safeIndex];
  const stepMs = ((60 / track.tempo) / 4) * 1000;
  scheduleMusicStep(track);
  musicInterval = setInterval(() => scheduleMusicStep(track), stepMs);
};

window.MUSIC_TRACKS = MUSIC_TRACKS;
const getAudioContext = () => audioCtx;
window.AppAudio = {
  ensureAudioContext,
  setMusicVolume,
  setSfxVolume,
  setAmbientVolume,
  getAudioContext,
  startMusicTrack,
  stopMusic,
  startAmbientCrowd,
  stopAmbientCrowd,
  shouldPlayAudio,
  playBounceSfx,
  playSwishSfx,
  playCrowdSfx,
  playCheerSfx,
  playGroanSfx,
  playChantSfx,
  playStompSfx,
  playCrowdVariant,
  playWhistleSfx,
  playRimSfx,
  playSneakerSfx,
  playClapSfx,
  playThudSfx,
  playShortBuzzerSfx,
  playDunkSfx,
  playBuzzerSfx,
  playSplashJingle
};

window.ensureAudioContext = ensureAudioContext;
window.setMusicVolume = setMusicVolume;
window.setSfxVolume = setSfxVolume;
window.setAmbientVolume = setAmbientVolume;
window.getAudioContext = getAudioContext;
window.startMusicTrack = startMusicTrack;
window.stopMusic = stopMusic;
window.startAmbientCrowd = startAmbientCrowd;
window.stopAmbientCrowd = stopAmbientCrowd;
window.shouldPlayAudio = shouldPlayAudio;
window.playBounceSfx = playBounceSfx;
window.playSwishSfx = playSwishSfx;
window.playCrowdSfx = playCrowdSfx;
window.playCheerSfx = playCheerSfx;
window.playGroanSfx = playGroanSfx;
window.playChantSfx = playChantSfx;
window.playStompSfx = playStompSfx;
window.playCrowdVariant = playCrowdVariant;
window.playWhistleSfx = playWhistleSfx;
window.playRimSfx = playRimSfx;
window.playSneakerSfx = playSneakerSfx;
window.playClapSfx = playClapSfx;
window.playThudSfx = playThudSfx;
window.playShortBuzzerSfx = playShortBuzzerSfx;
window.playDunkSfx = playDunkSfx;
window.playBuzzerSfx = playBuzzerSfx;
window.playSplashJingle = playSplashJingle;
})();
