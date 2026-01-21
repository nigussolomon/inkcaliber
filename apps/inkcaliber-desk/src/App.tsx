import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import ActiveSession from "./pages/active";
import FileGallery from "./pages";

const router = createBrowserRouter([
  {
    path: "/",
    element: <FileGallery/>,
  },
  {
    path: "/active",
    element:
      <ActiveSession/>
  },
]);

export default function App() {
  return (
    <RouterProvider router={router} />
  );
}
