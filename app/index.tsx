import React from "react";
import { StyleSheet, View } from "react-native";
import Button from "@/components/ui/Button";
import { useThemeColor } from "@/hooks/useThemeColor";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import LottieView from "lottie-react-native";

export default function Index() {
  const bg = useThemeColor("background");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: bg }]}>
          <View style={styles.container}>
            <LottieView
              source={require("@/assets/icon/Welcome.json")}
              autoPlay
              loop
              style={styles.lottie}
            />
          </View>
          <Button
            title="Start Exploring"
            bgcolor="#0091FF"
            color={bg}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 16,
              padding: 16,
              marginBottom: 24,
            }}
            onPress={() => router.navigate("/freeform")}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lottie: {
    width: 320,
    height: 120,
  },
});
