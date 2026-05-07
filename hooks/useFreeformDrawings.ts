import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Drawing {
  id: string;
  title: string;
  body: string;
  paths: string[];
  images: string[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "freeform_drawings";

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function useFreeformDrawings() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setDrawings(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (next: Drawing[]) => {
    setDrawings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const createDrawing = useCallback(async (): Promise<string> => {
    const id = Date.now().toString();
    const drawing: Drawing = {
      id,
      title: "New Note",
      body: "",
      paths: [],
      images: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persist([drawing, ...drawings]);
    return id;
  }, [drawings, persist]);

  const updatePaths = useCallback(async (id: string, paths: string[]) => {
    setDrawings((prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, paths, updatedAt: Date.now() } : d
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateContent = useCallback(async (id: string, title: string, body: string) => {
    setDrawings((prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, title, body, updatedAt: Date.now() } : d
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateImages = useCallback(async (id: string, images: string[]) => {
    setDrawings((prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, images, updatedAt: Date.now() } : d
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const renameDrawing = useCallback(async (id: string, title: string) => {
    setDrawings((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, title } : d));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteDrawing = useCallback(async (id: string) => {
    setDrawings((prev) => {
      const next = prev.filter((d) => d.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getDrawing = useCallback(
    (id: string) => drawings.find((d) => d.id === id),
    [drawings]
  );

  return {
    drawings,
    loading,
    createDrawing,
    updatePaths,
    updateContent,
    updateImages,
    renameDrawing,
    deleteDrawing,
    getDrawing,
    formatDate,
  };
}
