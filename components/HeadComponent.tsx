import Head from "expo-router/head";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export default function HeadComponent() {
  if (!isWeb) return null;

  return (
    <Head>
      <title>Notes</title>
      <meta name="description" content="Notes app" />
      <meta name="color-scheme" content="light dark" />
    </Head>
  );
}
