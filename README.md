# Piano Tuner Pro – Multi-String

A real-time piano tuning app for iOS, built with React Native and Expo. It uses live microphone input and autocorrelation-based pitch detection to help you tune a piano string by string, including multi-string unison tuning where two or three strings share a single note.

## Features

- **Live pitch detection** – Captures microphone audio in real time and reports the detected note and how many cents sharp or flat it is.
- **Multi-string unison mode** – Tune 1, 2, or 3 strings per note, with a per-string readout for matching unisons.
- **Arc dial display** – A needle gauge from −50 to +50 cents with a centered "in tune" zone.
- **Cents / Hz toggle** – Switch the readout between cents deviation and raw frequency.
- **Dark UI** – Background `#0B0B10` with teal (`#00D4AA`) and gold (`#C5A86A`) accents.
- **Simulation fallback** – If microphone permission is denied or unavailable, the app falls back to a synthetic signal so the UI still functions.

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Expo SDK 54, React Native 0.81 |
| Language | TypeScript 5.9 |
| Routing | expo-router 6 |
| Audio capture | `@siteed/expo-audio-studio` (live PCM streaming via the `useAudioRecorder` hook) |
| Animation | react-native-reanimated 4 |
| Graphics | react-native-svg |
| Builds | EAS Build / EAS Submit |

## Project layout

This repository is a pnpm monorepo. The iOS app lives under `artifacts/mobile`.

```
artifacts/mobile/
├── app/                  # expo-router screens
│   └── (tabs)/index.tsx  # main tuner screen
├── components/
│   ├── TunerDial.tsx     # arc dial / needle gauge
│   ├── StringPanel.tsx   # per-string unison rows
│   └── ErrorBoundary.tsx
├── context/
│   └── TunerContext.tsx  # shared tuner state
├── hooks/
│   ├── useAudioAnalyzer.ts  # mic capture + autocorrelation pitch detection
│   └── useColors.ts
├── app.json              # Expo config (bundle id, plugins, permissions)
└── eas.json              # EAS build/submit profiles
```

## How pitch detection works

`useAudioAnalyzer.ts` is the core of the app. On a device it:

1. Requests microphone permission through the native audio module.
2. Starts recording via the `useAudioRecorder` hook, which subscribes to the native audio event stream and delivers PCM chunks to an `onAudioStream` callback.
3. Accumulates samples into a fixed-size buffer (4096 samples at 44.1 kHz).
4. Runs autocorrelation on each full buffer to estimate the fundamental frequency.
5. Smooths the result with a short median filter and converts it to the nearest note and cents offset.

Incoming audio data is normalized to a `Float32Array` regardless of whether the platform delivers it as a float array or base64-encoded PCM16. On the web target, the equivalent path uses the Web Audio API instead.

## Getting started

### Prerequisites

- Node.js 18+
- pnpm
- An Apple Developer account (for device builds and App Store submission)

### Install

From the repository root:

```bash
pnpm install
```

### Run in development

The microphone library includes native code, so it cannot run in Expo Go. You need a development build.

```bash
cd artifacts/mobile

# Build and install a dev client (first time, or after native changes)
npx eas-cli build --platform ios --profile development

# Start the bundler in dev-client mode
npx expo start --dev-client
```

Open the installed development build (not Expo Go) and connect it to the bundler.

### Run on the iOS simulator

```bash
cd artifacts/mobile
npx expo run:ios --device "iPhone 17 Pro Max"
```

## Building and submitting

```bash
cd artifacts/mobile

# Production build for the App Store
npx eas-cli build --platform ios --profile production

# Upload to App Store Connect
npx eas-cli submit --platform ios --profile production
```

Build profiles are defined in `eas.json`. The `production` profile auto-increments the build number.

## Permissions

The app requests microphone access. The usage description is configured through the audio plugin in `app.json`:

> Piano Tuner uses the microphone to detect the pitch of your piano strings in real time.

Audio is processed on-device for pitch detection and is not recorded or transmitted.

## License

This project is private and unpublished. All rights reserved.
