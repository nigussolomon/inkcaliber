import { useState, useRef, useEffect } from "react";
import { Excalidraw, serializeAsJSON, WelcomeScreen } from "@excalidraw/excalidraw";
import { writeTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { getStoredTheme, setStoredBgColor, setStoredTheme, Theme } from "./theme";
import "@excalidraw/excalidraw/index.css";
import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

type SyncStatus = "saved" | "syncing" | "error";

export default function App() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");

  const excalidrawAPI = useRef<any>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const sessionFileRef = useRef<string | null>(null);
  const lastFingerprintRef = useRef<string>("");

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme.theme !== theme.theme || newTheme.bgColor !== theme.bgColor) {
      setTheme(newTheme);
      setStoredTheme(newTheme.theme);
      setStoredBgColor(newTheme.bgColor);
    }
  };

  // --- Save to session file in Documents/InkCaliber ---
  const saveToSessionFile = async (data: string) => {
    try {
      setSyncStatus("syncing");
      const folder = "InkCaliber";

      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });

      // If no session file yet, create one with timestamp
      if (!sessionFileRef.current) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        sessionFileRef.current = `drawing-session-${timestamp}.excalidraw`;
      }

      await writeTextFile(`${folder}/${sessionFileRef.current}`, data, { baseDir: BaseDirectory.Document });

      setSyncStatus("saved");
      console.log(`Synced to Documents/${folder}/${sessionFileRef.current}`);
    } catch (err) {
      console.error("FS Error:", err);
      setSyncStatus("error");
    }
  };

  // --- Auto-save handler with debounce and element change detection ---
  const handleAutoSave = (
      elements: readonly OrderedExcalidrawElement[],
      appState: any
    ) => {
      // 1. Create a quick "Fingerprint" of the current state
      // We only stringify the parts that matter for a 'save'
      // to keep it faster than a full serialization.
      const currentFingerprint = JSON.stringify(
        elements.map(el => ({
          id: el.id,
          x: el.x,
          y: el.y,
          w: el.width,
          h: el.height,
          v: el.version,
          n: el.versionNonce,
          p: (el as any).points // captures freehand drawing
        }))
      );

      // 2. Compare to the last fingerprint
      // You'll need to change lastElementsRef to store a string:
      // const lastFingerprintRef = useRef<string>("");
      if (currentFingerprint === lastFingerprintRef.current) {
        return; // Truly nothing changed
      }

      // 3. Update the fingerprint and start the sync
      lastFingerprintRef.current = currentFingerprint;
      setSyncStatus("syncing");

      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = window.setTimeout(async () => {
        const json = serializeAsJSON(elements as any, appState, {}, "local");
        await saveToSessionFile(json);
      }, 1000);
    };


  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Excalidraw

        excalidrawAPI={(api) => (excalidrawAPI.current = api)}
        renderTopRightUI={() => (
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "center"
          }}>
            {/* Sync Status */}
            <div style={{
              padding: "4px 12px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor: theme.theme === "dark" ? "#2c2c2c" : "#f0f0f0",
              color: syncStatus === "error" ? "#ff4d4d" : theme.theme === "dark" ? "#bbb" : "#666",
              border: "1px solid",
              borderColor: syncStatus === "syncing" ? "#6965db" : "transparent",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.3s ease"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: syncStatus === "syncing" ? "#6965db" : syncStatus === "error" ? "#ff4d4d" : "#4caf50"
              }} />
              {syncStatus === "syncing" ? "Syncing to Disk..." : syncStatus === "error" ? "Sync Error" : "Synced"}
            </div>
          </div>
        )}
        initialData={{
          elements: [],
          appState: {
            theme: theme.theme,
            viewBackgroundColor: theme.bgColor,
          },
        }}
        onChange={(elements, appState) => {
          handleThemeChange({ theme: appState.theme, bgColor: appState.viewBackgroundColor });
          handleAutoSave(elements, appState);
        }}
      >
        <WelcomeScreen/>
      </Excalidraw>
    </div>
  );
}
