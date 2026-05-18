import React, { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Svg,
  Text as SvgText,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";

interface Props {
  cents: number;
  isActive: boolean;
}

const START_ANGLE = 195;
const END_ANGLE = 345;
const SWEEP = END_ANGLE - START_ANGLE;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function arcPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = toRad(angleDeg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function centsToAngle(cents: number) {
  return START_ANGLE + ((cents + 50) / 100) * SWEEP;
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromCents: number,
  toCents: number
) {
  const a1 = centsToAngle(fromCents);
  const a2 = centsToAngle(toCents);
  const p1 = arcPoint(cx, cy, r, a1);
  const p2 = arcPoint(cx, cy, r, a2);
  const sweep = a2 - a1;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

function useSmoothCents(target: number, active: boolean) {
  const [smooth, setSmooth] = useState(0);
  const smoothRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    targetRef.current = active ? target : 0;
    activeRef.current = active;
  }, [target, active]);

  useEffect(() => {
    const animate = () => {
      const diff = targetRef.current - smoothRef.current;
      if (Math.abs(diff) > 0.05) {
        smoothRef.current += diff * 0.12;
        setSmooth(smoothRef.current);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return smooth;
}

export function TunerDial({ cents, isActive }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const smoothCents = useSmoothCents(cents, isActive);

  const padding = 24;
  const svgWidth = width - padding * 2;
  const svgHeight = svgWidth * 0.64;
  const cx = svgWidth / 2;
  const cy = svgHeight * 0.91;
  const r = svgWidth * 0.41;
  const strokeW = 18;

  const needleAngle = centsToAngle(smoothCents);
  const needleTip = arcPoint(cx, cy, r * 0.88, needleAngle);
  const needleBase = { x: cx, y: cy };

  const getColor = (c: number) => {
    if (!isActive) return colors.border;
    const abs = Math.abs(c);
    if (abs <= 3) return colors.inTune;
    if (abs <= 18) return colors.flat;
    return colors.sharp;
  };

  const needleColor = getColor(smoothCents);

  const TICKS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
  const MINOR_TICKS = [-45, -35, -25, -15, -5, 5, 15, 25, 35, 45];
  const LABELS = [
    { cents: -50, label: "−50" },
    { cents: -25, label: "−25" },
    { cents: 0, label: "0" },
    { cents: 25, label: "+25" },
    { cents: 50, label: "+50" },
  ];

  const startPt = arcPoint(cx, cy, r, START_ANGLE);
  const endPt = arcPoint(cx, cy, r, END_ANGLE);
  const fullArc = `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 1 ${endPt.x} ${endPt.y}`;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <RadialGradient id="pivotGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={needleColor} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={needleColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Zone arcs */}
        <Path
          d={arcPath(cx, cy, r, -50, -18)}
          stroke={colors.sharp}
          strokeWidth={strokeW}
          fill="none"
          opacity={0.18}
          strokeLinecap="round"
        />
        <Path
          d={arcPath(cx, cy, r, 18, 50)}
          stroke={colors.sharp}
          strokeWidth={strokeW}
          fill="none"
          opacity={0.18}
          strokeLinecap="round"
        />
        <Path
          d={arcPath(cx, cy, r, -18, -3)}
          stroke={colors.flat}
          strokeWidth={strokeW}
          fill="none"
          opacity={0.18}
          strokeLinecap="round"
        />
        <Path
          d={arcPath(cx, cy, r, 3, 18)}
          stroke={colors.flat}
          strokeWidth={strokeW}
          fill="none"
          opacity={0.18}
          strokeLinecap="round"
        />
        <Path
          d={arcPath(cx, cy, r, -3, 3)}
          stroke={colors.inTune}
          strokeWidth={strokeW}
          fill="none"
          opacity={0.22}
          strokeLinecap="round"
        />

        {/* Background arc (dark ring) */}
        <Path
          d={fullArc}
          stroke={colors.border}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />

        {/* Minor tick marks */}
        {MINOR_TICKS.map((tc) => {
          const a = centsToAngle(tc);
          const outer = arcPoint(cx, cy, r + 6, a);
          const inner = arcPoint(cx, cy, r - 6, a);
          return (
            <Line
              key={`m${tc}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={colors.border}
              strokeWidth={1}
              opacity={0.7}
            />
          );
        })}

        {/* Major tick marks */}
        {TICKS.map((tc) => {
          const a = centsToAngle(tc);
          const isCenter = tc === 0;
          const outer = arcPoint(cx, cy, r + 10, a);
          const inner = arcPoint(cx, cy, r - (isCenter ? 18 : 10), a);
          return (
            <Line
              key={`t${tc}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isCenter ? "#FFFFFF" : colors.mutedForeground}
              strokeWidth={isCenter ? 2.5 : 1.5}
              opacity={isCenter ? 0.9 : 0.5}
            />
          );
        })}

        {/* Labels */}
        {LABELS.map(({ cents: lc, label }) => {
          const a = centsToAngle(lc);
          const pt = arcPoint(cx, cy, r + 22, a);
          return (
            <SvgText
              key={`l${lc}`}
              x={pt.x}
              y={pt.y + 4}
              textAnchor="middle"
              fontSize={9}
              fill={colors.mutedForeground}
              opacity={0.7}
              fontFamily="Inter_400Regular"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Active needle highlight on arc */}
        {isActive && (
          <Path
            d={arcPath(
              cx,
              cy,
              r,
              smoothCents - 6,
              smoothCents + 6
            )}
            stroke={needleColor}
            strokeWidth={strokeW}
            fill="none"
            opacity={0.35}
            strokeLinecap="round"
          />
        )}

        {/* Needle glow */}
        {isActive && (
          <Line
            x1={needleBase.x}
            y1={needleBase.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={needleColor}
            strokeWidth={12}
            opacity={0.08}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <Line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={needleColor}
          strokeWidth={2}
          opacity={isActive ? 0.95 : 0.2}
          strokeLinecap="round"
        />

        {/* Pivot glow */}
        {isActive && (
          <Circle
            cx={cx}
            cy={cy}
            r={22}
            fill={needleColor}
            opacity={0.12}
          />
        )}

        {/* Pivot ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={10}
          fill={isActive ? needleColor : colors.border}
          opacity={isActive ? 1 : 0.4}
        />
        <Circle cx={cx} cy={cy} r={4} fill={colors.background} />
      </Svg>
    </View>
  );
}
