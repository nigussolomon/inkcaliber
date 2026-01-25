import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Container, Title, Text, Stack, Paper, Button, Group, PasswordInput, Alert, Divider } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01FreeIcons, CheckmarkCircle01FreeIcons, AlertCircle, GoogleFreeIcons } from "@hugeicons/core-free-icons";
import { AIProvider, saveAPIKey, getAPIKey, createAIService } from "../../services/ai-service";

export default function ChatSettings() {
  const navigate = useNavigate();
  const [geminiKey, setGeminiKey] = useState("");
  const [chatgptKey, setChatgptKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [testStatus, setTestStatus] = useState<{ provider: AIProvider; status: "success" | "error"; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Load existing keys
    setGeminiKey(getAPIKey("gemini") || "");
    setChatgptKey(getAPIKey("chatgpt") || "");
    setClaudeKey(getAPIKey("claude") || "");
  }, []);

  const handleSave = () => {
    if (geminiKey.trim()) saveAPIKey("gemini", geminiKey.trim());
    if (chatgptKey.trim()) saveAPIKey("chatgpt", chatgptKey.trim());
    if (claudeKey.trim()) saveAPIKey("claude", claudeKey.trim());
    
    alert("API keys saved successfully!");
  };

  const handleTest = async (provider: AIProvider, apiKey: string) => {
    if (!apiKey.trim()) {
      setTestStatus({ provider, status: "error", message: "Please enter an API key first" });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    try {
      const service = createAIService(provider, { apiKey: apiKey.trim() });
      await service.sendMessage("Hello! Please respond with a short greeting.", [], "You are a helpful assistant.");
      
      setTestStatus({ 
        provider, 
        status: "success", 
        message: "Connection successful! API key is valid." 
      });
    } catch (error: any) {
      setTestStatus({ 
        provider, 
        status: "error", 
        message: error.message || "Connection failed. Please check your API key." 
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Group>
          <Button 
            variant="subtle" 
            color="gray" 
            leftSection={<HugeiconsIcon icon={ArrowLeft01FreeIcons} size={16} />}
            onClick={() => navigate('/chat')}
          >
            Back to Provider Selection
          </Button>
        </Group>

        <Stack gap="xs">
          <Title order={2}>AI Provider Settings</Title>
          <Text c="dimmed">Configure your API keys for different AI providers</Text>
        </Stack>

        {/* Gemini Settings */}
        <Paper withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group gap="xs">
              <HugeiconsIcon icon={GoogleFreeIcons} size={24} color="var(--mantine-color-blue-5)" />
              <Title order={3}>Google Gemini</Title>
            </Group>
            
            <PasswordInput
              label="API Key"
              placeholder="Enter your Gemini API key"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              description={
                <Text size="xs" c="dimmed">
                  Get your API key from{" "}
                  <Text 
                    component="a" 
                    href="https://makersuite.google.com/app/apikey" 
                    target="_blank" 
                    c="blue" 
                    td="underline"
                    style={{ cursor: "pointer" }}
                  >
                    Google AI Studio
                  </Text>
                </Text>
              }
            />

            <Group>
              <Button 
                variant="light" 
                color="blue" 
                onClick={() => handleTest("gemini", geminiKey)}
                loading={testing}
                disabled={!geminiKey.trim()}
              >
                Test Connection
              </Button>
              <Button 
                color="blue" 
                onClick={handleSave}
                disabled={!geminiKey.trim()}
              >
                Save Key
              </Button>
            </Group>

            {testStatus && testStatus.provider === "gemini" && (
              <Alert 
                icon={<HugeiconsIcon icon={testStatus.status === "success" ? CheckmarkCircle01FreeIcons : AlertCircle} size={16} />}
                color={testStatus.status === "success" ? "green" : "red"}
              >
                {testStatus.message}
              </Alert>
            )}
          </Stack>
        </Paper>

        <Divider label="Coming Soon" />

        {/* ChatGPT Settings (Disabled) */}
        <Paper withBorder p="lg" radius="md" opacity={0.6}>
          <Stack gap="md">
            <Group gap="xs">
              <HugeiconsIcon icon={AlertCircle} size={24} color="var(--mantine-color-green-5)" />
              <Title order={3}>ChatGPT (OpenAI)</Title>
            </Group>
            
            <PasswordInput
              label="API Key"
              placeholder="Coming soon..."
              value={chatgptKey}
              onChange={(e) => setChatgptKey(e.target.value)}
              disabled
            />
            <Text size="xs" c="dimmed">ChatGPT integration coming in a future update</Text>
          </Stack>
        </Paper>

        {/* Claude Settings (Disabled) */}
        <Paper withBorder p="lg" radius="md" opacity={0.6}>
          <Stack gap="md">
            <Group gap="xs">
              <HugeiconsIcon icon={AlertCircle} size={24} color="var(--mantine-color-violet-5)" />
              <Title order={3}>Claude (Anthropic)</Title>
            </Group>
            
            <PasswordInput
              label="API Key"
              placeholder="Coming soon..."
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              disabled
            />
            <Text size="xs" c="dimmed">Claude integration coming in a future update</Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
