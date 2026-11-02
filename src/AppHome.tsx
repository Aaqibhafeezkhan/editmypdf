import { useEffect, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { Link } from "react-router";
import { FilePlus2, FolderOpen, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT, ROUTES } from "./data/product.ts";
import { createBlankPdf, loadPdf } from "./pdf.ts";
import { navigate, plainClick } from "./router.ts";
import { createSession, listSessions, readySessions, removeSession, type SessionInfo } from "./session.ts";
import { LogoMark } from "./site/Logo.tsx";
import { ThemeSelect } from "./ThemeSelect.tsx";
import "./AppHome.css";

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

// The documents screen: open a PDF, start a blank page, or continue one saved in this browser.
export function AppHome() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Documents — ${PRODUCT.name}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", `Open a PDF in ${PRODUCT.name}. Files stay in this browser and each document opens at its own link.`);
    document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex, nofollow");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await readySessions();
      if (!cancelled) setSessions(listSessions());
    })();
    const refresh = () => setSessions(listSessions());
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const openFiles = async (files: File[]) => {
    const pdfs = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      setError("Choose a PDF file.");
      return;
    }
    setBusy(true);
    setError(null);
    let firstId = "";
    try {
      for (const file of pdfs) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const parsed = await loadPdf(bytes, file.name);
        await parsed.doc.cleanup();
        const id = await createSession(file.name, bytes, []);
        if (!firstId) firstId = id;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not open this PDF";
      setError(
        message.toLowerCase().includes("password")
          ? "This PDF is password protected, and the editor cannot open those."
          : "Could not open this PDF.",
      );
    } finally {
      setBusy(false);
    }
    if (firstId) navigate(ROUTES.edit(firstId));
  };

  const startBlank = async () => {
    setBusy(true);
    setError(null);
    try {
      const bytes = await createBlankPdf();
      const id = await createSession("Untitled.pdf", bytes, []);
      navigate(ROUTES.edit(id));
    } catch {
      setError("Could not start a blank page.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void openFiles([...event.dataTransfer.files]);
  };

  return (
    <div
      className="home"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="topbar">
        <div className="brand">
          <Link className="home-link" to={ROUTES.home} aria-label={`${PRODUCT.name} home`}>
            <LogoMark size={26} />
            <strong>{PRODUCT.name}</strong>
          </Link>
          <span className="file-name">Documents</span>
        </div>
        <div className="top-actions">
          <ThemeSelect />
          <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload />
            {busy ? "Opening…" : "Open a PDF"}
          </Button>
        </div>
      </header>
      <main className="home-main">
        <section
          className={dragging ? "home-drop dragging" : "home-drop"}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
        >
          <span className="home-drop-icon" aria-hidden="true">
            <FolderOpen />
          </span>
          <h1>Drop a PDF here</h1>
          <p>
            Or choose one from your computer. Each file opens at its own link in this browser, and
            nothing is uploaded.
          </p>
          <div className="home-drop-actions">
            <Button type="button" size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload />
              Choose a PDF
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => void startBlank()}>
              <FilePlus2 />
              Start with a blank page
            </Button>
          </div>
          {error && (
            <p className="home-error" role="alert">
              {error}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length > 0) void openFiles(files);
            }}
          />
        </section>

        {sessions.length > 0 && (
          <section className="home-recent" aria-labelledby="recent-heading">
            <div className="home-recent-head">
              <h2 id="recent-heading">In this browser</h2>
              <p>Saved on this device. Open several in separate tabs. Remove one to delete its file and edits.</p>
            </div>
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <a
                    href={ROUTES.edit(session.id)}
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      navigate(ROUTES.edit(session.id));
                    }}
                  >
                    <strong>{session.name}</strong>
                    <span>Updated {formatWhen(session.updatedAt)}</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${session.name}`}
                    onClick={() => {
                      removeSession(session.id);
                      setSessions(listSessions());
                    }}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="home-fine">
          {PRODUCT.name} runs entirely in this browser. <Link to={ROUTES.privacy}>What is stored, and where</Link> ·{" "}
          <Link to={ROUTES.howItWorks}>How it works</Link> · <Link to={ROUTES.faq}>FAQ</Link>
        </p>
      </main>
    </div>
  );
}
