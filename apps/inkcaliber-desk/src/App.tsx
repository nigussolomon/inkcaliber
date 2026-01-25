import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import ActiveSession from "./pages/diagrams/active";
import FileGallery from "./pages/diagrams";
import LandingPage from "./pages/landing";
import NotesGallery from "./pages/notes";
import NoteEditor from "./pages/notes/active";

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
  }
]);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}
