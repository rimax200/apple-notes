import {
  View,
  Alert,
  Image,
  StyleSheet,
  TextInput,
  ScrollView,
  Keyboard,
  InputAccessoryView,
  TouchableOpacity,
} from "react-native";
import React, { useRef, useState, useEffect } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import DrawPad, { BrushType, DrawPadHandle } from "expo-drawpad";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useFreeformDrawings } from "@/hooks/useFreeformDrawings";

const BRUSH_TYPES = [
  { id: "solid", icon: "circle", label: "Solid" },
  { id: "dashed", icon: "circle.dashed", label: "Dashed" },
  { id: "dotted", icon: "circle.dotted", label: "Dotted" },
] as const;

const LINE_WEIGHTS = [
  { id: "thin", label: "Thin" },
  { id: "medium", label: "Medium" },
  { id: "thick", label: "Thick" },
] as const;

const LINE_WEIGHTS_MAP = {
  thin: "2",
  medium: "4",
  thick: "6",
} as const;

const VARIABLE_WEIGHTS = ["1", "5", "7", "8"];

const TOOLBAR_ACCESSORY_ID = "freeform-toolbar";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDrawing, updatePaths, updateContent, updateImages } =
    useFreeformDrawings();
  const drawing = getDrawing(id);

  const [selectedBrush, setSelectedBrush] = useState<BrushType>("solid");
  const [selectedWeight, setSelectedWeight] = useState<string>("4");
  const [canUndo, setCanUndo] = useState(false);
  const [mode, setMode] = useState<"text" | "draw">("text");
  const [title, setTitle] = useState(drawing?.title ?? "");
  const [body, setBody] = useState(drawing?.body ?? "");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [images, setImages] = useState<string[]>(drawing?.images ?? []);

  const padRef = useRef<DrawPadHandle>(null);
  const pathLength = useSharedValue(0);
  const playing = useSharedValue(false);
  const scrollRef = useRef<ScrollView>(null);
  const bodyRef = useRef<TextInput>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(drawing?.title ?? "New Note");

  useEffect(() => {
    if (drawing?.paths?.length && padRef.current?.setPaths) {
      padRef.current.setPaths(drawing.paths);
    }
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (drawing?.body !== undefined) setBody(drawing.body);
    if (drawing?.title !== undefined) {
      setTitle(drawing.title);
      titleRef.current = drawing.title;
    }
    if (drawing?.images !== undefined) setImages(drawing.images);
  }, [drawing?.id]);

  const bodyRef2 = useRef(body);
  useEffect(() => { bodyRef2.current = body; }, [body]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        updateContent(id, titleRef.current, bodyRef2.current);
      }
    };
  }, []);

  useAnimatedReaction(
    () => pathLength.value,
    (current) => {
      scheduleOnRN(setCanUndo, current > 0);
    }
  );

  const scheduleSave = (newTitle: string, newBody: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateContent(id, newTitle, newBody);
    }, 800);
  };

  const enterDrawMode = () => {
    Keyboard.dismiss();
    setMode("draw");
    scrollRef.current?.setNativeProps({ scrollEnabled: false });
  };

  const enterTextMode = () => {
    setMode("text");
    scrollRef.current?.setNativeProps({ scrollEnabled: true });
  };

  const handleUndo = () => padRef.current?.undo();

  const handleUndoAll = () => {
    padRef.current?.erase();
    if (id) updatePaths(id, []);
  };

  const handlePlay = () => {
    playing.value = true;
    padRef.current?.play();
  };

  const handleSave = async () => {
    const paths = padRef.current?.getPaths?.() ?? [];
    if (id) await updatePaths(id, paths);
  };

  const handleShare = async () => {
    try {
      await handleSave();
      const svg = await padRef.current?.getSVG?.();
      const svgSection = svg
        ? `<div style="margin-top:24px"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" style="max-width:100%;border-radius:8px" /></div>`
        : "";
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, sans-serif; padding: 32px; color: #454545; }
              h1 { font-size: 28px; font-weight: 600; margin-bottom: 12px; }
              p { font-size: 16px; line-height: 1.6; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>${title || "Untitled"}</h1>
            <p>${body}</p>
            ${svgSection}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      const safeTitle = (title || "Untitled").replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Untitled";
      const namedFile = new File(Paths.cache, `${safeTitle}.pdf`);
      const sourceFile = new File(uri);
      sourceFile.copy(namedFile);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(namedFile.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("Sharing not available", "Your device does not support sharing.");
      }
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? String(e));
    }
  };

  const copySVGToClipboard = async () => {
    const svg = await padRef.current?.getSVG?.();
    if (svg) {
      await Clipboard.setStringAsync(svg);
      Alert.alert("Copied", "SVG copied to clipboard.");
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow access to your photo library to attach images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const next = [...images, uri];
        setImages(next);
        if (id) updateImages(id, next);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? String(e));
    }
  };

  const handleRemoveImage = (uri: string) => {
    const next = images.filter((u) => u !== uri);
    setImages(next);
    if (id) updateImages(id, next);
  };

  return (
    <>
      <Stack.Screen.BackButton displayMode="minimal" />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="arrow.uturn.backward"
          disabled={!canUndo}
          onPress={handleUndo}
        />
        <Stack.Toolbar.Button icon="square.and.arrow.up" onPress={handleShare} />
        <Stack.Toolbar.Menu icon="ellipsis">
          <Stack.Toolbar.MenuAction
            icon="arrow.uturn.backward"
            onPress={handleUndoAll}
          >
            Undo All
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="pencil.and.scribble"
            onPress={handlePlay}
            disabled={!canUndo}
          >
            Play Drawing
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="doc.on.doc"
            onPress={copySVGToClipboard}
          >
            Copy SVG
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {mode === "text" ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button icon="textformat" hidden={keyboardVisible} />
          <Stack.Toolbar.Button icon="checklist" hidden={keyboardVisible} />
          <Stack.Toolbar.Button icon="camera" hidden={keyboardVisible} />
          <Stack.Toolbar.Button icon="paperclip" onPress={handlePickImage} hidden={keyboardVisible} />
          <Stack.Toolbar.Button icon="pencil.tip" onPress={enterDrawMode} hidden={keyboardVisible} />
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button icon="paintpalette" hidden={keyboardVisible} />
          <Stack.Toolbar.Menu icon="paintbrush.pointed" title="Choose Brush" hidden={keyboardVisible}>
            {BRUSH_TYPES.map((brush) => (
              <Stack.Toolbar.MenuAction
                key={brush.id}
                icon={brush.icon}
                isOn={selectedBrush === brush.id}
                onPress={() => setSelectedBrush(brush.id)}
              >
                {brush.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu
            icon="lineweight"
            title="Select Line Weight"
            hidden={keyboardVisible}
          >
            {LINE_WEIGHTS.map((weight) => (
              <Stack.Toolbar.MenuAction
                key={weight.id}
                isOn={selectedWeight === LINE_WEIGHTS_MAP[weight.id]}
                onPress={() => setSelectedWeight(LINE_WEIGHTS_MAP[weight.id])}
              >
                {weight.label}
              </Stack.Toolbar.MenuAction>
            ))}
            <Stack.Toolbar.Menu title="Variable Weight">
              {VARIABLE_WEIGHTS.map((weight) => (
                <Stack.Toolbar.MenuAction
                  key={weight}
                  isOn={selectedWeight === weight}
                  onPress={() => setSelectedWeight(weight)}
                >
                  {weight}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button icon="checkmark" onPress={enterTextMode} hidden={keyboardVisible} />
        </Stack.Toolbar>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        <TextInput
          style={styles.title}
          value={title}
          editable={mode === "text"}
          returnKeyType="next"
          inputAccessoryViewID={TOOLBAR_ACCESSORY_ID}
          onSubmitEditing={() => bodyRef.current?.focus()}
          onChangeText={(text) => {
            setTitle(text);
            titleRef.current = text;
            scheduleSave(text, body);
          }}
        />
        <TextInput
          ref={bodyRef}
          style={styles.body}
          value={body}
          onChangeText={(text) => {
            setBody(text);
            scheduleSave(titleRef.current, text);
          }}
          editable={mode === "text"}
          multiline
          inputAccessoryViewID={TOOLBAR_ACCESSORY_ID}
          placeholder="Start writing..."
          textAlignVertical="top"
        />
        {images.length > 0 && (
          <View style={styles.imageGrid}>
            {images.map((uri) => (
              <TouchableOpacity key={uri} onLongPress={() => {
                Alert.alert("Remove image", "Remove this image from the note?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => handleRemoveImage(uri) },
                ]);
              }}>
                <Image source={{ uri }} style={styles.imageThumb} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View
          pointerEvents={mode === "draw" ? "auto" : "none"}
          style={[styles.canvas, mode === "draw" && styles.canvasActive]}
        >
          <DrawPad
            ref={padRef}
            brushType={selectedBrush}
            strokeWidth={parseInt(selectedWeight)}
            pathLength={pathLength}
            playing={playing}
            stroke="#000000"
            onDrawEnd={() => {
              const paths = padRef.current?.getPaths?.() ?? [];
              if (id) updatePaths(id, paths);
              if (mode !== "draw") {
                scrollRef.current?.setNativeProps({ scrollEnabled: true });
              }
            }}
          />
        </View>
      </ScrollView>

      <InputAccessoryView nativeID={TOOLBAR_ACCESSORY_ID}>
        {mode === "text" ? (
          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.Button icon="textformat" />
            <Stack.Toolbar.Button icon="checklist" />
            <Stack.Toolbar.Button icon="camera" />
            <Stack.Toolbar.Button icon="paperclip" onPress={handlePickImage} />
            <Stack.Toolbar.Button icon="pencil.tip" onPress={enterDrawMode} />
          </Stack.Toolbar>
        ) : (
          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.Button icon="paintpalette" />
            <Stack.Toolbar.Menu icon="paintbrush.pointed" title="Choose Brush">
              {BRUSH_TYPES.map((brush) => (
                <Stack.Toolbar.MenuAction
                  key={brush.id}
                  icon={brush.icon}
                  isOn={selectedBrush === brush.id}
                  onPress={() => setSelectedBrush(brush.id)}
                >
                  {brush.label}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Menu
              icon="lineweight"
              title="Select Line Weight"
            >
              {LINE_WEIGHTS.map((weight) => (
                <Stack.Toolbar.MenuAction
                  key={weight.id}
                  isOn={selectedWeight === LINE_WEIGHTS_MAP[weight.id]}
                  onPress={() => setSelectedWeight(LINE_WEIGHTS_MAP[weight.id])}
                >
                  {weight.label}
                </Stack.Toolbar.MenuAction>
              ))}
              <Stack.Toolbar.Menu title="Variable Weight">
                {VARIABLE_WEIGHTS.map((weight) => (
                  <Stack.Toolbar.MenuAction
                    key={weight}
                    isOn={selectedWeight === weight}
                    onPress={() => setSelectedWeight(weight)}
                  >
                    {weight}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Spacer />
            <Stack.Toolbar.Button icon="checkmark" onPress={enterTextMode} />
          </Stack.Toolbar>
        )}
      </InputAccessoryView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    fontFamily: "SF Pro Display",
    letterSpacing: 0.15,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    color: "#454545",
  },
  body: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: "SF Pro Text",
    letterSpacing: 0.24,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingBottom: 16,
    minHeight: 120,
    color: "#454545",
  },
  canvas: {
    height: 400,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
    overflow: "hidden",
    opacity: 0.4,
  },
  canvasActive: {
    opacity: 1,
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
});
