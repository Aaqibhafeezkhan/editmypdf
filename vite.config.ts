import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { POSTS } from "./src/data/posts.ts";
import { PUBLIC_ROUTES } from "./src/data/routes.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// An RSS feed of the blog, for readers and for crawlers that follow it.
function feed(origin: string): string {
  const items = POSTS.map(
    (post) =>
      `  <item>\n    <title>${escapeXml(post.title)}</title>\n    <link>${origin}/blog/${post.slug}</link>\n    <guid isPermaLink="true">${origin}/blog/${post.slug}</guid>\n    <pubDate>${new Date(`${post.date}T09:00:00Z`).toUTCString()}</pubDate>\n    <description>${escapeXml(post.description)}</description>\n  </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Stet blog</title>\n  <link>${origin}/blog</link>\n  <description>Engineering notes on editing PDF text in the browser.</description>\n  <language>en</language>\n${items.join("\n")}\n</channel>\n</rss>\n`;
}

// Serves /sitemap.xml and /feed.xml in development and writes them into the build. Set
// VITE_SITE_URL to the site's origin so the entries are absolute; without it they are root-relative.
// The route list is src/data/routes.ts, shared with the prerender.
function sitemap(origin: string): Plugin {
  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_ROUTES
      .map(
        (route) =>
          `  <url><loc>${origin}${route.path}</loc>${route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ""}</url>`,
      )
      .join("\n")}\n</urlset>\n`;
  return {
    name: "sitemap",
    // The prerender's server build (scripts/prerender.mjs) needs neither file.
    apply: (_config, env) => !env.isSsrBuild,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === "/sitemap.xml") {
          response.setHeader("Content-Type", "application/xml");
          response.end(xml());
          return;
        }
        if (request.url === "/feed.xml") {
          response.setHeader("Content-Type", "application/rss+xml");
          response.end(feed(origin));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml() });
      this.emitFile({ type: "asset", fileName: "feed.xml", source: feed(origin) });
    },
  };
}

// `vite preview` answers /pricing with /index.html, which after prerendering is the landing page; a
// static host answers it with /pricing/index.html. This makes the preview do the same, so the
// prerendered pages can be checked with `npm run preview`.
function prerenderedPages(): Plugin {
  return {
    name: "prerendered-pages",
    configurePreviewServer(server) {
      const outDir = path.resolve(root, server.config.build.outDir);
      server.middlewares.use((request, _response, next) => {
        const [pathname = "", query] = (request.url ?? "").split("?");
        if (
          request.method === "GET" &&
          pathname.length > 1 &&
          !pathname.endsWith("/") &&
          !pathname.includes("..") &&
          !path.extname(pathname) &&
          existsSync(path.join(outDir, pathname, "index.html"))
        ) {
          request.url = `${pathname}/index.html${query ? `?${query}` : ""}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const origin = (env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  return {
    plugins: [react(), tailwindcss(), sitemap(origin), prerenderedPages()],
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
      },
    },
  };
});
