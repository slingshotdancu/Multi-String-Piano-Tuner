import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Head } from "expo-router/head";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TunerDial } from "@/components/TunerDial";
import { StringPanel } from "@/components/StringPanel";
import { useTuner, StringCount } from "@/context/TunerContext";
import { useColors } from "@/hooks/useColors";

function PowerButton() {
  const colors = useColors();
  const { isActive, toggle } = useTuner();
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.18,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulse, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive, pulse]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggle();
  };

  const buttonColor = isActive ? colors.inTune : colors.secondary;
  const iconColor = isActive ? colors.background : colors.mutedForeground;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View
          style={[
            styles.powerButton,
            {
              backgroundColor: buttonColor,
              shadowColor: isActive ? colors.inTune : "transparent",
            },
          ]}
        >
          <PowerIcon color={iconColor} size={28} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function PowerIcon({ color, size }: { color: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: size * 0.28,
          borderWidth: 2.5,
          borderColor: color,
          borderTopColor: "transparent",
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          width: 2.5,
          height: size * 0.38,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

function StringCountSelector() {
  const colors = useColors();
  const { stringCount, setStringCount } = useTuner();
  const options: StringCount[] = [1, 2, 3];

  return (
    <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
      {options.map((n) => {
        const active = stringCount === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => {
              Haptics.selectionAsync();
              setStringCount(n);
            }}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: active ? colors.accent : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: active ? colors.background : colors.mutedForeground,
                  fontFamily: active
                    ? "Inter_600SemiBold"
                    : "Inter_400Regular",
                },
              ]}
            >
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DisplayModeToggle() {
  const colors = useColors();
  const { displayMode, setDisplayMode } = useTuner();
  const isCents = displayMode === "cents";

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        setDisplayMode(isCents ? "hz" : "cents");
      }}
      style={[
        styles.modeToggle,
        { backgroundColor: colors.secondary },
      ]}
    >
      <Text
        style={[
          styles.modeText,
          { color: isCents ? colors.foreground : colors.mutedForeground },
        ]}
      >
        ¢
      </Text>
      <Text style={[styles.modeSep, { color: colors.border }]}>|</Text>
      <Text
        style={[
          styles.modeText,
          { color: !isCents ? colors.foreground : colors.mutedForeground },
        ]}
      >
        Hz
      </Text>
    </TouchableOpacity>
  );
}

function NoteDisplay() {
  const colors = useColors();
  const { currentNote, isActive, displayMode } = useTuner();

  const note = currentNote?.note ?? "—";
  const octave = currentNote?.octave ?? "";
  const frequency = currentNote?.frequency;
  const cents = currentNote?.cents ?? 0;

  const getDeviationColor = (c: number) => {
    if (!isActive || !currentNote) return colors.mutedForeground;
    const abs = Math.abs(c);
    if (abs <= 3) return colors.inTune;
    if (abs <= 18) return colors.flat;
    return colors.sharp;
  };

  const deviationColor = getDeviationColor(cents);

  const deviationText = () => {
    if (!isActive || !currentNote) return "—";
    if (displayMode === "cents") {
      const sign = cents >= 0 ? "+" : "";
      return `${sign}${cents.toFixed(1)} ¢`;
    }
    if (!frequency) return "—";
    const nearestMidi = Math.round(
      69 + 12 * Math.log2(frequency / 440)
    );
    const targetFreq = 440 * Math.pow(2, (nearestMidi - 69) / 12);
    const diff = frequency - targetFreq;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(2)} Hz`;
  };

  return (
    <View style={styles.noteSection}>
      <View style={styles.noteRow}>
        <Text style={[styles.noteName, { color: colors.foreground }]}>
          {note}
        </Text>
        {currentNote && (
          <Text
            style={[
              styles.noteOctave,
              { color: colors.mutedForeground },
            ]}
          >
            {octave}
          </Text>
        )}
      </View>
      {frequency && isActive ? (
        <Text style={[styles.freqText, { color: colors.mutedForeground }]}>
          {frequency.toFixed(1)} Hz
        </Text>
      ) : (
        <Text style={[styles.freqText, { color: colors.border }]}>
          {isActive ? "listening..." : "tap ⏻ to start"}
        </Text>
      )}
      <Text
        style={[
          styles.deviationText,
          { color: deviationColor },
        ]}
      >
        {deviationText()}
      </Text>
    </View>
  );
}

export default function TunerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentNote, isActive, strings, stringCount, displayMode, isSimulation, error } =
    useTuner();

  const topPad =
    Platform.OS === "web"
      ? Math.max(insets.top, 67)
      : insets.top;
  const bottomPad =
    Platform.OS === "web"
      ? Math.max(insets.bottom, 34)
      : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Head>
        <title>Piano Tuner</title>
        <meta
          name="description"
          content="Professional real-time piano tuner. Detects pitch with precision, shows deviation in cents or Hz, and supports single-string bass, two-string mid, and three-string treble unison tuning."
        />
        <meta name="theme-color" content="#0B0B10" />
      </Head>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={[colors.card, colors.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 8 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: colors.mutedForeground }]}>
            PIANO TUNER
          </Text>
          {isSimulation && (
            <View
              style={[
                styles.simBadge,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.simText, { color: colors.mutedForeground }]}
              >
                DEMO
              </Text>
            </View>
          )}
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.flat }]}>
            {error}
          </Text>
        ) : null}

        {/* Note display */}
        <NoteDisplay />

        {/* Main tuner dial */}
        <TunerDial
          cents={currentNote?.cents ?? 0}
          isActive={isActive}
        />

        {/* String panel */}
        <View style={styles.stringSection}>
          <StringPanel
            strings={strings.length > 0 ? strings : [
              { id: 1, cents: 0, frequency: 0 },
              { id: 2, cents: 0, frequency: 0 },
              { id: 3, cents: 0, frequency: 0 },
            ]}
            stringCount={stringCount}
            isActive={isActive}
            displayMode={displayMode}
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <StringCountSelector />
          <PowerButton />
          <DisplayModeToggle />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 4,
  },
  simBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  simText: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
  },
  errorText: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "Inter_400Regular",
  },
  noteSection: {
    alignItems: "center",
    marginBottom: 4,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteName: {
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    lineHeight: 72,
  },
  noteOctave: {
    fontSize: 28,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    marginLeft: 4,
  },
  freqText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
    letterSpacing: 0.5,
  },
  deviationText: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  stringSection: {
    marginTop: 4,
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  powerButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 14,
  },
  modeToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  modeText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  modeSep: {
    fontSize: 12,
  },
});
