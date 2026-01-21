import { useState, useRef, useEffect } from "react";
import { Excalidraw, serializeAsJSON, WelcomeScreen } from "@excalidraw/excalidraw";
import { writeTextFile, readTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { useSearchParams, useNavigate } from "react-router"; // Added for routing
import { getStoredTheme, setStoredBgColor, setStoredTheme, Theme } from "../theme";
import "@excalidraw/excalidraw/index.css";
import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

type SyncStatus = "saved" | "syncing" | "error" | "loading";

export default function ActiveSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFile = searchParams.get("file"); // Get filename from URL ?file=...

  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [isLoaded, setIsLoaded] = useState(false);

  const excalidrawAPI = useRef<any>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const sessionFileRef = useRef<string | null>(initialFile);
  const lastFingerprintRef = useRef<string>("");

  // --- Load file logic ---
  useEffect(() => {
    const loadInitialData = async () => {
      if (!initialFile || initialFile === "new") {
        setIsLoaded(true);
        return;
      }

      try {
        setSyncStatus("loading");
        const folder = "InkCaliber";
        const content = await readTextFile(`${folder}/${initialFile}`, {
          baseDir: BaseDirectory.Document,
        });

        const data = JSON.parse(content);

        // Crucial: Wait until API is available to inject data
        const timer = setInterval(() => {
          if (excalidrawAPI.current) {
            excalidrawAPI.current.updateScene({
              elements: data.elements,
              appState: { ...data.appState, theme: theme.theme }
            });

            // Snapshot the loaded state so we don't immediately "auto-save" the load
            lastFingerprintRef.current = JSON.stringify(data.elements.map((el: any) => ({
              id: el.id, x: el.x, y: el.y, w: el.width, h: el.height, v: el.version, n: el.versionNonce, p: el.points
            })));

            setIsLoaded(true);
            setSyncStatus("saved");
            clearInterval(timer);
          }
        }, 50);

        return () => clearInterval(timer);
      } catch (err) {
        console.error("Failed to load file:", err);
        setSyncStatus("error");
        setIsLoaded(true);
      }
    };

    loadInitialData();
  }, [initialFile, theme.theme]);

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme.theme !== theme.theme || newTheme.bgColor !== theme.bgColor) {
      setTheme(newTheme);
      setStoredTheme(newTheme.theme);
      setStoredBgColor(newTheme.bgColor);
    }
  };

  const saveToSessionFile = async (data: string) => {
    try {
      setSyncStatus("syncing");
      const folder = "InkCaliber";
      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });

      // Generate filename if this is a "new" session
      if (!sessionFileRef.current || sessionFileRef.current === "new") {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        sessionFileRef.current = `drawing-session-${timestamp}.excalidraw`;
      }

      await writeTextFile(`${folder}/${sessionFileRef.current}`, data, {
        baseDir: BaseDirectory.Document
      });

      setSyncStatus("saved");
    } catch (err) {
      console.error("FS Error:", err);
      setSyncStatus("error");
    }
  };

  const handleAutoSave = (elements: readonly OrderedExcalidrawElement[], appState: any) => {
    if (!isLoaded) return;

    const currentFingerprint = JSON.stringify(
      elements.map(el => ({
        id: el.id, x: el.x, y: el.y, w: el.width, h: el.height, v: el.version, n: el.versionNonce, p: (el as any).points
      }))
    );

    if (currentFingerprint === lastFingerprintRef.current) return;

    lastFingerprintRef.current = currentFingerprint;
    setSyncStatus("syncing");

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(async () => {
      const json = serializeAsJSON(elements as any, appState, {}, "local");
      await saveToSessionFile(json);
    }, 1000);
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <Excalidraw
        excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
        renderTopRightUI={() => (
            <div style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor: theme.theme === "dark" ? "#2c2c2c" : "#f0f0f0",
              color: syncStatus === "error" ? "#ff4d4d" : theme.theme === "dark" ? "#bbb" : "#666",
              border: "1px solid",
              borderColor: syncStatus === "syncing" ? "#6965db" : "transparent",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: syncStatus === "syncing" ? "#6965db" : syncStatus === "error" ? "#ff4d4d" : "#4caf50"
              }} />
              {syncStatus === "syncing" ? "Syncing..." : syncStatus === "loading" ? "Loading..." : "Synced"}
            </div>
        )}
        autoFocus={true}
        UIOptions={{ canvasActions: { export: false } }}
        initialData={{
          appState: {
            theme: theme.theme,
            viewBackgroundColor: theme.bgColor
          }
        }}
        onChange={(elements, appState) => {
          handleThemeChange({ theme: appState.theme, bgColor: appState.viewBackgroundColor });
          handleAutoSave(elements, appState);
        }}
      >
        <WelcomeScreen />
      </Excalidraw>
    </div>
  );
}
