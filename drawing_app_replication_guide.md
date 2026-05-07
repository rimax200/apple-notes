# Freeform Drawing Page — Refactor Guide

## What we're building

A note page that works like Apple Notes: typed text and a drawing canvas coexist
in the same scrollable document. The user switches between typing and drawing via
a toolbar button. Everything persists automatically to device storage.

---

## File structure

```
app/freeform/
├── _layout.tsx               ← Stack navigator wrapper (headerTransparent)
├── index.tsx                 ← Grid of saved notes (the list screen)
└── [id].tsx                  ← The individual note/drawing page (main focus)

hooks/
└── useFreeformDrawings.ts    ← AsyncStorage persistence layer

assets/
└── images/dp.png             ← image used in the line weight menu
```

---

## How the data layer works (`useFreeformDrawings.ts`)

Every note is a JSON object stored in AsyncStorage under the key `freeform_drawings`.
The full list is one serialized array — load it on mount, write it back on every change.

### Current shape

```ts
interface Drawing {
  id: string        // "1715000000000" — Date.now() as string
  title: string     // "New Drawing"
  paths: string[]   // SVG path strings — the entire drawing serialized
  createdAt: number // unix timestamp ms
  updatedAt: number // unix timestamp ms
}
```

### What to add for the Apple Notes hybrid

```ts
interface Drawing {
  id: string
  title: string
  body: string      // ← ADD: the typed note content
  paths: string[]
  createdAt: number
  updatedAt: number
}
```

### Hook methods (already exist)

| Method | What it does |
|---|---|
| `createDrawing()` | Creates a new entry, returns its `id` |
| `updatePaths(id, paths)` | Saves the drawing strokes |
| `renameDrawing(id, title)` | Updates the title |
| `deleteDrawing(id)` | Removes the entry |
| `getDrawing(id)` | Returns a single `Drawing` by id |
| `formatDate(ts)` | Returns "Today", "Yesterday", "3 days ago" |

### What to add to the hook

```ts
// Add this method alongside updatePaths
const updateContent = useCallback(async (id: string, title: string, body: string) => {
  setDrawings((prev) => {
    const next = prev.map((d) =>
      d.id === id ? { ...d, title, body, updatedAt: Date.now() } : d
    );
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}, []);
```

Also update `createDrawing` to initialise the new field:

```ts
const drawing: Drawing = {
  id,
  title: "New Note",
  body: "",           // ← add this
  paths: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

---

## How `DrawPad` (expo-drawpad) works internally

### The drawing loop — step by step

```
User puts finger on screen
        │
        ▼
onStart  →  currentPath = "M x y"
              (moves pen to the first touch point)
        │
        ▼
onUpdate →  append "Q prevX prevY midX midY"
              (quadratic bezier to smooth the curve between points)
              runs on every frame the finger moves
        │
        ▼
onEnd    →  push currentPath into paths[] state
              clear currentPath back to ""
              stroke is now committed and permanent
```

Every stroke is one SVG path string. The full drawing is just an array of
those strings — that is what gets saved to AsyncStorage and restored on load.

### The replay animation — how it works

```
padRef.current.play() called
        │
        ▼
playing.value = true  (SharedValue triggers useAnimatedReaction)
        │
        ▼
progress: SharedValue<number>  animates from 0 → 1 via withTiming()
duration = pathLength.value * 2 ms  (longer drawings take longer to replay)
        │
        ▼
Each completed DrawPath knows:
  - its own length (via svg-path-properties)
  - its start position in the total path length
It uses strokeDashoffset to "draw itself" when progress reaches its turn
Strokes appear in the exact order they were drawn
        │
        ▼
After duration ms:  playing.value = false  (auto-reset)
```

### What the ref gives you (imperative API)

```ts
padRef.current?.erase()              // wipes every stroke — canvas is blank
padRef.current?.undo()               // removes only the last stroke
padRef.current?.play()               // starts the replay animation
padRef.current?.stop()               // cancels an in-progress replay
padRef.current?.getPaths()           // returns string[] of all strokes
padRef.current?.setPaths(paths)      // loads saved strokes (call on mount)
padRef.current?.getSVG()             // Promise<string> — full SVG markup
```

### All DrawPad props explained

```ts
<DrawPad
  ref={padRef}

  stroke="#000000"          // pen colour — any valid hex/rgb string
  strokeWidth={4}           // pen thickness in pixels, 1–10 is ideal

  brushType="solid"         // "solid" | "dotted" | "dashed" | "highlighter"
                            // highlighter sets strokeOpacity 0.3 automatically

  pathLength={pathLength}   // SharedValue<number> — updated internally by DrawPad
                            // you read it to know if anything is drawn (canUndo)

  playing={playing}         // SharedValue<boolean> — set true to start replay
                            // DrawPad sets it back to false when replay ends

  onDrawStart={() => {}}    // fires when the finger touches the canvas
  onDrawEnd={() => {}}      // fires when the finger lifts — good place to save

  animationDuration={3000}  // optional override for replay duration in ms
                            // default: pathLength.value * 2
/>
```

---

## The Apple Notes page — visual layout

```
┌──────────────────────────────────────┐
│  ←            [share]  [more ···]   │  ← transparent nav bar (native iOS)
├──────────────────────────────────────┤
│                                      │
│  Note Title                          │  ← large bold TextInput
│  12 May 2026  ·  10:34 AM  ·  4 words│  ← auto-generated metadata line
│                                      │
│  Body text goes here. The user       │  ← multiline TextInput
│  types their note content here.      │
│  It grows as they type.              │
│                                      │
│ ┌────────────────────────────────┐   │
│ │                                │   │  ← DrawPad (FIXED height, e.g. 300px)
│ │       [drawing area]           │   │    pointerEvents="none" in text mode
│ │                                │   │    pointerEvents="auto" in draw mode
│ └────────────────────────────────┘   │
│                                      │
│  More text below the drawing...      │  ← optional second TextInput
│                                      │
├──────────────────────────────────────┤
│  Aa   ✓   📷   ✏️   📎              │  ← bottom toolbar in TEXT mode
│  OR                                  │
│  brush  weight  colour  ──  Done ✓  │  ← bottom toolbar in DRAW mode
└──────────────────────────────────────┘
```

---

## State you need in `[id].tsx`

```ts
// Controls which toolbar shows and whether the canvas accepts touch
const [mode, setMode] = useState<"text" | "draw">("text");

// Note content — initialised from the saved Drawing object
const [title, setTitle] = useState(drawing?.title ?? "");
const [body, setBody] = useState(drawing?.body ?? "");

// Drawing tool settings
const [selectedBrush, setSelectedBrush] = useState<BrushType>("solid");
const [selectedWeight, setSelectedWeight] = useState("4");
const [strokeColor, setStrokeColor] = useState("#000000");

// Enables / disables the undo button
const [canUndo, setCanUndo] = useState(false);

// Reanimated shared values — must stay outside React render cycle
const pathLength = useSharedValue(0);   // updated internally by DrawPad
const playing = useSharedValue(false);  // set true to trigger replay

// Imperative handle to the canvas
const padRef = useRef<DrawPadHandle>(null);

// Handle to the ScrollView so we can toggle scrolling
const scrollRef = useRef<ScrollView>(null);
```

---

## The gesture conflict — and how to fix it

`DrawPad` wraps everything in a `GestureDetector` using a Pan gesture.
If that Pan gesture lives inside a `ScrollView`, both compete for the same touch —
the scroll gesture wins and drawing does not work at all.

### Fix 1 — fixed height on the canvas container (simplest)

Give the canvas wrapper a fixed pixel height. It has no need to scroll internally,
so there is no conflict. The `ScrollView` scrolls everything else normally.

```tsx
// ✅ Works — fixed height, no conflict
<View style={{ height: 300, width: "100%" }}>
  <DrawPad ref={padRef} ... />
</View>

// ❌ Breaks — flex: 1 inside ScrollView = infinite height = gesture conflict
<View style={{ flex: 1 }}>
  <DrawPad ref={padRef} ... />
</View>
```

### Fix 2 — disable scrolling while drawing (alternative)

Keep the layout flexible but toggle `scrollEnabled` on the `ScrollView` using
the `onDrawStart` and `onDrawEnd` callbacks from `DrawPad`:

```tsx
onDrawStart={() => scrollRef.current?.setNativeProps({ scrollEnabled: false })}
onDrawEnd={() => scrollRef.current?.setNativeProps({ scrollEnabled: true })}
```

Both fixes can be used together for the safest result.

---

## Auto-save — how to wire it up

Apple Notes saves silently while you type or draw. Debounce saves to avoid
hitting AsyncStorage on every single keystroke.

```ts
const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

const scheduleSave = (newTitle: string, newBody: string) => {
  if (saveTimeout.current) clearTimeout(saveTimeout.current);
  saveTimeout.current = setTimeout(() => {
    updateContent(id, newTitle, newBody);
  }, 800); // wait 800ms after user stops typing, then save
};

// Wire into TextInput:
<TextInput
  value={title}
  onChangeText={(t) => {
    setTitle(t);
    scheduleSave(t, body);
  }}
/>

// Wire into DrawPad — saves paths after every completed stroke:
<DrawPad
  onDrawEnd={() => {
    const paths = padRef.current?.getPaths() ?? [];
    updatePaths(id, paths);
  }}
/>
```

---

## Bottom toolbar — the two modes

### Text mode (default)

```tsx
<Stack.Toolbar placement="bottom">
  <Stack.Toolbar.Button icon="textformat" />       // future: text formatting
  <Stack.Toolbar.Button icon="checklist" />        // future: checklist
  <Stack.Toolbar.Button icon="camera" />           // future: insert photo
  <Stack.Toolbar.Button
    icon="pencil.tip"
    onPress={() => {
      Keyboard.dismiss();   // close keyboard before entering draw mode
      setMode("draw");
    }}
  />
  <Stack.Toolbar.Button icon="paperclip" />        // future: attach file
</Stack.Toolbar>
```

### Draw mode

```tsx
<Stack.Toolbar placement="bottom">
  <Stack.Toolbar.Menu icon="paintbrush.pointed" title="Choose Brush">
    <Stack.Toolbar.MenuAction
      icon="circle"
      isOn={selectedBrush === "solid"}
      onPress={() => setSelectedBrush("solid")}
    >Solid</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction
      icon="circle.dashed"
      isOn={selectedBrush === "dashed"}
      onPress={() => setSelectedBrush("dashed")}
    >Dashed</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction
      icon="circle.dotted"
      isOn={selectedBrush === "dotted"}
      onPress={() => setSelectedBrush("dotted")}
    >Dotted</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction
      icon="highlighter"
      isOn={selectedBrush === "highlighter"}
      onPress={() => setSelectedBrush("highlighter")}
    >Highlight</Stack.Toolbar.MenuAction>
  </Stack.Toolbar.Menu>

  <Stack.Toolbar.Menu icon="lineweight" title="Line Weight">
    <Stack.Toolbar.MenuAction
      isOn={selectedWeight === "2"}
      onPress={() => setSelectedWeight("2")}
    >Thin</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction
      isOn={selectedWeight === "4"}
      onPress={() => setSelectedWeight("4")}
    >Medium</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction
      isOn={selectedWeight === "6"}
      onPress={() => setSelectedWeight("6")}
    >Thick</Stack.Toolbar.MenuAction>
  </Stack.Toolbar.Menu>

  <Stack.Toolbar.Button icon="paintpalette" />    // future: colour picker

  <Stack.Toolbar.Spacer />

  <Stack.Toolbar.Button
    icon="checkmark"
    onPress={() => setMode("text")}               // exits draw mode
  />
</Stack.Toolbar>
```

---

## Full page skeleton (`[id].tsx`)

This is the complete structure with all the pieces wired together.

```tsx
import { View, ScrollView, TextInput, Text, Keyboard, StyleSheet } from "react-native";
import React, { useRef, useState, useEffect } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import DrawPad, { BrushType, DrawPadHandle } from "expo-drawpad";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Clipboard from "expo-clipboard";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFreeformDrawings } from "@/hooks/useFreeformDrawings";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDrawing, updatePaths, updateContent, createDrawing, formatDate } =
    useFreeformDrawings();
  const drawing = getDrawing(id);

  // ─── mode ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"text" | "draw">("text");

  // ─── note content ────────────────────────────────────────────────────────
  const [title, setTitle] = useState(drawing?.title ?? "");
  const [body, setBody] = useState(drawing?.body ?? "");

  // ─── drawing tools ───────────────────────────────────────────────────────
  const [selectedBrush, setSelectedBrush] = useState<BrushType>("solid");
  const [selectedWeight, setSelectedWeight] = useState("4");
  const [canUndo, setCanUndo] = useState(false);

  // ─── refs and shared values ──────────────────────────────────────────────
  const padRef = useRef<DrawPadHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pathLength = useSharedValue(0);
  const playing = useSharedValue(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── load saved paths on mount ───────────────────────────────────────────
  useEffect(() => {
    if (drawing?.paths?.length && padRef.current?.setPaths) {
      padRef.current.setPaths(drawing.paths);
    }
  }, []);

  // ─── track undo availability ─────────────────────────────────────────────
  useAnimatedReaction(
    () => pathLength.value,
    (current) => scheduleOnRN(setCanUndo, current > 0)
  );

  // ─── auto-save text ──────────────────────────────────────────────────────
  const scheduleSave = (newTitle: string, newBody: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateContent(id, newTitle, newBody);
    }, 800);
  };

  // ─── actions ─────────────────────────────────────────────────────────────
  const handleUndo = () => padRef.current?.undo();

  const handleUndoAll = () => {
    padRef.current?.erase();
    updatePaths(id, []);
  };

  const handlePlay = () => {
    playing.value = true;
    padRef.current?.play();
  };

  const handleNew = async () => {
    updatePaths(id, padRef.current?.getPaths() ?? []);
    const newId = await createDrawing();
    router.replace(`/freeform/${newId}`);
  };

  const copySVGToClipboard = async () => {
    const svg = await padRef.current?.getSVG?.();
    if (svg) {
      await Clipboard.setStringAsync(svg);
      Alert.alert("Copied", "SVG copied to clipboard.");
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* nav bar */}
      <Stack.Screen.BackButton displayMode="minimal" />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="arrow.uturn.backward"
          disabled={!canUndo}
          onPress={handleUndo}
        />
        <Stack.Toolbar.Button icon="square.and.arrow.up" />
        <Stack.Toolbar.Menu icon="ellipsis">
          <Stack.Toolbar.MenuAction icon="arrow.uturn.backward" onPress={handleUndoAll}>
            Undo All
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="pencil.and.scribble"
            disabled={!canUndo}
            onPress={handlePlay}
          >
            Play Drawing
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="doc.on.doc" onPress={copySVGToClipboard}>
            Copy SVG
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {/* document */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
        >
          {/* title */}
          <TextInput
            value={title}
            onChangeText={(t) => { setTitle(t); scheduleSave(t, body); }}
            placeholder="Title"
            placeholderTextColor="#aaa"
            style={styles.title}
            returnKeyType="next"
          />

          {/* metadata */}
          <Text style={styles.meta}>
            {formatDate(drawing?.updatedAt ?? Date.now())}
            {"  ·  "}
            {body.split(" ").filter(Boolean).length} words
          </Text>

          {/* body text */}
          <TextInput
            value={body}
            onChangeText={(t) => { setBody(t); scheduleSave(title, t); }}
            placeholder="Note"
            placeholderTextColor="#aaa"
            multiline
            style={styles.body}
            textAlignVertical="top"
          />

          {/* drawing canvas */}
          <View
            style={styles.canvas}
            pointerEvents={mode === "draw" ? "auto" : "none"}
          >
            <DrawPad
              ref={padRef}
              brushType={selectedBrush}
              strokeWidth={parseInt(selectedWeight)}
              stroke="#000000"
              pathLength={pathLength}
              playing={playing}
              onDrawStart={() =>
                scrollRef.current?.setNativeProps({ scrollEnabled: false })
              }
              onDrawEnd={() => {
                scrollRef.current?.setNativeProps({ scrollEnabled: true });
                updatePaths(id, padRef.current?.getPaths() ?? []);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* bottom toolbar — swaps on mode */}
      {mode === "text" ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button icon="textformat" />
          <Stack.Toolbar.Button icon="checklist" />
          <Stack.Toolbar.Button icon="camera" />
          <Stack.Toolbar.Button
            icon="pencil.tip"
            onPress={() => { Keyboard.dismiss(); setMode("draw"); }}
          />
          <Stack.Toolbar.Button icon="paperclip" />
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Menu icon="paintbrush.pointed" title="Choose Brush">
            {/* brush type menu actions */}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu icon="lineweight" title="Line Weight">
            {/* weight menu actions */}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Button icon="paintpalette" />
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button icon="checkmark" onPress={() => setMode("text")} />
        </Stack.Toolbar>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    color: "#000",
  },
  meta: {
    fontSize: 12,
    color: "#888",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    minHeight: 200,
    color: "#000",
  },
  canvas: {
    height: 300,           // fixed height avoids ScrollView gesture conflict
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#00000015",
    overflow: "hidden",
  },
});
```

---

## Index screen card — showing body preview

Once `body` is in the data model, update the card in `freeform/index.tsx`
to show a text snippet below the title, exactly like Apple Notes list view:

```tsx
<ThemedView style={styles.content} colorName="safariBg">
  <ThemedText style={styles.title} type="semiBold" numberOfLines={1}>
    {item.title}
  </ThemedText>
  {/* ↓ ADD THIS */}
  <ThemedText style={styles.bodyPreview} numberOfLines={1}>
    {item.body?.trim() || "No additional text"}
  </ThemedText>
  <ThemedText style={styles.subtitle}>
    {formatDate(item.updatedAt)}
  </ThemedText>
</ThemedView>
```

Add the style:

```ts
bodyPreview: {
  fontSize: 12,
  opacity: 0.6,
}
```

And make the card taller to fit the extra line (e.g. `height: 190`).

---

## Important gotchas

### Canvas must always stay mounted
Do NOT conditionally render `<DrawPad>`. Unmounting it wipes the in-memory
paths array. Use `pointerEvents` to block input instead — the canvas stays
in the tree and the paths survive.

### `setPaths` must run after mount
The ref is null during render. Call `padRef.current.setPaths(...)` inside
`useEffect` with an empty dependency array so it runs once after the component
has fully mounted.

### Keyboard before draw mode
Always call `Keyboard.dismiss()` before `setMode("draw")`. If the keyboard
is open and the canvas appears, the keyboard may overlap the canvas or cause
layout jumps.

### Colour picker
`DrawPad` accepts any hex string as `stroke`. A minimal implementation is a
horizontal row of colour swatches that set `strokeColor` state. Pass
`stroke={strokeColor}` to the `DrawPad` prop. The stroke colour is per-session —
existing paths keep their original colours since they are already committed
SVG strings.

---

## Refactor checklist

- [ ] Add `body: string` to `Drawing` interface in `useFreeformDrawings.ts`
- [ ] Update `createDrawing()` to initialise `body: ""`
- [ ] Add `updateContent(id, title, body)` method to the hook
- [ ] Rewrite `[id].tsx` with `ScrollView` + `TextInput` fields + `DrawPad`
- [ ] Add `mode` state (`"text"` | `"draw"`) and swap bottom toolbar
- [ ] Wire `pointerEvents` on the canvas wrapper to `mode`
- [ ] Dismiss keyboard before entering draw mode
- [ ] Wire `onDrawEnd` to auto-save paths via `updatePaths`
- [ ] Wire `onChangeText` on both inputs to debounced `updateContent`
- [ ] Load paths on mount via `setPaths` inside `useEffect`
- [ ] Update `freeform/index.tsx` card to show `body` preview text
- [ ] Increase card height in `index.tsx` to fit the extra body line
