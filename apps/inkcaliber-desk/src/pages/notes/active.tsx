import { useState, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import { RichTextEditor, Link, } from "@mantine/tiptap";
import { useSearchParams, useNavigate } from "react-router";
import { writeTextFile, readTextFile, mkdir, BaseDirectory, rename, stat } from "@tauri-apps/plugin-fs";
import { TextInput, Group, Box, ActionIcon, Tooltip, Stack, Paper, Menu, Portal, Divider } from "@mantine/core";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01FreeIcons, FloppyDiskFreeIcons, Loading01FreeIcons, AlertCircle, Copy01FreeIcons, Scissor01FreeIcons, ClipboardFreeIcons, TextBoldFreeIcons, TextItalicFreeIcons, EraserFreeIcons } from "@hugeicons/core-free-icons";
import { Shell } from "../../components/shell";
import { getStoredTheme, setStoredTheme } from "../../theme";
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Superscript from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';


export default function NoteEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFile = searchParams.get("file");

  const [fileName, setFileName] = useState(initialFile || "");
  const [originalFileName, setOriginalFileName] = useState(initialFile || "");
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "error" | "unsaved">("saved");
  const folder = "InkCaliber/notes";
  const [theme, setTheme] = useState(getStoredTheme().theme);

  // Refs for async access to avoid stale closures
  const fileNameRef = useRef(fileName);
  const originalFileNameRef = useRef(originalFileName);

  // Keep refs in sync
  useEffect(() => { fileNameRef.current = fileName; }, [fileName]);
  useEffect(() => { originalFileNameRef.current = originalFileName; }, [originalFileName]);

  // Context Menu State
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuOpened, setMenuOpened] = useState(false);

  const editor = useEditor({
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({ link: false }),
        Link,
        Superscript,
        SubScript,
        Highlight,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ],
    content: "",
    onUpdate: ({ editor }) => {
      setSyncStatus("unsaved");
      debouncedSave(editor.getJSON());
    },
    });


  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialFile) {
      loadNote(initialFile);
      setOriginalFileName(initialFile);
      originalFileNameRef.current = initialFile;
      setFileName(initialFile);
      fileNameRef.current = initialFile;
    }
  }, [initialFile, editor]);

  const loadNote = async (name: string) => {
    if (!editor) return;
    try {
      const content = await readTextFile(`${folder}/${name}.json`, { baseDir: BaseDirectory.Document });
      const json = JSON.parse(content);
      if (editor.isEmpty) {
           editor.commands.setContent(json);
      }
    } catch (e) {
      console.error("Failed to load note", e);
    }
  };

  const saveNote = async (jsonContent: any) => {
    const currentFileName = fileNameRef.current;
    const currentOriginalName = originalFileNameRef.current;

    if (!currentFileName.trim()) return;
    setSyncStatus("syncing");

    try {
      await mkdir(folder, { baseDir: BaseDirectory.Document, recursive: true });
      if (currentOriginalName && currentFileName !== currentOriginalName) {
        try {
             // Check if target exists
             try {
                 await stat(`${folder}/${currentFileName}.json`, { baseDir: BaseDirectory.Document });
                 // If success, file exists. Prevent overwrite.
                 console.error("Target file exists, aborting rename");
                 setSyncStatus("error");
                 alert("A note with this name already exists.");
                 return;
             } catch {
                 // File does not exist, safe to rename
             }

             await rename(`${folder}/${currentOriginalName}.json`, `${folder}/${currentFileName}.json`, {
                 oldPathBaseDir: BaseDirectory.Document,
                 newPathBaseDir: BaseDirectory.Document
             });
             // Ref update handled by effect, but crucial immediate update for logic continuity if needed
             setOriginalFileName(currentFileName);
             originalFileNameRef.current = currentFileName;
             setSearchParams({ file: currentFileName });
        } catch (renameError) {
            console.error("Rename failed", renameError);
        }
      }
      await writeTextFile(`${folder}/${currentFileName}.json`, JSON.stringify(jsonContent), { baseDir: BaseDirectory.Document });
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

  const debouncedSave = (jsonContent: any) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveNote(jsonContent);
    }, 1000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setFileName(newTitle);
      fileNameRef.current = newTitle;
      setSyncStatus("unsaved");
      if (editor) debouncedSave(editor.getJSON());
  };

  // Context Menu Handler
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuOpened(true);
  };

  // Close menu on click anywhere
  useEffect(() => {
    const handleClick = () => setMenuOpened(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);



  return (
    <Shell menus={
        <Stack align="center" gap="md">
            <Tooltip label="Back to Notes" position="right">
                <ActionIcon size="xl" color="gray" variant="subtle" radius="md" onClick={() => navigate('/notes')}>
                    <HugeiconsIcon icon={ArrowLeft01FreeIcons} />
                </ActionIcon>
            </Tooltip>
             <Box style={{ width: '60%', height: '1px', backgroundColor: 'var(--mantine-color-gray-3)' }} />
             <Tooltip color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'blue' : 'green'} label={`Sync: ${syncStatus}`} position="right">
                <ActionIcon size="lg" variant="light" color={syncStatus === 'error' ? 'red' : syncStatus === 'syncing' ? 'blue' : 'green'} radius="md">
                    <HugeiconsIcon icon={syncStatus === 'syncing' ? Loading01FreeIcons : syncStatus === 'error' ? AlertCircle : FloppyDiskFreeIcons} />
                </ActionIcon>
            </Tooltip>
        </Stack>
    }>
        <RichTextEditor editor={editor} style={{ border: 'none', display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Header / Toolbar Area */}
            <Box style={{ borderBottom: '1px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)', zIndex: 10 }}>
                <Group px="md" pt="xs" gap="xs">
                     <TextInput
                        variant="unstyled"
                        size="md"
                        placeholder="Untitled Note"
                        value={fileName}
                        onChange={handleTitleChange}
                        styles={{ input: { fontSize: 18, fontWeight: 700, paddingLeft: 0, height: 30 } }}
                        style={{ flex: 1, maxWidth: 400 }}
                    />
                </Group>

                <Divider/>

                <RichTextEditor.Toolbar sticky stickyOffset="var(--docs-header-height)">
                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.Bold  />
                          <RichTextEditor.Underline />
                          <RichTextEditor.Strikethrough />
                          <RichTextEditor.ClearFormatting />
                          <RichTextEditor.Highlight />
                          <RichTextEditor.Code />
                        </RichTextEditor.ControlsGroup>

                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.H1 />
                          <RichTextEditor.H2 />
                          <RichTextEditor.H3 />
                          <RichTextEditor.H4 />
                          <RichTextEditor.H5 />
                          <RichTextEditor.H6 />
                        </RichTextEditor.ControlsGroup>

                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.Blockquote />
                          <RichTextEditor.Hr />
                          <RichTextEditor.BulletList />
                          <RichTextEditor.OrderedList />
                          <RichTextEditor.Subscript />
                          <RichTextEditor.Superscript />
                        </RichTextEditor.ControlsGroup>

                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.Link />
                          <RichTextEditor.Unlink />
                        </RichTextEditor.ControlsGroup>

                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.AlignLeft />
                          <RichTextEditor.AlignCenter />
                          <RichTextEditor.AlignJustify />
                          <RichTextEditor.AlignRight />
                        </RichTextEditor.ControlsGroup>

                        <RichTextEditor.ControlsGroup>
                          <RichTextEditor.Undo />
                          <RichTextEditor.Redo />
                        </RichTextEditor.ControlsGroup>
                      </RichTextEditor.Toolbar>

            </Box>

            {/* Document Canvas */}
            <Box
              bg={theme === 'dark' ? "var(--mantine-color-dark-8)" : "var(--mantine-color-gray-1)"}
              style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}
              onContextMenu={handleContextMenu}
            >
                <Paper
                    shadow="sm"
                    p={60}
                    style={{
                        width: '100%',
                        maxWidth: '850px',
                        minHeight: '1100px',
                        // backgroundColor: theme === 'dark' ? "var(--mantine-color-dark-6)" : "white",
                        color: theme === 'dark' ? "var(--mantine-color-white)" : "black",
                        borderRadius: '4px'
                    }}
                >
                     <RichTextEditor.Content style={{ minHeight: '800px' }} />
                </Paper>
            </Box>
        </RichTextEditor>

        {/* Custom Context Menu */}
        <Portal>
             <Menu opened={menuOpened} onChange={setMenuOpened}>
                <Menu.Dropdown style={{
                        position: 'fixed',
                        top: menuPosition.y,
                        left: menuPosition.x,
                        zIndex: 9999,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                    <Menu.Label>Edit</Menu.Label>
                    <Menu.Item leftSection={<HugeiconsIcon icon={Scissor01FreeIcons} size={14}/>} onClick={() => {}}>
                        Cut
                    </Menu.Item>
                    <Menu.Item leftSection={<HugeiconsIcon icon={Copy01FreeIcons} size={14}/>} onClick={() => {}}>
                        Copy
                    </Menu.Item>
                    <Menu.Item leftSection={<HugeiconsIcon icon={ClipboardFreeIcons} size={14}/>} onClick={() => navigator.clipboard.readText().then(t => editor?.commands.insertContent(t))}>
                        Paste
                    </Menu.Item>

                    <Menu.Divider />

                    <Menu.Label>Format</Menu.Label>
                    <Menu.Item leftSection={<HugeiconsIcon icon={TextBoldFreeIcons} size={14}/>} onClick={() => editor?.chain().focus().toggleBold().run()}>
                        Bold
                    </Menu.Item>
                    <Menu.Item leftSection={<HugeiconsIcon icon={TextItalicFreeIcons} size={14}/>} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                        Italic
                    </Menu.Item>
                    <Menu.Item color="red" leftSection={<HugeiconsIcon icon={EraserFreeIcons} size={14}/>} onClick={() => editor?.chain().focus().unsetAllMarks().run()}>
                        Clear Formatting
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
        </Portal>
    </Shell>
  );
}
