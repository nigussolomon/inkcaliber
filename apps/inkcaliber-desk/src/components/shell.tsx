import { AppShell, Avatar, Stack } from '@mantine/core';

export function Shell({ children, menus }: { children: React.ReactNode, menus: React.ReactNode }) {
  return (
    <AppShell
      navbar={{
        width: 55,
        breakpoint: 'sm',
      }}
    >

      <AppShell.Navbar>
        <Stack h="99%" justify='space-between' align='center'>
          <Stack my="xs" align='center'>
            {menus}
          </Stack>
          <Avatar radius="md" name='Nigus Solomon'></Avatar>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
