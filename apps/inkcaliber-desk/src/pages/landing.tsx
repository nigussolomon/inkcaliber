import { useState } from "react";
import { useNavigate } from "react-router";
import { ThemeIcon, Card, Text, SimpleGrid, Container, Title, Stack, UnstyledButton, Group, ActionIcon } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  PencilEdit01FreeIcons, 
  DashboardSquare01FreeIcons,
  ArrowRight01FreeIcons,
  MoonFreeIcons,
  SunFreeIcons
} from "@hugeicons/core-free-icons";
import { getStoredTheme, setStoredTheme } from "../theme";

export default function LandingPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme().theme);

  const apps = [
    {
      title: "Diagrams",
      description: "Create infinite canvas drawings and diagrams.",
      icon: DashboardSquare01FreeIcons,
      color: "violet",
      path: "/diagrams",
    },
    {
      title: "Notes",
      description: "Capture thoughts with a rich text editor.",
      icon: PencilEdit01FreeIcons,
      color: "blue",
      path: "/notes",
    },
  ];

  return (
    <Container size="sm" style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
      
      <ActionIcon 
        style={{ position: "absolute", top: 20, right: 20 }} 
        radius="md" 
        size="lg" 
        onClick={() => { setTheme(theme == "dark" ? "light" : "dark"); setStoredTheme(theme == "dark" ? "light" : "dark") }} 
        color={theme === "dark" ? "white" : "black"} 
        variant={theme === "dark" ? "white" : "filled"}
      >
          <HugeiconsIcon color={theme === "dark" ? "black" : "white"} icon={theme !== "dark" ? MoonFreeIcons : SunFreeIcons} size={16} />
      </ActionIcon>

      <Stack gap="xl">
        <Stack gap="xs" align="center" mb="xl">
          <Title style={{ fontSize: 42, fontWeight: 900, background: "linear-gradient(45deg, #7950f2, #15aabf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            InkCaliber
          </Title>
          <Text c="dimmed" size="lg">Select an application to start</Text>
        </Stack>

        <SimpleGrid cols={2} spacing="lg">
          {apps.map((app) => (
            <UnstyledButton key={app.title} onClick={() => navigate(app.path)}>
              <Card shadow="sm" padding="xl" radius="md" withBorder style={{ height: '100%', transition: 'transform 0.2s, box-shadow 0.2s' }} 
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <Stack gap="md" align="flex-start">
                  <ThemeIcon size={48} radius="md" variant="light" color={app.color}>
                    <HugeiconsIcon icon={app.icon} size={24} />
                  </ThemeIcon>
                  
                  <Stack gap={4}>
                    <Text fw={700} size="lg">{app.title}</Text>
                    <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                      {app.description}
                    </Text>
                  </Stack>

                  <Group gap={4} mt="auto">
                     <Text size="sm" c={app.color} fw={600}>Open App</Text>
                     <HugeiconsIcon icon={ArrowRight01FreeIcons} size={14} color={`var(--mantine-color-${app.color}-filled)`} />
                  </Group>
                </Stack>
              </Card>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
