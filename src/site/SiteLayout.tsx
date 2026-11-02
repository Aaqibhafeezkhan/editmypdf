import { useLayoutEffect, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  FileText,
  LayoutGrid,
  Menu,
  Scale,
  Tag,
  Workflow,
  X,
} from "lucide-react";
import { ThemeSelect } from "../ThemeSelect.tsx";
import { competitorBySlug } from "../data/competitors.ts";
import { ToolMark } from "./CompareCard.tsx";
import { PRODUCT, publicUrl, ROUTES, siteOrigin } from "../data/product.ts";
import { Logo } from "./Logo.tsx";
import "./site.css";

// Each item carries the icon its page uses in its own heading, so the nav and the page agree.
const NAV = [
  { to: ROUTES.features, label: "Features", icon: LayoutGrid },
  { to: ROUTES.howItWorks, label: "How it works", icon: Workflow },
  { to: ROUTES.compare, label: "Compare", icon: Scale },
  { to: ROUTES.pricing, label: "Pricing", icon: Tag },
  { to: ROUTES.blog, label: "Blog", icon: BookOpen },
  { to: ROUTES.faq, label: "FAQ", icon: CircleHelp },
];

// The comparisons the footer links to, with their marks.
const FOOTER_COMPARISONS = ["ilovepdf", "smallpdf", "adobe-acrobat-online", "sejda"]
  .map((slug) => competitorBySlug(slug))
  .filter((tool): tool is NonNullable<typeof tool> => tool !== undefined);

// Organisation and site records for search engines, the same on every page.
function siteJsonLd(): string {
  const origin = siteOrigin();
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: PRODUCT.name,
      url: `${origin}/`,
      logo: `${origin}/favicon.svg`,
      sameAs: [PRODUCT.repository],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: PRODUCT.name,
      url: `${origin}/`,
      description: PRODUCT.shortDescription,
    },
  ]);
}

// The blocks that rise into view as the page is scrolled, on every page of the site: section
// heads, cards, rows, tables, lists and their items. Children of one parent appear one after
// another. Blocks already on screen when the page opens are shown at once (the page's own fade
// covers them), so only what scrolls into view animates.
const REVEAL = [
  ".section-head",
  ".showcase",
  ".steps-strip",
  ".trust-strip",
  ".mini",
  ".usecase",
  ".seo-copy > div",
  ".fidelity > *",
  ".privacy-copy",
  ".privacy-figure",
  ".cmp-teaser-copy",
  ".glance",
  ".post-card",
  ".cmp-card",
  ".card",
  ".acc-item",
  ".cta",
  ".how-overview > li",
  ".how-step",
  ".limit-card",
  ".terms-points > li",
  ".cmp-number",
  ".cmp-checked",
  ".table-wrap",
  ".cmp-footnote",
  ".price-hero",
  ".price-table-wrap",
  ".price-foot",
  ".pro-list",
  ".cmp-verdict",
  ".post-header",
  ".post-side",
  ".post-body",
  ".post-related",
  ".post-footer > .actions",
  ".stats > div",
  ".point-list > li",
  ".hero-window",
  ".prose",
  ".crumbs",
  ".site-main .actions",
].join(", ");

function useReveal(pathname: string) {
  // A layout effect, so the blocks are tagged before the browser paints the new route.
  useLayoutEffect(() => {
    // The state lives in the data-reveal attribute ("" hidden, "in" shown), never in a class:
    // React rewrites className whenever a component re-renders with a new one (an accordion
    // opening, a step becoming active) and would wipe a class set here.
    const nodes = [...document.querySelectorAll<HTMLElement>(REVEAL)];
    if (nodes.length === 0) return;
    const viewport = window.innerHeight;
    const pending: HTMLElement[] = [];
    const counts = new Map<Element | null, number>();
    for (const node of nodes) {
      if (node.getAttribute("data-reveal") === "in") continue;
      node.setAttribute("data-reveal", "");
      // Siblings follow one another with a short delay.
      const parent = node.parentElement;
      const index = counts.get(parent) ?? 0;
      counts.set(parent, index + 1);
      node.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 70}ms`);
      if (node.getBoundingClientRect().top < viewport * 0.92) node.setAttribute("data-reveal", "in");
      else pending.push(node);
    }
    if (pending.length === 0) return;
    const waiting = new Set(pending);
    const show = (node: HTMLElement) => {
      node.setAttribute("data-reveal", "in");
      waiting.delete(node);
      observer?.unobserve(node);
    };
    // The observer does the work; a scroll check backs it up, because a tab opened in the
    // background gets no intersection notifications until it is shown, and a scroll is the one
    // thing a reader always does before expecting more.
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) if (entry.isIntersecting) show(entry.target as HTMLElement);
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
          )
        : null;
    let frame = 0;
    const check = () => {
      frame = 0;
      const limit = window.innerHeight * 0.92;
      for (const node of waiting) if (node.getBoundingClientRect().top < limit) show(node);
      if (waiting.size === 0) stop();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const stop = () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
    if (observer) pending.forEach((node) => observer.observe(node));
    else schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      stop();
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);
}

export function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // The menu closes when the route changes.
  const [openedAt, setOpenedAt] = useState(pathname);
  const menuOpen = open && openedAt === pathname;
  const toggleMenu = () => {
    if (menuOpen) {
      setOpen(false);
      return;
    }
    setOpenedAt(pathname);
    setOpen(true);
  };
  useReveal(pathname);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd() }} />
      <header className="site-header">
        <div className="container site-header-row">
          <Link to={ROUTES.home} className="site-logo" aria-label={`${PRODUCT.name} home`}>
            <Logo />
          </Link>
          <nav id="site-nav" className={menuOpen ? "site-nav open" : "site-nav"} aria-label="Site">
            {NAV.map((item) =>
              item.to.includes("#") ? (
                <Link key={item.to} to={item.to} className="site-nav-link" onClick={() => setOpen(false)}>
                  <item.icon aria-hidden="true" />
                  {item.label}
                </Link>
              ) : (
                <NavLink key={item.to} to={item.to} className="site-nav-link">
                  <item.icon aria-hidden="true" />
                  {item.label}
                </NavLink>
              ),
            )}
            <Link to={ROUTES.app} className="btn btn-primary site-nav-cta">
              Open the editor <ArrowRight aria-hidden="true" />
            </Link>
          </nav>
          <div className="site-header-actions">
            <ThemeSelect />
            <Link to={ROUTES.app} className="btn btn-primary btn-sm site-header-cta">
              Open the editor <ArrowRight aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="site-menu-button"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={toggleMenu}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="site-main">
        <div key={pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>
              {PRODUCT.name} edits the text in a PDF in the page's own font, entirely in your browser.
              Nothing is uploaded and no account is needed.
            </p>
            <p className="footer-fine">
              Built on{" "}
              <a href={PRODUCT.libraries.reader.url} rel="noopener noreferrer" target="_blank">
                pdf.js
              </a>{" "}
              and{" "}
              <a href={PRODUCT.libraries.writer.url} rel="noopener noreferrer" target="_blank">
                pdf-lib
              </a>
              . Open source under the{" "}
              <a href={PRODUCT.licenseUrl} rel="noopener noreferrer" target="_blank">
                MIT licence
              </a>{" "}
              on{" "}
              <a href={PRODUCT.repository} rel="noopener noreferrer" target="_blank">
                GitHub
              </a>
              .
            </p>
          </div>
          <nav className="footer-col" aria-label="Product">
            <h2>
              <FileText aria-hidden="true" /> Product
            </h2>
            <Link to={ROUTES.app}>Open the editor</Link>
            <Link to={ROUTES.features}>Features</Link>
            <Link to={ROUTES.howItWorks}>How it works</Link>
            <Link to={ROUTES.pricing}>Pricing</Link>
            <Link to={ROUTES.faq}>FAQ</Link>
            <Link to={ROUTES.privacy}>Privacy</Link>
            <Link to={ROUTES.terms}>Terms of use</Link>
          </nav>
          <nav className="footer-col" aria-label="Compare">
            <h2>
              <Scale aria-hidden="true" /> Compare
            </h2>
            {FOOTER_COMPARISONS.map((tool) => (
              <Link key={tool.slug} to={ROUTES.comparison(tool.slug)} className="footer-tool">
                <ToolMark brand={tool.brand} size={16} />
                <span>vs {tool.name}</span>
              </Link>
            ))}
            <Link to={ROUTES.compare}>All comparisons</Link>
          </nav>
          <nav className="footer-col" aria-label="Blog">
            <h2>
              <BookOpen aria-hidden="true" /> Blog
            </h2>
            <Link to={ROUTES.post("why-editing-pdf-text-is-hard")}>Why editing PDF text is hard</Link>
            <Link to={ROUTES.post("exactly-as-the-page-prints-it")}>Opening text exactly as printed</Link>
            <Link to={ROUTES.post("exporting-real-text")}>Exporting edits as real text</Link>
            <Link to={ROUTES.blog}>All posts</Link>
            <a href={publicUrl("feed.xml")}>RSS feed</a>
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>
            © 2026 {PRODUCT.name}. Free to use. <Link to={ROUTES.privacy}>Privacy</Link> ·{" "}
            <Link to={ROUTES.terms}>Terms</Link>
          </span>
          <span>Competitor names and logos belong to their owners and are used only to identify the products compared.</span>
        </div>
      </footer>
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  );
}
