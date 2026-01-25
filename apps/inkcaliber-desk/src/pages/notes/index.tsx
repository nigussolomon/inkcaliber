import { useState, useEffect, useMemo } from "react";
import { readDir, remove, rename, BaseDirectory, mkdir, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { useNavigate } from "react-router";
import { ActionIcon, Box, Button, Card, Flex, SimpleGrid, Stack, Text, Title, TextInput, Select, Modal, Group, Center, Loader, Tooltip, Divider } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrangeFreeIcons, ArrowTurnBackwardFreeIcons, Home02FreeIcons, MoonFreeIcons, PencilEdit01FreeIcons, Plus, Search01FreeIcons, SunFreeIcons, Trash2, Note01FreeIcons } from "@hugeicons/core-free-icons";

import { getStoredTheme, setStoredTheme } from "../../theme";

export default function NotesGallery() {
  const [theme, setTheme] = useState(getStoredTheme().theme);
  const [notes, setNotes] = useState<any[]>([]);
  const [trashNotes, setTrashNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [renamingNote, setRenamingNote] = useState<{ oldName: string; newName: string } | null>(null);

  const navigate = useNavigate();
  const folder = "InkCaliber/notes";
  const trashFolder = "InkCaliber/.trash/notes";

  useEffect(() => {
    setupAndLoad();
  }, []);

  const setupAndLoad = async () => {
    try {
      // Ensure directories
      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
      await mkdir(trashFolder, { baseDir: BaseDirectory.Document, recursive: true });
      loadNotes();
    } catch (e) {
      loadNotes();
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      
      const fetchStats = async (dirEntries: any[], pathPrefix: string) => {
          return Promise.all(
            dirEntries
              .filter(e => e.name.endsWith(".json"))
              .map(async (entry) => {
                try {
                  const fileStat = await stat(`${pathPrefix}/${entry.name}`, { baseDir: BaseDirectory.Document });
                  return { name: entry.name, mtime: fileStat.mtime || new Date(0) };
                } catch {
                  return { name: entry.name, mtime: new Date(0) };
                }
              })
          );
      };

      // Load Active Notes
      try {
          const entries = await readDir(folder, { baseDir: BaseDirectory.Document });
          const active = await fetchStats(entries, folder);
          setNotes(active);
      } catch (err) {
          console.error("Error reading notes dir", err);
          setNotes([]);
      }

      // Load Trash Notes
      try {
          const trashEntries = await readDir(trashFolder, { baseDir: BaseDirectory.Document });
          const trashed = await fetchStats(trashEntries, trashFolder);
          setTrashNotes(trashed);
      } catch (err) { 
          // Trash dir might not exist yet if mkdir failed silently or something else
          setTrashNotes([]);
      }

    } catch (e) {
      console.error("Error loading notes", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewNote = async () => {
      try {
          // ensure dir exists (idempotent usually)
          await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
          
          const entries = await readDir(folder, { baseDir: BaseDirectory.Document });
          const untitledRegex = /^Untitled\s+(\d+)\.json$/;
          let maxNum = 0;

          entries.forEach(entry => {
              const match = entry.name.match(untitledRegex);
              if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxNum) maxNum = num;
              }
          });

          const nextNum = maxNum + 1;
          const newName = `Untitled ${nextNum}`;
          const newFileName = `${newName}.json`;
          
          await writeTextFile(`${folder}/${newFileName}`, JSON.stringify({ type: "doc", content: [] }), { baseDir: BaseDirectory.Document });
          navigate(`/notes/active?file=${encodeURIComponent(newName)}`);
      } catch (e) {
          console.error("Failed to create new note", e);
          alert("Failed to create new note");
      }
  };

  // Move to Trash
  const handleMoveToTrash = async (e: React.MouseEvent, noteName: string) => {
    e.stopPropagation();
    try {
      await rename(`${folder}/${noteName}`, `${trashFolder}/${noteName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadNotes();
    } catch (err) {
      alert("Error moving to trash.");
      console.error(err);
    }
  };

  // Restore from Trash
  const handleRestore = async (noteName: string) => {
    try {
      await rename(`${trashFolder}/${noteName}`, `${folder}/${noteName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadNotes();
    } catch (err) {
      alert("Restore failed. A note with this name might already exist.");
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (noteName: string) => {
    if (!window.confirm(`Delete "${noteName}" forever? This cannot be undone.`)) return;
    try {
      await remove(`${trashFolder}/${noteName}`, { baseDir: BaseDirectory.Document });
      loadNotes();
    } catch (err) {
      alert("Error deleting note.");
    }
  };

  const processedNotes = useMemo(() => {
    return (showTrash ? trashNotes : notes)
      .filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
      });
  }, [notes, trashNotes, searchQuery, sortBy, showTrash]);

  const handleRename = async () => {
    if (!renamingNote || !renamingNote.newName.trim()) return;
    const oldName = renamingNote.oldName;
    // ensure extension is kept or managed. logic assumes 'name' includes .json
    let newName = renamingNote.newName.trim();
    if (!newName.endsWith(".json")) newName += ".json";

    if (oldName === newName) {
        setRenamingNote(null);
        return;
    }

    try {
        // Check if destination exists
        try {
            await stat(`${folder}/${newName}`, { baseDir: BaseDirectory.Document });
            // If stat succeeds, file exists
            alert("A note with this name already exists.");
            return;
        } catch {
            // File does not exist, proceed
        }

      await rename(`${folder}/${oldName}`, `${folder}/${newName}`, {
        oldPathBaseDir: BaseDirectory.Document, newPathBaseDir: BaseDirectory.Document
      });
      setRenamingNote(null);
      loadNotes();
    } catch (err) { 
        alert("Rename failed."); 
        console.error(err);
    }
  };

  return (
    <Box p="xl">
      <Flex align="center" justify="space-between" wrap="wrap" gap="md" mb="lg">
        <Stack gap={0}>
            <Group gap="xs">
                 <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')}><HugeiconsIcon icon={Home02FreeIcons} size={24} /></ActionIcon>
                 <Title>{showTrash ? "Trash Bin" : "Notes"}</Title>
            </Group>
          <Text size="xs" c="dimmed" pl="xl">
            {showTrash ? "Manage deleted notes." : "Capture your thoughts and ideas."}
          </Text>
        </Stack>
        
        <Flex gap="xs" align="center">
           <Button 
            radius="md" 
            variant="subtle" 
            color={showTrash ? "violet" : trashNotes.length > 0 ? "red" : "gray"}
            onClick={() => setShowTrash(!showTrash)}
            rightSection={<HugeiconsIcon icon={showTrash ? ArrangeFreeIcons : Trash2} size={16} />}
          >
             <Text size="xs" fw={900}>{showTrash ? "Back to Notes" : `Trash (${trashNotes.length})`}</Text>
          </Button>

          {!showTrash && (
            <Button radius="md" onClick={handleCreateNewNote} variant="default" color="blue" rightSection={<HugeiconsIcon icon={Plus} size={16} />}>
                <Text size="xs" fw={900}>New Note</Text>
            </Button>
          )}

           <ActionIcon radius="md" size="lg" onClick={() => { setTheme(theme == "dark" ? "light" : "dark"); setStoredTheme(theme == "dark" ? "light" : "dark") }} color={theme === "dark" ? "white" : "black"} variant={theme === "dark" ? "white" : "filled"}>
            <HugeiconsIcon color={theme === "dark" ? "black" : "white"} icon={theme !== "dark" ? MoonFreeIcons : SunFreeIcons} size={16} />
          </ActionIcon>
        </Flex>
      </Flex>

      <Flex gap="md" mb="xl" align="flex-end">
        <TextInput radius="md" placeholder="Search notes..." size="md" leftSection={<HugeiconsIcon icon={Search01FreeIcons} size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} style={{ flex: 1 }} />
        <Select label="Sort by" value={sortBy} onChange={(val) => setSortBy(val || "date")} data={[{ value: "date", label: "Recent Activity" }, { value: "name", label: "Note Name" }]} />
      </Flex>

      <Divider mb="lg" label={processedNotes.length === 0 ? "Empty" : `${processedNotes.length} Notes`} />

      {loading ? (
        <Center h={200}><Loader color="blue" /></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, xl: 6 }} spacing="lg">
            {processedNotes.map(note => {
                const displayName = note.name.replace(".json", "");
                
                return (
                    <Card key={note.name} radius="md" withBorder p={0} >
                        <Group gap={8} style={{ position: "absolute", right: 10, top: 10, zIndex: 10 }}>
                           {showTrash ? (
                            <>
                              <Tooltip label="Restore">
                                <ActionIcon variant="filled" color="green" radius="md" onClick={() => handleRestore(note.name)}>
                                  <HugeiconsIcon icon={ArrowTurnBackwardFreeIcons} size={16}/>
                                </ActionIcon>
                              </Tooltip>
                              <ActionIcon variant="filled" color="red" radius="md" onClick={() => handlePermanentDelete(note.name)}>
                                <HugeiconsIcon icon={Trash2} size={16}/>
                              </ActionIcon>
                            </>
                           ) : (
                            <>
                              <ActionIcon variant="filled" color="yellow" radius="md" onClick={(e) => { e.stopPropagation(); setRenamingNote({ oldName: note.name, newName: displayName }); }}>
                                <HugeiconsIcon icon={PencilEdit01FreeIcons} size={16}/>
                              </ActionIcon>
                              <ActionIcon variant="filled" color="red" radius="md" onClick={(e) => handleMoveToTrash(e, note.name)}>
                                <HugeiconsIcon icon={Trash2} size={16}/>
                              </ActionIcon>
                            </>
                           )}
                        </Group>

                        <Card.Section 
                            onClick={() => !showTrash && navigate(`/notes/active?file=${encodeURIComponent(displayName)}`)} 
                            style={{ cursor: showTrash ? 'default' : 'pointer' }}
                        >
                            <Box 
                                bg={theme === 'dark' ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)"} 
                                w="100%" 
                                h={180} 
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <HugeiconsIcon icon={Note01FreeIcons} size={64} color="var(--mantine-color-gray-5)" />
                            </Box>
                        </Card.Section>

                        <Stack gap={2} mt="sm" mx="xs" mb="sm">
                            <Text size="sm" fw={700} truncate>{displayName}</Text>
                            <Text size="xs" c="dimmed">{note.mtime?.toLocaleString()}</Text>
                        </Stack>
                    </Card>
                );
            })}
        </SimpleGrid>
      )}

      <Modal opened={!!renamingNote} onClose={() => setRenamingNote(null)} title="Rename Note" centered radius="md">
        <TextInput label="New note name" value={renamingNote?.newName || ""} onChange={(e) => setRenamingNote(curr => curr ? { ...curr, newName: e.target.value } : null)} />
        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={() => setRenamingNote(null)}>Cancel</Button>
          <Button color="blue" onClick={handleRename}>Save Name</Button>
        </Group>
      </Modal>
    </Box>
  );
}
