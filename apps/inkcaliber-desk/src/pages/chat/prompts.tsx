import { useState, useEffect } from "react";
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { useNavigate, useParams } from "react-router";
import { ActionIcon, Box, Button, Card, Flex, SimpleGrid, Stack, Text, Title, TextInput, Textarea, Modal, Group, Divider, Paper, Tooltip, Badge } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01FreeIcons, Plus, PencilEdit01FreeIcons, Trash2, CheckmarkCircle01FreeIcons } from "@hugeicons/core-free-icons";

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export default function PromptManagement() {
  const { provider } = useParams<{ provider: string }>();
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");

  const navigate = useNavigate();
  const promptsFolder = "InkCaliber/system-prompts";

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      await mkdir(promptsFolder, { baseDir: BaseDirectory.Document, recursive: true });
      
      try {
        const content = await readTextFile(`${promptsFolder}/prompts.json`, { baseDir: BaseDirectory.Document });
        const data = JSON.parse(content);
        setPrompts(data.prompts || []);
      } catch (err) {
        // Defaults if file doesn't exist
        const defaults = [
          { id: "default", name: "Default Assistant", content: "You are a helpful AI assistant.", isDefault: true },
          { id: "brainstorm", name: "Brainstorming Partner", content: "You are a creative brainstorming partner.", isDefault: false }
        ];
        setPrompts(defaults);
        await savePromptsToFile(defaults);
      }
    } finally {
      setLoading(false);
    }
  };

  const savePromptsToFile = async (newPrompts: SystemPrompt[]) => {
    await writeTextFile(`${promptsFolder}/prompts.json`, JSON.stringify({ prompts: newPrompts }, null, 2), { baseDir: BaseDirectory.Document });
  };

  const handleOpenModal = (prompt?: SystemPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormName(prompt.name);
      setFormContent(prompt.content);
    } else {
      setEditingPrompt(null);
      setFormName("");
      setFormContent("");
    }
    setModalOpened(true);
  };

  const handleSavePrompt = async () => {
    if (!formName.trim() || !formContent.trim()) return;

    let updatedPrompts: SystemPrompt[];
    if (editingPrompt) {
      updatedPrompts = prompts.map(p => 
        p.id === editingPrompt.id ? { ...p, name: formName, content: formContent } : p
      );
    } else {
      const newPrompt: SystemPrompt = {
        id: Date.now().toString(),
        name: formName,
        content: formContent,
        isDefault: false
      };
      updatedPrompts = [...prompts, newPrompt];
    }

    setPrompts(updatedPrompts);
    await savePromptsToFile(updatedPrompts);
    setModalOpened(false);
  };

  const handleDeletePrompt = async (id: string) => {
    const updatedPrompts = prompts.filter(p => p.id !== id);
    setPrompts(updatedPrompts);
    await savePromptsToFile(updatedPrompts);
  };

  const handleSetDefault = async (id: string) => {
    const updatedPrompts = prompts.map(p => ({
      ...p,
      isDefault: p.id === id
    }));
    setPrompts(updatedPrompts);
    await savePromptsToFile(updatedPrompts);
  };

  return (
    <Box p="xl">
      <Flex align="center" justify="space-between" mb="lg">
        <Stack gap={0}>
          <Group gap="xs">
            <ActionIcon variant="subtle" color="gray" onClick={() => navigate(`/chat/${provider}`)}><HugeiconsIcon icon={ArrowLeft01FreeIcons} size={24} /></ActionIcon>
            <Title>System Prompts</Title>
          </Group>
          <Text size="xs" c="dimmed" pl="xl">Manage AI personas and behavior instructions.</Text>
        </Stack>
        <Button leftSection={<HugeiconsIcon icon={Plus} size={16} />} color="green" radius="md" onClick={() => handleOpenModal()}>
          Add New Prompt
        </Button>
      </Flex>

      <Divider mb="xl" />

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
        {prompts.map((prompt) => (
          <Card key={prompt.id} withBorder radius="md" p="md" style={{ display: 'flex', flexDirection: 'column' }}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <Text fw={700}>{prompt.name}</Text>
                {prompt.isDefault && <Badge color="violet" size="sm">Default</Badge>}
              </Group>
              <Group gap={8}>
                <Tooltip label="Edit">
                  <ActionIcon variant="light" color="blue" onClick={() => handleOpenModal(prompt)}>
                    <HugeiconsIcon icon={PencilEdit01FreeIcons} size={14} />
                  </ActionIcon>
                </Tooltip>
                {!prompt.isDefault && (
                  <Tooltip label="Delete">
                    <ActionIcon variant="light" color="red" onClick={() => handleDeletePrompt(prompt.id)}>
                      <HugeiconsIcon icon={Trash2} size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
            
            <Paper withBorder p="xs" bg="var(--mantine-color-gray-0)" style={{ flex: 1, minHeight: 100 }}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{prompt.content}</Text>
            </Paper>

            <Button 
                variant="subtle" 
                size="xs" 
                mt="sm" 
                color={prompt.isDefault ? "green" : "gray"}
                disabled={prompt.isDefault}
                onClick={() => handleSetDefault(prompt.id)}
                leftSection={prompt.isDefault && <HugeiconsIcon icon={CheckmarkCircle01FreeIcons} size={14} />}
            >
              {prompt.isDefault ? "Default Choice" : "Set as Default"}
            </Button>
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title={editingPrompt ? "Edit Prompt" : "New Prompt"} centered radius="md">
        <Stack>
          <TextInput label="Name" placeholder="e.g. Code Reviewer" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Textarea label="Instructions" placeholder="Describe how the AI should behave..." minRows={6} value={formContent} onChange={(e) => setFormContent(e.target.value)} />
          <Button fullWidth color="green" mt="md" onClick={handleSavePrompt}>
            Save Prompt
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
