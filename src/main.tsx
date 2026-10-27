import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "./styles.css";
import { App } from "./App";

if (!("__TAURI_INTERNALS__" in window)) document.body.classList.add("web");

createRoot(document.getElementById("root")!).render(
  <App />,
);
