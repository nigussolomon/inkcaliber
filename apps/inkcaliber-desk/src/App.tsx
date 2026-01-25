import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import ActiveSession from "./pages/diagrams/active";
import FileGallery from "./pages/diagrams";
import LandingPage from "./pages/landing";
import NotesGallery from "./pages/notes";
import NoteEditor from "./pages/notes/active";
import ChatGallery from "./pages/chat";
import ActiveChat from "./pages/chat/active";
import ProviderSelect from "./pages/chat/provider-select";
import ChatSettings from "./pages/chat/settings";
import PromptManagement from "./pages/chat/prompts";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage/>,
  },
  {
    path: "/diagrams",
    element: <FileGallery/>,
  },
  {
    path: "/diagrams/active",
    element: <ActiveSession/>
  },
  {
    path: "/notes",
    element: <NotesGallery/>
  },
  {
    path: "/notes/active",
    element: <NoteEditor/>
  },
  {
    path: "/chat",
    element: <ProviderSelect/>
  },
  {
    path: "/chat/settings",
    element: <ChatSettings/>
  },
  {
    path: "/chat/:provider/prompts",
    element: <PromptManagement/>
  },
  {
    path: "/chat/:provider",
    element: <ChatGallery/>
  },
  {
    path: "/chat/:provider/active",
    element: <ActiveChat/>
  }
]);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}
