import { useState, useEffect, useMemo } from "react";
import { readDir, remove, rename, BaseDirectory, mkdir, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { useNavigate, useParams } from "react-router";
import { AIProvider } from "../../services/ai-service";
import { ActionIcon, Box, Button, Card, Flex, SimpleGrid, Stack, Text, Title, TextInput, Select, Modal, Group, Center, Loader, Tooltip, Divider } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrangeFreeIcons, ArrowTurnBackwardFreeIcons, MoonFreeIcons, PencilEdit01FreeIcons, Plus, Search01FreeIcons, SunFreeIcons, Trash2, AiChat01FreeIcons, ArrowLeft01FreeIcons } from "@hugeicons/core-free-icons";

import { getStoredTheme, setStoredTheme } from "../../theme";

export default function ChatGallery() {
  const { provider } = useParams<{ provider: AIProvider }>();
  const [theme, setTheme] = useState(getStoredTheme().theme);
  const [chats, setChats] = useState<any[]>([]);
  const [trashChats, setTrashChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [renamingChat, setRenamingChat] = useState<{ oldName: string; newName: string } | null>(null);

  const navigate = useNavigate();
  const folder = `InkCaliber/chat/${provider}`;
  const trashFolder = `InkCaliber/.trash/chat/${provider}`;

  useEffect(() => {
    setupAndLoad();
  }, []);

  const setupAndLoad = async () => {
    try {
      // Ensure directories
      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
      await mkdir(trashFolder, { baseDir: BaseDirectory.Document, recursive: true });
      loadChats();
    } catch (e) {
      loadChats();
    }
  };

  const loadChats = async () => {
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

      // Load Active Chats
      try {
          const entries = await readDir(folder, { baseDir: BaseDirectory.Document });
          const active = await fetchStats(entries, folder);
          setChats(active);
      } catch (err) {
          console.error("Error reading chat dir", err);
          setChats([]);
      }

      // Load Trash Chats
      try {
          const trashEntries = await readDir(trashFolder, { baseDir: BaseDirectory.Document });
          const trashed = await fetchStats(trashEntries, trashFolder);
          setTrashChats(trashed);
      } catch (err) { 
          setTrashChats([]);
      }

    } catch (e) {
      console.error("Error loading chats", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewChat = async () => {
      try {
          await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
          
          const entries = await readDir(folder, { baseDir: BaseDirectory.Document });
          const untitledRegex = /^Untitled Chat (\d+)\.json$/;
          let maxNum = 0;

          entries.forEach(entry => {
              const match = entry.name.match(untitledRegex);
              if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxNum) maxNum = num;
              }
          });

          const nextNum = maxNum + 1;
          const newName = `Untitled Chat ${nextNum}`;
          const newFileName = `${newName}.json`;
          
          const initialChatData = {
            title: newName,
            systemPrompt: "default",
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await writeTextFile(`${folder}/${newFileName}`, JSON.stringify(initialChatData, null, 2), { baseDir: BaseDirectory.Document });
          navigate(`/chat/${provider}/active?file=${encodeURIComponent(newName)}`);
      } catch (e) {
          console.error("Failed to create new chat", e);
          alert("Failed to create new chat");
      }
  };

  // Move to Trash
  const handleMoveToTrash = async (e: React.MouseEvent, chatName: string) => {
    e.stopPropagation();
    try {
      await rename(`${folder}/${chatName}`, `${trashFolder}/${chatName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadChats();
    } catch (err) {
      alert("Error moving to trash.");
      console.error(err);
    }
  };

  // Restore from Trash
  const handleRestore = async (chatName: string) => {
    try {
      await rename(`${trashFolder}/${chatName}`, `${folder}/${chatName}`, {
        oldPathBaseDir: BaseDirectory.Document,
        newPathBaseDir: BaseDirectory.Document
      });
      loadChats();
    } catch (err) {
      alert("Restore failed. A chat with this name might already exist.");
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (chatName: string) => {
    if (!window.confirm(`Delete "${chatName}" forever? This cannot be undone.`)) return;
    try {
      await remove(`${trashFolder}/${chatName}`, { baseDir: BaseDirectory.Document });
      loadChats();
    } catch (err) {
      alert("Error deleting chat.");
    }
  };

  const processedChats = useMemo(() => {
    return (showTrash ? trashChats : chats)
      .filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
      });
  }, [chats, trashChats, searchQuery, sortBy, showTrash]);

  const handleRename = async () => {
    if (!renamingChat || !renamingChat.newName.trim()) return;
    const oldName = renamingChat.oldName;
    let newName = renamingChat.newName.trim();
    if (!newName.endsWith(".json")) newName += ".json";

    if (oldName === newName) {
        setRenamingChat(null);
        return;
    }

    try {
        // Check if destination exists
        try {
            await stat(`${folder}/${newName}`, { baseDir: BaseDirectory.Document });
            alert("A chat with this name already exists.");
            return;
        } catch {
            // File does not exist, proceed
        }

      await rename(`${folder}/${oldName}`, `${folder}/${newName}`, {
        oldPathBaseDir: BaseDirectory.Document, newPathBaseDir: BaseDirectory.Document
      });
      setRenamingChat(null);
      loadChats();
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
                 <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/chat')}><HugeiconsIcon icon={ArrowLeft01FreeIcons} size={24} /></ActionIcon>
                 <Title>{showTrash ? "Trash Bin" : `${provider?.toUpperCase()} Chat`}</Title>
            </Group>
          <Text size="xs" c="dimmed" pl="xl">
            {showTrash ? "Manage deleted chats." : "AI-powered brainstorming assistant."}
          </Text>
        </Stack>
        
        <Flex gap="xs" align="center">
           <Button 
            radius="md" 
            variant="subtle" 
            color={showTrash ? "violet" : trashChats.length > 0 ? "red" : "gray"}
            onClick={() => setShowTrash(!showTrash)}
            rightSection={<HugeiconsIcon icon={showTrash ? ArrangeFreeIcons : Trash2} size={16} />}
          >
             <Text size="xs" fw={900}>{showTrash ? "Back to Chats" : `Trash (${trashChats.length})`}</Text>
          </Button>

          {!showTrash && (
            <Button radius="md" onClick={handleCreateNewChat} variant="default" color="green" rightSection={<HugeiconsIcon icon={Plus} size={16} />}>
                <Text size="xs" fw={900}>New Chat</Text>
            </Button>
          )}

           <ActionIcon radius="md" size="lg" onClick={() => { setTheme(theme == "dark" ? "light" : "dark"); setStoredTheme(theme == "dark" ? "light" : "dark") }} color={theme === "dark" ? "white" : "black"} variant={theme === "dark" ? "white" : "filled"}>
            <HugeiconsIcon color={theme === "dark" ? "black" : "white"} icon={theme !== "dark" ? MoonFreeIcons : SunFreeIcons} size={16} />
          </ActionIcon>
        </Flex>
      </Flex>

      <Flex gap="md" mb="xl" align="flex-end">
        <TextInput radius="md" placeholder="Search chats..." size="md" leftSection={<HugeiconsIcon icon={Search01FreeIcons} size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} style={{ flex: 1 }} />
        <Select label="Sort by" value={sortBy} onChange={(val) => setSortBy(val || "date")} data={[{ value: "date", label: "Recent Activity" }, { value: "name", label: "Chat Name" }]} />
      </Flex>

      <Divider mb="lg" label={processedChats.length === 0 ? "Empty" : `${processedChats.length} Chats`} />

      {loading ? (
        <Center h={200}><Loader color="green" /></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, xl: 6 }} spacing="lg">
            {processedChats.map(chat => {
                const displayName = chat.name.replace(".json", "");
                
                return (
                    <Card key={chat.name} radius="md" withBorder p={0} >
                        <Group gap={8} style={{ position: "absolute", right: 10, top: 10, zIndex: 10 }}>
                           {showTrash ? (
                            <>
                              <Tooltip label="Restore">
                                <ActionIcon variant="filled" color="green" radius="md" onClick={() => handleRestore(chat.name)}>
                                  <HugeiconsIcon icon={ArrowTurnBackwardFreeIcons} size={16}/>
                                </ActionIcon>
                              </Tooltip>
                              <ActionIcon variant="filled" color="red" radius="md" onClick={() => handlePermanentDelete(chat.name)}>
                                <HugeiconsIcon icon={Trash2} size={16}/>
                              </ActionIcon>
                            </>
                           ) : (
                            <>
                              <ActionIcon variant="filled" color="yellow" radius="md" onClick={(e) => { e.stopPropagation(); setRenamingChat({ oldName: chat.name, newName: displayName }); }}>
                                <HugeiconsIcon icon={PencilEdit01FreeIcons} size={16}/>
                              </ActionIcon>
                              <ActionIcon variant="filled" color="red" radius="md" onClick={(e) => handleMoveToTrash(e, chat.name)}>
                                <HugeiconsIcon icon={Trash2} size={16}/>
                              </ActionIcon>
                            </>
                           )}
                        </Group>

                        <Card.Section 
                            onClick={() => !showTrash && navigate(`/chat/${provider}/active?file=${encodeURIComponent(displayName)}`)} 
                            style={{ cursor: showTrash ? 'default' : 'pointer' }}
                        >
                            <Box 
                                bg={theme === 'dark' ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)"} 
                                w="100%" 
                                h={180} 
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <HugeiconsIcon icon={AiChat01FreeIcons} size={64} color="var(--mantine-color-green-5)" />
                            </Box>
                        </Card.Section>

                        <Stack gap={2} mt="sm" mx="xs" mb="sm">
                            <Text size="sm" fw={700} truncate>{displayName}</Text>
                            <Text size="xs" c="dimmed">{chat.mtime?.toLocaleString()}</Text>
                        </Stack>
                    </Card>
                );
            })}
        </SimpleGrid>
      )}

      <Modal opened={!!renamingChat} onClose={() => setRenamingChat(null)} title="Rename Chat" centered radius="md">
        <TextInput label="New chat name" value={renamingChat?.newName || ""} onChange={(e) => setRenamingChat(curr => curr ? { ...curr, newName: e.target.value } : null)} />
        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={() => setRenamingChat(null)}>Cancel</Button>
          <Button color="green" onClick={handleRename}>Save Name</Button>
        </Group>
      </Modal>
    </Box>
  );
}
