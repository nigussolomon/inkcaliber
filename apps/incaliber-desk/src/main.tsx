import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core'
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getStoredTheme } from './theme';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <MantineProvider defaultColorScheme={getStoredTheme().theme}>
    <App />
  </MantineProvider>,
);
