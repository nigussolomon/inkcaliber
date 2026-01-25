import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router";
import { writeTextFile, readTextFile, mkdir, BaseDirectory, rename, stat } from "@tauri-apps/plugin-fs";
import { TextInput, Group, Box, ActionIcon, Tooltip, Stack, Paper, ScrollArea, Button, Text, Select, Modal, Textarea, Divider, Badge, Loader } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01FreeIcons, FloppyDiskFreeIcons, Loading01FreeIcons, AlertCircle, Pen01FreeIcons, Settings02FreeIcons, AiChat01FreeIcons, UserFreeIcons } from "@hugeicons/core-free-icons";
import { Shell } from "../../components/shell";
import { getStoredTheme } from "../../theme";
import { AIProvider, createAIService, getAPIKey, Message as AIMessage } from "../../services/ai-service";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatData {
  title: string;
  systemPrompt: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export default function ActiveChat() {
  const { provider } = useParams<{ provider: AIProvider }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFile = searchParams.get("file");

  const [fileName, setFileName] = useState(initialFile || "");
  const [originalFileName, setOriginalFileName] = useState(initialFile || "");
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "error" | "unsaved">("saved");
  const folder = `InkCaliber/chat/${provider}`;
  const [theme] = useState(getStoredTheme().theme);

  const [chatData, setChatData] = useState<ChatData>({
    title: "",
    systemPrompt: "default",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [messageInput, setMessageInput] = useState("");
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [promptModalOpened, setPromptModalOpened] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const fileNameRef = useRef(fileName);
  const originalFileNameRef = useRef(originalFileName);
  const saveTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fileNameRef.current = fileName; }, [fileName]);
  useEffect(() => { originalFileNameRef.current = originalFileName; }, [originalFileName]);

  useEffect(() => {
    loadSystemPrompts();
    if (initialFile) {
      loadChat(initialFile);
      setOriginalFileName(initialFile);
      originalFileNameRef.current = initialFile;
      setFileName(initialFile);
      fileNameRef.current = initialFile;
    }
  }, [initialFile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData.messages]);

  const loadSystemPrompts = async () => {
    try {
      const promptsFolder = "InkCaliber/system-prompts";
      await mkdir(promptsFolder, { baseDir: BaseDirectory.Document, recursive: true });
      
      try {
        const content = await readTextFile(`${promptsFolder}/prompts.json`, { baseDir: BaseDirectory.Document });
        const data = JSON.parse(content);
        setSystemPrompts(data.prompts || []);
      } catch {
        // Create default prompts if file doesn't exist
        const defaultPrompts: SystemPrompt[] = [
          {
            id: "default",
            name: "Default Assistant",
            content: "You are a helpful AI assistant.",
            isDefault: true
          },
          {
            id: "brainstorm",
            name: "Brainstorming Partner",
            content: "You are a creative brainstorming partner. Help generate innovative ideas and explore possibilities.",
            isDefault: false
          }
        ];
        setSystemPrompts(defaultPrompts);
        await writeTextFile(`${promptsFolder}/prompts.json`, JSON.stringify({ prompts: defaultPrompts }, null, 2), { baseDir: BaseDirectory.Document });
      }
    } catch (e) {
      console.error("Failed to load system prompts", e);
    }
  };

  const loadChat = async (name: string) => {
    try {
      const content = await readTextFile(`${folder}/${name}.json`, { baseDir: BaseDirectory.Document });
      const data = JSON.parse(content);
      setChatData(data);
    } catch (e) {
      console.error("Failed to load chat", e);
    }
  };

  const saveChat = async (data: ChatData) => {
    const currentFileName = fileNameRef.current;
    const currentOriginalName = originalFileNameRef.current;

    if (!currentFileName.trim()) return;
    setSyncStatus("syncing");

    try {
      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
      
      if (currentOriginalName && currentFileName !== currentOriginalName) {
        try {
          await stat(`${folder}/${currentFileName}.json`, { baseDir: BaseDirectory.Document });
          console.error("Target file exists, aborting rename");
          setSyncStatus("error");
          alert("A chat with this name already exists.");
          return;
        } catch {
          // File does not exist, safe to rename
        }

        await rename(`${folder}/${currentOriginalName}.json`, `${folder}/${currentFileName}.json`, {
          oldPathBaseDir: BaseDirectory.Document,
          newPathBaseDir: BaseDirectory.Document
        });
        setOriginalFileName(currentFileName);
        originalFileNameRef.current = currentFileName;
        setSearchParams({ file: currentFileName });
      }

      const updatedData = { ...data, title: currentFileName, updatedAt: new Date().toISOString() };
      await writeTextFile(`${folder}/${currentFileName}.json`, JSON.stringify(updatedData, null, 2), { baseDir: BaseDirectory.Document });
      setSyncStatus("saved");
      
      if (!currentOriginalName) {
        setOriginalFileName(currentFileName);
        originalFileNameRef.current = currentFileName;
        setSearchParams({ file: currentFileName });
      }
    } catch (e) {
      console.error("Failed to save", e);
      setSyncStatus("error");
    }
  };

  const debouncedSave = (data: ChatData) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveChat(data);
    }, 1000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFileName(newTitle);
    fileNameRef.current = newTitle;
    setSyncStatus("unsaved");
    debouncedSave(chatData);
  };

  const getAIResponse = async (userMessage: string, history: AIMessage[], systemPromptContent?: string) => {
    if (!provider) throw new Error("No provider selected");
    
    const apiKey = getAPIKey(provider);
    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}. Please configure it in settings.`);
    }

    const aiService = createAIService(provider, { apiKey });
    return await aiService.sendMessage(userMessage, history, systemPromptContent);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: messageInput,
      timestamp: new Date().toISOString()
    };

    // Add user message immediately
    const updatedDataWithUser = {
      ...chatData,
      messages: [...chatData.messages, userMessage]
    };

    setChatData(updatedDataWithUser);
    setMessageInput("");
    setSyncStatus("unsaved");
    debouncedSave(updatedDataWithUser);

    // Get AI response
    setAiGenerating(true);
    try {
      const currentPrompt = systemPrompts.find(p => p.id === chatData.systemPrompt);
      const aiResponse = await getAIResponse(
        userMessage.content,
        chatData.messages,
        currentPrompt?.content
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      const updatedDataWithAI = {
        ...updatedDataWithUser,
        messages: [...updatedDataWithUser.messages, assistantMessage]
      };

      setChatData(updatedDataWithAI);
      setSyncStatus("unsaved");
      debouncedSave(updatedDataWithAI);
    } catch (error: any) {
      console.error("AI Error:", error);
      alert(`AI Error: ${error.message}`);
      
      // Add error message as assistant message
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      const updatedDataWithError = {
        ...updatedDataWithUser,
        messages: [...updatedDataWithUser.messages, errorMessage]
      };

      setChatData(updatedDataWithError);
      setSyncStatus("unsaved");
      debouncedSave(updatedDataWithError);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddAssistantMessage = () => {
    const newMessage: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString()
    };

    const updatedData = {
      ...chatData,
      messages: [...chatData.messages, newMessage]
    };

    setChatData(updatedData);
    setSyncStatus("unsaved");
    debouncedSave(updatedData);
  };

  const handleMessageEdit = (index: number, newContent: string) => {
    const updatedMessages = [...chatData.messages];
    updatedMessages[index].content = newContent;
    
    const updatedData = {
      ...chatData,
      messages: updatedMessages
    };

    setChatData(updatedData);
    setSyncStatus("unsaved");
    debouncedSave(updatedData);
  };

  const handleSystemPromptChange = (promptId: string | null) => {
    if (!promptId) return;
    
    const updatedData = {
      ...chatData,
      systemPrompt: promptId
    };

    setChatData(updatedData);
    setSyncStatus("unsaved");
    debouncedSave(updatedData);
  };

  const handleCreatePrompt = async () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) return;

    const newPrompt: SystemPrompt = {
      id: newPromptName.toLowerCase().replace(/\s+/g, '-'),
      name: newPromptName,
      content: newPromptContent,
      isDefault: false
    };

    const updatedPrompts = [...systemPrompts, newPrompt];
    setSystemPrompts(updatedPrompts);

    try {
      const promptsFolder = "InkCaliber/system-prompts";
      await writeTextFile(`${promptsFolder}/prompts.json`, JSON.stringify({ prompts: updatedPrompts }, null, 2), { baseDir: BaseDirectory.Document });
      setPromptModalOpened(false);
      setNewPromptName("");
      setNewPromptContent("");
    } catch (e) {
      console.error("Failed to save prompt", e);
      alert("Failed to save system prompt");
    }
  };

  const currentPrompt = systemPrompts.find(p => p.id === chatData.systemPrompt);

  return (
    <Shell menus={
      <Stack align="center" gap="md">
        <Tooltip label="Back to Gallery" position="right">
          <ActionIcon size="xl" color="gray" variant="subtle" radius="md" onClick={() => navigate(`/chat/${provider}`)}>
            <HugeiconsIcon icon={ArrowLeft01FreeIcons} />
          </ActionIcon>
        </Tooltip>
        <Box style={{ width: '60%', height: '1px', backgroundColor: 'var(--mantine-color-gray-3)' }} />
        <Tooltip color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'blue' : 'green'} label={`Sync: ${syncStatus}`} position="right">
          <ActionIcon size="lg" variant="light" color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'blue' : 'green'} radius="md">
            <HugeiconsIcon icon={syncStatus === 'syncing' ? Loading01FreeIcons : syncStatus === 'error' ? AlertCircle : FloppyDiskFreeIcons} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Manage System Prompts" position="right">
          <ActionIcon size="lg" variant="light" color="violet" radius="md" onClick={() => setPromptModalOpened(true)}>
            <HugeiconsIcon icon={Settings02FreeIcons} />
          </ActionIcon>
        </Tooltip>
      </Stack>
    }>
      <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <Box style={{ borderBottom: '1px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)', zIndex: 10 }} p="md">
          <Group justify="space-between" mb="xs">
            <TextInput
              variant="unstyled"
              size="md"
              placeholder="Untitled Chat"
              value={fileName}
              onChange={handleTitleChange}
              styles={{ input: { fontSize: 18, fontWeight: 700, paddingLeft: 0, height: 30 } }}
              style={{ flex: 1, maxWidth: 400 }}
            />
            <Select
              placeholder="Select system prompt"
              value={chatData.systemPrompt}
              onChange={handleSystemPromptChange}
              data={systemPrompts.map(p => ({ value: p.id, label: p.name }))}
              style={{ width: 250 }}
            />
          </Group>
          {currentPrompt && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              System: {currentPrompt.content}
            </Text>
          )}
        </Box>

        {/* Messages Area */}
        <ScrollArea style={{ flex: 1 }} p="md">
          <Stack gap="md" style={{ maxWidth: 800, margin: '0 auto' }}>
            {chatData.messages.length === 0 ? (
              <Box style={{ textAlign: 'center', padding: '60px 20px' }}>
                <HugeiconsIcon icon={AiChat01FreeIcons} size={64} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed" mt="md">Start a conversation with {provider?.toUpperCase()}...</Text>
              </Box>
            ) : (
              chatData.messages.map((message, index) => (
                <Paper key={index} p="md" radius="md" withBorder bg={message.role === 'user' ? (theme === 'dark' ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-blue-0)') : (theme === 'dark' ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-0)')}>
                  <Group gap="xs" mb="xs">
                    <HugeiconsIcon icon={message.role === 'user' ? UserFreeIcons : AiChat01FreeIcons} size={20} color={message.role === 'user' ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-green-5)'} />
                    <Badge size="sm" color={message.role === 'user' ? 'blue' : 'green'}>
                      {message.role === 'user' ? 'You' : provider?.toUpperCase()}
                    </Badge>
                    <Text size="xs" c="dimmed">{new Date(message.timestamp).toLocaleString()}</Text>
                  </Group>
                  <Textarea
                    value={message.content}
                    onChange={(e) => handleMessageEdit(index, e.target.value)}
                    placeholder={message.role === 'assistant' ? "AI response..." : "Your message..."}
                    autosize
                    minRows={2}
                    variant="unstyled"
                    styles={{ input: { padding: 0 } }}
                  />
                </Paper>
              ))
            )}
            {aiGenerating && (
              <Paper p="md" radius="md" withBorder bg={theme === 'dark' ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-0)'}>
                <Group gap="xs">
                  <Loader size="sm" color="green" />
                  <Text size="sm" c="dimmed">{provider?.toUpperCase()} is thinking...</Text>
                </Group>
              </Paper>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        </ScrollArea>

        {/* Input Area */}
        <Box style={{ borderTop: '1px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)' }} p="md">
          <Group gap="xs" style={{ maxWidth: 800, margin: '0 auto' }}>
            <TextInput
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !aiGenerating && handleSendMessage()}
              style={{ flex: 1 }}
              size="md"
              disabled={aiGenerating}
            />
            <Tooltip label="Send Message">
              <ActionIcon size="lg" color="blue" variant="filled" radius="md" onClick={handleSendMessage} loading={aiGenerating} disabled={aiGenerating}>
                <HugeiconsIcon icon={Pen01FreeIcons} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Add Manual AI Response">
              <ActionIcon size="lg" color="green" variant="light" radius="md" onClick={handleAddAssistantMessage} disabled={aiGenerating}>
                <HugeiconsIcon icon={AiChat01FreeIcons} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </Box>

      {/* System Prompts Modal */}
      <Modal opened={promptModalOpened} onClose={() => setPromptModalOpened(false)} title="Manage System Prompts" centered size="lg">
        <Stack>
          <Divider label="Existing Prompts" />
          {systemPrompts.map(prompt => (
            <Paper key={prompt.id} p="sm" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={700}>{prompt.name}</Text>
                {prompt.isDefault && <Badge size="sm" color="violet">Default</Badge>}
              </Group>
              <Text size="sm" c="dimmed">{prompt.content}</Text>
            </Paper>
          ))}
          
          <Divider label="Create New Prompt" mt="md" />
          <TextInput
            label="Prompt Name"
            placeholder="e.g. Code Reviewer"
            value={newPromptName}
            onChange={(e) => setNewPromptName(e.target.value)}
          />
          <Textarea
            label="Prompt Content"
            placeholder="You are a helpful assistant that..."
            value={newPromptContent}
            onChange={(e) => setNewPromptContent(e.target.value)}
            minRows={4}
          />
          <Button color="green" onClick={handleCreatePrompt} fullWidth>
            Create Prompt
          </Button>
        </Stack>
      </Modal>
    </Shell>
  );
}
