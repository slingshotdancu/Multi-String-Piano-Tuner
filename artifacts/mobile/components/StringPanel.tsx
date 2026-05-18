import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { StringData, DisplayMode } from "@/context/TunerContext";
import { useColors } from "@/hooks/useColors";

interface StringBarProps {
  data: StringData;
  isActive: boolean;
  displayMode: DisplayMode;
}

function StringBar({ data, isActive, displayMode }: StringBarProps) {
  const colors = useColors();

  const getColor = (cents: number) => {
    if (!isActive) return colors.border;
    const abs = Math.abs(cents);
    if (abs <= 3) return colors.inTune;
    if (abs <= 18) return colors.flat;
    return colors.sharp;
  };

  const barColor = getColor(data.cents);
  const clampedCents = Math.max(-50, Math.min(50, data.cents));
  const fillPct = Math.abs(clampedCents) / 50;
  const isFlat = clampedCents < 0;

  const displayValue = () => {
    if (!isActive) return "—";
    if (displayMode === "cents") {
      const sign = data.cents >= 0 ? "+" : "";
      return `${sign}${data.cents.toFixed(1)}¢`;
    }
    const diff = data.frequency - 440 * Math.pow(2, (Math.round(69 + 12 * Math.log2(data.frequency / 440)) - 69) / 12);
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(2)} Hz`;
  };

  return (
    <View style={styles.stringRow}>
      <Text style={[styles.stringLabel, { color: colors.mutedForeground }]}>
        {data.id}
      </Text>

      <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
        {/* Center line */}
        <View
          style={[
            styles.centerLine,
            { backgroundColor: isActive ? colors.mutedForeground : colors.border },
          ]}
        />
        {/* Fill bar */}
        {isActive && (
          <View
            style={[
              styles.fillBar,
              {
                backgroundColor: barColor,
                width: `${fillPct * 50}%`,
                [isFlat ? "right" : "left"]: "50%",
              },
            ]}
          />
        )}
        {/* Indicator dot */}
        <View
          style={[
            styles.indicatorDot,
            {
              left: `${50 + clampedCents}%`,
              backgroundColor: isActive ? barColor : colors.border,
              shadowColor: isActive ? barColor : "transparent",
            },
          ]}
        />
      </View>

      <Text
        style={[
          styles.valueText,
          { color: isActive ? barColor : colors.mutedForeground },
        ]}
      >
        {displayValue()}
      </Text>
    </View>
  );
}

interface Props {
  strings: StringData[];
  stringCount: number;
  isActive: boolean;
  displayMode: DisplayMode;
}

export function StringPanel({ strings, stringCount, isActive, displayMode }: Props) {
  const colors = useColors();
  const visible = strings.slice(0, stringCount);

  const label = stringCount === 1 ? "SINGLE STRING" : `${stringCount}-STRING UNISON`;

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {visible.map((s, idx) => (
        <StringBar
          key={s.id}
          data={s}
          isActive={isActive}
          displayMode={displayMode}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 4,
  },
  stringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stringLabel: {
    width: 16,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
  },
  centerLine: {
    position: "absolute",
    left: "50%",
    width: 1.5,
    top: 4,
    bottom: 4,
    zIndex: 2,
  },
  fillBar: {
    position: "absolute",
    top: 6,
    bottom: 6,
    opacity: 0.3,
    borderRadius: 3,
  },
  indicatorDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: 9,
    zIndex: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  valueText: {
    width: 72,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
});
