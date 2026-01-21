import '@mantine/core/styles.css';
import "./index.css";
import { MantineProvider } from '@mantine/core'
import ReactDOM from "react-dom/client";
import App from "./App";
import { getStoredTheme } from './theme';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <MantineProvider defaultColorScheme={getStoredTheme().theme} theme={{fontFamily: "DM Sans, sans-serif", defaultRadius: "md"}}>
    <App />
  </MantineProvider>,
);
