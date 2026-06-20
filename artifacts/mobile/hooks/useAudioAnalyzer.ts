import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  ExpoAudioStreamModule,
  type AudioDataEvent,
} from "@siteed/expo-audio-studio";

const NATIVE_SAMPLE_RATE = 44100;
const NATIVE_BUFFER_SIZE = 4096;

export interface NoteData {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  midiNote: number;
}

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToNote(frequency: number): NoteData {
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const nearestMidi = Math.round(midi);
  const cents = (midi - nearestMidi) * 100;
  const noteIndex = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;
  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    frequency,
    cents: Math.max(-50, Math.min(50, cents)),
    midiNote: nearestMidi,
  };
}

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1;

  let bestOffset = -1;
  let bestCorrelation = 0;
  let lastCorrelation = 1;
  let foundGood = false;
  const correlations: number[] = new Array(MAX_SAMPLES);

  for (let offset = 1; offset < MAX_SAMPLES; offset++) {
    let corr = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      corr += Math.abs(buf[i] - buf[i + offset]);
    }
    corr = 1 - corr / MAX_SAMPLES;
    correlations[offset] = corr;

    if (corr > 0.9 && corr > lastCorrelation) {
      foundGood = true;
      if (corr > bestCorrelation) {
        bestCorrelation = corr;
        bestOffset = offset;
      }
    } else if (foundGood) {
      break;
    }
    lastCorrelation = corr;
  }

  if (bestOffset === -1) return -1;

  if (
    bestOffset > 0 &&
    bestOffset < correlations.length - 1
  ) {
    const x1 = correlations[bestOffset - 1];
    const x2 = correlations[bestOffset];
    const x3 = correlations[bestOffset + 1];
    const denom = 2 * x2 - x1 - x3;
    if (denom !== 0) {
      const shift = (x3 - x1) / (2 * denom);
      return sampleRate / (bestOffset + shift);
    }
  }

  return sampleRate / bestOffset;
}

// Decode a base64 string of 16-bit little-endian PCM into a normalized
// Float32Array (sample values in [-1, 1]) for the pitch detector. Used only
// as a fallback; the native stream is requested in float32 format.
function base64Pcm16ToFloat32(base64: string): Float32Array {
  // `atob` is available in the Expo/Hermes runtime.
  const binary = atob(base64);
  const byteLen = binary.length;
  const sampleCount = byteLen >> 1; // 2 bytes per 16-bit sample
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    let val = (hi << 8) | lo;
    if (val >= 0x8000) val -= 0x10000; // sign-extend to signed 16-bit
    out[i] = val / 32768;
  }
  return out;
}

const SIM_NOTES = [
  48, 50, 52, 53, 55, 57, 59,
  60, 62, 64, 65, 67, 69, 71,
  72, 74, 76,
];

export interface AudioAnalyzerResult {
  isListening: boolean;
  currentNote: NoteData | null;
  error: string | null;
  isSimulation: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useAudioAnalyzer(): AudioAnalyzerResult {
  const [isListening, setIsListening] = useState(false);
  const [currentNote, setCurrentNote] = useState<NoteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // True only when we are actually running the synthetic fallback
  // (e.g. mic permission denied), not merely because we're on a device.
  const [isSimulation, setIsSimulation] = useState(false);

  const rafRef = useRef<number | null>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Native mic streaming state
  const nativeSubRef = useRef<{ remove: () => void } | null>(null);
  const nativeBufRef = useRef<Float32Array>(new Float32Array(NATIVE_BUFFER_SIZE));
  const nativeFillRef = useRef(0);
  const nativeFreqsRef = useRef<number[]>([]);

  const simState = useRef({
    midiNote: 69,
    baseCents: 0,
    noteTimer: 0,
    noteDuration: 5000,
  });

  const stopInternal = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (simRef.current) {
      clearInterval(simRef.current);
      simRef.current = null;
    }
    if (nativeSubRef.current) {
      nativeSubRef.current.remove();
      nativeSubRef.current = null;
      ExpoAudioStreamModule.stopRecording().catch(() => {});
    }
    nativeFillRef.current = 0;
    nativeFreqsRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const startSimulation = useCallback(() => {
    const s = simState.current;
    s.midiNote = SIM_NOTES[Math.floor(Math.random() * SIM_NOTES.length)];
    s.baseCents = (Math.random() - 0.5) * 40;
    s.noteTimer = 0;
    s.noteDuration = 5000 + Math.random() * 4000;

    simRef.current = setInterval(() => {
      const st = simState.current;
      st.noteTimer += 50;

      st.baseCents = st.baseCents * 0.985 + (Math.random() - 0.5) * 1.2;

      if (st.noteTimer >= st.noteDuration) {
        st.midiNote = SIM_NOTES[Math.floor(Math.random() * SIM_NOTES.length)];
        st.baseCents = (Math.random() - 0.5) * 38;
        st.noteTimer = 0;
        st.noteDuration = 5000 + Math.random() * 4000;
      }

      const freq =
        midiToFrequency(st.midiNote) * Math.pow(2, st.baseCents / 1200);
      setCurrentNote(frequencyToNote(freq));
    }, 50);
  }, []);

  const startWeb = useCallback(async () => {
    const win = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx || !navigator?.mediaDevices?.getUserMedia) {
      startSimulation();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
        video: false,
      });
      streamRef.current = stream;

      const audioContext = new AudioCtx();
      audioCtxRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      const recentFreqs: number[] = [];

      const analyze = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, audioContext.sampleRate);

        if (freq > 27 && freq < 4200) {
          recentFreqs.push(freq);
          if (recentFreqs.length > 5) recentFreqs.shift();
          const sorted = [...recentFreqs].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          setCurrentNote(frequencyToNote(median));
        }

        rafRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    } catch {
      setError("Microphone access denied — showing simulation");
      setIsSimulation(true);
      startSimulation();
    }
  }, [startSimulation]);

  const startNative = useCallback(async () => {
    // Request microphone permission via the native module.
    try {
      const perm = await ExpoAudioStreamModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone access denied — showing simulation");
        setIsSimulation(true);
        startSimulation();
        return;
      }
    } catch {
      setError("Microphone unavailable — showing simulation");
      setIsSimulation(true);
      startSimulation();
      return;
    }

    nativeFillRef.current = 0;
    nativeFreqsRef.current = [];

    let loggedShape = false;
    const onAudio = async (event: AudioDataEvent) => {
      // event.data shape varies by platform/format:
      //  - Float32Array: Android (new arch) / web float32
      //  - Array<number>: iOS with streamFormat 'float32'
      //  - base64 string: raw PCM16 fallback
      let chunk: Float32Array;
      const data = event.data as unknown;
      if (!loggedShape) {
        loggedShape = true;
        const kind = data instanceof Float32Array
          ? "Float32Array"
          : Array.isArray(data)
            ? "Array"
            : typeof data;
        const len =
          data instanceof Float32Array || Array.isArray(data)
            ? (data as { length: number }).length
            : typeof data === "string"
              ? data.length
              : 0;
        const sample =
          data instanceof Float32Array || Array.isArray(data)
            ? Array.from((data as number[]).slice(0, 5))
            : null;
        console.log("[tuner] audio chunk:", { kind, len, sample });
      }
      if (data instanceof Float32Array) {
        chunk = data;
      } else if (Array.isArray(data)) {
        chunk = Float32Array.from(data as number[]);
      } else if (typeof data === "string") {
        chunk = base64Pcm16ToFloat32(data);
      } else {
        return;
      }

      const buf = nativeBufRef.current;
      let fill = nativeFillRef.current;

      for (let i = 0; i < chunk.length; i++) {
        buf[fill++] = chunk[i];
        if (fill >= NATIVE_BUFFER_SIZE) {
          const freq = autoCorrelate(buf, NATIVE_SAMPLE_RATE);
          if (freq > 27 && freq < 4200) {
            const recent = nativeFreqsRef.current;
            recent.push(freq);
            if (recent.length > 5) recent.shift();
            const sorted = [...recent].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            setCurrentNote(frequencyToNote(median));
          }
          fill = 0;
        }
      }
      nativeFillRef.current = fill;
    };

    try {
      await ExpoAudioStreamModule.startRecording({
        sampleRate: NATIVE_SAMPLE_RATE,
        channels: 1,
        encoding: "pcm_16bit",
        streamFormat: "float32",
        interval: 100,
        onAudioStream: onAudio,
      });
      // Teardown is handled by stopRecording(); no separate subscription object.
      nativeSubRef.current = { remove: () => {} };
      setIsSimulation(false);
    } catch {
      setError("Microphone unavailable — showing simulation");
      setIsSimulation(true);
      startSimulation();
    }
  }, [startSimulation]);

  const start = useCallback(async () => {
    setError(null);
    if (Platform.OS === "web") {
      await startWeb();
    } else {
      await startNative();
    }
    setIsListening(true);
  }, [startWeb, startNative]);

  const stop = useCallback(() => {
    stopInternal();
    setIsListening(false);
    setCurrentNote(null);
  }, [stopInternal]);

  useEffect(() => () => stopInternal(), [stopInternal]);

  return { isListening, currentNote, error, isSimulation, start, stop };
}
