import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Android uygulamasının arayüzü (mobile/). Masaüstü arayüzündeki ortak dosyaları (src/assets.ts, src/types.ts…) kullanır.
export default defineConfig({
  root: "mobile",
  plugins: [react()],
  clearScreen: false,
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 1421, strictPort: true, host: true, watch: { ignored: ["**/src-tauri/**"] } },
});
