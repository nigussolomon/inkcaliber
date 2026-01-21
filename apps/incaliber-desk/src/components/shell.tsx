import { AppShell, Burger, Stack } from '@mantine/core';
import { useNavigate } from 'react-router';

export function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();


  return (
    <AppShell
      navbar={{
        width: 70,
        breakpoint: 'sm',
      }}
    >

      <AppShell.Navbar>
        <Stack my="xs" align='center'>
          <Burger opened={false} onClick={() => navigate('/')} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
