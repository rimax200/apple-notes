import { View, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import React, { useState } from "react";
import { Link, router, Stack } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedViewWrapper } from "@/components/ThemedView";
import { useFreeformDrawings } from "@/hooks/useFreeformDrawings";

export default function Index() {
  const [query, setQuery] = useState("");
  const { drawings, createDrawing, renameDrawing, deleteDrawing, formatDate } =
    useFreeformDrawings();

  const filtered = typeof query === "string" && query.trim()
    ? drawings.filter((d) => {
        const q = query.toLowerCase();
        return d.title.toLowerCase().includes(q) || d.body?.toLowerCase().includes(q);
      })
    : drawings;

  const handleNew = async () => {
    const id = await createDrawing();
    router.navigate(`/freeform/${id}`);
  };

  const handleRename = (id: string, currentTitle: string) => {
    Alert.prompt(
      "Rename",
      undefined,
      (title) => {
        if (title?.trim()) renameDrawing(id, title.trim());
      },
      "plain-text",
      currentTitle
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Drawing", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDrawing(id),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Notes" }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis" palette />
      </Stack.Toolbar>
      <Stack.SearchBar onChangeText={(e) => setQuery(e?.nativeEvent?.text ?? "")} />
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button icon="square.and.pencil" onPress={handleNew} />
      </Stack.Toolbar>

      <ThemedViewWrapper colorName="captchaBg">
        <ScrollView
          contentContainerStyle={styles.grid}
          contentInsetAdjustmentBehavior="automatic"
        >
          {filtered.map((item) => (
            <Link key={item.id} href={`/freeform/${item.id}`} asChild>
              <Link.Trigger withAppleZoom>
                <Pressable style={styles.card}>
                  <View style={styles.container}>
                    <View style={styles.content}>
                      <ThemedText style={styles.title} type="semiBold" numberOfLines={1}>
                        {item.title}
                      </ThemedText>
                      <ThemedText style={styles.subtitle}>
                        {formatDate(item.updatedAt)}
                      </ThemedText>
                      <ThemedText style={styles.bodyPreview}>
                        {item.body?.trim() || "No additional text"}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              </Link.Trigger>

              <Link.Menu>
                <Link.MenuAction
                  icon="pencil"
                  onPress={() => handleRename(item.id, item.title)}
                >
                  Rename
                </Link.MenuAction>
                <Link.MenuAction icon="star">Favorite</Link.MenuAction>
                <Link.MenuAction icon="square.and.arrow.up">Share</Link.MenuAction>
                <Link.MenuAction icon="plus.square.on.square">Duplicate</Link.MenuAction>
                <Link.MenuAction
                  icon="trash"
                  destructive
                  onPress={() => handleDelete(item.id)}
                >
                  Delete
                </Link.MenuAction>
              </Link.Menu>
            </Link>
          ))}
        </ScrollView>
      </ThemedViewWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  card: {
    flexBasis: "47%",
    height: 195,
    marginBottom: 12,
  },
  container: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderCurve: "continuous",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 15,
    gap: 7,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Tiro Devanagari Sanskrit",
    opacity: 0.5,
  },
  bodyPreview: {
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: "#6A6A73",
  },
});
