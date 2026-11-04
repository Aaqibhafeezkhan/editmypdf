// Blog posts, written from the editor's own source. Each body is Markdown with the extras in
// src/site/markdown.ts: ::: callouts, card grids and steps, :emoji: and {{icon}} shortcodes, and
// raw HTML for figures (classes in src/site/blog.css). Keep every technical claim checkable
// against src/.
import { iconHtml as icon } from "../site/blogIcons.ts";

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
  // Search phrases the post is written for, added to the tags in the keywords meta and JSON-LD.
  keywords?: string[];
  // The link-preview card, a file in public/; without one the site card is used.
  image?: { src: string; alt: string; width: number; height: number };
  body: string;
};

/* ---- Figure helpers --------------------------------------------------------- */

// A font's glyph table as a grid of cells, the glyphs in `used` lit.
function glyphGrid(glyphs: string, used: string, className = "bp-glyph-grid"): string {
  const cells = [...glyphs].map((glyph) => `<b${used.includes(glyph) ? ' class="bp-on"' : ""}>${glyph}</b>`).join("");
  return `<div class="${className}">${cells}</div>`;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:";
const USED = "Revnuwtpc";

// One tile of a flow diagram.
function tile(name: string, title: string, text: string, className = "bp-flow-tile"): string {
  return `<div class="${className}">${icon(name)}<span><b>${title}</b>${text}</span></div>`;
}

/* ---- The posts ---------------------------------------------------------------- */

const WHY_HARD = `
Ask a PDF where its paragraphs are and it has no answer. A page is a list of drawing instructions. Some of those instructions place glyphs. That is all a PDF knows about text, and it is why "edit the text in a PDF" is a much harder promise than "put a text box on top of a PDF".

This post is about the specific places where that promise breaks, found while building Edit My PDF. Every one of them is a case where clicking a line would make it visibly shift, and a shift on click is exactly what we treat as a bug. :target:

::: plain :bulb: Glyph, not letter
A **glyph** is a drawn shape: the particular curves of an "a" in one particular font. A PDF places glyphs, one by one, at coordinates. It does not store the word "apple"; it stores five shapes and where each of them goes. Everything in this post follows from that.
:::

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

::: plain {{brackets}} Reading that stream line by line
- \`BT\` and \`ET\` open and close a text object.
- \`/F1 10.5 Tf\` picks font F1 at 10.5 points.
- \`72 700 Td\` moves the cursor to 72 points from the left, 700 from the bottom.
- \`[ … ] TJ\` shows the pieces in the brackets. "revenue" arrives as three strings with two tiny nudges between them, and the \`-278\` entries are the spaces, drawn as gaps rather than as a space character.
:::

Edit My PDF therefore never trusts the strings alone. It walks the operator list that pdf.js produces when it renders the page and builds a **glyph stream**: every glyph the page drew, in order, with the font, size, character spacing and word spacing in force at the moment it was drawn. The text items pdf.js reports are then matched against that stream, so each one knows how it was really set.

## The fonts are not the fonts you think

A PDF embeds its fonts, usually as subsets with only the glyphs the document used, often with a private encoding. The browser cannot use those directly, so pdf.js converts each one to OpenType and registers it as a font face.

In pdfjs-dist 6 those converted fonts put every glyph at a private-use code point. Unicode entries are added only as a courtesy, and they are not always right: a ligature glyph can end up in a plain letter's slot. Rendering is unaffected, because pdf.js draws by glyph code. Typing is affected, because when you type an "f" the browser looks the character up in the font's Unicode table. :confused:

::: plain {{type}} What a cmap is
A font's **cmap** is its phone book: it says which glyph answers to which character. The converted fonts have a phone book with some wrong numbers in it. Type "f" and you might get the "fi" ligature, because that is where the book pointed.
:::

Edit My PDF fixes this by building a corrected copy of each face. It collects, from the page's own \`showText\` operations, which glyph the page used for each Unicode character, rewrites the font's \`cmap\` table so every character maps to that glyph, and registers the copy under its own family name. Only characters whose Unicode entry pointed somewhere else need fixing, so pages that agree with the font share one registered face.

## The space that is not there

The converted fonts have no space glyph. When the browser lays out "grew nine per cent" in such a face it draws the letters from the embedded font and the spaces from the fallback family. A fallback space is about 250 units wide; the spaces in the documents we tested were 318 to 348. Every line with spaces came out several points narrower than it printed, and the whole paragraph looked a little off the moment you clicked it. This single quirk caused most of the "the styling changes when I click" reports.

<figure>
<div class="specimen-row"><span class="specimen-label">The page</span><span class="specimen-line page">Revenue grew nine per cent to $4.2 billion<span class="ruler"></span></span></div>
<div class="specimen-row"><span class="specimen-label">Fallback space</span><span class="specimen-line fallback">Revenue grew nine per cent to $4.2 billion</span></div>
<div class="specimen-row"><span class="specimen-label">Fitted</span><span class="specimen-line fitted">Revenue grew nine per cent to $4.2 billion</span></div>
<figcaption>The same line set three ways. With the fallback font's narrow space the line ends early; after fitting, its spaces take exactly the width the page gave them.</figcaption>
</figure>

The fix is to stop trusting the font for spaces. For each text item Edit My PDF measures the letters alone in the page's face, compares the result with the width the page actually drew, and spreads the difference over the spaces as CSS word spacing. Letter spacing takes the stream's \`Tc\` plus any mismatch between the page's glyph advances and the face's own, spread over the letters. A run with no spaces puts the whole residual between its letters, which is also where a dot leader and its page number leave it.

## Spacing is state, and state leaks

\`Tc\` and \`Tw\` are part of the graphics state. \`q\` saves it and \`Q\` restores it. A document that sets a wide \`Tc\` inside one \`q … Q\` block and then draws a normal paragraph after \`Q\` is perfectly valid, and a reader that forgets to pop the state will track the whole paragraph.

::: story :sweat: We forgot, once
One test document opened with a paragraph spaced out like a ransom note. Its heading had been tracked inside a \`q … Q\` pair, and our reader was still carrying the heading's character spacing when the body text came along. One missing "restore" is all it takes.
:::

Two more spacing traps turned up in real files:

::: cards
- {{letter-text}} **Tracked small caps** reach pdf.js as a space after nearly every letter, because the wide \`Tc\` looks like a gap. The glyph stream knows which spaces the page really drew, so the tracking is turned back into letter spacing and the fake spaces disappear.
- {{binary}} **Two-byte spaces in Identity-H fonts** get word spacing added by pdf.js's text extraction but not by its renderer. The reported positions drift right by \`Tw\` for every such space before the item, so they have to be pulled back by the count of those spaces in the glyph stream. The NMDC press release in our test set has exactly this.
:::

## One paragraph, several faces, no reliable colours

A paragraph that starts with a bold lead-in is one paragraph to a reader and two fonts to a PDF. Worse, a font with bold baked into its outlines reports weight 400 to pdf.js, so bold cannot be told from a heading face by weight alone. Colour is even less reliable: the colours in the operator list do not line up one-to-one with the text items pdf.js reports. Edit My PDF reads each run's colour from the rendered page instead, averaging the darkest ink pixels under the run's box.

Mixed-face paragraphs got their own editor; that story is in [Editing a paragraph that mixes faces as one block](/blog/mixed-face-paragraphs).

## Pages are not set on a grid, and browsers round

Lines in a block are rarely pitched evenly. A Wikipedia print alternates 15.75 and 15.0 point line spacing. A list item's bullet is drawn in a smaller font whose box sorts after the item's first line. So a block records an offset for every line against an even pitch, and an indent for every line against the block's left edge.

Then the browser has its own opinion. Chrome rounds a font's ascent and descent to whole pixels when it builds a line box, so a baseline computed from the font's metrics lands a pixel off at some zoom levels. Edit My PDF measures the baseline instead, on a hidden line set exactly like the editor's, and caches the result once the face has finished loading.

::: plain {{baseline}} Baseline
The **baseline** is the invisible line the letters sit on. Get it one pixel wrong and the whole line looks like it twitched when you clicked it, even though every letter is the right shape and size.
:::

## What this adds up to

None of these problems is exotic. They are what ordinary PDFs look like: a LaTeX paper, a Word export, a press release, a printed web page. Editing one in place means reconstructing a reading of the page that is exact to a fraction of a point, and then handing that reconstruction to a browser text editor without it changing anything.

::: good :point-right: Where this goes next
The next post walks through how Edit My PDF does that reconstruction, measurement by measurement: [Opening an element exactly as the page prints it](/blog/exactly-as-the-page-prints-it).
:::
`;

const EXACT = `
The rule we hold the editor to is simple to state: when you click a piece of text, nothing moves. Not the baseline, not the line ends, not the word gaps. The text under the cursor should look like the page until the moment you type.

It is a strict rule, and we check it with a probe that opens each of eleven test PDFs, clicks every text element on every page, and measures the editor's lines against the PDF's own text items. The tolerance is a few hundredths of a point. This post is what it takes to pass. :muscle:

::: plain :bulb: Why "nothing moves" is hard
A PDF is a finished drawing. A browser text editor is a live layout engine with its own fonts, its own rounding and its own ideas about spaces. Making the second one look exactly like the first means measuring the drawing in several places and feeding the browser numbers it would never have chosen on its own.
:::

## Reading the page twice

Everything starts from two things pdf.js can give for a page: its text items, with a transform and a width for each, and its operator list, the drawing instructions that produced the rendered canvas. Edit My PDF walks the operator list to build a glyph stream: every glyph the page drew, in order, with the \`Tc\`, \`Tw\` and font size in force when it was drawn. It then pairs that stream with the text items, so each item knows the state it was drawn in and the summed advance of the glyphs matched to its letters.

<figure>
<div class="bp-dg bp-flow" aria-hidden="true">
${tile("file-text", "Text items", "a string, a transform and a width, from pdf.js")}
<span class="bp-flow-arrow">+</span>
${tile("binary", "Operator list", "every glyph drawn, with Tc, Tw and font size")}
<span class="bp-flow-arrow">→</span>
${tile("scan-text", "Glyph stream", "each item paired with the state it was drawn in")}
</div>
<figcaption>Two readings of the same page, joined. Without the pairing, a text item is only a string and a width.</figcaption>
</figure>

## Fitting each run

For every run, \`runSpacing\` answers one question: what letter spacing and word spacing make the browser set this string, in this face, exactly as wide as the page drew it?

::: cards
- {{move-horizontal}} **Letter spacing** starts as the stream's \`Tc\`, scaled from the operator's font size to the item's. If the page's glyph advances differ from the converted face's own (a substituted font, or one whose advances pdf.js adjusted), the mismatch is spread over the letters too, clamped to a few hundredths of an em.
- {{whole-word}} **Word spacing** takes whatever is left once the letters are measured, spread over the spaces. It is clamped to what a space can reasonably absorb.
- {{ruler}} **A run with no spaces** spreads the whole residual between its letters.
- {{scissors}} **The trailing gap** is trimmed: CSS letter spacing also trails the last glyph, while the page's width stops at its ink, so one letter-spacing is subtracted before the residual is computed.
:::

Details like that last one are most of the work.

## Fitting each line

Runs are grouped into lines by baseline. A line is then fitted as a whole: its runs are measured in their faces with their letter spacing, and the difference from the line's drawn width lands on its spaces as one word-spacing value for the line. A justified paragraph's lines each get their own value, which is how a justified block opens with every line exactly as long as it prints without the editor having to justify anything.

A line with no spaces, such as a table of contents entry whose dot leader runs into its page number, spreads the difference over its letter gaps instead.

## Keeping a block's layout

A multi-line block is more than its lines. \`blockFace\` picks the longest line's font as the block's face, the first line's baseline, the median baseline pitch as the line height, and infers the alignment from where the lines start and end. Then \`blockContent\` joins the lines into one editable text while recording, per line:

::: cards
- {{baseline}} **Its offset** from an even pitch, so a block whose lines alternate 15.75 and 15.0 points opens with every baseline where the page put it.
- {{wrap-text}} **Its indent** from the block's left edge, for a first-line indent, a hanging indent or a ragged left margin.
- {{whole-word}} **Its word gap**, the fitted word spacing from the previous step.
- {{split}} **Whether its line break is hard or soft.** A break the author chose (a centred or right-aligned block, a line that ends although the next word would still have fit, a hyphenated word) is a real newline. A break that only exists because the column ran out of room is soft: it is kept until you edit, and then becomes a space so the text can flow again.
:::

## Putting the editor on the baseline

The editor is a block of text laid out by the browser. For its first baseline to land on the PDF baseline, Edit My PDF needs the distance from the top of a CSS line box to the alphabetic baseline for this face at this line height. The browser rounds a font's ascent and descent to whole pixels when it builds a line box, so computing that distance from the font's metrics is wrong by up to a pixel at some zoom levels, and wrong in a way that changes as you zoom.

So the distance is measured. A hidden line containing "Hg" and a zero-size marker is set with the editor's exact font and line height, the marker's position is read, and the result is cached per face and line height once \`document.fonts.check\` says the face has finished loading. A face still loading measures with its fallback, and that measurement is thrown away.

::: tip {{microscope}} Measure, do not compute
This pattern comes up again and again in the editor: when the browser is the one doing the rounding, ask the browser what it did instead of predicting it.
:::

## Reading the pixels

Some things the content stream does not say plainly, and the rendered page does:

::: cards
- {{palette}} **Colour.** The colour of a run is read from the canvas under its box: the darkest fifteen per cent of ink pixels, averaged. Operator-list colours do not line up with text items reliably enough to use.
- {{square-dashed}} **Backdrop.** When you click, the background colour under the run is sampled from the edges of its box, so the edit's backdrop matches a tinted table cell as well as white paper.
- {{pen-line}} **Underline.** A single-line underline is found in the lower part of the run's box and reproduced, in its own colour, under the edited text.
- {{move-horizontal}} **Tails.** Runs on the same baseline immediately to the right of the clicked one are snapshotted, so when the edited text gets longer or shorter they move with it.
:::

## The pixel we lost to a border

::: story :grimace: Two pixels, for weeks
For a while every edit sat two pixels off in the editor and nowhere else. The page frame had a one-pixel CSS border. A border shrinks the canvas inside the frame by two pixels while the overlays above it keep the page's full size, so the rendered page and the editor disagreed by exactly that much. The frame now draws its edge with a box-shadow ring outside the box, and the comment in the stylesheet explains why so nobody puts the border back.
:::

<figure>
<div class="bp-dg" aria-hidden="true">
<div class="bp-pg"><div class="bp-frame bp-bordered"><div class="bp-canvas"></div><div class="bp-overlay"></div></div><span class="bp-dg-label">A border: the canvas shrinks, the overlays (dashed) do not</span></div>
<div class="bp-pg"><div class="bp-frame bp-ring"><div class="bp-canvas"></div><div class="bp-overlay"></div></div><span class="bp-dg-label">A ring outside the box: canvas and overlays agree</span></div>
</div>
</figure>

## What exact buys you

When all of this holds, clicking a line is undramatic. The text does not jump, the gaps do not change, and the caret appears where you clicked. Then you type, and from that point on the paragraph flows like any other text, inside its own column, in the page's own font.

::: good :sparkles: The quiet moment
That undramatic click is the whole product. Everything above exists so that nothing visible happens.
:::
`;

const EXPORT = `
Until recently, downloading an edited PDF from Edit My PDF gave you a page where every edit was a picture. The edited text was painted at three times resolution into a PNG and placed over a white patch that hid the original words. It looked right at a glance. It was also unsearchable, unselectable, blurry at high zoom, and it left the original words in the file underneath the patch, where a search or a copy would still find them. :grimace:

Edits are now written as text, in the page's own font, with the original strings removed. This post walks through the three steps that get there, and is honest about the few cases where a picture is still the right answer.

<figure>
<div class="bp-dg" aria-hidden="true">
<div class="bp-pg"><div class="bp-mini-page"><i class="bp-ln bp-w6 bp-head"></i><i class="bp-ln bp-w9"></i><i class="bp-ln bp-w8"></i><span class="bp-patch" data-label="png"><i class="bp-ln bp-w7 bp-edit"></i><i class="bp-ln bp-w7 bp-ghost"></i></span><i class="bp-ln bp-w9"></i><i class="bp-ln bp-w5"></i></div><span class="bp-dg-label">Before: a picture over a white patch, the old words still underneath</span></div>
<span class="bp-dg-arrow">→</span>
<div class="bp-pg"><div class="bp-mini-page"><i class="bp-ln bp-w6 bp-head"></i><i class="bp-ln bp-w9"></i><i class="bp-ln bp-w8"></i><i class="bp-ln bp-w7 bp-edit"></i><i class="bp-ln bp-w9"></i><i class="bp-ln bp-w5"></i></div><span class="bp-dg-label">After: real text in the page's own font, the old words gone</span></div>
<div class="bp-dg-legend"><span style="--sw: var(--tone)">your edit</span><span style="--sw: #a8a59c">original words, hidden but still in the file</span></div>
</div>
<figcaption>What the download used to contain, and what it contains now.</figcaption>
</figure>

::: plain :bulb: What is a content stream?
Every PDF page is a little program: a list of drawing instructions such as "use font F1 at 10.5 points", "move here", "show these characters". That list is the page's **content stream**. It has no idea what a word, a line or a paragraph is. It only knows where it put each glyph, which is why taking a sentence out of it takes some care.
:::

## Step one: take the original words out of the page

A PDF page's content stream cannot be edited by searching for a word, because the word may be five strings, and because moving one string moves everything drawn after it in the same text object. Edit My PDF's content-stream reader lexes the stream into operators with the byte range each one occupies, and tracks the text state as it goes: \`q\`/\`Q\`, \`cm\`, \`BT\`/\`ET\`, \`Tf\`, \`Tc\`, \`Tw\`, \`Tz\`, \`TL\`, \`Ts\`, \`Td\`, \`TD\`, \`T*\` and \`Tm\`. At every string shown by \`Tj\`, \`TJ\`, \`'\` or \`"\` it knows where the first glyph will land on the page.

A string whose first glyph starts inside an edited element's box (with a margin of a point and a half) is the element's text. It is replaced by a number inside a \`TJ\` array equal to the string's advance, computed from the page's font resources: \`/Widths\` and \`/MissingWidth\` for simple fonts, \`/W\` and \`/DW\` for CID fonts, scaled by the font matrix for Type 3. The cursor ends up exactly where the string would have left it, so the text that follows in the same object stays put. A \`TJ\` that spans a whole table row loses only the strings inside the box.

<figure>
<pre class="bp-stream" aria-hidden="true"><code><span class="bp-c">before: one TJ draws the whole line</span>
BT /F1 10.5 Tf 72 700 Td
[(Revenue) -278 (grew) -278 (nine) -278 (per) -278 (cent)] TJ
ET
<span class="bp-c">after the strip: "Revenue grew" was edited, the rest was not</span>
BT /F1 10.5 Tf 72 700 Td
[<del>(Revenue)</del><ins>-3890</ins> -278 <del>(grew)</del><ins>-2210</ins> -278 (nine) -278 (per) -278 (cent)] TJ
ET</code></pre>
<figcaption>Each string inside the edited box becomes a number worth exactly its advance (the values here are illustrative). "nine per cent", which you did not touch, lands where it always did.</figcaption>
</figure>

::: plain {{brackets}} Why a number and not just deletion?
Inside a \`TJ\` array a negative number moves the cursor to the right by that many thousandths of the font size. Swapping a string for its own width leaves a gap the exact size of the missing word. Delete the string outright and every word after it would slide left to fill the hole.
:::

\`'\` and \`"\` have side effects (a line feed, new word and character spacing) that are kept in front of the rewritten array. Inline images are skipped by their computed length, or by finding a free-standing \`EI\` when they are filtered. Streams are decoded with pdf-lib, joined, rewritten by splicing the byte ranges, with everything else copied verbatim, and written back as one flate stream.

::: warn {{frame}} Form XObjects are left alone
Text drawn by a form XObject (a reusable block of drawing that a page invokes with \`Do\`, such as a letterhead or a stamp) is not descended into. A \`Do\` whose bounding box meets an edited element marks that edit as uncertain, and the white backdrop is kept for it.
:::

## Step two: embed the font that pdf.js already decoded

The exported text has to be set in the same face as the page, and that face is a font pdf.js converted to OpenType when it rendered the page. Edit My PDF asks pdf.js to keep those bytes (\`fontExtraProperties\`) and embeds them with pdf-lib and fontkit, taking the cmap-corrected copy when the editor registered one.

Subsetting is not optional. A converted font carries the original font's whole glyph table, around 800 kilobytes per face in our tests. With \`subset: true\` only the glyphs the edits use are written.

<figure>
<div class="bp-dg" aria-hidden="true">
<div class="bp-pg">${glyphGrid(ALPHABET, USED)}<span class="bp-dg-label">The converted font: every glyph, about 800 KB</span></div>
<span class="bp-dg-arrow">→</span>
<div class="bp-pg">${glyphGrid(USED, USED, "bp-glyph-grid bp-small")}<span class="bp-dg-label">The subset: only the glyphs your edit uses</span></div>
</div>
<figcaption>Subsetting keeps the glyphs the edited words need and drops the rest of the table.</figcaption>
</figure>

::: good :chart: What it saved
A press release with a heading and a paragraph edited came out at 250 kilobytes against 232 for the original. Without subsetting it would have gained about 350 kilobytes per face. If pdf-lib cannot subset a particular font, the whole font is embedded rather than giving up.
:::

## Step three: place each word where the editor showed it

The editor already knows where every word sits: the same layout function that draws the on-page editor returns each run's words with an absolute x position and a baseline. Export writes one text matrix and one \`TJ\` per run. The text matrix maps the editor's page coordinates onto the PDF page, including any page rotation. \`Tc\` is set to the run's letter spacing; \`Tz\`, \`Tw\` and \`Ts\` are reset so nothing inherited from the page leaks in.

Inside the \`TJ\` array, every word but the first is preceded by a kern that lands it exactly where the editor put it. No space glyph is written at all, because the converted fonts have none. A justified line therefore exports with the same word gaps the editor showed, computed rather than set.

<figure>
<div class="bp-dg bp-kern-line" aria-hidden="true"><span class="bp-kw">Revenue</span><span class="bp-kg">−278</span><span class="bp-kw">grew</span><span class="bp-kg">−305</span><span class="bp-kw">nine</span><span class="bp-kg">−291</span><span class="bp-kw">per</span><span class="bp-kg">−284</span><span class="bp-kw">cent</span></div>
<figcaption>No space characters: each gap is a kern that drops the next word exactly where the editor had it, so a justified line keeps its own gaps.</figcaption>
</figure>

::: plain {{move-horizontal}} Kern, in this sense
Typographers use "kern" for the tightening between two particular letters. In a \`TJ\` array it is simply a number that moves the cursor before the next string. Export uses those numbers as the spaces between words, measured rather than typed.
:::

## When it still paints a picture

Three cases fall back to the old PNG path, for that one edit only. Everything else on the page is exported as text.

::: cards
- {{type}} **No outlines to embed.** The face is a Type 3 font, whose glyphs are tiny drawing programs rather than outlines, or a font the PDF did not embed and pdf.js matched to a system font. There are no bytes to write the text in.
- {{bug}} **pdf-lib cannot parse the converted font.** Rare, but it happens. Rather than fail the whole download, that edit is painted.
- {{keyboard}} **A character the subset has no glyph for.** You typed a "ß" into a font that never had one. The editor already shows such a character in a fallback face, so nothing is hidden from you.
:::

::: note {{square-dashed}} When the white backdrop is drawn
Only when it is needed: when the strip removed nothing or was uncertain, when a tail to the right of the edit had to move, or when the run has an underline that the removed text no longer provides.
:::

## Checking the result

::: steps
- **Load it back.** The exported file is opened in the editor again, like any other PDF.
- **Run the same probe.** The fidelity probe that checks the editor against the original page is run against the export.
- **Compare every element.** For the press release, pdf.js reads the edited words from the exported file, both edits open as editable text in the embedded face, and every other text item on both pages is at the position it had in the original.
:::

::: good :trophy: The number that matters
Every element in the re-opened export measured within two hundredths of a point of where the editor showed it.
:::

## What is left

Two gaps remain, both narrow.

::: cards
- {{frame}} **Text inside form XObjects** is covered rather than removed, as above.
- {{ruler}} **Fonts with no width information**, such as one of the standard fourteen fonts used without embedded metrics, have their strings removed without the compensating advance, so later text in the same text object could shift. Standard-font metrics would close that gap, and it is on the list.
:::
`;

const MIXED = `
Most text on a page is set in one face. The exceptions are the interesting ones: a paragraph with a bold lead-in, a sentence with an italic title in it, a definition whose term is set in small caps. A reader sees one paragraph. A textarea can hold only one font. So a paragraph that mixes faces needed its own editor. :thinking:

## The model: spans, not runs

When Edit My PDF reads a page it collects text runs, the pieces pdf.js reports, each in one font. For a line, adjacent runs in one face are joined into a span; a gap wider than a sliver becomes a space; whitespace collapses the way the text would read. A span records its family, weight, style, size, colour, the PDF font it came from, and its own letter spacing when the page tracked it apart from its neighbours. It also keeps the page box its glyphs occupy, because the colour is read from the rendered pixels under that box.

Then the lines of a block are joined, and neighbouring spans in the same face whose colours are as good as equal (within 20 on each channel) are merged, so a paragraph read line by line edits as a few runs rather than one per line.

<figure>
<p class="spans-demo"><span data-face="bold"><b>Revenue.</b></span> <span data-face="regular">Revenue grew nine per cent to $4.2 billion, with growth in</span> <span data-face="italic"><i>every</i></span> <span data-face="regular">region.</span></p>
<figcaption>One paragraph, four spans. Each span carries its face, size, colour and PDF font name; the text between them is one string with the spans laid over it.</figcaption>
</figure>

::: plain :bulb: Run versus span
A **run** is what pdf.js hands over: a fragment of text in one font, often one per line or less. A **span** is what the editor works with: the longest stretch of text that shares one look. Several runs make a span; a few spans make a paragraph.
:::

## Deciding what belongs together

Which lines flow into one paragraph? Two lines can continue each other when they share a dominant face, or when the next line's face already appears in the previous one. That second rule is what joins a bold lead-in to the regular text that follows it.

The reverse pairing is deliberately left apart: a single-face line above a mixed line that merely contains its face. That is what a heading followed by a paragraph with a bold lead-in looks like, and pdf.js cannot tell a heading face from a bold one when the weight is baked into the font outlines.

::: warn {{bold}} Why the rule is one-way
Getting this wrong would swallow headings into paragraphs. A bold heading and a bold lead-in look identical to pdf.js, so the editor errs on the side of keeping a heading on its own.
:::

## The editor owns its DOM

The mixed-face editor is a \`contentEditable\` block with one \`<div>\` per line and one \`<span>\` per styled run. React does not render its contents; the component does, from the model, and it intercepts every edit before the browser applies it.

::: plain {{text-cursor-input}} contentEditable and beforeinput
**contentEditable** turns any part of a web page into something you can type into. Left to itself the browser edits the markup however it likes, which would wreck the spans. The **beforeinput** event fires just before each edit and says what the browser intends to do, which is the moment to step in.
:::

A \`beforeinput\` event tells us what the browser is about to do. The affected character range is read from the event's target ranges, the change is applied to the spans in the model, the lines are drawn again, and the caret is put back.

::: cards
- {{keyboard}} **Typed text** takes the face of the character before the caret, so a new word typed after a bold run stays bold.
- {{split}} **Line breaks** become a real newline in the model and a new line \`<div>\`.
- {{eraser}} **Deletes**, backward or forward, remove the range from the spans; a span that loses all its text disappears, except the last one, which stays so typing can continue.
- {{languages}} **Composed input** (Japanese, Chinese, dead keys) cannot be intercepted this way. For those the editor lets the browser apply the change and then reconciles: it reads the DOM text back, finds the common prefix and suffix against the model, and applies the difference as one edit.
:::

::: note {{history}} Its own undo
The editor keeps its own undo history of two hundred steps and handles Cmd+Z and the browser's \`historyUndo\` input itself, so undo moves through spans rather than through whatever the browser's contentEditable undo would do to our DOM.
:::

## Lines where the page put them

Because the component draws the lines, it can also place them. Each line \`<div>\` gets the page's indent for that line (as a text indent on the first line, as padding on the others), a top margin for its baseline offset from an even pitch, and the page's own word spacing for that line. A line the page gave a word gap is already exactly as wide as printed and is never stretched; only a line that flows again after an edit in a justified block is justified by the browser.

Caret positions are character offsets into the whole text. A small helper maps between those offsets and DOM selection points, with the one subtlety that the newline between two line \`<div>\`s has no node of its own.

## Letting the text flow

A paragraph opens with every line break of the page. Breaks that only exist because the column ran out of room are marked soft.

::: pair When it opens | After the first edit
- Every line break of the page is kept, soft or hard.
- Every line has the page's indent, baseline offset and word gap.
- Nothing is re-wrapped, so nothing moves.
---
- Soft breaks from the edit onward become spaces, so the text reflows inside the paragraph's width.
- Lines above the edit keep their printed breaks, gaps and positions.
- Offsets are preserved through the change, so the caret does not jump.
:::

## Export

Each span's face is embedded separately on export, and each word is placed in its own span's face at the position the editor showed.

::: good :handshake: One layout, three uses
The same layout code serves the editor, the painted fallback and the real-text export, which is the only reason they agree.
:::
`;

const PRIVACY_POST = `
"Your files are safe with us" is a sentence a PDF service has to say because it has your files. Edit My PDF does not have them. This post explains the architecture that makes that true, what it costs, and how you can check it yourself. :lock:

## There is no server

Edit My PDF is a single-page application built with React and Vite. When you open it, your browser downloads the app's JavaScript, stylesheets, fonts and icons, and from then on everything happens in the tab.

<figure>
<div class="bp-dg bp-flow" aria-hidden="true">
${tile("file-text", "Your PDF", "opened from your disk")}
<span class="bp-flow-arrow">→</span>
${tile("cpu", "Your tab", "pdf.js reads it, you edit it, pdf-lib writes it")}
<span class="bp-flow-arrow">→</span>
${tile("download", "Your downloads", "the new file, saved by the browser")}
${tile("server-off", "No server", "nothing to upload to, nothing to leak from", "bp-flow-tile bp-off")}
</div>
<figcaption>The whole path of a document. Nothing on it leaves your machine.</figcaption>
</figure>

<dl class="kv">
<dt>Reading</dt><dd>pdf.js parses the PDF and renders pages to canvases inside a web worker bundled with the app.</dd>
<dt>Editing</dt><dd>Edits are a list of changes kept in memory next to the file: a text patch, a pencil stroke, a shape.</dd>
<dt>Saving</dt><dd>The file's bytes and the edit list are written to IndexedDB in your browser, so the document's link keeps working after a refresh.</dd>
<dt>Downloading</dt><dd>pdf-lib builds the new PDF in the tab; the browser saves it from a temporary blob URL.</dd>
</dl>

::: plain :bulb: Web worker? IndexedDB?
A **web worker** is a background thread inside your browser tab, so heavy work such as rendering a page does not freeze the interface. **IndexedDB** is a small database every browser keeps on your own disk, per website. Both live on your computer; neither is a service.
:::

There is no upload endpoint because there is no backend. The repository has no server code at all. The only \`fetch\` call in the application loads the emoji images from the app's own files when an emoji is exported.

## What the app does ask the network for

Honesty requires the whole list. The app requests its own static files from wherever it is hosted. The host sees what any web server sees for those requests: your IP address, your browser's user agent and the page address. It never receives your document, your edits or your file's name, because the app does not send them. There is no analytics script, no error reporting service, no account system and no third-party embed on the editor pages.

## What this architecture buys

::: cards
- {{ban}} **No limits that exist to sell an upgrade.** There is no file counter, no size cap and no watermark. The only limit is your browser's memory.
- {{zap}} **No waiting on an upload.** A 50-megabyte scan opens as fast as your disk can read it.
- {{map-pin}} **Documents that stay where you put them.** Each PDF you open gets its own link in this browser. You can keep several open in tabs, and a refresh restores each one with its edits.
:::

## What it costs

::: cards
- {{scan-text}} **No OCR and no conversion.** Recognising text in a scan, or turning a PDF into a Word file, needs large models or engines that are better run on a server. Edit My PDF does not pretend to do them; the [comparisons](/compare) say which tools do.
- {{hard-drive}} **One browser, one machine.** Your documents are not synced anywhere. Open the same link on another computer and it will not know the document.
- {{gauge}} **Memory.** Everything is in RAM. A very large file is limited by what the browser will hold.
:::

## How to check for yourself

::: steps
- **Open the developer tools** in your browser and choose the Network tab.
- **Open a PDF** in Edit My PDF, edit a line and download the result.
- **Read the list.** You will see requests for the app's own files and nothing else. No request carries your PDF.
:::

If you read code, the editor's source is public. The reader is \`src/pdf.ts\`; the writer is \`src/exportPdf.ts\`; storage is \`src/session.ts\`. Search the \`src\` directory for \`fetch\` and you will find the emoji loader and nothing more.

## Things we cannot promise

::: warn {{shield-check}} The limits of a client-side promise
The browser is yours, and so is everything in it. A browser extension can read the pages you have open. Your downloads folder is as safe as your computer. And the host that serves the app can see that you loaded it. Those are the limits of what a client-side application can promise, and we would rather state them than pretend they do not exist.
:::
`;

const LEAVES_ALONE = `
Knowing what an editor will not touch matters as much as knowing what it can. Edit My PDF reads a page carefully, and part of reading carefully is deciding what to leave alone. This post lists those decisions, with the reason for each. :raised-hand:

## Text the page painted over

A PDF can draw text and then paint a filled box or an image over it. Readers never see that text, but it is still in the file. An earlier version of Edit My PDF exported edits as pictures over a white backdrop, so a file that had been edited and re-opened carried its original words under each patch.

<figure>
<div class="bp-dg" aria-hidden="true">
<div class="bp-pg"><div class="bp-mini-page bp-wide"><i class="bp-ln bp-w6 bp-head"></i><i class="bp-ln bp-w9"></i><span class="bp-paint" data-label="painted later"><i class="bp-ln bp-w8 bp-ghost"></i><i class="bp-ln bp-w5 bp-ghost"></i></span><i class="bp-ln bp-w9"></i><i class="bp-ln bp-w7"></i></div><span class="bp-dg-label">Two lines under an opaque fill: in the file, invisible on the page, not offered for editing</span></div>
</div>
</figure>

The page reader now tracks every opaque fill and image with the order it was painted in. A text run that lies wholly under opaque paint applied after it is not offered for editing.

::: good {{eye}} The rule
What you can click is what you can see.
:::

## Tables

Rules, the thin filled rectangles that make up table borders, are collected from the operator list, merged where they touch, and joined into table boxes. A table is an element of its own: you can move it or resize it as a block. The text inside its cells stays reachable as text, so a figure in a cell can still be clicked and retyped, and the shapes that happen to sit inside a table are not reported twice.

## Fonts without outlines to embed

Three kinds of text open in a fallback face rather than the page's own:

::: cards
- {{type}} **A Type 3 font**, whose glyphs are small drawing programs rather than outlines.
- {{package}} **A font the PDF did not embed**, which pdf.js renders with a matching system font.
- {{keyboard}} **A character you type** that the embedded subset has no glyph for.
:::

In all three cases the editor still fits the line to its printed width, so it opens looking right. On download, such an edit is painted as an image rather than written as text, because there is no face to write it in. Everything else on the page is unaffected.

::: plain :bulb: Type 3, in a sentence
Most fonts describe each letter as an outline that can be scaled and filled. A **Type 3** font describes each letter as a tiny PDF drawing. It renders fine, but there is no outline to hand to the browser or to embed in an export.
:::

## Text inside form XObjects

A form XObject is a reusable block of drawing that a page invokes with \`Do\`. Letterheads, stamps and some page templates live there. Edit My PDF's export removes the original strings under an edit from the page's own content stream, but it does not descend into forms. When a form's bounding box meets an edited element, that edit is marked uncertain and a backdrop is kept under it, so the result looks right even though the covered text is still in the file.

## Spaces the page never drew

Some text reaches pdf.js with spaces that are not on the page. Tracked small caps arrive as a space after nearly every letter. Two-byte space codes in Identity-H fonts have word spacing added by the text extractor that the renderer never applied.

<figure>
<p class="bp-phantom" aria-hidden="true">S<i>␣</i>M<i>␣</i>A<i>␣</i>L<i>␣</i>L <i>␣</i>C<i>␣</i>A<i>␣</i>P<i>␣</i>S</p>
<figcaption>Tracked small caps as the text extractor reports them. The struck spaces were never drawn; the page only spread the letters.</figcaption>
</figure>

The glyph stream read from the operator list knows what was really drawn, so the fake spaces are removed and the drifted positions pulled back. The text you edit is the text the page shows.

## List markers and hyphens

::: cards
- {{list}} **Bullets** are usually drawn in a smaller font, and a bullet's box sorts after the first line of its item. The reader recognises a marker beside a line and keeps the two together.
- {{split}} **Hyphens** at the end of a line mark a hard break, since breaking the line elsewhere would split the word; it stays a hyphenated line until you edit it.
:::

## Lines you did not touch

The most important thing the editor leaves alone is the rest of the paragraph. A block opens with every line break the page made, every line's own baseline and indent, and every line's own word gap. The first edit lets the text flow again from that point onward; the lines above it keep their printed layout.

::: good :sparkles: Nothing happens because you clicked
Nothing is re-justified, re-kerned or re-wrapped because you clicked. Only what you type changes.
:::

## What you cannot do, by design

::: cards
- {{scan-text}} **Edit a scanned page's text.** There is no OCR; you can annotate on top.
- {{lock}} **Open a password-protected file.**
- {{layers}} **Merge, split, compress, convert or fill forms.** Edit My PDF opens one PDF and writes one PDF.
:::

For those jobs the [comparison pages](/compare) are honest about which tool to use instead.
`;

const EDIT_FREE = `
You need to change one date in a PDF. One. Single. Date. :sweat:

So you search "edit PDF online free", click the first result, and twenty seconds later you are being asked to create an account, accept a cookie banner the length of a novel and upload your file to a server you have never heard of. All for one date.

There is a better way. This guide shows you how to edit a PDF for free, in your browser, **without uploading it anywhere**, and explains why that last part matters more than most "free PDF editor" lists admit. :lock:

## The short version

::: steps
- **Open Edit My PDF.** [Open it](/app) in Chrome, Edge, Firefox or Safari. No account, no install.
- **Drop your PDF onto the page.** It opens from your disk and stays there.
- **Click the line you want to change.** Type your fix. The line opens in the page's own font, size and colour.
- **Download.** You get a real PDF with real, selectable text. No watermark.
:::

That's it. If that is all you needed, go and fix your date. :wave: If you are curious why "no upload" is the headline feature, read on.

![Edit a PDF in four steps: open your PDF, click any line, type your change, download. No sign-up, no upload, no watermark, about a minute, zero accounts created.](/blog/four-steps.webp#1600x1726 "Four steps, about a minute, zero accounts. The whole job happens in your browser tab.")

## Why "free" PDF editors usually aren't

Running servers costs money. When a website processes your PDF on its own machines, somebody pays for the electricity, the storage and the engineers, and "free" has to be recovered somewhere. Usually it's recovered from you, in one of these currencies:

::: cards
- {{badge-check}} **Watermarks.** Your contract, now with a logo stamped across it. Very professional.
- {{timer}} **Task limits.** Two free edits a day, then a friendly pop-up suggests a subscription.
- {{lock}} **Sign-up walls.** Edit for free, then create an account to download what you edited.
- {{upload}} **Your file itself.** It travels to their server and stays there for a while.
:::

![A bingo card of free PDF editor catches: create an account to download, a watermark on every page, a daily task limit, your file kept for hours on a server, a file size cap, new text in the wrong font, an upgrade pop-up, and deletion within a reasonable period. Edit My PDF scores zero squares.](/blog/bingo.webp#1600x1699 "Free PDF editor bingo. Most tools can fill a row before you have changed a word.")

The first three are annoying. The fourth is the one worth thinking about. :thinking:

## Your PDF's road trip

Here is what usually happens when you "edit a PDF online":

1. Your browser uploads the **entire file** to the company's server.
2. The server opens it, applies your changes and stores the result.
3. You download the new file.
4. The original and the result stay on that server for a while.

How long is "a while"? We read the published policies of a dozen popular online PDF tools for our [comparison pages](/compare). The answers range from **one hour**, to **two hours**, to **24 hours**, to "within a reasonable period", to **"until you delete it"**. Some tools also send document content to third-party AI services for their AI features.

None of that is necessarily sinister. Most of these companies are doing their best. But think about what goes into PDFs: bank statements, payslips, tax forms, medical letters, contracts, passport scans. Every upload is one more copy of your private life, sitting on one more computer you do not control, protected by one more company's security team. :grimace:

![Two routes for one PDF edit. A typical online editor uploads the file to its server, keeps it for one hour to indefinitely, then sends it back. Edit My PDF opens, edits and rebuilds the file inside your browser tab, then saves it to your Downloads: zero kilometres travelled.](/blog/road-trip.webp#1600x1574 "Same edit, two routes. Only one of them needs your file to leave home.")

## How Edit My PDF does it without a server

Edit My PDF has no server to upload to. Literally: the project has no backend code at all. When you open the site, your browser downloads the app itself (some JavaScript, fonts and icons), and from that moment everything happens inside your tab.

::: cards
- {{file-text}} **Reading.** pdf.js, the same engine Firefox uses to show PDFs, opens your file inside the tab.
- {{pen-line}} **Editing.** Your changes are a list kept in your browser's memory, next to the file.
- {{hard-drive}} **Saving.** The file and your edits go into your browser's own storage on your disk, so a refresh does not lose your work.
- {{download}} **Downloading.** pdf-lib builds the new PDF in the tab, and your browser saves it like any other download.
:::

::: plain :bulb: So who can see my PDF?
You can. That's the list. The website that serves the app sees that someone loaded the app, the same way every website sees a visit. It never receives your document, its name or your edits, because the app never sends them.
:::

If you want the deep-dive, our post on [how Edit My PDF is built](/blog/nothing-leaves-your-browser) goes through it piece by piece, and the [privacy page](/privacy) lists exactly what the site does and does not collect.

## It edits the text that is already there

Plenty of "PDF editors" let you put a white box over the old words and type new ones on top in Arial. From across the room it looks fine. Up close, your carefully typeset invoice now has one line in a different font, slightly too big, slightly too low. :eyeroll:

Edit My PDF does the harder thing. When you click a line, it opens **in the PDF's own embedded font**, at its exact size, colour, letter spacing and word spacing. When you download, your edit is written back as real text in a subset of that same font, so it can still be selected, searched and copied.

::: pair Cover-up editors | Edit My PDF
- A white box hides the old text
- New text in a substitute font
- Spacing that never quite matches
---
- The original text is replaced
- The page's own font, size and colour
- Real, searchable text in the export
:::

## What else you can do (for free, still offline-ish)

::: cards
- {{type}} **Fix text.** Typos, dates, names, prices, whole paragraphs. Bold and italic runs keep their style.
- {{pen-line}} **Sign.** Type your name in a handwriting style or upload a photo of your signature. More on that in [how to sign a PDF without uploading it](/blog/sign-pdf-online-free-without-uploading).
- {{paintbrush}} **Mark up.** Pencil, rectangles, ellipses, lines and arrows, plus emoji when a document needs a :thumbsup:.
- {{history}} **Undo anything.** Every change is undoable, and the documents screen keeps your recent files in this browser.
:::

## What it won't do (honesty corner)

We would rather tell you now than have you find out at 11:58pm before a deadline. :pray:

::: bad The things a browser-only editor skips
**No OCR**, so a scanned page is a picture and its words cannot be retyped. **No conversion** to Word or Excel. **No merging, splitting or compressing**, and **no form filling** yet. Your documents are kept in this browser only, so they do not sync to your other devices. If you need those, our [comparisons](/compare) say honestly which tools do them.
:::

## Frequently asked questions

### Is it really free?

Yes. There is no paid plan, no trial and no watermark. Edit My PDF is open source under the MIT licence, and because it needs no servers to run your edits, there is no processing bill for anyone to recover.

### Do I need to sign up or install anything?

No. Open the page and drop a PDF in. Nothing to install, no email address, no password to forget.

### Can I edit a PDF without Adobe Acrobat?

Yes. For changing existing text, adding a signature and marking up pages, a browser editor like Edit My PDF does the job. You'll still want a full desktop suite for things like OCR or preflight checks for print.

### Is it safe to edit confidential PDFs?

The file never leaves your computer, which removes the biggest risk: a copy of your document on somebody else's server. Your own computer still matters, of course. A dodgy browser extension can read any page you have open, so be choosy about those. :innocent:

### Does it work on a Mac, Windows or a Chromebook?

It runs in current Chrome, Edge, Firefox and Safari, so Windows, macOS, Linux and ChromeOS are all fine. Phones work too, though the panels are happier on a laptop or tablet screen.

## Go fix that date :rocket:

You came here to change one line in a PDF. [Open Edit My PDF](/app), drop the file in, click the line and type. Your PDF stays home the whole time, the way it should have all along. :house:
`;

const SIGN_FREE = `
Somebody has emailed you a PDF with the words "please sign and return". :envelope:

Ten years ago that meant: print it, sign it, find a scanner, discover the scanner is out of toner, take a photo with your phone instead, email back a slightly crooked JPEG and hope for the best.

Today you can sign a PDF online for free in about a minute. But most "sign PDF online" tools want you to upload the document first, and the documents we sign are, almost by definition, **the most personal files we own**. So this guide shows you how to add a signature to a PDF without the file ever leaving your computer. :lock:

## How to sign a PDF in 60 seconds

::: steps
- **Open your PDF.** Go to [Edit My PDF](/app) and drop the file onto the page. It opens from your disk; nothing is uploaded.
- **Choose Sign.** It sits in the tool rail on the left, or press <kbd>G</kbd>.
- **Make your signature.** Type your name and pick a handwriting style, or upload a photo or scan of your real signature (PNG, JPEG or WebP).
- **Place it.** Click where it goes, then drag to move it and pull a corner to resize.
- **Download.** The signed PDF lands in your Downloads folder. Send it back and enjoy the rest of your day. :coffee:
:::

![Sign a PDF in 60 seconds: open the PDF at 0:00, choose Sign at 0:10, type or upload your signature at 0:20, place it at 0:40, download at 0:55. Your saved signature lives only in this browser's storage.](/blog/sign-in-60.webp#1600x1256 "From inbox to signed in about a minute. No printer, no scanner, no upload.")

::: tip :sparkles: Tip: it remembers you (locally)
After you place a signature, Edit My PDF keeps it in this browser's own storage, so next time it is one click away. It is never sent anywhere, because there is nowhere to send it. Clear your browser's data and it is gone.
:::

## Why signing deserves extra privacy

Think about the last few things you signed. A rental agreement. An offer letter. A loan application. A medical consent form. An NDA.

Now think about what was **in** them. :thinking:

![Anatomy of a lease agreement: full legal name, home address, date of birth, phone and email, income and salary, bank details, ID or passport number and your signature, all in one PDF.](/blog/whats-inside.webp#1600x1501 "One lease agreement, eight things an identity thief would love. Sensitivity: five flames.")

A typical document you are asked to sign can contain your full name, home address, date of birth, salary, bank account details, ID numbers, and then, as the cherry on top, a picture of your signature. That is not a file. That is a starter kit. :grimace:

When you upload that document to a free online signing tool, a copy of all of it lives on a server for a while. Published retention windows for popular online PDF tools range from an hour to "until you delete it", and signed documents are often kept **longer** than other files, because e-signature services keep records. Again: these companies are mostly not villains. But the safest copy of your data is the one that was never made.

::: plain :bulb: The core idea
Edit My PDF opens, signs and rebuilds your PDF entirely inside your browser tab. There is no server behind the editor, so there is no copy to leak, to keep, to back up or to forget about. Your PDF goes from your disk, to your screen, to your Downloads folder.
:::

## Electronic signature vs digital signature (in plain words)

These two terms get mixed up constantly, and the difference matters. :pin:

::: pair Electronic signature | Digital signature
A picture or typed version of your signature placed on the document. This is what you get when you "sign" a PDF in most free tools, **including Edit My PDF**. It is what most everyday paperwork asks for: leases, permission slips, invoices, timesheets, HR forms.
---
A cryptographic seal tied to a certificate that proves who signed and that nothing changed afterwards. It needs a certificate from a trust provider and is used for some legal, government and financial filings. Edit My PDF **does not** create these.
:::

::: warn Check what the sender needs
If a document says it needs a "certified", "qualified" or "digital" signature, ask the sender what they accept. For a normal "please sign and return", a typed or drawn signature is what they mean. We are an editor, not your lawyer. :innocent:
:::

## Typed or uploaded: which signature should you use?

::: cards
- {{type}} **Typed.** Type your name and choose one of the handwriting styles. Ten seconds, looks neat, and nobody needs to know your actual signature looks like a seismograph reading.
- {{image}} **Uploaded.** Sign a sheet of white paper, take a well-lit photo or scan it, and upload it. Looks exactly like you, because it is you.
:::

Either way, the signature image stays in your browser. Edit My PDF never sees it, because Edit My PDF has no "it" on the other end to see anything.

## "Trust us" is not a privacy policy. Here's how to check

Every PDF website says your files are safe. You do not have to take anyone's word for it, ours included. Your browser can show you every request a page makes, and an upload is hard to hide: it is a request about as big as your file.

![A 60-second test: open the developer tools and the Network tab, use the PDF tool, then look for a request as big as your PDF. If you find one, your file went on a trip. If nothing carries your file, it stayed home.](/blog/network-test.webp#1600x1390 "The Network-tab test. Works on any PDF tool, takes a minute.")

::: steps
- **Open the developer tools.** Press <kbd>⌥ ⌘ I</kbd> on a Mac or <kbd>Ctrl ⇧ I</kbd> on Windows, Linux and ChromeOS, then pick the **Network** tab.
- **Use the tool.** Open a PDF, sign it, download it.
- **Read the list.** Sort by size. If one request is about as big as your PDF, that was your PDF leaving the building. :airplane:
:::

With Edit My PDF you will see the app loading its own files and nothing that carries your document. That's not a promise in a policy. It's just how the thing is built.

## What else can you do while you're there?

::: cards
- {{type}} **Fix a typo before you sign.** Click any line and retype it in the page's own font. Wrong date? Misspelled name? Sorted.
- {{pen-line}} **Initial every page.** Place the same saved signature as many times as you need.
- {{paintbrush}} **Tick boxes and add notes.** Use the pencil, shapes and text to fill in the bits that aren't proper form fields.
- {{badge-check}} **No watermark, ever.** Your signed contract won't advertise anyone.
:::

::: bad What it doesn't do
No certificate-based digital signatures, no sending the document out for other people to sign, no audit trails and no fillable form fields yet. For multi-party signing workflows you want a dedicated e-signature service. For "sign this and send it back", you don't.
:::

## Frequently asked questions

### Is it free to sign a PDF with Edit My PDF?

Completely. No account, no trial, no limit on how many documents you sign, and no watermark.

### Is my signature stored anywhere?

Only in your own browser's storage on your own computer, so you can reuse it. It is never uploaded. Clearing your browser data removes it.

### Can I sign a PDF on a Mac or Windows without Adobe?

Yes. Edit My PDF runs in Chrome, Edge, Firefox and Safari, so it works the same on Windows, macOS, Linux and Chromebooks, without installing Acrobat or anything else.

### Is a typed signature legally valid?

In many countries an electronic signature, typed or drawn, is accepted for everyday agreements, but the rules depend on where you are and what you are signing. When it matters, ask the person who sent the document what they accept.

### Can I sign on my phone?

The editor runs in mobile Safari and Chrome and understands touch for drawing, dragging and pinch zoom. It is more comfortable on a laptop or tablet, but a phone will do in a pinch. :ok:

## Sign it where it already is :house:

The document is already on your computer. Your signature is already on your computer. There's no good reason for either to take a trip to somebody else's. [Open Edit My PDF](/app), sign, download, done. :clap:
`;

export const POSTS: Post[] = [
  {
    slug: "edit-pdf-online-free-without-uploading",
    title: "How to edit a PDF online for free, without uploading it",
    description:
      "Edit the text in a PDF for free, with no sign-up, no watermark and no upload. A four-step guide, and why your PDF shouldn't take a road trip to someone else's server.",
    date: "2026-11-04",
    tags: ["how-to", "privacy"],
    keywords: [
      "edit pdf online free",
      "free pdf editor",
      "pdf editor no sign up",
      "edit pdf without uploading",
      "edit text in pdf",
      "pdf editor no watermark",
      "private pdf editor",
      "edit pdf without adobe",
    ],
    cover: { glyph: "0 km", hue: "teal" },
    image: {
      src: "/blog/edit-pdf-free-card.png",
      alt: "How to edit a PDF online for free, without uploading it. No upload, no sign-up, no watermark.",
      width: 1200,
      height: 630,
    },
    body: EDIT_FREE,
  },
  {
    slug: "sign-pdf-online-free-without-uploading",
    title: "How to sign a PDF online for free, without uploading it",
    description:
      "Add a typed or uploaded signature to a PDF in about a minute, free, with no account and no upload. Plus electronic vs digital signatures, and how to check a tool's privacy yourself.",
    date: "2026-11-04",
    tags: ["how-to", "privacy", "signatures"],
    keywords: [
      "sign pdf online free",
      "add signature to pdf",
      "electronic signature free",
      "sign pdf without uploading",
      "how to sign a pdf",
      "sign pdf without adobe",
      "e-sign pdf",
    ],
    cover: { glyph: "J.D.", hue: "violet" },
    image: {
      src: "/blog/sign-pdf-free-card.png",
      alt: "How to sign a PDF online for free, without uploading it. No upload, no sign-up, no watermark.",
      width: 1200,
      height: 630,
    },
    body: SIGN_FREE,
  },
  {
    slug: "exporting-real-text",
    title: "Exporting edits as real text, in the page's own font",
    description:
      "How Edit My PDF removes the original strings from a page's content stream, embeds a subset of the font pdf.js decoded, and writes your edit as positioned text rather than a picture.",
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
    title: "Nothing leaves your browser: how Edit My PDF is built",
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
