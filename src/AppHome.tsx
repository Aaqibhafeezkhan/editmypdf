import { useEffect, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { Link } from "react-router";
import { getDocument } from "pdfjs-dist";
import {
  ArrowRight,
  Check,
  FilePlus2,
  FileText,
  FolderOpen,
  Lock,
  MousePointerClick,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT, ROUTES } from "./data/product.ts";
import { createBlankPdf, loadPdf } from "./pdf.ts";
import { navigate, plainClick } from "./router.ts";
import {
  createSession,
  listSessions,
  readSession,
  readySessions,
  removeSession,
  type SessionInfo,
} from "./session.ts";
import { LogoMark } from "./site/Logo.tsx";
import { ThemeSelect } from "./ThemeSelect.tsx";
import "./AppHome.css";

const SAMPLE_URL = "/sample.pdf";
const SAMPLE_NAME = "Sample letter.pdf";

type Preview = { src: string; pages: number; bytes: number };

// First-page previews, kept for the visit so going back to this screen does not render them again.
const previews = new Map<string, Preview>();

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    timestamp,
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// Renders the first page of a stored document at thumbnail size.
async function renderPreview(id: string): Promise<Preview | null> {
  const saved = await readSession(id);
  if (!saved) return null;
  const task = getDocument({ data: saved.bytes.slice(0) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = (320 * (window.devicePixelRatio || 1)) / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return { src: canvas.toDataURL("image/jpeg", 0.82), pages: doc.numPages, bytes: saved.bytes.byteLength };
  } finally {
    await task.destroy();
  }
}

function usePreviews(sessions: SessionInfo[]): Map<string, Preview> {
  const [, bump] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const session of sessions) {
        if (cancelled) return;
        if (previews.has(session.id)) continue;
        try {
          const preview = await renderPreview(session.id);
          if (preview && !cancelled) {
            previews.set(session.id, preview);
            bump((value) => value + 1);
          }
        } catch {
          // A document that cannot be previewed still opens from its card.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessions]);
  return previews;
}

function DocumentCard({
  session,
  preview,
  onRemove,
}: {
  session: SessionInfo;
  preview: Preview | undefined;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const href = ROUTES.edit(session.id);
  const open = (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number; preventDefault: () => void }) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <li className="doc-card">
      <a className="doc-thumb" href={href} onClick={open} aria-label={`Open ${session.name}`}>
        {preview ? (
          <img src={preview.src} alt="" />
        ) : (
          <span className="doc-thumb-empty" aria-hidden="true">
            <FileText />
          </span>
        )}
        <span className="doc-thumb-open">
          Open <ArrowRight aria-hidden="true" />
        </span>
      </a>
      <div className="doc-body">
        <a className="doc-name" href={href} onClick={open} title={session.name}>
          {session.name}
        </a>
        <span className="doc-meta">
          {preview ? `${preview.pages} ${preview.pages === 1 ? "page" : "pages"} · ${formatBytes(preview.bytes)} · ` : ""}
          Updated {formatWhen(session.updatedAt)}
        </span>
        <div className="doc-actions">
          {confirming ? (
            <>
              <span className="doc-confirm">Delete this document and its edits?</span>
              <Button type="button" size="sm" variant="destructive" onClick={onRemove}>
                Remove
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => navigate(href)}>
                Open
              </Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${session.name}`} onClick={() => setConfirming(true)}>
                <Trash2 />
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// The documents screen: open a PDF, start a blank page, try the sample, or continue a saved one.
export function AppHome() {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"open" | "blank" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewMap = usePreviews(sessions);

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
      if (cancelled) return;
      setSessions(listSessions());
      setReady(true);
    })();
    const refresh = () => setSessions(listSessions());
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const openBytes = async (name: string, bytes: Uint8Array): Promise<string> => {
    const parsed = await loadPdf(bytes, name);
    await parsed.doc.cleanup();
    return createSession(name, bytes, []);
  };

  const openFiles = async (files: File[]) => {
    const pdfs = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      setError("That is not a PDF. Choose a file ending in .pdf.");
      return;
    }
    setBusy("open");
    setError(null);
    let firstId = "";
    try {
      for (const file of pdfs) {
        const id = await openBytes(file.name, new Uint8Array(await file.arrayBuffer()));
        if (!firstId) firstId = id;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message.toLowerCase().includes("password")
          ? "This PDF is password protected, and the editor cannot open those."
          : "Could not open this PDF.",
      );
    } finally {
      setBusy(null);
    }
    if (firstId) navigate(ROUTES.edit(firstId));
  };

  const startBlank = async () => {
    setBusy("blank");
    setError(null);
    try {
      const id = await createSession("Untitled.pdf", await createBlankPdf(), []);
      navigate(ROUTES.edit(id));
    } catch {
      setError("Could not start a blank page.");
    } finally {
      setBusy(null);
    }
  };

  const openSample = async () => {
    setBusy("sample");
    setError(null);
    try {
      const response = await fetch(SAMPLE_URL);
      if (!response.ok) throw new Error("missing");
      const id = await openBytes(SAMPLE_NAME, new Uint8Array(await response.arrayBuffer()));
      navigate(ROUTES.edit(id));
    } catch {
      setError("The sample document could not be loaded.");
    } finally {
      setBusy(null);
    }
  };

  const onDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void openFiles([...event.dataTransfer.files]);
  };

  return (
    <div
      className="home"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="home-overlay" aria-hidden="true">
          <div className="home-overlay-card">
            <Upload />
            <strong>Drop to open</strong>
            <span>The file stays on this device.</span>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <Link className="home-link" to={ROUTES.home} aria-label={`${PRODUCT.name} home`}>
            <LogoMark size={26} />
            <strong>{PRODUCT.name}</strong>
          </Link>
          <div className="doc-switch">
            <span className="file-name">Documents</span>
          </div>
        </div>
        <div className="top-actions">
          <ThemeSelect />
          <Button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            <Upload />
            {busy === "open" ? "Opening…" : "Open a PDF"}
          </Button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <Sparkles aria-hidden="true" /> Documents
            </p>
            <h1>Open a PDF to start editing.</h1>
            <p className="home-lede">
              Drop a file anywhere on this page or choose one from your computer. It opens at its own link in
              this browser, and nothing is uploaded.
            </p>
            <div className="home-actions">
              <Button type="button" size="lg" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                <FolderOpen />
                {busy === "open" ? "Opening…" : "Choose a PDF"}
              </Button>
              <Button type="button" size="lg" variant="outline" disabled={busy !== null} onClick={() => void startBlank()}>
                <FilePlus2 />
                {busy === "blank" ? "Starting…" : "Blank page"}
              </Button>
              <Button type="button" size="lg" variant="outline" disabled={busy !== null} onClick={() => void openSample()}>
                <FileText />
                {busy === "sample" ? "Opening…" : "Try the sample"}
              </Button>
            </div>
            {error && (
              <p className="home-error" role="alert">
                {error}
              </p>
            )}
            <ul className="home-facts">
              <li>
                <Check aria-hidden="true" /> Edits in the page's own font
              </li>
              <li>
                <Check aria-hidden="true" /> Downloads as real text
              </li>
              <li>
                <Lock aria-hidden="true" /> Never leaves this device
              </li>
            </ul>
          </div>
          <button
            type="button"
            className="home-drop"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
            aria-label="Choose a PDF to open"
          >
            <span className="home-drop-art" aria-hidden="true">
              <span className="sheet sheet-back" />
              <span className="sheet sheet-mid" />
              <span className="sheet sheet-front">
                <span className="sheet-line w1" />
                <span className="sheet-line w3" />
                <span className="sheet-line w3 hot" />
                <span className="sheet-line w2" />
                <span className="sheet-line w3" />
                <span className="sheet-line w2" />
              </span>
              <span className="sheet-cursor">
                <MousePointerClick />
              </span>
            </span>
            <strong>Drop a PDF here</strong>
            <span>or click to browse. PDF files, any size your browser can hold.</span>
          </button>
        </section>

        <section className="home-docs" aria-labelledby="docs-heading">
          <div className="home-docs-head">
            <h2 id="docs-heading">In this browser</h2>
            <span>
              {sessions.length === 0
                ? "Nothing saved yet"
                : `${sessions.length} ${sessions.length === 1 ? "document" : "documents"} · saved on this device`}
            </span>
          </div>
          {ready && sessions.length === 0 ? (
            <div className="home-empty">
              <span className="home-empty-icon" aria-hidden="true">
                <FileText />
              </span>
              <strong>No documents yet</strong>
              <span>Open a PDF and it will appear here with a preview, ready to continue after a refresh.</span>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void openSample()}>
                Try the sample letter <ArrowRight />
              </Button>
            </div>
          ) : (
            <ul className="doc-grid">
              {sessions.map((session) => (
                <DocumentCard
                  key={session.id}
                  session={session}
                  preview={previewMap.get(session.id)}
                  onRemove={() => {
                    removeSession(session.id);
                    previews.delete(session.id);
                    setSessions(listSessions());
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <p className="home-fine">
          {PRODUCT.name} runs entirely in this browser. <Link to={ROUTES.privacy}>What is stored, and where</Link> ·{" "}
          <Link to={ROUTES.howItWorks}>How it works</Link> · <Link to={ROUTES.faq}>FAQ</Link>
        </p>
      </main>

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
    </div>
  );
}
