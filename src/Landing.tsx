import { useEffect, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { createBlankPdf, loadPdf } from "./pdf.ts";
import { navigate, plainClick } from "./router.ts";
import { createSession, listSessions, readySessions, removeSession, type SessionInfo } from "./session.ts";
import { Button } from "@/components/ui/button";
import { ThemeSelect } from "./ThemeSelect.tsx";
import "./Landing.css";

const DESCRIPTION =
  "Free browser PDF editor. Add text, draw with a pencil, mark shapes, and download the annotated PDF. Each file stays in this browser and opens at its own link.";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PDF Editor",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description: DESCRIPTION,
  featureList: [
    "Add text with font, size, color, and style",
    "Draw with a pencil, lines, arrows, and shapes",
    "Zoom and pan the page",
    "Keep several PDFs open, each at its own URL",
    "Save work in the browser and download a new PDF",
  ],
};

function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function Landing() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "PDF Editor — Annotate, draw, and type on a PDF in your browser";
    document.querySelector('meta[name="description"]')?.setAttribute("content", DESCRIPTION);
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
          ? "This PDF is password protected."
          : "Could not open this PDF.",
      );
    } finally {
      setBusy(false);
    }
    if (firstId) navigate(`/edit/${firstId}`);
  };

  const startBlank = async () => {
    setBusy(true);
    setError(null);
    try {
      const bytes = await createBlankPdf();
      const id = await createSession("Untitled.pdf", bytes, []);
      navigate(`/edit/${id}`);
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
    <div className="site" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="site-header">
        <a className="site-logo" href="/">
          PDF Editor
        </a>
        <ThemeSelect />
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Free browser PDF editor</p>
            <h1>Mark up a PDF without sending it anywhere.</h1>
            <p className="lede">
              Add typed text, draw with a pencil, and place lines and shapes on top of a PDF.
              Download a new file when you are done. The original stays untouched, and the work
              stays in this browser.
            </p>
            <div className="hero-actions">
              <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "Opening…" : "Open a PDF"}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void startBlank()}>
                Start with a blank page
              </Button>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
          <div
            className={dragging ? "dropzone dragging" : "dropzone"}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragging(false);
              void openFiles([...event.dataTransfer.files]);
            }}
          >
            <p className="drop-title">Drop a PDF here</p>
            <p>or choose one from your computer. Several files each get their own editing link.</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              Choose PDF
            </Button>
          </div>
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
          <section className="panel" aria-labelledby="recent-heading">
            <h2 id="recent-heading">Continue a document</h2>
            <p>These PDFs are saved in this browser. Open more than one by using separate tabs.</p>
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <a
                    href={`/edit/${session.id}`}
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      navigate(`/edit/${session.id}`);
                    }}
                  >
                    <strong>{session.name}</strong>
                    <span>Updated {formatWhen(session.updatedAt)}</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      removeSession(session.id);
                      setSessions(listSessions());
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel" aria-labelledby="features-heading">
          <h2 id="features-heading">What you can do on the page</h2>
          <div className="feature-grid">
            <article>
              <h3>Type on the page</h3>
              <p>
                Click to place text, then set the font, size, color, bold, italic, underline, and
                alignment. The box grows with the words until you resize it.
              </p>
            </article>
            <article>
              <h3>Draw and mark</h3>
              <p>
                Use the pencil, or open Shapes for lines, arrows, rectangles, stars, and more.
                Change the stroke color and width, then undo or erase a mark.
              </p>
            </article>
            <article>
              <h3>Zoom the document</h3>
              <p>
                Use the zoom controls, hold Control or Command and scroll, or pinch with two
                fingers on a trackpad.
              </p>
            </article>
            <article>
              <h3>Several documents at once</h3>
              <p>
                Every upload opens at its own URL. Keep a contract in one tab and a form in
                another. Refreshing a tab restores that document.
              </p>
            </article>
          </div>
        </section>

        <section className="panel" aria-labelledby="steps-heading">
          <h2 id="steps-heading">How it works</h2>
          <ol className="steps">
            <li>
              <strong>Open a PDF or a blank page.</strong>
              <span>The file is read in the browser and given a unique editing link.</span>
            </li>
            <li>
              <strong>Add text and drawings.</strong>
              <span>Marks sit on top of the pages. The original wording is left as it is.</span>
            </li>
            <li>
              <strong>Download the result.</strong>
              <span>You get a new PDF with your notes. The copy you opened is not overwritten.</span>
            </li>
          </ol>
        </section>

        <section className="panel" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Your files stay on this device</h2>
          <p>
            Nothing is uploaded to a server. The PDF and your marks are stored in this browser, so
            a refresh does not clear the page. Clearing site data, or opening the same link in
            another browser, starts from an empty document.
          </p>
        </section>

        <section className="panel" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Questions</h2>
          <div className="faq">
            <details>
              <summary>Does this PDF editor upload my file?</summary>
              <p>No. Opening, editing, and exporting all happen in the browser on your computer.</p>
            </details>
            <details>
              <summary>Can I edit more than one PDF at a time?</summary>
              <p>
                Yes. Each file gets its own link. Open those links in separate tabs and switch
                between them. The home page lists every document saved in this browser.
              </p>
            </details>
            <details>
              <summary>What happens if I refresh?</summary>
              <p>
                The document at that URL comes back with the text, drawings, and shapes you added.
                The theme you picked is saved as well.
              </p>
            </details>
            <details>
              <summary>Can I change the words already printed in the PDF?</summary>
              <p>
                This editor adds a layer of text and drawings. It does not reflow or replace the
                original text inside the file. Download writes a new PDF with your marks on top.
              </p>
            </details>
            <details>
              <summary>Which browsers can open it?</summary>
              <p>
                Current versions of Chrome, Edge, Firefox, and Safari can open the editor. A
                password-protected PDF cannot be opened here.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <p>PDF Editor runs locally in your browser. Annotations are saved on this device.</p>
      </footer>
    </div>
  );
}
