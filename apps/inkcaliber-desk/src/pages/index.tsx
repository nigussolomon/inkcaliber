import { useState, useEffect, useMemo } from "react";
import { readDir, remove, rename, BaseDirectory, stat, mkdir } from "@tauri-apps/plugin-fs";
import { useNavigate } from "react-router";
import { ActionIcon, Box, Button, Card, Flex, SimpleGrid, Stack, Text, Title, TextInput, Select, Modal, Group, Image, Center, Loader, Tooltip, Divider } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrangeFreeIcons, ArrowTurnBackwardFreeIcons, MoonFreeIcons, PencilEdit01FreeIcons, Plus, Search01FreeIcons, SunFreeIcons, Trash2 } from "@hugeicons/core-free-icons";
import { convertFileSrc } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { getStoredTheme, setStoredTheme } from "../theme";

export default function FileGallery() {
  const [theme, setTheme] = useState(getStoredTheme().theme);
  const [sessions, setSessions] = useState<any[]>([]);
  const [trashSessions, setTrashSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docPath, setDocPath] = useState("");
  const [showTrash, setShowTrash] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [renamingFile, setRenamingFile] = useState<{ oldName: string; newName: string } | null>(null);

  const navigate = useNavigate();
  const folder = "InkCaliber";
  const trashFolder = "InkCaliber/.trash";

  useEffect(() => {
    documentDir().then(setDocPath);
    setupAndLoad();
  }, []);

  const setupAndLoad = async () => {
    try {
      // Ensure trash directory exists
      await mkdir(trashFolder, { baseDir: BaseDirectory.Document, recursive: true });
      loadSessions();
    } catch (e) {
      loadSessions();
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const entries = await readDir(folder, { baseDir: BaseDirectory.Document });

      const fetchStats = async (items: any[], pathPrefix: string) => {
        return Promise.all(items.filter(e => e.isDirectory && e.name !== ".trash").map(async (entry) => {
          try {
            const fileStat = await stat(`${pathPrefix}/${entry.name}/data.excalidraw`, { baseDir: BaseDirectory.Document });
            return { name: entry.name, mtime: fileStat.mtime || new Date(0) };
          } catch {
            return { name: entry.name, mtime: new Date(0) };
          }
        }));
      };

      const active = await fetchStats(entries, folder);
      setSessions(active);

      // Load Trash
      const trashEntries = await readDir(trashFolder, { baseDir: BaseDirectory.Document });
      const trashed = await fetchStats(trashEntries, trashFolder);
      setTrashSessions(trashed);

    } catch (err) {
      console.error("Access error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Move to Trash (Soft Delete)
  const handleMoveToTrash = async (e: React.MouseEvent, folderName: string) => {
    e.stopPropagation();
    try {
      await rename(`${folder}/${folderName}`, `${trashFolder}/${folderName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadSessions();
    } catch (err) {
      alert("Error moving to trash.");
    }
  };

  // Restore from Trash
  const handleRestore = async (folderName: string) => {
    try {
      await rename(`${trashFolder}/${folderName}`, `${folder}/${folderName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadSessions();
    } catch (err) {
      alert("Restore failed. A folder with this name might already exist.");
    }
  };

  // Permanent Delete
    const handlePermanentDelete = async (folderName: string) => {
      // 1. Your app-level confirmation
      if (!window.confirm(`Wipe "${folderName}" forever? This cannot be undone.`)) return;

      try {
        const targetPath = `${trashFolder}/${folderName}`;

        // 2. Read the contents of the folder (e.g., data.excalidraw, preview.png)
        const entries = await readDir(targetPath, { baseDir: BaseDirectory.Document });

        // 3. Delete each file individually (This bypasses the system popup)
        for (const entry of entries) {
          await remove(`${targetPath}/${entry.name}`, {
            baseDir: BaseDirectory.Document
          });
        }

        // 4. Now that the folder is empty, remove the folder itself
        // We set recursive: false here
        await remove(targetPath, {
          baseDir: BaseDirectory.Document,
          recursive: false
        });

        // Refresh the UI
        loadSessions();
      } catch (err) {
        console.error("Manual delete failed:", err);
        alert("Could not complete permanent deletion.");
      }
    };

  const processedSessions = useMemo(() => {
    return (showTrash ? trashSessions : sessions)
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
      });
  }, [sessions, trashSessions, searchQuery, sortBy, showTrash]);

  const handleRename = async () => {
    if (!renamingFile || !renamingFile.newName.trim()) return;
    try {
      await rename(`${folder}/${renamingFile.oldName}`, `${folder}/${renamingFile.newName.trim()}`, {
        oldPathBaseDir: BaseDirectory.Document, newPathBaseDir: BaseDirectory.Document
      });
      setRenamingFile(null);
      loadSessions();
    } catch (err) { alert("Rename failed."); }
  };

  return (
    <Box p="xl">
      <Flex align="center" justify="space-between" wrap="wrap" gap="md" mb="lg">
        <Stack gap={0}>
          <Title>{showTrash ? "Trash Bin" : "InkCaliber Gallery"}</Title>
          <Text size="xs" c="dimmed">
            {showTrash ? "Manage deleted sessions. You can restore them or wipe them forever." : "Explore and manage your drawings effortlessly."}
          </Text>
        </Stack>

        <Flex gap="xs" align="center">
          <Button
            radius="md"
            variant="subtle"
            color={showTrash ? "violet" : trashSessions.length > 0 ? "red" : "gray"}
            onClick={() => setShowTrash(!showTrash)}
            rightSection={<HugeiconsIcon icon={showTrash ? ArrangeFreeIcons : Trash2} size={16} />}
          >
             <Text size="xs" fw={900}>{showTrash ? "Back to Gallery" : `Trash (${trashSessions.length})`}</Text>
          </Button>

          {!showTrash && (
            <Button radius="md" onClick={() => navigate("/active")} variant="default" color="violet" rightSection={<HugeiconsIcon icon={Plus} size={16} />}>
                <Text size="xs" fw={900}>New Drawing</Text>
            </Button>
          )}

          <ActionIcon radius="md" size="lg" onClick={() => { setTheme(theme == "dark" ? "light" : "dark"); setStoredTheme(theme == "dark" ? "light" : "dark") }} color={theme === "dark" ? "white" : "black"} variant={theme === "dark" ? "white" : "filled"}>
            <HugeiconsIcon color={theme === "dark" ? "black" : "white"} icon={theme !== "dark" ? MoonFreeIcons : SunFreeIcons} size={16} />
          </ActionIcon>
        </Flex>
      </Flex>

      <Flex gap="md" mb="xl" align="flex-end">
        <TextInput radius="md" placeholder="Search..." size="md" leftSection={<HugeiconsIcon icon={Search01FreeIcons} size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} style={{ flex: 1 }} />
        <Select label="Sort by" value={sortBy} onChange={(val) => setSortBy(val || "date")} data={[{ value: "date", label: "Recent Activity" }, { value: "name", label: "Session Name" }]} />
      </Flex>

      <Divider mb="lg" label={processedSessions.length === 0 ? "Empty" : `${processedSessions.length} Sessions`} />

      {loading ? (
        <Center h={200}><Loader color="violet" /></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, xl: 6 }} spacing="lg">
          {processedSessions.map(session => {
            const previewUrl = convertFileSrc(`${docPath}/${showTrash ? trashFolder : folder}/${session.name}/preview.png`);

            return (
              <Card key={session.name} radius="md" withBorder p={0} >
                <Group gap={8} style={{ position: "absolute", right: 10, top: 10, zIndex: 10 }}>
                  {showTrash ? (
                    <>
                      <Tooltip label="Restore">
                        <ActionIcon variant="filled" color="green" radius="md" onClick={() => handleRestore(session.name)}>
                          <HugeiconsIcon icon={ArrowTurnBackwardFreeIcons} size={16}/>
                        </ActionIcon>
                      </Tooltip>
                      <ActionIcon variant="filled" color="red" radius="md" onClick={() => handlePermanentDelete(session.name)}>
                        <HugeiconsIcon icon={Trash2} size={16}/>
                      </ActionIcon>
                    </>
                  ) : (
                    <>
                      <ActionIcon variant="filled" color="yellow" radius="md" onClick={(e) => { e.stopPropagation(); setRenamingFile({ oldName: session.name, newName: session.name }); }}>
                        <HugeiconsIcon icon={PencilEdit01FreeIcons} size={16}/>
                      </ActionIcon>
                      <ActionIcon variant="filled" color="red" radius="md" onClick={(e) => handleMoveToTrash(e, session.name)}>
                        <HugeiconsIcon icon={Trash2} size={16}/>
                      </ActionIcon>
                    </>
                  )}
                </Group>

                <Card.Section  onClick={() => !showTrash && navigate(`/active?file=${encodeURIComponent(session.name)}`)} style={{ cursor: showTrash ? 'default' : 'pointer' }}>
                  <Box bg="gray.0" w="100%" h={180} style={{ borderRadius: '8px', overflow: 'hidden' }}>
                    <Image w="100%" src={previewUrl} fallbackSrc="https://placehold.co/400x300?text=No+Preview" fit="cover" />
                  </Box>
                </Card.Section>

                <Stack gap={2} mt="sm" mx="xs" mb="sm">
                  <Text size="sm" fw={700} truncate>{session.name}</Text>
                  <Text size="xs" c="dimmed">{session.mtime?.toLocaleString()}</Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Rename Modal remains the same... */}
      <Modal opened={!!renamingFile} onClose={() => setRenamingFile(null)} title="Rename Session" centered radius="md">
        <TextInput label="New session name" value={renamingFile?.newName || ""} onChange={(e) => setRenamingFile(curr => curr ? { ...curr, newName: e.target.value } : null)} />
        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={() => setRenamingFile(null)}>Cancel</Button>
          <Button color="violet" onClick={handleRename}>Save Name</Button>
        </Group>
      </Modal>
    </Box>
  );
}
