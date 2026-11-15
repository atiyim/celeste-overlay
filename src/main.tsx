import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "./styles.css";
import { App } from "./App";
import { initFreeze } from "./freeze";
import { SpikeStrip } from "./SpikeStrip";

// "#spike": oyunun üstünde duran küçük spike şeridi penceresi. Ana uygulama orada hiç çalışmaz.
if (location.hash === "#spike") {
  document.documentElement.classList.add("spikewin");
  createRoot(document.getElementById("root")!).render(<SpikeStrip />);
} else {
  if (!("__TAURI_INTERNALS__" in window)) document.body.classList.add("web");
  initFreeze();
  createRoot(document.getElementById("root")!).render(<App />);
}
