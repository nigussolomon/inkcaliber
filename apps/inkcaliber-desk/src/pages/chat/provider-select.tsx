import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Container, Title, Text, SimpleGrid, Card, Stack, Group, Badge, ActionIcon, ThemeIcon, Button } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiChat01FreeIcons, Settings02FreeIcons, Home02FreeIcons, CheckmarkCircle01FreeIcons, AlertCircle, GoogleFreeIcons, MoonFreeIcons, SunFreeIcons } from "@hugeicons/core-free-icons";
import { AIProvider, hasAPIKey } from "../../services/ai-service";
import { getStoredTheme, setStoredTheme } from "../../theme";

interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  icon: any;
  color: string;
  status: "ready" | "needs-config";
}

export default function ProviderSelect() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme().theme);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = () => {
    const providerList: ProviderInfo[] = [
      {
        id: "gemini",
        name: "Google Gemini",
        description: "Google's most capable AI model",
        icon: GoogleFreeIcons,
        color: "blue",
        status: hasAPIKey("gemini") ? "ready" : "needs-config"
      },
      {
        id: "chatgpt",
        name: "ChatGPT",
        description: "OpenAI's conversational AI (Coming Soon)",
        icon: AiChat01FreeIcons,
        color: "green",
        status: hasAPIKey("chatgpt") ? "ready" : "needs-config"
      },
      {
        id: "claude",
        name: "Claude",
        description: "Anthropic's helpful AI assistant (Coming Soon)",
        icon: AiChat01FreeIcons,
        color: "violet",
        status: hasAPIKey("claude") ? "ready" : "needs-config"
      }
    ];
    setProviders(providerList);
  };

  const handleProviderSelect = (provider: ProviderInfo) => {
    if (provider.id !== "gemini") {
      alert(`${provider.name} integration is coming soon! Please use Gemini for now.`);
      return;
    }

    if (provider.status === "needs-config") {
      navigate("/chat/settings");
    } else {
      navigate(`/chat/${provider.id}`);
    }
  };

  return (
    <Container size="md" style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
      
      <Group style={{ position: "absolute", top: 20, right: 20 }} gap="xs">
        <ActionIcon 
          radius="md" 
          size="lg" 
          onClick={() => navigate('/chat/settings')} 
          color="gray" 
          variant="subtle"
        >
          <HugeiconsIcon icon={Settings02FreeIcons} size={20} />
        </ActionIcon>

        <ActionIcon 
          radius="md" 
          size="lg" 
          onClick={() => { setTheme(theme == "dark" ? "light" : "dark"); setStoredTheme(theme == "dark" ? "light" : "dark") }} 
          color={theme === "dark" ? "white" : "black"} 
          variant={theme === "dark" ? "white" : "filled"}
        >
          <HugeiconsIcon color={theme === "dark" ? "black" : "white"} icon={theme !== "dark" ? MoonFreeIcons : SunFreeIcons} size={16} />
        </ActionIcon>

        <ActionIcon 
          radius="md" 
          size="lg" 
          onClick={() => navigate('/')} 
          color="gray" 
          variant="subtle"
        >
          <HugeiconsIcon icon={Home02FreeIcons} size={20} />
        </ActionIcon>
      </Group>

      <Stack gap="xl">
        <Stack gap="xs" align="center" mb="xl">
          <Title style={{ fontSize: 42, fontWeight: 900, background: "linear-gradient(45deg, #15aabf, #7950f2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Select AI Provider
          </Title>
          <Text c="dimmed" size="lg">Choose your AI assistant to start chatting</Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {providers.map((provider) => (
            <Card 
              key={provider.id} 
              shadow="sm" 
              padding="xl" 
              radius="md" 
              withBorder 
              style={{ 
                cursor: 'pointer', 
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative'
              }} 
              onClick={() => handleProviderSelect(provider)}
              onMouseEnter={(e) => { 
                e.currentTarget.style.transform = 'translateY(-5px)'; 
                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.boxShadow = 'none'; 
              }}
            >
              {provider.status === "ready" && (
                <Badge 
                  size="sm" 
                  color="green" 
                  variant="filled"
                  style={{ position: 'absolute', top: 10, right: 10 }}
                  leftSection={<HugeiconsIcon icon={CheckmarkCircle01FreeIcons} size={12} />}
                >
                  Ready
                </Badge>
              )}

              {provider.status === "needs-config" && (
                <Badge 
                  size="sm" 
                  color="orange" 
                  variant="filled"
                  style={{ position: 'absolute', top: 10, right: 10 }}
                  leftSection={<HugeiconsIcon icon={AlertCircle} size={12} />}
                >
                  Setup Required
                </Badge>
              )}

              <Stack gap="md" align="center">
                <ThemeIcon size={64} radius="md" variant="light" color={provider.color}>
                  <HugeiconsIcon icon={provider.icon} size={32} />
                </ThemeIcon>
                
                <Stack gap={4} align="center">
                  <Text fw={700} size="lg">{provider.name}</Text>
                  <Text size="sm" c="dimmed" ta="center" style={{ lineHeight: 1.4 }}>
                    {provider.description}
                  </Text>
                </Stack>

                <Button 
                  variant={provider.status === "ready" ? "filled" : "light"} 
                  color={provider.color} 
                  fullWidth
                  disabled={provider.id !== "gemini"}
                >
                  {provider.status === "ready" ? "Continue" : "Configure"}
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Text size="xs" c="dimmed" ta="center" mt="md">
          API keys are stored locally on your device
        </Text>
      </Stack>
    </Container>
  );
}
