import { Link } from "react-router";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { useMeta } from "./useMeta.ts";

export function Privacy() {
  useMeta({
    title: "Privacy",
    description: `${PRODUCT.name} never uploads your PDF. This page lists exactly what the app loads, what it stores in your browser, and how to remove it.`,
  });
  return (
    <section className="section container page-narrow">
      <p className="eyebrow">Privacy</p>
      <h1 className="display">Your document never leaves your device.</h1>
      <p className="lede">
        This is not a policy written by lawyers. It is a description of what the code does, written so
        that you can check it against the{" "}
        <a href={PRODUCT.repository} rel="noopener noreferrer" target="_blank">
          source
        </a>
        .
      </p>

      <div className="prose">
        <h2>What happens to a PDF you open</h2>
        <p>
          The file is read into memory in your browser tab and handed to pdf.js, which parses and renders
          it inside a web worker on your machine. Edits are kept as a list of changes next to the file.
          When you download, pdf-lib builds the new PDF in the same tab and the browser saves it through a
          temporary blob link. No step in that chain talks to a server.
        </p>
        <p>
          The app makes network requests only for its own static files: its JavaScript, stylesheets, fonts
          and the emoji images under the emoji tool. There is no analytics script, no error reporter, no
          account system and no third-party embed.
        </p>

        <h2>What is stored in your browser</h2>
        <ul>
          <li>
            <strong>IndexedDB</strong>, database <code>pdf-editor</code>: the bytes of every PDF you opened
            and the edits you made to each, so that a document's link keeps working after a refresh.
          </li>
          <li>
            <strong>localStorage</strong>: the list of your documents (name, created and updated times),
            the theme you chose, the last zoom level and whether the properties panel is open. Small PDFs
            may also be mirrored here as a fallback when IndexedDB is unavailable.
          </li>
          <li>
            <strong>sessionStorage</strong>: the tool, shape and page rotation you last used in a tab, so
            they survive a reload of that tab only.
          </li>
        </ul>
        <p>None of this is sent anywhere. No cookies are set.</p>

        <h2>How to remove it</h2>
        <p>
          Open the <Link to={ROUTES.app}>documents page</Link> and remove a document to delete its file and
          edits. To remove everything at once, clear this site's data in your browser's settings. Because
          nothing was copied elsewhere, that is the end of it.
        </p>

        <h2>What the host of this site can see</h2>
        <p>
          Like any website, the server that delivers the app's files sees the ordinary request for those
          files: your IP address, browser name and the address of the page. It does not receive the
          document, the edits or the name of your file, because the app never sends them.
        </p>

        <h2>Exported files</h2>
        <p>
          The PDF you download is a new file. The one you opened is never modified. An exported PDF
          contains your edited text, a subset of the fonts it uses, and any annotations you added. It does
          not contain a record of your original words where you replaced them, except in the rare cases
          described in the <Link to={ROUTES.post("exporting-real-text")}>export post</Link>, where the
          original text is covered rather than removed.
        </p>
      </div>
    </section>
  );
}
