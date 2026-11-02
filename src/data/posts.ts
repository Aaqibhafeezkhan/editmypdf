// Blog posts, written from the editor's own source. Each body is Markdown; raw HTML inside it is
// allowed for figures. Keep every technical claim checkable against src/.

// One of the site's palette hues (index.css); the card cover and the post page take it.
export type Hue = "accent" | "coral" | "teal" | "violet";

export type Post = {
  slug: string;
  title: string;
  description: string;
  // ISO date, used for ordering and display.
  date: string;
  tags: string[];
  // The card cover: a short glyph set in the display face (an operator, a symbol, a pair of
  // letters) on a tinted page in one of the palette hues. Drawn by PostCard.tsx, no image files.
  cover: { glyph: string; hue: Hue };
  body: string;
};

const WHY_HARD = `
Ask a PDF where its paragraphs are and it has no answer. A page is a list of drawing instructions. Some of those instructions place glyphs. That is all a PDF knows about text, and it is why "edit the text in a PDF" is a much harder promise than "put a text box on top of a PDF".

This post is about the specific places where that promise breaks, found while building PDF Edit. Every one of them is a case where clicking a line would make it visibly shift, and a shift on click is exactly what we treat as a bug.

## There are no words, only placed glyphs

Here is what a line of text looks like inside a page's content stream:

\`\`\`
BT
/F1 10.5 Tf
72 700 Td
[(Full-year) -278 (re) 15 (v) 10 (enue) -278 (gre) 20 (w)] TJ
ET
\`\`\`

The \`TJ\` operator shows strings and, between them, numbers that nudge the cursor left or right in thousandths of the font size. A word can be one string or five. A space can be a space character, a nudge of a few hundred units, or a fresh \`Td\` that starts the next word somewhere else on the line. A justified paragraph is often set with no spaces at all, every word positioned on its own.

So the first job is to read the page as a reader does: group placed glyphs into runs, runs into lines, lines into blocks, and decide which gaps are spaces. pdf.js does part of this and hands over text items with positions. PDF Edit walks the page's operator list alongside those items, glyph by glyph, so that every item also knows the character spacing (\`Tc\`), word spacing (\`Tw\`) and font size it was drawn with. Spaces are skipped on both sides while pairing, because pdf.js adds and drops them freely, and a short look-ahead resynchronises the two when a character has no glyph.

## The fonts are not the fonts you think

A PDF embeds its fonts, usually as subsets with only the glyphs the document used, often with a private encoding. The browser cannot use those directly, so pdf.js converts each one to OpenType and registers it as a font face.

In pdfjs-dist 6 those converted fonts put every glyph at a private-use code point. Unicode entries are added only as a courtesy, and they are not always right: a ligature glyph can end up in a plain letter's slot. Rendering is unaffected, because pdf.js draws by glyph code. Typing is affected, because when you type an "f" the browser looks the character up in the font's Unicode table.

PDF Edit fixes this by building a corrected copy of each face. It collects, from the page's own \`showText\` operations, which glyph the page used for each Unicode character, rewrites the font's \`cmap\` table so every character maps to that glyph, and registers the copy under its own family name. Only characters whose Unicode entry pointed somewhere else need fixing, so pages that agree with the font share one registered face.

## The space that is not there

The converted fonts have no space glyph. When the browser lays out "grew nine per cent" in such a face it draws the letters from the embedded font and the spaces from the fallback family. A fallback space is about 250 units wide; the spaces in the documents we tested were 318 to 348. Every line with spaces came out several points narrower than it printed, and the whole paragraph looked a little off the moment you clicked it. This single quirk caused most of the "the styling changes when I click" reports.

<figure>
<div class="specimen-row"><span class="specimen-label">The page</span><span class="specimen-line page">Revenue grew nine per cent to $4.2 billion<span class="ruler"></span></span></div>
<div class="specimen-row"><span class="specimen-label">Fallback space</span><span class="specimen-line fallback">Revenue grew nine per cent to $4.2 billion</span></div>
<div class="specimen-row"><span class="specimen-label">Fitted</span><span class="specimen-line fitted">Revenue grew nine per cent to $4.2 billion</span></div>
<figcaption>The same line set three ways. With the fallback font's narrow space the line ends early; after fitting, its spaces take exactly the width the page gave them.</figcaption>
</figure>

The fix is to stop trusting the font for spaces. For each text item PDF Edit measures the letters alone in the page's face, compares the result with the width the page actually drew, and spreads the difference over the spaces as CSS word spacing. Letter spacing takes the stream's \`Tc\` plus any mismatch between the page's glyph advances and the face's own, spread over the letters. A run with no spaces puts the whole residual between its letters, which is also where a dot leader and its page number leave it.

## Spacing is state, and state leaks

\`Tc\` and \`Tw\` are part of the graphics state. \`q\` saves it and \`Q\` restores it. A document that sets a wide \`Tc\` inside one \`q … Q\` block and then draws a normal paragraph after \`Q\` is perfectly valid, and a reader that forgets to pop the state will track the whole paragraph. We forgot, once.

Two more spacing traps turned up in real files:

- **Tracked small caps** reach pdf.js as a space after nearly every letter, because the wide \`Tc\` looks like a gap. The glyph stream knows which spaces the page really drew, so the tracking is turned back into letter spacing and the fake spaces disappear.
- **Two-byte spaces in Identity-H fonts** get word spacing added by pdf.js's text extraction but not by its renderer. The reported positions drift right by \`Tw\` for every such space before the item, so they have to be pulled back by the count of those spaces in the glyph stream. The NMDC press release in our test set has exactly this.

## One paragraph, several faces, no reliable colours

A paragraph that starts with a bold lead-in is one paragraph to a reader and two fonts to a PDF. Worse, a font with bold baked into its outlines reports weight 400 to pdf.js, so bold cannot be told from a heading face by weight alone. Colour is even less reliable: the colours in the operator list do not line up one-to-one with the text items pdf.js reports. PDF Edit reads each run's colour from the rendered page instead, averaging the darkest ink pixels under the run's box.

Mixed-face paragraphs got their own editor; that story is in [Editing a paragraph that mixes faces as one block](/blog/mixed-face-paragraphs).

## Pages are not set on a grid, and browsers round

Lines in a block are rarely pitched evenly. A Wikipedia print alternates 15.75 and 15.0 point line spacing. A list item's bullet is drawn in a smaller font whose box sorts after the item's first line. So a block records an offset for every line against an even pitch, and an indent for every line against the block's left edge.

Then the browser has its own opinion. Chrome rounds a font's ascent and descent to whole pixels when it builds a line box, so a baseline computed from the font's metrics lands a pixel off at some zoom levels. PDF Edit measures the baseline instead, on a hidden line set exactly like the editor's, and caches the result once the face has finished loading.

## What this adds up to

None of these problems is exotic. They are what ordinary PDFs look like: a LaTeX paper, a Word export, a press release, a printed web page. Editing one in place means reconstructing a reading of the page that is exact to a fraction of a point, and then handing that reconstruction to a browser text editor without it changing anything. The next post walks through how PDF Edit does that: [Opening an element exactly as the page prints it](/blog/exactly-as-the-page-prints-it).
`;

const EXACT = `
The rule we hold the editor to is simple to state: when you click a piece of text, nothing moves. Not the baseline, not the line ends, not the word gaps. The text under the cursor should look like the page until the moment you type.

It is a strict rule, and we check it with a probe that opens each of eleven test PDFs, clicks every text element on every page, and measures the editor's lines against the PDF's own text items. The tolerance is a few hundredths of a point. This post is what it takes to pass.

## Reading the page twice

Everything starts from two things pdf.js can give for a page: its text items, with a transform and a width for each, and its operator list, the drawing instructions that produced the rendered canvas. PDF Edit walks the operator list to build a glyph stream: every glyph the page drew, in order, with the \`Tc\`, \`Tw\` and font size in force when it was drawn. It then pairs that stream with the text items, so each item knows the state it was drawn in and the summed advance of the glyphs matched to its letters.

That pairing is what makes the spacing fit possible. Without it, a text item is only a string and a width.

## Fitting each run

For every run, \`runSpacing\` answers one question: what letter spacing and word spacing make the browser set this string, in this face, exactly as wide as the page drew it?

- Letter spacing starts as the stream's \`Tc\`, scaled from the operator's font size to the item's. If the page's glyph advances differ from the converted face's own (a substituted font, or one whose advances pdf.js adjusted), the mismatch is spread over the letters too, clamped to a few hundredths of an em.
- Word spacing takes whatever is left once the letters are measured, spread over the spaces. It is clamped to what a space can reasonably absorb.
- A run with no spaces spreads the whole residual between its letters.

CSS letter spacing also trails the last glyph, while the page's width stops at its ink, so one letter-spacing is subtracted before the residual is computed. Details like this are most of the work.

## Fitting each line

Runs are grouped into lines by baseline. A line is then fitted as a whole: its runs are measured in their faces with their letter spacing, and the difference from the line's drawn width lands on its spaces as one word-spacing value for the line. A justified paragraph's lines each get their own value, which is how a justified block opens with every line exactly as long as it prints without the editor having to justify anything.

A line with no spaces, such as a table of contents entry whose dot leader runs into its page number, spreads the difference over its letter gaps instead.

## Keeping a block's layout

A multi-line block is more than its lines. \`blockFace\` picks the longest line's font as the block's face, the first line's baseline, the median baseline pitch as the line height, and infers the alignment from where the lines start and end. Then \`blockContent\` joins the lines into one editable text while recording, per line:

- **its offset** from an even pitch, so a block whose lines alternate 15.75 and 15.0 points opens with every baseline where the page put it;
- **its indent** from the block's left edge, for a first-line indent, a hanging indent or a ragged left margin;
- **its word gap**, the fitted word spacing from the previous step;
- **whether its line break is hard or soft**. A break the author chose (a centred or right-aligned block, a line that ends although the next word would still have fit, a hyphenated word) is a real newline. A break that only exists because the column ran out of room is soft: it is kept until you edit, and then becomes a space so the text can flow again.

## Putting the editor on the baseline

The editor is a block of text laid out by the browser. For its first baseline to land on the PDF baseline, PDF Edit needs the distance from the top of a CSS line box to the alphabetic baseline for this face at this line height. The browser rounds a font's ascent and descent to whole pixels when it builds a line box, so computing that distance from the font's metrics is wrong by up to a pixel at some zoom levels, and wrong in a way that changes as you zoom.

So the distance is measured. A hidden line containing "Hg" and a zero-size marker is set with the editor's exact font and line height, the marker's position is read, and the result is cached per face and line height once \`document.fonts.check\` says the face has finished loading. A face still loading measures with its fallback, and that measurement is thrown away.

## Reading the pixels

Some things the content stream does not say plainly, and the rendered page does:

- **Colour.** The colour of a run is read from the canvas under its box: the darkest fifteen per cent of ink pixels, averaged. Operator-list colours do not line up with text items reliably enough to use.
- **Backdrop.** When you click, the background colour under the run is sampled from the edges of its box, so the edit's backdrop matches a tinted table cell as well as white paper.
- **Underline.** A single-line underline is found in the lower part of the run's box and reproduced, in its own colour, under the edited text.
- **Tails.** Runs on the same baseline immediately to the right of the clicked one are snapshotted, so when the edited text gets longer or shorter they move with it.

## The pixel we lost to a border

For a while every edit sat two pixels off in the editor and nowhere else. The page frame had a one-pixel CSS border. A border shrinks the canvas inside the frame by two pixels while the overlays above it keep the page's full size, so the rendered page and the editor disagreed by exactly that much. The frame now draws its edge with a box-shadow ring outside the box, and the comment in the stylesheet explains why so nobody puts the border back.

## What exact buys you

When all of this holds, clicking a line is undramatic. The text does not jump, the gaps do not change, and the caret appears where you clicked. Then you type, and from that point on the paragraph flows like any other text, inside its own column, in the page's own font. That quiet moment is the whole product.
`;

const EXPORT = `
Until recently, downloading an edited PDF from PDF Edit gave you a page where every edit was a picture: the edited text was painted at three times resolution into a PNG and placed over a white backdrop that hid the original words. It looked right. It was also unsearchable, unselectable, blurry at high zoom, and it left the original words in the file underneath the backdrop.

Edits are now written as text, in the page's own font, with the original strings removed. Here is how.

## Step one: take the original words out of the page

A PDF page's content stream cannot be edited by searching for a word, because the word may be five strings, and because moving one string moves everything drawn after it in the same text object. PDF Edit's content-stream reader lexes the stream into operators with the byte range each one occupies, and tracks the text state as it goes: \`q\`/\`Q\`, \`cm\`, \`BT\`/\`ET\`, \`Tf\`, \`Tc\`, \`Tw\`, \`Tz\`, \`TL\`, \`Ts\`, \`Td\`, \`TD\`, \`T*\` and \`Tm\`. At every string shown by \`Tj\`, \`TJ\`, \`'\` or \`"\` it knows where the first glyph will land on the page.

A string whose first glyph starts inside an edited element's box (with a margin of a point and a half) is the element's text. It is replaced by a number inside a \`TJ\` array equal to the string's advance, computed from the page's font resources: \`/Widths\` and \`/MissingWidth\` for simple fonts, \`/W\` and \`/DW\` for CID fonts, scaled by the font matrix for Type 3. The cursor ends up exactly where the string would have left it, so the text that follows in the same object stays put. A \`TJ\` that spans a whole table row loses only the strings inside the box.

\`'\` and \`"\` have side effects (a line feed, new word and character spacing) that are kept in front of the rewritten array. Inline images are skipped by their computed length, or by finding a free-standing \`EI\` when they are filtered. Streams are decoded with pdf-lib, joined, rewritten by splicing the byte ranges, with everything else copied verbatim, and written back as one flate stream.

Text drawn by a form XObject is not descended into. A \`Do\` whose bounding box meets an edited element marks that edit as uncertain, and the backdrop is kept for it.

## Step two: embed the font that pdf.js already decoded

The exported text has to be set in the same face as the page, and that face is a font pdf.js converted to OpenType when it rendered the page. PDF Edit asks pdf.js to keep those bytes (\`fontExtraProperties\`) and embeds them with pdf-lib and fontkit, taking the cmap-corrected copy when the editor registered one.

Subsetting is not optional. A converted font carries the original font's whole glyph table, around 800 kilobytes per face in our tests. With \`subset: true\` only the glyphs the edits use are written. A press release with a heading and a paragraph edited came out at 250 kilobytes against 232 for the original; without subsetting it would have gained about 350 kilobytes per face. If pdf-lib cannot subset a particular font, the whole font is embedded rather than giving up.

## Step three: place each word where the editor showed it

The editor already knows where every word sits: the same layout function that draws the on-page editor returns each run's words with an absolute x position and a baseline. Export writes one text matrix and one \`TJ\` per run. The text matrix maps the editor's page coordinates onto the PDF page, including any page rotation. \`Tc\` is set to the run's letter spacing; \`Tz\`, \`Tw\` and \`Ts\` are reset so nothing inherited from the page leaks in.

Inside the \`TJ\` array, every word but the first is preceded by a kern that lands it exactly where the editor put it. No space glyph is written at all, because the converted fonts have none. A justified line therefore exports with the same word gaps the editor showed, computed rather than set.

## When it still paints a picture

Three cases fall back to the old PNG path for that one edit:

- the face has no bytes to embed (a Type 3 font, or a font the PDF did not embed and pdf.js matched to a system font);
- pdf-lib cannot parse the converted font;
- you typed a character the subset font has no glyph for. The editor already shows such a character in a fallback face, so nothing is hidden from you.

The white backdrop is only drawn when the strip removed nothing or was uncertain, when a tail to the right of the edit had to move, or when the run has an underline that the removed text no longer provides.

## Checking the result

An export is verified by loading it back into the editor and running the same probe that checks the editor's fidelity. For the press release, pdf.js reads the edited words from the exported file, both edits open as editable text in the embedded face, and every other text item on both pages is at the position it had in the original. Every element in the re-opened export measured within two hundredths of a point of where the editor showed it.

## What is left

Two gaps remain, both narrow. Text inside form XObjects is covered rather than removed, as above. And a font with no width information, such as one of the standard fourteen fonts used without embedded metrics, has its strings removed without the compensating advance, so later text in the same text object could shift. Standard-font metrics would close that gap, and it is on the list.
`;

const MIXED = `
Most text on a page is set in one face. The exceptions are the interesting ones: a paragraph with a bold lead-in, a sentence with an italic title in it, a definition whose term is set in small caps. A reader sees one paragraph. A textarea can hold only one font. So a paragraph that mixes faces needed its own editor.

## The model: spans, not runs

When PDF Edit reads a page it collects text runs, the pieces pdf.js reports, each in one font. For a line, adjacent runs in one face are joined into a span; a gap wider than a sliver becomes a space; whitespace collapses the way the text would read. A span records its family, weight, style, size, colour, the PDF font it came from, and its own letter spacing when the page tracked it apart from its neighbours. It also keeps the page box its glyphs occupy, because the colour is read from the rendered pixels under that box.

Then the lines of a block are joined, and neighbouring spans in the same face whose colours are as good as equal (within 20 on each channel) are merged, so a paragraph read line by line edits as a few runs rather than one per line.

<figure>
<p class="spans-demo"><span data-face="bold"><b>Revenue.</b></span> <span data-face="regular">Revenue grew nine per cent to $4.2 billion, with growth in</span> <span data-face="italic"><i>every</i></span> <span data-face="regular">region.</span></p>
<figcaption>One paragraph, four spans. Each span carries its face, size, colour and PDF font name; the text between them is one string with the spans laid over it.</figcaption>
</figure>

## Deciding what belongs together

Which lines flow into one paragraph? Two lines can continue each other when they share a dominant face, or when the next line's face already appears in the previous one. That second rule is what joins a bold lead-in to the regular text that follows it.

The reverse pairing is deliberately left apart: a single-face line above a mixed line that merely contains its face. That is what a heading followed by a paragraph with a bold lead-in looks like, and pdf.js cannot tell a heading face from a bold one when the weight is baked into the font outlines. Getting this wrong would swallow headings into paragraphs.

## The editor owns its DOM

The mixed-face editor is a \`contentEditable\` block with one \`<div>\` per line and one \`<span>\` per styled run. React does not render its contents; the component does, from the model, and it intercepts every edit before the browser applies it.

A \`beforeinput\` event tells us what the browser is about to do: insert typed text, paste, drop, insert a line break, delete backward or forward. The affected character range is read from the event's target ranges, the change is applied to the spans in the model, the lines are drawn again, and the caret is put back. Inserted text takes the face of the character before the caret, so a new word typed after a bold run stays bold, and a span that loses all its text disappears, except the last one, which stays so typing can continue.

Input methods that compose text (Japanese, Chinese, dead keys) cannot be intercepted this way. For those the editor lets the browser apply the change and then reconciles: it reads the DOM text back, finds the common prefix and suffix against the model, and applies the difference as one edit.

The editor keeps its own undo history of two hundred steps and handles Cmd+Z and the browser's \`historyUndo\` input itself, so undo moves through spans rather than through whatever the browser's contentEditable undo would do to our DOM.

## Lines where the page put them

Because the component draws the lines, it can also place them. Each line \`<div>\` gets the page's indent for that line (as a text indent on the first line, as padding on the others), a top margin for its baseline offset from an even pitch, and the page's own word spacing for that line. A line the page gave a word gap is already exactly as wide as printed and is never stretched; only a line that flows again after an edit in a justified block is justified by the browser.

Caret positions are character offsets into the whole text. A small helper maps between those offsets and DOM selection points, with the one subtlety that the newline between two line \`<div>\`s has no node of its own.

## Letting the text flow

A paragraph opens with every line break of the page. Breaks that only exist because the column ran out of room are marked soft. The first edit anywhere in the paragraph turns the soft breaks from that point onward into spaces, so the text reflows inside the paragraph's width, while the lines above the edit keep their printed breaks, gaps and positions. Offsets are preserved through this change so the caret does not jump.

## Export

Each span's face is embedded separately on export, and each word is placed in its own span's face at the position the editor showed. The same layout code serves the editor, the painted fallback and the real-text export, which is the only reason they agree.
`;

const PRIVACY_POST = `
"Your files are safe with us" is a sentence a PDF service has to say because it has your files. PDF Edit does not have them. This post explains the architecture that makes that true, what it costs, and how you can check it yourself.

## There is no server

PDF Edit is a single-page application built with React and Vite. When you open it, your browser downloads the app's JavaScript, stylesheets, fonts and icons, and from then on everything happens in the tab:

<dl class="kv">
<dt>Reading</dt><dd>pdf.js parses the PDF and renders pages to canvases inside a web worker bundled with the app.</dd>
<dt>Editing</dt><dd>Edits are a list of changes kept in memory next to the file: a text patch, a pencil stroke, a shape.</dd>
<dt>Saving</dt><dd>The file's bytes and the edit list are written to IndexedDB in your browser, so the document's link keeps working after a refresh.</dd>
<dt>Downloading</dt><dd>pdf-lib builds the new PDF in the tab; the browser saves it from a temporary blob URL.</dd>
</dl>

There is no upload endpoint because there is no backend. The repository has no server code at all. The only \`fetch\` call in the application loads the emoji images from the app's own files when an emoji is exported.

## What the app does ask the network for

Honesty requires the whole list. The app requests its own static files from wherever it is hosted. The host sees what any web server sees for those requests: your IP address, your browser's user agent and the page address. It never receives your document, your edits or your file's name, because the app does not send them. There is no analytics script, no error reporting service, no account system and no third-party embed on the editor pages.

## What this architecture buys

- **No limits that exist to sell an upgrade.** There is no file counter, no size cap and no watermark. The only limit is your browser's memory.
- **No waiting on an upload.** A 50-megabyte scan opens as fast as your disk can read it.
- **Documents that stay where you put them.** Each PDF you open gets its own link in this browser. You can keep several open in tabs, and a refresh restores each one with its edits.

## What it costs

- **No OCR and no conversion.** Recognising text in a scan, or turning a PDF into a Word file, needs large models or engines that are better run on a server. PDF Edit does not pretend to do them; the [comparisons](/compare) say which tools do.
- **One browser, one machine.** Your documents are not synced anywhere. Open the same link on another computer and it will not know the document.
- **Memory.** Everything is in RAM. A very large file is limited by what the browser will hold.

## How to check for yourself

Open your browser's developer tools, choose the Network tab, then open a PDF in PDF Edit, edit a line and download the result. You will see requests for the app's own files and nothing else. No request carries your PDF.

If you read code, the editor's source is public. The reader is \`src/pdf.ts\`; the writer is \`src/exportPdf.ts\`; storage is \`src/session.ts\`. Search the \`src\` directory for \`fetch\` and you will find the emoji loader and nothing more.

## Things we cannot promise

The browser is yours, and so is everything in it. A browser extension can read the pages you have open. Your downloads folder is as safe as your computer. And the host that serves the app can see that you loaded it. Those are the limits of what a client-side application can promise, and we would rather state them than pretend they do not exist.
`;

const LEAVES_ALONE = `
Knowing what an editor will not touch matters as much as knowing what it can. PDF Edit reads a page carefully, and part of reading carefully is deciding what to leave alone. This post lists those decisions, with the reason for each.

## Text the page painted over

A PDF can draw text and then paint a filled box or an image over it. Readers never see that text, but it is still in the file. An earlier version of PDF Edit exported edits as pictures over a white backdrop, so a file that had been edited and re-opened carried its original words under each patch.

The page reader now tracks every opaque fill and image with the order it was painted in. A text run that lies wholly under opaque paint applied after it is not offered for editing. What you can click is what you can see.

## Tables

Rules, the thin filled rectangles that make up table borders, are collected from the operator list, merged where they touch, and joined into table boxes. A table is an element of its own: you can move it or resize it as a block. The text inside its cells stays reachable as text, so a figure in a cell can still be clicked and retyped, and the shapes that happen to sit inside a table are not reported twice.

## Fonts without outlines to embed

Three kinds of text open in a fallback face rather than the page's own:

- text set in a **Type 3 font**, whose glyphs are small drawing programs rather than outlines;
- text set in a font the PDF **did not embed**, which pdf.js renders with a matching system font;
- a **character you type** that the embedded subset has no glyph for.

In all three cases the editor still fits the line to its printed width, so it opens looking right. On download, such an edit is painted as an image rather than written as text, because there is no face to write it in. Everything else on the page is unaffected.

## Text inside form XObjects

A form XObject is a reusable block of drawing that a page invokes with \`Do\`. Letterheads, stamps and some page templates live there. PDF Edit's export removes the original strings under an edit from the page's own content stream, but it does not descend into forms. When a form's bounding box meets an edited element, that edit is marked uncertain and a backdrop is kept under it, so the result looks right even though the covered text is still in the file.

## Spaces the page never drew

Some text reaches pdf.js with spaces that are not on the page. Tracked small caps arrive as a space after nearly every letter. Two-byte space codes in Identity-H fonts have word spacing added by the text extractor that the renderer never applied. The glyph stream read from the operator list knows what was really drawn, so the fake spaces are removed and the drifted positions pulled back. The text you edit is the text the page shows.

## List markers and hyphens

A bullet is usually drawn in a smaller font, and its box sorts after the first line of its item. The reader recognises a marker beside a line and keeps the two together. A line that ends with a hyphen is treated as a hard break, since breaking it elsewhere would split the word; it stays a hyphenated line until you edit it.

## Lines you did not touch

The most important thing the editor leaves alone is the rest of the paragraph. A block opens with every line break the page made, every line's own baseline and indent, and every line's own word gap. The first edit lets the text flow again from that point onward; the lines above it keep their printed layout. Nothing is re-justified, re-kerned or re-wrapped because you clicked.

## What you cannot do, by design

- Edit a scanned page's text. There is no OCR; you can annotate on top.
- Open a password-protected file.
- Merge, split, compress, convert or fill forms. PDF Edit opens one PDF and writes one PDF.

For those jobs the [comparison pages](/compare) are honest about which tool to use instead.
`;

export const POSTS: Post[] = [
  {
    slug: "exporting-real-text",
    title: "Exporting edits as real text, in the page's own font",
    description:
      "How PDF Edit removes the original strings from a page's content stream, embeds a subset of the font pdf.js decoded, and writes your edit as positioned text rather than a picture.",
    date: "2026-10-28",
    tags: ["export", "fonts", "pdf-lib"],
    cover: { glyph: "Tj", hue: "accent" },
    body: EXPORT,
  },
  {
    slug: "what-the-editor-leaves-alone",
    title: "What the editor leaves alone",
    description:
      "Covered text, tables, Type 3 fonts, form XObjects, phantom spaces and the lines you did not touch: the deliberate limits of editing a PDF in place.",
    date: "2026-10-21",
    tags: ["limits", "design"],
    cover: { glyph: "Ø", hue: "coral" },
    body: LEAVES_ALONE,
  },
  {
    slug: "mixed-face-paragraphs",
    title: "Editing a paragraph that mixes bold, italic and regular as one block",
    description:
      "A textarea holds one font. A paragraph with a bold lead-in needs a contentEditable editor that owns its DOM, maps every edit into styled spans and keeps the page's line layout.",
    date: "2026-10-14",
    tags: ["editor", "fonts"],
    cover: { glyph: "Aa", hue: "violet" },
    body: MIXED,
  },
  {
    slug: "exactly-as-the-page-prints-it",
    title: "Opening an element exactly as the page prints it",
    description:
      "Fitting every run and line to its printed width, keeping a block's own baselines and breaks, measuring the baseline in the browser, and reading colour from the pixels.",
    date: "2026-10-07",
    tags: ["fidelity", "layout"],
    cover: { glyph: "Tw", hue: "teal" },
    body: EXACT,
  },
  {
    slug: "nothing-leaves-your-browser",
    title: "Nothing leaves your browser: how PDF Edit is built",
    description:
      "pdf.js in a web worker, pdf-lib for writing, IndexedDB for storage and no server at all. What that architecture buys, what it costs, and how to verify it.",
    date: "2026-09-30",
    tags: ["privacy", "architecture"],
    cover: { glyph: "{ }", hue: "teal" },
    body: PRIVACY_POST,
  },
  {
    slug: "why-editing-pdf-text-is-hard",
    title: "Why editing text inside a PDF is hard",
    description:
      "No paragraphs, subset fonts with no space glyph, spacing operators that leak, phantom spaces, mixed faces and browsers that round: the real reasons a click can shift a line.",
    date: "2026-09-16",
    tags: ["fonts", "pdf"],
    cover: { glyph: "¶", hue: "violet" },
    body: WHY_HARD,
  },
];

export function postBySlug(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug);
}

// Up to `count` other posts, the ones sharing the most tags first; when fewer than `count` share a
// tag, the most recent remaining posts fill the list so the section is never empty.
export function relatedPosts(post: Post, count = 3): Post[] {
  const shared = (other: Post) => other.tags.filter((tag) => post.tags.includes(tag)).length;
  return POSTS.filter((other) => other.slug !== post.slug)
    .map((other, index) => ({ other, score: shared(other), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map((entry) => entry.other);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
