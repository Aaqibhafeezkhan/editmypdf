import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { ThemeSelect } from "../ThemeSelect.tsx";
import { PRODUCT, publicUrl, ROUTES, siteOrigin } from "../data/product.ts";
import { Logo } from "./Logo.tsx";
import "./site.css";

const NAV = [
  { to: ROUTES.features, label: "Features" },
  { to: ROUTES.howItWorks, label: "How it works" },
  { to: ROUTES.compare, label: "Compare" },
  { to: ROUTES.pricing, label: "Pricing" },
  { to: ROUTES.blog, label: "Blog" },
  { to: ROUTES.faq, label: "FAQ" },
];

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

// Elements marked data-reveal fade in as they scroll into view.
function useReveal(pathname: string) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (nodes.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    nodes.forEach((node) => observer.observe(node));
    // Whatever the observer does, nothing stays hidden for long: a throttled background tab or a
    // crawler without intersection events still gets the content.
    const fallback = window.setTimeout(() => nodes.forEach((node) => node.classList.add("in")), 1400);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
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
                  {item.label}
                </Link>
              ) : (
                <NavLink key={item.to} to={item.to} className="site-nav-link">
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
              . Open source under the MIT licence on{" "}
              <a href={PRODUCT.repository} rel="noopener noreferrer" target="_blank">
                GitHub
              </a>
              .
            </p>
          </div>
          <nav className="footer-col" aria-label="Product">
            <h2>Product</h2>
            <Link to={ROUTES.app}>Open the editor</Link>
            <Link to={ROUTES.features}>Features</Link>
            <Link to={ROUTES.howItWorks}>How it works</Link>
            <Link to={ROUTES.pricing}>Pricing</Link>
            <Link to={ROUTES.privacy}>Privacy</Link>
            <Link to={ROUTES.faq}>FAQ</Link>
          </nav>
          <nav className="footer-col" aria-label="Compare">
            <h2>Compare</h2>
            <Link to={ROUTES.comparison("ilovepdf")}>vs iLovePDF</Link>
            <Link to={ROUTES.comparison("smallpdf")}>vs Smallpdf</Link>
            <Link to={ROUTES.comparison("adobe-acrobat-online")}>vs Adobe Acrobat online</Link>
            <Link to={ROUTES.comparison("sejda")}>vs Sejda</Link>
            <Link to={ROUTES.compare}>All comparisons</Link>
          </nav>
          <nav className="footer-col" aria-label="Blog">
            <h2>Blog</h2>
            <Link to={ROUTES.post("why-editing-pdf-text-is-hard")}>Why editing PDF text is hard</Link>
            <Link to={ROUTES.post("exactly-as-the-page-prints-it")}>Opening text exactly as printed</Link>
            <Link to={ROUTES.post("exporting-real-text")}>Exporting edits as real text</Link>
            <Link to={ROUTES.blog}>All posts</Link>
            <a href={publicUrl("feed.xml")}>RSS feed</a>
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 {PRODUCT.name}. Free to use.</span>
          <span>Competitor names belong to their owners and are used only to compare products.</span>
        </div>
      </footer>
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  );
}
