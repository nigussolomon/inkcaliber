# 🖋️ InkCaliber Desk

**InkCaliber** is a powerful, locally-first workspace designed for thinkers, designers, and creators. It combines advanced diagramming, rich-text notes, and a persistent AI brainstorming assistant into a single, unified desktop experience.

## 🚀 Features

### 🎨 Infinite Diagrams
- **Canvas-first Drawing**: Powered by Excalidraw for fluid, hand-drawn aesthetics.
- **Versioning (Branches)**: Clone canvases into branches to explore ideas safely.

### 📝 Smart Notes
- **Rich Text Editing**: Clean Tiptap-powered editor for capturing thoughts.
- **AI Context**: Effortlessly provide your notes as context to the AI assistant.

### 🤖 AI Brainstorming
- **Multimodal Context**: Reference local files and diagram branches in your chats.
- **Persona Management**: Create and mark your favorite AI personas as default.
- **Spotlight Search**: Fast-access overlay (Alt-S) to navigate your library.

## 🛠️ Tech Stack

- **Core**: Tauri v2, React, TypeScript
- **Styling**: Mantine UI
- **AI**: Google Gemini API

## 📦 Getting Started

```bash
# Install dependencies
npm install

# Run development mode
npm run tauri dev

# Build production app
npm run tauri build
```

## 🏗️ CI/CD
Automated builds for Linux, Windows, and macOS are triggered on every push to the `prod` branch using GitHub Actions.
