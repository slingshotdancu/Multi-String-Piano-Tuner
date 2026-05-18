import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AudioAnalyzerResult,
  NoteData,
  midiToFrequency,
  useAudioAnalyzer,
} from "@/hooks/useAudioAnalyzer";

export type StringCount = 1 | 2 | 3;
export type DisplayMode = "cents" | "hz";

export interface StringData {
  id: number;
  cents: number;
  frequency: number;
}

interface TunerContextValue {
  isActive: boolean;
  toggle: () => void;
  currentNote: NoteData | null;
  strings: StringData[];
  stringCount: StringCount;
  setStringCount: (n: StringCount) => void;
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
  isSimulation: boolean;
  error: string | null;
}

const TunerContext = createContext<TunerContextValue | null>(null);

export function TunerProvider({ children }: { children: React.ReactNode }) {
  const { isListening, currentNote, error, isSimulation, start, stop } =
    useAudioAnalyzer();

  const [stringCount, setStringCount] = useState<StringCount>(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cents");
  const [strings, setStrings] = useState<StringData[]>([]);

  const offsetsRef = useRef<[number, number, number]>([0, 0, 0]);
  const currentNoteRef = useRef<NoteData | null>(null);

  useEffect(() => {
    currentNoteRef.current = currentNote;
  }, [currentNote]);

  useEffect(() => {
    if (!isListening) {
      setStrings([]);
      return;
    }

    offsetsRef.current[1] = (Math.random() - 0.5) * 12;
    offsetsRef.current[2] = (Math.random() - 0.5) * 12;

    const interval = setInterval(() => {
      const note = currentNoteRef.current;
      if (!note) return;

      for (let i = 1; i < 3; i++) {
        offsetsRef.current[i] =
          offsetsRef.current[i] * 0.992 + (Math.random() - 0.5) * 0.6;
      }

      const result: StringData[] = [];
      for (let i = 0; i < 3; i++) {
        const offset = offsetsRef.current[i];
        const sc = Math.max(-50, Math.min(50, note.cents + offset));
        const sf = note.frequency * Math.pow(2, offset / 1200);
        result.push({ id: i + 1, cents: sc, frequency: sf });
      }
      setStrings(result);
    }, 50);

    return () => clearInterval(interval);
  }, [isListening]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  const value: TunerContextValue = {
    isActive: isListening,
    toggle,
    currentNote,
    strings,
    stringCount,
    setStringCount,
    displayMode,
    setDisplayMode,
    isSimulation,
    error,
  };

  return (
    <TunerContext.Provider value={value}>{children}</TunerContext.Provider>
  );
}

export function useTuner() {
  const ctx = useContext(TunerContext);
  if (!ctx) throw new Error("useTuner must be used within TunerProvider");
  return ctx;
}
