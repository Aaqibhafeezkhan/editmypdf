// Comparison facts for every competitor page and the roundup table. One file, so a price change or
// a corrected fact is edited in one place. Every entry says when it was checked and where.
//
// Rules for this file: a fact comes from the vendor's own page unless the text says otherwise;
// a number the vendor does not publish is written as "not published", never guessed; prices are
// given in the currency and form the vendor showed, and regional pricing is named as such.
//
// This file must stay free of browser-only imports: vite.config.ts reads it to build the sitemap.

export type Tri = "yes" | "no" | "partial" | "unknown";

export type Source = { label: string; url: string; accessed: string };

// The tool's mark: its own icon as a file under public/ (fetched from the vendor's site, see the
// hand-over note for the script), with one or two letters and an approximate brand hue for a
// monogram badge used wherever the file is missing. Logos belong to their owners and are shown
// only to identify the product compared; the footer and the terms page say so.
export type Brand = {
  monogram: string;
  color: string;
  logo?: string;
  // A "PDF Edit vs <tool>" card image under public/, rendered from the mark, the logo and the
  // site's fonts by the same script that writes the logos.
  thumbnail?: string;
};

// The lowest paid price as a figure for tables and charts, with the caveats the prose carries.
// The flags must stay visible wherever the figure is shown.
export type StartingPrice = {
  // "$44.99", "$7–15" or "Free".
  figure: string;
  per: "month" | "year" | "week" | "";
  // The figure is rounded, converted, or taken from a listing rather than read exactly.
  approximate?: boolean;
  // The vendor prices by region; the figure is one region's.
  regional?: boolean;
  // The figure comes from third-party listings, not the vendor's own page.
  thirdParty?: boolean;
  // The vendor shows the price only at checkout.
  checkoutOnly?: boolean;
  // The plan and billing the figure refers to.
  note?: string;
};

export const TRI_LABEL: Record<Tri, string> = { yes: "Yes", no: "No", partial: "Partly", unknown: "Not stated" };

export function triWord(value: Tri, words: Partial<Record<Tri, string>> = {}): string {
  return words[value] ?? TRI_LABEL[value].toLowerCase();
}

export type Tool = {
  slug: string;
  name: string;
  vendor: string;
  url: string;
  // One sentence on what the product is.
  summary: string;
  processing: {
    where: "server" | "browser" | "mixed";
    // Plain-language note shown in tables.
    note: string;
    retention: string;
  };
  account: { required: Tri; note: string };
  free: {
    summary: string;
    fileSizeCap: string;
    taskLimit: string;
    watermark: Tri;
    editsExistingText: Tri;
  };
  paid: { name: string; price: string; note?: string }[];
  priceFrom: string;
  startingPrice: StartingPrice;
  brand: Brand;
  textEditing: { existing: Tri; keepsFont: Tri; note: string };
  features: {
    annotate: Tri;
    sign: Tri;
    forms: Tri;
    ocr: Tri;
    convert: Tri;
    mergeSplit: Tri;
    compress: Tri;
    desktopApps: Tri;
    mobileApps: Tri;
    api: Tri;
  };
};

export type Competitor = Tool & {
  // Where the competitor is genuinely better, and where PDF Edit is.
  theyWin: string[];
  weWin: string[];
  verdict: string;
  changes?: string;
  sources: Source[];
  checkedAt: string;
};

const CHECKED = "2 November 2026";

export const OURS: Tool = {
  slug: "pdf-edit",
  name: "PDF Edit",
  vendor: "Open source, MIT licence",
  url: "/",
  summary: "A free browser PDF editor that edits the page's own text in its own font, with no server behind it.",
  processing: {
    where: "browser",
    note: "Everything runs in your tab with pdf.js and pdf-lib. Nothing is uploaded.",
    retention: "Nothing is sent, so nothing is retained. Documents stay in your browser's IndexedDB until you remove them.",
  },
  account: { required: "no", note: "No account, no sign-in." },
  free: {
    summary: "Everything is free. No task counter, no watermark, no file size cap beyond browser memory.",
    fileSizeCap: "Browser memory",
    taskLimit: "None",
    watermark: "no",
    editsExistingText: "yes",
  },
  paid: [],
  priceFrom: "Free",
  startingPrice: { figure: "Free", per: "", note: "everything, for everyone" },
  brand: { monogram: "PE", color: "#1e59cd" },
  textEditing: {
    existing: "yes",
    keepsFont: "yes",
    note: "Opens the clicked text in the PDF's embedded font, at its size, colour, letter and word spacing; exports it as real text in a subset of that font.",
  },
  features: {
    annotate: "yes",
    sign: "yes",
    forms: "no",
    ocr: "no",
    convert: "no",
    mergeSplit: "no",
    compress: "no",
    desktopApps: "no",
    mobileApps: "no",
    api: "no",
  },
};

export const COMPETITORS: Competitor[] = [
  {
    slug: "ilovepdf",
    name: "iLovePDF",
    vendor: "ILOVEPDF S.L., Barcelona",
    url: "https://www.ilovepdf.com",
    summary: "A broad toolbox of more than thirty web PDF tools, with desktop and mobile apps, an API and e-signatures.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Web tools upload the file to iLovePDF's servers; the desktop app processes locally.",
      retention: "Files are deleted within two hours of processing (signed documents are kept longer). Paid plans can choose the processing region.",
    },
    account: {
      required: "partial",
      note: "The free tools show an optional sign-in; Premium features need an account.",
    },
    free: {
      summary: "Essential tools with \"limited document processing\" and ads. Edit PDF accepts one file of up to 100 MB.",
      fileSizeCap: "100 MB for Edit PDF; 15 MB for Office conversion and OCR",
      taskLimit: "Not published (\"limited document processing\")",
      watermark: "unknown",
      editsExistingText: "yes",
    },
    paid: [
      {
        name: "Premium",
        price: "Regional pricing with no currency switcher; the US App Store lists $5.49 a month or $44.99 a year",
        note: "Unlocks all tools, unlimited processing, apps, 4 GB files on most tools (Edit PDF stays at 100 MB), choice of processing region.",
      },
      { name: "Business", price: "Custom, 25+ users" },
    ],
    priceFrom: "≈ $44.99/year (App Store; web price varies by region)",
    startingPrice: { figure: "$44.99", per: "year", approximate: true, regional: true, note: "Premium on the US App Store; the web price varies by region" },
    brand: { monogram: "iL", color: "#e5322d", logo: "logos/ilovepdf.png", thumbnail: "thumbs/ilovepdf.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "unknown",
      note: "Edits existing text (rebuilt February 2026) and changes font, size and colour, but says nothing about whether the PDF's embedded font is kept.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "yes",
    },
    theyWin: [
      "Breadth: converting to and from Office formats, OCR, compression, repair, PDF/A, redaction, comparison, AI summaries and translation.",
      "Legally meaningful e-signatures with audit trails, through qualified providers.",
      "A REST API with free monthly credits and connectors for Zapier, Make and Power Automate.",
      "Desktop and mobile apps; the desktop app processes files locally and takes files up to 4 GB.",
      "Team workspaces, a choice of processing region on paid plans, and ISO/IEC 27001 certification.",
    ],
    weWin: [
      "No upload at all. iLovePDF's web tools keep your file on their servers for up to two hours.",
      "No account, no ads and no \"limited document processing\" on a free tier.",
      "No 100 MB cap on editing, which iLovePDF applies on every tier including Business.",
      "The edit is set in the page's embedded font with its spacing preserved; iLovePDF does not document how it handles fonts.",
      "No one-file-per-task limit.",
    ],
    verdict:
      "iLovePDF is the right tool when the job is anything but editing text: converting, compressing, OCR, signing. For changing words on a page, it uploads your file and leaves the font question unanswered; PDF Edit does that one job locally, in the page's own font.",
    changes:
      "Direct editing of existing text arrived in May 2025 and was rebuilt in February 2026. Regional file processing for paid plans followed in March 2026.",
    sources: [
      { label: "iLovePDF pricing", url: "https://www.ilovepdf.com/pricing", accessed: CHECKED },
      { label: "iLovePDF Edit PDF tool", url: "https://www.ilovepdf.com/edit-pdf", accessed: CHECKED },
      { label: "iLovePDF FAQ (file deletion)", url: "https://www.ilovepdf.com/help/faq", accessed: CHECKED },
      { label: "iLovePDF privacy policy", url: "https://www.ilovepdf.com/help/privacy", accessed: CHECKED },
      { label: "iLovePDF blog: new advanced editing (Feb 2026)", url: "https://www.ilovepdf.com/blog/new-advanced-pdf-editing-ilovepdf", accessed: CHECKED },
      { label: "iLovePDF on the US App Store (in-app prices)", url: "https://apps.apple.com/us/app/ilovepdf-pdf-editor-reader/id1207332399", accessed: CHECKED },
    ],
  },
  {
    slug: "smallpdf",
    name: "Smallpdf",
    vendor: "Smallpdf AG, Zürich",
    url: "https://smallpdf.com",
    summary: "A Swiss suite of web PDF tools with a Windows app, mobile scanner, AI tools and the Sign.com e-signature platform.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Files are uploaded to Smallpdf's servers in the EU.",
      retention: "Files from the free tools are deleted after one hour; for visitors who are not signed in the privacy notice promises deletion \"within a reasonable period\". Files saved to an account stay until deleted.",
    },
    account: {
      required: "partial",
      note: "Free tools work without an account; editing existing text needs a Pro subscription.",
    },
    free: {
      summary: "Limited access to basic features of 21 tools, two tasks a day, with ads. Editing existing text is Pro only.",
      fileSizeCap: "\"Limited\"; no number published",
      taskLimit: "2 tasks per day",
      watermark: "unknown",
      editsExistingText: "no",
    },
    paid: [
      {
        name: "Pro",
        price: "Regional pricing; shown from India as ₹979 a month or ₹8,799 a year. Third-party listings put the US price around $9 to $15 a month.",
        note: "7-day trial with payment details. Unlocks Edit Text, OCR, strong compression, batch tools, the desktop app and unlimited downloads.",
      },
      { name: "Team", price: "Per seat, billed yearly; the seat price did not render outside the vendor's regions" },
      { name: "Business", price: "Custom, 20+ seats" },
    ],
    priceFrom: "Pro, regional pricing (≈ $9/month billed yearly per third-party listings)",
    startingPrice: { figure: "$9", per: "month", approximate: true, regional: true, thirdParty: true, note: "Pro billed yearly, per third-party listings" },
    brand: { monogram: "Sp", color: "#e63c3c", logo: "logos/smallpdf.png", thumbnail: "thumbs/smallpdf.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "no",
      note: "Pro only. Smallpdf's own guide says the editor offers standard typefaces such as Arial and Times New Roman, and that embedded or restricted fonts can block edits.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "unknown",
    },
    theyWin: [
      "Conversion, OCR and compression across many formats, including batch processing on Pro.",
      "A full e-signature platform (Sign.com) bundled with Pro, with eIDAS compliance.",
      "AI document tools: summaries, chat, translation and question generation.",
      "Cloud storage and sharing, a mobile scanner app and an offline Windows app.",
      "EU hosting with ISO/IEC 27001 and team administration.",
    ],
    weWin: [
      "No upload. Smallpdf processes your file on its servers and, for anonymous users, promises only a \"reasonable\" deletion window.",
      "Editing existing text is free; Smallpdf puts it behind Pro.",
      "No two-tasks-a-day limit, no daily download cap and no unpublished size limit.",
      "The page's embedded font is kept, with its letter and word spacing, instead of a standard typeface.",
      "Embedded or restricted fonts never block an edit.",
    ],
    verdict:
      "Smallpdf is a polished, well-run suite for converting, signing and compressing, and its OCR handles scans that PDF Edit cannot. Its text editor is paid, server-side and works from a list of standard typefaces. If the job is retyping a line in the page's own font, PDF Edit does it free and locally.",
    changes:
      "In July 2026 Smallpdf sold its PDF Tools subsidiary to Apryse to focus on its own products. The privacy notice was revised in July 2025 to name its hosting and AI sub-processors.",
    sources: [
      { label: "Smallpdf pricing", url: "https://smallpdf.com/pricing", accessed: CHECKED },
      { label: "Smallpdf Edit PDF tool", url: "https://smallpdf.com/edit-pdf", accessed: CHECKED },
      { label: "Smallpdf support (free limits)", url: "https://smallpdf.com/support", accessed: CHECKED },
      { label: "Smallpdf privacy notice", url: "https://smallpdf.com/privacy", accessed: CHECKED },
      { label: "Smallpdf blog: fonts in the editor", url: "https://smallpdf.com/blog/how-to-change-font-size-of-pdfs", accessed: CHECKED },
      { label: "Smallpdf blog: is Smallpdf safe", url: "https://smallpdf.com/blog/is-smallpdf-safe", accessed: CHECKED },
    ],
  },
  {
    slug: "sejda",
    name: "Sejda",
    vendor: "Sejda BV, Amsterdam",
    url: "https://www.sejda.com",
    summary: "A web PDF editor and toolset with an unusually generous free tier, and a desktop app that processes files locally.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "The web editor uploads the file; Sejda Desktop processes on your computer.",
      retention: "Uploaded files are deleted after two hours. Hosting is on DigitalOcean and Google Cloud in the US and Europe.",
    },
    account: { required: "no", note: "No sign-up required for the free tier." },
    free: {
      summary: "Documents up to 200 pages or 50 MB, three tasks an hour, one file per task, including editing existing text.",
      fileSizeCap: "50 MB or 200 pages",
      taskLimit: "3 tasks per hour",
      watermark: "unknown",
      editsExistingText: "yes",
    },
    paid: [
      { name: "Web Week Pass", price: "$5 one-time for seven days" },
      { name: "Web Monthly", price: "$7.50 per user per month" },
      { name: "Desktop + Web Annual", price: "$63 per user per year" },
      { name: "Desktop Week Pass", price: "$7.95 one-time for seven days" },
    ],
    priceFrom: "$5 for a week; $7.50/month",
    startingPrice: { figure: "$5", per: "week", note: "a seven-day web pass; $7.50 a month after" },
    brand: { monogram: "Se", color: "#1d7a73", logo: "logos/sejda.png", thumbnail: "thumbs/sejda.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "partial",
      note: "Edits in the embedded font when it has the characters you type; otherwise offers a \"very similar\" web font from a list of about 35. Local fonts are not available online.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "no",
      api: "partial",
    },
    theyWin: [
      "OCR (10 pages free, 100 on paid plans) and automatic form-field detection.",
      "Conversions, compression, deskew, Bates numbering, bookmarks and dozens of page tools.",
      "A cheap one-off week pass instead of a subscription.",
      "A desktop app for macOS, Windows and Linux that processes locally and can use installed fonts.",
      "Candid documentation of its font limits, in the editor itself.",
    ],
    weWin: [
      "No upload. Sejda keeps web files for up to two hours on cloud hosting that includes US regions.",
      "No 50 MB, 200-page or three-tasks-an-hour limit, and no cap on saves.",
      "The embedded font and its spacing are kept rather than a \"very similar\" substitute, and the export embeds that font.",
      "Nothing to buy for unlimited use.",
    ],
    verdict:
      "Sejda has the most generous free text editor of the big web tools and is honest about its fonts. For a small file that also needs OCR or conversion, use Sejda. For editing in the page's own font without uploads or hourly limits, PDF Edit.",
    changes: "Terms updated March 2026 and the privacy policy in October 2026, naming Google Cloud for AI-assisted form-field detection.",
    sources: [
      { label: "Sejda pricing", url: "https://www.sejda.com/pricing", accessed: CHECKED },
      { label: "Sejda PDF editor (limits and font dialogs)", url: "https://www.sejda.com/pdf-editor", accessed: CHECKED },
      { label: "Sejda desktop", url: "https://www.sejda.com/desktop", accessed: CHECKED },
      { label: "Sejda privacy policy", url: "https://www.sejda.com/privacy", accessed: CHECKED },
      { label: "Sejda help", url: "https://www.sejda.com/help", accessed: CHECKED },
    ],
  },
  {
    slug: "adobe-acrobat-online",
    name: "Adobe Acrobat online",
    vendor: "Adobe Inc.",
    url: "https://www.adobe.com/acrobat/online.html",
    summary: "Adobe's free web tools and the Acrobat Standard, Pro and Studio subscriptions, with the web editor saving to Adobe cloud storage.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "\"Acrobat online services upload your files to Adobe cloud storage.\"",
      retention: "Files you do not save are deleted \"within a short time period\"; no number is given. Edits in Acrobat on the web auto-save to cloud storage.",
    },
    account: {
      required: "partial",
      note: "One free transaction per tool without signing in; after that, and to download from Edit PDF, you sign in.",
    },
    free: {
      summary: "One transaction per tool without an account, then sign in. A free account can fill, sign and comment; premium tools get one use every 30 days. Editing existing body text is not free.",
      fileSizeCap: "100 MB (200 MB for PDF to Word or PowerPoint; 2 GB for Compress)",
      taskLimit: "One use of each premium tool per 30 days with a free account",
      watermark: "no",
      editsExistingText: "no",
    },
    paid: [
      {
        name: "Acrobat Standard",
        price: "Regional pricing; the UK store shows £14.99 a month on an annual plan. US list prices are commonly quoted as $14.99 a month but were not shown to us.",
        note: "Edit text and images, convert, organise, forms and signatures.",
      },
      { name: "Acrobat Pro", price: "UK £19.97 a month on an annual plan (≈ $19.99 per third parties)", note: "Adds OCR, redaction, comparison and 70+ tools." },
      { name: "Acrobat Studio", price: "UK £24.98 a month on an annual plan ($24.99 at launch in August 2025)", note: "Adds AI Assistant, PDF Spaces and Adobe Express." },
    ],
    priceFrom: "Standard ≈ $14.99/month on an annual plan (regional pricing)",
    startingPrice: { figure: "$14.99", per: "month", approximate: true, regional: true, note: "Acrobat Standard on an annual plan; the UK store shows £14.99" },
    brand: { monogram: "Ac", color: "#e1251b", logo: "logos/adobe-acrobat-online.png", thumbnail: "thumbs/adobe-acrobat-online.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "partial",
      note: "Paid. The web editor uses embedded fonts \"to ensure your document looks the same\"; Adobe's desktop guide says a font that is not installed on your computer limits you to changing colour or size.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "yes",
    },
    theyWin: [
      "OCR and editing of scanned documents (Pro).",
      "Converting to and from Office formats, cloud storage, sharing links and review workflows.",
      "E-signatures with audit trails, forms authoring and redaction.",
      "Desktop and mobile apps, an AI Assistant on Studio, enterprise compliance and region pinning.",
      "Very large documents handled server-side (up to 1,500 pages in page tools).",
    ],
    weWin: [
      "No upload. Every Acrobat online file goes to Adobe's cloud, and deletion timing is unspecified.",
      "No sign-in after the first use, and no subscription with an early-cancellation fee.",
      "Editing existing text is free; in Acrobat it needs Standard or above.",
      "No 100 MB file cap and no one-use-per-30-days quota.",
      "The embedded font is used without having to be installed on your computer.",
    ],
    verdict:
      "Acrobat is the most complete PDF product there is, and if you need OCR, forms, signatures or review workflows it is worth paying for. For changing a few words on a page it asks you to upload, sign in and subscribe; PDF Edit asks for none of that.",
    changes:
      "Acrobat Studio launched in August 2025 and now carries the AI features; Standard and Pro no longer include them on the storefronts we saw.",
    sources: [
      { label: "Acrobat online Edit PDF", url: "https://www.adobe.com/acrobat/online/pdf-editor.html", accessed: CHECKED },
      { label: "Adobe FAQ: trying Acrobat online services", url: "https://helpx.adobe.com/document-cloud/faq/try-acrobat-online-services.html", accessed: CHECKED },
      { label: "Acrobat web help: edit text", url: "https://helpx.adobe.com/acrobat/web/edit-pdfs/edit-text-images-and-objects/edit-text.html", accessed: CHECKED },
      { label: "Acrobat desktop help: fonts when editing text", url: "https://helpx.adobe.com/acrobat/using/edit-text-pdfs.html", accessed: CHECKED },
      { label: "Acrobat pricing (UK storefront)", url: "https://www.adobe.com/acrobat/pricing.html", accessed: CHECKED },
      { label: "Adobe news: Acrobat Studio launch", url: "https://news.adobe.com/news/2025/08/acrobat-studio-delivers-new-ai-powered-home-for-productivity-creativity", accessed: CHECKED },
    ],
  },
  {
    slug: "foxit",
    name: "Foxit PDF Editor",
    vendor: "Foxit Software Inc., Fremont",
    url: "https://www.foxit.com/pdf-editor/",
    summary: "A long-standing desktop editor with a cloud edition, free online converters, e-signatures and a perpetual licence option.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Online tools and the cloud editor run on Foxit's servers in the US, Germany, Canada, Australia and Japan.",
      retention: "Output files \"will typically be deleted in one day\"; uploads are deleted after processing unless saved to an account.",
    },
    account: {
      required: "partial",
      note: "The free online converters need no account; the browser editor is a 14-day trial behind a free account.",
    },
    free: {
      summary: "Free online tools for converting, merging, compressing and signing. The editor itself is a 14-day trial with uploads up to 10 MB; editing existing text is not among the free tools.",
      fileSizeCap: "10 MB in the trial editor; 150 MB in the compress tool",
      taskLimit: "Not published",
      watermark: "no",
      editsExistingText: "no",
    },
    paid: [
      { name: "PDF Editor", price: "From $10.99 per user per month on annual billing (US list, July 2026)", note: "Windows, macOS and web; includes OCR, forms and 300 AI credits a month." },
      { name: "PDF Editor+", price: "$159.99 per user per year", note: "Adds mobile apps, Smart Redact and 150 e-sign envelopes a year." },
      { name: "PDF Editor 14 perpetual", price: "$209.99 one-time per user", note: "Windows or macOS only, without the cloud and AI features." },
    ],
    priceFrom: "$10.99/month",
    startingPrice: { figure: "$10.99", per: "month", note: "PDF Editor, per user on annual billing" },
    brand: { monogram: "Fx", color: "#ff6a13", logo: "logos/foxit.png", thumbnail: "thumbs/foxit.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "partial",
      note: "Foxit's Windows guide: you can add or replace text \"only if the font used for that text is installed on your system\". The cloud editor's behaviour is not documented.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "yes",
    },
    theyWin: [
      "OCR, including running it automatically when you click text in a scan.",
      "Office conversion, forms including XFA, and e-sign envelopes.",
      "A perpetual desktop licence, document management and cloud storage integrations.",
      "Mobile apps, batch processing and an AI assistant.",
    ],
    weWin: [
      "Free, with no account and no trial clock.",
      "No upload; Foxit's online tools and cloud editor process on its servers.",
      "No 10 MB limit.",
      "The embedded font is used as it is; Foxit needs the font installed on your system to retype in it.",
    ],
    verdict:
      "Foxit is a serious desktop editor with a perpetual licence, and the best choice here if you want to own your software. Its browser editor is a paid product with a trial. PDF Edit is for the person who wants to fix a line now, free, without installing or uploading anything.",
    changes: "US list prices were restated in July 2026 and the perpetual product is now Foxit PDF Editor 14. Foxit rebranded in 2023.",
    sources: [
      { label: "Foxit PDF Editor (pricing and plans)", url: "https://www.foxit.com/pdf-editor/", accessed: CHECKED },
      { label: "Foxit free trial page (limits)", url: "https://www.foxit.com/pdf-editor/free-pdf/", accessed: CHECKED },
      { label: "Foxit free online tools", url: "https://www.foxit.com/pdf-converter", accessed: CHECKED },
      { label: "Foxit privacy policy (retention, regions)", url: "https://www.foxit.com/company/privacy-policy.html", accessed: CHECKED },
      { label: "Foxit user guide: edit text objects (installed fonts)", url: "https://www.foxit.com/resource-hub/user-guide/foxit-pdf-editor-for-windows/edit-text-objects/", accessed: CHECKED },
    ],
  },
  {
    slug: "xodo",
    name: "Xodo",
    vendor: "Apryse Software Inc.",
    url: "https://xodo.com",
    summary: "Apryse's consumer suite of forty-plus web tools, a desktop app (PDF Studio), mobile apps and cloud drive.",
    checkedAt: CHECKED,
    processing: {
      where: "mixed",
      note: "\"Most tools process files on your device locally\"; which ones upload is not itemised.",
      retention: "Files that require upload are deleted after one hour. AskPDF sends document content to OpenAI.",
    },
    account: { required: "unknown", note: "Whether the free daily action needs an account is not stated." },
    free: {
      summary: "One free action a day with limited access to the web tools.",
      fileSizeCap: "Not published",
      taskLimit: "1 action per day",
      watermark: "unknown",
      editsExistingText: "yes",
    },
    paid: [
      { name: "Xodo Web", price: "$39.99 a year ($3.33 a month)", note: "3-day trial with a payment method." },
      { name: "Xodo Document Suite", price: "$107.93 a year ($8.99 a month) on a promotion through 31 December 2026; $14.99 a month billed yearly at the standard price", note: "Web, desktop and mobile." },
      { name: "Xodo Desktop (PDF Studio)", price: "$119.88 a year ($9.99 a month); a perpetual licence is also sold" },
    ],
    priceFrom: "$39.99/year (Web)",
    startingPrice: { figure: "$39.99", per: "year", note: "Xodo Web" },
    brand: { monogram: "Xo", color: "#2b6fe6", logo: "logos/xodo.png", thumbnail: "thumbs/xodo.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "unknown",
      note: "The tool page says you can \"add new text in the same font\" and edit existing text; what happens when a font is not embedded is not documented.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "no",
    },
    theyWin: [
      "OCR and Office conversion.",
      "A cloud drive, cross-device apps and a Linux desktop app with a perpetual licence.",
      "E-signatures (Xodo Sign) and an AI question-and-answer tool.",
      "A very low entry price for the web tools.",
      "Local processing for most tools, which narrows the privacy gap.",
    ],
    weWin: [
      "Unlimited free use, against one action a day.",
      "Everything runs locally and the code says so; Xodo does not list which tools upload.",
      "No account and no trial.",
      "Font handling is documented: the page's embedded font, kept and re-embedded on export.",
    ],
    verdict:
      "Xodo is the closest of these tools to PDF Edit on privacy, since most of its tools run on your device, and it offers far more of them for a modest price. Its free tier is one action a day and its font behaviour is undocumented. For free, unlimited editing in the page's own font, PDF Edit.",
    changes:
      "PDFTron became Apryse in 2023. An Essentials plan announced in April 2025 is no longer listed; a 40%-off Document Suite promotion runs through December 2026.",
    sources: [
      { label: "Xodo pricing", url: "https://xodo.com/pricing", accessed: CHECKED },
      { label: "Xodo Edit PDF Text", url: "https://xodo.com/edit-pdf-text", accessed: CHECKED },
      { label: "Xodo PDF editor", url: "https://www.xodo.com/pdf-editor", accessed: CHECKED },
      { label: "Xodo blog: plans explained (June 2026)", url: "https://xodo.com/blog/xodo-plans-explained", accessed: CHECKED },
      { label: "Apryse privacy notice", url: "https://apryse.com/privacy", accessed: CHECKED },
    ],
  },
  {
    slug: "pdf24",
    name: "PDF24 Tools",
    vendor: "geek software GmbH, Berlin",
    url: "https://tools.pdf24.org",
    summary: "Around 150 free, ad-supported online PDF tools from a German company, plus a free offline Windows app.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Online tools run \"on our servers in the cloud\" in Germany; the Windows app PDF24 Creator works offline.",
      retention: "Files are deleted from the server within one hour; no backups are made. The optional AI invoice tool sends the PDF to Google's Gemini API.",
    },
    account: { required: "no", note: "No registration." },
    free: {
      summary: "Everything is free and ad-supported, with \"no artificial limits\". Its Edit PDF tool adds text, images and shapes but cannot change existing text.",
      fileSizeCap: "None published",
      taskLimit: "None",
      watermark: "no",
      editsExistingText: "no",
    },
    paid: [],
    priceFrom: "Free",
    startingPrice: { figure: "Free", per: "", note: "no paid plan" },
    brand: { monogram: "24", color: "#2e7dd1", logo: "logos/pdf24.png", thumbnail: "thumbs/pdf24.webp" },
    textEditing: {
      existing: "no",
      keepsFont: "no",
      note: "Cannot edit existing text. Its FAQ says the best way is to convert the PDF to Word, edit, and convert back, which reflows the page and substitutes fonts.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "no",
      api: "yes",
    },
    theyWin: [
      "Enormous breadth, all free: OCR, every conversion, merge, split, compress, redact, compare, PDF/A, e-invoices and digital signatures with timestamps.",
      "A free offline Windows app with its own PDF engine.",
      "German hosting, one-hour deletion and no backups, from a company that has been at it since 2006.",
      "No account, no subscription, no paywall.",
    ],
    weWin: [
      "Editing the text that is already on the page, in its own font. PDF24 cannot do this at all.",
      "No upload for any operation; PDF24's online tools all run on its servers.",
      "No ads.",
    ],
    verdict:
      "For anything other than changing the words on a page, PDF24 is the free tool to reach for, and its privacy terms are among the clearest. It simply does not edit existing text. PDF Edit does only that, and does it in the page's own font.",
    changes: "PDF24 Creator 11.31 (October 2026) shipped its own PDF engine; e-invoice tools and an optional AI invoice reader arrived in 2026.",
    sources: [
      { label: "PDF24 Edit PDF (no existing-text editing)", url: "https://tools.pdf24.org/en/edit-pdf", accessed: CHECKED },
      { label: "PDF24 FAQ (free, deletion, EU servers)", url: "https://tools.pdf24.org/en/faq", accessed: CHECKED },
      { label: "PDF24 Creator (offline Windows app)", url: "https://tools.pdf24.org/en/creator", accessed: CHECKED },
      { label: "PDF24 privacy policy", url: "https://www.pdf24.org/en/privacy-policy", accessed: CHECKED },
      { label: "PDF24 legal notice", url: "https://www.pdf24.org/en/legal-notice", accessed: CHECKED },
    ],
  },
  {
    slug: "pdffiller",
    name: "pdfFiller",
    vendor: "airSlate, Inc., Boston",
    url: "https://www.pdffiller.com",
    summary: "A cloud document platform for filling, editing and signing PDFs, with forms, templates and workflow features.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Every document is uploaded to pdfFiller's cloud on AWS in the United States.",
      retention: "Documents stay in your account while you subscribe and for a month after it ends; there is no automatic short-term deletion.",
    },
    account: {
      required: "partial",
      note: "You can start editing without an account; saving, downloading or sharing needs one.",
    },
    free: {
      summary: "No permanent free plan. A 30-day trial that usually asks for a card and converts to a paid plan.",
      fileSizeCap: "100 MB and 1,500 pages",
      taskLimit: "Trial only",
      watermark: "no",
      editsExistingText: "partial",
    },
    paid: [
      { name: "Basic", price: "$8 per user per month billed annually, or $20 month to month (US prices from the vendor's blog; the pricing page shows regional currency)" },
      { name: "Plus", price: "$12 per user per month billed annually, or $30 month to month" },
      { name: "Premium", price: "$15 per user per month billed annually, or $40 month to month", note: "Adds signNow, a legal forms library and workflows." },
    ],
    priceFrom: "$8/month (annual)",
    startingPrice: { figure: "$8", per: "month", note: "Basic, per user billed annually" },
    brand: { monogram: "pF", color: "#ef6c1a", logo: "logos/pdffiller.png", thumbnail: "thumbs/pdffiller.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "partial",
      note: "Claims to detect the matching font automatically, but says \"font matching is not guaranteed\" and that a font not embedded in the PDF is substituted with a similar one.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "yes",
    },
    theyWin: [
      "Fillable forms, data collection and a library of tens of thousands of templates and legal forms.",
      "E-signature workflows with audit trails, through signNow on Premium.",
      "OCR, conversion, cloud storage, team workspaces and an API.",
      "Compliance paperwork: SOC 2 Type II, HIPAA agreements, GDPR.",
      "Native mobile apps and a macOS app.",
    ],
    weWin: [
      "Free, with no trial, no card and nothing that converts into a subscription.",
      "No upload, and no copy of your document kept in a cloud account.",
      "The embedded font is kept and re-embedded; pdfFiller's own pages say font matching is not guaranteed.",
      "No 100 MB cap.",
    ],
    verdict:
      "pdfFiller is a document workflow product: forms, signatures, templates and teams. If that is the job, it is a reasonable subscription. For editing a page's text it uploads your file, keeps it in an account and does not promise to match the font. PDF Edit keeps the file on your machine and the font exactly.",
    changes:
      "The privacy notice was updated in October 2026 and the sub-processor list in September 2026 to add OpenAI, Anthropic and Google for AI features.",
    sources: [
      { label: "pdfFiller plans", url: "https://www.pdffiller.com/en/services.htm", accessed: CHECKED },
      { label: "pdfFiller Edit PDF", url: "https://edit-pdf.pdffiller.com/", accessed: CHECKED },
      { label: "pdfFiller: edit and preserve font style", url: "https://www.pdffiller.com/en/functionality/edit-and-preserve-font-style-pdf.htm", accessed: CHECKED },
      { label: "pdfFiller blog: free version", url: "https://blog.pdffiller.com/pdffiller-free-version/", accessed: CHECKED },
      { label: "pdfFiller blog: pricing (US prices)", url: "https://blog.pdffiller.com/pdffiller-pricing/", accessed: CHECKED },
      { label: "pdfFiller FAQ: how long documents are kept", url: "https://www.pdffiller.com/en/faq/my-account-and-subscription/how-long-will-pdffiller-keep-my-documents.htm", accessed: CHECKED },
      { label: "airSlate sub-processors", url: "https://legal.pdffiller.com/subprocessors", accessed: CHECKED },
    ],
  },
  {
    slug: "canva-pdf-editor",
    name: "Canva PDF editor",
    vendor: "Canva Pty Ltd, Sydney",
    url: "https://www.canva.com/pdf-editor/",
    summary: "Canva imports a PDF as a design, breaks it into editable elements and exports a new PDF, inside its full design suite.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "The PDF is uploaded and converted into a Canva design stored in your account; Canva stores data in the United States.",
      retention: "Uploads and designs stay in your account until you delete them.",
    },
    account: { required: "yes", note: "A Canva account is required." },
    free: {
      summary: "Free with an account: files up to 300 MB and 500 pages. Custom font upload and print-ready export need a paid plan.",
      fileSizeCap: "300 MB, 500 pages, 1,400 elements",
      taskLimit: "None",
      watermark: "partial",
      editsExistingText: "yes",
    },
    paid: [
      { name: "Pro", price: "Regional pricing; third-party trackers list about $12 a month billed yearly or $18 monthly in the US", note: "Custom fonts, print export, 100 GB storage." },
      { name: "Business", price: "About $20.83 per person per month billed yearly (third-party)", note: "Teams plan is closed to new sign-ups." },
    ],
    priceFrom: "Pro ≈ $12/month billed yearly (regional pricing)",
    startingPrice: { figure: "$12", per: "month", approximate: true, regional: true, thirdParty: true, note: "Pro billed yearly, per third-party listings" },
    brand: { monogram: "Ca", color: "#00c4cc", logo: "logos/canva-pdf-editor.png", thumbnail: "thumbs/canva-pdf-editor.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "no",
      note: "\"Unsupported fonts may be replaced with similar fonts\"; layouts \"may shift slightly after import\"; pages become images in an A4 document and not all text is editable.",
    },
    features: {
      annotate: "yes",
      sign: "partial",
      forms: "no",
      ocr: "no",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "yes",
      api: "yes",
    },
    theyWin: [
      "Free with high limits, inside a complete design suite.",
      "Real-time collaboration, sharing links and brand controls for teams.",
      "Converting a PDF into a presentation, images or video, and translating it.",
      "Apps on every platform and a developer API.",
    ],
    weWin: [
      "The page stays the page: PDF Edit edits in place with the original fonts and layout, where Canva re-sets the document in its own fonts on an A4 page model and warns that layouts may shift.",
      "No upload and no account.",
      "Scanned pages and flattened images are treated the same by both; neither can edit them.",
    ],
    verdict:
      "Canva is the right choice when a PDF is really a design you want to rework, restyle or present. It is the wrong choice when the document must come out looking exactly as it went in. That fidelity is what PDF Edit is built for.",
    changes:
      "Canva Teams is closed to new sign-ups in favour of Business; third-party trackers record several Pro price changes in 2026. The privacy policy was updated on 2 November 2026.",
    sources: [
      { label: "Canva PDF editor", url: "https://www.canva.com/pdf-editor/", accessed: CHECKED },
      { label: "Canva help: import and edit PDFs", url: "https://www.canva.com/help/import-and-edit-pdfs-canva/", accessed: CHECKED },
      { label: "Canva help: upload formats and requirements", url: "https://www.canva.com/help/upload-formats-requirements/", accessed: CHECKED },
      { label: "Canva pricing", url: "https://www.canva.com/pricing/", accessed: CHECKED },
      { label: "Canva trust: privacy (data location)", url: "https://www.canva.com/trust/privacy/", accessed: CHECKED },
      { label: "Third-party price tracker for Canva", url: "https://pricingsaas.com/companies/canva", accessed: CHECKED },
    ],
  },
  {
    slug: "pdfescape",
    name: "PDFescape",
    vendor: "Avanquest Software, Montréal",
    url: "https://www.pdfescape.com",
    summary: "A long-running free online form filler and annotator, now owned by Avanquest, with a paid Windows desktop editor.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "The online editor uploads the file; saving to PDFescape's servers is a feature.",
      retention: "Stored files expire after 7 days on Free and 30 days on Premium; no deletion window is stated for uploads themselves.",
    },
    account: { required: "no", note: "The online editor opens without a login." },
    free: {
      summary: "Online editing, annotation and forms with ads, for files under 10 MB and 100 pages. Editing existing text is a desktop feature on paid plans.",
      fileSizeCap: "10 MB and 100 pages",
      taskLimit: "\"Usage rates\" enforced; numbers not published",
      watermark: "no",
      editsExistingText: "no",
    },
    paid: [
      { name: "Premium", price: "$2.99 a month billed yearly, or $5.99 monthly", note: "Ad-free, 40 MB files, the Windows desktop editor." },
      { name: "Ultimate", price: "$5.99 a month billed yearly, or $8.99 monthly", note: "Adds encryption, advanced forms, signatures and redaction on desktop." },
    ],
    priceFrom: "$2.99/month",
    startingPrice: { figure: "$2.99", per: "month", note: "Premium billed yearly" },
    brand: { monogram: "Pe", color: "#b4232a", logo: "logos/pdfescape.png", thumbnail: "thumbs/pdfescape.webp" },
    textEditing: {
      existing: "partial",
      keepsFont: "unknown",
      note: "Online: \"You can only modify text added with PDFescape.\" Existing text is edited only in the paid Windows desktop app, which does not say how it handles fonts.",
    },
    features: {
      annotate: "yes",
      sign: "partial",
      forms: "yes",
      ocr: "no",
      convert: "partial",
      mergeSplit: "partial",
      compress: "partial",
      desktopApps: "yes",
      mobileApps: "no",
      api: "no",
    },
    theyWin: [
      "Free form filling, basic form creation and form publishing online.",
      "Files kept on its servers so you can continue on another device.",
      "A cheap Windows desktop editor that edits existing text, merges and converts.",
      "No account and no watermark on the free tier.",
    ],
    weWin: [
      "Edits existing text online, free, in the page's own font. PDFescape's online editor cannot touch existing text at all.",
      "No upload and no 10 MB or 100-page cap.",
      "No ads, and it works on macOS and Linux, where PDFescape has no desktop app.",
    ],
    verdict:
      "PDFescape is a fair free choice for filling and publishing forms. For editing the words already on a page it sends you to a paid Windows app. PDF Edit does that in the browser, for free, with the original font.",
    changes: "Avanquest (Claranova) bought PDFescape in 2021; the site now carries Avanquest's group privacy policy, updated July 2026.",
    sources: [
      { label: "PDFescape online editor (limits)", url: "https://www.pdfescape.com/online-pdf-editor/", accessed: CHECKED },
      { label: "PDFescape plans comparison", url: "https://www.pdfescape.com/what/premium/", accessed: CHECKED },
      { label: "PDFescape sign-up (prices)", url: "https://www.pdfescape.com/signup/", accessed: CHECKED },
      { label: "PDFescape help: adding or modifying text", url: "https://support.pdfescape.com/hc/en-us/articles/360026444112-Adding-or-Modifying-Text", accessed: CHECKED },
      { label: "PDFescape privacy policy", url: "https://www.pdfescape.com/privacy/", accessed: CHECKED },
    ],
  },
  {
    slug: "dochub",
    name: "DocHub",
    vendor: "DocHub, LLC (airSlate), Boston",
    url: "https://dochub.com",
    summary: "A cloud PDF editor and e-signature tool built around Google Workspace, with native text editing added in 2026.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Files are stored encrypted on AWS in the United States.",
      retention: "Documents you upload are kept in your account permanently until you delete them.",
    },
    account: { required: "yes", note: "An account is required." },
    free: {
      summary: "A free account gets the core features, including editing existing text, limited to three uses a month, without whiteout or highlight.",
      fileSizeCap: "31 MB",
      taskLimit: "3 core-feature uses per month",
      watermark: "no",
      editsExistingText: "partial",
    },
    paid: [
      { name: "Basic", price: "$8 a month billed yearly, or $11 monthly", note: "Selected Pro features, 3 uses a month; unlimited downloads and self-signing." },
      { name: "Pro", price: "$12 a month billed yearly, or $16 monthly", note: "Unlimited editing and sign requests." },
      { name: "Site License", price: "Custom" },
    ],
    priceFrom: "$8/month (annual)",
    startingPrice: { figure: "$8", per: "month", note: "Basic billed yearly" },
    brand: { monogram: "Dh", color: "#1f8ef1", logo: "logos/dochub.png", thumbnail: "thumbs/dochub.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "no",
      note: "Matches the original with the most similar of about 1,800 Google Fonts and embeds that; proprietary fonts are substituted. Rasterised text is not editable.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "no",
      convert: "no",
      mergeSplit: "yes",
      compress: "no",
      desktopApps: "no",
      mobileApps: "yes",
      api: "unknown",
    },
    theyWin: [
      "A complete e-signature workflow with audit trails, SOC 2 Type II and a HIPAA agreement on the site licence.",
      "Templates, collaboration, Google Drive, Gmail and Classroom integration, and Microsoft 365.",
      "Mobile apps and AI editing tools.",
      "Font matching with reflow and background cleanup, which looks natural when the original font is a common one.",
    ],
    weWin: [
      "Unlimited free editing, against three uses a month.",
      "No account, and no copy of your document kept permanently on a US server.",
      "The page's own embedded font rather than a Google Fonts look-alike.",
      "No 31 MB cap.",
    ],
    verdict:
      "DocHub is a good choice for signing and for teams living in Google Workspace, and its 2026 text editor is a real one. It keeps every file in an account and swaps fonts for the closest Google Font. PDF Edit keeps nothing and swaps nothing.",
    changes: "Native editing of existing text arrived in version 7.0.0 in April 2026, with Google Fonts embedding. The privacy notice was updated in October 2026.",
    sources: [
      { label: "DocHub pricing", url: "https://dochub.com/pricing", accessed: CHECKED },
      { label: "DocHub help: edit PDF text (fonts)", url: "https://help.dochub.com/knowledge-base/document-editing/edit-pdf-text", accessed: CHECKED },
      { label: "DocHub release notes (v7.0.0)", url: "https://dochub.com/release-notes", accessed: CHECKED },
      { label: "DocHub help: automatic deletion", url: "https://help.dochub.com/knowledge-base/security-privacy-compliance-and-data-retention/will-dochub-ever-automatically-delete-my-pdf-documents", accessed: CHECKED },
      { label: "DocHub blog: free plan features", url: "https://www.dochub.com/blog/dochub-free-plan-features/", accessed: CHECKED },
      { label: "DocHub privacy notice", url: "https://legal.dochub.com/privacy-notice", accessed: CHECKED },
    ],
  },
  {
    slug: "soda-pdf",
    name: "Soda PDF",
    vendor: "Avanquest Software, Montréal",
    url: "https://www.sodapdf.com",
    summary: "An Avanquest suite with a Windows desktop app and an online edition covering editing, OCR, conversion, signing and AI tools.",
    checkedAt: CHECKED,
    processing: {
      where: "server",
      note: "Online tools upload the file over HTTPS and process it on Soda's servers.",
      retention: "Files are deleted from the servers within 24 hours; e-signature documents are kept longer.",
    },
    account: { required: "unknown", note: "Not stated for the free tools; saving to My Files needs a plan." },
    free: {
      summary: "Most tools free within two files a day or 3 MB. You can edit text, but downloading, printing or saving the result requires payment.",
      fileSizeCap: "3 MB free (100 MB upload limit on paid plans)",
      taskLimit: "2 files per day",
      watermark: "unknown",
      editsExistingText: "partial",
    },
    paid: [
      { name: "Pro", price: "Shown only at checkout; third-party listings range from about $7 to $15 a month" },
      { name: "Team", price: "Per licence, 3 to 19 users, 10% off per licence" },
      { name: "Business", price: "Shown only at checkout", note: "Adds OCR Edit, 10 GB storage and deployment tools." },
    ],
    priceFrom: "Pro (price shown at checkout; ≈ $7–15/month per third-party listings)",
    startingPrice: { figure: "$7–15", per: "month", approximate: true, thirdParty: true, checkoutOnly: true, note: "Pro; the vendor shows the price only at checkout" },
    brand: { monogram: "So", color: "#d8232a", logo: "logos/soda-pdf.png", thumbnail: "thumbs/soda-pdf.webp" },
    textEditing: {
      existing: "yes",
      keepsFont: "partial",
      note: "Detects the document's fonts; where a font is unavailable \"the closest match will be suggested\". Free users cannot save the edit.",
    },
    features: {
      annotate: "yes",
      sign: "yes",
      forms: "yes",
      ocr: "yes",
      convert: "yes",
      mergeSplit: "yes",
      compress: "yes",
      desktopApps: "yes",
      mobileApps: "partial",
      api: "yes",
    },
    theyWin: [
      "One of the broadest toolsets: OCR, two-way conversion, translation, e-signatures with timestamps, batch processing and AI tools.",
      "A Windows desktop app and enterprise deployment options.",
      "Uploads up to 100 MB on paid plans and a clear 24-hour deletion rule.",
    ],
    weWin: [
      "Free editing you can actually save; Soda's free editor lets you edit but not download.",
      "No 3 MB or two-files-a-day limit, and no upload.",
      "The embedded font is kept rather than a \"closest match\".",
      "Works the same on macOS and Linux, where Soda has no desktop app.",
    ],
    verdict:
      "Soda PDF is a capable all-rounder if you buy it, and its prices are only revealed at checkout. Its free editor is a demonstration. PDF Edit is a free editor that saves, in the page's own font, without an upload.",
    changes: "Online V15 (April 2026) brought a new editing engine and Google Fonts. A free-access policy from August 2025 defines what the free tier may do.",
    sources: [
      { label: "Soda PDF editor (processing, fonts, free limits)", url: "https://www.sodapdf.com/pdf-editor/", accessed: CHECKED },
      { label: "Soda PDF plans", url: "https://www.sodapdf.com/plans/", accessed: CHECKED },
      { label: "Soda PDF blog: free access policy", url: "https://www.sodapdf.com/blog/soda-pdf-free-access-policy/", accessed: CHECKED },
      { label: "Soda PDF release notes", url: "https://www.sodapdf.com/soda-release-notes", accessed: CHECKED },
      { label: "Soda PDF privacy policy", url: "https://www.sodapdf.com/privacy/", accessed: CHECKED },
    ],
  },
];

// The caveats a starting price carries, as the short words the site shows beside the figure.
export function priceFlags(price: StartingPrice): string[] {
  return [
    price.approximate ? "approx." : "",
    price.regional ? "regional" : "",
    price.thirdParty ? "third-party" : "",
    price.checkoutOnly ? "at checkout" : "",
  ].filter(Boolean);
}

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((item) => item.slug === slug);
}

export const FEATURE_LABELS: Record<keyof Tool["features"], string> = {
  annotate: "Annotate and draw",
  sign: "Sign",
  forms: "Fill forms",
  ocr: "OCR",
  convert: "Convert to and from other formats",
  mergeSplit: "Merge and split",
  compress: "Compress",
  desktopApps: "Desktop apps",
  mobileApps: "Mobile apps",
  api: "API",
};
