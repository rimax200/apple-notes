<div align="center">

<img src="./assets/images/icon.png" alt="Notes App Icon" width="120" />

# Notes

A beautiful, minimal notes app for iOS — built with Expo and React Native.  
Write freely. Draw. Attach images. Export as PDF.

[![Made with Expo](https://img.shields.io/badge/Made%20with-Expo-000020?style=flat&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=flat&logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/Platform-iOS-000000?style=flat&logo=apple)](https://www.apple.com/ios)

</div>

---

## Features

- **Rich Notes** — Write titled notes with a clean, distraction-free editor
- **Freeform Drawing** — Sketch directly on any note with solid, dashed, or dotted brushes at multiple weights
- **Image Attachments** — Pick images from your library and embed them inline in a note
- **PDF Export** — Share any note as a beautifully formatted PDF with text and drawing included
- **Search** — Filter notes instantly by title or body content
- **Context Menus** — Long-press any note to rename, duplicate, share, or delete
- **Persistent Storage** — All notes are saved locally on-device; no account required
- **Dark Mode** — Full light/dark theme support that follows system preference
- **Smooth Animations** — Powered by Reanimated 4 and native iOS transitions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 55 |
| Navigation | [Expo Router](https://expo.github.io/router) v4 — file-based Stack |
| UI | React Native 0.83 + Expo Symbols |
| Drawing | [expo-drawpad](https://www.npmjs.com/package/expo-drawpad) |
| Animations | [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) 4 |
| Gestures | [React Native Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/) |
| Storage | [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) |
| PDF | [expo-print](https://docs.expo.dev/versions/latest/sdk/print/) + [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) |
| Images | [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) + [expo-image](https://docs.expo.dev/versions/latest/sdk/image/) |
| Keyboard | [react-native-keyboard-controller](https://kirillzyusko.github.io/react-native-keyboard-controller/) |
| Fonts | Inter (Regular · Medium · SemiBold · Bold) + Lora Medium Italic |

---

## Project Structure

```
apple-notes/
├── app/
│   ├── index.tsx               # Welcome / landing screen
│   └── freeform/
│       ├── _layout.tsx         # Stack layout for the notes section
│       ├── index.tsx           # Notes grid with search
│       └── [id].tsx            # Individual note editor + drawing canvas
│
├── components/
│   ├── ThemedText.tsx          # Theme-aware text component
│   ├── ThemedView.tsx          # Theme-aware view wrapper
│   ├── notify/                 # In-app notification system
│   └── ui/                     # Shared primitives (Button, etc.)
│
├── hooks/
│   ├── useFreeformDrawings.ts  # Core notes state + persistence logic
│   ├── useThemeColor.ts        # Design token resolver
│   └── useColorScheme.ts       # System color scheme detection
│
├── constants/
│   ├── Colors.ts               # Design tokens
│   └── Theme.ts                # Navigation themes (light / dark)
│
└── assets/
    ├── fonts/                  # Inter + Lora font files
    ├── images/                 # App icon, splash screens
    └── icon/                   # Lottie animation files
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Xcode](https://developer.apple.com/xcode/) with an iOS Simulator configured
- [CocoaPods](https://cocoapods.org/) (`sudo gem install cocoapods`)

> **Note:** Expo Go is **not** supported. A native build is required.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/rimax200/apple-notes.git
cd apple-notes

# 2. Install JS dependencies
npm install

# 3. Build and launch on iOS Simulator
npx expo run:ios
```

That's it — `expo run:ios` handles CocoaPods and the native build automatically.

---

## How It Works

### Notes & Persistence

All notes are managed by the `useFreeformDrawings` hook. Each note is stored as a `Drawing` object and persisted to AsyncStorage:

```ts
interface Drawing {
  id: string;        // timestamp-based unique ID
  title: string;     // note title
  body: string;      // plain text body
  paths: string[];   // serialised SVG drawing paths
  images: string[];  // local image URIs
  createdAt: number;
  updatedAt: number;
}
```

Notes load from AsyncStorage on mount and write back on every change with an 800ms debounce on text edits to avoid excessive I/O.

### Drawing Canvas

The drawing canvas is powered by `expo-drawpad` and sits beneath the text editor. It activates when the user taps the pencil button in the toolbar. Supported brush styles:

| Brush | Description |
|---|---|
| Solid | Smooth, continuous stroke |
| Dashed | Evenly spaced dashes |
| Dotted | Evenly spaced dots |

Line weight ranges from **Thin (2px)** to **Thick (6px)**, with additional variable weights (1, 5, 7, 8). Drawing paths are saved automatically after each stroke.

### PDF Export

Tapping the share button:
1. Serialises the note's title, body text, and SVG drawing into an HTML template
2. Renders it to a PDF via `expo-print`
3. Renames the file to match the note title
4. Opens the native iOS share sheet via `expo-sharing`

---

## Rebuilding Native Projects

If you ever need to regenerate the native `ios/` and `android/` folders (e.g. after changing `app.json` or adding native plugins):

```bash
npx expo prebuild --clean
npx expo run:ios
```

---

## License

MIT
