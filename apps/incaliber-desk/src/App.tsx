import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import ActiveSession from "./pages/active";
import FileGallery from "./pages";
import { Shell } from "./components/shell";

const router = createBrowserRouter([
  {
    path: "/",
    element: <FileGallery/>,
  },
  {
    path: "/active",
    element: <Shell>
      <ActiveSession/>
    </Shell>,
  },
]);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}
