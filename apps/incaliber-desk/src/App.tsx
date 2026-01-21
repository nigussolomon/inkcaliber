import { useState, useRef } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import { save } from "@tauri-apps/plugin-dialog"; // Note: v2 syntax, use @tauri-apps/api/dialog for v1
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getStoredTheme, setStoredBgColor, setStoredTheme, Theme } from "./theme";
import "@excalidraw/excalidraw/index.css";

export default function App() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  // Create a ref to access Excalidraw API methods
  const excalidrawAPI = useRef<any>(null);

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme.theme !== theme.theme || newTheme.bgColor !== theme.bgColor) {
      setTheme(newTheme);
      setStoredTheme(newTheme.theme);
      setStoredBgColor(newTheme.bgColor);
    }
  };

  const handleExportToFile = async () => {
    if (!excalidrawAPI.current) return;

    // 1. Get current elements and state from the API
    const elements = excalidrawAPI.current.getSceneElements();
    const appState = excalidrawAPI.current.getAppState();

    // 2. Serialize to JSON string
    const json = serializeAsJSON(elements, appState, {}, "local");

    try {
      // 3. Open Tauri Native Save Dialog
      const filePath = await save({
        filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
        defaultPath: "drawing.excalidraw",
      });

      if (filePath) {
        // 4. Write to disk
        await writeTextFile(filePath, json);
        console.log("File saved successfully at:", filePath);
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Native-looking Save Button */}
      <button
        onClick={handleExportToFile}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 100,
          padding: "8px 16px",
          cursor: "pointer",
          borderRadius: "4px",
          background: theme.theme === "dark" ? "#333" : "#fff",
          color: theme.theme === "dark" ? "#fff" : "#000",
          border: "1px solid #ccc"
        }}
      >
        Save to Computer
      </button>

      <Excalidraw
        excalidrawAPI={(api) => (excalidrawAPI.current = api)}
        initialData={{
          elements: JSON.parse(localStorage.getItem("excalidrawElements") || "[]"),
          appState: {
            theme: theme.theme,
            viewBackgroundColor: theme.bgColor,
          },
        }}
        onChange={(elements, appState) => {
          // Auto-save to localStorage
          localStorage.setItem("excalidrawElements", JSON.stringify(elements));
          handleThemeChange({ theme: appState.theme, bgColor: appState.viewBackgroundColor });
        }}
      />
    </div>
  );
}
