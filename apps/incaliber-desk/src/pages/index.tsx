import { useState, useEffect, useMemo } from "react";
import { readDir, remove, rename, BaseDirectory, stat } from "@tauri-apps/plugin-fs";
import { useNavigate } from "react-router";
import { ActionIcon, Badge, Box, Button, Card, Flex, SimpleGrid, Stack, Text, Title, Tooltip } from "@mantine/core";

export default function FileGallery() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [renamingFile, setRenamingFile] = useState<{ oldName: string; newName: string } | null>(null);

  const navigate = useNavigate();
  const folder = "InkCaliber";

  const loadFiles = async () => {
    try {
      setLoading(true);
      const entries = await readDir(folder, { baseDir: BaseDirectory.Document });

      // Get metadata (mtime) for each file to allow date filtering
      const filesWithMeta = await Promise.all(
        entries
          .filter(e => e.name.endsWith(".excalidraw"))
          .map(async (entry) => {
            const fileStat = await stat(`${folder}/${entry.name}`, { baseDir: BaseDirectory.Document });
            return {
              name: entry.name,
              mtime: fileStat.mtime || 0,
            };
          })
      );

      setFiles(filesWithMeta);
    } catch (err) {
      console.error("Access error:", err);
    } finally {
      setLoading(false);
    }
  };

  const processedFiles = useMemo(() => {
    return files
      .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return (b.mtime as any) - (a.mtime as any); // Newest first
      });
  }, [files, searchQuery, sortBy]);

  const handleDelete = async (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await remove(`${folder}/${fileName}`, { baseDir: BaseDirectory.Document });
      setFiles(prev => prev.filter(f => f.name !== fileName));
    } catch (err) {
      alert("Error deleting file.");
    }
  };

  const handleRename = async () => {
    if (!renamingFile || !renamingFile.newName.trim()) return;

    let targetName = renamingFile.newName.trim();
    if (!targetName.endsWith(".excalidraw")) targetName += ".excalidraw";

    try {
      await rename(
        `${folder}/${renamingFile.oldName}`,
        `${folder}/${targetName}`,
        { oldPathBaseDir: BaseDirectory.Document, newPathBaseDir: BaseDirectory.Document }
      );
      setRenamingFile(null);
      loadFiles(); // Refresh list
    } catch (err) {
      alert("Could not rename file. Name might already exist.");
    }
  };

  useEffect(() => { loadFiles(); }, []);

  return (
    <Box p="xl">
      <Flex align="center" justify="space-between">
        <Stack gap={0}>
          <Title>
            InkCaliber Gallery
          </Title>
          <Text size="xs" c="dimmed">
            Welcome to InkCaliber Gallery! Explore and manage your drawings effortlessly.
          </Text>
        </Stack>
        <Flex gap="xs" align="center">
          <Tooltip label="Coming Soon">
            <Card withBorder radius="md" padding="sm">
              <Flex gap={8} align="center">
                <ActionIcon mt={-2.3} radius="xl" color="red" size={8}>

                </ActionIcon>
                <Text size="xs"  fw={900}>
                  Cloud Sync
                </Text>
              </Flex>
            </Card>
          </Tooltip>
          <Button
            radius="md"
            size="md"
            onClick={() => navigate("/active")}
            variant="default"
            color="violet"
          >
            <Text size="xs" fw={900}>
              Start New Drawing
            </Text>
          </Button>
          <Button
            radius="md"
            size="md"
            onClick={() => navigate("/active")}
            variant="default"
            color="violet"
          >
            <Text size="xs" fw={900}>
              Register
            </Text>
          </Button>
          <Button
            radius="md"
            size="md"
            onClick={() => navigate("/active")}
            variant="default"
            color="violet"
          >
            <Text size="xs" fw={900}>
              Login
            </Text>
          </Button>
        </Flex>
      </Flex>
      <SimpleGrid mt="xl" cols={{ xs: 1, md: 4, xl: 6 }}>
        {processedFiles.map(file => (
          <Card
            onClick={() => navigate("/active?file=" + encodeURIComponent(file.name))}
            radius="md"
            key={file.name}
            withBorder
            p="xs"
          >
            <ActionIcon radius="xl" color="red" style={{position: "absolute", right: 5, top: 5, zIndex: 10}} onClick={(e) => handleDelete(e, file.name)}></ActionIcon>
            <Card mb="sm" radius="md" withBorder h={180} w="100%"/>
            <Text>{file.name}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}
