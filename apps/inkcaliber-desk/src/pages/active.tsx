import { useState, useRef, useEffect } from "react";
import { Excalidraw, exportToBlob, serializeAsJSON, WelcomeScreen } from "@excalidraw/excalidraw";
import { writeTextFile, readTextFile, mkdir, BaseDirectory, writeFile, readDir, remove } from "@tauri-apps/plugin-fs";
import { useSearchParams, useNavigate } from "react-router";
import { getStoredTheme, setStoredBgColor, setStoredTheme, Theme } from "../theme";
import "@excalidraw/excalidraw/index.css";
import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Button, TextInput, Modal, Stack, Text, Menu, ScrollArea, Box, ActionIcon, Tooltip, Indicator, Group } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircle,
  CheckmarkCircle01FreeIcons,
  PlusSignFreeIcons,
  Search01FreeIcons,
  GitBranch,
  Home02FreeIcons,
  Delete02FreeIcons,
  FloppyDiskFreeIcons,
  Loading01FreeIcons
} from "@hugeicons/core-free-icons";
import { Shell } from "../components/shell";

type SyncStatus = "saved" | "syncing" | "error" | "loading";

// Helper to make branch names look "Normal" (e.g. arch_v1 -> Arch V1)
const formatBranchName = (name: string) => {
  if (name === "data") return "Main Branch";
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function ActiveSessionComp({ setSync, setBranches, currentBranch }: any) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFile = searchParams.get("file");
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [isLoaded, setIsLoaded] = useState(false);

  const excalidrawAPI = useRef<any>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const sessionFolderRef = useRef<string | null>(initialFile);
  const lastFingerprintRef = useRef<string>("");

  const loadBranches = async () => {
    if (!sessionFolderRef.current || sessionFolderRef.current === "new") {
      setBranches([{ value: "data", label: "Main Branch" }]);
      return;
    }
    try {
      const entries = await readDir(`InkCaliber/${sessionFolderRef.current}`, { baseDir: BaseDirectory.Document });
      const branches = entries
        .filter(e => e.name.endsWith(".excalidraw"))
        .map(e => ({
          value: e.name.replace(".excalidraw", ""),
          label: formatBranchName(e.name.replace(".excalidraw", ""))
        }));
      setBranches(branches);
    } catch (e) {
      setBranches([{ value: "data", label: "Main Branch" }]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      if (!initialFile || initialFile === "new") {
        setIsLoaded(true);
        loadBranches();
        return;
      }
      try {
        setSync("loading");
        const filePath = `InkCaliber/${initialFile}/${currentBranch}.excalidraw`;
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Document });
        const data = JSON.parse(content);

        const timer = setInterval(() => {
          if (excalidrawAPI.current) {
            excalidrawAPI.current.updateScene({
              elements: data.elements,
              appState: { ...data.appState, theme: theme.theme }
            });
            lastFingerprintRef.current = JSON.stringify(data.elements.map((el: any) => ({ id: el.id, v: el.version, n: el.versionNonce })));
            setIsLoaded(true);
            setSync("saved");
            loadBranches();
            clearInterval(timer);
          }
        }, 50);
        return () => clearInterval(timer);
      } catch (err) {
        setSync("saved");
        setIsLoaded(true);
        loadBranches();
      }
    };
    loadInitialData();
  }, [initialFile, currentBranch]);

  const saveToSessionFile = async (elements: any, appState: any, branchOverride?: string) => {
    try {
      setSync("syncing");
      const targetBranch = branchOverride || currentBranch;
      if (!sessionFolderRef.current || sessionFolderRef.current === "new") {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        sessionFolderRef.current = `session-${timestamp}`;
        setSearchParams({ file: sessionFolderRef.current, branch: targetBranch });
      }
      const basePath = `InkCaliber/${sessionFolderRef.current}`;
      await mkdir(basePath, { baseDir: BaseDirectory.Document, recursive: true });
      const json = serializeAsJSON(elements, appState, {}, "local");
      await writeTextFile(`${basePath}/${targetBranch}.excalidraw`, json, { baseDir: BaseDirectory.Document });

      if (targetBranch === "data") {
        const blob = await exportToBlob({
          elements,
          mimeType: "image/png",
          appState: { ...appState, exportWithBlurryBackground: false },
          files: excalidrawAPI.current?.getFiles() || {}
        });
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(`${basePath}/preview.png`, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.Document });
      }
      setSync("saved");
      loadBranches();
    } catch (err) {
      setSync("error");
    }
  };

  (window as any).forceSaveBranch = (name: string) => {
    if (!excalidrawAPI.current) return;
    const elements = excalidrawAPI.current.getSceneElements();
    const appState = excalidrawAPI.current.getAppState();
    saveToSessionFile(elements, appState, name);
  };

  (window as any).refreshBranches = () => loadBranches();

  const handleAutoSave = (elements: readonly OrderedExcalidrawElement[], appState: any) => {
    if (!isLoaded) return;
    const currentFingerprint = JSON.stringify(elements.map(el => ({ id: el.id, v: el.version, n: el.versionNonce })));
    if (currentFingerprint === lastFingerprintRef.current) return;
    lastFingerprintRef.current = currentFingerprint;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => saveToSessionFile(elements, appState), 1500);
  };

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Excalidraw
        excalidrawAPI={(api) => { excalidrawAPI.current = api; }}
        autoFocus={true}
        UIOptions={{ canvasActions: { export: false } }}
        initialData={{ appState: { theme: theme.theme, viewBackgroundColor: theme.bgColor } }}
        onChange={(elements, appState) => {
          if (appState.theme !== theme.theme || appState.viewBackgroundColor !== theme.bgColor) {
            setTheme({ theme: appState.theme, bgColor: appState.viewBackgroundColor });
            setStoredTheme(appState.theme);
            setStoredBgColor(appState.viewBackgroundColor);
          }
          handleAutoSave(elements, appState);
        }}
      >
        <WelcomeScreen />
      </Excalidraw>
    </div>
  );
}

export default function ActiveSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentBranch = searchParams.get("branch") || "data";
  const sessionFile = searchParams.get("file");

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [availableBranches, setAvailableBranches] = useState<{ value: string; label: string }[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchSearch, setBranchSearch] = useState("");

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    const sanitized = newBranchName.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if ((window as any).forceSaveBranch) await (window as any).forceSaveBranch(sanitized);
    setSearchParams({ file: sessionFile!, branch: sanitized });
    setBranchModalOpen(false);
    setNewBranchName("");
  };

  const handleDeleteBranch = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (branchName === "data") return;
    if (!window.confirm(`Delete version "${formatBranchName(branchName)}"?`)) return;
    try {
      await remove(`InkCaliber/${sessionFile}/${branchName}.excalidraw`, { baseDir: BaseDirectory.Document });
      if ((window as any).refreshBranches) (window as any).refreshBranches();
    } catch (err) { console.error(err); }
  };

  const filteredBranches = availableBranches.filter(b => b.label.toLowerCase().includes(branchSearch.toLowerCase()));

  return (
    <Shell menus={
      <Stack align='center' gap="md">
        <Tooltip label="Home" position="right"><ActionIcon size="xl" color="gray" variant="subtle" radius="md" onClick={() => navigate('/')}><HugeiconsIcon icon={Home02FreeIcons}/></ActionIcon></Tooltip>

        <Box style={{ width: '60%', height: '1px', backgroundColor: 'var(--mantine-color-gray-3)' }} />

        {/* Sync Indicator */}
        <Tooltip color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'violet' : 'green'} label={`Sync: ${syncStatus}`} position="right">
          <ActionIcon size="lg" variant="light" color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'violet' : 'green'} radius="md">
            <HugeiconsIcon icon={syncStatus === 'syncing' ? Loading01FreeIcons : syncStatus === 'error' ? AlertCircle : FloppyDiskFreeIcons} />
          </ActionIcon>
        </Tooltip>

        {/* Branch Menu */}
        <Menu shadow="md" width={220} position="right-start" offset={15}>
          <Menu.Target>
            <Tooltip color="violet" label={`Version: ${formatBranchName(currentBranch)}`} position="right">
                <Indicator label={availableBranches.length} size={13} color="violet" offset={5} disabled={availableBranches.length <= 1}>
                    <ActionIcon size="lg"  variant="default" radius="md"><HugeiconsIcon icon={GitBranch}/></ActionIcon>
                </Indicator>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown p="xs">
            <TextInput placeholder="Search..." size="xs" mb="xs" value={branchSearch} onChange={(e) => setBranchSearch(e.currentTarget.value)} leftSection={<HugeiconsIcon icon={Search01FreeIcons} size={12} />} />
            <Menu.Divider />
            <ScrollArea.Autosize mah={200}>
              {filteredBranches.map((branch) => (
                <Menu.Item key={branch.value} onClick={() => setSearchParams({ file: sessionFile!, branch: branch.value })} rightSection={
                    <Group gap={4}>
                      {currentBranch === branch.value && <HugeiconsIcon icon={CheckmarkCircle01FreeIcons} size={14} color="var(--mantine-color-violet-filled)" />}
                      {branch.value !== "data" && branch.value !== currentBranch && (
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDeleteBranch(e, branch.value)}><HugeiconsIcon icon={Delete02FreeIcons} size={12}/></ActionIcon>
                      )}
                    </Group>
                  }>
                  <Text size="xs" fw={currentBranch === branch.value ? 700 : 400}>{branch.label}</Text>
                </Menu.Item>
              ))}
            </ScrollArea.Autosize>
            <Menu.Divider />
            <Menu.Item c="violet" leftSection={<HugeiconsIcon icon={PlusSignFreeIcons} size={14} />} onClick={() => setBranchModalOpen(true)}><Text size="xs" fw={600}>New Branch</Text></Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Stack>
    }>
      <ActiveSessionComp setSync={setSyncStatus} setBranches={setAvailableBranches} currentBranch={currentBranch} />

      <Modal opened={branchModalOpen} onClose={() => setBranchModalOpen(false)} title="New Version Branch" centered radius="md">
        <Stack>
          <Text size="sm" c="dimmed">Clones the current canvas into a new version in your Omnilink folder.</Text>
          <TextInput label="Branch Name" placeholder="e.g. concept-v2" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} autoFocus />
          <Button color="violet" onClick={handleCreateBranch} fullWidth>Confirm Branch</Button>
        </Stack>
      </Modal>
    </Shell>
  );
}
