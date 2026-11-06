import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "./mobile.css";
import { App } from "./App";

/* Arayüz hataları: bir sonraki açılışta rapor olarak gösterilir (sorunu bulmak için). */
const JS_ERR = "celeste-js-error";
const keep = (text: string) => { try { localStorage.setItem(JS_ERR, `${new Date().toISOString()}\n${text}`.slice(0, 4000)); } catch { /* */ } };
window.addEventListener("error", (e) => keep(`${e.message}\n${e.error?.stack ?? ""}`));
window.addEventListener("unhandledrejection", (e) => keep(`İşlenmemiş: ${String(e.reason?.stack ?? e.reason)}`));

class Guard extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.stack ?? e) }; }
  componentDidCatch(e: unknown) { keep(String((e as Error)?.stack ?? e)); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <main className="crash">
        <b>Bir şey ters gitti</b>
        <p>Uygulamayı yeniden başlatabilirsin. Aşağıdaki raporu kopyalayıp gönderirsen sorunu bulabiliriz.</p>
        <textarea readOnly value={this.state.err} />
        <button className="btn pri" type="button" onClick={() => location.reload()}>Yeniden başlat</button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(<Guard><App /></Guard>);
