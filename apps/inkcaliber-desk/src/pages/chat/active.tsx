import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router";
import { writeTextFile, readTextFile, mkdir, BaseDirectory, rename, stat, readDir } from "@tauri-apps/plugin-fs";
import { TextInput, Group, Box, ActionIcon, Tooltip, Stack, Paper, ScrollArea, Button, Text, Select, Modal, Textarea, Divider, Badge, Loader, Title, UnstyledButton, Alert, Checkbox, Tabs } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01FreeIcons, FloppyDiskFreeIcons, Loading01FreeIcons, AlertCircle, Pen01FreeIcons, Settings02FreeIcons, AiChat01FreeIcons, UserFreeIcons, PencilEdit01FreeIcons, CheckmarkCircle01FreeIcons, Cancel01FreeIcons, Note01FreeIcons, DashboardSquare01FreeIcons, Search01FreeIcons, Attachment01FreeIcons, GitBranch } from "@hugeicons/core-free-icons";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeHighlight } from '@mantine/code-highlight';
import { Spotlight, spotlight, SpotlightActionData } from '@mantine/spotlight';
import '@mantine/spotlight/styles.css';
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

// Helper to extract plain text from Tiptap JSON
const tiptapToText = (node: any): string => {
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(tiptapToText).join(node.type === 'paragraph' ? '\n' : '');
  }
  return '';
};

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
  const [referencedFiles, setReferencedFiles] = useState<{ name: string; type: 'note' | 'diagram'; content: string; branch?: string }[]>([]);
  const [fileSelectModalOpened, setFileSelectModalOpened] = useState(false);
  const [quotaModalOpened, setQuotaModalOpened] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<{ name: string; type: 'note' | 'diagram'; branches?: string[] }[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // Quota Tracking
  const [usage, setUsage] = useState({
    rpm: 0,
    tpm: 0,
    rpd: 0
  });
  const limits = {
    rpm: 5,
    tpm: 250000,
    rpd: 20
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger Spotlight on Alt key
      if (e.key === 'Alt') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // Only prevent default if we are in the chat context or not in another input
        if (isInput && target.id !== 'chat-input') return; 

        e.preventDefault();
        loadSpotlightActions();
      }
    };
    window.addEventListener('keyup', handleKeyDown); // Keyup is often more reliable for lone Alt
    return () => window.removeEventListener('keyup', handleKeyDown);
  }, []);

  const updateQuota = (content: string) => {
    const estimatedTokens = Math.ceil(content.length / 4); // Simple estimation
    setUsage(prev => {
      const newUsage = {
        rpm: prev.rpm + 1,
        tpm: prev.tpm + estimatedTokens,
        rpd: prev.rpd + 1
      };
      
      // Save to local storage for persistence across reloads (RPD)
      localStorage.setItem('ai_usage_rpd', JSON.stringify({
        date: new Date().toDateString(),
        count: newUsage.rpd
      }));
      
      return newUsage;
    });

    // Reset RPM and TPM after a minute
    setTimeout(() => {
        setUsage(prev => ({ ...prev, rpm: Math.max(0, prev.rpm - 1), tpm: Math.max(0, prev.tpm - estimatedTokens) }));
    }, 60000);
  };

  useEffect(() => {
    const storedRPD = localStorage.getItem('ai_usage_rpd');
    if (storedRPD) {
      const { date, count } = JSON.parse(storedRPD);
      if (date === new Date().toDateString()) {
        setUsage(prev => ({ ...prev, rpd: count }));
      }
    }
  }, []);

  const loadSpotlightActions = async () => {
    try {
      await mkdir("InkCaliber/notes", { baseDir: BaseDirectory.Document, recursive: true });
      await mkdir("InkCaliber/diagrams", { baseDir: BaseDirectory.Document, recursive: true });

      const notes = await readDir("InkCaliber/notes", { baseDir: BaseDirectory.Document });
      const diagramDirs = await readDir("InkCaliber/diagrams", { baseDir: BaseDirectory.Document });
      
      const noteActions: SpotlightActionData[] = notes
        .filter((n: any) => n.name.endsWith(".json"))
        .map((n: any) => ({
          id: `note-${n.name}`,
          label: n.name.replace(".json", ""),
          description: "Reference this note",
          onClick: () => selectSuggestion({ name: n.name.replace(".json", ""), type: 'note' }),
          leftSection: <HugeiconsIcon icon={Note01FreeIcons} size={18} />,
        }));

      const diagramActions: SpotlightActionData[] = [];
      const sessions = diagramDirs.filter(d => d.isDirectory);

      for (const session of sessions) {
        try {
            const branches = await readDir(`InkCaliber/diagrams/${session.name}`, { baseDir: BaseDirectory.Document });
            branches.filter(b => b.name.endsWith(".excalidraw")).forEach(branch => {
                const branchName = branch.name.replace(".excalidraw", "");
                diagramActions.push({
                    id: `diagram-${session.name}:${branchName}`,
                    label: `${session.name} (${branchName})`,
                    description: `Reference this version of ${session.name}`,
                    onClick: () => selectSuggestion({ name: session.name, type: 'diagram', branch: branchName } as any),
                    leftSection: <HugeiconsIcon icon={GitBranch} size={14} color="var(--mantine-color-violet-filled)" />,
                });
            });
        } catch { /* skip */ }
      }

      const actions = [...noteActions, ...diagramActions];
      setAllFileActions(actions);
      
      // Delay open slightly to ensure state is synchronized
      setTimeout(() => spotlight.open(), 50);
    } catch (err) {
      console.error("Failed to load spotlight actions", err);
    }
  };

  const [allFileActions, setAllFileActions] = useState<SpotlightActionData[]>([]);

  const loadSystemPrompts = async () => {
    try {
      const promptsFolder = "InkCaliber/system-prompts";
      await mkdir(promptsFolder, { baseDir: BaseDirectory.Document, recursive: true });
      
      let prompts: SystemPrompt[] = [];
      try {
        const content = await readTextFile(`${promptsFolder}/prompts.json`, { baseDir: BaseDirectory.Document });
        const data = JSON.parse(content);
        prompts = data.prompts || [];
        setSystemPrompts(prompts);
      } catch {
        // Create default prompts if file doesn't exist
        prompts = [
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
        setSystemPrompts(prompts);
        await writeTextFile(`${promptsFolder}/prompts.json`, JSON.stringify({ prompts }, null, 2), { baseDir: BaseDirectory.Document });
      }

      // If this is a new chat (initialFile is null) or systemPrompt is "default", use the default prompt from file
      if (!initialFile || chatData.systemPrompt === "default") {
        const defaultPrompt = prompts.find(p => p.isDefault);
        if (defaultPrompt) {
            setChatData(prev => ({ ...prev, systemPrompt: defaultPrompt.id }));
        }
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

    // Prepare context from referenced files
    let contextMessage = "";
    if (referencedFiles.length > 0) {
      contextMessage = "### CONTEXT FROM REFERENCED FILES:\n\n";
      referencedFiles.forEach(file => {
        const branchInfo = file.branch ? ` (Branch: ${file.branch})` : "";
        contextMessage += `FILE: [${file.name}]${branchInfo} (${file.type.toUpperCase()})\nCONTENT: ${file.content}\n---\n`;
      });
      contextMessage += "\n### END OF CONTEXT\n\n";
    }

    const finalUserMessage = contextMessage + userMessage;

    const aiService = createAIService(provider, { apiKey });
    return await aiService.sendMessage(finalUserMessage, history, systemPromptContent);
  };

  const selectSuggestion = async (suggestion: { name: string; type: 'note' | 'diagram'; branch?: string }) => {
    try {
      const folder = suggestion.type === 'note' ? "InkCaliber/notes" : "InkCaliber/diagrams";
      const path = suggestion.type === 'note' 
        ? `${folder}/${suggestion.name}.json` 
        : `${folder}/${suggestion.name}/${suggestion.branch}.excalidraw`;
        
      const content = await readTextFile(path, { baseDir: BaseDirectory.Document });
      
      let textContent = "";
      if (suggestion.type === 'note') {
        const parsed = JSON.parse(content);
        textContent = tiptapToText(parsed);
      } else {
        textContent = content; // Excalidraw JSON is already a string
      }

      setReferencedFiles(prev => {
        const existing = prev.filter(f => f.name !== suggestion.name || f.branch !== suggestion.branch);
        return [...existing, { ...suggestion, content: textContent } as any];
      });
    } catch (err) {
        console.error("Failed to load reference content", err);
    }
  };

  const openFileSelect = async () => {
    try {
      await mkdir("InkCaliber/notes", { baseDir: BaseDirectory.Document, recursive: true });
      await mkdir("InkCaliber/diagrams", { baseDir: BaseDirectory.Document, recursive: true });
      
      const notes = await readDir("InkCaliber/notes", { baseDir: BaseDirectory.Document });
      const diagramDirs = await readDir("InkCaliber/diagrams", { baseDir: BaseDirectory.Document });
      
      const noteFiles = notes.filter((n: any) => n.name.endsWith(".json")).map((n: any) => ({ 
        name: n.name.replace(".json", ""), 
        type: 'note' as const 
      }));

      const diagramSessions = await Promise.all(diagramDirs.filter(d => d.isDirectory).map(async (d: any) => {
        try {
            const branches = await readDir(`InkCaliber/diagrams/${d.name}`, { baseDir: BaseDirectory.Document });
            return {
                name: d.name,
                type: 'diagram' as const,
                branches: branches.filter(b => b.name.endsWith(".excalidraw")).map(b => b.name.replace(".excalidraw", ""))
            };
        } catch {
            return null;
        }
      }));
      
      setAvailableFiles([...noteFiles, ...(diagramSessions.filter(Boolean) as any)]);
      setFileSelectModalOpened(true);
    } catch (err) {
      console.error("Failed to load files", err);
    }
  };

  const handleConfirmFileSelection = async () => {
    const newReferences: { name: string; type: 'note' | 'diagram'; content: string; branch?: string }[] = [];

    for (const id of selectedFileIds) {
      try {
        if (id.startsWith('note-')) {
            const fileName = id.replace('note-', '');
            const content = await readTextFile(`InkCaliber/notes/${fileName}.json`, { baseDir: BaseDirectory.Document });
            const parsed = JSON.parse(content);
            newReferences.push({ name: fileName, type: 'note', content: tiptapToText(parsed) });
        } else if (id.startsWith('diagram-')) {
            const parts = id.replace('diagram-', '').split(':'); // Format: diagram-[session]:[branch]
            const sessionName = parts[0];
            const branchName = parts[1];
            const content = await readTextFile(`InkCaliber/diagrams/${sessionName}/${branchName}.excalidraw`, { baseDir: BaseDirectory.Document });
            newReferences.push({ name: sessionName, type: 'diagram', content, branch: branchName });
        }
      } catch (err) {
        console.error(`Failed to load ${id}`, err);
      }
    }

    setReferencedFiles(prev => {
        const existing = prev.filter(p => !newReferences.some(n => n.name === p.name && n.branch === p.branch));
        return [...existing, ...newReferences];
    });
    setFileSelectModalOpened(false);
    setSelectedFileIds([]);
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
        currentPrompt?.content // This will now be used as systemInstruction in the service
      );

      updateQuota(userMessage.content + aiResponse);

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
      
      // Clear referenced files after sending
      setReferencedFiles([]);
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

  const startEditing = (index: number, content: string) => {
    setEditingIndex(index);
    setEditContent(content);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      handleMessageEdit(editingIndex, editContent);
      setEditingIndex(null);
      setEditContent("");
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditContent("");
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

  const handleSetDefaultPrompt = async (promptId: string) => {
    const updatedPrompts = systemPrompts.map(p => ({
      ...p,
      isDefault: p.id === promptId
    }));
    setSystemPrompts(updatedPrompts);

    try {
      const promptsFolder = "InkCaliber/system-prompts";
      await writeTextFile(`${promptsFolder}/prompts.json`, JSON.stringify({ prompts: updatedPrompts }, null, 2), { baseDir: BaseDirectory.Document });
    } catch (e) {
      console.error("Failed to set default prompt", e);
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
          <Group gap="sm">
            {currentPrompt && (
                <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1 }}>
                System: {currentPrompt.content}
                </Text>
            )}
            <Group gap={4}>
                <Tooltip label={`RPM Usage: ${usage.rpm}/${limits.rpm}`}>
                    <Badge variant="dot" size="sm" color={usage.rpm >= limits.rpm ? "red" : usage.rpm >= limits.rpm * 0.8 ? "orange" : "gray"}>RPM</Badge>
                </Tooltip>
                <Tooltip label={`TPM Usage: ${usage.tpm}/${limits.tpm}`}>
                    <Badge variant="dot" size="sm" color={usage.tpm >= limits.tpm ? "red" : usage.tpm >= limits.tpm * 0.8 ? "orange" : "gray"}>TPM</Badge>
                </Tooltip>
                <Tooltip label={`RPD Usage: ${usage.rpd}/${limits.rpd}`}>
                    <Badge variant="dot" size="sm" color={usage.rpd >= limits.rpd ? "red" : usage.rpd >= limits.rpd * 0.8 ? "orange" : "gray"}>RPD</Badge>
                </Tooltip>
                <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => setQuotaModalOpened(true)}><HugeiconsIcon icon={AlertCircle} size={14} /></ActionIcon>
            </Group>
          </Group>
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
                <Paper key={index} p="md" radius="md" withBorder bg={message.role === 'user' ? (theme === 'dark' ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-blue-0)') : (theme === 'dark' ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-0)')} style={{ position: 'relative' }}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <HugeiconsIcon icon={message.role === 'user' ? UserFreeIcons : AiChat01FreeIcons} size={20} color={message.role === 'user' ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-green-5)'} />
                      <Badge size="sm" color={message.role === 'user' ? 'blue' : 'green'}>
                        {message.role === 'user' ? 'You' : provider?.toUpperCase()}
                      </Badge>
                      <Text size="xs" c="dimmed">{new Date(message.timestamp).toLocaleString()}</Text>
                    </Group>
                    
                    {editingIndex !== index && (
                      <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => startEditing(index, message.content)}>
                        <HugeiconsIcon icon={PencilEdit01FreeIcons} size={14} />
                      </ActionIcon>
                    )}
                  </Group>

                  {editingIndex === index ? (
                    <Stack gap="xs">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autosize
                        minRows={2}
                        variant="filled"
                      />
                      <Group justify="flex-end" gap="xs">
                        <ActionIcon color="gray" variant="light" onClick={cancelEdit}>
                          <HugeiconsIcon icon={Cancel01FreeIcons} size={16} />
                        </ActionIcon>
                        <ActionIcon color="green" variant="filled" onClick={saveEdit}>
                          <HugeiconsIcon icon={CheckmarkCircle01FreeIcons} size={16} />
                        </ActionIcon>
                      </Group>
                    </Stack>
                  ) : (
                    <Box style={{ 
                        fontSize: 'var(--mantine-font-size-sm)', 
                        lineHeight: 'var(--mantine-line-height-sm)',
                        '& p:first-of-type': { marginTop: 0 },
                        '& p:last-of-type': { marginBottom: 0 }
                    }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <CodeHighlight
                                code={String(children).replace(/\n$/, '')}
                                language={match[1]}
                                withCopyButton
                                mt="sm"
                                mb="sm"
                              />
                            ) : (
                              <code className={className} {...props} style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px' }}>
                                {children}
                              </code>
                            );
                          },
                          p: ({ children }) => <Box mb="xs" style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{children}</Box>,
                          ul: ({ children }) => <Box component="ul" style={{ paddingLeft: '20px', marginBottom: '10px' }}>{children}</Box>,
                          ol: ({ children }) => <Box component="ol" style={{ paddingLeft: '20px', marginBottom: '10px' }}>{children}</Box>,
                          li: ({ children }) => <Box component="li" style={{ marginBottom: '5px' }}>{children}</Box>,
                          h1: ({ children }) => <Title order={1} size="h3" mb="xs" mt="sm">{children}</Title>,
                          h2: ({ children }) => <Title order={2} size="h4" mb="xs" mt="sm">{children}</Title>,
                          h3: ({ children }) => <Title order={3} size="h5" mb="xs" mt="sm">{children}</Title>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </Box>
                  )}
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
          <Stack gap="xs" style={{ maxWidth: 800, margin: '0 auto' }}>
            {referencedFiles.length > 0 && (
                <Group gap="xs">
                    {referencedFiles.map(file => (
                        <Badge 
                            key={file.branch ? `${file.name}-${file.branch}` : file.name} 
                            variant="light" 
                            color={file.type === 'note' ? 'blue' : 'violet'}
                            rightSection={
                                <ActionIcon size="xs" color="gray" variant="transparent" onClick={() => setReferencedFiles(prev => prev.filter(f => f.name !== file.name || f.branch !== file.branch))}>
                                    <HugeiconsIcon icon={Cancel01FreeIcons} size={10} />
                                </ActionIcon>
                            }
                        >
                            <HugeiconsIcon icon={file.type === 'note' ? Note01FreeIcons : DashboardSquare01FreeIcons} size={10} style={{ marginRight: 4 }} />
                            {file.name}{file.branch ? ` (${file.branch})` : ""}
                        </Badge>
                    ))}
                </Group>
            )}
            
            <Group gap="xs">
                <Tooltip label="Reference Files">
                    <ActionIcon size="lg" variant="light" color="violet" onClick={openFileSelect}>
                        <HugeiconsIcon icon={Attachment01FreeIcons} />
                    </ActionIcon>
                </Tooltip>

                <TextInput
                    id="chat-input"
                    placeholder="Type your message... (use Alt to search files)"
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
          </Stack>
        </Box>
      </Box>

      {/* System Prompts Modal */}
      <Modal opened={promptModalOpened} onClose={() => setPromptModalOpened(false)} title="Manage System Prompts" centered size="lg">
        <Stack>
          <Divider label="Existing Prompts" />
          {systemPrompts.map(prompt => (
            <Paper key={prompt.id} p="sm" withBorder>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <Text fw={700}>{prompt.name}</Text>
                    {prompt.isDefault && <Badge size="sm" color="violet">Default</Badge>}
                </Group>
                {!prompt.isDefault && (
                    <Button variant="subtle" size="xs" onClick={() => handleSetDefaultPrompt(prompt.id)}>
                        Set as Default
                    </Button>
                )}
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
      {/* File Selection Modal */}
      <Modal opened={fileSelectModalOpened} onClose={() => setFileSelectModalOpened(false)} title="Select Files to Reference" centered radius="md" size="lg">
        <Stack gap="xs">
          <Tabs defaultValue="notes" color="violet" variant="outline" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab value="notes" leftSection={<HugeiconsIcon icon={Note01FreeIcons} size={16} />}>Notes</Tabs.Tab>
              <Tabs.Tab value="diagrams" leftSection={<HugeiconsIcon icon={DashboardSquare01FreeIcons} size={16} />}>Diagrams</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="notes">
              <ScrollArea.Autosize mah={400}>
                <Stack gap={4}>
                  {availableFiles.filter(f => f.type === 'note').map(file => (
                    <UnstyledButton 
                        key={`note-${file.name}`} 
                        p="xs" 
                        onClick={() => {
                            const id = `note-${file.name}`;
                            setSelectedFileIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
                        }}
                        style={{ borderRadius: 'var(--mantine-radius-sm)', '&:hover': { backgroundColor: 'var(--mantine-color-gray-0)' } }}
                    >
                        <Group justify="space-between">
                            <Group gap="xs">
                                <HugeiconsIcon icon={Note01FreeIcons} size={18} />
                                <Text size="sm">{file.name}</Text>
                            </Group>
                            <Checkbox 
                                checked={selectedFileIds.includes(`note-${file.name}`)} 
                                readOnly 
                                tabIndex={-1}
                                styles={{ input: { cursor: 'pointer' } }}
                            />
                        </Group>
                    </UnstyledButton>
                  ))}
                  {availableFiles.filter(f => f.type === 'note').length === 0 && <Text c="dimmed" ta="center" py="xl">No notes found.</Text>}
                </Stack>
              </ScrollArea.Autosize>
            </Tabs.Panel>

            <Tabs.Panel value="diagrams">
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {availableFiles.filter(f => f.type === 'diagram').map(file => (
                    <Box key={`diagram-section-${file.name}`}>
                      <Text size="xs" fw={700} c="violet" mb={4} mt="xs" pl="xs">
                        {file.name}
                      </Text>
                      <Stack gap={4}>
                        {file.branches?.map(branch => (
                          <UnstyledButton 
                              key={`branch-${file.name}-${branch}`}
                              p="xs" 
                              onClick={() => {
                                  const id = `diagram-${file.name}:${branch}`;
                                  setSelectedFileIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
                              }}
                              style={{ borderRadius: 'var(--mantine-radius-sm)', '&:hover': { backgroundColor: 'var(--mantine-color-gray-0)' } }}
                          >
                              <Group justify="space-between">
                                  <Group gap="xs">
                                      <HugeiconsIcon icon={GitBranch} size={14} color="var(--mantine-color-violet-filled)" />
                                      <Text size="sm">{branch}</Text>
                                  </Group>
                                  <Checkbox 
                                      checked={selectedFileIds.includes(`diagram-${file.name}:${branch}`)} 
                                      readOnly 
                                      tabIndex={-1}
                                      styles={{ input: { cursor: 'pointer' } }}
                                  />
                              </Group>
                          </UnstyledButton>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                  {availableFiles.filter(f => f.type === 'diagram').length === 0 && <Text c="dimmed" ta="center" py="xl">No diagrams found.</Text>}
                </Stack>
              </ScrollArea.Autosize>
            </Tabs.Panel>
          </Tabs>

          <Button fullWidth mt="md" color="violet" onClick={handleConfirmFileSelection} disabled={selectedFileIds.length === 0}>
            Reference Selected Files ({selectedFileIds.length})
          </Button>
        </Stack>
      </Modal>

      {/* Quota Details Modal */}
      <Modal opened={quotaModalOpened} onClose={() => setQuotaModalOpened(false)} title="AI API Quota Details" centered radius="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">Based on the Free Tier limits for Gemini 1.5 Flash:</Text>
          
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb={4}>
              <Text fw={700}>RPM (Requests Per Minute)</Text>
              <Badge color={usage.rpm >= limits.rpm ? "red" : "blue"}>{usage.rpm} / {limits.rpm}</Badge>
            </Group>
            <Text size="xs" c="dimmed">Maximum requests allowed per minute.</Text>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb={4}>
              <Text fw={700}>TPM (Tokens Per Minute)</Text>
              <Badge color={usage.tpm >= limits.tpm ? "red" : "blue"}>{usage.tpm.toLocaleString()} / {limits.tpm.toLocaleString()}</Badge>
            </Group>
            <Text size="xs" c="dimmed">Total input and output tokens allowed per minute.</Text>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb={4}>
              <Text fw={700}>RPD (Requests Per Day)</Text>
              <Badge color={usage.rpd >= limits.rpd ? "red" : "blue"}>{usage.rpd} / {limits.rpd}</Badge>
            </Group>
            <Text size="xs" c="dimmed">Total requests allowed per day across the entire team/key.</Text>
          </Paper>

          <Alert color="blue" icon={<HugeiconsIcon icon={AlertCircle} size={18} />} title="Note">
            <Text size="xs">These limits are tracked locally by InkCaliber. Actual API behavior may vary based on Google's specific server state.</Text>
          </Alert>
        </Stack>
      </Modal>

      <Spotlight
        actions={allFileActions}
        nothingFound="No files found..."
        highlightQuery
        searchProps={{
          leftSection: <HugeiconsIcon icon={Search01FreeIcons} size={18} />,
          placeholder: "Search notes or diagrams...",
        }}
        radius="md"
        maxHeight={350}
      />
    </Shell>
  );
}
