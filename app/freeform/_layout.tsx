import React from "react";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack screenOptions={{ headerTransparent: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ title: "" }} />
    </Stack>
  );
}
